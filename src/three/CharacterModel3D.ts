import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { VRM } from '@pixiv/three-vrm';
import {
  createCharacterBuildPlan,
  loadCharacterAssetManifest,
  ProceduralCharacterRig,
  type CharacterAssetEntry,
  type CharacterAssetState,
  type CharacterBuildPlan,
  type CharacterSpec,
} from '../characters';
import { CharacterAnimationStateMachine } from './CharacterAnimationStateMachine';
import { Geo } from './RenderResources';

interface BoneSet {
  hips?: THREE.Object3D;
  spine?: THREE.Object3D;
  chest?: THREE.Object3D;
  head?: THREE.Object3D;
  leftUpperArm?: THREE.Object3D;
  leftLowerArm?: THREE.Object3D;
  rightUpperArm?: THREE.Object3D;
  rightLowerArm?: THREE.Object3D;
  leftUpperLeg?: THREE.Object3D;
  leftLowerLeg?: THREE.Object3D;
  leftFoot?: THREE.Object3D;
  rightUpperLeg?: THREE.Object3D;
  rightLowerLeg?: THREE.Object3D;
  rightFoot?: THREE.Object3D;
}

interface GLTFMorphBinding {
  mesh: THREE.Mesh | THREE.SkinnedMesh;
  influences: number[];
  targets: GLTFMorphTarget[];
}

type GLTFMorphTargetKind = 'blink' | 'teasing' | 'thoughtful' | 'smile' | 'zero';

interface GLTFMorphTarget {
  index: number;
  kind: GLTFMorphTargetKind;
}

interface GLTFBoneBasePose {
  position: THREE.Vector3;
  rotation: THREE.Euler;
}

interface GLTFTransformBase {
  object: THREE.Object3D;
  basePosition: THREE.Vector3;
  baseRotation: THREE.Euler;
}

interface GLTFSecondaryMotionBinding extends GLTFTransformBase {
  phase: number;
  sway: number;
  bob: number;
  twist: number;
  stiffness: number;
  damping: number;
  currentX: number;
  currentY: number;
  currentZ: number;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
}

type GLTFSecondaryMotionProfile = Pick<GLTFSecondaryMotionBinding, 'sway' | 'bob' | 'twist' | 'stiffness' | 'damping'>;

interface GLTFEyeFocusBinding {
  object: THREE.Object3D;
  basePosition: THREE.Vector3;
}

interface AssetLoadQueueEntry {
  priority: number;
  sequence: number;
  task: () => Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

interface CharacterModel3DOptions {
  readonly autoLoad?: boolean;
  readonly onAssetInstalled?: () => void;
}

type ThreeVRMModule = typeof import('@pixiv/three-vrm');

export class CharacterModel3D {
  private static readonly maxConcurrentAssetLoads = 1;
  private static readonly deferredAssetLoadPriority = 2;
  private static readonly idleAssetLoadTimeoutMs = 1600;
  private static readonly pendingAssetLoads: AssetLoadQueueEntry[] = [];
  private static readonly assetUrlAvailability = new Map<string, Promise<boolean>>();
  private static activeAssetLoads = 0;
  private static assetLoadSequence = 0;
  private static toonGradient?: THREE.DataTexture;
  private static shadowProxyMaterial?: THREE.MeshBasicMaterial;

  readonly root = new THREE.Group();
  private readonly fallback: ProceduralCharacterRig;
  private readonly lookTarget = new THREE.Object3D();
  private readonly animationState = new CharacterAnimationStateMachine();
  private vrmModule?: ThreeVRMModule;
  private vrm?: VRM;
  private bones: BoneSet = {};
  private gltfMixer?: THREE.AnimationMixer;
  private readonly gltfActions = new Map<string, THREE.AnimationAction>();
  private gltfMorphBindings: GLTFMorphBinding[] = [];
  private gltfSecondaryBindings: GLTFSecondaryMotionBinding[] = [];
  private gltfEyeFocusBindings: GLTFEyeFocusBinding[] = [];
  private readonly gltfBoneBasePoses = new Map<THREE.Object3D, GLTFBoneBasePose>();
  private activeGLTFAction?: THREE.AnimationAction;
  private activeGLTFActionRequest = '';
  private buildPlan: CharacterBuildPlan;
  private moving = false;
  private blinkTimer = 0;
  private blinkDuration = 0;
  private gltfLookYaw = 0;
  private gltfLookPitch = 0;
  private assetState: CharacterAssetState = 'loading';
  private assetLoadPromise?: Promise<void>;
  private readonly gltfHeadWorld = new THREE.Vector3();
  private readonly gltfLookTargetLocal = new THREE.Vector3();
  private readonly gltfLookHeadLocal = new THREE.Vector3();
  private readonly runtimePivotCenter = new THREE.Vector3();

  constructor(
    private readonly spec: CharacterSpec,
    private readonly options: CharacterModel3DOptions = {},
  ) {
    this.buildPlan = createCharacterBuildPlan(spec);
    this.root.userData.characterId = spec.id;
    this.root.userData.characterDisplayName = spec.displayName;
    this.root.userData.characterBuildPlan = this.buildPlan;
    this.root.userData.characterAssetState = this.assetState;
    this.fallback = new ProceduralCharacterRig(spec.id);
    this.root.add(this.fallback.root);
    if (options.autoLoad === false) {
      this.setAssetState('fallback');
    } else {
      void this.startAssetLoad();
    }
  }

  startAssetLoad(): Promise<void> {
    if (this.assetLoadPromise) return this.assetLoadPromise;
    this.setAssetState('loading');
    this.assetLoadPromise = CharacterModel3D.enqueueAssetLoad(
      () => this.loadModel(),
      this.getAssetLoadPriority(),
    ).catch((error) => {
      this.setAssetState('failed');
      this.fallback.root.visible = true;
      console.warn(`Failed to schedule ${this.spec.id} character asset`, error);
    });
    return this.assetLoadPromise;
  }

  setMoving(moving: boolean): void {
    if (this.moving === moving) return;
    this.moving = moving;
    this.animationState.setMoving(moving);
    this.fallback.setMoving(moving);
  }

  getModelState(): CharacterAssetState {
    return this.assetState;
  }

  update(elapsedTime: number, delta: number, lookAtWorldPosition?: THREE.Vector3): void {
    if (this.vrm) {
      const poseWeights = this.animationState.update(delta);
      this.updateLookTarget(lookAtWorldPosition, elapsedTime);
      this.applyHumanoidPose(elapsedTime, poseWeights.walk, poseWeights.talk);
      this.applyExpressions(elapsedTime, delta);
      this.vrm.update(delta);
      return;
    }

    if (this.gltfMixer) {
      this.updateGLTFAnimation(elapsedTime, delta, lookAtWorldPosition);
      return;
    }

    this.fallback.update(elapsedTime);
  }

  private async loadModel(): Promise<void> {
    const buildPlan = await this.resolveBuildPlan();
    const asset = buildPlan.asset;
    if (!asset) {
      this.setAssetState('fallback');
      return;
    }

    const url = await this.findModelUrl(asset);
    if (!url) {
      this.setAssetState('fallback');
      return;
    }

    try {
      const vrmModule = asset.format === 'vrm' ? await this.loadVRMModule() : undefined;
      const loader = vrmModule ? CharacterModel3D.createVRMLoader(vrmModule) : new GLTFLoader();
      const gltf = await loader.loadAsync(url);
      const vrm = gltf.userData.vrm as VRM | undefined;
      if (vrm && vrmModule) {
        this.installVRM(vrm, vrmModule);
      } else {
        this.installGLTF(gltf.scene, gltf.animations);
      }
    } catch (error) {
      this.setAssetState('failed');
      this.fallback.root.visible = true;
      console.warn(`Failed to load ${this.spec.id} character asset`, error);
    }
  }

  private async resolveBuildPlan(): Promise<CharacterBuildPlan> {
    const manifest = await loadCharacterAssetManifest();
    this.buildPlan = createCharacterBuildPlan(this.spec, { manifest });
    this.root.userData.characterBuildPlan = this.buildPlan;
    return this.buildPlan;
  }

  private async loadVRMModule(): Promise<ThreeVRMModule> {
    if (!this.vrmModule) this.vrmModule = await import('@pixiv/three-vrm');
    return this.vrmModule;
  }

  private async findModelUrl(asset: CharacterAssetEntry): Promise<string | undefined> {
    const url = asset.url.startsWith('/') ? asset.url : `/assets/models/${asset.url}`;
    if (!/\.(vrm|glb|gltf)$/i.test(url)) {
      console.warn(`Ignoring unsupported ${this.spec.id} character asset: ${url}`);
      return undefined;
    }

    const available = await CharacterModel3D.isModelUrlAvailable(url);
    return available ? url : undefined;
  }

  private getAssetLoadPriority(): number {
    if (this.spec.id === 'player') return 0;
    if (this.spec.id === 'lyra') return 1;
    if (this.spec.runtime.role === 'hero') return 2;
    if (this.spec.runtime.role === 'supporting') return 6;
    return 8;
  }

  private static enqueueAssetLoad(task: () => Promise<void>, priority: number): Promise<void> {
    return new Promise((resolve, reject) => {
      CharacterModel3D.pendingAssetLoads.push({
        priority,
        sequence: CharacterModel3D.assetLoadSequence += 1,
        task,
        resolve,
        reject,
      });
      CharacterModel3D.pendingAssetLoads.sort((a, b) => a.priority - b.priority || a.sequence - b.sequence);
      CharacterModel3D.drainAssetLoadQueue();
    });
  }

  private static drainAssetLoadQueue(): void {
    while (
      CharacterModel3D.activeAssetLoads < CharacterModel3D.maxConcurrentAssetLoads
      && CharacterModel3D.pendingAssetLoads.length > 0
    ) {
      const entry = CharacterModel3D.pendingAssetLoads.shift();
      if (!entry) return;

      CharacterModel3D.activeAssetLoads += 1;
      void CharacterModel3D.runQueuedAssetLoad(entry)
        .then(entry.resolve, entry.reject)
        .finally(() => {
          CharacterModel3D.activeAssetLoads -= 1;
          CharacterModel3D.drainAssetLoadQueue();
        });
    }
  }

  private static async runQueuedAssetLoad(entry: AssetLoadQueueEntry): Promise<void> {
    if (entry.priority >= CharacterModel3D.deferredAssetLoadPriority) {
      await CharacterModel3D.waitForIdleAssetLoadWindow();
    }
    await entry.task();
  }

  private static waitForIdleAssetLoadWindow(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(() => resolve(), {
          timeout: CharacterModel3D.idleAssetLoadTimeoutMs,
        });
        return;
      }
      globalThis.setTimeout(resolve, 80);
    });
  }

  private static async isModelUrlAvailable(url: string): Promise<boolean> {
    const cached = CharacterModel3D.assetUrlAvailability.get(url);
    if (cached) return cached;

    const request = CharacterModel3D.checkModelUrlAvailability(url);
    CharacterModel3D.assetUrlAvailability.set(url, request);
    return request;
  }

  private static async checkModelUrlAvailability(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentType = response.headers.get('content-type') ?? '';
      return response.ok && !contentType.includes('text/html');
    } catch {
      // Missing optional assets should silently fall back to the authored rig.
    }
    return false;
  }

  private installVRM(vrm: VRM, vrmModule: ThreeVRMModule): void {
    this.vrm = vrm;
    this.gltfMorphBindings = [];
    this.gltfSecondaryBindings = [];
    this.gltfEyeFocusBindings = [];
    this.gltfBoneBasePoses.clear();
    this.setAssetState('vrm');
    vrmModule.VRMUtils.rotateVRM0(vrm);
    vrmModule.VRMUtils.combineSkeletons(vrm.scene);
    vrmModule.VRMUtils.combineMorphs(vrm);

    this.detachFallbackRoot();
    this.prepareModelRoot(vrm.scene, this.spec.body.heightMeters);
    vrm.scene.rotation.y = Math.PI;
    this.root.add(vrm.scene);
    this.addRuntimeShadowProxy();
    this.bones = this.collectBones(vrm, vrmModule);
    this.setVRMShadows(vrm.scene);
    if (vrm.lookAt) {
      vrm.lookAt.target = this.lookTarget;
      vrm.lookAt.autoUpdate = true;
    }
    this.notifyAssetInstalled();
  }

  private installGLTF(scene: THREE.Group, animations: THREE.AnimationClip[]): void {
    this.setAssetState('gltf');
    this.detachFallbackRoot();
    this.prepareModelRoot(scene, this.spec.body.heightMeters);
    scene.rotation.y = Math.PI;
    this.root.add(scene);
    this.addRuntimeShadowProxy();
    this.setVRMShadows(scene);
    if (this.buildPlan.asset) this.applyGLTFVisualProfile(scene, this.buildPlan.asset);
    this.bones = this.collectNamedBones(scene);
    this.gltfMorphBindings = this.collectMorphTargets(scene);
    this.gltfSecondaryBindings = this.collectSecondaryMotionObjects(scene);
    this.gltfEyeFocusBindings = this.collectEyeFocusObjects(scene);
    this.captureGLTFBoneBasePoses();

    if (animations.length > 0) {
      this.gltfMixer = new THREE.AnimationMixer(scene);
      this.gltfActions.clear();
      for (const clip of animations) {
        const action = this.gltfMixer.clipAction(clip);
        action.enabled = true;
        action.loop = THREE.LoopRepeat;
        action.clampWhenFinished = false;
        action.zeroSlopeAtStart = true;
        action.zeroSlopeAtEnd = true;
        this.gltfActions.set(clip.name.toLowerCase(), action);
      }
      this.playGLTFAction('idle', 0);
    }
    this.notifyAssetInstalled();
  }

  private notifyAssetInstalled(): void {
    const callback = this.options.onAssetInstalled;
    if (!callback) return;
    queueMicrotask(() => {
      try {
        callback();
      } catch (error) {
        console.warn(`Failed to run ${this.spec.id} character asset install callback`, error);
      }
    });
  }

  private applyGLTFVisualProfile(model: THREE.Object3D, asset: CharacterAssetEntry): void {
    if (asset.materialProfile !== 'toon' && asset.materialProfile !== 'mtoon') return;

    const meshes: Array<THREE.Mesh | THREE.SkinnedMesh> = [];
    model.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.SkinnedMesh) meshes.push(object);
    });

    const outlineMaterial = this.createGLTFOutlineMaterial();
    for (const mesh of meshes) {
      this.convertGLTFMeshToToon(mesh);
      if (asset.quality === 'hero' && this.shouldOutlineGLTFMesh(mesh)) {
        this.addGLTFMeshOutline(mesh, outlineMaterial, 1.018);
      }
    }
    model.userData.characterVisualProfile = asset.materialProfile;
  }

  private convertGLTFMeshToToon(mesh: THREE.Mesh | THREE.SkinnedMesh): void {
    const convertMaterial = (material: THREE.Material): THREE.Material => {
      if (material instanceof THREE.MeshToonMaterial) {
        material.gradientMap = CharacterModel3D.getToonGradient();
        material.needsUpdate = true;
        return material;
      }

      const source = material as THREE.Material & {
        color?: THREE.Color;
        map?: THREE.Texture | null;
        alphaMap?: THREE.Texture | null;
        emissive?: THREE.Color;
        emissiveIntensity?: number;
      };
      const color = source.color instanceof THREE.Color ? source.color.clone() : new THREE.Color(0xffffff);
      const toon = new THREE.MeshToonMaterial({
        name: `${material.name || mesh.name || 'Character'}_RuntimeToon`,
        color,
        map: source.map ?? null,
        alphaMap: source.alphaMap ?? null,
        gradientMap: CharacterModel3D.getToonGradient(),
        transparent: material.transparent || material.opacity < 1,
        opacity: material.opacity,
        alphaTest: material.alphaTest,
        side: material.side === THREE.DoubleSide ? THREE.DoubleSide : THREE.FrontSide,
        depthTest: material.depthTest,
        depthWrite: material.depthWrite,
      });
      if (source.emissive instanceof THREE.Color) toon.emissive.copy(source.emissive);
      if (typeof source.emissiveIntensity === 'number') toon.emissiveIntensity = source.emissiveIntensity;
      return toon;
    };

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(convertMaterial);
    } else {
      mesh.material = convertMaterial(mesh.material);
    }
  }

  private shouldOutlineGLTFMesh(mesh: THREE.Mesh | THREE.SkinnedMesh): boolean {
    if (!mesh.geometry) return false;
    const normalized = mesh.name.replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (!normalized) return false;
    if (normalized.includes('inkoutline') || normalized.includes('selectionring')) return false;
    if (/(eye|iris|pupil|catchlight|eyelash|brow|mouth|lip|cheek|nose)/.test(normalized)) return false;
    if (/(button|gem|crest|ring|finger|thumb|wand|paper|book|shadow)/.test(normalized)) return false;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.some((material) => material.transparent || material.opacity < 0.9)) return false;

    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    const radius = mesh.geometry.boundingSphere?.radius ?? 0;
    return radius >= 0.035;
  }

  private addGLTFMeshOutline(
    mesh: THREE.Mesh | THREE.SkinnedMesh,
    material: THREE.MeshBasicMaterial,
    scale: number,
  ): void {
    const parent = mesh.parent;
    if (!parent) return;

    const outline = mesh instanceof THREE.SkinnedMesh
      ? new THREE.SkinnedMesh(mesh.geometry, material)
      : new THREE.Mesh(mesh.geometry, material);
    outline.name = `${mesh.name || 'CharacterMesh'}_InkOutline`;
    outline.position.copy(mesh.position);
    outline.quaternion.copy(mesh.quaternion);
    outline.scale.copy(mesh.scale).multiplyScalar(scale);
    outline.frustumCulled = false;
    outline.castShadow = false;
    outline.receiveShadow = false;
    outline.renderOrder = -20;
    outline.raycast = () => {};

    if (outline instanceof THREE.SkinnedMesh && mesh instanceof THREE.SkinnedMesh) {
      outline.bindMode = mesh.bindMode;
      outline.bind(mesh.skeleton, mesh.bindMatrix);
      outline.morphTargetDictionary = mesh.morphTargetDictionary;
      outline.morphTargetInfluences = mesh.morphTargetInfluences;
    }

    parent.add(outline);
  }

  private detachFallbackRoot(): void {
    this.fallback.root.visible = false;
    this.fallback.root.removeFromParent();
  }

  private addRuntimeShadowProxy(): void {
    const existing = this.root.getObjectByName('character-runtime-shadow-proxy');
    if (existing) existing.removeFromParent();

    const height = this.spec.body.heightMeters;
    const radius = Math.max(0.18, height * 0.16);
    const length = Math.max(0.42, height - radius * 2);
    const proxy = new THREE.Mesh(
      Geo.capsule(radius, length, 8, 16),
      CharacterModel3D.getShadowProxyMaterial(),
    );
    proxy.name = 'character-runtime-shadow-proxy';
    proxy.position.y = height * 0.5;
    proxy.scale.set(0.78, 1, 0.62);
    proxy.castShadow = true;
    proxy.receiveShadow = false;
    proxy.frustumCulled = false;
    proxy.userData.characterShadowProxy = true;
    this.root.add(proxy);
  }

  private createGLTFOutlineMaterial(): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      color: this.spec.id === 'player' ? 0x15131b : 0x24172f,
      side: THREE.BackSide,
      depthTest: true,
      depthWrite: true,
      transparent: false,
    });
  }

  private updateGLTFAnimation(elapsedTime: number, delta: number, lookAtWorldPosition?: THREE.Vector3): void {
    const actionName = this.moving ? 'walk' : 'idle';
    if (actionName !== this.activeGLTFActionRequest) this.playGLTFAction(actionName, 0.22);
    this.restoreGLTFBoneBasePoses();
    this.gltfMixer?.update(delta);
    this.applyGLTFPoseOverlay(elapsedTime);
    this.applyGLTFLookAt(lookAtWorldPosition, elapsedTime, delta);
    this.applyGLTFEyeFocus();
    this.applyGLTFSecondaryMotion(elapsedTime, delta);
    this.applyGLTFMorphExpressions(elapsedTime, delta);
  }

  private playGLTFAction(name: string, fadeDuration: number): void {
    const next = this.gltfActions.get(name) ?? this.gltfActions.get('idle');
    if (!next) return;
    if (next === this.activeGLTFAction) {
      this.activeGLTFActionRequest = name;
      return;
    }

    next.enabled = true;
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    if (!next.isRunning()) next.play();
    if (this.activeGLTFAction && fadeDuration > 0) {
      this.activeGLTFAction.fadeOut(fadeDuration);
      next.reset().fadeIn(fadeDuration).play();
    } else {
      next.reset().play();
    }
    this.activeGLTFAction = next;
    this.activeGLTFActionRequest = name;
  }

  private prepareModelRoot(model: THREE.Object3D, targetHeight: number): void {
    const box = new THREE.Box3().setFromObject(model);
    const height = Math.max(0.001, box.max.y - box.min.y);
    const scale = targetHeight / height;
    model.scale.multiplyScalar(scale);

    const scaledBox = new THREE.Box3().setFromObject(model);
    model.position.y -= scaledBox.min.y;
  }

  private collectBones(vrm: VRM, vrmModule: ThreeVRMModule): BoneSet {
    const humanoid = vrm.humanoid;
    const boneName = vrmModule.VRMHumanBoneName;
    return {
      hips: humanoid.getNormalizedBoneNode(boneName.Hips) ?? undefined,
      spine: humanoid.getNormalizedBoneNode(boneName.Spine) ?? undefined,
      chest: humanoid.getNormalizedBoneNode(boneName.Chest) ?? undefined,
      head: humanoid.getNormalizedBoneNode(boneName.Head) ?? undefined,
      leftUpperArm: humanoid.getNormalizedBoneNode(boneName.LeftUpperArm) ?? undefined,
      leftLowerArm: humanoid.getNormalizedBoneNode(boneName.LeftLowerArm) ?? undefined,
      rightUpperArm: humanoid.getNormalizedBoneNode(boneName.RightUpperArm) ?? undefined,
      rightLowerArm: humanoid.getNormalizedBoneNode(boneName.RightLowerArm) ?? undefined,
      leftUpperLeg: humanoid.getNormalizedBoneNode(boneName.LeftUpperLeg) ?? undefined,
      leftLowerLeg: humanoid.getNormalizedBoneNode(boneName.LeftLowerLeg) ?? undefined,
      leftFoot: humanoid.getNormalizedBoneNode(boneName.LeftFoot) ?? undefined,
      rightUpperLeg: humanoid.getNormalizedBoneNode(boneName.RightUpperLeg) ?? undefined,
      rightLowerLeg: humanoid.getNormalizedBoneNode(boneName.RightLowerLeg) ?? undefined,
      rightFoot: humanoid.getNormalizedBoneNode(boneName.RightFoot) ?? undefined,
    };
  }

  private collectNamedBones(model: THREE.Object3D): BoneSet {
    const entries: Array<[string, THREE.Object3D]> = [];
    model.traverse((object) => {
      if (object.name) entries.push([object.name.replace(/[^a-z0-9]/gi, '').toLowerCase(), object]);
    });

    const find = (name: string): THREE.Object3D | undefined => {
      const target = name.toLowerCase();
      return entries.find(([candidate]) => candidate === target || candidate.endsWith(target) || candidate.includes(target))?.[1];
    };

    return {
      hips: find('hips'),
      spine: find('spine'),
      chest: find('chest'),
      head: find('head'),
      leftUpperArm: find('leftupperarm'),
      leftLowerArm: find('leftlowerarm'),
      rightUpperArm: find('rightupperarm'),
      rightLowerArm: find('rightlowerarm'),
      leftUpperLeg: find('leftupperleg'),
      leftLowerLeg: find('leftlowerleg'),
      leftFoot: find('leftfoot'),
      rightUpperLeg: find('rightupperleg'),
      rightLowerLeg: find('rightlowerleg'),
      rightFoot: find('rightfoot'),
    };
  }

  private collectMorphTargets(model: THREE.Object3D): GLTFMorphBinding[] {
    const bindings: GLTFMorphBinding[] = [];
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.SkinnedMesh)) return;
      if (!object.morphTargetDictionary || !object.morphTargetInfluences) return;
      const targets = CharacterModel3D.collectRuntimeMorphTargets(object.morphTargetDictionary);
      if (targets.length === 0) return;
      bindings.push({
        mesh: object,
        influences: object.morphTargetInfluences,
        targets,
      });
    });
    return bindings;
  }

  private static collectRuntimeMorphTargets(dictionary: Record<string, number>): GLTFMorphTarget[] {
    const targets: GLTFMorphTarget[] = [];
    for (const [name, index] of Object.entries(dictionary)) {
      const kind = CharacterModel3D.classifyRuntimeMorphTarget(name);
      if (!kind) continue;
      targets.push({ index, kind });
    }
    return targets;
  }

  private static classifyRuntimeMorphTarget(name: string): GLTFMorphTargetKind | undefined {
    const normalized = name.toLowerCase();
    if (normalized.includes('blink')) return 'blink';
    if (normalized.includes('teasing')) return 'teasing';
    if (normalized.includes('thoughtful')) return 'thoughtful';
    if (normalized.includes('smile') || normalized.includes('warm')) return 'smile';
    if (normalized.includes('concerned') || normalized.includes('surprised')) return 'zero';
    return undefined;
  }

  private collectSecondaryMotionObjects(model: THREE.Object3D): GLTFSecondaryMotionBinding[] {
    const bindings: GLTFSecondaryMotionBinding[] = [];
    model.traverse((object) => {
      if (!this.isSecondaryMotionBone(object)) return;
      const profile = this.getSecondaryMotionProfile(object.name);
      if (!profile) return;
      bindings.push(this.createSecondaryMotionBinding(object, profile, bindings.length));
    });
    if (bindings.length > 0) return bindings;

    model.traverse((object) => {
      const profile = this.getSecondaryMotionProfile(object.name);
      if (!profile) return;
      if (!this.hasCenteredRuntimePivot(object)) return;
      bindings.push(this.createSecondaryMotionBinding(object, profile, bindings.length));
    });
    return bindings;
  }

  private createSecondaryMotionBinding(
    object: THREE.Object3D,
    profile: GLTFSecondaryMotionProfile,
    index: number,
  ): GLTFSecondaryMotionBinding {
    return {
      object,
      basePosition: object.position.clone(),
      baseRotation: object.rotation.clone(),
      phase: index * 0.73 + object.name.length * 0.11,
      currentX: 0,
      currentY: 0,
      currentZ: 0,
      velocityX: 0,
      velocityY: 0,
      velocityZ: 0,
      ...profile,
    };
  }

  private collectEyeFocusObjects(model: THREE.Object3D): GLTFEyeFocusBinding[] {
    const bindings: GLTFEyeFocusBinding[] = [];
    model.traverse((object) => {
      const name = object.name.toLowerCase();
      if (!name.includes('iris') && !name.includes('pupil') && !name.includes('catchlight')) return;
      bindings.push({
        object,
        basePosition: object.position.clone(),
      });
    });
    return bindings;
  }

  private getSecondaryMotionProfile(name: string): GLTFSecondaryMotionProfile | undefined {
    const normalized = name.replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (!normalized) return undefined;
    const isTip = normalized.includes('tip');
    if (/(hair|bang|lock|braid|ponytail|cowlick)/.test(normalized)) {
      const isLong = /(long|back|outer|tip|tail)/.test(normalized);
      const tipScale = isTip ? 1.35 : 1;
      return {
        sway: (isLong ? 0.052 : 0.034) * tipScale,
        bob: (isLong ? 0.014 : 0.008) * tipScale,
        twist: (isLong ? 0.024 : 0.014) * tipScale,
        stiffness: isTip ? 28 : 42,
        damping: isTip ? 6.6 : 8.4,
      };
    }
    if (/(cape|capelet|skirt|ruffle|sash|ribbon|tail)/.test(normalized)) {
      const tipScale = isTip ? 1.3 : 1;
      return {
        sway: 0.038 * tipScale,
        bob: 0.01 * tipScale,
        twist: 0.018 * tipScale,
        stiffness: isTip ? 24 : 36,
        damping: isTip ? 5.8 : 7.2,
      };
    }
    if (/(sleeve|tie|strap|pendant|choker)/.test(normalized)) {
      const tipScale = isTip ? 1.25 : 1;
      return {
        sway: 0.018 * tipScale,
        bob: 0.004 * tipScale,
        twist: 0.008 * tipScale,
        stiffness: isTip ? 30 : 42,
        damping: isTip ? 6.4 : 8.2,
      };
    }
    return undefined;
  }

  private isSecondaryMotionBone(object: THREE.Object3D): boolean {
    const normalized = object.name.replace(/[^a-z0-9]/gi, '').toLowerCase();
    return (object instanceof THREE.Bone || object.type === 'Bone') && normalized.includes('secondary');
  }

  private hasCenteredRuntimePivot(object: THREE.Object3D): boolean {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.SkinnedMesh)) return false;
    const geometry = object.geometry;
    if (!geometry) return false;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return false;

    geometry.boundingBox.getCenter(this.runtimePivotCenter);
    // Older generated panels had absolute vertices around the character body. Skip
    // those so secondary motion only runs on assets with usable local pivots.
    return this.runtimePivotCenter.length() < 0.18;
  }

  private captureGLTFBoneBasePoses(): void {
    this.gltfBoneBasePoses.clear();
    for (const bone of Object.values(this.bones)) {
      if (!bone || this.gltfBoneBasePoses.has(bone)) continue;
      this.gltfBoneBasePoses.set(bone, {
        position: bone.position.clone(),
        rotation: bone.rotation.clone(),
      });
    }
  }

  private restoreGLTFBoneBasePoses(): void {
    for (const [bone, pose] of this.gltfBoneBasePoses) {
      bone.position.copy(pose.position);
      bone.rotation.copy(pose.rotation);
    }
  }

  private updateLookTarget(lookAtWorldPosition: THREE.Vector3 | undefined, elapsedTime: number): void {
    if (!this.vrm?.lookAt) return;

    if (lookAtWorldPosition) {
      this.lookTarget.position.set(
        lookAtWorldPosition.x,
        lookAtWorldPosition.y + 1.42,
        lookAtWorldPosition.z
      );
    } else {
      this.root.getWorldPosition(this.lookTarget.position);
      this.lookTarget.position.y += 1.42;
      this.lookTarget.position.x += Math.sin(elapsedTime * 0.35) * 0.42;
      this.lookTarget.position.z += 1.6;
    }
    this.lookTarget.updateMatrixWorld(true);
  }

  private applyHumanoidPose(elapsedTime: number, movementBlend: number, talkBlend: number): void {
    if (!this.vrm) return;

    const walk = Math.sin(elapsedTime * 8.2);
    const opposite = Math.sin(elapsedTime * 8.2 + Math.PI);
    const bounce = Math.abs(Math.cos(elapsedTime * 8.2));
    const breathe = Math.sin(elapsedTime * 2.1);
    const soft = Math.sin(elapsedTime * 1.1);
    const blend = movementBlend;
    const idle = 1 - blend;

    this.vrm.humanoid.resetNormalizedPose();
    if (this.bones.hips) {
      this.bones.hips.position.y = bounce * 0.018 * blend + breathe * 0.006 * idle;
      this.bones.hips.rotation.z = walk * 0.02 * blend + soft * 0.008 * idle;
    }
    if (this.bones.spine) this.bones.spine.rotation.x = breathe * 0.018 * idle - bounce * 0.018 * blend;
    if (this.bones.chest) {
      this.bones.chest.rotation.y = walk * 0.035 * blend;
      this.bones.chest.rotation.z = -walk * 0.018 * blend + soft * 0.01 * idle;
    }
    if (this.bones.head) {
      this.bones.head.rotation.x = breathe * 0.012 * idle - bounce * 0.01 * blend;
      this.bones.head.rotation.y = soft * 0.045 * idle;
      this.bones.head.rotation.z = -walk * 0.012 * blend;
    }

    if (this.spec.id === 'player') {
      this.poseWalk(walk, opposite, blend);
    } else {
      this.poseLyraIdle(elapsedTime, breathe, soft, talkBlend);
    }
  }

  private poseWalk(walk: number, opposite: number, blend: number): void {
    if (this.bones.leftUpperLeg) this.bones.leftUpperLeg.rotation.x = walk * 0.5 * blend;
    if (this.bones.rightUpperLeg) this.bones.rightUpperLeg.rotation.x = opposite * 0.5 * blend;
    if (this.bones.leftLowerLeg) this.bones.leftLowerLeg.rotation.x = Math.max(0, -walk) * 0.5 * blend;
    if (this.bones.rightLowerLeg) this.bones.rightLowerLeg.rotation.x = Math.max(0, walk) * 0.5 * blend;
    if (this.bones.leftFoot) this.bones.leftFoot.rotation.x = Math.max(0, walk) * 0.16 * blend;
    if (this.bones.rightFoot) this.bones.rightFoot.rotation.x = Math.max(0, opposite) * 0.16 * blend;
    if (this.bones.leftUpperArm) this.bones.leftUpperArm.rotation.x = opposite * 0.36 * blend;
    if (this.bones.rightUpperArm) this.bones.rightUpperArm.rotation.x = walk * 0.36 * blend;
    if (this.bones.leftLowerArm) this.bones.leftLowerArm.rotation.x = -0.18 - Math.max(0, walk) * 0.12 * blend;
    if (this.bones.rightLowerArm) this.bones.rightLowerArm.rotation.x = -0.18 - Math.max(0, opposite) * 0.12 * blend;
  }

  private poseLyraIdle(elapsedTime: number, breathe: number, soft: number, talkBlend: number): void {
    if (this.bones.leftUpperArm) this.bones.leftUpperArm.rotation.set(-0.28 + breathe * 0.015, -0.16, -0.72 + soft * 0.012);
    if (this.bones.leftLowerArm) this.bones.leftLowerArm.rotation.set(-1.05 + breathe * 0.014, 0, 0.46);
    if (this.bones.rightUpperArm) this.bones.rightUpperArm.rotation.set(-0.34 - breathe * 0.012, 0.16, 0.72 - soft * 0.012);
    if (this.bones.rightLowerArm) this.bones.rightLowerArm.rotation.set(-1.08 - breathe * 0.014, 0, -0.42);
    if (this.bones.leftUpperLeg) this.bones.leftUpperLeg.rotation.x = -0.035 + breathe * 0.006;
    if (this.bones.rightUpperLeg) this.bones.rightUpperLeg.rotation.x = 0.03 - breathe * 0.006;
    if (this.bones.head) this.bones.head.rotation.y += Math.sin(elapsedTime * 9) * 0.035 * talkBlend;
  }

  private applyGLTFPoseOverlay(elapsedTime: number): void {
    if (!this.bones.hips && !this.bones.head) return;

    const walk = Math.sin(elapsedTime * 8.2);
    const opposite = Math.sin(elapsedTime * 8.2 + Math.PI);
    const bounce = Math.abs(Math.cos(elapsedTime * 8.2));
    const breathe = Math.sin(elapsedTime * 2.0);
    const soft = Math.sin(elapsedTime * 1.1);
    const movementBlend = this.moving ? 1 : 0;
    const idleBlend = 1 - movementBlend;

    if (this.bones.hips) {
      this.bones.hips.position.y += bounce * 0.006 * movementBlend + breathe * 0.003 * idleBlend;
      this.bones.hips.rotation.z += walk * 0.008 * movementBlend + soft * 0.004 * idleBlend;
    }
    if (this.bones.spine) {
      this.bones.spine.rotation.x += breathe * 0.008 * idleBlend - bounce * 0.006 * movementBlend;
      this.bones.spine.rotation.y += -walk * 0.012 * movementBlend;
    }
    if (this.bones.chest) {
      this.bones.chest.rotation.y += walk * 0.016 * movementBlend;
      this.bones.chest.rotation.z += soft * 0.006 * idleBlend - walk * 0.008 * movementBlend;
    }
    if (this.bones.head) {
      this.bones.head.rotation.x += breathe * 0.008 * idleBlend - bounce * 0.004 * movementBlend;
      this.bones.head.rotation.y += soft * 0.018 * idleBlend;
      this.bones.head.rotation.z += -walk * 0.006 * movementBlend;
    }

    if (!this.moving) return;
    if (this.bones.leftLowerLeg) this.bones.leftLowerLeg.rotation.x += Math.max(0, -walk) * 0.18;
    if (this.bones.rightLowerLeg) this.bones.rightLowerLeg.rotation.x += Math.max(0, walk) * 0.18;
    if (this.bones.leftFoot) this.bones.leftFoot.rotation.x += Math.max(0, walk) * 0.08;
    if (this.bones.rightFoot) this.bones.rightFoot.rotation.x += Math.max(0, opposite) * 0.08;
    if (this.bones.leftLowerArm) this.bones.leftLowerArm.rotation.x += -0.05 - Math.max(0, walk) * 0.04;
    if (this.bones.rightLowerArm) this.bones.rightLowerArm.rotation.x += -0.05 - Math.max(0, opposite) * 0.04;
  }

  private applyGLTFLookAt(lookAtWorldPosition: THREE.Vector3 | undefined, elapsedTime: number, delta: number): void {
    let targetYaw = Math.sin(elapsedTime * 0.42) * 0.08;
    let targetPitch = Math.sin(elapsedTime * 0.31) * 0.025;

    if (lookAtWorldPosition && this.bones.head) {
      const headWorld = this.gltfHeadWorld;
      const targetLocal = this.gltfLookTargetLocal.copy(lookAtWorldPosition);
      const headLocal = this.gltfLookHeadLocal;
      this.bones.head.getWorldPosition(headWorld);
      headLocal.copy(headWorld);
      this.root.worldToLocal(targetLocal);
      this.root.worldToLocal(headLocal);
      const direction = targetLocal.sub(headLocal);
      const flatDistance = Math.max(0.001, Math.hypot(direction.x, direction.z));
      targetYaw = THREE.MathUtils.clamp(Math.atan2(direction.x, direction.z), -0.42, 0.42);
      targetPitch = THREE.MathUtils.clamp(Math.atan2(direction.y + 0.18, flatDistance), -0.24, 0.24);
    }

    const smoothing = 1 - Math.exp(-delta * 8);
    this.gltfLookYaw += (targetYaw - this.gltfLookYaw) * smoothing;
    this.gltfLookPitch += (targetPitch - this.gltfLookPitch) * smoothing;

    if (this.bones.head) {
      this.bones.head.rotation.y += this.gltfLookYaw * 0.32;
      this.bones.head.rotation.x += this.gltfLookPitch * 0.22;
    }
  }

  private applyGLTFEyeFocus(): void {
    if (this.gltfEyeFocusBindings.length === 0) return;

    const horizontal = THREE.MathUtils.clamp(this.gltfLookYaw, -0.35, 0.35) * 0.014;
    const vertical = THREE.MathUtils.clamp(this.gltfLookPitch, -0.22, 0.22) * 0.01;
    for (const binding of this.gltfEyeFocusBindings) {
      binding.object.position.copy(binding.basePosition);
      binding.object.position.x += horizontal;
      binding.object.position.z += vertical;
    }
  }

  private applyGLTFSecondaryMotion(elapsedTime: number, delta: number): void {
    if (this.gltfSecondaryBindings.length === 0) return;

    const step = THREE.MathUtils.clamp(delta, 0.001, 0.05);
    const movement = this.moving ? 1 : 0;
    const idle = 1 - movement;
    for (const binding of this.gltfSecondaryBindings) {
      const stride = Math.sin(elapsedTime * 8.2 + binding.phase);
      const settle = Math.sin(elapsedTime * 1.55 + binding.phase);
      const flutter = Math.sin(elapsedTime * 2.35 + binding.phase * 0.7);
      const moveScale = 0.45 + movement * 0.95;
      const targetX = binding.bob * (Math.abs(stride) * movement + settle * 0.45 * idle);
      const targetY = binding.twist * (stride * movement + flutter * 0.35 * idle);
      const targetZ = binding.sway * moveScale * (stride * movement + settle * 0.55 * idle);
      const damping = Math.exp(-binding.damping * step);

      binding.velocityX += (targetX - binding.currentX) * binding.stiffness * step;
      binding.velocityY += (targetY - binding.currentY) * binding.stiffness * step;
      binding.velocityZ += (targetZ - binding.currentZ) * binding.stiffness * step;
      binding.velocityX *= damping;
      binding.velocityY *= damping;
      binding.velocityZ *= damping;
      binding.currentX = THREE.MathUtils.clamp(binding.currentX + binding.velocityX * step, -0.18, 0.18);
      binding.currentY = THREE.MathUtils.clamp(binding.currentY + binding.velocityY * step, -0.18, 0.18);
      binding.currentZ = THREE.MathUtils.clamp(binding.currentZ + binding.velocityZ * step, -0.22, 0.22);

      binding.object.position.copy(binding.basePosition);
      binding.object.rotation.copy(binding.baseRotation);
      binding.object.rotation.x += binding.currentX;
      binding.object.rotation.y += binding.currentY;
      binding.object.rotation.z += binding.currentZ;
      binding.object.position.y += binding.bob * 0.012 * flutter * idle + binding.currentX * 0.006;
    }
  }

  private applyGLTFMorphExpressions(elapsedTime: number, delta: number): void {
    if (this.gltfMorphBindings.length === 0) return;

    this.blinkTimer -= delta;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 2.2 + Math.random() * 2.4;
      this.blinkDuration = 0.16;
    }

    let blink = 0;
    if (this.blinkDuration > 0) {
      this.blinkDuration -= delta;
      const phase = 1 - Math.max(0, this.blinkDuration) / 0.16;
      blink = Math.sin(phase * Math.PI);
    }

    const isMatureSenpai = this.spec.id === 'mature_senpai';
    const baseSmile = this.spec.id === 'player' ? 0.035 : this.spec.id === 'lyra' ? 0.18 : isMatureSenpai ? 0.22 : 0.08;
    const smilePulse = this.spec.id === 'lyra' ? 0.035 : isMatureSenpai ? 0.052 : 0.018;
    const smile = baseSmile + Math.sin(elapsedTime * 1.15) * smilePulse;
    const teasing = isMatureSenpai ? 0.045 + Math.max(0, Math.sin(elapsedTime * 0.48)) * 0.04 : 0;
    const thoughtful = isMatureSenpai ? 0.032 + Math.max(0, Math.sin(elapsedTime * 0.31 + 1.4)) * 0.026 : 0;

    const smileValue = Math.max(0, smile);
    for (const binding of this.gltfMorphBindings) {
      for (const target of binding.targets) {
        if (target.kind === 'blink') binding.influences[target.index] = blink;
        else if (target.kind === 'teasing') binding.influences[target.index] = teasing;
        else if (target.kind === 'thoughtful') binding.influences[target.index] = thoughtful;
        else if (target.kind === 'smile') binding.influences[target.index] = smileValue;
        else binding.influences[target.index] = 0;
      }
    }
  }

  private applyExpressions(elapsedTime: number, delta: number): void {
    const manager = this.vrm?.expressionManager;
    if (!manager) return;

    this.blinkTimer -= delta;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 2.4 + Math.random() * 2.2;
      this.blinkDuration = 0.18;
    }
    if (this.blinkDuration > 0) {
      this.blinkDuration -= delta;
      const phase = 1 - Math.max(0, this.blinkDuration) / 0.18;
      manager.setValue('blink', Math.sin(phase * Math.PI));
    } else {
      manager.setValue('blink', 0);
    }

    const mood = this.spec.id === 'lyra' ? 0.28 + Math.sin(elapsedTime * 1.1) * 0.04 : 0.12;
    manager.setValue('happy', mood);
  }

  private setVRMShadows(model: THREE.Object3D): void {
    model.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.SkinnedMesh) {
        object.castShadow = false;
        object.receiveShadow = true;
        object.frustumCulled = false;
      }
    });
  }

  private setAssetState(state: CharacterAssetState): void {
    this.assetState = state;
    this.root.userData.characterAssetState = state;
    this.root.userData.characterBuildSource = this.buildPlan.source;
  }

  private static createVRMLoader(vrmModule: ThreeVRMModule): GLTFLoader {
    const loader = new GLTFLoader();
    loader.register((parser) => new vrmModule.VRMLoaderPlugin(parser));
    return loader;
  }

  private static getToonGradient(): THREE.DataTexture {
    if (!CharacterModel3D.toonGradient) {
      const data = new Uint8Array([
        56, 56, 56, 255,
        116, 116, 116, 255,
        176, 176, 176, 255,
        226, 226, 226, 255,
        255, 255, 255, 255,
      ]);
      const texture = new THREE.DataTexture(data, 5, 1, THREE.RGBAFormat);
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      CharacterModel3D.toonGradient = texture;
    }
    return CharacterModel3D.toonGradient;
  }

  private static getShadowProxyMaterial(): THREE.MeshBasicMaterial {
    if (!CharacterModel3D.shadowProxyMaterial) {
      const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
      material.colorWrite = false;
      material.depthWrite = false;
      material.depthTest = false;
      CharacterModel3D.shadowProxyMaterial = material;
    }
    return CharacterModel3D.shadowProxyMaterial;
  }
}
