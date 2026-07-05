import * as THREE from 'three';
import { getCharacterSpec, hasCharacterSpec } from '../characters';
import { CharacterModel3D } from './CharacterModel3D';
import npcsData from '../data/npcs.json';
import type { NPCData } from '../types';
import type { AcademyWorldObjects, InteractiveNPC, Obstacle } from './WorldTypes';
import { REGIONS } from './WorldHelpers';
import { GrandHall } from './GrandHall';
import { DiningHall } from './DiningHall';
import { LawnLakeEnvironment } from './LawnLakeEnvironment';
import { LibraryEnvironment } from './LibraryEnvironment';
import { ExtendedAcademyGrounds } from './ExtendedAcademyGrounds';
import { EquipmentShowcase } from './EquipmentShowcase';
import { addWorldPrefabRegion } from './WorldPrefabLayer';
import {
  Geo, UNIT_BOX, getStandardMaterial,
  makeSharedMarbleTexture, makeSharedPlasterTexture, makeSharedWoodTexture, makeSharedCarpetTexture,
  makeSharedSurfaceDetailTexture,
} from './RenderResources';

interface AnimatedObject {
  object: THREE.Object3D;
  baseY: number;
  amplitude: number;
  speed: number;
  phase: number;
}

interface LightGroup {
  center: THREE.Vector3;
  radiusSq: number;
  lights: THREE.PointLight[];
  active: boolean | null;
}

interface RankedPointLight {
  light: THREE.PointLight;
  distanceSq: number;
}

interface DistanceShadowObject {
  object: THREE.Object3D;
  shadowDistanceSq: number;
  shadowsEnabled: boolean | null;
}

interface RegionUpdateGroup {
  id: string;
  updateKey: string;
  center: THREE.Vector3;
  radiusSq: number;
  update: (elapsedTime: number, delta: number) => void;
}

interface StoryNpcObject {
  id: string;
  object: THREE.Object3D;
  rig?: CharacterModel3D;
  baseY: number;
  homeX: number;
  homeZ: number;
  phase: number;
  idleSpeed: number;
  rigUpdateAccumulator: number;
  shadowsEnabled: boolean;
  lastModelState: string | null;
}

const STORY_NPC_IMMEDIATE_ASSET_DISTANCE_SQ = 6.2 * 6.2;
const STORY_NPC_IDLE_ASSET_DISTANCE_SQ = 13 * 13;
const STORY_NPC_HEAVY_IDLE_ASSET_DISTANCE_SQ = 8.5 * 8.5;
const STORY_NPC_ACTIVE_DISTANCE_SQ = 18 * 18;
const STORY_NPC_VISIBLE_DISTANCE_SQ = 12 * 12;
const STORY_NPC_SHADOW_DISTANCE_SQ = 8.5 * 8.5;
const STORY_NPC_FULL_RATE_DISTANCE_SQ = 8.5 * 8.5;
const STORY_NPC_LOOK_AT_DISTANCE_SQ = 4 * 4;
const STORY_NPC_IDLE_PRELOAD_DELAY_SECONDS = 3.2;
const STORY_NPC_HEAVY_IDLE_PRELOAD_DELAY_SECONDS = 8;
const STORY_NPC_FAR_UPDATE_INTERVAL_MOVING = 1 / 18;
const STORY_NPC_FAR_UPDATE_INTERVAL_IDLE = 1 / 12;
const STORY_NPC_ASSET_LOAD_START_INTERVAL_SECONDS = 1.25;
const POINT_LIGHT_UPDATE_DISTANCE_SQ = 0.35 * 0.35;
const POINT_LIGHT_BUDGET = 8;
const POINT_LIGHT_RELEVANCE_MARGIN = 2.5;
const DYNAMIC_OBJECT_SHADOW_DISTANCE_SQ = 14 * 14;
const STATIC_OBJECT_SHADOW_DISTANCE_SQ = 18 * 18;
const DYNAMIC_SHADOW_UPDATE_DISTANCE_SQ = 0.5 * 0.5;
const RUNTIME_DYNAMIC_OBJECT = 'runtimeDynamicObject';
const DISTANCE_SHADOW_DEFAULT = 'distanceShadowDefault';

export class AcademyWorld {
  private readonly obstacles: Obstacle[] = [];
  private readonly npcs: InteractiveNPC[] = [];
  private readonly storyNpcObjects: StoryNpcObject[] = [];
  private readonly animatedObjects: AnimatedObject[] = [];
  private readonly lightGroups: LightGroup[] = [];
  private readonly pointLights: THREE.PointLight[] = [];
  private readonly pointLightProxies: THREE.PointLight[] = [];
  private readonly pointLightRankBuffer: RankedPointLight[] = [];
  private readonly distanceShadowObjects: DistanceShadowObject[] = [];
  private readonly distanceShadowObjectSet = new Set<THREE.Object3D>();
  private readonly regionUpdateGroups: RegionUpdateGroup[] = [];
  private readonly updatedRegionKeys = new Set<string>();
  private readonly distanceShadowWorldPosition = new THREE.Vector3();
  private readonly sunTarget = new THREE.Object3D();
  private sun!: THREE.DirectionalLight;
  private readonly sunOffset = new THREE.Vector3(-8, 12, 6);
  private lastSunFollowX = Number.NaN;
  private lastSunFollowY = Number.NaN;
  private lastSunFollowZ = Number.NaN;
  private lastPointLightUpdateX = Number.NaN;
  private lastPointLightUpdateZ = Number.NaN;
  private lastDynamicShadowUpdateX = Number.NaN;
  private lastDynamicShadowUpdateZ = Number.NaN;
  private lastStoryNpcAssetLoadStartTime = Number.NEGATIVE_INFINITY;
  private lyraRigUpdateAccumulator = 0;
  private playerRig!: CharacterModel3D;
  private lyraRig!: CharacterModel3D;
  private player!: THREE.Object3D;
  private lyra!: THREE.Object3D;
  private grandHall: GrandHall;
  private diningHall: DiningHall;
  private outdoor: LawnLakeEnvironment;
  private extendedGrounds: ExtendedAcademyGrounds;
  private equipmentShowcase: EquipmentShowcase;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly onSceneAssetInstalled?: () => void,
  ) {
    this.grandHall = new GrandHall(this.scene, this.onSceneAssetInstalled);
    this.diningHall = new DiningHall(this.scene, this.onSceneAssetInstalled);
    this.outdoor = new LawnLakeEnvironment(this.scene);
    this.extendedGrounds = new ExtendedAcademyGrounds(this.scene);
    this.equipmentShowcase = new EquipmentShowcase(this.scene);
  }

  private readonly marbleTex = makeSharedMarbleTexture('#d8d0dc', '#afa0b9', '#f0e8f3');
  private readonly plasterTex = makeSharedPlasterTexture('#c8bdc9', '#a99dae', '#d7ccd8');
  private readonly woodTex = makeSharedWoodTexture();
  private readonly carpetTex = makeSharedCarpetTexture();
  private readonly marbleDetailTex = makeSharedSurfaceDetailTexture('atrium-marble', 4.4, 3.1);
  private readonly plasterDetailTex = makeSharedSurfaceDetailTexture('atrium-plaster', 2.4, 1.2);
  private readonly woodDetailTex = makeSharedSurfaceDetailTexture('atrium-wood', 1.4, 2.4);

  build(): AcademyWorldObjects {
    // 天空渐变 — 暖蓝黄昏色调
    this.scene.background = this.makeSkyTexture();
    this.scene.fog = new THREE.FogExp2(0xb6c8d8, 0.018);
    this.scene.environment = this.makeEnvironmentMap();

    this.addLights();
    this.addAcademyArchitecture();
    this.addCharacters();

    // 构建新区域
    this.obstacles.push(...this.grandHall.build());
    this.obstacles.push(...this.diningHall.build());
    this.obstacles.push(...this.outdoor.build());
    this.obstacles.push(...this.extendedGrounds.build());
    this.obstacles.push(...this.equipmentShowcase.build());

    // 区域间通道 — 移除阻挡通行的障碍
    this.clearPassages();

    // 收集点光源并按区域分组，用于动态开关
    this.collectPointLightsByRegion();
    // 注册区域动画更新组，用于按距离裁剪
    this.registerRegionUpdateGroups();
    this.freezeStaticSceneMatrices();

    return {
      player: this.player,
      lyra: this.lyra,
      npcs: this.npcs,
      obstacles: this.obstacles,
    };
  }

  update(elapsedTime: number, delta: number, playerMoving: boolean): void {
    this.playerRig.setMoving(playerMoving);
    this.playerRig.update(elapsedTime, delta);
    this.updateLyraRig(elapsedTime, delta, playerMoving);
    this.updateStoryNpcs(elapsedTime, delta, playerMoving);
    this.updateDistanceShadows();

    this.updateSunFollow();

    // 按距离裁剪区域动画 + 动态开关点光源
    this.updateRegions(elapsedTime, delta);
    this.updatePointLights();
  }

  private updateLyraRig(elapsedTime: number, delta: number, playerMoving: boolean): void {
    this.lyraRig.setMoving(false);
    const dx = this.player.position.x - this.lyra.position.x;
    const dz = this.player.position.z - this.lyra.position.z;
    const distanceSq = dx * dx + dz * dz;
    const fullRate = distanceSq <= STORY_NPC_FULL_RATE_DISTANCE_SQ
      || distanceSq <= STORY_NPC_LOOK_AT_DISTANCE_SQ;
    if (fullRate) {
      this.lyraRigUpdateAccumulator = 0;
      this.lyraRig.update(elapsedTime, delta, this.player.position);
      return;
    }

    this.lyraRigUpdateAccumulator += delta;
    const updateInterval = playerMoving
      ? STORY_NPC_FAR_UPDATE_INTERVAL_MOVING
      : STORY_NPC_FAR_UPDATE_INTERVAL_IDLE;
    if (this.lyraRigUpdateAccumulator < updateInterval) return;

    const rigDelta = Math.min(this.lyraRigUpdateAccumulator, 0.12);
    this.lyraRigUpdateAccumulator = 0;
    this.lyraRig.update(elapsedTime, rigDelta, this.player.position);
  }

  getPlayerPosition(): THREE.Object3D {
    return this.player;
  }

  getInteractiveNpcCount(): number {
    return this.npcs.length;
  }

  /**
   * 遍历场景中所有 PointLight，按最近的区域中心分组。
   * 用最近中心而非 AABB 包含，避免区域边界重叠时灯光被错配
   * （例如 Lake 与 Lawn 边界重叠，月光应归 Lake 而非 Lawn）。
   * 运行时根据玩家位置动态开关光源，减少同时活跃的光源数量。
   */
  private collectPointLightsByRegion(): void {
    this.pointLights.length = 0;
    this.lightGroups.length = 0;
    const lightsByRegion = new Map<string, THREE.PointLight[]>();
    this.scene.traverse((obj) => {
      if (!(obj instanceof THREE.PointLight)) return;
      if (obj.userData.runtimePointLightProxy) return;
      this.pointLights.push(obj);
      // 找距光源最近的区域中心
      let bestId: string | null = null;
      let bestDistSq = Infinity;
      for (const region of REGIONS) {
        const cx = (region.bounds.minX + region.bounds.maxX) / 2;
        const cz = (region.bounds.minZ + region.bounds.maxZ) / 2;
        const dx = obj.position.x - cx;
        const dz = obj.position.z - cz;
        const d = dx * dx + dz * dz;
        if (d < bestDistSq) {
          bestDistSq = d;
          bestId = region.id;
        }
      }
      const id = bestId ?? '__global__';
      const arr = lightsByRegion.get(id);
      if (arr) arr.push(obj);
      else lightsByRegion.set(id, [obj]);
    });

    for (const region of REGIONS) {
      const lights = lightsByRegion.get(region.id);
      if (!lights || lights.length === 0) continue;
      const cx = (region.bounds.minX + region.bounds.maxX) / 2;
      const cz = (region.bounds.minZ + region.bounds.maxZ) / 2;
      const w = region.bounds.maxX - region.bounds.minX;
      const d = region.bounds.maxZ - region.bounds.minZ;
      // 启用半径 = 区域较窄边的一半 + 余量，保证区域内部完全覆盖且边缘略有重叠
      const radius = Math.min(w, d) / 2 + 4;
      this.lightGroups.push({
        center: new THREE.Vector3(cx, 0, cz),
        radiusSq: radius * radius,
        lights,
        active: null,
      });
    }

    for (const light of this.pointLights) {
      light.visible = false;
    }

    this.ensurePointLightProxies();
  }

  private updateSunFollow(): void {
    const { x, y, z } = this.player.position;
    if (x === this.lastSunFollowX && y === this.lastSunFollowY && z === this.lastSunFollowZ) return;

    this.lastSunFollowX = x;
    this.lastSunFollowY = y;
    this.lastSunFollowZ = z;
    this.sunTarget.position.copy(this.player.position);
    this.sun.position.copy(this.player.position).add(this.sunOffset);
  }

  private updatePointLights(): void {
    const px = this.player.position.x;
    const pz = this.player.position.z;
    const movedX = px - this.lastPointLightUpdateX;
    const movedZ = pz - this.lastPointLightUpdateZ;
    if (movedX * movedX + movedZ * movedZ < POINT_LIGHT_UPDATE_DISTANCE_SQ) return;

    this.lastPointLightUpdateX = px;
    this.lastPointLightUpdateZ = pz;

    this.pointLightRankBuffer.length = 0;
    for (const group of this.lightGroups) {
      const dx = px - group.center.x;
      const dz = pz - group.center.z;
      const near = dx * dx + dz * dz < group.radiusSq;
      group.active = near;
      if (!near) continue;

      for (const light of group.lights) {
        const lightDx = px - light.position.x;
        const lightDz = pz - light.position.z;
        const distanceSq = lightDx * lightDx + lightDz * lightDz;
        const relevanceRadius = light.distance > 0
          ? light.distance + POINT_LIGHT_RELEVANCE_MARGIN
          : Number.POSITIVE_INFINITY;
        if (distanceSq > relevanceRadius * relevanceRadius) continue;
        this.pointLightRankBuffer.push({ light, distanceSq });
      }
    }

    this.pointLightRankBuffer.sort((a, b) => a.distanceSq - b.distanceSq);
    for (let i = 0; i < this.pointLightProxies.length; i += 1) {
      const proxy = this.pointLightProxies[i];
      const source = this.pointLightRankBuffer[i]?.light;
      if (!source) {
        proxy.intensity = 0;
        proxy.distance = 1;
        continue;
      }

      proxy.position.copy(source.position);
      proxy.color.copy(source.color);
      proxy.intensity = source.intensity;
      proxy.distance = source.distance;
      proxy.decay = source.decay;
    }
  }

  private updateDistanceShadows(force = false): void {
    if (this.distanceShadowObjects.length === 0) return;

    const px = this.player.position.x;
    const pz = this.player.position.z;
    const movedX = px - this.lastDynamicShadowUpdateX;
    const movedZ = pz - this.lastDynamicShadowUpdateZ;
    if (!force && movedX * movedX + movedZ * movedZ < DYNAMIC_SHADOW_UPDATE_DISTANCE_SQ) return;

    this.lastDynamicShadowUpdateX = px;
    this.lastDynamicShadowUpdateZ = pz;
    for (const entry of this.distanceShadowObjects) {
      entry.object.getWorldPosition(this.distanceShadowWorldPosition);
      const dx = px - this.distanceShadowWorldPosition.x;
      const dz = pz - this.distanceShadowWorldPosition.z;
      const enabled = dx * dx + dz * dz <= entry.shadowDistanceSq;
      if (entry.shadowsEnabled === enabled) continue;

      entry.shadowsEnabled = enabled;
      this.setObjectShadows(entry.object, enabled);
    }
  }

  private ensurePointLightProxies(): void {
    while (this.pointLightProxies.length < POINT_LIGHT_BUDGET) {
      const light = new THREE.PointLight(0xffffff, 0, 1, 2);
      light.visible = true;
      light.userData.runtimePointLightProxy = true;
      light.userData[RUNTIME_DYNAMIC_OBJECT] = true;
      light.name = `Runtime point light proxy ${this.pointLightProxies.length + 1}`;
      this.pointLightProxies.push(light);
      this.scene.add(light);
    }
  }

  /**
   * 把每个区域的 update 函数注册为按距离裁剪的更新组。
   * 玩家附近的区域每帧更新动画，远处区域冻结以节省 CPU/GPU。
   */
  private registerRegionUpdateGroups(): void {
    const make = (id: string, updateKey: string, fn: (t: number, d: number) => void): RegionUpdateGroup => {
      const region = REGIONS.find((r) => r.id === id);
      if (!region) throw new Error(`Unknown region: ${id}`);
      const cx = (region.bounds.minX + region.bounds.maxX) / 2;
      const cz = (region.bounds.minZ + region.bounds.maxZ) / 2;
      const w = region.bounds.maxX - region.bounds.minX;
      const d = region.bounds.maxZ - region.bounds.minZ;
      const radius = Math.min(w, d) / 2 + 4;
      return {
        id,
        updateKey,
        center: new THREE.Vector3(cx, 0, cz),
        radiusSq: radius * radius,
        update: fn,
      };
    };

    this.regionUpdateGroups.push(
      make('atrium', 'atrium', (t, d) => {
        const frameScale = d * 60;
        for (const item of this.animatedObjects) {
          item.object.position.y = item.baseY + Math.sin(t * item.speed + item.phase) * item.amplitude;
          item.object.rotation.y += 0.006 * frameScale;
        }
      }),
      make('grand_hall', 'grandHall', (t, d) => this.grandHall.update(t, d)),
      make('dining_hall', 'diningHall', (t, d) => this.diningHall.update(t, d)),
      make('lawn', 'outdoorLawn', (t, d) => this.outdoor.updateLawn(t, d)),
      make('lake', 'outdoorLake', (t, d) => this.outdoor.updateLake(t, d)),
      make('greenhouse', 'extendedGrounds', (t, d) => this.extendedGrounds.update(t, d)),
      make('training_ground', 'extendedGrounds', (t, d) => this.extendedGrounds.update(t, d)),
      make('training_ground', 'equipmentShowcase', (t) => this.equipmentShowcase.update(t)),
      make('moonstone_grotto', 'extendedGrounds', (t, d) => this.extendedGrounds.update(t, d)),
    );
  }

  private updateRegions(elapsedTime: number, delta: number): void {
    const px = this.player.position.x;
    const pz = this.player.position.z;
    this.updatedRegionKeys.clear();
    for (const group of this.regionUpdateGroups) {
      const dx = px - group.center.x;
      const dz = pz - group.center.z;
      if (dx * dx + dz * dz > group.radiusSq) continue;
      if (this.updatedRegionKeys.has(group.updateKey)) continue;
      this.updatedRegionKeys.add(group.updateKey);
      group.update(elapsedTime, delta);
    }
  }

  getCharacterModelStates(): Record<'player' | 'lyra', string> {
    return {
      player: this.playerRig.getModelState(),
      lyra: this.lyraRig.getModelState(),
    };
  }

  /** 直接返回序列化字符串，避免每帧分配中间对象 */
  getCharacterModelStatesString(): string {
    return `player:${this.playerRig.getModelState()},lyra:${this.lyraRig.getModelState()}`;
  }

  private freezeStaticSceneMatrices(): void {
    this.markDynamicSceneObjects();
    let frozen = 0;

    const visit = (object: THREE.Object3D, dynamicAncestor: boolean): void => {
      const dynamicSubtree = dynamicAncestor
        || object.userData[RUNTIME_DYNAMIC_OBJECT] === true
        || object instanceof THREE.Light
        || object instanceof THREE.Camera;

      if (!dynamicSubtree && object !== this.scene) {
        object.updateMatrix();
        object.matrixAutoUpdate = false;
        frozen += 1;
      }

      for (const child of object.children) visit(child, dynamicSubtree);
    };

    visit(this.scene, false);
    this.scene.updateMatrixWorld(true);
    this.scene.userData.staticMatrixFreezeCount = frozen;
  }

  private markDynamicSceneObjects(): void {
    this.markRuntimeDynamic(this.sunTarget);
    this.markRuntimeDynamic(this.player);
    this.markRuntimeDynamic(this.lyra);
    for (const npc of this.storyNpcObjects) this.markRuntimeDynamic(npc.object);
    for (const item of this.animatedObjects) this.markRuntimeDynamicWithDistanceShadows(item.object);
    for (const object of this.grandHall.getDynamicObjects()) this.markRuntimeDynamicWithDistanceShadows(object);
    for (const object of this.diningHall.getDynamicObjects()) this.markRuntimeDynamicWithDistanceShadows(object);
    for (const object of this.outdoor.getDynamicObjects()) this.markRuntimeDynamicWithDistanceShadows(object);
    for (const object of this.extendedGrounds.getDynamicObjects()) this.markRuntimeDynamicWithDistanceShadows(object);
    for (const object of this.equipmentShowcase.getDynamicObjects()) this.markRuntimeDynamicWithDistanceShadows(object);
    for (const light of this.pointLightProxies) this.markRuntimeDynamic(light);
    this.registerStaticDistanceShadowObjects();
    this.updateDistanceShadows(true);
  }

  private markRuntimeDynamic(object: THREE.Object3D | undefined): void {
    if (!object) return;
    object.userData[RUNTIME_DYNAMIC_OBJECT] = true;
  }

  private markRuntimeDynamicWithDistanceShadows(object: THREE.Object3D | undefined): void {
    if (!object) return;
    this.markRuntimeDynamic(object);
    this.registerDistanceShadowObject(object, DYNAMIC_OBJECT_SHADOW_DISTANCE_SQ);
  }

  private registerStaticDistanceShadowObjects(): void {
    const visit = (object: THREE.Object3D, dynamicAncestor: boolean): void => {
      const dynamicSubtree = dynamicAncestor || object.userData[RUNTIME_DYNAMIC_OBJECT] === true;
      if (!dynamicSubtree && object instanceof THREE.Mesh && object.castShadow) {
        this.registerDistanceShadowObject(object, STATIC_OBJECT_SHADOW_DISTANCE_SQ);
      }

      for (const child of object.children) visit(child, dynamicSubtree);
    };

    visit(this.scene, false);
  }

  private registerDistanceShadowObject(object: THREE.Object3D, shadowDistanceSq: number): void {
    if (this.distanceShadowObjectSet.has(object)) return;
    this.distanceShadowObjectSet.add(object);
    this.distanceShadowObjects.push({
      object,
      shadowDistanceSq,
      shadowsEnabled: null,
    });
  }

  /**
   * 在障碍物列表中开辟通道。
   * 不是删除与通道重叠的整个障碍，而是把障碍裁剪成保留墙体的片段。
   * 只在通道宽度方向裁剪（北/南通道沿 x 轴切，东通道沿 z 轴切）。
   */
  private clearPassages(): void {
    // 通道定义 — 门洞区域，障碍物在这些范围内被裁掉
    const passages = [
      // 北通道 (中庭→大厅) — 沿 x 轴在北墙上开门，x:[-1.2,1.2]
      { axis: 'x' as const, minX: -1.4, maxX: 1.4, minZ: -8, maxZ: -5.5 },
      // 东通道 (中庭→食堂) — 沿 z 轴在东墙上开门，z:[-1.5,1.5]
      { axis: 'z' as const, minX: 8, maxX: 10.5, minZ: -1.7, maxZ: 1.7 },
      // 西通道 (中庭→水晶温室) — 沿 z 轴在西墙开门，z:[-1.6,1.6]
      { axis: 'z' as const, minX: -10.5, maxX: -8.0, minZ: -1.65, maxZ: 1.65 },
      // 南通道 (中庭→草坪) — 沿 x 轴在南墙开门（南墙是装饰边框，低矮可跨越所以不需要裁）
      // 南面本来就是开放的，没有整面墙障碍
    ];

    const result: Obstacle[] = [];

    for (const obs of this.obstacles) {
      let pieces: Obstacle[] = [{ ...obs }];

      for (const passage of passages) {
        const next: Obstacle[] = [];
        for (const piece of pieces) {
          // 检查 piece 是否与通道重叠
          const overlaps =
            piece.minX < passage.maxX && piece.maxX > passage.minX &&
            piece.minZ < passage.maxZ && piece.maxZ > passage.minZ;

          if (!overlaps) {
            next.push(piece);
            continue;
          }

          // 有重叠 — 根据 axis 裁剪
          if (passage.axis === 'x') {
            // 沿 x 轴切：保留 x 在门洞左右两侧的部分
            if (piece.minX < passage.minX) {
              next.push({ ...piece, maxX: passage.minX });
            }
            if (piece.maxX > passage.maxX) {
              next.push({ ...piece, minX: passage.maxX });
            }
          } else {
            // 沿 z 轴切：保留 z 在门洞前后两侧的部分
            if (piece.minZ < passage.minZ) {
              next.push({ ...piece, maxZ: passage.minZ });
            }
            if (piece.maxZ > passage.maxZ) {
              next.push({ ...piece, minZ: passage.maxZ });
            }
          }
        }
        pieces = next;
      }

      result.push(...pieces);
    }

    this.obstacles.length = 0;
    this.obstacles.push(...result);
  }

  private addLights(): void {
    // 半球光 — 天空暖色 / 地面冷色，提供基础环境照明
    const hemi = new THREE.HemisphereLight(0xffe8c8, 0x4f526a, 0.82);
    hemi.position.set(0, 20, 0);
    this.scene.add(hemi);

    // 太阳 — 黄金时段斜射光
    this.sun = new THREE.DirectionalLight(0xffd49a, 3.25);
    this.sun.position.copy(this.sunOffset);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 55;
    this.sun.shadow.camera.left = -22;
    this.sun.shadow.camera.right = 22;
    this.sun.shadow.camera.top = 22;
    this.sun.shadow.camera.bottom = -22;
    this.sun.shadow.bias = -0.00018;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.radius = 4;
    this.scene.add(this.sun);
    this.scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;

    // 补光 — 冷蓝色反向填充
    const fill = new THREE.DirectionalLight(0x8eb4d8, 0.34);
    fill.position.set(6, 4, -5);
    this.scene.add(fill);

    this.addPointLight(-5.7, 2.8, -4.8, 0xffc877, 1.5, 5.4);
    this.addPointLight(5.7, 2.8, -4.8, 0xffc877, 1.5, 5.4);
    this.addPointLight(6.5, 1.8, -0.4, 0x9bc5ff, 1.2, 4.4);
    this.addPointLight(-4.2, 2.8, 3.2, 0xffd990, 1.0, 4.2);
  }

  /** 天空渐变纹理 — 从地平线暖色到天顶深蓝 */
  private makeSkyTexture(): THREE.CanvasTexture {
    const w = 16;
    const h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, '#4a6e9a');   // 天顶 — 深蓝
    grad.addColorStop(0.35, '#7a9ec4');  // 中天 — 蓝白
    grad.addColorStop(0.62, '#c4d4e8');  // 高空 — 淡蓝白
    grad.addColorStop(0.80, '#f0d8b8');  // 地平线上 — 暖黄
    grad.addColorStop(1.0, '#e8c898');   // 地平线 — 金色

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  }

  /** 环境贴图 — 用于 PBR 材质反射 */
  private makeEnvironmentMap(): THREE.Texture {
    // 用天空纹理作为环境反射
    const tex = this.makeSkyTexture();
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  }

  private addAcademyArchitecture(): void {
    this.addFloor();
    this.addWalls();
    this.addWallPanels();
    this.addWallSurfaceDetails();
    this.addWindows();
    this.addArchedDoor();
    this.addWestGreenhousePortal();
    this.addColumnsAndBeams();
    this.addLibrary();
    this.addStudyArea();
    this.addRugsAndFloorDetails();
    addWorldPrefabRegion(this.scene, 'atrium', this.onSceneAssetInstalled);

    this.obstacles.push(
      { minX: -8.9, maxX: 8.9, minZ: -6.45, maxZ: -5.95 },
      { minX: -9.05, maxX: -8.45, minZ: -6.35, maxZ: 6.2 },
      { minX: 8.45, maxX: 9.05, minZ: -6.35, maxZ: 6.2 },
      { minX: 3.35, maxX: 8.2, minZ: -6.15, maxZ: -3.75 },
      { minX: 7.2, maxX: 8.35, minZ: -3.85, maxZ: 0.8 },
      { minX: 3.6, maxX: 6.95, minZ: -0.82, maxZ: 0.62 },
      { minX: -6.8, maxX: -6.1, minZ: -4.95, maxZ: -4.1 },
      { minX: 5.8, maxX: 6.5, minZ: 3.15, maxZ: 3.95 },
      { minX: -7.8, maxX: -6.9, minZ: 2.65, maxZ: 3.55 }
    );
  }

  private addFloor(): void {
    const floor = new THREE.Mesh(
      Geo.box(18, 0.16, 13.2),
      getStandardMaterial({
        color: 0xc9c0ce,
        roughness: 0.42,
        metalness: 0.05,
        map: this.marbleTex,
        bumpMap: this.marbleDetailTex,
        bumpScale: 0.026,
        roughnessMap: this.marbleDetailTex,
      })
    );
    floor.position.set(0, -0.08, 0);
    floor.receiveShadow = true;
    this.scene.add(floor);

    const grooveMat = getStandardMaterial({ color: 0x6f6078, roughness: 0.55, metalness: 0.05 });
    for (let x = -8.1; x <= 8.1; x += 1.35) {
      this.addBox(new THREE.Vector3(x, 0.018, 0), new THREE.Vector3(0.022, 0.022, 12.8), grooveMat, false, true);
    }
    for (let z = -5.95; z <= 5.95; z += 1.2) {
      this.addBox(new THREE.Vector3(0, 0.022, z), new THREE.Vector3(17.6, 0.022, 0.022), grooveMat, false, true);
    }

    const borderMat = getStandardMaterial({ color: 0xc7a060, roughness: 0.24, metalness: 0.48 });
    const borders: Array<[number, number, number, number]> = [
      [0, -6.14, 17.3, 0.08],
      [0, 6.14, 17.3, 0.08],
      [-8.65, 0, 0.08, 12.3],
      [8.65, 0, 0.08, 12.3],
      [4.95, -2.8, 6.15, 0.06],
      [1.86, -1.15, 0.06, 3.35],
      [8.0, -1.15, 0.06, 3.35],
    ];
    for (const [x, z, width, depth] of borders) {
      this.addBox(new THREE.Vector3(x, 0.055, z), new THREE.Vector3(width, 0.05, depth), borderMat, true, true);
    }
  }

  private addWalls(): void {
    const wallMat = getStandardMaterial({
      color: 0xb8adbd,
      roughness: 0.58,
      metalness: 0.03,
      map: this.plasterTex,
      bumpMap: this.plasterDetailTex,
      bumpScale: 0.035,
      roughnessMap: this.plasterDetailTex,
    });
    const lowerMat = getStandardMaterial({ color: 0x7b6680, roughness: 0.5, metalness: 0.08 });
    const trimMat = getStandardMaterial({ color: 0xbf985d, roughness: 0.25, metalness: 0.45 });

    // 北墙 — 分成左右两段，中间留门洞 (x:[-1.2, 1.2] 开放)
    this.addBox(new THREE.Vector3(-4.8, 2.25, -6.62), new THREE.Vector3(7.8, 4.5, 0.45), wallMat, false, true);
    this.addBox(new THREE.Vector3(4.8, 2.25, -6.62), new THREE.Vector3(7.8, 4.5, 0.45), wallMat, false, true);
    // 门洞上方过梁
    this.addBox(new THREE.Vector3(0, 3.8, -6.62), new THREE.Vector3(2.4, 1.4, 0.45), wallMat, false, true);

    // 东墙 — 分成南北两段，中间留通道 (z:[-1.5, 1.5] 开放)
    this.addBox(new THREE.Vector3(9.12, 2.15, -4.0), new THREE.Vector3(0.45, 4.3, 5), wallMat, false, true);
    this.addBox(new THREE.Vector3(9.12, 2.15, 3.5), new THREE.Vector3(0.45, 4.3, 5), wallMat, false, true);
    // 通道上方过梁
    this.addBox(new THREE.Vector3(9.12, 3.8, 0), new THREE.Vector3(0.45, 1.4, 3.5), wallMat, false, true);

    // 北墙踢脚线 — 分段
    this.addBox(new THREE.Vector3(-4.8, 0.58, -6.35), new THREE.Vector3(7.6, 0.88, 0.28), lowerMat, true, true);
    this.addBox(new THREE.Vector3(4.8, 0.58, -6.35), new THREE.Vector3(7.6, 0.88, 0.28), lowerMat, true, true);

    // 东墙踢脚线 — 分段
    this.addBox(new THREE.Vector3(8.86, 0.58, -4.0), new THREE.Vector3(0.28, 0.88, 5), lowerMat, true, true);
    this.addBox(new THREE.Vector3(8.86, 0.58, 3.5), new THREE.Vector3(0.28, 0.88, 5), lowerMat, true, true);

    // 北墙装饰条 — 分段
    this.addBox(new THREE.Vector3(-4.8, 1.08, -6.08), new THREE.Vector3(7.4, 0.12, 0.12), trimMat, true, true);
    this.addBox(new THREE.Vector3(4.8, 1.08, -6.08), new THREE.Vector3(7.4, 0.12, 0.12), trimMat, true, true);
    this.addBox(new THREE.Vector3(-4.8, 4.38, -6.08), new THREE.Vector3(7.2, 0.18, 0.14), trimMat, true, true);
    this.addBox(new THREE.Vector3(4.8, 4.38, -6.08), new THREE.Vector3(7.2, 0.18, 0.14), trimMat, true, true);

    // 东墙装饰条 — 分段
    this.addBox(new THREE.Vector3(8.58, 1.08, -4.0), new THREE.Vector3(0.12, 0.12, 5), trimMat, true, true);
    this.addBox(new THREE.Vector3(8.58, 1.08, 3.5), new THREE.Vector3(0.12, 0.12, 5), trimMat, true, true);
  }

  private addWallPanels(): void {
    const panelMat = getStandardMaterial({ color: 0x9f91aa, roughness: 0.56, metalness: 0.04 });
    const insetMat = getStandardMaterial({ color: 0x77647f, roughness: 0.62, metalness: 0.04 });
    const trimMat = getStandardMaterial({ color: 0xc7a060, roughness: 0.24, metalness: 0.48 });

    for (const x of [-7.1, -4.7, -2.35, 2.35, 4.7, 7.1]) {
      this.addFramedPanel(new THREE.Vector3(x, 2.65, -6.35), 1.28, 2.05, 'back', panelMat, insetMat, trimMat);
    }
    // 东墙面板 — 跳过 z=0 附近，留通道
    for (const z of [-4.85, -2.45, 2.45, 4.85]) {
      this.addFramedPanel(new THREE.Vector3(-8.68, 2.54, z), 1.22, 1.9, 'left', panelMat, insetMat, trimMat);
      this.addFramedPanel(new THREE.Vector3(8.68, 2.54, z), 1.22, 1.9, 'right', panelMat, insetMat, trimMat);
    }
  }

  private addWallSurfaceDetails(): void {
    const seamMat = getStandardMaterial({ color: 0x6f6277, roughness: 0.72, metalness: 0.02 });
    const chipMat = getStandardMaterial({ color: 0x8f8197, roughness: 0.7, metalness: 0.03 });
    const trimMat = getStandardMaterial({ color: 0xc7a060, roughness: 0.3, metalness: 0.45 });

    for (const x of [-7.6, -5.2, -2.8, 2.8, 5.2, 7.6]) {
      this.addBox(new THREE.Vector3(x, 2.6, -6.04), new THREE.Vector3(0.024, 2.5, 0.05), seamMat, false, true);
    }
    for (const y of [1.45, 2.28, 3.12]) {
      this.addBox(new THREE.Vector3(-4.8, y, -6.035), new THREE.Vector3(7.3, 0.022, 0.05), seamMat, false, true);
      this.addBox(new THREE.Vector3(4.8, y, -6.035), new THREE.Vector3(7.3, 0.022, 0.05), seamMat, false, true);
    }

    for (const z of [-5.35, -3.45, 2.9, 4.75]) {
      this.addBox(new THREE.Vector3(8.55, 2.48, z), new THREE.Vector3(0.05, 2.35, 0.024), seamMat, false, true);
      this.addBox(new THREE.Vector3(-8.55, 2.48, z), new THREE.Vector3(0.05, 2.35, 0.024), seamMat, false, true);
    }
    for (const y of [1.38, 3.18]) {
      this.addBox(new THREE.Vector3(8.55, y, -4.0), new THREE.Vector3(0.05, 0.022, 4.5), seamMat, false, true);
      this.addBox(new THREE.Vector3(8.55, y, 3.5), new THREE.Vector3(0.05, 0.022, 4.45), seamMat, false, true);
      this.addBox(new THREE.Vector3(-8.55, y, -1.0), new THREE.Vector3(0.05, 0.022, 11.2), seamMat, false, true);
    }

    for (const [x, y, z, side] of [
      [-6.1, 3.48, -6.0, 'back'],
      [4.4, 1.7, -6.0, 'back'],
      [8.52, 2.85, -3.0, 'side'],
      [-8.52, 2.2, 3.4, 'side'],
    ] as Array<[number, number, number, 'back' | 'side']>) {
      const chip = new THREE.Mesh(Geo.dodecahedron(0.11, 0), chipMat);
      chip.position.set(x, y, z);
      chip.scale.set(side === 'back' ? 1 : 0.42, 0.32, side === 'back' ? 0.42 : 1);
      chip.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
      chip.castShadow = true;
      chip.receiveShadow = true;
      this.scene.add(chip);
    }

    const medallionGeo = Geo.torus(0.18, 0.016, 8, 24);
    for (const [x, z] of [[-2.9, -6.0], [2.9, -6.0], [8.52, -1.95], [8.52, 2.05]] as Array<[number, number]>) {
      const medallion = new THREE.Mesh(medallionGeo, trimMat);
      medallion.position.set(x, 3.58, z);
      if (Math.abs(x) > 8) medallion.rotation.y = Math.PI / 2;
      medallion.castShadow = true;
      this.scene.add(medallion);
    }
  }

  private addWindows(): void {
    const frameMat = getStandardMaterial({ color: 0xc7a060, roughness: 0.24, metalness: 0.45 });
    const glassMat = getStandardMaterial({
      color: 0xbfe7ff,
      emissive: 0x5c8eda,
      emissiveIntensity: 0.18,
      transparent: true,
      opacity: 0.58,
      roughness: 0.12,
      metalness: 0.02,
    });
    const stoneMat = getStandardMaterial({ color: 0x8f8298, roughness: 0.52, metalness: 0.08 });

    for (const x of [-5.65, 5.65]) {
      this.addBox(new THREE.Vector3(x, 2.88, -6.02), new THREE.Vector3(1.65, 2.5, 0.08), glassMat, false, false);
      this.addBox(new THREE.Vector3(x, 1.56, -5.92), new THREE.Vector3(1.95, 0.18, 0.32), stoneMat, true, true);
      this.addBox(new THREE.Vector3(x, 4.16, -5.94), new THREE.Vector3(1.86, 0.12, 0.16), frameMat, true, true);
      this.addBox(new THREE.Vector3(x, 2.88, -5.92), new THREE.Vector3(0.08, 2.58, 0.16), frameMat, true, true);
      this.addBox(new THREE.Vector3(x - 0.84, 2.88, -5.92), new THREE.Vector3(0.08, 2.56, 0.16), frameMat, true, true);
      this.addBox(new THREE.Vector3(x + 0.84, 2.88, -5.92), new THREE.Vector3(0.08, 2.56, 0.16), frameMat, true, true);
      this.addBox(new THREE.Vector3(x, 2.88, -5.9), new THREE.Vector3(1.78, 0.08, 0.16), frameMat, true, true);
      this.addWindowLightPatch(x - 0.55, -2.4);
    }
  }

  private addArchedDoor(): void {
    const trimMat = getStandardMaterial({ color: 0xc7a060, roughness: 0.24, metalness: 0.48 });

    // 门框 — 左右立柱 + 顶部横梁 + 拱形 (门洞开放，无门板)
    this.addBox(new THREE.Vector3(-0.86, 1.7, -5.84), new THREE.Vector3(0.12, 3.32, 0.18), trimMat, true, true);
    this.addBox(new THREE.Vector3(0.86, 1.7, -5.84), new THREE.Vector3(0.12, 3.32, 0.18), trimMat, true, true);
    this.addBox(new THREE.Vector3(0, 3.36, -5.84), new THREE.Vector3(1.85, 0.12, 0.18), trimMat, true, true);

    const arch = new THREE.Mesh(Geo.torusArc(0.88, 0.055, 12, 28, Math.PI), trimMat);
    arch.position.set(0, 3.34, -5.84);
    arch.rotation.z = Math.PI;
    arch.castShadow = true;
    this.scene.add(arch);
  }

  private addWestGreenhousePortal(): void {
    const trimMat = getStandardMaterial({ color: 0xc7a060, roughness: 0.24, metalness: 0.48 });
    const glassMat = getStandardMaterial({
      color: 0xaef5df,
      emissive: 0x4cbf9e,
      emissiveIntensity: 0.22,
      transparent: true,
      opacity: 0.38,
      roughness: 0.12,
      metalness: 0.02,
      depthWrite: false,
    });
    const vineMat = getStandardMaterial({ color: 0x4f8b3e, roughness: 0.78, metalness: 0.02 });

    this.addBox(new THREE.Vector3(-8.62, 1.72, -1.05), new THREE.Vector3(0.16, 3.32, 0.12), trimMat, true, true);
    this.addBox(new THREE.Vector3(-8.62, 1.72, 1.05), new THREE.Vector3(0.16, 3.32, 0.12), trimMat, true, true);
    this.addBox(new THREE.Vector3(-8.62, 3.36, 0), new THREE.Vector3(0.18, 0.12, 2.24), trimMat, true, true);

    const arch = new THREE.Mesh(Geo.torusArc(1.04, 0.052, 12, 30, Math.PI), trimMat);
    arch.position.set(-8.62, 3.34, 0);
    arch.rotation.set(Math.PI / 2, 0, Math.PI);
    arch.castShadow = true;
    this.scene.add(arch);

    for (const z of [-1.35, 1.35]) {
      const pane = new THREE.Mesh(Geo.plane(1.24, 2.6), glassMat);
      pane.position.set(-8.55, 2.58, z);
      pane.rotation.y = Math.PI / 2;
      pane.castShadow = false;
      this.scene.add(pane);
    }

    for (let i = 0; i < 8; i += 1) {
      const vine = new THREE.Mesh(Geo.box(0.026, 0.68 + (i % 3) * 0.18, 0.026), vineMat);
      vine.position.set(-8.45, 2.65 - (i % 4) * 0.22, -1.1 + i * 0.32);
      vine.rotation.set(0.22 + i * 0.03, 0.1, -0.18 + i * 0.05);
      vine.castShadow = true;
      this.scene.add(vine);
    }

    this.addPointLight(-8.35, 2.15, 0, 0xaef5df, 0.82, 4.2);
  }

  private addColumnsAndBeams(): void {
    const stoneMat = getStandardMaterial({ color: 0x806f88, roughness: 0.42, metalness: 0.12 });
    const trimMat = getStandardMaterial({ color: 0xc7a060, roughness: 0.24, metalness: 0.48 });

    for (const [x, z] of [
      [-7.2, -4.85],
      [-3.4, -1.4],
      [3.4, -1.4],
      [7.2, -4.85],
      [-7.2, 3.15],
      [7.2, 3.15],
    ] as Array<[number, number]>) {
      this.addColumn(x, z, stoneMat, trimMat);
    }

    this.addBox(new THREE.Vector3(0, 4.72, -5.0), new THREE.Vector3(16.2, 0.22, 0.32), trimMat, true, true);
    this.addBox(new THREE.Vector3(-7.4, 4.55, 0.0), new THREE.Vector3(0.24, 0.2, 11.6), trimMat, true, true);
    this.addBox(new THREE.Vector3(7.4, 4.55, 0.0), new THREE.Vector3(0.24, 0.2, 11.6), trimMat, true, true);
    this.addBox(new THREE.Vector3(0, 4.95, 0.4), new THREE.Vector3(14.8, 0.16, 0.18), trimMat, true, true);
  }

  private addLibrary(): void {
    for (const x of [3.7, 5.05, 6.4, 7.75]) {
      this.addBookshelf(new THREE.Vector3(x, 0, -6.0), 0);
    }
    for (const z of [-4.55, -3.25, -1.95, -0.65]) {
      this.addBookshelf(new THREE.Vector3(8.35, 0, z), Math.PI / 2);
    }

    this.addLibraryLadder();
    this.addBookStack(3.6, -1.05, 4);
    this.addBookStack(7.2, 0.72, 5);
    this.addBookStack(6.58, -2.05, 3);
    new LibraryEnvironment(this.scene, this.onSceneAssetInstalled).build();
  }

  private addStudyArea(): void {
    const woodMat = getStandardMaterial({
      color: 0x5b3324,
      roughness: 0.42,
      metalness: 0.1,
      map: this.woodTex,
      bumpMap: this.woodDetailTex,
      bumpScale: 0.018,
      roughnessMap: this.woodDetailTex,
    });
    const pageMat = getStandardMaterial({ color: 0xf0dfbd, roughness: 0.65, metalness: 0.02 });
    const purpleMat = getStandardMaterial({ color: 0x623660, roughness: 0.66, metalness: 0.02 });

    this.addBox(new THREE.Vector3(5.2, 0.68, -0.12), new THREE.Vector3(2.5, 0.2, 1.24), woodMat, true, true);
    this.addBox(new THREE.Vector3(5.2, 0.82, -0.12), new THREE.Vector3(2.18, 0.035, 0.36), purpleMat, false, true);
    for (const x of [4.22, 6.18]) {
      for (const z of [-0.62, 0.38]) {
        this.addBox(new THREE.Vector3(x, 0.34, z), new THREE.Vector3(0.15, 0.68, 0.15), woodMat, true, true);
      }
    }

    this.addBox(new THREE.Vector3(4.95, 0.83, -0.16), new THREE.Vector3(0.44, 0.04, 0.36), pageMat, true, true).rotation.y = 0.14;
    this.addBox(new THREE.Vector3(5.36, 0.83, -0.1), new THREE.Vector3(0.44, 0.04, 0.36), pageMat, true, true).rotation.y = -0.16;

    const orb = new THREE.Mesh(
      Geo.sphere(0.18, 24, 16),
      getStandardMaterial({
        color: 0x9fdcff,
        emissive: 0x5f8fff,
        emissiveIntensity: 1.1,
        transparent: true,
        opacity: 0.8,
      })
    );
    orb.position.set(5.92, 1.08, -0.05);
    this.scene.add(orb);
    this.addPointLight(5.92, 1.1, -0.05, 0x8fc7ff, 1.35, 2.6);
    this.animatedObjects.push({ object: orb, baseY: 1.08, amplitude: 0.08, speed: 2.1, phase: 0.2 });
  }

  private addRugsAndFloorDetails(): void {
    const rugMat = getStandardMaterial({
      color: 0x6b2f73,
      roughness: 0.78,
      metalness: 0.02,
        map: this.carpetTex,
    });
    const trimMat = getStandardMaterial({ color: 0xe0bc72, roughness: 0.32, metalness: 0.38 });

    this.addFlatPlane(new THREE.Vector3(4.6, 0.072, 2.3), new THREE.Vector2(3.4, 2.4), rugMat);
    this.addBox(new THREE.Vector3(4.6, 0.092, 1.1), new THREE.Vector3(3.35, 0.025, 0.045), trimMat, false, true);
    this.addBox(new THREE.Vector3(4.6, 0.092, 3.5), new THREE.Vector3(3.35, 0.025, 0.045), trimMat, false, true);
    this.addBox(new THREE.Vector3(2.92, 0.092, 2.3), new THREE.Vector3(0.045, 0.025, 2.35), trimMat, false, true);
    this.addBox(new THREE.Vector3(6.28, 0.092, 2.3), new THREE.Vector3(0.045, 0.025, 2.35), trimMat, false, true);

    for (const [x, z] of [
      [-4.9, 2.1],
      [-1.8, 2.1],
      [1.2, 2.1],
      [4.2, 2.1],
    ] as Array<[number, number]>) {
      const inlay = this.addBox(new THREE.Vector3(x, 0.095, z), new THREE.Vector3(0.42, 0.025, 0.42), trimMat, false, true);
      inlay.rotation.y = Math.PI / 4;
    }
  }

  private addCharacters(): void {
    this.npcs.length = 0;
    this.storyNpcObjects.length = 0;
    const npcEntries = npcsData as NPCData[];
    const lyraData = npcEntries.find((npc) => npc.id === 'lyra');

    this.playerRig = new CharacterModel3D(getCharacterSpec('player'), {
      onAssetInstalled: this.onSceneAssetInstalled,
    });
    this.player = this.playerRig.root;
    this.player.position.set(-5.1, 0, 2.5);
    this.player.rotation.y = Math.PI * 0.78;
    this.scene.add(this.player);

    this.lyraRig = new CharacterModel3D(getCharacterSpec('lyra'), {
      onAssetInstalled: this.onSceneAssetInstalled,
    });
    this.lyra = this.lyraRig.root;
    this.lyra.position.set(lyraData?.worldX ?? 5.35, 0, lyraData?.worldZ ?? -1.35);
    this.lyra.rotation.y = lyraData?.rotationY ?? -Math.PI * 0.18;
    this.lyra.userData.npcId = 'lyra';
    this.scene.add(this.lyra);
    this.registerInteractiveNpc(lyraData ?? {
      id: 'lyra',
      name: '莉娅',
      title: '星辉图书馆管理员',
      x: 970,
      y: 390,
      color: 0x7c4dff,
      radius: 16,
      area: 'library',
      description: '星辉图书馆管理员。',
    }, this.lyra);

    for (const [index, npcData] of npcEntries.entries()) {
      if (npcData.id === 'lyra') continue;
      this.addStoryNpc(npcData, index);
    }
  }

  private addStoryNpc(npcData: NPCData, index: number): void {
    if (hasCharacterSpec(npcData.id)) {
      const rig = new CharacterModel3D(getCharacterSpec(npcData.id), {
        autoLoad: false,
        onAssetInstalled: this.onSceneAssetInstalled,
      });
      const root = rig.root;
      root.name = `story-npc:${npcData.id}`;
      root.position.set(npcData.worldX ?? 0, 0, npcData.worldZ ?? 0);
      root.rotation.y = npcData.rotationY ?? (Math.PI + index * 0.37);
      root.visible = this.isStoryNpcVisible(root);
      this.scene.add(root);
      this.registerInteractiveNpc(npcData, root);
      const shadowsEnabled = this.shouldStoryNpcCastShadow(root);
      this.setStoryNpcShadows(root, shadowsEnabled);
      this.storyNpcObjects.push({
        id: npcData.id,
        object: root,
        rig,
        baseY: root.position.y,
        homeX: root.position.x,
        homeZ: root.position.z,
        phase: index * 0.63,
        idleSpeed: 0.85 + (index % 7) * 0.07,
        rigUpdateAccumulator: 0,
        shadowsEnabled,
        lastModelState: rig.getModelState(),
      });
      return;
    }

    const root = new THREE.Group();
    root.name = `story-npc:${npcData.id}`;
    const primary = this.parseNpcColor(npcData.color);
    const accent = new THREE.Color(primary).offsetHSL(0.08, 0.08, 0.18).getHex();
    const dark = new THREE.Color(primary).offsetHSL(-0.04, -0.08, -0.22).getHex();
    const skin = [0xf1c8a8, 0xe8b892, 0xdba278, 0xf0d2b5][index % 4];
    const robeMat = getStandardMaterial({ color: primary, roughness: 0.58, metalness: 0.04 });
    const trimMat = getStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.12, roughness: 0.34, metalness: 0.18 });
    const darkMat = getStandardMaterial({ color: dark, roughness: 0.62, metalness: 0.04 });
    const skinMat = getStandardMaterial({ color: skin, roughness: 0.5, metalness: 0.02 });

    const robe = new THREE.Mesh(Geo.cylinder(0.23, 0.34, 0.9, 14), robeMat);
    robe.position.y = 0.62;
    robe.castShadow = true;
    robe.receiveShadow = true;
    root.add(robe);

    const sash = new THREE.Mesh(Geo.box(0.48, 0.055, 0.08), trimMat);
    sash.position.set(0, 0.82, 0.235);
    sash.rotation.z = (index % 2 === 0 ? 1 : -1) * 0.18;
    sash.castShadow = true;
    root.add(sash);

    const head = new THREE.Mesh(Geo.sphere(0.205, 18, 14), skinMat);
    head.position.y = 1.22;
    head.castShadow = true;
    root.add(head);

    const hair = new THREE.Mesh(Geo.sphere(0.215, 18, 10), darkMat);
    hair.position.set(0, 1.31, -0.025);
    hair.scale.set(1.04, 0.62, 1.0);
    hair.castShadow = true;
    root.add(hair);

    const hat = new THREE.Mesh(Geo.cone(0.19, 0.32, 16), trimMat);
    hat.position.set(0.03, 1.54, 0);
    hat.rotation.z = (index % 3 - 1) * 0.08;
    hat.castShadow = true;
    root.add(hat);

    const leftArm = new THREE.Mesh(Geo.cylinder(0.035, 0.045, 0.52, 8), robeMat);
    leftArm.position.set(-0.31, 0.77, 0.02);
    leftArm.rotation.z = 0.42;
    leftArm.castShadow = true;
    root.add(leftArm);

    const rightArm = new THREE.Mesh(Geo.cylinder(0.035, 0.045, 0.52, 8), robeMat);
    rightArm.position.set(0.31, 0.77, 0.02);
    rightArm.rotation.z = -0.42;
    rightArm.castShadow = true;
    root.add(rightArm);

    const focus = new THREE.Mesh(Geo.octahedron(0.085, 0), trimMat);
    focus.position.set(index % 2 === 0 ? 0.42 : -0.42, 1.04, 0.1);
    focus.castShadow = true;
    root.add(focus);

    const marker = new THREE.Mesh(Geo.torus(0.43, 0.012, 8, 32), trimMat);
    marker.position.y = 0.045;
    marker.rotation.x = Math.PI / 2;
    root.add(marker);

    root.position.set(npcData.worldX ?? 0, 0, npcData.worldZ ?? 0);
    root.rotation.y = npcData.rotationY ?? (Math.PI + index * 0.37);
    root.scale.setScalar(0.95 + (index % 5) * 0.035);
    root.visible = this.isStoryNpcVisible(root);
    this.scene.add(root);
    this.registerInteractiveNpc(npcData, root);
    const shadowsEnabled = this.shouldStoryNpcCastShadow(root);
    this.setStoryNpcShadows(root, shadowsEnabled);
    this.storyNpcObjects.push({
      id: npcData.id,
      object: root,
      baseY: root.position.y,
      homeX: root.position.x,
      homeZ: root.position.z,
      phase: index * 0.63,
      idleSpeed: 0.85 + (index % 7) * 0.07,
      rigUpdateAccumulator: 0,
      shadowsEnabled,
      lastModelState: null,
    });
  }

  private registerInteractiveNpc(npcData: NPCData, object: THREE.Object3D): void {
    object.userData.npcId = npcData.id;
    object.userData.npcName = npcData.name;
    object.traverse((child) => {
      child.userData.npcId = npcData.id;
      child.userData.npcName = npcData.name;
    });
    this.npcs.push({
      id: npcData.id,
      name: npcData.name,
      title: npcData.title,
      area: npcData.area,
      object,
    });
  }

  private updateStoryNpcs(elapsedTime: number, delta: number, playerMoving: boolean): void {
    for (const npc of this.storyNpcObjects) {
      const dx = this.player.position.x - npc.object.position.x;
      const dz = this.player.position.z - npc.object.position.z;
      const distanceSq = dx * dx + dz * dz;
      const visible = distanceSq <= STORY_NPC_VISIBLE_DISTANCE_SQ;
      if (npc.object.visible !== visible) npc.object.visible = visible;
      this.updateStoryNpcShadowState(npc, distanceSq);

      if (this.shouldStartStoryNpcAssetLoad(npc, distanceSq, elapsedTime, playerMoving)) {
        this.lastStoryNpcAssetLoadStartTime = elapsedTime;
        void npc.rig.startAssetLoad();
      }

      if (!visible || distanceSq > STORY_NPC_ACTIVE_DISTANCE_SQ) {
        npc.rig?.setMoving(false);
        npc.rigUpdateAccumulator = 0;
        continue;
      }

      const showcaseMoving = this.updateMatureSenpaiShowcaseWalk(npc, elapsedTime, delta, distanceSq);
      this.updateStoryNpcRig(npc, elapsedTime, delta, showcaseMoving, playerMoving, distanceSq);
      npc.object.position.y = npc.baseY + Math.sin(elapsedTime * npc.idleSpeed + npc.phase) * 0.025;
      if (distanceSq > STORY_NPC_LOOK_AT_DISTANCE_SQ) continue;
      const targetYaw = Math.atan2(dx, dz);
      const wrapped = THREE.MathUtils.euclideanModulo(targetYaw - npc.object.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      npc.object.rotation.y += wrapped * (1 - Math.exp(-7 * delta));
    }
  }

  private updateStoryNpcRig(
    npc: StoryNpcObject,
    elapsedTime: number,
    delta: number,
    moving: boolean,
    playerMoving: boolean,
    distanceSq: number
  ): void {
    if (!npc.rig) return;

    npc.rig.setMoving(moving);
    const fullRate = distanceSq <= STORY_NPC_FULL_RATE_DISTANCE_SQ || distanceSq <= STORY_NPC_LOOK_AT_DISTANCE_SQ;
    if (fullRate) {
      npc.rigUpdateAccumulator = 0;
      npc.rig.update(elapsedTime, delta, this.player.position);
      return;
    }

    npc.rigUpdateAccumulator += delta;
    const updateInterval = playerMoving
      ? STORY_NPC_FAR_UPDATE_INTERVAL_MOVING
      : STORY_NPC_FAR_UPDATE_INTERVAL_IDLE;
    if (npc.rigUpdateAccumulator < updateInterval) return;

    const rigDelta = Math.min(npc.rigUpdateAccumulator, 0.12);
    npc.rigUpdateAccumulator = 0;
    npc.rig.update(elapsedTime, rigDelta, this.player.position);
  }

  private shouldLoadStoryNpcAsset(id: string, distanceSq: number, elapsedTime: number, playerMoving: boolean): boolean {
    if (playerMoving) return false;
    if (distanceSq <= STORY_NPC_IMMEDIATE_ASSET_DISTANCE_SQ) return true;

    if (id === 'mature_senpai') {
      return elapsedTime >= STORY_NPC_HEAVY_IDLE_PRELOAD_DELAY_SECONDS
        && distanceSq <= STORY_NPC_HEAVY_IDLE_ASSET_DISTANCE_SQ;
    }

    return elapsedTime >= STORY_NPC_IDLE_PRELOAD_DELAY_SECONDS
      && distanceSq <= STORY_NPC_IDLE_ASSET_DISTANCE_SQ;
  }

  private shouldStartStoryNpcAssetLoad(
    npc: StoryNpcObject,
    distanceSq: number,
    elapsedTime: number,
    playerMoving: boolean
  ): npc is StoryNpcObject & { rig: CharacterModel3D } {
    if (!npc.rig || npc.rig.getModelState() !== 'fallback') return false;
    if (elapsedTime - this.lastStoryNpcAssetLoadStartTime < STORY_NPC_ASSET_LOAD_START_INTERVAL_SECONDS) return false;
    return this.shouldLoadStoryNpcAsset(npc.id, distanceSq, elapsedTime, playerMoving);
  }

  private isStoryNpcVisible(npc: THREE.Object3D): boolean {
    const dx = this.player.position.x - npc.position.x;
    const dz = this.player.position.z - npc.position.z;
    return dx * dx + dz * dz <= STORY_NPC_VISIBLE_DISTANCE_SQ;
  }

  private shouldStoryNpcCastShadow(npc: THREE.Object3D): boolean {
    const dx = this.player.position.x - npc.position.x;
    const dz = this.player.position.z - npc.position.z;
    return dx * dx + dz * dz <= STORY_NPC_SHADOW_DISTANCE_SQ;
  }

  private updateStoryNpcShadowState(npc: StoryNpcObject, distanceSq: number): void {
    const nextModelState = npc.rig?.getModelState() ?? null;
    const shouldCastShadow = distanceSq <= STORY_NPC_SHADOW_DISTANCE_SQ;
    if (npc.shadowsEnabled === shouldCastShadow && npc.lastModelState === nextModelState) return;

    npc.shadowsEnabled = shouldCastShadow;
    npc.lastModelState = nextModelState;
    this.setStoryNpcShadows(npc.object, shouldCastShadow);
  }

  private setStoryNpcShadows(root: THREE.Object3D, enabled: boolean): void {
    this.setObjectShadows(root, enabled);
  }

  private setObjectShadows(root: THREE.Object3D, enabled: boolean): void {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object.userData[DISTANCE_SHADOW_DEFAULT] === undefined) {
        object.userData[DISTANCE_SHADOW_DEFAULT] = object.castShadow;
      }
      object.castShadow = enabled && object.userData[DISTANCE_SHADOW_DEFAULT] === true;
    });
  }

  private updateMatureSenpaiShowcaseWalk(
    npc: StoryNpcObject,
    elapsedTime: number,
    delta: number,
    playerDistanceSq: number
  ): boolean {
    if (npc.id !== 'mature_senpai') return false;
    if (playerDistanceSq < STORY_NPC_LOOK_AT_DISTANCE_SQ) return false;

    const phase = elapsedTime * 0.36 + npc.phase;
    const targetX = npc.homeX + Math.sin(phase * 0.72) * 0.18;
    const targetZ = npc.homeZ + Math.sin(phase) * 0.42;
    const prevX = npc.object.position.x;
    const prevZ = npc.object.position.z;
    const smoothing = 1 - Math.exp(-delta * 2.4);
    npc.object.position.x += (targetX - npc.object.position.x) * smoothing;
    npc.object.position.z += (targetZ - npc.object.position.z) * smoothing;

    const moveX = npc.object.position.x - prevX;
    const moveZ = npc.object.position.z - prevZ;
    const moving = moveX * moveX + moveZ * moveZ > 0.000002;
    if (moving) {
      const targetYaw = Math.atan2(moveX, moveZ);
      const wrapped = THREE.MathUtils.euclideanModulo(targetYaw - npc.object.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      npc.object.rotation.y += wrapped * (1 - Math.exp(-6 * delta));
    }
    return moving;
  }

  private parseNpcColor(color: number | string): number {
    if (typeof color === 'number') return color;
    if (color.startsWith('0x')) return Number.parseInt(color.slice(2), 16);
    if (color.startsWith('#')) return Number.parseInt(color.slice(1), 16);
    const parsed = Number.parseInt(color, 10);
    return Number.isFinite(parsed) ? parsed : 0x7c4dff;
  }

  private addBookshelf(position: THREE.Vector3, rotationY: number): void {
    const shelf = new THREE.Group();
    const width = 1.18;
    const height = 2.95;
    const depth = 0.58;
    const woodMat = getStandardMaterial({
      color: 0x5a3629,
      roughness: 0.45,
      metalness: 0.08,
      map: this.woodTex,
      bumpMap: this.woodDetailTex,
      bumpScale: 0.018,
      roughnessMap: this.woodDetailTex,
    });
    const darkMat = getStandardMaterial({ color: 0x2b1c1c, roughness: 0.58, metalness: 0.05 });
    const goldMat = getStandardMaterial({ color: 0xd0ac68, roughness: 0.25, metalness: 0.5 });

    this.addBoxToGroup(shelf, new THREE.Vector3(0, height / 2, -depth / 2), new THREE.Vector3(width, height, 0.08), darkMat);
    this.addBoxToGroup(shelf, new THREE.Vector3(-width / 2 - 0.07, height / 2, 0), new THREE.Vector3(0.14, height, depth), woodMat);
    this.addBoxToGroup(shelf, new THREE.Vector3(width / 2 + 0.07, height / 2, 0), new THREE.Vector3(0.14, height, depth), woodMat);
    this.addBoxToGroup(shelf, new THREE.Vector3(0, 0.08, 0), new THREE.Vector3(width + 0.32, 0.16, depth + 0.08), woodMat);
    this.addBoxToGroup(shelf, new THREE.Vector3(0, height + 0.04, 0), new THREE.Vector3(width + 0.32, 0.16, depth + 0.08), woodMat);

    const shelfLevels = [0.34, 0.85, 1.36, 1.87, 2.38];
    for (const level of shelfLevels) {
      this.addBoxToGroup(shelf, new THREE.Vector3(0, level, 0), new THREE.Vector3(width + 0.2, 0.07, depth + 0.06), woodMat);
      this.addBoxToGroup(shelf, new THREE.Vector3(0, level + 0.06, depth / 2 + 0.03), new THREE.Vector3(width + 0.22, 0.03, 0.045), goldMat);
    }

    const colors = [0x7356d9, 0xf1c45f, 0x57b9d8, 0xd85f9e, 0x88bd64, 0xb24d43, 0xded4ba];
    const bookMatricesByColor = new Map<number, THREE.Matrix4[]>();
    const stripeMatrices: THREE.Matrix4[] = [];
    const bookDummy = new THREE.Object3D();
    const stripeDummy = new THREE.Object3D();
    const composedStripeMatrix = new THREE.Matrix4();

    for (let row = 0; row < shelfLevels.length; row += 1) {
      let cursor = -width / 2 + 0.08;
      for (let i = 0; i < 11; i += 1) {
        const bookWidth = 0.065 + ((row + i * 2) % 5) * 0.012;
        const bookHeight = 0.29 + ((row + i) % 4) * 0.045;
        const bookDepth = 0.13 + ((row * 2 + i) % 3) * 0.024;
        const color = colors[(row * 3 + i) % colors.length];
        bookDummy.position.set(cursor + bookWidth / 2, shelfLevels[row] + 0.06 + bookHeight / 2, depth / 2 - 0.04);
        bookDummy.rotation.set(0, 0, (((row + i) % 5) - 2) * 0.018);
        bookDummy.scale.set(bookWidth, bookHeight, bookDepth);
        bookDummy.updateMatrix();

        const bookMatrices = bookMatricesByColor.get(color);
        if (bookMatrices) bookMatrices.push(bookDummy.matrix.clone());
        else bookMatricesByColor.set(color, [bookDummy.matrix.clone()]);

        if ((row + i) % 3 === 0) {
          for (const y of [-bookHeight * 0.2, bookHeight * 0.18]) {
            stripeDummy.position.set(0, y, bookDepth / 2 + 0.007);
            stripeDummy.rotation.set(0, 0, 0);
            stripeDummy.scale.set(bookWidth * 0.9, 0.018, 0.012);
            stripeDummy.updateMatrix();
            composedStripeMatrix.multiplyMatrices(bookDummy.matrix, stripeDummy.matrix);
            stripeMatrices.push(composedStripeMatrix.clone());
          }
        }
        cursor += bookWidth + 0.03;
      }
    }

    for (const [color, matrices] of bookMatricesByColor) {
      this.addInstancedBoxesToGroup(shelf, matrices, getStandardMaterial({ color, roughness: 0.5 }));
    }
    this.addInstancedBoxesToGroup(shelf, stripeMatrices, goldMat);

    this.addBookshelfDetails(shelf, shelfLevels, width, depth, goldMat);

    shelf.position.copy(position);
    shelf.rotation.y = rotationY;
    this.scene.add(shelf);
  }

  private addBookshelfDetails(
    shelf: THREE.Group,
    shelfLevels: number[],
    width: number,
    depth: number,
    goldMat: THREE.Material
  ): void {
    const labelMat = getStandardMaterial({ color: 0xe7c87a, roughness: 0.28, metalness: 0.45 });
    const parchmentMat = getStandardMaterial({ color: 0xd9c08e, roughness: 0.68, metalness: 0.02 });
    const glassMats = [
      getStandardMaterial({ color: 0x75c6d8, roughness: 0.12, metalness: 0.02, transparent: true, opacity: 0.72 }),
      getStandardMaterial({ color: 0xa978d4, roughness: 0.12, metalness: 0.02, transparent: true, opacity: 0.72 }),
      getStandardMaterial({ color: 0x8ecf84, roughness: 0.12, metalness: 0.02, transparent: true, opacity: 0.72 }),
    ];

    for (const level of [shelfLevels[1], shelfLevels[3]]) {
      this.addBoxToGroup(shelf, new THREE.Vector3(-width / 2 - 0.01, level + 0.25, depth / 2 + 0.055), new THREE.Vector3(0.05, 0.22, 0.018), labelMat);
      this.addBoxToGroup(shelf, new THREE.Vector3(width / 2 + 0.01, level + 0.25, depth / 2 + 0.055), new THREE.Vector3(0.05, 0.22, 0.018), labelMat);
    }

    const scrollGeo = Geo.cylinder(0.035, 0.035, 0.42, 12);
    for (let i = 0; i < 3; i += 1) {
      const scroll = new THREE.Mesh(scrollGeo, parchmentMat);
      scroll.position.set(-0.38 + i * 0.18, shelfLevels[2] + 0.14, depth / 2 - 0.02);
      scroll.rotation.z = Math.PI / 2;
      scroll.castShadow = true;
      scroll.receiveShadow = true;
      shelf.add(scroll);
    }

    const bottleGeo = Geo.cylinder(0.045, 0.055, 0.18, 12);
    const stopperGeo = Geo.box(0.04, 0.045, 0.04);
    for (let i = 0; i < 3; i += 1) {
      const bottle = new THREE.Mesh(bottleGeo, glassMats[i]);
      bottle.position.set(0.28 + i * 0.16, shelfLevels[0] + 0.18, depth / 2 - 0.03);
      bottle.castShadow = true;
      shelf.add(bottle);

      const stopper = new THREE.Mesh(stopperGeo, goldMat);
      stopper.position.set(bottle.position.x, bottle.position.y + 0.11, bottle.position.z);
      stopper.castShadow = true;
      shelf.add(stopper);
    }

    const charm = new THREE.Mesh(
      Geo.octahedron(0.07, 0),
      getStandardMaterial({ color: 0x8fc7ff, emissive: 0x4f8cff, emissiveIntensity: 0.65, roughness: 0.2 })
    );
    charm.position.set(0, shelfLevels[4] + 0.28, depth / 2 + 0.03);
    charm.castShadow = true;
    shelf.add(charm);
  }

  private addLibraryLadder(): void {
    const ladder = new THREE.Group();
    const woodMat = getStandardMaterial({ color: 0x6d432b, roughness: 0.44, metalness: 0.08, map: this.woodTex });
    for (const x of [-0.28, 0.28]) {
      const rail = this.addBoxToGroup(ladder, new THREE.Vector3(x, 0.95, 0), new THREE.Vector3(0.055, 1.85, 0.06), woodMat);
      rail.rotation.z = x < 0 ? 0.17 : 0.05;
    }
    for (let i = 0; i < 6; i += 1) {
      this.addBoxToGroup(ladder, new THREE.Vector3(0, 0.28 + i * 0.27, 0.03), new THREE.Vector3(0.62, 0.045, 0.055), woodMat);
    }
    ladder.position.set(7.65, 0.04, -4.45);
    ladder.rotation.y = 0.18;
    this.scene.add(ladder);
  }

  private addBookStack(x: number, z: number, count: number): void {
    const colors = [0x7d4fd6, 0xd16d85, 0xf0c56c, 0x4c9fb8, 0x6f9e59];
    for (let i = 0; i < count; i += 1) {
      const book = this.addBox(
        new THREE.Vector3(x + i * 0.012, 0.09 + i * 0.074, z),
        new THREE.Vector3(0.42 - i * 0.018, 0.07, 0.3 - i * 0.012),
        getStandardMaterial({ color: colors[(i + count) % colors.length], roughness: 0.52, metalness: 0.04 }),
        true,
        true
      );
      book.rotation.y = ((i % 3) - 1) * 0.12;
    }
  }

  private addColumn(x: number, z: number, stoneMat: THREE.Material, trimMat: THREE.Material): void {
    const baseGeo = Geo.cylinder(0.42, 0.5, 0.2, 28);
    const base = new THREE.Mesh(baseGeo, stoneMat);
    base.position.set(x, 0.1, z);
    base.castShadow = true;
    base.receiveShadow = true;
    this.scene.add(base);

    const pillarGeo = Geo.cylinder(0.22, 0.25, 2.35, 28);
    const pillar = new THREE.Mesh(pillarGeo, stoneMat);
    pillar.position.set(x, 1.28, z);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    this.scene.add(pillar);

    const ringGeo = Geo.cylinder(0.32, 0.34, 0.09, 28);
    for (const y of [0.36, 2.2]) {
      const ring = new THREE.Mesh(ringGeo, trimMat);
      ring.position.set(x, y, z);
      ring.castShadow = true;
      ring.receiveShadow = true;
      this.scene.add(ring);
    }

    const grooveMat = getStandardMaterial({ color: 0x554a5f, roughness: 0.64, metalness: 0.03 });
    const grooveGeo = Geo.box(0.022, 1.62, 0.028);
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const groove = new THREE.Mesh(grooveGeo, grooveMat);
      groove.position.set(x + Math.cos(angle) * 0.242, 1.28, z + Math.sin(angle) * 0.242);
      groove.rotation.y = -angle;
      groove.castShadow = true;
      groove.receiveShadow = true;
      this.scene.add(groove);
    }

    const nickGeo = Geo.box(0.14, 0.018, 0.022);
    for (const [dy, angle] of [[0.88, 0.35], [1.58, 2.25]] as Array<[number, number]>) {
      const nick = new THREE.Mesh(nickGeo, grooveMat);
      nick.position.set(x + Math.cos(angle) * 0.262, dy, z + Math.sin(angle) * 0.262);
      nick.rotation.set(0, -angle, 0.38);
      nick.castShadow = true;
      this.scene.add(nick);
    }

    const lamp = new THREE.Mesh(
      Geo.octahedron(0.16, 1),
      getStandardMaterial({ color: 0xffd674, emissive: 0xffb847, emissiveIntensity: 1.65 })
    );
    lamp.position.set(x, 2.58, z);
    this.scene.add(lamp);
    this.addPointLight(x, 2.55, z, 0xffc96d, 1.08, 3.0);
  }

  private addFramedPanel(
    center: THREE.Vector3,
    width: number,
    height: number,
    side: 'back' | 'left' | 'right',
    panelMat: THREE.Material,
    insetMat: THREE.Material,
    trimMat: THREE.Material
  ): void {
    if (side === 'back') {
      this.addBox(center, new THREE.Vector3(width, height, 0.06), panelMat, true, true);
      this.addBox(center.clone().add(new THREE.Vector3(0, 0, 0.04)), new THREE.Vector3(width - 0.18, height - 0.22, 0.06), insetMat, false, true);
      this.addBox(center.clone().add(new THREE.Vector3(0, height / 2, 0.07)), new THREE.Vector3(width + 0.16, 0.045, 0.08), trimMat, true, true);
      this.addBox(center.clone().add(new THREE.Vector3(0, -height / 2, 0.07)), new THREE.Vector3(width + 0.16, 0.045, 0.08), trimMat, true, true);
      this.addBox(center.clone().add(new THREE.Vector3(-width / 2, 0, 0.07)), new THREE.Vector3(0.045, height + 0.16, 0.08), trimMat, true, true);
      this.addBox(center.clone().add(new THREE.Vector3(width / 2, 0, 0.07)), new THREE.Vector3(0.045, height + 0.16, 0.08), trimMat, true, true);
      return;
    }

    const xOffset = side === 'left' ? 0.05 : -0.05;
    this.addBox(center, new THREE.Vector3(0.06, height, width), panelMat, true, true);
    this.addBox(center.clone().add(new THREE.Vector3(xOffset, 0, 0)), new THREE.Vector3(0.06, height - 0.22, width - 0.18), insetMat, false, true);
    this.addBox(center.clone().add(new THREE.Vector3(xOffset, height / 2, 0)), new THREE.Vector3(0.08, 0.045, width + 0.16), trimMat, true, true);
    this.addBox(center.clone().add(new THREE.Vector3(xOffset, -height / 2, 0)), new THREE.Vector3(0.08, 0.045, width + 0.16), trimMat, true, true);
    this.addBox(center.clone().add(new THREE.Vector3(xOffset, 0, -width / 2)), new THREE.Vector3(0.08, height + 0.16, 0.045), trimMat, true, true);
    this.addBox(center.clone().add(new THREE.Vector3(xOffset, 0, width / 2)), new THREE.Vector3(0.08, height + 0.16, 0.045), trimMat, true, true);
  }

  private addWindowLightPatch(x: number, z: number): void {
    const lightPlane = new THREE.Mesh(
      Geo.plane(2.5, 5.4),
      new THREE.MeshBasicMaterial({ color: 0xf1f7ff, transparent: true, opacity: 0.13, depthWrite: false })
    );
    lightPlane.position.set(x, 0.085, z);
    lightPlane.rotation.x = -Math.PI / 2;
    lightPlane.rotation.z = -0.38;
    this.scene.add(lightPlane);
  }

  private addBox(position: THREE.Vector3, scale: THREE.Vector3, material: THREE.Material, castShadow: boolean, receiveShadow: boolean): THREE.Mesh {
    const mesh = new THREE.Mesh(UNIT_BOX, material);
    mesh.position.copy(position);
    mesh.scale.set(scale.x, scale.y, scale.z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    this.scene.add(mesh);
    return mesh;
  }

  private addBoxToGroup(parent: THREE.Object3D, position: THREE.Vector3, scale: THREE.Vector3, material: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(UNIT_BOX, material);
    mesh.position.copy(position);
    mesh.scale.set(scale.x, scale.y, scale.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private addInstancedBoxesToGroup(parent: THREE.Object3D, matrices: THREE.Matrix4[], material: THREE.Material): void {
    if (matrices.length === 0) return;
    const mesh = new THREE.InstancedMesh(UNIT_BOX, material, matrices.length);
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    parent.add(mesh);
  }

  private addFlatPlane(position: THREE.Vector3, size: THREE.Vector2, material: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(Geo.plane(size.x, size.y), material);
    mesh.position.copy(position);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  private addPointLight(x: number, y: number, z: number, color: number, intensity: number, distance: number): void {
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(x, y, z);
    this.scene.add(light);
  }
}
