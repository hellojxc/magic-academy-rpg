import React, {
  Suspense,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import * as THREE from 'three';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import {
  AdaptiveDpr,
  ContactShadows,
  Detailed,
  Float,
  Html,
  Instance,
  Instances,
  KeyboardControls,
  Preload,
  Sparkles,
  Stars,
} from '@react-three/drei';
import {
  CuboidCollider,
  Physics,
  RigidBody,
} from '@react-three/rapier';
import {
  Bloom,
  DepthOfField,
  EffectComposer,
  N8AO,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { Ecctrl, type EcctrlHandle } from 'ecctrl';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { DomDialogueBox } from '../ui/DomDialogueBox';
import { GameHud } from '../ui/GameHud';
import { DialogueSystem } from '../systems/DialogueSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { CombatSkillSystem } from '../systems/CombatSkillSystem';
import { InventorySystem } from '../systems/InventorySystem';
import dialoguesData from '../data/dialogues.json';
import type { DialogueTree, SaveData } from '../types';
import {
  DECALS,
  NPC_SCENE_DEFINITIONS,
  VEGETATION_SCATTERS,
  WORLD_CHUNKS,
  getActiveChunks,
  type Bounds2D,
  type NpcSceneDefinition,
  type Vec3Tuple,
  type WorldChunkDefinition,
  type WorldChunkId,
} from './worldManifest';
import {
  createWorldDecalSet,
  createWorldVegetationSet,
  createFilePbrSet,
  createGroundPbrSet,
  createOrganicPbrSet,
  createPbrMaterial,
  createStonePbrSet,
  type WorldDecalTextureId,
  type WorldVegetationTextureId,
} from './pbrMaterials';
import {
  WORLD_PREFAB_PLACEMENTS,
  type WorldRegionId,
} from '../three/WorldPrefabManifest';
import thirdPartyWorldProps from './third-party-world-props.json';

declare global {
  interface Window {
    __r3fSceneDiagnostics?: {
      readonly meshCount: number;
      readonly namedObjects: readonly string[];
      readonly camera: readonly [number, number, number];
    };
    __r3fAssetLoads?: Record<string, string>;
    __r3fChunkRenderState?: Record<string, string>;
    __r3fEnvironmentState?: {
      readonly url: string;
      readonly width: number;
      readonly height: number;
      readonly intensity: number;
      readonly background: 'hdri';
      readonly backgroundIntensity: number;
      readonly backgroundBlurriness: number;
    };
  }
}

type R3FNpc = NpcSceneDefinition;
type ThreeVec3Tuple = [number, number, number];
type GlbLoadPriority = 'critical' | 'high' | 'normal';

interface R3FGameDebugState {
  readonly renderer: 'r3f';
  readonly activeChunks: readonly WorldChunkId[];
  readonly nearbyNpc: string | null;
  readonly playerPosition: { readonly x: number; readonly y: number; readonly z: number };
  readonly progression: {
    readonly coverage: { readonly attributes: number; readonly melee: number; readonly ranged: number; readonly defense: number; readonly items: number };
    readonly activeSkills: Record<'melee' | 'ranged' | 'defense', string>;
    readonly equipped: readonly string[];
  };
}

interface R3FAcademyAppProps {
  readonly save: SaveData;
  readonly onNearbyNpcChange: (npc: R3FNpc | null) => void;
  readonly onDebugState: (state: R3FGameDebugState) => void;
}

const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'leftward', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'rightward', keys: ['ArrowRight', 'KeyD'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'run', keys: ['ShiftLeft', 'ShiftRight'] },
];

const zeroVec = new THREE.Vector3();
const worldTextureLoader = new THREE.TextureLoader();
const playerSpawn = new THREE.Vector3(0, 1.25, 4.2);
const maxAuthoredChunkCount = 8;
const initialAuthoredChunkCount = 2;
const authoredChunkStreamStepMs = 900;
const maxConcurrentGlbLoads = 5;
const r3fPlayerStatePublishDistanceSq = 0.18 * 0.18;
const r3fDebugStatePublishIntervalMs = 250;
const r3fSceneDiagnosticsIntervalMs = 2500;
const enhancedMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
const lightmapCache = new Map<string, THREE.Texture>();
const worldHdriUrl = '/assets/world/hdri/academy-night-atrium.hdr';
let activeGlbLoadCount = 0;
let activeCriticalGlbLoadCount = 0;
const pendingCriticalGlbLoadQueue: Array<() => void> = [];
const pendingHighPriorityGlbLoadQueue: Array<() => void> = [];
const pendingGlbLoadQueue: Array<() => void> = [];

interface ThirdPartyWorldAssetSource {
  readonly id: string;
  readonly displayName: string;
  readonly collection: string;
  readonly author: string;
  readonly license: string;
  readonly surfaceHint: string;
  readonly sourceUrl: string;
  readonly originalUrl: string;
  readonly url: string;
}

type ThirdPartyWorldAssetImportance = 'hero' | 'set-dressing' | 'detail';

interface ThirdPartyWorldLodConfig {
  readonly importance: ThirdPartyWorldAssetImportance;
  readonly fadeDistance: number;
  readonly mobileFadeDistance?: number;
  readonly shadowDistance?: number;
}

interface ThirdPartyWorldBoxCollider {
  readonly kind: 'box';
  readonly halfExtents: Vec3Tuple;
  readonly center?: Vec3Tuple;
}

interface ThirdPartyWorldRuntimeConfig {
  readonly defaultEnabledSourceIds?: readonly string[];
  readonly defaultEnabledPlacementIds?: readonly string[];
  readonly defaultLod?: ThirdPartyWorldLodConfig;
  readonly lod?: Record<string, Partial<ThirdPartyWorldLodConfig>>;
  readonly colliders?: Record<string, ThirdPartyWorldBoxCollider>;
}

interface ThirdPartyWorldPropPlacement {
  readonly id: string;
  readonly sourceId: string;
  readonly chunkId: WorldChunkId;
  readonly position: Vec3Tuple;
  readonly rotation: Vec3Tuple;
  readonly scale: number;
}

interface ThirdPartyWorldPropsManifest {
  readonly sources: readonly ThirdPartyWorldAssetSource[];
  readonly runtime?: ThirdPartyWorldRuntimeConfig;
  readonly placements: readonly ThirdPartyWorldPropPlacement[];
}

const thirdPartyWorldAssetManifest = thirdPartyWorldProps as unknown as ThirdPartyWorldPropsManifest;
const thirdPartyWorldAssetSources = thirdPartyWorldAssetManifest.sources;
const thirdPartyWorldAssetSourcesById = new Map(
  thirdPartyWorldAssetSources.map((source) => [source.id, source]),
);
const thirdPartyWorldPlacements = thirdPartyWorldAssetManifest.placements;
const thirdPartyWorldRuntime = thirdPartyWorldAssetManifest.runtime ?? {};
const defaultThirdPartyWorldGlbSourceIds = new Set(thirdPartyWorldRuntime.defaultEnabledSourceIds ?? []);
const defaultThirdPartyWorldGlbPlacementIds = new Set(thirdPartyWorldRuntime.defaultEnabledPlacementIds ?? []);
const defaultThirdPartyWorldLod: ThirdPartyWorldLodConfig = {
  importance: 'set-dressing',
  fadeDistance: 62,
  mobileFadeDistance: 42,
  shadowDistance: 34,
  ...(thirdPartyWorldRuntime.defaultLod ?? {}),
};

export class R3FAcademyGame {
  private root: Root | null = null;
  private readonly mount: HTMLDivElement;
  private readonly saveSystem = SaveSystem;
  private readonly dialogueSystem: DialogueSystem;
  private readonly dialogueBox: DomDialogueBox;
  private readonly hud: GameHud;
  private save: SaveData;
  private nearbyNpc: R3FNpc | null = null;
  private activeDialogueNpcId = 'lyra';
  private activeDialogueNpcName = 'Lyra';
  private debugState: R3FGameDebugState;

  constructor(private readonly container: HTMLElement) {
    this.container.classList.add('r3f-game');
    this.mount = document.createElement('div');
    this.mount.className = 'r3f-react-root';
    this.container.append(this.mount);
    this.save = this.saveSystem.load();
    this.dialogueSystem = new DialogueSystem(
      dialoguesData as Record<string, DialogueTree[]>,
      this.saveSystem,
    );
    this.dialogueBox = new DomDialogueBox(this.container, {
      onSelectChoice: (index) => this.onSelectChoice(index),
      onAdvance: () => this.onAdvanceDialogue(),
    });
    this.hud = new GameHud(this.container);
    this.debugState = this.createDebugState(
      getActiveChunks({ x: 0, z: 4.2 }).map((chunk) => chunk.id),
      null,
      { x: 0, y: 1.2, z: 4.2 },
    );
    this.bindEvents();
    this.updateHud();
  }

  start(): void {
    this.root = createRoot(this.mount);
    this.render();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.root?.unmount();
    this.mount.remove();
    this.dialogueBox.hide();
    this.hud.destroy();
  }

  getDebugState(): R3FGameDebugState {
    return this.debugState;
  }

  private render(): void {
    this.root?.render(
      <R3FAcademyApp
        save={this.save}
        onNearbyNpcChange={(npc) => {
          this.nearbyNpc = npc;
        }}
        onDebugState={(state) => {
          this.debugState = state;
        }}
      />,
    );
  }

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'KeyR' && event.shiftKey) {
      this.saveSystem.clear();
      this.save = this.saveSystem.load();
      this.updateHud();
      this.render();
      event.preventDefault();
      return;
    }

    if (this.dialogueBox.isVisible()) {
      if (event.code === 'Enter' || event.code === 'Space') this.dialogueBox.confirm();
      if (event.code === 'ArrowUp' || event.code === 'KeyW') this.dialogueBox.moveSelection(-1);
      if (event.code === 'ArrowDown' || event.code === 'KeyS') this.dialogueBox.moveSelection(1);
      if (event.code === 'Digit1') this.dialogueBox.selectByNumber(0);
      if (event.code === 'Digit2') this.dialogueBox.selectByNumber(1);
      if (event.code === 'Digit3') this.dialogueBox.selectByNumber(2);
      event.preventDefault();
      return;
    }

    if (event.code === 'KeyE') {
      if (this.nearbyNpc) this.startNpcDialogue(this.nearbyNpc);
      event.preventDefault();
      return;
    }

    if (event.code === 'KeyZ') {
      this.saveSystem.cycleSkill(this.save, 'melee');
      this.updateHud();
      this.render();
      event.preventDefault();
      return;
    }

    if (event.code === 'KeyX') {
      this.saveSystem.cycleSkill(this.save, 'ranged');
      this.updateHud();
      this.render();
      event.preventDefault();
      return;
    }

    if (event.code === 'KeyC') {
      this.saveSystem.cycleSkill(this.save, 'defense');
      this.updateHud();
      this.render();
      event.preventDefault();
      return;
    }

    if (event.code === 'KeyV') {
      this.saveSystem.cycleEquipment(this.save, 'mainHand');
      this.updateHud();
      this.render();
      event.preventDefault();
    }
  };

  private startNpcDialogue(npc: R3FNpc): void {
    this.activeDialogueNpcId = npc.id;
    this.activeDialogueNpcName = npc.name;
    const tree = this.dialogueSystem.selectDialogue(npc.id, this.save);
    if (!tree) return;

    const state = this.dialogueSystem.startDialogue(tree);
    if (state.phase === 'page') {
      this.dialogueBox.show(state.page.speaker, state.page.text, state.page.choices);
    }
  }

  private onSelectChoice(index: number): void {
    const result = this.dialogueSystem.selectChoice(index, this.save, this.activeDialogueNpcId);
    if (!result.response) return;
    this.dialogueBox.showResponse(this.activeDialogueNpcName, result.response);
    this.updateHud();
    this.render();
  }

  private onAdvanceDialogue(): void {
    const tree = this.dialogueSystem.getCurrentTree();
    this.dialogueSystem.advance();
    const state = this.dialogueSystem.getState();

    if (state.phase === 'ended') {
      if (tree?.completesEvent) this.saveSystem.markEventComplete(this.save, tree.completesEvent);
      this.dialogueBox.hide();
      this.updateHud();
      this.render();
      return;
    }

    if (state.phase === 'page') {
      this.dialogueBox.show(state.page.speaker, state.page.text, state.page.choices);
    }
  }

  private updateHud(): void {
    this.hud.update(this.save);
  }

  private createDebugState(
    activeChunks: readonly WorldChunkId[],
    nearbyNpc: string | null,
    playerPosition: { readonly x: number; readonly y: number; readonly z: number },
  ): R3FGameDebugState {
    return {
      renderer: 'r3f',
      activeChunks,
      nearbyNpc,
      playerPosition,
      progression: {
        coverage: CombatSkillSystem.getCoverage(),
        activeSkills: {
          melee: CombatSkillSystem.getActiveSkill(this.save.skillLoadout, 'melee').label,
          ranged: CombatSkillSystem.getActiveSkill(this.save.skillLoadout, 'ranged').label,
          defense: CombatSkillSystem.getActiveSkill(this.save.skillLoadout, 'defense').label,
        },
        equipped: InventorySystem.getEquippedItems(this.save.inventory).map((item) => item.label),
      },
    };
  }
}

function R3FAcademyApp({ save, onNearbyNpcChange, onDebugState }: R3FAcademyAppProps): React.ReactElement {
  const biomeQaShot = shouldUseBiomeQaShot();
  const libraryQaShot = shouldUseLibraryQaShot();
  const initialPosition = useMemo(() => {
    if (libraryQaShot) return new THREE.Vector3(6.25, 1.2, -2.55);
    if (biomeQaShot) return new THREE.Vector3(-8.8, 1.2, 18.2);
    return new THREE.Vector3(0, 1.2, 4.2);
  }, [biomeQaShot, libraryQaShot]);
  const [playerPosition, setPlayerPosition] = useState(() => initialPosition.clone());
  const activeChunks = useMemo(
    () => getActiveChunks({ x: playerPosition.x, z: playerPosition.z }),
    [playerPosition.x, playerPosition.z],
  );

  const publishDebugState = useCallback((nearbyNpc: R3FNpc | null, position: THREE.Vector3) => {
    onDebugState({
      renderer: 'r3f',
      activeChunks: getActiveChunks({ x: position.x, z: position.z }).map((chunk) => chunk.id),
      nearbyNpc: nearbyNpc?.id ?? null,
      playerPosition: { x: position.x, y: position.y, z: position.z },
      progression: {
        coverage: CombatSkillSystem.getCoverage(),
        activeSkills: {
          melee: CombatSkillSystem.getActiveSkill(save.skillLoadout, 'melee').label,
          ranged: CombatSkillSystem.getActiveSkill(save.skillLoadout, 'ranged').label,
          defense: CombatSkillSystem.getActiveSkill(save.skillLoadout, 'defense').label,
        },
        equipped: InventorySystem.getEquippedItems(save.inventory).map((item) => item.label),
      },
    });
  }, [onDebugState, save]);

  useEffect(() => {
    publishDebugState(null, playerPosition);
  }, [playerPosition, publishDebugState]);

  return (
    <div className="r3f-canvas-shell">
      <KeyboardControls map={keyboardMap}>
        <Canvas
          shadows
          camera={{
            position: libraryQaShot ? [10.6, 4.15, 3.1] : biomeQaShot ? [-2, 4.95, 24.6] : [6.8, 4.95, 10.6],
            fov: libraryQaShot ? 39 : biomeQaShot ? 42 : 44,
            near: 0.1,
            far: 160,
          }}
          dpr={[1, Math.min(window.devicePixelRatio || 1, 2)]}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
          }}
          onCreated={({ gl, camera }) => {
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.08;
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
            camera.lookAt(libraryQaShot
              ? new THREE.Vector3(6.15, 1.08, -3.95)
              : biomeQaShot
                ? new THREE.Vector3(-15.7, 0.9, 21.2)
                : new THREE.Vector3(0.1, 0.86, 3.45));
          }}
        >
          <Suspense fallback={<SceneLoading />}>
            <AcademyR3FScene
              activeChunks={activeChunks}
              playerPosition={playerPosition}
              onPlayerPosition={setPlayerPosition}
              onNearbyNpcChange={onNearbyNpcChange}
              onDebugState={publishDebugState}
            />
          </Suspense>
        </Canvas>
      </KeyboardControls>
    </div>
  );
}

interface AcademyR3FSceneProps {
  readonly activeChunks: readonly WorldChunkDefinition[];
  readonly playerPosition: THREE.Vector3;
  readonly onPlayerPosition: (position: THREE.Vector3) => void;
  readonly onNearbyNpcChange: (npc: R3FNpc | null) => void;
  readonly onDebugState: (nearbyNpc: R3FNpc | null, position: THREE.Vector3) => void;
}

function AcademyR3FScene({
  activeChunks,
  playerPosition,
  onPlayerPosition,
  onNearbyNpcChange,
  onDebugState,
}: AcademyR3FSceneProps): React.ReactElement {
  const activeIds = useMemo(() => new Set(activeChunks.map((chunk) => chunk.id)), [activeChunks]);
  const nearbyRef = useRef<R3FNpc | null>(null);
  const lastPublishedPlayerPosition = useRef(playerPosition.clone());
  const lastDebugStatePublishAt = useRef(0);
  const materialQaShot = shouldUseMaterialQaShot();
  const biomeQaShot = shouldUseBiomeQaShot();
  const libraryQaShot = shouldUseLibraryQaShot();
  const postprocessingDisabled = shouldDisablePostprocessing();
  const suppressFullPostprocessing = postprocessingDisabled || activeIds.has('lake-grotto') || activeIds.has('moonlit-lawn');

  const handlePlayerFrame = useCallback((position: THREE.Vector3) => {
    const dx = position.x - lastPublishedPlayerPosition.current.x;
    const dy = position.y - lastPublishedPlayerPosition.current.y;
    const dz = position.z - lastPublishedPlayerPosition.current.z;
    const movedSq = dx * dx + dy * dy + dz * dz;
    const nearby = findNearbyNpc(position);
    const nearbyChanged = nearbyRef.current?.id !== nearby?.id;
    if (nearbyChanged) {
      nearbyRef.current = nearby;
      onNearbyNpcChange(nearby);
    }

    const movedEnough = movedSq >= r3fPlayerStatePublishDistanceSq;
    if (movedEnough || nearbyChanged) {
      lastPublishedPlayerPosition.current.copy(position);
      onPlayerPosition(new THREE.Vector3(position.x, position.y, position.z));
    }

    const now = performance.now();
    if (movedEnough || nearbyChanged || now - lastDebugStatePublishAt.current >= r3fDebugStatePublishIntervalMs) {
      lastDebugStatePublishAt.current = now;
      onDebugState(nearby, position);
    }
  }, [onDebugState, onNearbyNpcChange, onPlayerPosition]);

  return (
    <>
      <fog attach="fog" args={['#111725', 22, 88]} />
      <Stars radius={95} depth={28} count={1400} factor={3.2} fade speed={0.28} />
      <WorldIblEnvironment materialQaShot={materialQaShot} />
      <WorldBackdropLayer activeChunks={activeChunks} materialQaShot={materialQaShot} />
      <ambientLight intensity={0.28} />
      <directionalLight
        position={[-9, 13, -6]}
        intensity={2.5}
        color="#d9e8ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
      />
      <pointLight position={[0, 3.4, -4]} color="#8fdcff" intensity={18} distance={14} decay={2.2} />
      <pointLight position={[17, 2.2, 0]} color="#ffb56e" intensity={13} distance={12} decay={2.1} />
      <pointLight position={[-18, 2.4, 21]} color="#74f1ff" intensity={14} distance={14} decay={2.1} />
      {materialQaShot ? <MaterialInspectionLighting /> : null}

      <FixedOpeningCamera />
      <ArcaneBeacon />
      <StreamingWorld activeChunks={activeChunks} activeIds={activeIds} playerPosition={playerPosition} />
      <Physics gravity={[0, -9.81, 0]} timeStep="vary">
        <WorldCollision activeChunks={activeChunks} />
        <ThirdPartyPropCollisionLayer activeIds={activeIds} playerPosition={playerPosition} />
        <BiomePhysicsLogicLayer activeIds={activeIds} />
        <NpcLayer activeIds={activeIds} />
        {materialQaShot || biomeQaShot || libraryQaShot ? null : <EcctrlPlayer onFrame={handlePlayerFrame} />}
      </Physics>

      <ContactShadows position={[0, 0.04, 0]} scale={80} opacity={0.28} blur={2.8} far={24} />
      <MagicAtmosphere activeIds={activeIds} />
      {suppressFullPostprocessing ? null : (
        <EffectComposer enableNormalPass={false} multisampling={4}>
          <N8AO aoRadius={3.2} intensity={1.65} distanceFalloff={1.35} />
          <Bloom mipmapBlur intensity={0.55} luminanceThreshold={0.82} luminanceSmoothing={0.25} radius={0.75} />
          {materialQaShot || biomeQaShot ? <></> : <DepthOfField focusDistance={0.028} focalLength={0.018} bokehScale={1.25} height={480} />}
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette eskil={false} offset={materialQaShot || biomeQaShot ? 0.06 : 0.2} darkness={materialQaShot || biomeQaShot ? 0.16 : 0.48} />
        </EffectComposer>
      )}
      <AdaptiveDpr pixelated={false} />
      <SceneDiagnostics />
      <Preload all />
    </>
  );
}

function SceneLoading(): React.ReactElement {
  return (
    <Html center className="r3f-loading">
      加载高精度场景
    </Html>
  );
}

function WorldIblEnvironment({ materialQaShot }: { readonly materialQaShot: boolean }): null {
  const { scene } = useThree();
  const texture = useLoader(HDRLoader, worldHdriUrl);

  useLayoutEffect(() => {
    const sceneWithIntensity = scene as THREE.Scene & {
      backgroundBlurriness?: number;
      backgroundIntensity?: number;
      environmentIntensity?: number;
    };
    const previousBackground = scene.background;
    const previousBackgroundIntensity = sceneWithIntensity.backgroundIntensity;
    const previousBackgroundBlurriness = sceneWithIntensity.backgroundBlurriness;
    const previousEnvironment = scene.environment;
    const previousIntensity = sceneWithIntensity.environmentIntensity;
    const intensity = materialQaShot ? 1.35 : 1.05;
    const backgroundIntensity = materialQaShot ? 0.34 : 0.22;
    const backgroundBlurriness = materialQaShot ? 0.36 : 0.58;

    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.needsUpdate = true;
    scene.background = texture;
    scene.environment = texture;
    sceneWithIntensity.backgroundIntensity = backgroundIntensity;
    sceneWithIntensity.backgroundBlurriness = backgroundBlurriness;
    sceneWithIntensity.environmentIntensity = intensity;
    window.__r3fEnvironmentState = {
      url: worldHdriUrl,
      width: texture.image?.width ?? 0,
      height: texture.image?.height ?? 0,
      intensity,
      background: 'hdri',
      backgroundIntensity,
      backgroundBlurriness,
    };

    return () => {
      if (scene.background === texture) scene.background = previousBackground;
      if (scene.environment === texture) scene.environment = previousEnvironment;
      sceneWithIntensity.backgroundIntensity = previousBackgroundIntensity;
      sceneWithIntensity.backgroundBlurriness = previousBackgroundBlurriness;
      sceneWithIntensity.environmentIntensity = previousIntensity;
    };
  }, [materialQaShot, scene, texture]);

  return null;
}

function WorldBackdropLayer({
  activeChunks,
  materialQaShot,
}: {
  readonly activeChunks: readonly WorldChunkDefinition[];
  readonly materialQaShot: boolean;
}): React.ReactElement {
  const horizonPieces = useMemo(() => createDistantHorizonPieces(), []);
  const mistPanels = useMemo(() => createHorizonMistPanels(), []);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      worldBackdrop: `sky:1,horizon:${horizonPieces.length},mist:${mistPanels.length},chunks:${activeChunks.length}`,
    };
  }, [activeChunks.length, horizonPieces.length, mistPanels.length]);

  return (
    <group name="runtime-world-backdrop-layer">
      <AtmosphereSkyDome materialQaShot={materialQaShot} />
      <HorizonMistLayer panels={mistPanels} />
      <DistantHorizonLayer pieces={horizonPieces} />
    </group>
  );
}

function AtmosphereSkyDome({ materialQaShot }: { readonly materialQaShot: boolean }): React.ReactElement {
  const material = useMemo(() => new THREE.ShaderMaterial({
    name: 'runtime-atmosphere-sky-dome-material',
    uniforms: {
      topColor: { value: new THREE.Color(materialQaShot ? 0x27334a : 0x10182d) },
      horizonColor: { value: new THREE.Color(materialQaShot ? 0x9aa6b9 : 0x687688) },
      lowerColor: { value: new THREE.Color(materialQaShot ? 0x6a6d72 : 0x2f3540) },
      glowColor: { value: new THREE.Color(0x9ad3ff) },
      glowStrength: { value: materialQaShot ? 0.08 : 0.16 },
    },
    vertexShader: `
      varying vec3 vWorldDirection;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldDirection = normalize(worldPosition.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 lowerColor;
      uniform vec3 glowColor;
      uniform float glowStrength;
      varying vec3 vWorldDirection;
      void main() {
        float height = clamp(vWorldDirection.y * 0.5 + 0.5, 0.0, 1.0);
        float skyBlend = smoothstep(0.26, 1.0, height);
        float lowerBlend = smoothstep(0.02, 0.36, height);
        vec3 color = mix(horizonColor, topColor, skyBlend);
        color = mix(lowerColor, color, lowerBlend);
        float horizonBand = 1.0 - smoothstep(0.22, 0.5, height);
        color += glowColor * horizonBand * glowStrength;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  }), [materialQaShot]);

  return (
    <mesh name="runtime-atmosphere-sky-dome" material={material} renderOrder={-1000}>
      <sphereGeometry args={[148, 48, 24]} />
    </mesh>
  );
}

interface HorizonPanelInstance {
  readonly key: string;
  readonly position: ThreeVec3Tuple;
  readonly rotation: ThreeVec3Tuple;
  readonly scale: ThreeVec3Tuple;
  readonly color: number;
}

function HorizonMistLayer({ panels }: { readonly panels: readonly HorizonPanelInstance[] }): React.ReactElement {
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    name: 'runtime-horizon-mist-panel-material',
    color: 0x9fb6c8,
    transparent: true,
    opacity: 0.095,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: false,
  }), []);

  return (
    <Instances name="instanced-horizon-mist-panels" limit={panels.length} range={panels.length} material={material} renderOrder={-90}>
      <planeGeometry args={[1, 1, 1, 1]} />
      {panels.map((panel) => (
        <Instance
          key={panel.key}
          position={panel.position}
          rotation={panel.rotation}
          scale={panel.scale}
          color={panel.color}
        />
      ))}
    </Instances>
  );
}

type HorizonPieceKind = 'wall' | 'tower' | 'spire' | 'mountain';

interface HorizonPieceInstance extends HorizonPanelInstance {
  readonly kind: HorizonPieceKind;
}

function DistantHorizonLayer({ pieces }: { readonly pieces: readonly HorizonPieceInstance[] }): React.ReactElement {
  const grouped = useMemo(() => {
    const groups = new Map<HorizonPieceKind, HorizonPieceInstance[]>();
    for (const piece of pieces) {
      const current = groups.get(piece.kind);
      if (current) current.push(piece);
      else groups.set(piece.kind, [piece]);
    }
    return [...groups.entries()].map(([kind, items]) => ({ kind, items }));
  }, [pieces]);

  return (
    <group name="runtime-distant-horizon-silhouette-layer">
      {grouped.map((group) => (
        <DistantHorizonGroup key={group.kind} kind={group.kind} items={group.items} />
      ))}
    </group>
  );
}

function DistantHorizonGroup({
  kind,
  items,
}: {
  readonly kind: HorizonPieceKind;
  readonly items: readonly HorizonPieceInstance[];
}): React.ReactElement {
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    name: `runtime-distant-horizon-${kind}-material`,
    color: 0xffffff,
    roughness: kind === 'spire' ? 0.44 : 0.82,
    metalness: kind === 'spire' ? 0.12 : 0.02,
    transparent: true,
    opacity: kind === 'mountain' ? 0.36 : 0.5,
    depthWrite: false,
    envMapIntensity: kind === 'spire' ? 0.28 : 0.08,
    fog: true,
  }), [kind]);

  return (
    <Instances name={`instanced-distant-horizon:${kind}`} limit={items.length} range={items.length} material={material} renderOrder={-80}>
      <HorizonPieceGeometry kind={kind} />
      {items.map((item) => (
        <Instance
          key={item.key}
          position={item.position}
          rotation={item.rotation}
          scale={item.scale}
          color={item.color}
        />
      ))}
    </Instances>
  );
}

function HorizonPieceGeometry({ kind }: { readonly kind: HorizonPieceKind }): React.ReactElement {
  if (kind === 'tower') return <cylinderGeometry args={[0.5, 0.6, 1, 10]} />;
  if (kind === 'spire') return <coneGeometry args={[0.55, 1, 8]} />;
  if (kind === 'mountain') return <coneGeometry args={[0.7, 1, 3]} />;
  return <boxGeometry args={[1, 1, 1]} />;
}

function createHorizonMistPanels(): HorizonPanelInstance[] {
  const panels: HorizonPanelInstance[] = [];
  const radius = 58;
  for (let i = 0; i < 18; i += 1) {
    const angle = (i / 18) * Math.PI * 2;
    panels.push({
      key: `mist:${i}`,
      position: [Math.cos(angle) * radius, 2.4 + seededNoise('horizon-mist', i) * 0.8, Math.sin(angle) * radius],
      rotation: [0, Math.PI / 2 - angle, 0],
      scale: [15.5, 5.2 + seededNoise('horizon-mist', i + 100) * 2.4, 1],
      color: i % 3 === 0 ? 0xacc8dc : i % 3 === 1 ? 0x90a5bd : 0x7898b2,
    });
  }
  return panels;
}

function createDistantHorizonPieces(): HorizonPieceInstance[] {
  const pieces: HorizonPieceInstance[] = [];
  const wallRadius = 50;
  const mountainRadius = 76;

  for (let i = 0; i < 28; i += 1) {
    const angle = (i / 28) * Math.PI * 2;
    const height = 0.95 + seededNoise('horizon-wall', i) * 1.1;
    pieces.push({
      key: `wall:${i}`,
      kind: 'wall',
      position: [Math.cos(angle) * wallRadius, height * 0.5 - 0.05, Math.sin(angle) * wallRadius],
      rotation: [0, Math.PI / 2 - angle, 0],
      scale: [4.8 + seededNoise('horizon-wall', i + 50) * 2.6, height, 0.22],
      color: i % 2 === 0 ? 0x485062 : 0x3d4657,
    });
  }

  for (let i = 0; i < 14; i += 1) {
    const angle = (i / 14) * Math.PI * 2 + seededSigned('horizon-tower', i) * 0.08;
    const height = 2.6 + seededNoise('horizon-tower', i + 11) * 2.3;
    pieces.push({
      key: `tower:${i}`,
      kind: 'tower',
      position: [Math.cos(angle) * (wallRadius + 2.2), height * 0.5, Math.sin(angle) * (wallRadius + 2.2)],
      rotation: [0, angle, 0],
      scale: [0.75 + seededNoise('horizon-tower', i + 22) * 0.52, height, 0.75 + seededNoise('horizon-tower', i + 33) * 0.52],
      color: i % 2 === 0 ? 0x566175 : 0x3d4d66,
    });
    pieces.push({
      key: `spire:${i}`,
      kind: 'spire',
      position: [Math.cos(angle) * (wallRadius + 2.2), height + 0.54, Math.sin(angle) * (wallRadius + 2.2)],
      rotation: [0, angle, 0],
      scale: [0.7, 1.08 + seededNoise('horizon-spire', i) * 0.8, 0.7],
      color: i % 3 === 0 ? 0x9c8352 : 0x66778e,
    });
  }

  for (let i = 0; i < 18; i += 1) {
    const angle = (i / 18) * Math.PI * 2 + 0.08;
    const height = 3.5 + seededNoise('horizon-mountain', i + 20) * 3.4;
    pieces.push({
      key: `mountain:${i}`,
      kind: 'mountain',
      position: [Math.cos(angle) * mountainRadius, height * 0.42 - 0.35, Math.sin(angle) * mountainRadius],
      rotation: [0, Math.PI / 2 - angle + seededSigned('horizon-mountain', i) * 0.12, 0],
      scale: [5.6 + seededNoise('horizon-mountain', i + 60) * 5.4, height, 2.2],
      color: i % 2 === 0 ? 0x273645 : 0x324252,
    });
  }

  return pieces;
}

interface BeaconOrbitInstance {
  readonly key: string;
  readonly position: ThreeVec3Tuple;
  readonly rotation: ThreeVec3Tuple;
  readonly scale: ThreeVec3Tuple;
  readonly color: number;
}

function ArcaneBeacon(): React.ReactElement {
  const ringOrbit = useRef<THREE.Group>(null);
  const counterOrbit = useRef<THREE.Group>(null);
  const runeOrbit = useRef<THREE.Group>(null);
  const facets = useMemo(() => createArcaneBeaconFacets(), []);
  const runes = useMemo(() => createArcaneBeaconRunes(), []);
  const coreMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    name: 'arcane-beacon-crystal-core-material',
    color: 0x9efaff,
    emissive: 0x52e8ff,
    emissiveIntensity: 0.78,
    roughness: 0.18,
    metalness: 0,
    envMapIntensity: 1.24,
  }), []);
  const innerShellMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    name: 'arcane-beacon-inner-glass-shell-material',
    color: 0xb9fbff,
    transparent: true,
    opacity: 0.13,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), []);
  const ringMaterial = useMemo(() => createPbrMaterial(
    'arcane-beacon-aged-gold-ring-pbr',
    createFilePbrSet('metal'),
    { color: 0xd4a95f, roughness: 0.36, metalness: 0.62, envMapIntensity: 1.45, normalScale: 0.16 },
  ), []);
  const facetMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    name: 'arcane-beacon-orbit-facet-material',
    color: 0xffffff,
    emissive: 0x2fcfff,
    emissiveIntensity: 0.45,
    roughness: 0.18,
    metalness: 0.04,
    envMapIntensity: 1.1,
    vertexColors: true,
  }), []);
  const runeMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    name: 'arcane-beacon-orbit-rune-material',
    color: 0xffffff,
    transparent: true,
    opacity: 0.74,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexColors: true,
  }), []);
  const causticMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    name: 'arcane-beacon-floor-caustic-material',
    color: 0x7deeff,
    transparent: true,
    opacity: 0.082,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), []);
  const warmGlowMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    name: 'arcane-beacon-warm-ring-glow-material',
    color: 0xffdd8a,
    transparent: true,
    opacity: 0.2,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), []);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      arcaneBeaconDetails: String(facets.length + runes.length + 9),
    };
  }, [facets.length, runes.length]);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    if (ringOrbit.current) {
      ringOrbit.current.rotation.y = time * 0.22;
      ringOrbit.current.rotation.z = Math.sin(time * 0.27) * 0.08;
    }
    if (counterOrbit.current) {
      counterOrbit.current.rotation.y = -time * 0.34;
      counterOrbit.current.rotation.x = Math.sin(time * 0.18) * 0.12;
    }
    if (runeOrbit.current) {
      runeOrbit.current.rotation.y = time * 0.5;
      runeOrbit.current.rotation.z = -time * 0.12;
    }
    causticMaterial.opacity = 0.065 + Math.sin(time * 0.72) * 0.016;
    warmGlowMaterial.opacity = 0.16 + Math.sin(time * 0.46) * 0.035;
    coreMaterial.emissiveIntensity = 0.72 + Math.sin(time * 1.08) * 0.12;
  });

  return (
    <group name="arcane-beacon" position={[0, 2.05, 4.2]}>
      <Float speed={0.82} rotationIntensity={0.18} floatIntensity={0.12}>
        <mesh name="arcane-beacon-core" material={coreMaterial} castShadow renderOrder={20}>
          <icosahedronGeometry args={[0.58, 4]} />
        </mesh>
        <mesh name="arcane-beacon-inner-glass-shell" material={innerShellMaterial} renderOrder={21}>
          <sphereGeometry args={[0.76, 48, 24]} />
        </mesh>
        <group ref={ringOrbit} name="arcane-beacon-astrolabe-rings">
          <mesh name="arcane-beacon-primary-ecliptic-ring" rotation={[Math.PI / 2, 0, 0]} material={ringMaterial} castShadow renderOrder={22}>
            <torusGeometry args={[1.12, 0.034, 14, 96]} />
          </mesh>
          <mesh name="arcane-beacon-inclined-meridian-ring" rotation={[0.68, 0.16, 0.38]} material={ringMaterial} castShadow renderOrder={22}>
            <torusGeometry args={[0.98, 0.022, 12, 80]} />
          </mesh>
          <mesh name="arcane-beacon-counter-meridian-ring" rotation={[1.1, -0.36, -0.7]} material={ringMaterial} castShadow renderOrder={22}>
            <torusGeometry args={[0.78, 0.018, 10, 72]} />
          </mesh>
        </group>
        <mesh name="arcane-beacon-warm-halo-glow" rotation={[Math.PI / 2, 0, 0]} material={warmGlowMaterial} renderOrder={23}>
          <torusGeometry args={[1.34, 0.026, 8, 96]} />
        </mesh>
        <group ref={counterOrbit} name="arcane-beacon-orbiting-facets">
          <Instances name="instanced-arcane-beacon-orbit-facets" limit={facets.length} range={facets.length} material={facetMaterial} renderOrder={24}>
            <octahedronGeometry args={[1, 0]} />
            {facets.map((facet) => (
              <Instance
                key={facet.key}
                position={facet.position}
                rotation={facet.rotation}
                scale={facet.scale}
                color={facet.color}
              />
            ))}
          </Instances>
        </group>
        <group ref={runeOrbit} name="arcane-beacon-orbiting-runes">
          <Instances name="instanced-arcane-beacon-rune-slivers" limit={runes.length} range={runes.length} material={runeMaterial} renderOrder={25}>
            <boxGeometry args={[1, 1, 1]} />
            {runes.map((rune) => (
              <Instance
                key={rune.key}
                position={rune.position}
                rotation={rune.rotation}
                scale={rune.scale}
                color={rune.color}
              />
            ))}
          </Instances>
        </group>
        <Sparkles count={34} speed={0.28} opacity={0.38} color="#c9fbff" size={0.68} scale={[2.4, 1.8, 2.4]} />
      </Float>
      <mesh name="arcane-beacon-floor-caustic-pool" position={[0, -1.86, 0]} rotation={[-Math.PI / 2, 0, 0]} material={causticMaterial} renderOrder={4}>
        <ringGeometry args={[0.92, 2.65, 96]} />
      </mesh>
      <pointLight name="arcane-beacon-cool-core-light" color="#7df7ff" intensity={5.8} distance={6.0} decay={2.2} />
      <pointLight name="arcane-beacon-warm-rim-light" position={[0.9, -0.15, 0.35]} color="#ffd98c" intensity={1.8} distance={5.0} decay={2.3} />
    </group>
  );
}

function createArcaneBeaconFacets(): BeaconOrbitInstance[] {
  return Array.from({ length: 30 }, (_, index) => {
    const angle = (index / 30) * Math.PI * 2;
    const radius = 1.18 + seededNoise('arcane-beacon-facet', index) * 0.34;
    const height = seededSigned('arcane-beacon-facet', index + 100) * 0.42;
    return {
      key: `arcane-beacon-facet:${index}`,
      position: [
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius,
      ],
      rotation: [
        seededNoise('arcane-beacon-facet', index + 200) * Math.PI,
        -angle + Math.PI / 2,
        seededSigned('arcane-beacon-facet', index + 300) * Math.PI,
      ],
      scale: [
        0.045 + seededNoise('arcane-beacon-facet', index + 400) * 0.035,
        0.13 + seededNoise('arcane-beacon-facet', index + 500) * 0.09,
        0.045 + seededNoise('arcane-beacon-facet', index + 600) * 0.035,
      ],
      color: index % 3 === 0 ? 0xc7fdff : index % 3 === 1 ? 0x8ae9ff : 0xffdd91,
    };
  });
}

function createArcaneBeaconRunes(): BeaconOrbitInstance[] {
  return Array.from({ length: 42 }, (_, index) => {
    const angle = (index / 42) * Math.PI * 2;
    const radius = 1.42 + seededSigned('arcane-beacon-rune', index) * 0.08;
    return {
      key: `arcane-beacon-rune:${index}`,
      position: [
        Math.cos(angle) * radius,
        seededSigned('arcane-beacon-rune', index + 100) * 0.18,
        Math.sin(angle) * radius,
      ],
      rotation: [
        0,
        -angle + Math.PI / 2,
        seededSigned('arcane-beacon-rune', index + 200) * 0.28,
      ],
      scale: [
        0.018,
        0.14 + seededNoise('arcane-beacon-rune', index + 300) * 0.12,
        0.006,
      ],
      color: index % 4 === 0 ? 0xffe6a5 : 0x9efaff,
    };
  });
}

function FixedOpeningCamera(): null {
  const { camera } = useThree();
  const materialQaShot = shouldUseMaterialQaShot();
  const biomeQaShot = shouldUseBiomeQaShot();
  const libraryQaShot = shouldUseLibraryQaShot();
  const biomeTarget = useMemo(() => new THREE.Vector3(-15.7, 0.9, 21.2), []);
  const libraryTarget = useMemo(() => new THREE.Vector3(6.15, 1.08, -3.95), []);

  useLayoutEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = materialQaShot ? 38 : libraryQaShot ? 39 : biomeQaShot ? 42 : 44;
      camera.updateProjectionMatrix();
    }
    if (libraryQaShot) camera.position.set(10.6, 4.15, 3.1);
    else if (biomeQaShot) camera.position.set(-2, 4.95, 24.6);
    else camera.position.set(6.8, 4.95, 10.6);
    camera.up.set(0, 1, 0);
    camera.lookAt(libraryQaShot
      ? libraryTarget
      : biomeQaShot
        ? biomeTarget
        : materialQaShot
          ? new THREE.Vector3(0.1, 0.82, 3.45)
          : new THREE.Vector3(0.1, 0.86, 3.45));
    camera.updateMatrixWorld();
  }, [biomeQaShot, biomeTarget, camera, libraryQaShot, libraryTarget, materialQaShot]);

  useFrame(() => {
    if (!biomeQaShot && !libraryQaShot) return;
    if (libraryQaShot) camera.position.set(10.6, 4.15, 3.1);
    else camera.position.set(-2, 4.95, 24.6);
    camera.up.set(0, 1, 0);
    camera.lookAt(libraryQaShot ? libraryTarget : biomeTarget);
    camera.updateMatrixWorld();
  });

  return null;
}

function MaterialInspectionLighting(): React.ReactElement {
  return (
    <group name="material-inspection-lighting">
      <spotLight
        name="material-inspection-grazing-key"
        position={[2.8, 2.6, 4.4]}
        color="#dff4ff"
        intensity={34}
        distance={8}
        angle={0.46}
        penumbra={0.72}
        decay={2.1}
      />
      <pointLight name="material-inspection-warm-rim" position={[-1.6, 1.2, 3.1]} color="#ffd38a" intensity={3.8} distance={5.5} decay={2.2} />
    </group>
  );
}

function SceneDiagnostics(): null {
  const { scene, camera } = useThree();

  const publish = useCallback(() => {
    let meshCount = 0;
    const namedObjects: string[] = [];
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) meshCount += 1;
      if (object.name) namedObjects.push(object.name);
    });
    window.__r3fSceneDiagnostics = {
      meshCount,
      namedObjects: namedObjects.slice(0, 80),
      camera: [camera.position.x, camera.position.y, camera.position.z],
    };
  }, [camera, scene]);

  useEffect(() => {
    publish();
    const interval = window.setInterval(publish, r3fSceneDiagnosticsIntervalMs);
    return () => window.clearInterval(interval);
  }, [publish]);

  return null;
}

interface EcctrlPlayerProps {
  readonly onFrame: (position: THREE.Vector3) => void;
}

function EcctrlPlayer({ onFrame }: EcctrlPlayerProps): React.ReactElement {
  const controller = useRef<EcctrlHandle>(null);
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const cameraGoal = useMemo(() => new THREE.Vector3(), []);
  const frameCount = useRef(0);
  const biomeQaShot = shouldUseBiomeQaShot();
  const spawn = useMemo(() => (biomeQaShot ? new THREE.Vector3(-8.8, 1.25, 18.2) : playerSpawn.clone()), [biomeQaShot]);

  useFrame((_, delta) => {
    const handle = controller.current;
    if (!handle) return;
    const position = handle.currPos ?? zeroVec;

    if (position.y < -2) {
      handle.body.setTranslation(spawn, true);
      handle.body.setLinvel(zeroVec, true);
      handle.body.setAngvel(zeroVec, true);
      camera.position.set(spawn.x + 6.8, spawn.y + 3.7, spawn.z + 6.4);
      camera.lookAt(spawn.x + 0.1, spawn.y - 0.38, spawn.z - 0.75);
      onFrame(spawn);
      return;
    }

    const safeY = Math.max(position.y, 0.75);
    if (biomeQaShot) {
      target.set(-15.7, 0.9, 21.2);
      cameraGoal.set(-4.6, 5.2, 30.4);
    } else {
      target.set(position.x + 0.1, safeY - 0.38, position.z - 0.75);
      cameraGoal.set(position.x + 6.8, safeY + 3.7, position.z + 6.4);
    }
    camera.position.lerp(cameraGoal, 1 - Math.exp(-delta * 5.5));
    camera.lookAt(target);

    frameCount.current += 1;
    if (frameCount.current % 8 === 0) onFrame(position);
  });

  return (
    <Ecctrl
      ref={controller}
      position={[spawn.x, spawn.y, spawn.z]}
      capsuleHalfHeight={0.58}
      capsuleRadius={0.32}
      floatHeight={0.42}
      maxWalkVel={4.4}
      maxRunVel={7.2}
      jumpVel={4.2}
      slopeMaxAngle={0.78}
      followPlatform
      autoBalance
      enabledRotations={[false, true, false]}
      colliders={false}
    >
      <PlayerAvatar />
    </Ecctrl>
  );
}

function PlayerAvatar(): React.ReactElement {
  const model = useOptionalGlb('/assets/models/player.glb');
  if (model) {
    return (
      <primitive
        object={model}
        position={[0, -0.6, 0]}
        rotation={[0, Math.PI, 0]}
        scale={0.82}
      />
    );
  }

  return (
    <group position={[0, -0.55, 0]}>
      <mesh castShadow>
        <capsuleGeometry args={[0.28, 0.82, 8, 16]} />
        <meshStandardMaterial color={0xb990ff} roughness={0.54} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow>
        <sphereGeometry args={[0.25, 24, 16]} />
        <meshStandardMaterial color={0xf0d2bf} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.15, -0.08]} castShadow>
        <coneGeometry args={[0.42, 1.05, 4]} />
        <meshStandardMaterial color={0x6040a0} roughness={0.66} metalness={0.02} />
      </mesh>
    </group>
  );
}

interface StreamingWorldProps {
  readonly activeChunks: readonly WorldChunkDefinition[];
  readonly activeIds: ReadonlySet<WorldChunkId>;
  readonly playerPosition: THREE.Vector3;
}

function StreamingWorld({ activeChunks, activeIds, playerPosition }: StreamingWorldProps): React.ReactElement {
  const activeChunkKey = activeChunks.map((chunk) => chunk.id).join('|');
  const initialChunkCount = getInitialAuthoredChunkCount(activeChunks);
  const authoredStreamStepMs = getAuthoredChunkStreamStepMs(activeChunks);
  const [authoredChunkIds, setAuthoredChunkIds] = useState<ReadonlySet<WorldChunkId>>(() => (
    new Set(activeChunks.slice(0, Math.min(initialChunkCount, maxAuthoredChunkCount)).map((chunk) => chunk.id))
  ));

  useEffect(() => {
    let cancelled = false;
    const initialIds = activeChunks
      .slice(0, Math.min(initialChunkCount, maxAuthoredChunkCount))
      .map((chunk) => chunk.id);
    setAuthoredChunkIds(new Set(initialIds));

    const timers = activeChunks.slice(initialIds.length, maxAuthoredChunkCount).map((chunk, index) => (
      window.setTimeout(() => {
        if (cancelled) return;
        setAuthoredChunkIds((current) => new Set([...current, chunk.id]));
      }, (index + 1) * authoredStreamStepMs)
    ));

    return () => {
      cancelled = true;
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [activeChunkKey, authoredStreamStepMs, initialChunkCount]);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      active: activeChunks.map((chunk) => chunk.id).join(','),
      authoredEnabled: [...authoredChunkIds].join(','),
    };
  }, [activeChunkKey, authoredChunkIds, activeChunks]);

  return (
    <group name="r3f-streaming-world">
      <BaseTerrain />
      <RunicFloorOverlay />
      {activeChunks.map((chunk) => (
        <ChunkLayer key={chunk.id} chunk={chunk} authoredEnabled={authoredChunkIds.has(chunk.id)} />
      ))}
      {shouldRenderLegacyPrefabPack() ? <PrefabPackLayer activeChunks={activeChunks} /> : null}
      <ThirdPartyAssetLayer activeIds={activeIds} playerPosition={playerPosition} />
      <VegetationLayer activeIds={activeIds} />
      <LibraryHeroLayer activeIds={activeIds} />
      <BiomeHeroLayer activeIds={activeIds} />
      <DecalLayer activeIds={activeIds} />
      <MacroSurfaceDecalLayer activeChunks={activeChunks} />
      <MaterialWeatheringLayer activeChunks={activeChunks} />
      <ContactPatinaLayer activeChunks={activeChunks} />
      <RaisedInlayLayer activeChunks={activeChunks} />
      <TileReliefLayer activeChunks={activeChunks} />
      <MicroSurfaceDetailLayer activeChunks={activeChunks} />
      <ReflectiveSurfaceLayer activeChunks={activeChunks} />
      <BakedLightVolumeLayer activeChunks={activeChunks} />
      <LivingSurfaceMotionLayer activeChunks={activeChunks} />
      <VerticalSurfaceDetailLayer activeChunks={activeChunks} />
      <ArchitecturalWearLayer activeChunks={activeChunks} />
      <ArchitecturalDepthLayer activeChunks={activeChunks} />
      <HeroArchitecture activeIds={activeIds} />
      <SceneStoryLayer activeChunks={activeChunks} />
      <VolumetricLightShaftLayer activeChunks={activeChunks} />
      <AmbientLifeLayer activeChunks={activeChunks} />
      <ChunkLightingLayer activeChunks={activeChunks} />
    </group>
  );
}

function getInitialAuthoredChunkCount(activeChunks: readonly WorldChunkDefinition[]): number {
  return activeChunks[0]?.id === 'arcane-library' ? 1 : initialAuthoredChunkCount;
}

function getAuthoredChunkStreamStepMs(activeChunks: readonly WorldChunkDefinition[]): number {
  return activeChunks[0]?.id === 'arcane-library' ? 1800 : authoredChunkStreamStepMs;
}

function BaseTerrain(): React.ReactElement {
  const material = useMemo(() => createPbrMaterial(
    'moonlit academy terrain',
    createGroundPbrSet('academy-terrain', '#31485b', '#547363', '#93a06f'),
    { color: 0xb8c58e, roughness: 0.86, envMapIntensity: 0.72, normalScale: 0.32 },
  ), []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={material}>
      <planeGeometry args={[92, 88, 64, 64]} />
    </mesh>
  );
}

function RunicFloorOverlay(): React.ReactElement {
  const ringMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0x7edfff,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), []);
  const tileMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0x263c58,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
  }), []);

  return (
    <group name="runic-floor-visibility-layer">
      <mesh position={[0, 0.092, 4.2]} rotation={[-Math.PI / 2, 0, 0]} material={tileMaterial} receiveShadow>
        <circleGeometry args={[8.4, 96]} />
      </mesh>
      {[2.4, 4.8, 7.2].map((radius) => (
        <mesh key={radius} position={[0, 0.105 + radius * 0.001, 4.2]} rotation={[-Math.PI / 2, 0, 0]} material={ringMaterial}>
          <ringGeometry args={[radius, radius + 0.035, 96]} />
        </mesh>
      ))}
      <gridHelper args={[24, 24, 0x9de2ff, 0x31475f]} position={[0, 0.11, 4.2]} />
    </group>
  );
}

function ChunkLayer({
  chunk,
  authoredEnabled,
}: {
  readonly chunk: WorldChunkDefinition;
  readonly authoredEnabled: boolean;
}): React.ReactElement {
  const glbScene = useOptionalGlb(
    shouldProbeAuthoredChunks() && authoredEnabled ? chunk.glb : null,
    true,
    chunk.lightmap,
    getChunkGlbLoadPriority(chunk.id),
  );
  const material = useChunkFallbackMaterial(chunk);

  useEffect(() => {
    if (glbScene) applyChunkCutaway(glbScene, chunk);
  }, [chunk, glbScene]);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      [chunk.id]: glbScene ? 'authored' : authoredEnabled ? 'loading-authored' : 'fallback',
    };
  }, [authoredEnabled, chunk.id, glbScene]);

  if (glbScene) {
    return (
      <group name={`authored-chunk:${chunk.id}`}>
        <primitive object={glbScene} />
      </group>
    );
  }

  const width = chunk.bounds.maxX - chunk.bounds.minX;
  const depth = chunk.bounds.maxZ - chunk.bounds.minZ;
  const centerX = (chunk.bounds.minX + chunk.bounds.maxX) / 2;
  const centerZ = (chunk.bounds.minZ + chunk.bounds.maxZ) / 2;

  return (
    <group name={`fallback-chunk:${chunk.id}`}>
      <mesh position={[centerX, 0.07, centerZ]} receiveShadow material={material.floor}>
        <boxGeometry args={[width, 0.14, depth]} />
      </mesh>
      {chunk.region !== 'exterior' ? (
        <InteriorEnvelope chunk={chunk} material={material.wall} />
      ) : (
        <ExteriorLandmark chunk={chunk} />
      )}
      <PointHeroLight chunk={chunk} />
    </group>
  );
}

function useChunkFallbackMaterial(chunk: WorldChunkDefinition): { floor: THREE.Material; wall: THREE.Material } {
  return useMemo(() => {
    const floor = createPbrMaterial(
      `${chunk.id} floor pbr`,
      createStonePbrSet(`${chunk.id}-floor`, '#6d6577', '#92869c', '#d2b66f'),
      { color: chunk.palette.floor, roughness: 0.76, metalness: 0.04, normalScale: 0.5 },
    );
    const wall = createPbrMaterial(
      `${chunk.id} wall pbr`,
      createStonePbrSet(`${chunk.id}-wall`, '#76677f', '#a492aa', '#c4a061'),
      { color: chunk.palette.wall, roughness: 0.68, metalness: 0.02, normalScale: 0.42 },
    );
    return { floor, wall };
  }, [chunk]);
}

function InteriorEnvelope({
  chunk,
  material,
}: {
  readonly chunk: WorldChunkDefinition;
  readonly material: THREE.Material;
}): React.ReactElement {
  const width = chunk.bounds.maxX - chunk.bounds.minX;
  const depth = chunk.bounds.maxZ - chunk.bounds.minZ;
  const centerX = (chunk.bounds.minX + chunk.bounds.maxX) / 2;
  const centerZ = (chunk.bounds.minZ + chunk.bounds.maxZ) / 2;
  const accentMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: chunk.palette.accent,
    roughness: 0.34,
    metalness: 0.42,
    envMapIntensity: 1.2,
  }), [chunk.palette.accent]);

  return (
    <group>
      <mesh position={[centerX, 1.5, chunk.bounds.minZ - 0.12]} castShadow receiveShadow material={material}>
        <boxGeometry args={[width, 3, 0.24]} />
      </mesh>
      <mesh position={[centerX, 1.5, chunk.bounds.maxZ + 0.12]} castShadow receiveShadow material={material}>
        <boxGeometry args={[width, 3, 0.24]} />
      </mesh>
      <mesh position={[chunk.bounds.minX - 0.12, 1.5, centerZ]} castShadow receiveShadow material={material}>
        <boxGeometry args={[0.24, 3, depth]} />
      </mesh>
      <mesh position={[chunk.bounds.maxX + 0.12, 1.5, centerZ]} castShadow receiveShadow material={material}>
        <boxGeometry args={[0.24, 3, depth]} />
      </mesh>
      {[-0.38, 0, 0.38].map((offset) => (
        <mesh key={offset} position={[centerX, 0.11 + offset * 0.02, centerZ]} rotation={[-Math.PI / 2, 0, offset]} material={accentMat}>
          <torusGeometry args={[Math.max(1.1, Math.min(width, depth) * (0.12 + Math.abs(offset) * 0.08)), 0.025, 8, 96]} />
        </mesh>
      ))}
    </group>
  );
}

function ExteriorLandmark({ chunk }: { readonly chunk: WorldChunkDefinition }): React.ReactElement {
  const centerX = (chunk.bounds.minX + chunk.bounds.maxX) / 2;
  const centerZ = (chunk.bounds.minZ + chunk.bounds.maxZ) / 2;
  const crystalMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: chunk.palette.emissive,
    emissive: chunk.palette.emissive,
    emissiveIntensity: 0.18,
    roughness: 0.12,
    metalness: 0.0,
    transmission: 0.38,
    thickness: 0.8,
    ior: 1.45,
    envMapIntensity: 1.5,
  }), [chunk.palette.emissive]);

  return (
    <group position={[centerX, 0, centerZ]}>
      <Detailed distances={[0, 18, 42]}>
        <group>
          {[-1.4, -0.4, 0.7, 1.55].map((x, i) => (
            <Float key={x} speed={0.8 + i * 0.08} rotationIntensity={0.18} floatIntensity={0.16}>
              <mesh position={[x, 0.8 + i * 0.25, Math.sin(i) * 1.2]} castShadow material={crystalMaterial}>
                <octahedronGeometry args={[0.8 - i * 0.08, 2]} />
              </mesh>
            </Float>
          ))}
        </group>
        <group>
          <mesh position={[0, 1.05, 0]} castShadow material={crystalMaterial}>
            <octahedronGeometry args={[1.4, 1]} />
          </mesh>
        </group>
        <group />
      </Detailed>
    </group>
  );
}

function PointHeroLight({ chunk }: { readonly chunk: WorldChunkDefinition }): React.ReactElement {
  return (
    <pointLight
      position={chunk.heroLight as [number, number, number]}
      color={chunk.palette.emissive}
      intensity={9}
      distance={10}
      decay={2}
    />
  );
}

function PrefabPackLayer({ activeChunks }: { readonly activeChunks: readonly WorldChunkDefinition[] }): React.ReactElement {
  const regions = useMemo(() => {
    const result = new Set<WorldRegionId>();
    for (const chunk of activeChunks) {
      if (chunk.fallbackPrefabRegion) result.add(chunk.fallbackPrefabRegion);
    }
    return result;
  }, [activeChunks]);
  const pack = useOptionalGlb('/assets/world/academy-prefabs.glb');
  const objects = useMemo(() => {
    if (!pack) return [];
    return WORLD_PREFAB_PLACEMENTS
      .filter((placement) => regions.has(placement.region))
      .map((placement) => {
        const source = pack.getObjectByName(placement.prefab);
        if (!source) return null;
        const clone = source.clone(true);
        clone.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
            if (object.material instanceof THREE.MeshStandardMaterial) {
              object.material.envMapIntensity = Math.max(object.material.envMapIntensity, 0.85);
              object.material.roughness = Math.min(0.84, object.material.roughness + 0.08);
            }
          }
        });
        return { placement, object: clone };
      })
      .filter((entry): entry is { placement: typeof WORLD_PREFAB_PLACEMENTS[number]; object: THREE.Object3D } => entry !== null);
  }, [pack, regions]);

  return (
    <group name="legacy-prefab-pack-enhanced">
      {objects.map(({ placement, object }, index) => (
        <primitive
          key={`${placement.region}-${placement.prefab}-${index}`}
          object={object}
          position={placement.position}
          rotation={[0, placement.rotationY ?? 0, 0]}
          scale={placement.scale ?? 1}
        />
      ))}
    </group>
  );
}

interface ThirdPartyWorldLodAnchor {
  readonly position: THREE.Vector3;
  readonly compactViewport: boolean;
}

function ThirdPartyAssetLayer({
  activeIds,
  playerPosition,
}: {
  readonly activeIds: ReadonlySet<WorldChunkId>;
  readonly playerPosition: THREE.Vector3;
}): React.ReactElement {
  const allGlbAssetsEnabled = shouldEnableAllThirdPartyGlbAssets();
  const defaultGlbAssetsDisabled = shouldDisableDefaultThirdPartyGlbAssets();
  const compactViewport = isCompactViewport();
  const lodKey = `${Math.round(playerPosition.x / 4)}:${Math.round(playerPosition.z / 4)}:${compactViewport ? 'mobile' : 'desktop'}`;
  const lodAnchor = useMemo<ThirdPartyWorldLodAnchor>(() => ({
    position: playerPosition.clone(),
    compactViewport,
  }), [lodKey]);
  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      thirdPartyGlbAssets: allGlbAssetsEnabled
        ? 'all-enabled:vendorGlb=1'
        : defaultGlbAssetsDisabled
          ? 'disabled:vendorGlb=0'
          : `default-enabled:sources:${defaultThirdPartyWorldGlbSourceIds.size},placements:${defaultThirdPartyWorldGlbPlacementIds.size}`,
    };
  }, [allGlbAssetsEnabled, defaultGlbAssetsDisabled]);

  const groups = useMemo(() => {
    const grouped = new Map<string, {
      source: ThirdPartyWorldAssetSource;
      placements: ThirdPartyWorldPropPlacement[];
    }>();

    for (const placement of thirdPartyWorldPlacements) {
      if (!activeIds.has(placement.chunkId)) continue;
      const source = thirdPartyWorldAssetSourcesById.get(placement.sourceId);
      if (!source) continue;
      if (!shouldEnableThirdPartyGlbPlacement(source.id, placement.id, allGlbAssetsEnabled, defaultGlbAssetsDisabled)) continue;
      if (!shouldLoadThirdPartyPlacement(source.id, placement, lodAnchor)) continue;
      const existing = grouped.get(source.id);
      if (existing) {
        existing.placements.push(placement);
      } else {
        grouped.set(source.id, { source, placements: [placement] });
      }
    }

    return [...grouped.values()];
  }, [activeIds, allGlbAssetsEnabled, defaultGlbAssetsDisabled, lodAnchor]);

  return (
    <group name="cc0-third-party-world-assets">
      {groups.map((group) => (
        <ThirdPartyAssetGroup
          key={group.source.id}
          source={group.source}
          placements={group.placements}
          lodAnchor={lodAnchor}
        />
      ))}
    </group>
  );
}

function ThirdPartyAssetGroup({
  source,
  placements,
  lodAnchor,
}: {
  readonly source: ThirdPartyWorldAssetSource;
  readonly placements: readonly ThirdPartyWorldPropPlacement[];
  readonly lodAnchor: ThirdPartyWorldLodAnchor;
}): React.ReactElement {
  const priority = useMemo(() => getThirdPartyGlbLoadPriority(source.id, placements), [placements, source.id]);
  const template = useOptionalGlb(source.url, false, undefined, priority);
  const objects = useMemo(() => {
    if (!template) return [];
    return placements
      .filter((placement) => shouldRenderThirdPartyPlacement(source.id, placement, lodAnchor))
      .map((placement) => {
        const object = template.clone(true);
        object.name = `cc0-prop:${placement.id}:${source.id}`;
        prepareThirdPartyPropObject(
          object,
          source,
          placement,
          shouldCastShadowForThirdPartyPlacement(source.id, placement, lodAnchor),
        );
        return { object, placement };
      });
  }, [lodAnchor, placements, source, template]);

  useEffect(() => {
    if (template) {
      const culledCount = placements.length - objects.length;
      const state = objects.length > 0
        ? `placed:${objects.length}${culledCount > 0 ? `,culled:${culledCount}` : ''}`
        : `culled:${culledCount}`;
      setAssetLoadState(source.url, state);
      window.__r3fChunkRenderState = {
        ...(window.__r3fChunkRenderState ?? {}),
        [`vendor:${source.id}`]: state,
      };
      return;
    }
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      [`vendor:${source.id}`]: 'loading-or-missing',
    };
  }, [objects.length, placements.length, source.id, source.url, template]);

  return (
    <group name={`cc0-asset-source:${source.collection}:${source.id}`}>
      {objects.map(({ object, placement }) => (
        <primitive
          key={placement.id}
          object={object}
          position={placement.position}
          rotation={placement.rotation}
          scale={placement.scale}
        />
      ))}
    </group>
  );
}

function shouldEnableAllThirdPartyGlbAssets(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('vendorGlb') === '1';
}

function shouldDisableDefaultThirdPartyGlbAssets(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('vendorGlb') === '0';
}

function shouldEnableThirdPartyGlbPlacement(
  sourceId: string,
  placementId: string,
  allGlbAssetsEnabled: boolean,
  defaultGlbAssetsDisabled: boolean,
): boolean {
  if (allGlbAssetsEnabled) return true;
  if (defaultGlbAssetsDisabled) return false;
  return defaultThirdPartyWorldGlbSourceIds.has(sourceId) || defaultThirdPartyWorldGlbPlacementIds.has(placementId);
}

function getChunkGlbLoadPriority(chunkId: WorldChunkId): GlbLoadPriority {
  return chunkId === 'lake-grotto' || chunkId === 'moonlit-lawn' || chunkId === 'arcane-library'
    ? 'critical'
    : 'normal';
}

function isCompactViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < 700;
}

function getThirdPartyLodConfig(sourceId: string): ThirdPartyWorldLodConfig {
  return {
    ...defaultThirdPartyWorldLod,
    ...(thirdPartyWorldRuntime.lod?.[sourceId] ?? {}),
  };
}

function getThirdPartyPlacementDistance(
  placement: ThirdPartyWorldPropPlacement,
  anchor: ThirdPartyWorldLodAnchor,
): number {
  const dx = placement.position[0] - anchor.position.x;
  const dz = placement.position[2] - anchor.position.z;
  return Math.hypot(dx, dz);
}

function shouldRenderThirdPartyPlacement(
  sourceId: string,
  placement: ThirdPartyWorldPropPlacement,
  anchor: ThirdPartyWorldLodAnchor,
): boolean {
  const lod = getThirdPartyLodConfig(sourceId);
  if (lod.importance === 'hero') return true;
  const fadeDistance = anchor.compactViewport && lod.mobileFadeDistance
    ? lod.mobileFadeDistance
    : lod.fadeDistance;
  return getThirdPartyPlacementDistance(placement, anchor) <= fadeDistance;
}

function shouldLoadThirdPartyPlacement(
  sourceId: string,
  placement: ThirdPartyWorldPropPlacement,
  anchor: ThirdPartyWorldLodAnchor,
): boolean {
  const lod = getThirdPartyLodConfig(sourceId);
  const configuredFadeDistance = anchor.compactViewport && lod.mobileFadeDistance
    ? lod.mobileFadeDistance
    : lod.fadeDistance;
  const priorityLoadDistance = lod.importance === 'hero'
    ? (anchor.compactViewport ? 28 : 36)
    : (anchor.compactViewport ? 18 : 26);
  return getThirdPartyPlacementDistance(placement, anchor) <= Math.min(configuredFadeDistance, priorityLoadDistance);
}

function shouldCastShadowForThirdPartyPlacement(
  sourceId: string,
  placement: ThirdPartyWorldPropPlacement,
  anchor: ThirdPartyWorldLodAnchor,
): boolean {
  const shadowDistance = getThirdPartyLodConfig(sourceId).shadowDistance ?? defaultThirdPartyWorldLod.shadowDistance ?? 0;
  return shadowDistance > 0 && getThirdPartyPlacementDistance(placement, anchor) <= shadowDistance;
}

function getThirdPartyGlbLoadPriority(
  sourceId: string,
  placements: readonly ThirdPartyWorldPropPlacement[],
): GlbLoadPriority {
  const lod = getThirdPartyLodConfig(sourceId);
  if (placements.some((placement) => (
    placement.chunkId === 'lake-grotto'
    || placement.chunkId === 'moonlit-lawn'
    || placement.chunkId === 'arcane-library'
  ))) {
    return lod.importance === 'detail' ? 'normal' : 'high';
  }
  return 'normal';
}

function prepareThirdPartyPropObject(
  root: THREE.Object3D,
  source: ThirdPartyWorldAssetSource,
  placement: ThirdPartyWorldPropPlacement,
  castShadow: boolean,
): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.name = object.name
      ? `cc0_${source.id}_${object.name}`
      : `cc0_${source.id}_mesh`;
    object.castShadow = castShadow;
    object.receiveShadow = true;
    ensureAoUv(object.geometry);
    const materialLabel = `${source.id} ${source.displayName} ${placement.id} ${object.name}`;

    if (Array.isArray(object.material)) {
      object.material = object.material.map((material) => normalizeThirdPartyMaterial(material, materialLabel, source.id));
    } else {
      object.material = normalizeThirdPartyMaterial(object.material, materialLabel, source.id);
    }
  });
}

function normalizeThirdPartyMaterial(
  material: THREE.Material,
  label: string,
  sourceId: string,
): THREE.Material {
  if (material instanceof THREE.MeshStandardMaterial) {
    return enhanceAuthoredWorldMaterial(material, label, undefined, `vendor:${sourceId}`);
  }
  if (material instanceof THREE.MeshBasicMaterial) {
    const standardMaterial = new THREE.MeshStandardMaterial({
      name: material.name,
      color: material.color,
      map: material.map,
      alphaMap: material.alphaMap,
      transparent: material.transparent,
      opacity: material.opacity,
      side: material.side,
      alphaTest: material.alphaTest,
      depthWrite: material.depthWrite,
      roughness: 0.72,
      metalness: 0.04,
    });
    return enhanceAuthoredWorldMaterial(standardMaterial, label, undefined, `vendor:${sourceId}`);
  }
  return material;
}

function VegetationLayer({ activeIds }: { readonly activeIds: ReadonlySet<WorldChunkId> }): React.ReactElement {
  const visibleScatters = VEGETATION_SCATTERS.filter((scatter) => activeIds.has(scatter.chunkId));
  return (
    <group name="instanced-vegetation">
      {visibleScatters.map((scatter) => (
        <VegetationScatterLayer key={scatter.id} scatter={scatter} />
      ))}
    </group>
  );
}

function VegetationScatterLayer({ scatter }: { readonly scatter: typeof VEGETATION_SCATTERS[number] }): React.ReactElement {
  const instances = useMemo(() => createScatterPoints(scatter.bounds, scatter.count, scatter.id), [scatter]);
  const textureId = getVegetationTextureId(scatter.id);
  const textures = useMemo(() => createWorldVegetationSet(textureId), [textureId]);
  const cardDimensions = getVegetationCardDimensions(textureId);
  const cardVariants = getVegetationCardVariants(textureId);
  const cards = useMemo(() => instances.flatMap((point, index) => cardVariants.map((variant, variantIndex) => {
    const offsetRotation = point.rotation + variant.rotationOffset;
    const cos = Math.cos(offsetRotation);
    const sin = Math.sin(offsetRotation);
    const x = point.x + variant.xOffset * cos - variant.zOffset * sin;
    const z = point.z + variant.xOffset * sin + variant.zOffset * cos;
    return {
      key: `${index}-${variantIndex}`,
      position: [x, 0.14 + variant.yOffset, z] as const,
      rotation: [0, offsetRotation, point.tilt + variant.tiltOffset] as const,
      scale: [
        point.scale * variant.widthScale,
        point.scale * scatter.baseScale * variant.heightScale,
        point.scale * variant.widthScale,
      ] as const,
      color: (index + variantIndex) % 3 === 0 ? scatter.colorB : scatter.colorA,
    };
  })), [cardVariants, instances, scatter.baseScale, scatter.colorA, scatter.colorB]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    name: `runtime-vegetation-material:${textureId}`,
    color: scatter.colorA,
    map: textures.albedo,
    normalMap: textures.normal,
    normalScale: new THREE.Vector2(0.26, 0.26),
    roughnessMap: textures.roughness,
    roughness: 0.74,
    metalness: 0.0,
    alphaTest: 0.24,
    transparent: false,
    side: THREE.DoubleSide,
    envMapIntensity: 0.34,
  }), [scatter.colorA, textureId, textures]);

  return (
    <Instances name={`instanced-vegetation:${scatter.id}:${textureId}:cross-card`} limit={cards.length} range={cards.length} material={material}>
      <planeGeometry args={[cardDimensions.width, cardDimensions.height, 1, 4]} />
      {cards.map((card) => (
        <Instance
          key={card.key}
          position={card.position}
          rotation={card.rotation}
          scale={card.scale}
          color={card.color}
        />
      ))}
    </Instances>
  );
}

function getVegetationCardDimensions(textureId: WorldVegetationTextureId): { readonly width: number; readonly height: number } {
  if (textureId === 'reed-clump') return { width: 0.18, height: 0.96 };
  if (textureId === 'fern-frond') return { width: 0.26, height: 0.68 };
  return { width: 0.18, height: 0.62 };
}

function getVegetationCardVariants(textureId: WorldVegetationTextureId): readonly {
  readonly rotationOffset: number;
  readonly xOffset: number;
  readonly zOffset: number;
  readonly yOffset: number;
  readonly widthScale: number;
  readonly heightScale: number;
  readonly tiltOffset: number;
}[] {
  const primary = [
    { rotationOffset: 0, xOffset: 0, zOffset: 0, yOffset: 0, widthScale: 0.74, heightScale: 1, tiltOffset: 0 },
    { rotationOffset: Math.PI / 2, xOffset: 0.035, zOffset: -0.022, yOffset: -0.01, widthScale: 0.66, heightScale: 0.88, tiltOffset: 0.08 },
  ];
  if (textureId === 'fern-frond') return primary;
  return [
    ...primary,
    { rotationOffset: Math.PI / 4, xOffset: -0.03, zOffset: 0.026, yOffset: 0.005, widthScale: 0.52, heightScale: 0.72, tiltOffset: -0.1 },
  ];
}

function getVegetationTextureId(id: string): WorldVegetationTextureId {
  if (id.includes('fern') || id.includes('greenhouse')) return 'fern-frond';
  if (id.includes('lake') || id.includes('grotto')) return 'reed-clump';
  return 'grass-clump';
}

interface LibraryBookInstance {
  readonly key: string;
  readonly position: ThreeVec3Tuple;
  readonly rotation: ThreeVec3Tuple;
  readonly scale: ThreeVec3Tuple;
  readonly color: number;
  readonly tableBook: boolean;
}

interface LibraryPaperInstance {
  readonly key: string;
  readonly position: ThreeVec3Tuple;
  readonly rotation: ThreeVec3Tuple;
  readonly scale: ThreeVec3Tuple;
  readonly color: number;
}

interface LibraryLightShaftInstance {
  readonly key: string;
  readonly position: ThreeVec3Tuple;
  readonly rotation: ThreeVec3Tuple;
  readonly scale: ThreeVec3Tuple;
  readonly color: number;
}

function LibraryHeroLayer({ activeIds }: { readonly activeIds: ReadonlySet<WorldChunkId> }): React.ReactElement | null {
  const enabled = activeIds.has('arcane-library');
  const books = useMemo(() => createLibraryBooks(), []);
  const pageBlocks = useMemo(() => createLibraryPageBlocks(), []);
  const papers = useMemo(() => createLibraryPapers(), []);
  const bookmarks = useMemo(() => createLibraryBookmarks(), []);
  const lightShafts = useMemo(() => createLibraryLightShafts(), []);
  const bookMaterial = useMemo(() => {
    const material = new THREE.MeshBasicMaterial({
      name: 'runtime-library-readable-book-spines',
      color: 0x6a5142,
      vertexColors: true,
    });
    material.toneMapped = true;
    return material;
  }, []);
  const pageMaterial = useMemo(() => {
    const material = createPbrMaterial(
      'runtime-library-aged-page-block-pbr',
      createFilePbrSet('organic'),
      { color: 0xc9b68f, roughness: 0.94, metalness: 0, envMapIntensity: 0.12, normalScale: 0.08 },
    );
    material.vertexColors = true;
    return material;
  }, []);
  const paperMaterial = useMemo(() => {
    const material = createPbrMaterial(
      'runtime-library-loose-parchment-pbr',
      createFilePbrSet('organic'),
      { color: 0xf0dfb9, roughness: 0.96, metalness: 0, envMapIntensity: 0.16, normalScale: 0.08 },
    );
    material.vertexColors = true;
    material.transparent = true;
    material.opacity = 0.92;
    material.alphaTest = 0.02;
    material.side = THREE.DoubleSide;
    material.polygonOffset = true;
    material.polygonOffsetFactor = -9;
    return material;
  }, []);
  const bookmarkMaterial = useMemo(() => {
    const material = createPbrMaterial(
      'runtime-library-worn-bookmark-ribbons-pbr',
      createFilePbrSet('organic'),
      { color: 0xc6495d, roughness: 0.78, metalness: 0, envMapIntensity: 0.14, normalScale: 0.08 },
    );
    material.vertexColors = true;
    return material;
  }, []);
  const shaftMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    name: 'runtime-library-dusty-window-light-shafts',
    color: 0xc49a72,
    alphaMap: getBiomeSoftAlphaMap('library-dust-light-shaft-alpha'),
    transparent: true,
    opacity: 0.028,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  }), []);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      libraryDetails: enabled
        ? `books:${books.length},pageBlocks:${pageBlocks.length},papers:${papers.length},bookmarks:${bookmarks.length},shafts:${lightShafts.length}`
        : 'inactive',
    };
  }, [bookmarks.length, books.length, enabled, lightShafts.length, pageBlocks.length, papers.length]);

  useFrame(({ clock }) => {
    if (!enabled) return;
    shaftMaterial.opacity = 0.024 + Math.sin(clock.elapsedTime * 0.27) * 0.006;
    if (shaftMaterial.alphaMap) {
      shaftMaterial.alphaMap.offset.y = clock.elapsedTime * 0.012;
    }
  });

  if (!enabled) return null;

  return (
    <group name="library-hero:arcane-library">
      <pointLight name="library-reading-table-warm-light" position={[5.35, 1.55, -1.45]} color="#ffd38a" intensity={8.6} distance={6.5} decay={2.25} />
      <pointLight name="library-shelf-lantern-fill-light" position={[8.45, 1.8, -4.75]} color="#c98cff" intensity={1.35} distance={4.8} decay={2.4} />
      <LibraryProceduralFurniture />
      <LibraryGroundedReadingNook />
      <LibraryArchiveClutterLayer />
      <LibraryReadingLampCluster />
      <LibraryDeskObjectLayer />
      <LibraryLadderAndRails />
      <Instances name="instanced-library-book-covers" limit={books.length} range={books.length} material={bookMaterial} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1, 1, 1, 1]} />
        {books.map((book) => (
          <Instance
            key={book.key}
            position={book.position}
            rotation={book.rotation}
            scale={book.scale}
            color={book.color}
          />
        ))}
      </Instances>
      <Instances name="instanced-library-aged-page-blocks" limit={pageBlocks.length} range={pageBlocks.length} material={pageMaterial} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1, 1, 1, 1]} />
        {pageBlocks.map((page) => (
          <Instance
            key={page.key}
            position={page.position}
            rotation={page.rotation}
            scale={page.scale}
            color={page.color}
          />
        ))}
      </Instances>
      {papers.length > 0 ? (
        <Instances name="instanced-library-loose-parchments" limit={papers.length} range={papers.length} material={paperMaterial} receiveShadow renderOrder={7}>
          <planeGeometry args={[1, 1, 2, 2]} />
          {papers.map((paper) => (
            <Instance
              key={paper.key}
              position={paper.position}
              rotation={paper.rotation}
              scale={paper.scale}
              color={paper.color}
            />
          ))}
        </Instances>
      ) : null}
      <Instances name="instanced-library-bookmark-ribbons" limit={bookmarks.length} range={bookmarks.length} material={bookmarkMaterial} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1, 1, 1, 1]} />
        {bookmarks.map((bookmark) => (
          <Instance
            key={bookmark.key}
            position={bookmark.position}
            rotation={bookmark.rotation}
            scale={bookmark.scale}
            color={bookmark.color}
          />
        ))}
      </Instances>
      {lightShafts.length > 0 ? (
        <Instances name="instanced-library-window-dust-light-shafts" limit={lightShafts.length} range={lightShafts.length} material={shaftMaterial} renderOrder={12}>
          <planeGeometry args={[1, 1, 1, 1]} />
          {lightShafts.map((shaft) => (
            <Instance
              key={shaft.key}
              position={shaft.position}
              rotation={shaft.rotation}
              scale={shaft.scale}
              color={shaft.color}
            />
          ))}
        </Instances>
      ) : null}
    </group>
  );
}

function LibraryReadingLampCluster(): React.ReactElement {
  const flameMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    name: 'runtime-library-lamp-flame-glow',
    color: 0xffd28a,
    transparent: true,
    opacity: 0.74,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);
  const brassMaterial = useMemo(() => createPbrMaterial(
    'runtime-library-aged-brass-lamp-pbr',
    createFilePbrSet('metal'),
    { color: 0xd1a35d, roughness: 0.34, metalness: 0.62, envMapIntensity: 1.05, normalScale: 0.12 },
  ), []);
  const glassMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    name: 'runtime-library-lamp-smoked-glass',
    color: 0xffe2ad,
    emissive: 0x5a2a0a,
    emissiveIntensity: 0.2,
    roughness: 0.08,
    metalness: 0,
    transmission: 0.28,
    thickness: 0.45,
    transparent: true,
    opacity: 0.54,
    envMapIntensity: 1.2,
  }), []);

  useFrame(({ clock }) => {
    flameMaterial.opacity = 0.66 + Math.sin(clock.elapsedTime * 1.7) * 0.08;
    glassMaterial.emissiveIntensity = 0.16 + Math.sin(clock.elapsedTime * 1.3) * 0.035;
  });

  return (
    <group name="library-reading-lamp-cluster" position={[5.15, 0.98, -1.36]}>
      <mesh name="library-lamp-brass-base" material={brassMaterial} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.28, 0.045, 24]} />
      </mesh>
      <mesh name="library-lamp-brass-stem" position={[0, 0.17, 0]} material={brassMaterial} castShadow>
        <cylinderGeometry args={[0.035, 0.045, 0.34, 16]} />
      </mesh>
      <mesh name="library-lamp-smoked-glass-globe" position={[0, 0.42, 0]} material={glassMaterial} castShadow>
        <sphereGeometry args={[0.18, 24, 16]} />
      </mesh>
      <mesh name="library-lamp-inner-flame" position={[0, 0.42, 0]} material={flameMaterial} renderOrder={15}>
        <sphereGeometry args={[0.105, 18, 12]} />
      </mesh>
    </group>
  );
}

function LibraryProceduralFurniture(): React.ReactElement {
  const shelfDarkWoodMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    name: 'runtime-library-procedural-shadowed-shelf-wood',
    color: 0x21130d,
    roughness: 0.97,
    metalness: 0,
    envMapIntensity: 0.03,
  }), []);
  const tableWoodMaterial = useMemo(() => createPbrMaterial(
    'runtime-library-procedural-dark-oiled-wood-pbr',
    createFilePbrSet('wood'),
    { color: 0x5b3421, roughness: 0.7, metalness: 0.02, envMapIntensity: 0.34, normalScale: 0.22 },
  ), []);
  const edgeWoodMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    name: 'runtime-library-procedural-dark-walnut-edge-wood',
    color: 0x2b1810,
    roughness: 0.94,
    metalness: 0,
    envMapIntensity: 0.04,
  }), []);
  return (
    <group name="library-procedural-furniture-foundation">
      <LibraryProceduralShelfUnit
        name="library-procedural-north-west-shelf"
        position={[3.15, 1.05, -5.88]}
        rotation={[0, 0.02, 0]}
        width={1.56}
        height={2.08}
        depth={0.34}
        darkWoodMaterial={shelfDarkWoodMaterial}
        edgeWoodMaterial={edgeWoodMaterial}
      />
      <LibraryProceduralShelfUnit
        name="library-procedural-north-center-shelf"
        position={[5.35, 1.05, -5.9]}
        rotation={[0, 0, 0]}
        width={1.68}
        height={2.12}
        depth={0.36}
        darkWoodMaterial={shelfDarkWoodMaterial}
        edgeWoodMaterial={edgeWoodMaterial}
      />
      <LibraryProceduralShelfUnit
        name="library-procedural-north-east-shelf"
        position={[7.62, 1.05, -5.82]}
        rotation={[0, -0.03, 0]}
        width={1.56}
        height={2.08}
        depth={0.34}
        darkWoodMaterial={shelfDarkWoodMaterial}
        edgeWoodMaterial={edgeWoodMaterial}
      />
      <LibraryProceduralShelfUnit
        name="library-procedural-east-wall-shelf"
        position={[9.15, 1.02, -3.85]}
        rotation={[0, Math.PI / 2, 0]}
        width={1.78}
        height={1.95}
        depth={0.32}
        darkWoodMaterial={shelfDarkWoodMaterial}
        edgeWoodMaterial={edgeWoodMaterial}
      />
      <group name="library-procedural-reading-table" position={[5.25, 0.18, -1.35]} rotation={[0, 0.05, 0]}>
        <mesh name="library-reading-table-worn-top" position={[0, 0.74, 0]} castShadow receiveShadow material={tableWoodMaterial}>
          <boxGeometry args={[2.15, 0.12, 1.08]} />
        </mesh>
        <mesh name="library-reading-table-polished-front-edge" position={[0, 0.82, -0.56]} castShadow receiveShadow material={edgeWoodMaterial}>
          <boxGeometry args={[2.2, 0.055, 0.055]} />
        </mesh>
        <mesh name="library-reading-table-polished-back-edge" position={[0, 0.82, 0.56]} castShadow receiveShadow material={edgeWoodMaterial}>
          <boxGeometry args={[2.2, 0.055, 0.055]} />
        </mesh>
        <mesh name="library-reading-table-left-edge" position={[-1.1, 0.82, 0]} castShadow receiveShadow material={edgeWoodMaterial}>
          <boxGeometry args={[0.055, 0.055, 1.1]} />
        </mesh>
        <mesh name="library-reading-table-right-edge" position={[1.1, 0.82, 0]} castShadow receiveShadow material={edgeWoodMaterial}>
          <boxGeometry args={[0.055, 0.055, 1.1]} />
        </mesh>
        {[[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]].map(([x, z]) => (
          <mesh key={`${x}:${z}`} name="library-reading-table-turned-leg" position={[x, 0.36, z]} castShadow receiveShadow material={tableWoodMaterial}>
            <cylinderGeometry args={[0.055, 0.075, 0.72, 12]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function LibraryGroundedReadingNook(): React.ReactElement {
  const rugMaterial = useMemo(() => {
    const material = createPbrMaterial(
      'runtime-library-reading-rug-woven-fabric-pbr',
      createFilePbrSet('organic'),
      { color: 0x4f2736, roughness: 0.92, metalness: 0, envMapIntensity: 0.14, normalScale: 0.12 },
    );
    material.polygonOffset = true;
    material.polygonOffsetFactor = -5;
    return material;
  }, []);
  const rugTrimMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    name: 'runtime-library-reading-rug-muted-gold-binding',
    color: 0x8b6c3d,
    roughness: 0.86,
    metalness: 0.04,
    envMapIntensity: 0.16,
  }), []);
  const chairWoodMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    name: 'runtime-library-reading-chair-dark-walnut',
    color: 0x3a2116,
    roughness: 0.88,
    metalness: 0,
    envMapIntensity: 0.1,
  }), []);
  const chairFabricMaterial = useMemo(() => createPbrMaterial(
    'runtime-library-reading-chair-worn-fabric-pbr',
    createFilePbrSet('organic'),
    { color: 0x3f4558, roughness: 0.96, metalness: 0, envMapIntensity: 0.1, normalScale: 0.1 },
  ), []);
  const cartMetalMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    name: 'runtime-library-book-cart-aged-metal',
    color: 0x34302d,
    roughness: 0.78,
    metalness: 0.42,
    envMapIntensity: 0.24,
  }), []);
  const cartBookMaterials = useMemo(() => [
    new THREE.MeshStandardMaterial({ name: 'runtime-library-cart-book-oxblood', color: 0x5e2635, roughness: 0.84, metalness: 0 }),
    new THREE.MeshStandardMaterial({ name: 'runtime-library-cart-book-sage', color: 0x475b3a, roughness: 0.86, metalness: 0 }),
    new THREE.MeshStandardMaterial({ name: 'runtime-library-cart-book-navy', color: 0x2d415a, roughness: 0.88, metalness: 0 }),
    new THREE.MeshStandardMaterial({ name: 'runtime-library-cart-book-ochre', color: 0x785f32, roughness: 0.86, metalness: 0 }),
  ], []);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      libraryReadingNook: 'rug:1,chairs:2,bookCart:1',
    };
  }, []);

  return (
    <group name="library-grounded-reading-nook">
      <group name="library-reading-rug" position={[5.25, 0.181, -1.35]} rotation={[0, 0.05, 0]}>
        <mesh name="library-reading-rug-woven-field" receiveShadow material={rugMaterial}>
          <boxGeometry args={[2.72, 0.018, 1.58]} />
        </mesh>
        <mesh name="library-reading-rug-front-binding" position={[0, 0.018, -0.82]} receiveShadow material={rugTrimMaterial}>
          <boxGeometry args={[2.78, 0.014, 0.045]} />
        </mesh>
        <mesh name="library-reading-rug-back-binding" position={[0, 0.018, 0.82]} receiveShadow material={rugTrimMaterial}>
          <boxGeometry args={[2.78, 0.014, 0.045]} />
        </mesh>
        <mesh name="library-reading-rug-left-binding" position={[-1.39, 0.018, 0]} receiveShadow material={rugTrimMaterial}>
          <boxGeometry args={[0.045, 0.014, 1.62]} />
        </mesh>
        <mesh name="library-reading-rug-right-binding" position={[1.39, 0.018, 0]} receiveShadow material={rugTrimMaterial}>
          <boxGeometry args={[0.045, 0.014, 1.62]} />
        </mesh>
      </group>
      <LibraryReadingChair
        name="library-reading-chair-near-aisle"
        position={[4.12, 0.2, -0.54]}
        rotation={[0, 0.76, 0]}
        woodMaterial={chairWoodMaterial}
        fabricMaterial={chairFabricMaterial}
      />
      <LibraryReadingChair
        name="library-reading-chair-by-shelves"
        position={[6.45, 0.2, -2.1]}
        rotation={[0, -2.28, 0]}
        woodMaterial={chairWoodMaterial}
        fabricMaterial={chairFabricMaterial}
      />
      <LibraryBookCart
        position={[7.24, 0.2, -2.92]}
        rotation={[0, -1.08, 0]}
        woodMaterial={chairWoodMaterial}
        metalMaterial={cartMetalMaterial}
        bookMaterials={cartBookMaterials}
      />
    </group>
  );
}

function LibraryReadingChair({
  name,
  position,
  rotation,
  woodMaterial,
  fabricMaterial,
}: {
  readonly name: string;
  readonly position: ThreeVec3Tuple;
  readonly rotation: ThreeVec3Tuple;
  readonly woodMaterial: THREE.Material;
  readonly fabricMaterial: THREE.Material;
}): React.ReactElement {
  const legPositions = [
    [-0.2, -0.18],
    [0.2, -0.18],
    [-0.2, 0.18],
    [0.2, 0.18],
  ] as const;

  return (
    <group name={name} position={position} rotation={rotation}>
      <mesh name={`${name}:seat-cushion`} position={[0, 0.36, 0]} castShadow receiveShadow material={fabricMaterial}>
        <boxGeometry args={[0.58, 0.105, 0.52]} />
      </mesh>
      <mesh name={`${name}:front-seat-rail`} position={[0, 0.31, -0.29]} castShadow receiveShadow material={woodMaterial}>
        <boxGeometry args={[0.66, 0.055, 0.055]} />
      </mesh>
      <mesh name={`${name}:back-seat-rail`} position={[0, 0.31, 0.29]} castShadow receiveShadow material={woodMaterial}>
        <boxGeometry args={[0.66, 0.055, 0.055]} />
      </mesh>
      <mesh name={`${name}:upright-back-board`} position={[0, 0.75, 0.31]} rotation={[0.12, 0, 0]} castShadow receiveShadow material={fabricMaterial}>
        <boxGeometry args={[0.62, 0.68, 0.075]} />
      </mesh>
      <mesh name={`${name}:back-top-rail`} position={[0, 1.12, 0.34]} castShadow receiveShadow material={woodMaterial}>
        <boxGeometry args={[0.72, 0.07, 0.08]} />
      </mesh>
      {legPositions.map(([x, z]) => (
        <mesh key={`${x}:${z}`} name={`${name}:tapered-leg`} position={[x, 0.14, z]} castShadow receiveShadow material={woodMaterial}>
          <cylinderGeometry args={[0.025, 0.038, 0.42, 8]} />
        </mesh>
      ))}
    </group>
  );
}

function LibraryBookCart({
  position,
  rotation,
  woodMaterial,
  metalMaterial,
  bookMaterials,
}: {
  readonly position: ThreeVec3Tuple;
  readonly rotation: ThreeVec3Tuple;
  readonly woodMaterial: THREE.Material;
  readonly metalMaterial: THREE.Material;
  readonly bookMaterials: readonly THREE.Material[];
}): React.ReactElement {
  const posts = [
    [-0.48, -0.27],
    [0.48, -0.27],
    [-0.48, 0.27],
    [0.48, 0.27],
  ] as const;
  const bookStacks = [
    [-0.26, 0.56, -0.08, 0.18, 0.2, 0.42, -0.08],
    [-0.06, 0.56, -0.08, 0.16, 0.28, 0.39, 0.04],
    [0.13, 0.56, -0.08, 0.19, 0.22, 0.44, 0.02],
    [0.32, 0.56, -0.08, 0.15, 0.32, 0.38, 0.1],
    [-0.18, 0.95, 0.1, 0.42, 0.07, 0.3, 0.16],
    [0.22, 1.02, 0.1, 0.38, 0.07, 0.28, 0.08],
  ] as const;

  return (
    <group name="library-grounded-rolling-book-cart" position={position} rotation={rotation}>
      {[0.42, 0.86].map((y) => (
        <mesh key={`shelf:${y}`} name="library-book-cart-wooden-shelf" position={[0, y, 0]} castShadow receiveShadow material={woodMaterial}>
          <boxGeometry args={[1.12, 0.065, 0.62]} />
        </mesh>
      ))}
      {[0.38, 0.82].map((y) => (
        <React.Fragment key={`rails:${y}`}>
          <mesh name="library-book-cart-front-lip" position={[0, y, -0.35]} castShadow receiveShadow material={metalMaterial}>
            <boxGeometry args={[1.18, 0.045, 0.045]} />
          </mesh>
          <mesh name="library-book-cart-back-lip" position={[0, y, 0.35]} castShadow receiveShadow material={metalMaterial}>
            <boxGeometry args={[1.18, 0.045, 0.045]} />
          </mesh>
        </React.Fragment>
      ))}
      {posts.map(([x, z]) => (
        <mesh key={`post:${x}:${z}`} name="library-book-cart-corner-post" position={[x, 0.64, z]} castShadow receiveShadow material={metalMaterial}>
          <cylinderGeometry args={[0.025, 0.025, 1.06, 8]} />
        </mesh>
      ))}
      {posts.map(([x, z]) => (
        <mesh key={`caster:${x}:${z}`} name="library-book-cart-caster-wheel" position={[x, 0.11, z]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow material={metalMaterial}>
          <torusGeometry args={[0.052, 0.014, 6, 12]} />
        </mesh>
      ))}
      {bookStacks.map(([x, y, z, sx, sy, sz, yaw], index) => (
        <mesh
          key={`book:${index}`}
          name="library-book-cart-stacked-book"
          position={[x, y, z]}
          rotation={[0, yaw, 0]}
          castShadow
          receiveShadow
          material={bookMaterials[index % bookMaterials.length]}
        >
          <boxGeometry args={[sx, sy, sz]} />
        </mesh>
      ))}
    </group>
  );
}

function LibraryArchiveClutterLayer(): React.ReactElement {
  const darkWoodMaterial = useMemo(() => createPbrMaterial(
    'runtime-library-archive-clutter-dark-oiled-wood',
    createFilePbrSet('wood'),
    { color: 0x3a2519, roughness: 0.86, metalness: 0, envMapIntensity: 0.16, normalScale: 0.22 },
  ), []);
  const pageMaterial = useMemo(() => createPbrMaterial(
    'runtime-library-archive-clutter-aged-paper',
    createFilePbrSet('organic'),
    { color: 0xc9b388, roughness: 0.96, metalness: 0, envMapIntensity: 0.1, normalScale: 0.08 },
  ), []);
  const leatherMaterial = useMemo(() => createPbrMaterial(
    'runtime-library-archive-clutter-worn-leather',
    createFilePbrSet('organic'),
    { color: 0x5a2c32, roughness: 0.9, metalness: 0, envMapIntensity: 0.12, normalScale: 0.1 },
  ), []);
  const brassMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    name: 'runtime-library-archive-clutter-dulled-brass',
    color: 0x8d6e37,
    roughness: 0.62,
    metalness: 0.34,
    envMapIntensity: 0.26,
  }), []);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      libraryArchiveClutter: 'bookStacks:5,scrollTubes:7,catalogTray:1,crates:2',
    };
  }, []);

  const floorBookStacks = [
    [3.82, 0.31, -4.02, 0.22],
    [4.15, 0.31, -4.12, -0.16],
    [8.25, 0.31, -3.35, 0.48],
    [8.1, 0.31, -2.72, -0.36],
    [6.86, 0.31, -0.58, 0.12],
  ] as const;
  const scrollTubes = [
    [3.62, 0.34, -3.52, 0.4],
    [3.78, 0.34, -3.48, 0.22],
    [3.95, 0.34, -3.55, -0.1],
    [8.64, 0.34, -3.0, 1.2],
    [8.78, 0.34, -2.88, 1.38],
    [6.86, 0.52, -0.95, -0.72],
    [7.02, 0.52, -0.92, -0.54],
  ] as const;

  return (
    <group name="library-archive-grounded-clutter">
      <group name="library-archive-card-catalog-tray" position={[6.78, 0.31, -0.88]} rotation={[0, -0.2, 0]}>
        <mesh name="library-archive-card-tray-box" castShadow receiveShadow material={darkWoodMaterial}>
          <boxGeometry args={[0.58, 0.2, 0.38]} />
        </mesh>
        <mesh name="library-archive-card-tray-paper-stack" position={[0, 0.12, -0.02]} castShadow receiveShadow material={pageMaterial}>
          <boxGeometry args={[0.5, 0.075, 0.3]} />
        </mesh>
        <mesh name="library-archive-card-tray-brass-pull" position={[0, 0.02, -0.205]} castShadow receiveShadow material={brassMaterial}>
          <boxGeometry args={[0.22, 0.035, 0.025]} />
        </mesh>
      </group>
      {floorBookStacks.map(([x, y, z, yaw], stack) => (
        <group key={`floor-books:${stack}`} name="library-archive-floor-book-stack" position={[x, y, z]} rotation={[0, yaw, 0]}>
          {[0, 1, 2].map((level) => (
            <mesh key={level} name="library-archive-floor-book" position={[0, level * 0.055, 0]} castShadow receiveShadow material={level % 2 === 0 ? leatherMaterial : darkWoodMaterial}>
              <boxGeometry args={[0.42 - level * 0.035, 0.052, 0.28 + level * 0.025]} />
            </mesh>
          ))}
          <mesh name="library-archive-floor-page-edge" position={[0.218, 0.06, 0]} castShadow receiveShadow material={pageMaterial}>
            <boxGeometry args={[0.028, 0.14, 0.25]} />
          </mesh>
        </group>
      ))}
      {scrollTubes.map(([x, y, z, yaw], index) => (
        <mesh
          key={`scroll:${index}`}
          name="library-archive-rolled-scroll-tube"
          position={[x, y, z]}
          rotation={[Math.PI / 2, 0, yaw]}
          castShadow
          receiveShadow
          material={pageMaterial}
        >
          <cylinderGeometry args={[0.055, 0.055, 0.48, 12]} />
        </mesh>
      ))}
      {[[-0.04, 0.18, 0], [0.04, 0.36, 0.04]].map(([offsetX, y, offsetZ], crate) => (
        <group key={`crate:${crate}`} name="library-archive-wooden-storage-crate" position={[3.72 + offsetX, y, -4.58 + offsetZ]} rotation={[0, 0.18 + crate * 0.22, 0]}>
          <mesh name="library-archive-crate-body" castShadow receiveShadow material={darkWoodMaterial}>
            <boxGeometry args={[0.56, 0.32, 0.42]} />
          </mesh>
          <mesh name="library-archive-crate-front-slat" position={[0, 0.04, -0.222]} castShadow receiveShadow material={brassMaterial}>
            <boxGeometry args={[0.48, 0.035, 0.025]} />
          </mesh>
          <mesh name="library-archive-crate-top-slat" position={[0, 0.18, 0]} castShadow receiveShadow material={darkWoodMaterial}>
            <boxGeometry args={[0.6, 0.035, 0.46]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function LibraryDeskObjectLayer(): React.ReactElement {
  const inkMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    name: 'runtime-library-ink-bottle-dark-glass',
    color: 0x10131f,
    emissive: 0x08040c,
    emissiveIntensity: 0.04,
    roughness: 0.12,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    transmission: 0.12,
    thickness: 0.34,
    envMapIntensity: 1.1,
  }), []);
  const brassMaterial = useMemo(() => createPbrMaterial(
    'runtime-library-desk-brass-trim-pbr',
    createFilePbrSet('metal'),
    { color: 0xc79a54, roughness: 0.32, metalness: 0.6, envMapIntensity: 0.9, normalScale: 0.08 },
  ), []);
  const quillMaterial = useMemo(() => createPbrMaterial(
    'runtime-library-quill-feather-pbr',
    createFilePbrSet('organic'),
    { color: 0xd8d0bd, roughness: 0.82, metalness: 0, envMapIntensity: 0.18, normalScale: 0.08 },
  ), []);
  const waxMaterial = useMemo(() => createPbrMaterial(
    'runtime-library-sealing-wax-pbr',
    createFilePbrSet('organic'),
    { color: 0x9b2e3a, roughness: 0.56, metalness: 0, envMapIntensity: 0.18, normalScale: 0.06 },
  ), []);

  return (
    <group name="library-desk-object-layer" position={[5.25, 1.005, -1.35]} rotation={[0, 0.05, 0]}>
      <group name="library-inkwell-and-cap" position={[-0.56, 0.075, -0.18]}>
        <mesh name="library-inkwell-glass-body" castShadow receiveShadow material={inkMaterial}>
          <cylinderGeometry args={[0.1, 0.13, 0.16, 20]} />
        </mesh>
        <mesh name="library-inkwell-brass-neck" position={[0, 0.1, 0]} castShadow material={brassMaterial}>
          <cylinderGeometry args={[0.065, 0.07, 0.035, 18]} />
        </mesh>
      </group>
      <group name="library-quill-resting-on-pages" position={[0.34, 0.084, 0.18]} rotation={[0.08, -0.7, -0.2]}>
        <mesh name="library-quill-shaft" castShadow material={brassMaterial}>
          <boxGeometry args={[0.56, 0.012, 0.012]} />
        </mesh>
        <mesh name="library-quill-feather-left" position={[-0.18, 0.018, 0.038]} rotation={[0, 0, 0.16]} castShadow material={quillMaterial}>
          <planeGeometry args={[0.34, 0.09, 2, 1]} />
        </mesh>
        <mesh name="library-quill-feather-right" position={[-0.18, 0.018, -0.038]} rotation={[0, 0, -0.16]} castShadow material={quillMaterial}>
          <planeGeometry args={[0.34, 0.09, 2, 1]} />
        </mesh>
      </group>
      <mesh name="library-sealing-wax-drop" position={[0.72, 0.074, -0.28]} castShadow receiveShadow material={waxMaterial}>
        <sphereGeometry args={[0.07, 14, 8]} />
      </mesh>
      <mesh name="library-small-brass-paperweight" position={[0.06, 0.082, 0.36]} castShadow receiveShadow material={brassMaterial}>
        <cylinderGeometry args={[0.12, 0.14, 0.055, 20]} />
      </mesh>
    </group>
  );
}

function LibraryProceduralShelfUnit({
  name,
  position,
  rotation,
  width,
  height,
  depth,
  darkWoodMaterial,
  edgeWoodMaterial,
}: {
  readonly name: string;
  readonly position: ThreeVec3Tuple;
  readonly rotation: ThreeVec3Tuple;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly darkWoodMaterial: THREE.Material;
  readonly edgeWoodMaterial: THREE.Material;
}): React.ReactElement {
  const shelfYs = [-0.64, -0.22, 0.2, 0.62];

  return (
    <group name={name} position={position} rotation={rotation}>
      <mesh name={`${name}:shadowed-back-panel`} position={[0, 0, depth * 0.46]} castShadow receiveShadow material={darkWoodMaterial}>
        <boxGeometry args={[width, height, 0.06]} />
      </mesh>
      <mesh name={`${name}:left-upright`} position={[-width * 0.52, 0, 0]} castShadow receiveShadow material={edgeWoodMaterial}>
        <boxGeometry args={[0.08, height, depth]} />
      </mesh>
      <mesh name={`${name}:right-upright`} position={[width * 0.52, 0, 0]} castShadow receiveShadow material={edgeWoodMaterial}>
        <boxGeometry args={[0.08, height, depth]} />
      </mesh>
      <mesh name={`${name}:top-cap`} position={[0, height * 0.5, 0]} castShadow receiveShadow material={edgeWoodMaterial}>
        <boxGeometry args={[width + 0.14, 0.08, depth + 0.04]} />
      </mesh>
      <mesh name={`${name}:bottom-plinth`} position={[0, -height * 0.5, 0]} castShadow receiveShadow material={edgeWoodMaterial}>
        <boxGeometry args={[width + 0.16, 0.12, depth + 0.06]} />
      </mesh>
      {shelfYs.map((y, index) => (
        <mesh key={y} name={`${name}:load-bearing-shelf-${index}`} position={[0, y, 0]} castShadow receiveShadow material={edgeWoodMaterial}>
          <boxGeometry args={[width + 0.08, 0.055, depth + 0.06]} />
        </mesh>
      ))}
    </group>
  );
}

function LibraryLadderAndRails(): React.ReactElement {
  const woodMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    name: 'runtime-library-rolling-ladder-aged-oak',
    color: 0x3d2317,
    roughness: 0.9,
    metalness: 0,
    envMapIntensity: 0.08,
  }), []);
  const brassMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    name: 'runtime-library-ladder-aged-dim-brass-rails',
    color: 0x765127,
    roughness: 0.84,
    metalness: 0.3,
    envMapIntensity: 0.1,
  }), []);

  return (
    <group name="library-rolling-ladder-and-wall-rails">
      <mesh name="library-west-shelf-brass-rail" position={[3.62, 2.12, -5.54]} rotation={[0, 0.01, 0]} material={brassMaterial} castShadow>
        <boxGeometry args={[2.35, 0.035, 0.035]} />
      </mesh>
      <mesh name="library-east-shelf-brass-rail" position={[8.52, 2.16, -4.56]} rotation={[0, Math.PI + 0.02, 0]} material={brassMaterial} castShadow>
        <boxGeometry args={[2.45, 0.035, 0.035]} />
      </mesh>
      <group name="library-leaning-rolling-ladder" position={[3.85, 0.22, -5.22]} rotation={[0, -0.16, -0.18]}>
        <mesh name="library-ladder-left-upright" position={[-0.26, 0.93, 0]} material={woodMaterial} castShadow receiveShadow>
          <boxGeometry args={[0.055, 1.86, 0.06]} />
        </mesh>
        <mesh name="library-ladder-right-upright" position={[0.26, 0.93, 0]} material={woodMaterial} castShadow receiveShadow>
          <boxGeometry args={[0.055, 1.86, 0.06]} />
        </mesh>
        {[0.32, 0.62, 0.92, 1.22, 1.52].map((y) => (
          <mesh key={y} name="library-ladder-rung" position={[0, y, 0]} material={woodMaterial} castShadow receiveShadow>
            <boxGeometry args={[0.62, 0.045, 0.055]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function createLibraryBooks(): LibraryBookInstance[] {
  const books: LibraryBookInstance[] = [];
  const coverPalette = [0x623649, 0x2e4965, 0x4c5f35, 0x76542d, 0x362f55, 0x6a2f2f, 0x294b45, 0x8a6a35];
  const addShelfRow = (
    prefix: string,
    baseX: number,
    baseZ: number,
    axis: 'x' | 'z',
    length: number,
    y: number,
    yaw: number,
    count: number,
  ) => {
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const offset = (t - 0.5) * length;
      const lean = seededSigned(prefix, i + 11) * 0.08;
      const color = new THREE.Color(coverPalette[(i + prefix.length) % coverPalette.length])
        .lerp(new THREE.Color(0xd4b46a), seededNoise(prefix, i + 40) * 0.12)
        .getHex();
      books.push({
        key: `${prefix}:shelf-book:${i}`,
        position: [
          baseX + (axis === 'x' ? offset : seededSigned(prefix, i + 50) * 0.018),
          y + seededSigned(prefix, i + 60) * 0.012,
          baseZ + (axis === 'z' ? offset : seededSigned(prefix, i + 70) * 0.018),
        ],
        rotation: [0, yaw + seededSigned(prefix, i + 80) * 0.035, lean],
        scale: [
          0.045 + seededNoise(prefix, i + 90) * 0.04,
          0.34 + seededNoise(prefix, i + 100) * 0.26,
          0.16 + seededNoise(prefix, i + 110) * 0.08,
        ],
        color,
        tableBook: false,
      });
    }
  };

  const shelfLevels = [0.62, 1.0, 1.38, 1.76];
  shelfLevels.forEach((y, level) => {
    addShelfRow(`library-north-west:${level}`, 3.15, -5.63, 'x', 1.35, y, 0.04, 13);
    addShelfRow(`library-north-center:${level}`, 5.18, -5.72, 'x', 1.48, y, 0.0, 14);
    addShelfRow(`library-north-east:${level}`, 7.65, -5.62, 'x', 1.42, y, -0.03, 13);
    addShelfRow(`library-east-wall:${level}`, 9.12, -4.1, 'z', 1.86, y, Math.PI / 2, 14);
  });

  const tableBooks = [
    [4.58, 0.99, -1.42, 0.42, 0.055, 0.58, 0.1, 0x5f2f42],
    [4.62, 1.065, -1.38, 0.38, 0.052, 0.52, -0.03, 0x2f4f69],
    [5.82, 0.99, -1.72, 0.52, 0.06, 0.44, -0.36, 0x6a4f2e],
    [6.08, 1.065, -1.7, 0.44, 0.052, 0.38, -0.28, 0x405a38],
    [5.5, 0.995, -0.92, 0.34, 0.052, 0.46, 0.58, 0x5a334f],
  ] as const;

  tableBooks.forEach((entry, index) => {
    books.push({
      key: `library-table-book:${index}`,
      position: [entry[0], entry[1], entry[2]],
      rotation: [0, entry[6], 0],
      scale: [entry[3], entry[4], entry[5]],
      color: entry[7],
      tableBook: true,
    });
  });

  return books;
}

function createLibraryPageBlocks(): LibraryPaperInstance[] {
  return [
    { key: 'table-open-folio-left-page-block', position: [5.28, 1.024, -1.14], rotation: [0, -0.2, 0], scale: [0.54, 0.026, 0.38], color: 0xd7c39b },
    { key: 'table-open-folio-right-page-block', position: [5.72, 1.026, -1.2], rotation: [0, -0.2, 0], scale: [0.52, 0.024, 0.36], color: 0xcab589 },
    { key: 'table-cross-reference-stack', position: [4.73, 1.024, -1.02], rotation: [0, 0.38, 0], scale: [0.44, 0.048, 0.32], color: 0xd4bf91 },
    { key: 'table-small-index-card-stack', position: [5.86, 1.022, -1.62], rotation: [0, -0.5, 0], scale: [0.34, 0.038, 0.24], color: 0xe0cda5 },
    { key: 'table-weighted-note-stack', position: [5.28, 1.024, -0.88], rotation: [0, 0.68, 0], scale: [0.36, 0.034, 0.22], color: 0xc8ad7d },
    { key: 'catalog-drawer-exposed-cards', position: [6.78, 0.452, -0.96], rotation: [0, -0.2, 0], scale: [0.46, 0.028, 0.24], color: 0xd8c69d },
    { key: 'north-west-shelf-pale-page-edge-a', position: [3.46, 0.93, -5.48], rotation: [0, 0.02, 0], scale: [0.22, 0.42, 0.035], color: 0xd2bc90 },
    { key: 'north-west-shelf-pale-page-edge-b', position: [2.88, 1.31, -5.48], rotation: [0, 0.03, 0], scale: [0.18, 0.46, 0.034], color: 0xc0a778 },
    { key: 'north-center-shelf-pale-page-edge-a', position: [5.04, 0.55, -5.56], rotation: [0, 0, 0], scale: [0.2, 0.38, 0.034], color: 0xd9c59c },
    { key: 'north-center-shelf-pale-page-edge-b', position: [5.88, 1.69, -5.56], rotation: [0, -0.02, 0], scale: [0.24, 0.44, 0.032], color: 0xcbb184 },
    { key: 'north-east-shelf-pale-page-edge-a', position: [7.36, 0.92, -5.46], rotation: [0, -0.04, 0], scale: [0.2, 0.42, 0.034], color: 0xdac79f },
    { key: 'north-east-shelf-pale-page-edge-b', position: [8.06, 1.3, -5.46], rotation: [0, -0.04, 0], scale: [0.18, 0.45, 0.034], color: 0xc7af83 },
    { key: 'east-wall-shelf-pale-page-edge-a', position: [8.98, 0.9, -4.48], rotation: [0, Math.PI / 2, 0], scale: [0.22, 0.4, 0.034], color: 0xd5c095 },
    { key: 'east-wall-shelf-pale-page-edge-b', position: [8.98, 1.28, -3.7], rotation: [0, Math.PI / 2, 0], scale: [0.2, 0.44, 0.034], color: 0xc5ad83 },
    { key: 'floor-stack-exposed-pages-a', position: [3.94, 0.43, -4.03], rotation: [0, 0.22, 0], scale: [0.28, 0.05, 0.22], color: 0xd4be91 },
    { key: 'floor-stack-exposed-pages-b', position: [8.16, 0.43, -3.23], rotation: [0, -0.42, 0], scale: [0.3, 0.052, 0.21], color: 0xc8b082 },
    { key: 'book-cart-loose-folio-stack', position: [7.05, 1.04, -2.66], rotation: [0, -1.0, 0], scale: [0.34, 0.035, 0.24], color: 0xdcc8a0 },
    { key: 'shelf-ledger-forgotten-index-stack', position: [8.54, 0.48, -2.92], rotation: [0, 1.16, 0], scale: [0.36, 0.034, 0.22], color: 0xd0bb8d },
  ];
}

function createLibraryPapers(): LibraryPaperInstance[] {
  return [
    { key: 'table-loose-parchment-under-quill', position: [5.48, 1.048, -1.18], rotation: [-Math.PI / 2, 0, -0.18], scale: [0.5, 0.36, 1], color: 0xf1deb6 },
    { key: 'table-loose-parchment-side-note', position: [4.88, 1.049, -1.46], rotation: [-Math.PI / 2, 0, 0.28], scale: [0.34, 0.25, 1], color: 0xe3cea4 },
    { key: 'table-loose-parchment-folded-corner', position: [5.98, 1.049, -1.08], rotation: [-Math.PI / 2, 0, -0.54], scale: [0.38, 0.28, 1], color: 0xd8c294 },
    { key: 'table-small-catalog-slip-a', position: [5.02, 1.051, -0.96], rotation: [-Math.PI / 2, 0, 0.72], scale: [0.22, 0.13, 1], color: 0xe9d7af },
    { key: 'table-small-catalog-slip-b', position: [5.92, 1.051, -1.48], rotation: [-Math.PI / 2, 0, -0.34], scale: [0.2, 0.12, 1], color: 0xcab385 },
    { key: 'rug-dropped-page-near-chair', position: [4.18, 0.207, -0.92], rotation: [-Math.PI / 2, 0, 0.92], scale: [0.38, 0.28, 1], color: 0xdac49a },
    { key: 'rug-dropped-page-near-table-leg', position: [4.84, 0.208, -0.62], rotation: [-Math.PI / 2, 0, -0.42], scale: [0.3, 0.22, 1], color: 0xe5d0a6 },
    { key: 'rug-dropped-page-near-cart', position: [6.38, 0.208, -2.0], rotation: [-Math.PI / 2, 0, 0.16], scale: [0.34, 0.24, 1], color: 0xcdb78b },
    { key: 'floor-reference-sheet-by-crates', position: [3.54, 0.205, -4.25], rotation: [-Math.PI / 2, 0, -0.62], scale: [0.42, 0.3, 1], color: 0xd9c398 },
    { key: 'floor-reference-sheet-by-ladder', position: [4.28, 0.205, -5.05], rotation: [-Math.PI / 2, 0, 0.44], scale: [0.36, 0.26, 1], color: 0xe0cda5 },
    { key: 'floor-reference-sheet-at-east-shelf', position: [8.66, 0.205, -3.72], rotation: [-Math.PI / 2, 0, 1.16], scale: [0.4, 0.28, 1], color: 0xc9b488 },
    { key: 'floor-small-torn-note-at-book-stack', position: [7.04, 0.206, -0.74], rotation: [-Math.PI / 2, 0, -0.18], scale: [0.24, 0.16, 1], color: 0xe8d5ae },
    { key: 'catalog-tray-card-overhang-a', position: [6.68, 0.488, -1.05], rotation: [-Math.PI / 2, 0, -0.18], scale: [0.28, 0.14, 1], color: 0xe0cea8 },
    { key: 'catalog-tray-card-overhang-b', position: [6.92, 0.489, -0.88], rotation: [-Math.PI / 2, 0, -0.28], scale: [0.25, 0.13, 1], color: 0xcbb58b },
    { key: 'shelf-paper-protruding-note-a', position: [3.08, 1.52, -5.31], rotation: [-Math.PI / 2, 0, 0.03], scale: [0.24, 0.16, 1], color: 0xe6d4af },
    { key: 'shelf-paper-protruding-note-b', position: [5.54, 1.14, -5.38], rotation: [-Math.PI / 2, 0, -0.05], scale: [0.22, 0.14, 1], color: 0xcbb48a },
    { key: 'east-shelf-protruding-note', position: [8.78, 1.14, -4.0], rotation: [-Math.PI / 2, 0, Math.PI / 2], scale: [0.22, 0.14, 1], color: 0xdcc7a0 },
    { key: 'book-cart-misfiled-page', position: [7.08, 1.08, -2.72], rotation: [-Math.PI / 2, 0, -1.06], scale: [0.3, 0.2, 1], color: 0xe9d6ad },
    { key: 'rug-tiny-torn-scrap-a', position: [5.92, 0.209, -0.62], rotation: [-Math.PI / 2, 0, 0.28], scale: [0.16, 0.1, 1], color: 0xd7c197 },
    { key: 'rug-tiny-torn-scrap-b', position: [6.08, 0.209, -2.16], rotation: [-Math.PI / 2, 0, -0.74], scale: [0.18, 0.1, 1], color: 0xc9b186 },
  ];
}

function createLibraryBookmarks(): LibraryPaperInstance[] {
  return [
    { key: 'table-book-red-ribbon-a', position: [4.58, 1.084, -1.42], rotation: [0, 0.42, 0], scale: [0.035, 0.008, 0.48], color: 0xb7394c },
    { key: 'table-book-gold-ribbon-b', position: [5.82, 1.087, -1.72], rotation: [0, -0.36, 0], scale: [0.032, 0.008, 0.36], color: 0xc39342 },
    { key: 'table-open-folio-blue-ribbon', position: [5.52, 1.048, -1.2], rotation: [0, -0.2, 0], scale: [0.028, 0.008, 0.44], color: 0x385c7f },
    { key: 'north-west-shelf-dangling-ribbon-a', position: [3.18, 1.38, -5.39], rotation: [0, 0.03, 0], scale: [0.028, 0.34, 0.012], color: 0x9f3042 },
    { key: 'north-west-shelf-dangling-ribbon-b', position: [3.68, 1.78, -5.39], rotation: [0, 0.03, 0], scale: [0.026, 0.3, 0.012], color: 0xc19237 },
    { key: 'north-center-shelf-dangling-ribbon-a', position: [4.92, 1.02, -5.47], rotation: [0, 0, 0], scale: [0.026, 0.28, 0.012], color: 0x2e5672 },
    { key: 'north-center-shelf-dangling-ribbon-b', position: [5.74, 1.42, -5.47], rotation: [0, 0, 0], scale: [0.028, 0.34, 0.012], color: 0xb23f50 },
    { key: 'north-center-shelf-dangling-ribbon-c', position: [5.22, 1.82, -5.47], rotation: [0, 0, 0], scale: [0.024, 0.26, 0.012], color: 0xc6a14b },
    { key: 'north-east-shelf-dangling-ribbon-a', position: [7.48, 1.0, -5.37], rotation: [0, -0.03, 0], scale: [0.026, 0.3, 0.012], color: 0x7f355e },
    { key: 'north-east-shelf-dangling-ribbon-b', position: [8.18, 1.38, -5.37], rotation: [0, -0.03, 0], scale: [0.026, 0.32, 0.012], color: 0x356d57 },
    { key: 'east-wall-shelf-dangling-ribbon-a', position: [8.88, 1.02, -4.42], rotation: [0, Math.PI / 2, 0], scale: [0.026, 0.3, 0.012], color: 0x9e3a47 },
    { key: 'east-wall-shelf-dangling-ribbon-b', position: [8.88, 1.42, -3.76], rotation: [0, Math.PI / 2, 0], scale: [0.026, 0.32, 0.012], color: 0xc79b3f },
    { key: 'floor-stack-red-ribbon-tail', position: [3.86, 0.52, -4.04], rotation: [0, 0.22, 0], scale: [0.024, 0.012, 0.32], color: 0xb03b4c },
    { key: 'floor-stack-green-ribbon-tail', position: [8.16, 0.52, -3.26], rotation: [0, -0.42, 0], scale: [0.024, 0.012, 0.3], color: 0x34604f },
    { key: 'book-cart-ribbon-marker', position: [7.18, 1.08, -2.7], rotation: [0, -1.02, 0], scale: [0.026, 0.01, 0.34], color: 0xb83d4d },
  ];
}

function createLibraryLightShafts(): LibraryLightShaftInstance[] {
  return [
    { key: 'north-window-dust-shaft-wide-left', position: [3.82, 1.55, -4.62], rotation: [0.5, 0.03, 0.08], scale: [1.22, 2.25, 1], color: 0xd0aa80 },
    { key: 'north-window-dust-shaft-reading-table', position: [5.2, 1.38, -4.28], rotation: [0.54, -0.02, -0.04], scale: [1.46, 2.42, 1], color: 0xe0b98a },
    { key: 'north-window-dust-shaft-center-shelves', position: [6.38, 1.62, -4.54], rotation: [0.46, 0.04, 0.04], scale: [1.1, 2.0, 1], color: 0xc69e76 },
    { key: 'north-window-dust-shaft-east-stack', position: [7.78, 1.48, -4.18], rotation: [0.5, -0.05, -0.08], scale: [1.12, 2.12, 1], color: 0xd6ad7f },
    { key: 'east-clerestory-dust-shaft-cart', position: [8.54, 1.22, -3.12], rotation: [0.44, 0.22, -0.08], scale: [0.86, 1.74, 1], color: 0xcaa47d },
    { key: 'thin-dust-shaft-over-ladder', position: [4.18, 1.7, -5.1], rotation: [0.42, 0.08, 0.14], scale: [0.62, 1.68, 1], color: 0xbf9670 },
    { key: 'thin-dust-shaft-over-archive-crates', position: [3.62, 1.02, -3.88], rotation: [0.48, 0.02, -0.12], scale: [0.7, 1.5, 1], color: 0xcba27a },
  ];
}

interface BiomeHeroInstance {
  readonly key: string;
  readonly position: ThreeVec3Tuple;
  readonly rotation: ThreeVec3Tuple;
  readonly scale: ThreeVec3Tuple;
  readonly color: number;
  readonly phase: number;
}

const biomeSoftAlphaMapCache = new Map<string, THREE.Texture>();
const biomePatternTextureCache = new Map<string, THREE.Texture>();
const biomeBladeAlphaMapCache = new Map<string, THREE.Texture>();

function BiomeHeroLayer({ activeIds }: { readonly activeIds: ReadonlySet<WorldChunkId> }): React.ReactElement {
  const detailCount = (activeIds.has('moonlit-lawn') ? 1267 : 0) + (activeIds.has('lake-grotto') ? 801 : 0);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      biomeHeroDetails: String(detailCount),
    };
  }, [detailCount]);

  return (
    <group name="runtime-biome-hero-layer">
      {activeIds.has('moonlit-lawn') ? <MoonlitLawnBiome /> : null}
      {activeIds.has('lake-grotto') ? <LakeGrottoBiome /> : null}
      <LakeLawnGroundedDressing activeIds={activeIds} />
    </group>
  );
}

function LakeLawnGroundedDressing({ activeIds }: { readonly activeIds: ReadonlySet<WorldChunkId> }): React.ReactElement | null {
  const enabled = activeIds.has('moonlit-lawn') || activeIds.has('lake-grotto');
  const woodMaterial = useMemo(() => createPbrMaterial(
    'runtime-lake-lawn-grounded-dressing-wet-wood-pbr',
    createFilePbrSet('wood'),
    { color: 0x3f3327, roughness: 0.92, metalness: 0, envMapIntensity: 0.16, normalScale: 0.26 },
  ), []);
  const stoneMaterial = useMemo(() => createPbrMaterial(
    'runtime-lake-lawn-grounded-dressing-wet-stone-pbr',
    createFilePbrSet('stone'),
    { color: 0x68766f, roughness: 0.72, metalness: 0.02, envMapIntensity: 0.28, normalScale: 0.22 },
  ), []);
  const mossMaterial = useMemo(() => createPbrMaterial(
    'runtime-lake-lawn-grounded-dressing-moss-pbr',
    createFilePbrSet('grass'),
    { color: 0x5c7d43, roughness: 0.9, metalness: 0, envMapIntensity: 0.18, normalScale: 0.18 },
  ), []);

  useEffect(() => {
    if (!enabled) return;
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      lakeLawnGroundedDressing: 'planks:5,steppingStones:9,bankPosts:4,mossPads:6',
    };
  }, [enabled]);

  if (!enabled) return null;

  const steppingStones = [
    [-10.6, 0.19, 17.65, 0.18, 0.85, 0.16, 0.58],
    [-9.48, 0.19, 18.15, -0.14, 0.72, 0.14, 0.5],
    [-8.42, 0.19, 18.76, 0.42, 0.9, 0.13, 0.62],
    [-7.26, 0.19, 19.4, -0.35, 0.78, 0.16, 0.56],
    [-6.24, 0.19, 20.1, 0.1, 0.88, 0.14, 0.54],
    [-5.18, 0.19, 20.72, -0.22, 0.72, 0.12, 0.48],
    [-7.95, 0.19, 21.35, 0.36, 0.8, 0.14, 0.52],
    [-9.12, 0.19, 20.78, -0.48, 0.7, 0.13, 0.46],
    [-10.2, 0.19, 20.08, 0.2, 0.76, 0.15, 0.5],
  ] as const;
  const planks = [
    [-9.65, 0.245, 19.15, -0.58, 1.05],
    [-8.72, 0.255, 19.62, -0.48, 0.94],
    [-7.82, 0.255, 20.1, -0.6, 1.08],
    [-8.98, 0.27, 20.48, 0.96, 0.82],
    [-10.12, 0.27, 18.72, 0.88, 0.78],
  ] as const;
  const bankPosts = [
    [-10.18, 0.55, 18.48, -0.06, 0.68],
    [-8.08, 0.58, 19.62, 0.08, 0.72],
    [-6.72, 0.54, 20.62, -0.08, 0.62],
    [-9.2, 0.52, 21.32, 0.04, 0.58],
  ] as const;
  const mossPads = [
    [-10.7, 0.205, 18.42, 0.32, 0.72, 0.28],
    [-9.3, 0.205, 19.28, -0.18, 0.64, 0.22],
    [-7.42, 0.205, 20.62, 0.12, 0.68, 0.26],
    [-5.78, 0.205, 20.94, -0.28, 0.58, 0.2],
    [6.4, 0.205, 20.9, 0.44, 0.7, 0.24],
    [9.1, 0.205, 21.74, -0.14, 0.66, 0.24],
  ] as const;

  return (
    <group name="lake-lawn-grounded-asset-dressing">
      {steppingStones.map(([x, y, z, yaw, sx, sy, sz], index) => (
        <mesh key={`stone:${index}`} name="lake-lawn-foreground-stepping-stone" position={[x, y, z]} rotation={[0.02, yaw, -0.01]} scale={[sx, sy, sz]} castShadow receiveShadow material={stoneMaterial}>
          <dodecahedronGeometry args={[0.5, 0]} />
        </mesh>
      ))}
      {planks.map(([x, y, z, yaw, length], index) => (
        <group key={`plank:${index}`} name="lake-lawn-weathered-bank-plank" position={[x, y, z]} rotation={[0.02, yaw, -0.015]}>
          <mesh castShadow receiveShadow material={woodMaterial}>
            <boxGeometry args={[length, 0.055, 0.24]} />
          </mesh>
          <mesh name="lake-lawn-plank-wet-edge" position={[0, 0.035, -0.126]} castShadow receiveShadow material={stoneMaterial}>
            <boxGeometry args={[length * 0.92, 0.018, 0.025]} />
          </mesh>
        </group>
      ))}
      {bankPosts.map(([x, y, z, lean, height], index) => (
        <group key={`post:${index}`} name="lake-lawn-low-mooring-post" position={[x, y, z]} rotation={[lean, index * 0.42, -lean * 0.5]}>
          <mesh castShadow receiveShadow material={woodMaterial}>
            <cylinderGeometry args={[0.075, 0.11, height, 8]} />
          </mesh>
          <mesh name="lake-lawn-mooring-post-wet-cap" position={[0, height * 0.52, 0]} castShadow receiveShadow material={stoneMaterial}>
            <cylinderGeometry args={[0.13, 0.1, 0.06, 8]} />
          </mesh>
        </group>
      ))}
      {mossPads.map(([x, y, z, yaw, sx, sz], index) => (
        <mesh key={`moss:${index}`} name="lake-lawn-mossy-ground-contact-pad" position={[x, y, z]} rotation={[-Math.PI / 2, 0, yaw]} scale={[sx, sz, 1]} receiveShadow material={mossMaterial} renderOrder={9}>
          <circleGeometry args={[0.42, 18]} />
        </mesh>
      ))}
    </group>
  );
}

function MoonlitLawnBiome(): React.ReactElement {
  const footpathPatches = useMemo(() => createMoonlitFootpathPatches(), []);
  const mudScuffs = useMemo(() => createMoonlitMudScuffs(), []);
  const leafLitter = useMemo(() => createMoonlitLeafLitter(), []);
  const turfPatches = useMemo(() => createMoonlitTurfPatches(), []);
  const grass = useMemo(() => createMoonlitGrassBlades(), []);
  const flowers = useMemo(() => createMoonlitFlowers(), []);
  const stones = useMemo(() => createMoonlitLawnStones(), []);
  const windPatches = useMemo(() => createMoonlitWindPatches(), []);
  const lawnGroundMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    name: 'runtime-moonlit-lawn-natural-ground-base-pbr',
    color: 0x6f8b56,
    map: getBiomePatternTexture('moonlit-lawn-turf-albedo'),
    normalMap: getBiomePatternTexture('moonlit-lawn-turf-normal'),
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.94,
    metalness: 0,
    envMapIntensity: 0.22,
    transparent: true,
    opacity: 0.42,
    alphaMap: getBiomeSoftAlphaMap('moonlit-lawn-ground-base-alpha'),
    alphaTest: 0.035,
    polygonOffset: true,
    polygonOffsetFactor: -11,
  }), []);
  const turfMaterial = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({
      name: 'runtime-moonlit-lawn-turf-patch-pbr',
      color: 0xffffff,
      map: getBiomePatternTexture('moonlit-lawn-turf-albedo'),
      normalMap: getBiomePatternTexture('moonlit-lawn-turf-normal'),
      normalScale: new THREE.Vector2(0.34, 0.34),
      roughness: 0.92,
      metalness: 0,
      transparent: true,
      opacity: 0.72,
      alphaMap: getBiomeSoftAlphaMap('moonlit-lawn-turf-alpha'),
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: -7,
    });
    material.map!.colorSpace = THREE.SRGBColorSpace;
    return material;
  }, []);
  const footpathMaterial = useMemo(() => {
    const material = createPbrMaterial(
      'runtime-moonlit-lawn-worn-footpath-pbr',
      createFilePbrSet('ground'),
      { color: 0xffffff, roughness: 0.92, metalness: 0, envMapIntensity: 0.18, normalScale: 0.2 },
    );
    material.transparent = true;
    material.opacity = 0.74;
    material.alphaMap = getBiomeSoftAlphaMap('moonlit-lawn-footpath-alpha');
    material.alphaTest = 0.025;
    material.depthWrite = false;
    material.side = THREE.DoubleSide;
    material.vertexColors = true;
    material.polygonOffset = true;
    material.polygonOffsetFactor = -9;
    return material;
  }, []);
  const mudScuffMaterial = useMemo(() => {
    const material = createPbrMaterial(
      'runtime-moonlit-lawn-damp-mud-scuff-pbr',
      createFilePbrSet('ground'),
      { color: 0xffffff, roughness: 0.98, metalness: 0, envMapIntensity: 0.1, normalScale: 0.16 },
    );
    material.transparent = true;
    material.opacity = 0.58;
    material.alphaMap = getBiomeSoftAlphaMap('moonlit-lawn-damp-mud-alpha');
    material.alphaTest = 0.02;
    material.depthWrite = false;
    material.side = THREE.DoubleSide;
    material.vertexColors = true;
    material.polygonOffset = true;
    material.polygonOffsetFactor = -10;
    return material;
  }, []);
  const grassMaterial = useMemo(() => {
    const material = createPbrMaterial(
      'runtime-moonlit-lawn-grass-pbr',
      createFilePbrSet('grass'),
      { color: 0xffffff, roughness: 0.86, metalness: 0, envMapIntensity: 0.3, normalScale: 0.28 },
    );
    material.alphaMap = getBiomeBladeAlphaMap('moonlit-lawn-grass-card');
    material.alphaTest = 0.2;
    material.side = THREE.DoubleSide;
    material.vertexColors = true;
    return material;
  }, []);
  const leafLitterMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    name: 'runtime-moonlit-lawn-settled-leaf-litter',
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0,
    envMapIntensity: 0.08,
    side: THREE.DoubleSide,
    vertexColors: true,
    polygonOffset: true,
    polygonOffsetFactor: -11,
  }), []);
  const flowerMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    name: 'runtime-moonlit-lawn-flower-heads',
    color: 0xffffff,
    roughness: 0.62,
    metalness: 0,
    envMapIntensity: 0.18,
    vertexColors: true,
  }), []);
  const stoneMaterial = useMemo(() => {
    const material = createPbrMaterial(
      'runtime-moonlit-lawn-damp-stones-pbr',
      createFilePbrSet('stone'),
      { color: 0xffffff, roughness: 0.9, metalness: 0.02, envMapIntensity: 0.24, normalScale: 0.2 },
    );
    material.vertexColors = true;
    return material;
  }, []);
  const windMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    name: 'runtime-moonlit-lawn-wind-shadow',
    color: 0x163223,
    alphaMap: getBiomeSoftAlphaMap('moonlit-wind-shadow'),
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexColors: true,
    polygonOffset: true,
    polygonOffsetFactor: -8,
  }), []);

  useFrame(({ clock }) => {
    windMaterial.opacity = 0.16 + Math.sin(clock.elapsedTime * 0.22) * 0.035;
    if (windMaterial.alphaMap) {
      windMaterial.alphaMap.offset.x = clock.elapsedTime * 0.018;
      windMaterial.alphaMap.offset.y = Math.sin(clock.elapsedTime * 0.12) * 0.05;
    }
  });

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      lawnFootpathPatches: String(footpathPatches.length),
      lawnMudScuffs: String(mudScuffs.length),
      lawnLeafLitter: String(leafLitter.length),
    };
  }, [footpathPatches.length, leafLitter.length, mudScuffs.length]);

  return (
    <group name="biome-hero:moonlit-lawn">
      <mesh
        name="biome-moonlit-lawn-natural-ground-base"
        position={[0, 0.158, 16.55]}
        rotation={[-Math.PI / 2, 0, 0.025]}
        scale={[16.4, 9.35, 1]}
        material={lawnGroundMaterial}
        receiveShadow
        renderOrder={2}
      >
        <circleGeometry args={[1, 128]} />
      </mesh>
      <Instances name="instanced-biome-moonlit-turf-patches" limit={turfPatches.length} range={turfPatches.length} material={turfMaterial} receiveShadow renderOrder={4}>
        <planeGeometry args={[1, 1, 1, 1]} />
        {turfPatches.map((patch) => (
          <Instance key={patch.key} position={patch.position} rotation={patch.rotation} scale={patch.scale} color={patch.color} />
        ))}
      </Instances>
      <Instances name="instanced-biome-moonlit-worn-footpath" limit={footpathPatches.length} range={footpathPatches.length} material={footpathMaterial} receiveShadow renderOrder={6}>
        <planeGeometry args={[1, 1, 1, 1]} />
        {footpathPatches.map((patch) => (
          <Instance key={patch.key} position={patch.position} rotation={patch.rotation} scale={patch.scale} color={patch.color} />
        ))}
      </Instances>
      <Instances name="instanced-biome-moonlit-damp-mud-scuffs" limit={mudScuffs.length} range={mudScuffs.length} material={mudScuffMaterial} receiveShadow renderOrder={7}>
        <planeGeometry args={[1, 1, 1, 1]} />
        {mudScuffs.map((patch) => (
          <Instance key={patch.key} position={patch.position} rotation={patch.rotation} scale={patch.scale} color={patch.color} />
        ))}
      </Instances>
      <Instances name="instanced-biome-moonlit-settled-leaf-litter" limit={leafLitter.length} range={leafLitter.length} material={leafLitterMaterial} receiveShadow renderOrder={8}>
        <circleGeometry args={[0.08, 7]} />
        {leafLitter.map((leaf) => (
          <Instance key={leaf.key} position={leaf.position} rotation={leaf.rotation} scale={leaf.scale} color={leaf.color} />
        ))}
      </Instances>
      <Instances name="instanced-biome-moonlit-grass-blades" limit={grass.length} range={grass.length} material={grassMaterial} castShadow receiveShadow>
        <planeGeometry args={[0.34, 0.95, 1, 5]} />
        {grass.map((blade) => (
          <Instance key={blade.key} position={blade.position} rotation={blade.rotation} scale={blade.scale} color={blade.color} />
        ))}
      </Instances>
      <Instances name="instanced-biome-moonlit-flower-heads" limit={flowers.length} range={flowers.length} material={flowerMaterial} castShadow>
        <sphereGeometry args={[0.055, 8, 6]} />
        {flowers.map((flower) => (
          <Instance key={flower.key} position={flower.position} rotation={flower.rotation} scale={flower.scale} color={flower.color} />
        ))}
      </Instances>
      <Instances name="instanced-biome-moonlit-damp-stones" limit={stones.length} range={stones.length} material={stoneMaterial} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.22, 0]} />
        {stones.map((stone) => (
          <Instance key={stone.key} position={stone.position} rotation={stone.rotation} scale={stone.scale} color={stone.color} />
        ))}
      </Instances>
      <Instances name="instanced-biome-moonlit-wind-shadows" limit={windPatches.length} range={windPatches.length} material={windMaterial} renderOrder={5}>
        <planeGeometry args={[1, 1, 1, 1]} />
        {windPatches.map((patch) => (
          <Instance key={patch.key} position={patch.position} rotation={patch.rotation} scale={patch.scale} color={patch.color} />
        ))}
      </Instances>
      <Sparkles
        name="moonlit-lawn-firefly-pollen"
        count={48}
        scale={[26, 2.8, 15]}
        position={[0, 1.2, 16.6]}
        color="#dff9a8"
        size={0.38}
        speed={0.16}
        opacity={0.11}
      />
    </group>
  );
}

function LakeGrottoBiome(): React.ReactElement {
  const wetlandMats = useMemo(() => createLakeWetlandMats(), []);
  const reeds = useMemo(() => createLakeReedWall(), []);
  const lilyPads = useMemo(() => createLakeLilyPads(), []);
  const lilyFlowers = useMemo(() => createLakeLilyFlowers(), []);
  const floatingLeaves = useMemo(() => createLakeFloatingLeaves(), []);
  const stones = useMemo(() => createLakeShoreStones(), []);
  const pebbles = useMemo(() => createLakePebbleClusters(), []);
  const driftwood = useMemo(() => createLakeDriftwoodLogs(), []);
  const cattails = useMemo(() => createLakeCattailClumps(), []);
  const bankPosts = useMemo(() => createLakeBankMooringPosts(), []);
  const bankWetMarks = useMemo(() => createLakeBankWetMarks(), []);
  const waterlineFoam = useMemo(() => createLakeWaterlineFoam(), []);
  const rippleStreaks = useMemo(() => createLakeRippleStreaks(), []);
  const glints = useMemo(() => createLakeSurfaceGlints(), []);
  const wetlandMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    name: 'runtime-lake-grotto-wetland-mat-pbr',
    color: 0xffffff,
    map: getBiomePatternTexture('lake-wetland-albedo'),
    normalMap: getBiomePatternTexture('lake-wetland-normal'),
    normalScale: new THREE.Vector2(0.24, 0.24),
    roughness: 0.94,
    metalness: 0,
    transparent: true,
    opacity: 0.68,
    alphaMap: getBiomeSoftAlphaMap('lake-wetland-alpha'),
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexColors: true,
    polygonOffset: true,
    polygonOffsetFactor: -8,
  }), []);
  const reedMaterial = useMemo(() => {
    const material = createPbrMaterial(
      'runtime-lake-grotto-tall-reeds-pbr',
      createFilePbrSet('grass'),
      { color: 0xffffff, roughness: 0.82, metalness: 0, envMapIntensity: 0.34, normalScale: 0.3 },
    );
    material.alphaMap = getBiomeBladeAlphaMap('lake-reed-card');
    material.alphaTest = 0.22;
    material.side = THREE.DoubleSide;
    material.vertexColors = true;
    return material;
  }, []);
  const lilyMaterial = useMemo(() => {
    const material = createPbrMaterial(
      'runtime-lake-grotto-lily-pad-pbr',
      createFilePbrSet('foliage'),
      { color: 0xffffff, roughness: 0.78, metalness: 0, envMapIntensity: 0.18, normalScale: 0.18 },
    );
    material.side = THREE.DoubleSide;
    material.vertexColors = true;
    return material;
  }, []);
  const floatingLeafMaterial = useMemo(() => {
    const material = createPbrMaterial(
      'runtime-lake-grotto-floating-duckweed-leaves-pbr',
      createFilePbrSet('foliage'),
      { color: 0xffffff, roughness: 0.82, metalness: 0, envMapIntensity: 0.2, normalScale: 0.12 },
    );
    material.side = THREE.DoubleSide;
    material.vertexColors = true;
    return material;
  }, []);
  const stoneMaterial = useMemo(() => {
    const material = createPbrMaterial(
      'runtime-lake-grotto-wet-shore-stones-pbr',
      createFilePbrSet('stone'),
      { color: 0xffffff, roughness: 0.64, metalness: 0.02, envMapIntensity: 0.38, normalScale: 0.22 },
    );
    material.vertexColors = true;
    return material;
  }, []);
  const driftwoodMaterial = useMemo(() => createPbrMaterial(
    'runtime-lake-grotto-waterlogged-driftwood-pbr',
    createFilePbrSet('wood'),
    { color: 0x3d3328, roughness: 0.94, metalness: 0, envMapIntensity: 0.12, normalScale: 0.28 },
  ), []);
  const cattailStemMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    name: 'runtime-lake-grotto-cattail-stems',
    color: 0xffffff,
    roughness: 0.84,
    metalness: 0,
    envMapIntensity: 0.18,
    vertexColors: true,
  }), []);
  const cattailHeadMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    name: 'runtime-lake-grotto-cattail-seed-heads',
    color: 0xffffff,
    roughness: 0.96,
    metalness: 0,
    envMapIntensity: 0.06,
    vertexColors: true,
  }), []);
  const lilyFlowerMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    name: 'runtime-lake-grotto-lily-flower-heads',
    color: 0xffd6f5,
    emissive: 0x2c102c,
    emissiveIntensity: 0.08,
    roughness: 0.58,
    metalness: 0,
    vertexColors: true,
  }), []);
  const rippleMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    name: 'runtime-lake-grotto-water-ripple-streaks',
    color: 0xb9f6ff,
    alphaMap: getBiomeSoftAlphaMap('lake-ripple-streaks'),
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -10,
  }), []);
  const glintMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    name: 'runtime-lake-grotto-water-glints',
    color: 0xffffff,
    alphaMap: getBiomeSoftAlphaMap('lake-glints'),
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -9,
  }), []);
  const waterlineFoamMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    name: 'runtime-lake-grotto-irregular-waterline-foam',
    color: 0xd8fff5,
    alphaMap: getBiomeSoftAlphaMap('lake-waterline-foam-alpha'),
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -12,
  }), []);
  const bankWetMaterial = useMemo(() => {
    const material = createPbrMaterial(
      'runtime-lake-grotto-waterline-wet-contact-pbr',
      createFilePbrSet('ground'),
      { color: 0xffffff, roughness: 0.98, metalness: 0, envMapIntensity: 0.08, normalScale: 0.18 },
    );
    material.transparent = true;
    material.opacity = 0.56;
    material.alphaMap = getBiomeSoftAlphaMap('lake-bank-wet-contact-alpha');
    material.alphaTest = 0.018;
    material.depthWrite = false;
    material.side = THREE.DoubleSide;
    material.vertexColors = true;
    material.polygonOffset = true;
    material.polygonOffsetFactor = -13;
    return material;
  }, []);

  useFrame(({ clock }) => {
    rippleMaterial.opacity = 0.13 + Math.sin(clock.elapsedTime * 0.34) * 0.035;
    glintMaterial.opacity = 0.09 + Math.sin(clock.elapsedTime * 0.42) * 0.03;
    waterlineFoamMaterial.opacity = 0.14 + Math.sin(clock.elapsedTime * 0.24) * 0.024;
    bankWetMaterial.opacity = 0.52 + Math.sin(clock.elapsedTime * 0.18) * 0.035;
    if (rippleMaterial.alphaMap) {
      rippleMaterial.alphaMap.offset.x = clock.elapsedTime * 0.025;
      rippleMaterial.alphaMap.offset.y = -clock.elapsedTime * 0.015;
    }
    if (glintMaterial.alphaMap) {
      glintMaterial.alphaMap.offset.x = clock.elapsedTime * 0.04;
      glintMaterial.alphaMap.offset.y = -clock.elapsedTime * 0.025;
    }
    if (waterlineFoamMaterial.alphaMap) {
      waterlineFoamMaterial.alphaMap.offset.x = clock.elapsedTime * 0.018;
      waterlineFoamMaterial.alphaMap.offset.y = Math.sin(clock.elapsedTime * 0.1) * 0.04;
    }
  });

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      lakeShorePebbles: String(pebbles.length),
      lakeDriftwoodLogs: String(driftwood.length),
      lakeCattailClumps: String(cattails.length),
      lakeBankMooringPosts: String(bankPosts.length),
      lakeWetlandMats: String(wetlandMats.length),
      lakeBankWetMarks: String(bankWetMarks.length),
      lakeFloatingLeaves: String(floatingLeaves.length),
      lakeWaterlineFoam: String(waterlineFoam.length),
    };
  }, [bankPosts.length, bankWetMarks.length, cattails.length, driftwood.length, floatingLeaves.length, pebbles.length, waterlineFoam.length, wetlandMats.length]);

  return (
    <group name="biome-hero:lake-grotto">
      <Instances name="instanced-biome-lake-wetland-mats" limit={wetlandMats.length} range={wetlandMats.length} material={wetlandMaterial} receiveShadow renderOrder={3}>
        <planeGeometry args={[1, 1, 1, 1]} />
        {wetlandMats.map((mat) => (
          <Instance key={mat.key} position={mat.position} rotation={mat.rotation} scale={mat.scale} color={mat.color} />
        ))}
      </Instances>
      <EnhancedLakeSurface />
      <Instances name="instanced-biome-lake-bank-wet-contact-marks" limit={bankWetMarks.length} range={bankWetMarks.length} material={bankWetMaterial} receiveShadow renderOrder={6}>
        <planeGeometry args={[1, 1, 1, 1]} />
        {bankWetMarks.map((mark) => (
          <Instance key={mark.key} position={mark.position} rotation={mark.rotation} scale={mark.scale} color={mark.color} />
        ))}
      </Instances>
      <Instances name="instanced-biome-lake-reed-wall" limit={reeds.length} range={reeds.length} material={reedMaterial} castShadow receiveShadow>
        <planeGeometry args={[0.36, 1.24, 1, 5]} />
        {reeds.map((reed) => (
          <Instance key={reed.key} position={reed.position} rotation={reed.rotation} scale={reed.scale} color={reed.color} />
        ))}
      </Instances>
      <Instances name="instanced-biome-lake-lily-pads" limit={lilyPads.length} range={lilyPads.length} material={lilyMaterial} receiveShadow renderOrder={4}>
        <circleGeometry args={[0.3, 18]} />
        {lilyPads.map((pad) => (
          <Instance key={pad.key} position={pad.position} rotation={pad.rotation} scale={pad.scale} color={pad.color} />
        ))}
      </Instances>
      <Instances name="instanced-biome-lake-floating-duckweed-leaves" limit={floatingLeaves.length} range={floatingLeaves.length} material={floatingLeafMaterial} receiveShadow renderOrder={6}>
        <circleGeometry args={[0.12, 7]} />
        {floatingLeaves.map((leaf) => (
          <Instance key={leaf.key} position={leaf.position} rotation={leaf.rotation} scale={leaf.scale} color={leaf.color} />
        ))}
      </Instances>
      <Instances name="instanced-biome-lake-lily-flower-heads" limit={lilyFlowers.length} range={lilyFlowers.length} material={lilyFlowerMaterial} castShadow>
        <sphereGeometry args={[0.048, 8, 6]} />
        {lilyFlowers.map((flower) => (
          <Instance key={flower.key} position={flower.position} rotation={flower.rotation} scale={flower.scale} color={flower.color} />
        ))}
      </Instances>
      <Instances name="instanced-biome-lake-wet-stones" limit={stones.length} range={stones.length} material={stoneMaterial} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.24, 0]} />
        {stones.map((stone) => (
          <Instance key={stone.key} position={stone.position} rotation={stone.rotation} scale={stone.scale} color={stone.color} />
        ))}
      </Instances>
      <Instances name="instanced-biome-lake-shore-pebble-beds" limit={pebbles.length} range={pebbles.length} material={stoneMaterial} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.08, 0]} />
        {pebbles.map((pebble) => (
          <Instance key={pebble.key} position={pebble.position} rotation={pebble.rotation} scale={pebble.scale} color={pebble.color} />
        ))}
      </Instances>
      <Instances name="instanced-biome-lake-waterlogged-driftwood" limit={driftwood.length} range={driftwood.length} material={driftwoodMaterial} castShadow receiveShadow>
        <cylinderGeometry args={[0.1, 0.14, 1.15, 8]} />
        {driftwood.map((log) => (
          <Instance key={log.key} position={log.position} rotation={log.rotation} scale={log.scale} color={log.color} />
        ))}
      </Instances>
      <Instances name="instanced-biome-lake-cattail-stems" limit={cattails.length} range={cattails.length} material={cattailStemMaterial} castShadow receiveShadow>
        <cylinderGeometry args={[0.034, 0.048, 1, 8]} />
        {cattails.map((cattail) => (
          <Instance key={cattail.key} position={cattail.position} rotation={cattail.rotation} scale={cattail.scale} color={cattail.color} />
        ))}
      </Instances>
      <Instances name="instanced-biome-lake-cattail-seed-heads" limit={cattails.length} range={cattails.length} material={cattailHeadMaterial} castShadow receiveShadow>
        <cylinderGeometry args={[0.095, 0.078, 1, 10]} />
        {cattails.map((cattail) => (
          <Instance
            key={`${cattail.key}:head`}
            position={[cattail.position[0], cattail.position[1] + cattail.scale[1] * 0.46, cattail.position[2]]}
            rotation={cattail.rotation}
            scale={[0.86, 0.32 + cattail.phase * 0.16, 0.86]}
            color={new THREE.Color(0x3b2b1f).lerp(new THREE.Color(0x6e5137), cattail.phase * 0.45).getHex()}
          />
        ))}
      </Instances>
      <Instances name="instanced-biome-lake-bank-mooring-posts" limit={bankPosts.length} range={bankPosts.length} material={driftwoodMaterial} castShadow receiveShadow>
        <cylinderGeometry args={[0.08, 0.12, 1, 8]} />
        {bankPosts.map((post) => (
          <Instance key={post.key} position={post.position} rotation={post.rotation} scale={post.scale} color={post.color} />
        ))}
      </Instances>
      <Instances name="instanced-biome-lake-bank-post-wet-caps" limit={bankPosts.length} range={bankPosts.length} material={stoneMaterial} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.13, 0]} />
        {bankPosts.map((post) => (
          <Instance
            key={`${post.key}:cap`}
            position={[post.position[0], post.position[1] + post.scale[1] * 0.5 + 0.055, post.position[2]]}
            rotation={post.rotation}
            scale={[0.92 + post.phase * 0.35, 0.34 + post.phase * 0.16, 0.82 + post.phase * 0.28]}
            color={new THREE.Color(0x263431).lerp(new THREE.Color(0x7b8b7f), post.phase * 0.38).getHex()}
          />
        ))}
      </Instances>
      <Instances name="instanced-biome-lake-ripple-streaks" limit={rippleStreaks.length} range={rippleStreaks.length} material={rippleMaterial} renderOrder={7}>
        <planeGeometry args={[1, 1, 1, 1]} />
        {rippleStreaks.map((ripple) => (
          <Instance key={ripple.key} position={ripple.position} rotation={ripple.rotation} scale={ripple.scale} color={ripple.color} />
        ))}
      </Instances>
      <Instances name="instanced-biome-lake-water-glints" limit={glints.length} range={glints.length} material={glintMaterial} renderOrder={8}>
        <planeGeometry args={[1, 1, 1, 1]} />
        {glints.map((glint) => (
          <Instance key={glint.key} position={glint.position} rotation={glint.rotation} scale={glint.scale} color={glint.color} />
        ))}
      </Instances>
      <Instances name="instanced-biome-lake-irregular-waterline-foam" limit={waterlineFoam.length} range={waterlineFoam.length} material={waterlineFoamMaterial} renderOrder={10}>
        <planeGeometry args={[1, 1, 1, 1]} />
        {waterlineFoam.map((foam) => (
          <Instance key={foam.key} position={foam.position} rotation={foam.rotation} scale={foam.scale} color={foam.color} />
        ))}
      </Instances>
    </group>
  );
}

function EnhancedLakeSurface(): React.ReactElement {
  const deepMaterial = useRef<THREE.MeshPhysicalMaterial>(null);
  const shallowMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const waterMap = useMemo(() => getBiomePatternTexture('lake-water-albedo'), []);
  const waterNormal = useMemo(() => getBiomePatternTexture('lake-water-normal'), []);
  const siltBedGeometry = useMemo(() => createIrregularLakeDiscGeometry('lake-silt-bed-irregular', 128, 0.92), []);
  const deepWaterGeometry = useMemo(() => createIrregularLakeDiscGeometry('lake-deep-water-irregular', 128, 0.86), []);
  const shallowShelfGeometry = useMemo(() => createIrregularLakeRingGeometry('lake-shallow-shelf-irregular', 0.74, 0.99, 128), []);
  const wetBankGeometry = useMemo(() => createIrregularLakeRingGeometry('lake-wet-bank-irregular', 0.9, 1.02, 128), []);

  useFrame(({ clock }) => {
    if (deepMaterial.current) {
      deepMaterial.current.emissiveIntensity = 0.22 + Math.sin(clock.elapsedTime * 0.35) * 0.035;
      deepMaterial.current.opacity = 0.66 + Math.sin(clock.elapsedTime * 0.2) * 0.014;
      if (deepMaterial.current.normalMap) {
        deepMaterial.current.normalMap.offset.x = clock.elapsedTime * 0.018;
        deepMaterial.current.normalMap.offset.y = -clock.elapsedTime * 0.011;
      }
    }
    if (shallowMaterial.current) shallowMaterial.current.opacity = 0.16 + Math.sin(clock.elapsedTime * 0.32) * 0.025;
  });

  return (
    <group name="biome-lake-enhanced-water">
      <mesh name="biome-lake-submerged-silt-bed" position={[-16, 0.101, 21]} rotation={[-Math.PI / 2, 0, -0.08]} scale={[8.55, 6.08, 1]} receiveShadow renderOrder={1}>
        <primitive attach="geometry" object={siltBedGeometry} />
        <meshStandardMaterial
          color={0x263c37}
          map={getBiomePatternTexture('lake-bed-albedo')}
          normalMap={getBiomePatternTexture('lake-bed-normal')}
          normalScale={new THREE.Vector2(0.28, 0.28)}
          roughness={0.96}
          metalness={0}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh name="biome-lake-deep-elliptic-water" position={[-16, 0.128, 21]} rotation={[-Math.PI / 2, 0, -0.08]} scale={[8.8, 6.35, 1]} receiveShadow renderOrder={4}>
        <primitive attach="geometry" object={deepWaterGeometry} />
        <meshPhysicalMaterial
          ref={deepMaterial}
          color={0x236f83}
          map={waterMap}
          normalMap={waterNormal}
          normalScale={new THREE.Vector2(0.44, 0.44)}
          emissive={0x082738}
          emissiveIntensity={0.18}
          roughness={0.06}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.05}
          reflectivity={0.42}
          transparent
          opacity={0.66}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh name="biome-lake-shallow-mineral-shelf" position={[-16, 0.133, 21]} rotation={[-Math.PI / 2, 0, -0.08]} scale={[9.7, 7, 1]} renderOrder={5}>
        <primitive attach="geometry" object={shallowShelfGeometry} />
        <meshBasicMaterial
          ref={shallowMaterial}
          color={0xacebd2}
          alphaMap={getBiomeSoftAlphaMap('lake-shallow-mineral-edge-alpha')}
          transparent
          opacity={0.12}
          alphaTest={0.018}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh name="biome-lake-dark-wet-bank" position={[-16, 0.104, 21]} rotation={[-Math.PI / 2, 0, -0.08]} scale={[10.15, 7.35, 1]} receiveShadow renderOrder={1}>
        <primitive attach="geometry" object={wetBankGeometry} />
        <meshStandardMaterial color={0x20382f} roughness={0.96} metalness={0} transparent opacity={0.58} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function createIrregularLakeDiscGeometry(key: string, segments: number, radius = 1): THREE.BufferGeometry {
  const vertices: number[] = [0, 0, 0];
  const uvs: number[] = [0.5, 0.5];
  const indices: number[] = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const ripple = Math.sin(angle * 3.1 + seededNoise(key, 1) * Math.PI) * 0.025
      + Math.sin(angle * 6.7 + seededNoise(key, 2) * Math.PI) * 0.018;
    const radial = radius * (1 + ripple + seededSigned(key, i + 50) * 0.038);
    const x = Math.cos(angle) * radial;
    const y = Math.sin(angle) * radial;
    vertices.push(x, y, 0);
    uvs.push(0.5 + x * 0.5, 0.5 + y * 0.5);
  }
  for (let i = 0; i < segments; i += 1) {
    indices.push(0, i + 1, ((i + 1) % segments) + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createIrregularLakeRingGeometry(
  key: string,
  innerRadius: number,
  outerRadius: number,
  segments: number,
): THREE.BufferGeometry {
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const outerRipple = Math.sin(angle * 3.4 + seededNoise(key, 10) * Math.PI) * 0.028
      + seededSigned(key, i + 100) * 0.034;
    const innerRipple = Math.sin(angle * 4.8 + seededNoise(key, 20) * Math.PI) * 0.022
      + seededSigned(key, i + 300) * 0.026;
    const outer = outerRadius * (1 + outerRipple);
    const inner = innerRadius * (1 + innerRipple);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    vertices.push(cos * inner, sin * inner, 0, cos * outer, sin * outer, 0);
    uvs.push(0.5 + cos * inner * 0.5, 0.5 + sin * inner * 0.5, 0.5 + cos * outer * 0.5, 0.5 + sin * outer * 0.5);
  }
  for (let i = 0; i < segments; i += 1) {
    const innerA = i * 2;
    const outerA = innerA + 1;
    const innerB = ((i + 1) % segments) * 2;
    const outerB = innerB + 1;
    indices.push(innerA, outerA, innerB, outerA, outerB, innerB);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createMoonlitTurfPatches(): BiomeHeroInstance[] {
  const seed = 'biome:moonlit-lawn:turf-patches';
  const patches: BiomeHeroInstance[] = [];
  for (let i = 0; i < 52; i += 1) {
    const x = -14.8 + seededNoise(seed, i) * 29.6;
    const z = 8.1 + seededNoise(seed, i + 500) * 16.9;
    const pathMask = Math.abs(x * 0.18 + (z - 15.5) * 0.06) < 0.65 && seededNoise(seed, i + 900) < 0.7;
    if (pathMask) continue;
    const dry = seededNoise(seed, i + 1200);
    patches.push({
      key: `moonlit-turf:${i}`,
      position: [x, 0.162 + i * 0.00016, z],
      rotation: [-Math.PI / 2, 0, seededNoise(seed, i + 1500) * Math.PI * 2],
      scale: [2.6 + seededNoise(seed, i + 1800) * 3.8, 1.15 + seededNoise(seed, i + 2100) * 2.15, 1],
      color: new THREE.Color(dry > 0.7 ? 0x9caa6d : 0x486f43)
        .lerp(new THREE.Color(0xb6d582), seededNoise(seed, i + 2400) * 0.42)
        .getHex(),
      phase: seededNoise(seed, i + 2700),
    });
  }
  return patches;
}

function createMoonlitFootpathPatches(): BiomeHeroInstance[] {
  const seed = 'biome:moonlit-lawn:footpath';
  const patches: BiomeHeroInstance[] = [];
  const waypoints = [
    [-11.8, 10.2],
    [-7.2, 12.8],
    [-3.1, 15.7],
    [1.8, 17.8],
    [6.6, 19.4],
    [10.6, 22.2],
  ] as const;

  for (let segment = 0; segment < waypoints.length - 1; segment += 1) {
    const start = waypoints[segment];
    const end = waypoints[segment + 1];
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const angle = Math.atan2(dx, dz);
    const steps = 5;
    for (let step = 0; step < steps; step += 1) {
      const index = segment * steps + step;
      const t = (step + 0.5) / steps;
      const curve = Math.sin((segment + t) * Math.PI * 0.72) * 0.38;
      const side = seededSigned(seed, index + 19) * 0.28;
      patches.push({
        key: `moonlit-footpath:${index}`,
        position: [
          start[0] + dx * t + Math.cos(angle) * side + curve,
          0.181 + index * 0.00022,
          start[1] + dz * t - Math.sin(angle) * side,
        ],
        rotation: [-Math.PI / 2, 0, angle + seededSigned(seed, index + 31) * 0.16],
        scale: [
          1.2 + seededNoise(seed, index + 43) * 1.0,
          0.42 + seededNoise(seed, index + 47) * 0.38,
          1,
        ],
        color: new THREE.Color(0x5b5941)
          .lerp(new THREE.Color(0xa38f66), 0.28 + seededNoise(seed, index + 59) * 0.28)
          .getHex(),
        phase: seededNoise(seed, index + 67),
      });
    }
  }

  for (let i = 0; i < 10; i += 1) {
    const angle = -0.42 + seededSigned(seed, i + 101) * 0.22;
    patches.push({
      key: `moonlit-lake-approach:${i}`,
      position: [
        -9.6 + seededNoise(seed, i + 113) * 5.2,
        0.183 + i * 0.00022,
        16.2 + seededNoise(seed, i + 127) * 4.4,
      ],
      rotation: [-Math.PI / 2, 0, angle],
      scale: [
        0.78 + seededNoise(seed, i + 131) * 0.92,
        0.34 + seededNoise(seed, i + 137) * 0.34,
        1,
      ],
      color: new THREE.Color(0x3f4d36)
        .lerp(new THREE.Color(0x8b7b55), 0.22 + seededNoise(seed, i + 139) * 0.3)
        .getHex(),
      phase: seededNoise(seed, i + 149),
    });
  }

  return patches;
}

function createMoonlitMudScuffs(): BiomeHeroInstance[] {
  const seed = 'biome:moonlit-lawn:mud-scuffs';
  const scuffs: BiomeHeroInstance[] = [];
  const clusters = [
    [-10.8, 17.1, -0.34],
    [-8.6, 18.2, -0.24],
    [-6.1, 19.2, -0.18],
    [6.8, 21.3, 0.42],
    [9.1, 22.8, 0.55],
  ] as const;

  clusters.forEach(([baseX, baseZ, baseYaw], cluster) => {
    for (let i = 0; i < 5; i += 1) {
      const index = cluster * 5 + i;
      scuffs.push({
        key: `moonlit-mud-scuff:${index}`,
        position: [
          baseX + seededSigned(seed, index + 11) * 1.15,
          0.186 + index * 0.00018,
          baseZ + seededSigned(seed, index + 31) * 0.72,
        ],
        rotation: [-Math.PI / 2, 0, baseYaw + seededSigned(seed, index + 51) * 0.26],
        scale: [
          0.46 + seededNoise(seed, index + 71) * 0.58,
          0.16 + seededNoise(seed, index + 91) * 0.22,
          1,
        ],
        color: new THREE.Color(0x242c24)
          .lerp(new THREE.Color(0x5d5b45), 0.18 + seededNoise(seed, index + 111) * 0.24)
          .getHex(),
        phase: seededNoise(seed, index + 131),
      });
    }
  });

  return scuffs;
}

function createMoonlitLeafLitter(): BiomeHeroInstance[] {
  const seed = 'biome:moonlit-lawn:leaf-litter';
  const leaves: BiomeHeroInstance[] = [];
  for (let i = 0; i < 86; i += 1) {
    const lakeBias = seededNoise(seed, i + 100) > 0.42;
    const x = lakeBias
      ? -12.4 + seededNoise(seed, i + 300) * 24.8
      : -14.6 + seededNoise(seed, i + 300) * 29.2;
    const z = lakeBias
      ? 16.4 + seededNoise(seed, i + 600) * 7.4
      : 8.8 + seededNoise(seed, i + 600) * 15.8;
    const damp = z > 17.8 || seededNoise(seed, i + 900) > 0.68;
    leaves.push({
      key: `moonlit-leaf-litter:${i}`,
      position: [x, 0.191 + i * 0.00003, z],
      rotation: [-Math.PI / 2, 0, seededNoise(seed, i + 1200) * Math.PI * 2],
      scale: [
        0.7 + seededNoise(seed, i + 1500) * 1.45,
        0.28 + seededNoise(seed, i + 1800) * 0.72,
        1,
      ],
      color: new THREE.Color(damp ? 0x2d3426 : 0x7b5f34)
        .lerp(new THREE.Color(0xb19a57), seededNoise(seed, i + 2100) * 0.3)
        .getHex(),
      phase: seededNoise(seed, i + 2400),
    });
  }
  return leaves;
}

function createMoonlitGrassBlades(): BiomeHeroInstance[] {
  const blades: BiomeHeroInstance[] = [];
  const seed = 'biome:moonlit-lawn:grass';
  for (let i = 0; i < 1040; i += 1) {
    const x = -15.4 + seededNoise(seed, i) * 30.8;
    const z = 7.6 + seededNoise(seed, i + 1000) * 18.2;
    const nearPath = Math.abs(x * 0.18 + (z - 15.5) * 0.06) < 0.8 && seededNoise(seed, i + 2000) < 0.58;
    if (nearPath) continue;
    const height = 0.42 + seededNoise(seed, i + 3000) * 0.82;
    const clump = seededNoise(seed, i + 4000) > 0.72;
    const color = new THREE.Color(clump ? 0xb0d47d : 0x5f9a54)
      .lerp(new THREE.Color(0x2f5e48), seededNoise(seed, i + 5000) * 0.55)
      .getHex();
    blades.push({
      key: `moonlit-grass:${i}`,
      position: [x, 0.18 + height * 0.43, z],
      rotation: [seededSigned(seed, i + 6000) * 0.12, seededNoise(seed, i + 7000) * Math.PI * 2, seededSigned(seed, i + 8000) * 0.2],
      scale: [0.72 + seededNoise(seed, i + 9000) * 0.86, height, 1],
      color,
      phase: seededNoise(seed, i + 11000),
    });
  }
  return blades;
}

function createMoonlitFlowers(): BiomeHeroInstance[] {
  const flowers: BiomeHeroInstance[] = [];
  const seed = 'biome:moonlit-lawn:flowers';
  for (let i = 0; i < 120; i += 1) {
    const x = -14.5 + seededNoise(seed, i) * 29;
    const z = 8.5 + seededNoise(seed, i + 500) * 16.5;
    const warm = seededNoise(seed, i + 800) > 0.45;
    flowers.push({
      key: `moonlit-flower:${i}`,
      position: [x, 0.47 + seededNoise(seed, i + 1000) * 0.32, z],
      rotation: [0, seededNoise(seed, i + 1400) * Math.PI * 2, 0],
      scale: [0.7 + seededNoise(seed, i + 1800) * 0.9, 0.55 + seededNoise(seed, i + 2200) * 0.6, 0.7 + seededNoise(seed, i + 2600) * 0.9],
      color: warm ? new THREE.Color(0xf1dda0).lerp(new THREE.Color(0x9edc7d), seededNoise(seed, i + 3000) * 0.35).getHex() : 0xb9d8ff,
      phase: seededNoise(seed, i + 3200),
    });
  }
  return flowers;
}

function createMoonlitLawnStones(): BiomeHeroInstance[] {
  const stones: BiomeHeroInstance[] = [];
  const seed = 'biome:moonlit-lawn:stones';
  for (let i = 0; i < 32; i += 1) {
    const edgeBias = i % 3 === 0;
    const x = edgeBias ? -14.6 + seededNoise(seed, i) * 29.2 : -11 + seededNoise(seed, i) * 22;
    const z = edgeBias ? 8.2 + seededNoise(seed, i + 200) * 17.6 : 10.5 + seededNoise(seed, i + 200) * 12.4;
    stones.push({
      key: `moonlit-stone:${i}`,
      position: [x, 0.17, z],
      rotation: [seededNoise(seed, i + 400) * Math.PI, seededNoise(seed, i + 600) * Math.PI, seededNoise(seed, i + 800) * Math.PI],
      scale: [0.5 + seededNoise(seed, i + 1000) * 1.15, 0.12 + seededNoise(seed, i + 1200) * 0.16, 0.42 + seededNoise(seed, i + 1400) * 0.9],
      color: new THREE.Color(0x5e7062).lerp(new THREE.Color(0xb7c5a9), seededNoise(seed, i + 1600) * 0.38).getHex(),
      phase: seededNoise(seed, i + 1800),
    });
  }
  return stones;
}

function createMoonlitWindPatches(): BiomeHeroInstance[] {
  const seed = 'biome:moonlit-lawn:wind';
  return Array.from({ length: 4 }, (_, i) => ({
    key: `moonlit-wind:${i}`,
    position: [-8.5 + i * 5.3 + seededSigned(seed, i) * 0.7, 0.174 + i * 0.0008, 12.2 + seededNoise(seed, i + 100) * 9.8],
    rotation: [-Math.PI / 2, 0, -0.28 + seededSigned(seed, i + 200) * 0.3] as ThreeVec3Tuple,
    scale: [5.8 + seededNoise(seed, i + 300) * 3.6, 1.8 + seededNoise(seed, i + 400) * 1.4, 1] as ThreeVec3Tuple,
    color: 0xffffff,
    phase: seededNoise(seed, i + 500),
  }));
}

function createLakeWetlandMats(): BiomeHeroInstance[] {
  const mats: BiomeHeroInstance[] = [];
  const seed = 'biome:lake-grotto:wetland-mats';
  for (let i = 0; i < 34; i += 1) {
    const angle = seededNoise(seed, i) * Math.PI * 2;
    const shore = 0.93 + seededSigned(seed, i + 400) * 0.16;
    const wetBias = seededNoise(seed, i + 800);
    mats.push({
      key: `lake-wetland-mat:${i}`,
      position: [-16 + Math.cos(angle) * 9.15 * shore, 0.164 + i * 0.0002, 21 + Math.sin(angle) * 6.7 * shore],
      rotation: [-Math.PI / 2, 0, angle + Math.PI / 2 + seededSigned(seed, i + 1200) * 0.5],
      scale: [2.25 + seededNoise(seed, i + 1600) * 2.8, 0.8 + seededNoise(seed, i + 2000) * 1.7, 1],
      color: new THREE.Color(wetBias > 0.52 ? 0x2c564b : 0x445d36)
        .lerp(new THREE.Color(0x8fbd82), seededNoise(seed, i + 2400) * 0.26)
        .getHex(),
      phase: seededNoise(seed, i + 2800),
    });
  }
  return mats;
}

function createLakeReedWall(): BiomeHeroInstance[] {
  const reeds: BiomeHeroInstance[] = [];
  const seed = 'biome:lake-grotto:reeds';
  for (let i = 0; i < 430; i += 1) {
    const angle = seededNoise(seed, i) * Math.PI * 2;
    const shore = 0.92 + seededSigned(seed, i + 1000) * 0.12;
    const x = -16 + Math.cos(angle) * 8.9 * shore;
    const z = 21 + Math.sin(angle) * 6.35 * shore;
    const height = 0.72 + seededNoise(seed, i + 2000) * 1.16;
    reeds.push({
      key: `lake-reed:${i}`,
      position: [x, 0.18 + height * 0.56, z],
      rotation: [seededSigned(seed, i + 3000) * 0.12, -angle + Math.PI / 2 + seededSigned(seed, i + 4000) * 0.34, seededSigned(seed, i + 5000) * 0.18],
      scale: [0.62 + seededNoise(seed, i + 6000) * 0.98, height, 1],
      color: new THREE.Color(0x7da96a).lerp(new THREE.Color(0x2e6659), seededNoise(seed, i + 8000) * 0.62).getHex(),
      phase: seededNoise(seed, i + 9000),
    });
  }
  return reeds;
}

function createLakeLilyPads(): BiomeHeroInstance[] {
  const pads: BiomeHeroInstance[] = [];
  const seed = 'biome:lake-grotto:lilies';
  for (let i = 0; i < 52; i += 1) {
    const angle = seededNoise(seed, i) * Math.PI * 2;
    const radius = Math.sqrt(seededNoise(seed, i + 1000)) * 0.78;
    pads.push({
      key: `lake-lily:${i}`,
      position: [-16 + Math.cos(angle) * 7.4 * radius, 0.188 + i * 0.00025, 21 + Math.sin(angle) * 5.2 * radius],
      rotation: [-Math.PI / 2, 0, seededNoise(seed, i + 2000) * Math.PI * 2],
      scale: [0.7 + seededNoise(seed, i + 3000) * 1.15, 0.48 + seededNoise(seed, i + 4000) * 0.7, 1],
      color: new THREE.Color(0x315f43).lerp(new THREE.Color(0x8abf75), seededNoise(seed, i + 5000) * 0.35).getHex(),
      phase: seededNoise(seed, i + 6000),
    });
  }
  return pads;
}

function createLakeLilyFlowers(): BiomeHeroInstance[] {
  const seed = 'biome:lake-grotto:lily-flowers';
  return Array.from({ length: 22 }, (_, i) => {
    const angle = seededNoise(seed, i) * Math.PI * 2;
    const radius = Math.sqrt(seededNoise(seed, i + 1000)) * 0.72;
    const warm = seededNoise(seed, i + 2000) > 0.42;
    return {
      key: `lake-lily-flower:${i}`,
      position: [-16 + Math.cos(angle) * 7.0 * radius, 0.245 + i * 0.0003, 21 + Math.sin(angle) * 4.95 * radius],
      rotation: [0, seededNoise(seed, i + 3000) * Math.PI * 2, 0],
      scale: [0.7 + seededNoise(seed, i + 4000) * 0.8, 0.42 + seededNoise(seed, i + 5000) * 0.55, 0.7 + seededNoise(seed, i + 6000) * 0.8],
      color: warm ? 0xffd6f5 : 0xd3f3ff,
      phase: seededNoise(seed, i + 7000),
    };
  });
}

function createLakeFloatingLeaves(): BiomeHeroInstance[] {
  const leaves: BiomeHeroInstance[] = [];
  const seed = 'biome:lake-grotto:floating-leaves';
  for (let i = 0; i < 84; i += 1) {
    const angle = seededNoise(seed, i) * Math.PI * 2;
    const nearShore = i < 58;
    const radius = nearShore
      ? 0.54 + seededNoise(seed, i + 300) * 0.38
      : Math.sqrt(seededNoise(seed, i + 300)) * 0.54;
    const rot = seededNoise(seed, i + 600) * Math.PI * 2;
    leaves.push({
      key: `lake-floating-leaf:${i}`,
      position: [
        -16 + Math.cos(angle) * 7.95 * radius + seededSigned(seed, i + 900) * 0.14,
        0.214 + i * 0.000045,
        21 + Math.sin(angle) * 5.55 * radius + seededSigned(seed, i + 1200) * 0.12,
      ],
      rotation: [-Math.PI / 2, 0, rot],
      scale: [
        0.58 + seededNoise(seed, i + 1500) * 1.12,
        0.34 + seededNoise(seed, i + 1800) * 0.74,
        1,
      ],
      color: new THREE.Color(0x284d35)
        .lerp(new THREE.Color(0x8abe66), seededNoise(seed, i + 2100) * 0.42)
        .getHex(),
      phase: seededNoise(seed, i + 2400),
    });
  }
  return leaves;
}

function createLakeBankWetMarks(): BiomeHeroInstance[] {
  const marks: BiomeHeroInstance[] = [];
  const seed = 'biome:lake-grotto:bank-wet-contact';
  for (let i = 0; i < 64; i += 1) {
    const angle = seededNoise(seed, i) * Math.PI * 2;
    const shore = 0.99 + seededSigned(seed, i + 350) * 0.1;
    const radiusX = 9.78 * shore;
    const radiusZ = 7.05 * shore;
    marks.push({
      key: `lake-bank-wet-contact:${i}`,
      position: [
        -16 + Math.cos(angle) * radiusX,
        0.174 + i * 0.000055,
        21 + Math.sin(angle) * radiusZ,
      ],
      rotation: [-Math.PI / 2, 0, angle + Math.PI / 2 + seededSigned(seed, i + 700) * 0.26],
      scale: [
        0.92 + seededNoise(seed, i + 1000) * 1.72,
        0.14 + seededNoise(seed, i + 1300) * 0.32,
        1,
      ],
      color: new THREE.Color(0x162a24)
        .lerp(new THREE.Color(0x4f5b42), seededNoise(seed, i + 1600) * 0.28)
        .getHex(),
      phase: seededNoise(seed, i + 1900),
    });
  }
  return marks;
}

function createLakeWaterlineFoam(): BiomeHeroInstance[] {
  const foam: BiomeHeroInstance[] = [];
  const seed = 'biome:lake-grotto:waterline-foam';
  for (let i = 0; i < 78; i += 1) {
    const angle = seededNoise(seed, i) * Math.PI * 2;
    const brokenSegment = seededNoise(seed, i + 250) < 0.16;
    if (brokenSegment) continue;
    const shore = 0.84 + seededSigned(seed, i + 500) * 0.08;
    foam.push({
      key: `lake-waterline-foam:${i}`,
      position: [
        -16 + Math.cos(angle) * 9.38 * shore + seededSigned(seed, i + 750) * 0.12,
        0.224 + i * 0.000035,
        21 + Math.sin(angle) * 6.72 * shore + seededSigned(seed, i + 1000) * 0.1,
      ],
      rotation: [-Math.PI / 2, 0, angle + Math.PI / 2 + seededSigned(seed, i + 1250) * 0.34],
      scale: [
        0.48 + seededNoise(seed, i + 1500) * 1.35,
        0.045 + seededNoise(seed, i + 1750) * 0.105,
        1,
      ],
      color: new THREE.Color(0xa9fff0)
        .lerp(new THREE.Color(0xffffff), seededNoise(seed, i + 2000) * 0.32)
        .getHex(),
      phase: seededNoise(seed, i + 2250),
    });
  }
  return foam;
}

function createLakeShoreStones(): BiomeHeroInstance[] {
  const stones: BiomeHeroInstance[] = [];
  const seed = 'biome:lake-grotto:shore-stones';
  for (let i = 0; i < 64; i += 1) {
    const angle = seededNoise(seed, i) * Math.PI * 2;
    const shore = 1 + seededSigned(seed, i + 500) * 0.16;
    stones.push({
      key: `lake-shore-stone:${i}`,
      position: [-16 + Math.cos(angle) * 9.25 * shore, 0.15, 21 + Math.sin(angle) * 6.75 * shore],
      rotation: [seededNoise(seed, i + 1000) * Math.PI, seededNoise(seed, i + 1500) * Math.PI, seededNoise(seed, i + 2000) * Math.PI],
      scale: [0.45 + seededNoise(seed, i + 2500) * 1.05, 0.12 + seededNoise(seed, i + 3000) * 0.2, 0.36 + seededNoise(seed, i + 3500) * 0.95],
      color: new THREE.Color(0x4d686b).lerp(new THREE.Color(0xa8c2bd), seededNoise(seed, i + 4000) * 0.32).getHex(),
      phase: seededNoise(seed, i + 4500),
    });
  }
  return stones;
}

function createLakePebbleClusters(): BiomeHeroInstance[] {
  const pebbles: BiomeHeroInstance[] = [];
  const seed = 'biome:lake-grotto:shore-pebbles';
  for (let i = 0; i < 138; i += 1) {
    const angle = seededNoise(seed, i) * Math.PI * 2;
    const shore = 0.94 + seededSigned(seed, i + 300) * 0.12;
    const scatter = seededSigned(seed, i + 600) * 0.34;
    const radiusX = 9.45 * shore + scatter;
    const radiusZ = 6.88 * shore + scatter * 0.55;
    pebbles.push({
      key: `lake-shore-pebble:${i}`,
      position: [-16 + Math.cos(angle) * radiusX, 0.158 + i * 0.00004, 21 + Math.sin(angle) * radiusZ],
      rotation: [
        seededNoise(seed, i + 900) * Math.PI,
        seededNoise(seed, i + 1200) * Math.PI,
        seededNoise(seed, i + 1500) * Math.PI,
      ],
      scale: [
        0.55 + seededNoise(seed, i + 1800) * 0.9,
        0.18 + seededNoise(seed, i + 2100) * 0.32,
        0.42 + seededNoise(seed, i + 2400) * 0.78,
      ],
      color: new THREE.Color(0x36494b)
        .lerp(new THREE.Color(0x8ca49c), seededNoise(seed, i + 2700) * 0.34)
        .getHex(),
      phase: seededNoise(seed, i + 3000),
    });
  }
  return pebbles;
}

function createLakeDriftwoodLogs(): BiomeHeroInstance[] {
  const seed = 'biome:lake-grotto:driftwood';
  const logs: BiomeHeroInstance[] = [];
  for (let i = 0; i < 17; i += 1) {
    const angle = seededNoise(seed, i) * Math.PI * 2;
    const shore = 0.96 + seededSigned(seed, i + 100) * 0.09;
    logs.push({
      key: `lake-driftwood:${i}`,
      position: [
        -16 + Math.cos(angle) * 9.55 * shore,
        0.245 + i * 0.0006,
        21 + Math.sin(angle) * 6.92 * shore,
      ],
      rotation: [
        Math.PI / 2 + seededSigned(seed, i + 200) * 0.08,
        angle + Math.PI / 2 + seededSigned(seed, i + 300) * 0.38,
        seededSigned(seed, i + 400) * 0.16,
      ],
      scale: [
        0.78 + seededNoise(seed, i + 500) * 0.82,
        1.2 + seededNoise(seed, i + 600) * 1.15,
        0.64 + seededNoise(seed, i + 700) * 0.72,
      ],
      color: new THREE.Color(0x2d271f)
        .lerp(new THREE.Color(0x6c5b45), seededNoise(seed, i + 800) * 0.34)
        .getHex(),
      phase: seededNoise(seed, i + 900),
    });
  }
  return logs;
}

function createLakeCattailClumps(): BiomeHeroInstance[] {
  const seed = 'biome:lake-grotto:cattails';
  const cattails: BiomeHeroInstance[] = [];
  for (let i = 0; i < 96; i += 1) {
    const focusedShore = i < 64;
    const angle = focusedShore
      ? -0.1 + seededNoise(seed, i) * 0.64
      : seededNoise(seed, i) * Math.PI * 2;
    const shore = focusedShore
      ? 1.04 + seededSigned(seed, i + 500) * 0.08
      : 0.99 + seededSigned(seed, i + 500) * 0.12;
    const height = focusedShore
      ? 1.0 + seededNoise(seed, i + 1000) * 0.62
      : 0.78 + seededNoise(seed, i + 1000) * 0.66;
    const lean = seededSigned(seed, i + 1500) * 0.1;
    cattails.push({
      key: `lake-cattail:${i}`,
      position: [
        -16 + Math.cos(angle) * 9.04 * shore + seededSigned(seed, i + 1800) * 0.18,
        0.18 + height * 0.5,
        21 + Math.sin(angle) * 6.42 * shore + seededSigned(seed, i + 2100) * 0.18,
      ],
      rotation: [lean, angle + seededSigned(seed, i + 2400) * 0.34, seededSigned(seed, i + 2700) * 0.08],
      scale: [
        1.05 + seededNoise(seed, i + 3000) * 0.58,
        height,
        1.05 + seededNoise(seed, i + 3300) * 0.5,
      ],
      color: new THREE.Color(0x4d7644)
        .lerp(new THREE.Color(0xb4aa64), seededNoise(seed, i + 3600) * 0.36)
        .getHex(),
      phase: seededNoise(seed, i + 3900),
    });
  }
  return cattails;
}

function createLakeBankMooringPosts(): BiomeHeroInstance[] {
  const seed = 'biome:lake-grotto:bank-mooring-posts';
  const anchors = [
    [-10.8, 18.05],
    [-9.65, 18.32],
    [-8.45, 18.78],
    [-7.35, 19.34],
    [-6.55, 20.14],
    [-10.15, 20.18],
    [-8.88, 20.86],
    [-7.2, 21.62],
  ] as const;

  return anchors.map(([x, z], i) => {
    const height = 0.72 + seededNoise(seed, i + 100) * 0.46;
    return {
      key: `lake-bank-mooring-post:${i}`,
      position: [
        x + seededSigned(seed, i + 300) * 0.14,
        0.18 + height * 0.5,
        z + seededSigned(seed, i + 500) * 0.18,
      ],
      rotation: [
        seededSigned(seed, i + 700) * 0.08,
        seededNoise(seed, i + 900) * Math.PI,
        seededSigned(seed, i + 1100) * 0.08,
      ] as ThreeVec3Tuple,
      scale: [
        0.78 + seededNoise(seed, i + 1300) * 0.34,
        height,
        0.78 + seededNoise(seed, i + 1500) * 0.28,
      ] as ThreeVec3Tuple,
      color: new THREE.Color(0x33291f)
        .lerp(new THREE.Color(0x725d45), seededNoise(seed, i + 1700) * 0.42)
        .getHex(),
      phase: seededNoise(seed, i + 1900),
    };
  });
}

function createLakeRippleStreaks(): BiomeHeroInstance[] {
  const ripples: BiomeHeroInstance[] = [];
  const seed = 'biome:lake-grotto:ripple-streaks';
  for (let i = 0; i < 48; i += 1) {
    const angle = seededNoise(seed, i) * Math.PI * 2;
    const radius = Math.sqrt(seededNoise(seed, i + 500)) * 0.84;
    ripples.push({
      key: `lake-ripple:${i}`,
      position: [-16 + Math.cos(angle) * 7.5 * radius, 0.205 + i * 0.00012, 21 + Math.sin(angle) * 5.28 * radius],
      rotation: [-Math.PI / 2, 0, angle + Math.PI / 2 + seededSigned(seed, i + 1000) * 0.45],
      scale: [0.78 + seededNoise(seed, i + 1500) * 1.65, 0.028 + seededNoise(seed, i + 2000) * 0.045, 1],
      color: new THREE.Color(0x7beeff).lerp(new THREE.Color(0xffffff), seededNoise(seed, i + 2500) * 0.24).getHex(),
      phase: seededNoise(seed, i + 3000),
    });
  }
  return ripples;
}

function createLakeSurfaceGlints(): BiomeHeroInstance[] {
  const glints: BiomeHeroInstance[] = [];
  const seed = 'biome:lake-grotto:surface-glints';
  for (let i = 0; i < 34; i += 1) {
    const angle = seededNoise(seed, i) * Math.PI * 2;
    const radius = Math.sqrt(seededNoise(seed, i + 800)) * 0.86;
    glints.push({
      key: `lake-glint:${i}`,
      position: [-16 + Math.cos(angle) * 7.6 * radius, 0.196 + i * 0.00018, 21 + Math.sin(angle) * 5.25 * radius],
      rotation: [-Math.PI / 2, 0, angle + seededSigned(seed, i + 1600) * 0.5],
      scale: [0.12 + seededNoise(seed, i + 2200) * 0.42, 0.014 + seededNoise(seed, i + 2600) * 0.03, 1],
      color: new THREE.Color(0x94f2ff).lerp(new THREE.Color(0xffffff), seededNoise(seed, i + 3000) * 0.4).getHex(),
      phase: seededNoise(seed, i + 3400),
    });
  }
  return glints;
}

function getBiomeSoftAlphaMap(key: string): THREE.Texture {
  const cached = biomeSoftAlphaMapCache.get(key);
  if (cached) return cached;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    if (key.includes('waterline') || key.includes('foam') || key.includes('shallow-mineral-edge')) {
      for (let i = 0; i < 30; i += 1) {
        const x = seededNoise(key, i) * size;
        const y = seededNoise(key, i + 100) * size;
        ctx.globalAlpha = 0.16 + seededNoise(key, i + 200) * 0.28;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(x, y, 12 + seededNoise(key, i + 300) * 38, 1.2 + seededNoise(key, i + 400) * 3.8, seededSigned(key, i + 500) * 0.26, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 18; i += 1) {
        const x = seededNoise(key, i + 700) * size;
        const y = seededNoise(key, i + 900) * size;
        ctx.globalAlpha = 0.18 + seededNoise(key, i + 1100) * 0.34;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(x, y, 8 + seededNoise(key, i + 1300) * 28, 3 + seededNoise(key, i + 1500) * 9, seededNoise(key, i + 1700) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    } else if (key.includes('lake-glints') || key.includes('lake-ripple')) {
      for (let i = 0; i < 18; i += 1) {
        const x = seededNoise(key, i) * size;
        const y = seededNoise(key, i + 100) * size;
        ctx.globalAlpha = key.includes('ripple') ? 0.28 : 0.36;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(x, y, 14 + seededNoise(key, i + 200) * 32, 0.8 + seededNoise(key, i + 300) * 1.8, seededNoise(key, i + 400) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const gradient = ctx.createRadialGradient(size * 0.5, size * 0.5, 2, size * 0.5, size * 0.5, size * 0.56);
      gradient.addColorStop(0, 'rgba(255,255,255,0.92)');
      gradient.addColorStop(0.48, 'rgba(255,255,255,0.42)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      ctx.globalCompositeOperation = key.includes('wind') ? 'destination-out' : 'source-over';
      for (let i = 0; i < 22; i += 1) {
        const x = seededNoise(key, i) * size;
        const y = seededNoise(key, i + 100) * size;
        ctx.globalAlpha = key.includes('wind') ? 0.18 : 0.12;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(x, y, 4 + seededNoise(key, i + 200) * 18, 1.4 + seededNoise(key, i + 300) * 4, seededNoise(key, i + 400) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  biomeSoftAlphaMapCache.set(key, texture);
  return texture;
}

function getBiomePatternTexture(key: string): THREE.Texture {
  const cached = biomePatternTextureCache.get(key);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const isWater = key.includes('water');
    const isLakeBed = key.includes('lake-bed');
    const isWetland = key.includes('wetland');
    const isNormal = key.includes('normal');
    ctx.fillStyle = isNormal
      ? 'rgb(128,128,255)'
      : isWater
        ? '#2d8799'
        : isLakeBed
          ? '#31443d'
          : isWetland
            ? '#2f5143'
            : '#678d50';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 220; i += 1) {
      const x = seededNoise(key, i) * size;
      const y = seededNoise(key, i + 300) * size;
      const length = (isWater ? 18 : 5) + seededNoise(key, i + 600) * (isWater ? 42 : 26);
      const width = (isWater ? 0.8 : 1.2) + seededNoise(key, i + 900) * (isWater ? 2.2 : 5.5);
      const alpha = 0.08 + seededNoise(key, i + 1200) * 0.18;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((isWater ? -0.22 : seededNoise(key, i + 1500) * Math.PI) + seededSigned(key, i + 1800) * 0.32);
      ctx.globalAlpha = alpha;
      if (isNormal) {
        const r = Math.floor(118 + seededSigned(key, i + 2100) * 34);
        const g = Math.floor(128 + seededSigned(key, i + 2400) * 34);
        ctx.fillStyle = `rgb(${r},${g},255)`;
      } else if (isWater) {
        ctx.fillStyle = seededNoise(key, i + 2700) > 0.5 ? '#79d5dd' : '#0d4158';
      } else if (isLakeBed || isWetland) {
        ctx.fillStyle = seededNoise(key, i + 2700) > 0.55 ? '#789070' : '#1f352e';
      } else {
        ctx.fillStyle = seededNoise(key, i + 2700) > 0.58 ? '#b5ca74' : '#23452f';
      }
      ctx.beginPath();
      ctx.ellipse(0, 0, length, width, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (isWater && !isNormal) {
      const gradient = ctx.createLinearGradient(0, 0, size, size);
      gradient.addColorStop(0, 'rgba(255,255,255,0.06)');
      gradient.addColorStop(0.52, 'rgba(255,255,255,0)');
      gradient.addColorStop(1, 'rgba(0,20,36,0.22)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.globalAlpha = 1;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(key.includes('water') ? 2.8 : 3.4, key.includes('water') ? 2.0 : 3.4);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  texture.colorSpace = key.includes('normal') ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  biomePatternTextureCache.set(key, texture);
  return texture;
}

function getBiomeBladeAlphaMap(key: string): THREE.Texture {
  const cached = biomeBladeAlphaMapCache.get(key);
  if (cached) return cached;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    const bladeCount = key.includes('reed') ? 6 : 9;
    for (let i = 0; i < bladeCount; i += 1) {
      const baseX = size * (0.18 + i * (0.64 / Math.max(1, bladeCount - 1))) + seededSigned(key, i) * 4;
      const tipX = baseX + seededSigned(key, i + 100) * (key.includes('reed') ? 5 : 10);
      const baseWidth = key.includes('reed') ? 4.6 : 3.1;
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(baseX - baseWidth, size);
      ctx.quadraticCurveTo(baseX - 5, size * 0.58, tipX, size * (0.04 + seededNoise(key, i + 200) * 0.14));
      ctx.quadraticCurveTo(baseX + 5, size * 0.58, baseX + baseWidth, size);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  biomeBladeAlphaMapCache.set(key, texture);
  return texture;
}

function DecalLayer({ activeIds }: { readonly activeIds: ReadonlySet<WorldChunkId> }): React.ReactElement {
  const decals = DECALS.filter((decal) => activeIds.has(decal.chunkId));
  return (
    <group name="surface-decals">
      {decals.map((decal) => (
        <SurfaceDecal key={decal.id} decal={decal} />
      ))}
    </group>
  );
}

function SurfaceDecal({ decal }: { readonly decal: typeof DECALS[number] }): React.ReactElement {
  const textureId = getDecalTextureId(decal.id);
  const textures = useMemo(() => createWorldDecalSet(textureId), [textureId]);
  const normalScale = useMemo(() => new THREE.Vector2(getDecalNormalScale(textureId), getDecalNormalScale(textureId)), [textureId]);

  return (
    <mesh
      name={`runtime-surface-decal:${decal.id}:${textureId}`}
      position={decal.position as [number, number, number]}
      rotation={decal.rotation as [number, number, number]}
      scale={decal.scale as [number, number, number]}
      renderOrder={4}
    >
      <planeGeometry args={[1, 1, 1, 1]} />
      <meshStandardMaterial
        color={decal.color}
        map={textures.albedo}
        normalMap={textures.normal}
        normalScale={normalScale}
        roughnessMap={textures.roughness}
        transparent
        opacity={Math.min(0.78, decal.opacity * 1.28)}
        alphaTest={0.018}
        roughness={0.9}
        metalness={0}
        envMapIntensity={0.16}
        depthWrite={false}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-4}
      />
    </mesh>
  );
}

function getDecalTextureId(id: string): WorldDecalTextureId {
  if (id.includes('impact')) return 'impact';
  if (id.includes('crack')) return 'crack';
  if (id.includes('rune') || id.includes('chalk')) return 'rune-wear';
  if (id.includes('gold') || id.includes('inlay') || id.includes('wear') || id.includes('carpet')) return 'metal-wear';
  if (id.includes('ink') || id.includes('wine') || id.includes('spill')) return 'spill';
  if (id.includes('dust') || id.includes('pollen')) return 'dust';
  if (id.includes('leaf') || id.includes('grass') || id.includes('soil')) return 'organic-litter';
  if (id.includes('wet') || id.includes('mineral') || id.includes('water')) return 'mineral-stain';
  return 'grime';
}

function getDecalNormalScale(textureId: WorldDecalTextureId): number {
  if (textureId === 'crack' || textureId === 'impact') return 0.32;
  if (textureId === 'rune-wear' || textureId === 'metal-wear') return 0.22;
  if (textureId === 'organic-litter' || textureId === 'mineral-stain') return 0.18;
  return 0.12;
}

interface MacroSurfaceDecalInstance {
  readonly key: string;
  readonly textureId: WorldDecalTextureId;
  readonly position: ThreeVec3Tuple;
  readonly rotation: ThreeVec3Tuple;
  readonly scale: ThreeVec3Tuple;
  readonly color: number;
}

function MacroSurfaceDecalLayer({ activeChunks }: { readonly activeChunks: readonly WorldChunkDefinition[] }): React.ReactElement {
  const instances = useMemo(() => activeChunks.flatMap((chunk) => createMacroSurfaceDecals(chunk)), [activeChunks]);
  const grouped = useMemo(() => {
    const groups = new Map<WorldDecalTextureId, MacroSurfaceDecalInstance[]>();
    for (const instance of instances) {
      const current = groups.get(instance.textureId);
      if (current) current.push(instance);
      else groups.set(instance.textureId, [instance]);
    }
    return [...groups.entries()].map(([textureId, decals]) => ({ textureId, decals }));
  }, [instances]);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      macroDecals: String(instances.length),
    };
  }, [instances.length]);

  return (
    <group name="macro-surface-decal-layer">
      {grouped.map((group) => (
        <MacroSurfaceDecalGroup
          key={group.textureId}
          textureId={group.textureId}
          decals={group.decals}
        />
      ))}
    </group>
  );
}

function MacroSurfaceDecalGroup({
  textureId,
  decals,
}: {
  readonly textureId: WorldDecalTextureId;
  readonly decals: readonly MacroSurfaceDecalInstance[];
}): React.ReactElement {
  const textures = useMemo(() => createWorldDecalSet(textureId), [textureId]);
  const normalScale = useMemo(() => new THREE.Vector2(getDecalNormalScale(textureId) * 0.8, getDecalNormalScale(textureId) * 0.8), [textureId]);
  const opacity = getMacroDecalOpacity(textureId);
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    name: `runtime-macro-surface-decal:${textureId}`,
    color: 0xffffff,
    map: textures.albedo,
    normalMap: textures.normal,
    normalScale,
    roughnessMap: textures.roughness,
    transparent: true,
    opacity,
    alphaTest: 0.012,
    roughness: 0.92,
    metalness: 0,
    envMapIntensity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -1,
  }), [normalScale, opacity, textureId, textures]);

  return (
    <Instances name={`instanced-macro-surface-decals:${textureId}`} limit={decals.length} range={decals.length} material={material} renderOrder={5}>
      <planeGeometry args={[1, 1, 1, 1]} />
      {decals.map((decal) => (
        <Instance
          key={decal.key}
          position={decal.position}
          rotation={decal.rotation}
          scale={decal.scale}
          color={decal.color}
        />
      ))}
    </Instances>
  );
}

function getMacroDecalOpacity(textureId: WorldDecalTextureId): number {
  if (textureId === 'dust') return 0.3;
  if (textureId === 'organic-litter') return 0.34;
  if (textureId === 'mineral-stain') return 0.28;
  if (textureId === 'rune-wear' || textureId === 'metal-wear') return 0.24;
  if (textureId === 'impact' || textureId === 'crack') return 0.36;
  return 0.32;
}

function createMacroSurfaceDecals(chunk: WorldChunkDefinition): MacroSurfaceDecalInstance[] {
  const decals: MacroSurfaceDecalInstance[] = [];
  const centerX = (chunk.bounds.minX + chunk.bounds.maxX) / 2;
  const centerZ = (chunk.bounds.minZ + chunk.bounds.maxZ) / 2;
  const width = chunk.bounds.maxX - chunk.bounds.minX;
  const depth = chunk.bounds.maxZ - chunk.bounds.minZ;
  const baseY = chunk.region === 'exterior' || chunk.region === 'cavern' ? 0.166 : 0.172;
  const seed = chunk.id;

  const add = (
    index: number,
    textureId: WorldDecalTextureId,
    x: number,
    z: number,
    sx: number,
    sz: number,
    color: number,
    angleOffset = 0,
  ) => {
    const jitterX = seededSigned(seed, index * 17 + 1) * Math.min(0.9, width * 0.035);
    const jitterZ = seededSigned(seed, index * 17 + 2) * Math.min(0.9, depth * 0.035);
    decals.push({
      key: `${chunk.id}:${textureId}:${index}`,
      textureId,
      position: [x + jitterX, baseY + index * 0.0004, z + jitterZ],
      rotation: [-Math.PI / 2, 0, angleOffset + seededSigned(seed, index * 17 + 3) * Math.PI],
      scale: [
        sx * (0.84 + seededNoise(seed, index * 17 + 4) * 0.36),
        sz * (0.82 + seededNoise(seed, index * 17 + 5) * 0.4),
        1,
      ],
      color,
    });
  };

  const pathCount = chunk.region === 'interior' ? 7 : chunk.region === 'combat' ? 9 : 8;
  for (let i = 0; i < pathCount; i += 1) {
    const t = (i + 1) / (pathCount + 1);
    const curve = Math.sin(t * Math.PI * 2 + seededSigned(seed, 91) * 0.8);
    const x = centerX + (t - 0.5) * width * 0.72 + curve * width * 0.08;
    const z = centerZ + curve * depth * 0.16;
    const textureId = i % 3 === 0
      ? 'dust'
      : i % 3 === 1
        ? chunk.region === 'combat' ? 'impact' : 'grime'
        : chunk.region === 'cavern' ? 'mineral-stain' : 'crack';
    const color = getMacroDecalColor(chunk, textureId, i);
    add(i, textureId, x, z, width * 0.12, depth * 0.045, color, 0.2);
  }

  const cornerCount = chunk.region === 'interior' ? 5 : 7;
  for (let i = 0; i < cornerCount; i += 1) {
    const side = i % 4;
    const x = side === 0 ? chunk.bounds.minX + width * 0.12 : side === 1 ? chunk.bounds.maxX - width * 0.12 : centerX + seededSigned(seed, i + 130) * width * 0.36;
    const z = side === 2 ? chunk.bounds.minZ + depth * 0.12 : side === 3 ? chunk.bounds.maxZ - depth * 0.12 : centerZ + seededSigned(seed, i + 170) * depth * 0.36;
    const textureId = chunk.region === 'exterior'
      ? 'organic-litter'
      : chunk.region === 'cavern'
        ? 'mineral-stain'
        : i % 2 === 0 ? 'grime' : 'dust';
    add(40 + i, textureId, x, z, width * 0.075, depth * 0.065, getMacroDecalColor(chunk, textureId, i + 40), 0.6);
  }

  if (chunk.region === 'interior') {
    for (let i = 0; i < 4; i += 1) {
      const textureId: WorldDecalTextureId = i % 2 === 0 ? 'metal-wear' : 'rune-wear';
      add(
        80 + i,
        textureId,
        centerX + seededSigned(seed, i + 220) * width * 0.28,
        centerZ + seededSigned(seed, i + 260) * depth * 0.28,
        width * 0.095,
        depth * 0.035,
        getMacroDecalColor(chunk, textureId, i + 80),
        Math.PI / 2,
      );
    }
  }

  if (chunk.region === 'exterior' || chunk.region === 'cavern') {
    for (let i = 0; i < 5; i += 1) {
      const textureId: WorldDecalTextureId = chunk.region === 'cavern' ? 'mineral-stain' : 'organic-litter';
      add(
        100 + i,
        textureId,
        centerX + seededSigned(seed, i + 320) * width * 0.4,
        centerZ + seededSigned(seed, i + 360) * depth * 0.4,
        width * 0.08,
        depth * 0.08,
        getMacroDecalColor(chunk, textureId, i + 100),
        0.1,
      );
    }
  }

  return decals;
}

function getMacroDecalColor(
  chunk: WorldChunkDefinition,
  textureId: WorldDecalTextureId,
  index: number,
): number {
  const tint = new THREE.Color(chunk.palette.floor);
  const accent = new THREE.Color(chunk.palette.accent);
  const dark = new THREE.Color(0x10131a);
  const cool = new THREE.Color(chunk.palette.emissive);
  const mix = 0.16 + seededNoise(chunk.id, index + 700) * 0.24;

  if (textureId === 'dust') return tint.clone().lerp(new THREE.Color(0xd5ccb8), 0.46 + mix).getHex();
  if (textureId === 'metal-wear' || textureId === 'rune-wear') return accent.clone().lerp(new THREE.Color(0xf4dfa0), 0.28 + mix).getHex();
  if (textureId === 'organic-litter') return new THREE.Color(0x314f36).lerp(tint, 0.18 + mix).getHex();
  if (textureId === 'mineral-stain') return cool.clone().lerp(new THREE.Color(0x2d6570), 0.44 + mix).getHex();
  if (textureId === 'impact' || textureId === 'crack') return dark.clone().lerp(tint, 0.18 + mix).getHex();
  return dark.clone().lerp(tint, 0.22 + mix).getHex();
}

type MaterialWeatheringKind =
  | 'wet-sheen'
  | 'edge-dust'
  | 'wax-polish'
  | 'chalk-scuff'
  | 'mineral-film';

interface MaterialWeatheringPatch {
  readonly key: string;
  readonly kind: MaterialWeatheringKind;
  readonly position: ThreeVec3Tuple;
  readonly rotation: ThreeVec3Tuple;
  readonly scale: ThreeVec3Tuple;
  readonly color: number;
}

function MaterialWeatheringLayer({ activeChunks }: { readonly activeChunks: readonly WorldChunkDefinition[] }): React.ReactElement {
  const patches = useMemo(() => activeChunks.flatMap((chunk) => createMaterialWeatheringPatches(chunk)), [activeChunks]);
  const grouped = useMemo(() => {
    const groups = new Map<MaterialWeatheringKind, MaterialWeatheringPatch[]>();
    for (const patch of patches) {
      const current = groups.get(patch.kind);
      if (current) current.push(patch);
      else groups.set(patch.kind, [patch]);
    }
    return [...groups.entries()].map(([kind, items]) => ({ kind, items }));
  }, [patches]);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      materialWeatheringPatches: String(patches.length),
    };
  }, [patches.length]);

  return (
    <group name="runtime-material-weathering-layer">
      {grouped.map((group) => (
        <MaterialWeatheringGroup
          key={group.kind}
          kind={group.kind}
          patches={group.items}
        />
      ))}
    </group>
  );
}

function MaterialWeatheringGroup({
  kind,
  patches,
}: {
  readonly kind: MaterialWeatheringKind;
  readonly patches: readonly MaterialWeatheringPatch[];
}): React.ReactElement {
  const baseOpacity = getMaterialWeatheringOpacity(kind);
  const material = useMemo(() => createMaterialWeatheringMaterial(kind, baseOpacity), [baseOpacity, kind]);

  useFrame(({ clock }) => {
    if (kind !== 'wet-sheen' && kind !== 'mineral-film' && kind !== 'wax-polish') return;
    material.opacity = baseOpacity + Math.sin(clock.elapsedTime * 0.42 + kind.length) * 0.012;
  });

  return (
    <Instances
      name={`instanced-material-weathering:${kind}`}
      limit={patches.length}
      range={patches.length}
      material={material}
      renderOrder={getMaterialWeatheringRenderOrder(kind)}
    >
      <planeGeometry args={[1, 1, 1, 1]} />
      {patches.map((patch) => (
        <Instance
          key={patch.key}
          position={patch.position}
          rotation={patch.rotation}
          scale={patch.scale}
          color={patch.color}
        />
      ))}
    </Instances>
  );
}

function createMaterialWeatheringMaterial(kind: MaterialWeatheringKind, opacity: number): THREE.MeshStandardMaterial {
  const textureId = getMaterialWeatheringTextureId(kind);
  const textures = createWorldDecalSet(textureId);
  const normalScale = kind === 'wet-sheen'
    ? 0.08
    : kind === 'mineral-film'
      ? 0.12
      : kind === 'chalk-scuff'
        ? 0.18
        : 0.1;
  const shared = {
    name: `runtime-material-weathering:${kind}`,
    color: 0xffffff,
    map: textures.albedo,
    normalMap: textures.normal,
    normalScale: new THREE.Vector2(normalScale, normalScale),
    roughnessMap: textures.roughness,
    transparent: true,
    opacity,
    alphaTest: 0.015,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -7,
    polygonOffsetUnits: -1,
  };

  if (kind === 'wet-sheen' || kind === 'wax-polish' || kind === 'mineral-film') {
    return new THREE.MeshPhysicalMaterial({
      ...shared,
      roughness: kind === 'mineral-film' ? 0.2 : 0.16,
      metalness: 0,
      clearcoat: kind === 'wax-polish' ? 0.72 : 0.92,
      clearcoatRoughness: kind === 'wet-sheen' ? 0.08 : 0.18,
      envMapIntensity: kind === 'wet-sheen' ? 1.25 : 0.82,
      blending: kind === 'wet-sheen' ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
  }

  return new THREE.MeshStandardMaterial({
    ...shared,
    roughness: kind === 'edge-dust' ? 0.96 : 0.86,
    metalness: 0,
    envMapIntensity: 0.1,
    blending: THREE.NormalBlending,
  });
}

function getMaterialWeatheringTextureId(kind: MaterialWeatheringKind): WorldDecalTextureId {
  if (kind === 'wet-sheen') return 'spill';
  if (kind === 'wax-polish') return 'metal-wear';
  if (kind === 'chalk-scuff') return 'rune-wear';
  if (kind === 'mineral-film') return 'mineral-stain';
  return 'dust';
}

function getMaterialWeatheringOpacity(kind: MaterialWeatheringKind): number {
  if (kind === 'wet-sheen') return 0.11;
  if (kind === 'wax-polish') return 0.13;
  if (kind === 'mineral-film') return 0.16;
  if (kind === 'chalk-scuff') return 0.22;
  return 0.24;
}

function getMaterialWeatheringRenderOrder(kind: MaterialWeatheringKind): number {
  if (kind === 'wet-sheen' || kind === 'wax-polish' || kind === 'mineral-film') return 8;
  return 4;
}

function createMaterialWeatheringPatches(chunk: WorldChunkDefinition): MaterialWeatheringPatch[] {
  const patches: MaterialWeatheringPatch[] = [];
  const b = chunk.bounds;
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  const centerX = (b.minX + b.maxX) / 2;
  const centerZ = (b.minZ + b.maxZ) / 2;
  const seed = `${chunk.id}:material-weathering`;
  const count = chunk.region === 'interior'
    ? 9
    : chunk.region === 'combat'
      ? 10
      : chunk.region === 'cavern'
        ? 12
        : 11;
  const baseY = chunk.region === 'interior' ? 0.181 : 0.176;

  for (let i = 0; i < count; i += 1) {
    const kind = getMaterialWeatheringKind(chunk, i);
    const nearEdge = i % 4 === 0;
    const edge = i % 4;
    const x = nearEdge
      ? edge < 2
        ? centerX + seededSigned(seed, i + 11) * width * 0.34
        : edge === 2
          ? b.minX + width * 0.08
          : b.maxX - width * 0.08
      : b.minX + width * (0.12 + seededNoise(seed, i + 17) * 0.76);
    const z = nearEdge
      ? edge < 2
        ? edge === 0
          ? b.minZ + depth * 0.1
          : b.maxZ - depth * 0.1
        : centerZ + seededSigned(seed, i + 23) * depth * 0.34
      : b.minZ + depth * (0.14 + seededNoise(seed, i + 29) * 0.72);
    const strip = kind === 'edge-dust' || kind === 'chalk-scuff';
    const scaleX = strip
      ? width * (0.14 + seededNoise(seed, i + 31) * 0.12)
      : width * (0.07 + seededNoise(seed, i + 37) * 0.08);
    const scaleZ = strip
      ? depth * (0.035 + seededNoise(seed, i + 41) * 0.045)
      : depth * (0.05 + seededNoise(seed, i + 43) * 0.06);
    const angle = (nearEdge && edge >= 2 ? Math.PI / 2 : 0) + seededSigned(seed, i + 47) * 0.52;

    patches.push({
      key: `${chunk.id}:${kind}:${i}`,
      kind,
      position: [x, baseY + i * 0.00035, z],
      rotation: [-Math.PI / 2, 0, angle],
      scale: [scaleX, scaleZ, 1],
      color: getMaterialWeatheringColor(chunk, kind, i),
    });
  }

  return patches;
}

function getMaterialWeatheringKind(chunk: WorldChunkDefinition, index: number): MaterialWeatheringKind {
  if (chunk.region === 'cavern') {
    if (index % 2 === 0) return 'mineral-film';
    if (index % 5 === 0) return 'wet-sheen';
    return 'edge-dust';
  }
  if (chunk.region === 'combat') {
    if (index % 3 === 0) return 'chalk-scuff';
    if (index % 7 === 0) return 'wet-sheen';
    return 'edge-dust';
  }
  if (chunk.id === 'dining-hall') {
    if (index % 3 === 0) return 'wax-polish';
    if (index % 5 === 0) return 'wet-sheen';
    return 'edge-dust';
  }
  if (chunk.region === 'exterior') {
    if (index % 4 === 0) return 'wet-sheen';
    if (index % 6 === 0) return 'mineral-film';
    return 'edge-dust';
  }
  if (index % 4 === 0) return 'wax-polish';
  if (index % 6 === 0) return 'chalk-scuff';
  return 'edge-dust';
}

function getMaterialWeatheringColor(
  chunk: WorldChunkDefinition,
  kind: MaterialWeatheringKind,
  index: number,
): number {
  const floor = new THREE.Color(chunk.palette.floor);
  const accent = new THREE.Color(chunk.palette.accent);
  const emissive = new THREE.Color(chunk.palette.emissive);
  const variance = seededNoise(chunk.id, index + 2300) * 0.22;

  if (kind === 'wet-sheen') return emissive.clone().lerp(new THREE.Color(0xd9f5ff), 0.26 + variance).getHex();
  if (kind === 'wax-polish') return accent.clone().lerp(new THREE.Color(0xffe0a8), 0.24 + variance).getHex();
  if (kind === 'chalk-scuff') return new THREE.Color(0xd6cfba).lerp(accent, 0.14 + variance).getHex();
  if (kind === 'mineral-film') return emissive.clone().lerp(new THREE.Color(0x86d4cf), 0.22 + variance).getHex();
  return floor.clone().lerp(new THREE.Color(0xc8c0ac), 0.28 + variance).getHex();
}

function seededNoise(seed: string, salt: number): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= salt + 0x9e3779b9;
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
}

function seededSigned(seed: string, salt: number): number {
  return seededNoise(seed, salt) * 2 - 1;
}

type ContactPatinaKind =
  | 'ground-occlusion'
  | 'traffic-dust'
  | 'edge-polish'
  | 'wet-contact'
  | 'ritual-chalk';

interface ContactPatinaMark {
  readonly key: string;
  readonly kind: ContactPatinaKind;
  readonly position: ThreeVec3Tuple;
  readonly rotation: ThreeVec3Tuple;
  readonly scale: ThreeVec3Tuple;
  readonly color: number;
}

function ContactPatinaLayer({ activeChunks }: { readonly activeChunks: readonly WorldChunkDefinition[] }): React.ReactElement {
  const marks = useMemo(() => activeChunks.flatMap((chunk) => createContactPatinaMarks(chunk)), [activeChunks]);
  const grouped = useMemo(() => {
    const groups = new Map<ContactPatinaKind, ContactPatinaMark[]>();
    for (const mark of marks) {
      const current = groups.get(mark.kind);
      if (current) current.push(mark);
      else groups.set(mark.kind, [mark]);
    }
    return [...groups.entries()].map(([kind, items]) => ({ kind, items }));
  }, [marks]);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      contactPatinaMarks: String(marks.length),
    };
  }, [marks.length]);

  return (
    <group name="runtime-contact-patina-layer">
      {grouped.map((group) => (
        <ContactPatinaGroup key={group.kind} kind={group.kind} marks={group.items} />
      ))}
    </group>
  );
}

function ContactPatinaGroup({
  kind,
  marks,
}: {
  readonly kind: ContactPatinaKind;
  readonly marks: readonly ContactPatinaMark[];
}): React.ReactElement {
  const baseOpacity = getContactPatinaOpacity(kind);
  const material = useMemo(() => createContactPatinaMaterial(kind, baseOpacity), [baseOpacity, kind]);

  useFrame(({ clock }) => {
    if (kind !== 'wet-contact' && kind !== 'edge-polish') return;
    material.opacity = baseOpacity + Math.sin(clock.elapsedTime * 0.33 + kind.length) * 0.01;
  });

  return (
    <Instances
      name={`instanced-contact-patina:${kind}`}
      limit={marks.length}
      range={marks.length}
      material={material}
      renderOrder={getContactPatinaRenderOrder(kind)}
    >
      <planeGeometry args={[1, 1, 1, 1]} />
      {marks.map((mark) => (
        <Instance
          key={mark.key}
          position={mark.position}
          rotation={mark.rotation}
          scale={mark.scale}
          color={mark.color}
        />
      ))}
    </Instances>
  );
}

function createContactPatinaMaterial(kind: ContactPatinaKind, opacity: number): THREE.MeshStandardMaterial {
  const textureId = getContactPatinaTextureId(kind);
  const textures = createWorldDecalSet(textureId);
  const normalStrength = kind === 'ritual-chalk'
    ? 0.22
    : kind === 'edge-polish'
      ? 0.14
      : kind === 'wet-contact'
        ? 0.08
        : 0.12;
  const shared = {
    name: `runtime-contact-patina:${kind}`,
    color: 0xffffff,
    map: textures.albedo,
    normalMap: textures.normal,
    normalScale: new THREE.Vector2(normalStrength, normalStrength),
    roughnessMap: textures.roughness,
    transparent: true,
    opacity,
    alphaTest: 0.01,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -8,
    polygonOffsetUnits: -1,
  };

  if (kind === 'wet-contact' || kind === 'edge-polish') {
    return new THREE.MeshPhysicalMaterial({
      ...shared,
      roughness: kind === 'wet-contact' ? 0.18 : 0.24,
      metalness: kind === 'edge-polish' ? 0.12 : 0,
      clearcoat: kind === 'wet-contact' ? 0.9 : 0.58,
      clearcoatRoughness: kind === 'wet-contact' ? 0.08 : 0.18,
      envMapIntensity: kind === 'wet-contact' ? 0.95 : 0.7,
      blending: kind === 'wet-contact' ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
  }

  return new THREE.MeshStandardMaterial({
    ...shared,
    roughness: kind === 'ground-occlusion' ? 0.98 : 0.9,
    metalness: 0,
    envMapIntensity: 0.08,
    blending: THREE.NormalBlending,
  });
}

function getContactPatinaTextureId(kind: ContactPatinaKind): WorldDecalTextureId {
  if (kind === 'edge-polish') return 'metal-wear';
  if (kind === 'wet-contact') return 'spill';
  if (kind === 'ritual-chalk') return 'rune-wear';
  if (kind === 'traffic-dust') return 'dust';
  return 'grime';
}

function getContactPatinaOpacity(kind: ContactPatinaKind): number {
  if (kind === 'ground-occlusion') return 0.32;
  if (kind === 'traffic-dust') return 0.27;
  if (kind === 'edge-polish') return 0.18;
  if (kind === 'wet-contact') return 0.13;
  return 0.2;
}

function getContactPatinaRenderOrder(kind: ContactPatinaKind): number {
  if (kind === 'wet-contact' || kind === 'edge-polish') return 9;
  if (kind === 'ritual-chalk') return 8;
  return 6;
}

function createContactPatinaMarks(chunk: WorldChunkDefinition): ContactPatinaMark[] {
  const marks: ContactPatinaMark[] = [];
  const b = chunk.bounds;
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  const centerX = (b.minX + b.maxX) / 2;
  const centerZ = (b.minZ + b.maxZ) / 2;
  const seed = `${chunk.id}:contact-patina`;
  const baseY = chunk.region === 'interior' ? 0.188 : 0.184;

  const add = (
    index: number,
    kind: ContactPatinaKind,
    x: number,
    z: number,
    sx: number,
    sz: number,
    angle: number,
  ) => {
    const jitterX = seededSigned(seed, index + 11) * Math.min(0.32, width * 0.018);
    const jitterZ = seededSigned(seed, index + 19) * Math.min(0.32, depth * 0.018);
    marks.push({
      key: `${chunk.id}:${kind}:${index}`,
      kind,
      position: [x + jitterX, baseY + index * 0.00025, z + jitterZ],
      rotation: [-Math.PI / 2, 0, angle + seededSigned(seed, index + 23) * 0.18],
      scale: [
        sx * (0.86 + seededNoise(seed, index + 31) * 0.28),
        sz * (0.84 + seededNoise(seed, index + 37) * 0.32),
        1,
      ],
      color: getContactPatinaColor(chunk, kind, index),
    });
  };

  const edgeInset = chunk.region === 'interior' ? 0.74 : 1.1;
  add(0, 'ground-occlusion', centerX, b.minZ + edgeInset, width * 0.36, depth * 0.025, 0);
  add(1, 'ground-occlusion', centerX, b.maxZ - edgeInset, width * 0.34, depth * 0.024, 0.04);
  add(2, 'ground-occlusion', b.minX + edgeInset, centerZ, depth * 0.24, width * 0.024, Math.PI / 2);
  add(3, 'ground-occlusion', b.maxX - edgeInset, centerZ, depth * 0.24, width * 0.024, Math.PI / 2);

  const trafficCount = chunk.region === 'interior' ? 7 : chunk.region === 'cavern' ? 8 : 6;
  for (let i = 0; i < trafficCount; i += 1) {
    const t = (i + 1) / (trafficCount + 1);
    const curve = Math.sin(t * Math.PI * 2 + seededSigned(seed, 101) * 0.8);
    const x = b.minX + width * (0.16 + t * 0.68) + curve * width * 0.035;
    const z = centerZ + curve * depth * 0.18 + seededSigned(seed, i + 105) * depth * 0.08;
    const kind: ContactPatinaKind = chunk.region === 'cavern'
      ? i % 3 === 0 ? 'wet-contact' : 'traffic-dust'
      : chunk.region === 'combat'
        ? i % 2 === 0 ? 'ritual-chalk' : 'traffic-dust'
        : i % 4 === 0 ? 'edge-polish' : 'traffic-dust';
    add(10 + i, kind, x, z, width * 0.095, depth * 0.026, seededSigned(seed, i + 111) * 0.45);
  }

  const contactCount = chunk.region === 'exterior' ? 8 : 7;
  for (let i = 0; i < contactCount; i += 1) {
    const nearHero = i < 2;
    const x = nearHero
      ? chunk.heroLight[0] + seededSigned(seed, i + 151) * 1.8
      : b.minX + width * (0.16 + seededNoise(seed, i + 161) * 0.68);
    const z = nearHero
      ? chunk.heroLight[2] + seededSigned(seed, i + 171) * 1.8
      : b.minZ + depth * (0.16 + seededNoise(seed, i + 181) * 0.68);
    const kind: ContactPatinaKind = chunk.region === 'exterior'
      ? i % 3 === 0 ? 'wet-contact' : 'ground-occlusion'
      : chunk.id === 'dining-hall'
        ? i % 3 === 0 ? 'wet-contact' : 'ground-occlusion'
        : 'ground-occlusion';
    add(30 + i, kind, x, z, width * 0.052, depth * 0.044, seededNoise(seed, i + 191) * Math.PI);
  }

  const polishCount = chunk.region === 'interior' ? 4 : 3;
  for (let i = 0; i < polishCount; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = centerX + side * width * (0.18 + seededNoise(seed, i + 211) * 0.22);
    const z = centerZ + seededSigned(seed, i + 221) * depth * 0.3;
    const kind: ContactPatinaKind = chunk.region === 'combat' ? 'ritual-chalk' : chunk.region === 'cavern' ? 'wet-contact' : 'edge-polish';
    add(50 + i, kind, x, z, width * 0.04, depth * 0.018, Math.PI / 2 + seededSigned(seed, i + 231) * 0.5);
  }

  if (chunk.id === 'lake-grotto' || chunk.id === 'crystal-greenhouse') {
    for (let i = 0; i < 4; i += 1) {
      add(
        70 + i,
        'wet-contact',
        centerX + seededSigned(seed, i + 251) * width * 0.32,
        centerZ + seededSigned(seed, i + 261) * depth * 0.32,
        width * 0.05,
        depth * 0.038,
        seededNoise(seed, i + 271) * Math.PI,
      );
    }
  }

  return marks;
}

function getContactPatinaColor(
  chunk: WorldChunkDefinition,
  kind: ContactPatinaKind,
  index: number,
): number {
  const floor = new THREE.Color(chunk.palette.floor);
  const wall = new THREE.Color(chunk.palette.wall);
  const accent = new THREE.Color(chunk.palette.accent);
  const emissive = new THREE.Color(chunk.palette.emissive);
  const variance = seededNoise(`${chunk.id}:${kind}`, index + 900) * 0.24;

  if (kind === 'ground-occlusion') return new THREE.Color(0x090b10).lerp(floor, 0.26 + variance).getHex();
  if (kind === 'traffic-dust') return floor.clone().lerp(new THREE.Color(0xd7ccb6), 0.34 + variance).getHex();
  if (kind === 'edge-polish') return accent.clone().lerp(new THREE.Color(0xffe8a8), 0.32 + variance).getHex();
  if (kind === 'wet-contact') return emissive.clone().lerp(new THREE.Color(0xe8fbff), 0.18 + variance).getHex();
  return wall.clone().lerp(new THREE.Color(0xf0e5c9), 0.42 + variance).getHex();
}

type RaisedInlayKind =
  | 'brass-seam'
  | 'stone-threshold'
  | 'glow-channel';

interface RaisedInlaySegment {
  readonly key: string;
  readonly kind: RaisedInlayKind;
  readonly position: ThreeVec3Tuple;
  readonly rotation: ThreeVec3Tuple;
  readonly scale: ThreeVec3Tuple;
  readonly color: number;
}

function RaisedInlayLayer({ activeChunks }: { readonly activeChunks: readonly WorldChunkDefinition[] }): React.ReactElement {
  const segments = useMemo(() => activeChunks.flatMap((chunk) => createRaisedInlaySegments(chunk)), [activeChunks]);
  const grouped = useMemo(() => {
    const groups = new Map<RaisedInlayKind, RaisedInlaySegment[]>();
    for (const segment of segments) {
      const current = groups.get(segment.kind);
      if (current) current.push(segment);
      else groups.set(segment.kind, [segment]);
    }
    return [...groups.entries()].map(([kind, items]) => ({ kind, items }));
  }, [segments]);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      raisedInlaySegments: String(segments.length),
    };
  }, [segments.length]);

  return (
    <group name="runtime-raised-inlay-layer">
      {grouped.map((group) => (
        <RaisedInlayGroup key={group.kind} kind={group.kind} segments={group.items} />
      ))}
    </group>
  );
}

function RaisedInlayGroup({
  kind,
  segments,
}: {
  readonly kind: RaisedInlayKind;
  readonly segments: readonly RaisedInlaySegment[];
}): React.ReactElement {
  const material = useMemo(() => createRaisedInlayMaterial(kind), [kind]);

  return (
    <Instances
      name={`instanced-raised-inlay:${kind}`}
      limit={segments.length}
      range={segments.length}
      material={material}
      castShadow={kind !== 'glow-channel'}
      receiveShadow={kind !== 'glow-channel'}
      renderOrder={kind === 'glow-channel' ? 7 : 4}
    >
      <boxGeometry args={[1, 1, 1, 1, 1, 1]} />
      {segments.map((segment) => (
        <Instance
          key={segment.key}
          position={segment.position}
          rotation={segment.rotation}
          scale={segment.scale}
          color={segment.color}
        />
      ))}
    </Instances>
  );
}

function createRaisedInlayMaterial(kind: RaisedInlayKind): THREE.Material {
  if (kind === 'brass-seam') {
    return createPbrMaterial(
      'runtime-raised-brass-seam-pbr',
      createFilePbrSet('metal'),
      { color: 0xffffff, roughness: 0.3, metalness: 0.66, envMapIntensity: 1.05, normalScale: 0.16 },
    );
  }

  if (kind === 'glow-channel') {
    return new THREE.MeshStandardMaterial({
      name: 'runtime-raised-glow-channel-pbr',
      color: 0xd7fbff,
      emissive: 0x78ecff,
      emissiveIntensity: 0.42,
      roughness: 0.38,
      metalness: 0.08,
      envMapIntensity: 0.74,
    });
  }

  return createPbrMaterial(
    'runtime-raised-stone-threshold-pbr',
    createFilePbrSet('stone'),
    { color: 0xffffff, roughness: 0.82, metalness: 0.04, envMapIntensity: 0.42, normalScale: 0.2 },
  );
}

function createRaisedInlaySegments(chunk: WorldChunkDefinition): RaisedInlaySegment[] {
  const segments: RaisedInlaySegment[] = [];
  const b = chunk.bounds;
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  const centerX = (b.minX + b.maxX) / 2;
  const centerZ = (b.minZ + b.maxZ) / 2;
  const seed = `${chunk.id}:raised-inlay`;
  const baseY = chunk.region === 'interior' ? 0.205 : 0.201;
  const edgeInset = chunk.region === 'interior' ? 0.86 : 1.18;

  const add = (
    index: number,
    kind: RaisedInlayKind,
    x: number,
    z: number,
    length: number,
    thickness: number,
    angle: number,
  ) => {
    const lengthJitter = 0.9 + seededNoise(seed, index + 17) * 0.18;
    const thicknessJitter = 0.86 + seededNoise(seed, index + 23) * 0.28;
    segments.push({
      key: `${chunk.id}:${kind}:${index}`,
      kind,
      position: [x, baseY + index * 0.00035, z],
      rotation: [0, angle, 0],
      scale: [length * lengthJitter, thickness, thickness * thicknessJitter],
      color: getRaisedInlayColor(chunk, kind, index),
    });
  };

  add(0, 'stone-threshold', centerX, b.minZ + edgeInset, width * 0.46, 0.035, 0);
  add(1, 'stone-threshold', centerX, b.maxZ - edgeInset, width * 0.42, 0.035, seededSigned(seed, 31) * 0.04);
  add(2, 'stone-threshold', b.minX + edgeInset, centerZ, depth * 0.38, 0.034, Math.PI / 2);
  add(3, 'stone-threshold', b.maxX - edgeInset, centerZ, depth * 0.36, 0.034, Math.PI / 2 + seededSigned(seed, 41) * 0.04);

  const brassCount = chunk.region === 'interior' ? 4 : chunk.region === 'combat' ? 3 : 2;
  for (let i = 0; i < brassCount; i += 1) {
    const horizontal = i % 2 === 0;
    const offset = seededSigned(seed, i + 61) * (horizontal ? depth : width) * 0.22;
    add(
      10 + i,
      'brass-seam',
      horizontal ? centerX + seededSigned(seed, i + 67) * width * 0.08 : centerX + offset,
      horizontal ? centerZ + offset : centerZ + seededSigned(seed, i + 71) * depth * 0.08,
      horizontal ? width * (0.28 + seededNoise(seed, i + 79) * 0.22) : depth * (0.24 + seededNoise(seed, i + 83) * 0.18),
      0.022,
      horizontal ? seededSigned(seed, i + 89) * 0.08 : Math.PI / 2 + seededSigned(seed, i + 97) * 0.08,
    );
  }

  const glowCount = chunk.region === 'interior'
    ? 2
    : chunk.region === 'cavern'
      ? 4
      : chunk.region === 'exterior'
        ? 3
        : 2;
  for (let i = 0; i < glowCount; i += 1) {
    const angle = (i % 2 === 0 ? 0 : Math.PI / 2) + seededSigned(seed, i + 131) * 0.18;
    add(
      30 + i,
      'glow-channel',
      centerX + seededSigned(seed, i + 137) * width * 0.28,
      centerZ + seededSigned(seed, i + 149) * depth * 0.28,
      (i % 2 === 0 ? width : depth) * (0.16 + seededNoise(seed, i + 157) * 0.16),
      0.014,
      angle,
    );
  }

  if (chunk.id === 'atrium') {
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      const radius = 2.35 + seededNoise(seed, i + 181) * 0.42;
      add(
        50 + i,
        i % 2 === 0 ? 'brass-seam' : 'glow-channel',
        centerX + Math.cos(angle) * radius,
        centerZ + Math.sin(angle) * radius,
        0.82 + seededNoise(seed, i + 191) * 0.46,
        i % 2 === 0 ? 0.024 : 0.013,
        angle + Math.PI / 2,
      );
    }
  }

  return segments;
}

function getRaisedInlayColor(
  chunk: WorldChunkDefinition,
  kind: RaisedInlayKind,
  index: number,
): number {
  const floor = new THREE.Color(chunk.palette.floor);
  const wall = new THREE.Color(chunk.palette.wall);
  const accent = new THREE.Color(chunk.palette.accent);
  const emissive = new THREE.Color(chunk.palette.emissive);
  const variance = seededNoise(`${chunk.id}:${kind}`, index + 1700) * 0.24;

  if (kind === 'brass-seam') return accent.clone().lerp(new THREE.Color(0xffe6a8), 0.22 + variance).getHex();
  if (kind === 'glow-channel') return emissive.clone().lerp(new THREE.Color(0xe6fbff), 0.26 + variance).getHex();
  return floor.clone().lerp(wall, 0.22 + variance).lerp(new THREE.Color(0xd6c8aa), 0.08).getHex();
}

type TileReliefKind =
  | 'shadow-grout'
  | 'exposed-stone-chip'
  | 'aged-brass-pin';

interface TileReliefFragment {
  readonly key: string;
  readonly kind: TileReliefKind;
  readonly position: ThreeVec3Tuple;
  readonly rotation: ThreeVec3Tuple;
  readonly scale: ThreeVec3Tuple;
  readonly color: number;
}

function TileReliefLayer({ activeChunks }: { readonly activeChunks: readonly WorldChunkDefinition[] }): React.ReactElement {
  const fragments = useMemo(() => activeChunks.flatMap((chunk) => createTileReliefFragments(chunk)), [activeChunks]);
  const grouped = useMemo(() => {
    const groups = new Map<TileReliefKind, TileReliefFragment[]>();
    for (const fragment of fragments) {
      const current = groups.get(fragment.kind);
      if (current) current.push(fragment);
      else groups.set(fragment.kind, [fragment]);
    }
    return [...groups.entries()].map(([kind, items]) => ({ kind, items }));
  }, [fragments]);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      tileReliefFragments: String(fragments.length),
    };
  }, [fragments.length]);

  return (
    <group name="runtime-tile-relief-layer">
      {grouped.map((group) => (
        <TileReliefGroup key={group.kind} kind={group.kind} fragments={group.items} />
      ))}
    </group>
  );
}

function TileReliefGroup({
  kind,
  fragments,
}: {
  readonly kind: TileReliefKind;
  readonly fragments: readonly TileReliefFragment[];
}): React.ReactElement {
  const material = useMemo(() => createTileReliefMaterial(kind), [kind]);

  return (
    <Instances
      name={`instanced-tile-relief:${kind}`}
      limit={fragments.length}
      range={fragments.length}
      material={material}
      castShadow={kind !== 'shadow-grout'}
      receiveShadow
      renderOrder={kind === 'shadow-grout' ? 3 : 5}
    >
      <boxGeometry args={[1, 1, 1, 1, 1, 1]} />
      {fragments.map((fragment) => (
        <Instance
          key={fragment.key}
          position={fragment.position}
          rotation={fragment.rotation}
          scale={fragment.scale}
          color={fragment.color}
        />
      ))}
    </Instances>
  );
}

function createTileReliefMaterial(kind: TileReliefKind): THREE.Material {
  if (kind === 'shadow-grout') {
    return new THREE.MeshStandardMaterial({
      name: 'runtime-tile-relief-shadow-grout',
      color: 0xffffff,
      roughness: 0.98,
      metalness: 0,
      envMapIntensity: 0.04,
      vertexColors: true,
    });
  }

  if (kind === 'aged-brass-pin') {
    const material = createPbrMaterial(
      'runtime-tile-relief-aged-brass-pin-pbr',
      createFilePbrSet('metal'),
      { color: 0xffffff, roughness: 0.36, metalness: 0.58, envMapIntensity: 0.9, normalScale: 0.14 },
    );
    material.vertexColors = true;
    return material;
  }

  const material = createPbrMaterial(
    'runtime-tile-relief-exposed-stone-chip-pbr',
    createFilePbrSet('stone'),
    { color: 0xffffff, roughness: 0.88, metalness: 0.02, envMapIntensity: 0.32, normalScale: 0.18 },
  );
  material.vertexColors = true;
  return material;
}

function createTileReliefFragments(chunk: WorldChunkDefinition): TileReliefFragment[] {
  const fragments: TileReliefFragment[] = [];
  const b = chunk.bounds;
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  const centerX = (b.minX + b.maxX) / 2;
  const centerZ = (b.minZ + b.maxZ) / 2;
  const seed = `${chunk.id}:tile-relief`;
  const baseY = chunk.region === 'interior' ? 0.212 : 0.208;
  const tileLineCount = chunk.region === 'interior' ? 5 : chunk.region === 'combat' ? 6 : 4;

  const add = (
    index: number,
    kind: TileReliefKind,
    position: ThreeVec3Tuple,
    rotationY: number,
    scale: ThreeVec3Tuple,
  ) => {
    fragments.push({
      key: `${chunk.id}:${kind}:${index}`,
      kind,
      position: [position[0], position[1], position[2]],
      rotation: [0, rotationY, seededSigned(seed, index + 19) * 0.012],
      scale,
      color: getTileReliefColor(chunk, kind, index),
    });
  };

  for (let i = 0; i < tileLineCount; i += 1) {
    const t = (i + 1) / (tileLineCount + 1);
    const horizontalZ = b.minZ + depth * t + seededSigned(seed, i + 31) * depth * 0.025;
    const verticalX = b.minX + width * t + seededSigned(seed, i + 37) * width * 0.025;
    add(
      i,
      'shadow-grout',
      [centerX + seededSigned(seed, i + 41) * width * 0.04, baseY + i * 0.00018, horizontalZ],
      seededSigned(seed, i + 43) * 0.035,
      [width * (0.26 + seededNoise(seed, i + 47) * 0.18), 0.012, 0.018],
    );
    add(
      20 + i,
      'shadow-grout',
      [verticalX, baseY + 0.001 + i * 0.00018, centerZ + seededSigned(seed, i + 53) * depth * 0.04],
      Math.PI / 2 + seededSigned(seed, i + 59) * 0.035,
      [depth * (0.22 + seededNoise(seed, i + 61) * 0.18), 0.012, 0.017],
    );
  }

  const chipCount = chunk.region === 'cavern' ? 9 : chunk.region === 'combat' ? 8 : 7;
  for (let i = 0; i < chipCount; i += 1) {
    const nearEdge = i % 3 === 0;
    const x = nearEdge
      ? (i % 2 === 0 ? b.minX + width * 0.08 : b.maxX - width * 0.08)
      : b.minX + width * (0.16 + seededNoise(seed, i + 71) * 0.68);
    const z = nearEdge
      ? b.minZ + depth * (0.14 + seededNoise(seed, i + 79) * 0.72)
      : b.minZ + depth * (0.16 + seededNoise(seed, i + 83) * 0.68);
    add(
      50 + i,
      'exposed-stone-chip',
      [x, baseY + 0.01 + i * 0.0002, z],
      seededNoise(seed, i + 89) * Math.PI,
      [
        0.18 + seededNoise(seed, i + 97) * 0.34,
        0.018 + seededNoise(seed, i + 101) * 0.018,
        0.035 + seededNoise(seed, i + 103) * 0.07,
      ],
    );
  }

  const pinCount = chunk.region === 'interior' ? 4 : 3;
  for (let i = 0; i < pinCount; i += 1) {
    add(
      80 + i,
      'aged-brass-pin',
      [
        centerX + seededSigned(seed, i + 127) * width * 0.32,
        baseY + 0.014 + i * 0.0002,
        centerZ + seededSigned(seed, i + 131) * depth * 0.32,
      ],
      seededNoise(seed, i + 137) * Math.PI,
      [0.095 + seededNoise(seed, i + 139) * 0.06, 0.016, 0.095 + seededNoise(seed, i + 149) * 0.06],
    );
  }

  return fragments;
}

function getTileReliefColor(
  chunk: WorldChunkDefinition,
  kind: TileReliefKind,
  index: number,
): number {
  const floor = new THREE.Color(chunk.palette.floor);
  const wall = new THREE.Color(chunk.palette.wall);
  const accent = new THREE.Color(chunk.palette.accent);
  const variance = seededNoise(`${chunk.id}:${kind}`, index + 2600) * 0.22;

  if (kind === 'shadow-grout') return new THREE.Color(0x05070c).lerp(floor, 0.24 + variance).getHex();
  if (kind === 'aged-brass-pin') return accent.clone().lerp(new THREE.Color(0xffe4a3), 0.22 + variance).getHex();
  return floor.clone().lerp(wall, 0.26 + variance).lerp(new THREE.Color(0xd2c6b5), 0.14).getHex();
}

type MicroSurfaceKind =
  | 'stone-chip'
  | 'brass-sliver'
  | 'wood-splinter'
  | 'leaf-litter'
  | 'crystal-chip'
  | 'wax-drop';

interface MicroSurfaceDetailInstance {
  readonly key: string;
  readonly kind: MicroSurfaceKind;
  readonly position: ThreeVec3Tuple;
  readonly rotation: ThreeVec3Tuple;
  readonly scale: ThreeVec3Tuple;
  readonly color: number;
}

function MicroSurfaceDetailLayer({ activeChunks }: { readonly activeChunks: readonly WorldChunkDefinition[] }): React.ReactElement {
  const details = useMemo(() => activeChunks.flatMap((chunk) => createMicroSurfaceDetails(chunk)), [activeChunks]);
  const grouped = useMemo(() => {
    const groups = new Map<MicroSurfaceKind, MicroSurfaceDetailInstance[]>();
    for (const detail of details) {
      const current = groups.get(detail.kind);
      if (current) current.push(detail);
      else groups.set(detail.kind, [detail]);
    }
    return [...groups.entries()].map(([kind, items]) => ({ kind, items }));
  }, [details]);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      microSurfaceDetails: String(details.length),
    };
  }, [details.length]);

  return (
    <group name="runtime-micro-surface-detail-layer">
      {grouped.map((group) => (
        <MicroSurfaceDetailGroup
          key={group.kind}
          kind={group.kind}
          items={group.items}
        />
      ))}
    </group>
  );
}

function MicroSurfaceDetailGroup({
  kind,
  items,
}: {
  readonly kind: MicroSurfaceKind;
  readonly items: readonly MicroSurfaceDetailInstance[];
}): React.ReactElement {
  const material = useMicroSurfaceMaterial(kind);

  return (
    <Instances
      name={`instanced-micro-surface:${kind}`}
      limit={items.length}
      range={items.length}
      material={material}
      castShadow={kind !== 'leaf-litter'}
      receiveShadow
      renderOrder={kind === 'leaf-litter' ? 6 : 3}
    >
      <MicroSurfaceGeometry kind={kind} />
      {items.map((item) => (
        <Instance
          key={item.key}
          position={item.position}
          rotation={item.rotation}
          scale={item.scale}
          color={item.color}
        />
      ))}
    </Instances>
  );
}

function MicroSurfaceGeometry({ kind }: { readonly kind: MicroSurfaceKind }): React.ReactElement {
  if (kind === 'leaf-litter') return <planeGeometry args={[0.18, 0.32, 1, 1]} />;
  if (kind === 'crystal-chip') return <tetrahedronGeometry args={[0.08, 0]} />;
  if (kind === 'wax-drop') return <sphereGeometry args={[0.08, 10, 6]} />;
  return <boxGeometry args={[0.16, 0.035, 0.06, 1, 1, 1]} />;
}

function useMicroSurfaceMaterial(kind: MicroSurfaceKind): THREE.Material {
  return useMemo(() => {
    if (kind === 'leaf-litter') {
      const textures = createFilePbrSet('organic');
      return new THREE.MeshStandardMaterial({
        name: 'runtime-micro-leaf-litter-pbr',
        color: 0xffffff,
        map: textures.albedo,
        normalMap: textures.normal,
        normalScale: new THREE.Vector2(0.16, 0.16),
        roughnessMap: textures.roughness,
        aoMap: textures.ao,
        roughness: 0.88,
        metalness: 0,
        envMapIntensity: 0.2,
        transparent: true,
        opacity: 0.78,
        alphaTest: 0.08,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -6,
      });
    }

    if (kind === 'brass-sliver') {
      return createPbrMaterial(
        'runtime-micro-worn-brass-sliver-pbr',
        createFilePbrSet('metal'),
        { color: 0xffffff, roughness: 0.34, metalness: 0.62, envMapIntensity: 0.9, normalScale: 0.18 },
      );
    }

    if (kind === 'wood-splinter') {
      return createPbrMaterial(
        'runtime-micro-wood-splinter-pbr',
        createFilePbrSet('wood'),
        { color: 0xffffff, roughness: 0.78, metalness: 0.02, envMapIntensity: 0.28, normalScale: 0.22 },
      );
    }

    if (kind === 'crystal-chip') {
      return createPbrMaterial(
        'runtime-micro-crystal-chip-pbr',
        createFilePbrSet('crystal'),
        { color: 0xffffff, roughness: 0.16, metalness: 0, envMapIntensity: 1.15, normalScale: 0.2 },
      );
    }

    if (kind === 'wax-drop') {
      return createPbrMaterial(
        'runtime-micro-wax-drop-pbr',
        createFilePbrSet('organic'),
        { color: 0xffffff, roughness: 0.66, metalness: 0, envMapIntensity: 0.22, normalScale: 0.08 },
      );
    }

    return createPbrMaterial(
      'runtime-micro-stone-chip-pbr',
      createFilePbrSet('stone'),
      { color: 0xffffff, roughness: 0.86, metalness: 0.03, envMapIntensity: 0.34, normalScale: 0.18 },
    );
  }, [kind]);
}

function createMicroSurfaceDetails(chunk: WorldChunkDefinition): MicroSurfaceDetailInstance[] {
  const details: MicroSurfaceDetailInstance[] = [];
  const b = chunk.bounds;
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  const count = chunk.region === 'cavern'
    ? 62
    : chunk.region === 'exterior'
      ? 58
      : chunk.region === 'combat'
        ? 54
        : 46;
  const seed = `${chunk.id}:micro-surface`;

  for (let i = 0; i < count; i += 1) {
    const kind = getMicroSurfaceKind(chunk, i);
    const lane = i % 9 === 0;
    const x = lane
      ? (b.minX + width * (0.16 + seededNoise(seed, i + 11) * 0.68))
      : (b.minX + 0.9 + seededNoise(seed, i + 23) * Math.max(0.1, width - 1.8));
    const z = lane
      ? (b.minZ + depth * (0.24 + seededNoise(seed, i + 31) * 0.52) + seededSigned(seed, i + 37) * 0.42)
      : (b.minZ + 0.9 + seededNoise(seed, i + 41) * Math.max(0.1, depth - 1.8));
    const size = 0.58 + seededNoise(seed, i + 53) * 1.15;
    details.push({
      key: `${chunk.id}:${kind}:${i}`,
      kind,
      position: [x, getMicroSurfaceY(kind, i), z],
      rotation: getMicroSurfaceRotation(kind, seed, i),
      scale: getMicroSurfaceScale(kind, size, seed, i),
      color: getMicroSurfaceColor(chunk, kind, i),
    });
  }

  return details;
}

function getMicroSurfaceKind(chunk: WorldChunkDefinition, index: number): MicroSurfaceKind {
  if (chunk.region === 'cavern') {
    if (index % 3 === 0) return 'crystal-chip';
    if (index % 5 === 0) return 'leaf-litter';
    return 'stone-chip';
  }

  if (chunk.region === 'exterior') {
    if (index % 4 === 0) return 'leaf-litter';
    if (index % 9 === 0) return 'wood-splinter';
    if (index % 13 === 0) return 'crystal-chip';
    return 'stone-chip';
  }

  if (index % 13 === 0) return 'brass-sliver';
  if (index % 11 === 0) return 'wax-drop';
  if (index % 5 === 0) return 'wood-splinter';
  return 'stone-chip';
}

function getMicroSurfaceY(kind: MicroSurfaceKind, index: number): number {
  const offset = index * 0.00008;
  if (kind === 'leaf-litter') return 0.186 + offset;
  if (kind === 'wax-drop') return 0.212 + offset;
  if (kind === 'crystal-chip') return 0.218 + offset;
  return 0.194 + offset;
}

function getMicroSurfaceRotation(kind: MicroSurfaceKind, seed: string, index: number): ThreeVec3Tuple {
  const angle = seededNoise(seed, index + 89) * Math.PI * 2;
  if (kind === 'leaf-litter') {
    return [-Math.PI / 2 + seededSigned(seed, index + 91) * 0.08, 0, angle];
  }
  if (kind === 'crystal-chip') {
    return [seededNoise(seed, index + 93) * Math.PI, angle, seededNoise(seed, index + 95) * Math.PI];
  }
  return [0, angle, seededSigned(seed, index + 97) * 0.08];
}

function getMicroSurfaceScale(kind: MicroSurfaceKind, size: number, seed: string, index: number): ThreeVec3Tuple {
  if (kind === 'leaf-litter') {
    return [0.78 + seededNoise(seed, index + 101) * 0.7, 0.56 + seededNoise(seed, index + 103) * 0.58, 1];
  }
  if (kind === 'wax-drop') {
    return [size * 0.44, size * 0.12, size * 0.36];
  }
  if (kind === 'crystal-chip') {
    return [size * 0.75, size * (0.55 + seededNoise(seed, index + 105) * 0.8), size * 0.62];
  }
  if (kind === 'wood-splinter') {
    return [size * (1.0 + seededNoise(seed, index + 107) * 1.6), 0.7, size * 0.36];
  }
  if (kind === 'brass-sliver') {
    return [size * 0.62, 0.42, size * 0.22];
  }
  return [size * 0.7, 0.5 + seededNoise(seed, index + 109) * 0.65, size * 0.42];
}

function getMicroSurfaceColor(chunk: WorldChunkDefinition, kind: MicroSurfaceKind, index: number): number {
  const floor = new THREE.Color(chunk.palette.floor);
  const wall = new THREE.Color(chunk.palette.wall);
  const accent = new THREE.Color(chunk.palette.accent);
  const emissive = new THREE.Color(chunk.palette.emissive);
  const variance = 0.12 + seededNoise(chunk.id, index + 1500) * 0.3;

  if (kind === 'brass-sliver') return accent.clone().lerp(new THREE.Color(0xf7e0a0), variance).getHex();
  if (kind === 'wood-splinter') return new THREE.Color(0x5c3823).lerp(floor, variance).getHex();
  if (kind === 'leaf-litter') return new THREE.Color(0x395a34).lerp(new THREE.Color(0xa7a060), variance).getHex();
  if (kind === 'crystal-chip') return emissive.clone().lerp(new THREE.Color(0xd9fbff), 0.26 + variance).getHex();
  if (kind === 'wax-drop') return new THREE.Color(0xe4d3ad).lerp(accent, variance * 0.45).getHex();
  return floor.clone().lerp(wall, 0.18 + variance).getHex();
}

function AmbientLifeLayer({ activeChunks }: { readonly activeChunks: readonly WorldChunkDefinition[] }): React.ReactElement {
  const moteCount = activeChunks.reduce((total, chunk) => total + getAmbientMoteCount(chunk), 0);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      ambientMotes: String(moteCount),
    };
  }, [moteCount]);

  return (
    <group name="runtime-ambient-life-layer">
      {activeChunks.map((chunk, index) => (
        <ChunkAmbientLife key={chunk.id} chunk={chunk} index={index} />
      ))}
    </group>
  );
}

function ChunkAmbientLife({
  chunk,
  index,
}: {
  readonly chunk: WorldChunkDefinition;
  readonly index: number;
}): React.ReactElement {
  const centerX = (chunk.bounds.minX + chunk.bounds.maxX) / 2;
  const centerZ = (chunk.bounds.minZ + chunk.bounds.maxZ) / 2;
  const width = chunk.bounds.maxX - chunk.bounds.minX;
  const depth = chunk.bounds.maxZ - chunk.bounds.minZ;
  const count = getAmbientMoteCount(chunk);
  const scale: ThreeVec3Tuple = [Math.max(3, width * 0.78), chunk.region === 'interior' ? 3.2 : 3.8, Math.max(3, depth * 0.72)];
  const color = new THREE.Color(chunk.palette.emissive).lerp(new THREE.Color(0xffffff), chunk.region === 'interior' ? 0.28 : 0.1).getStyle();

  return (
    <group name={`ambient-life:${chunk.id}`} position={[centerX, chunk.region === 'interior' ? 1.65 : 1.25, centerZ]}>
      <Sparkles
        count={count}
        scale={scale}
        size={chunk.region === 'cavern' ? 2.8 : 1.65}
        speed={0.18 + index * 0.015}
        opacity={chunk.region === 'interior' ? 0.2 : 0.16}
        color={color}
      />
    </group>
  );
}

function getAmbientMoteCount(chunk: WorldChunkDefinition): number {
  if (chunk.region === 'cavern') return 54;
  if (chunk.region === 'exterior') return 42;
  if (chunk.region === 'combat') return 34;
  return 32;
}

function ReflectiveSurfaceLayer({ activeChunks }: { readonly activeChunks: readonly WorldChunkDefinition[] }): React.ReactElement {
  return (
    <group name="runtime-reflective-surface-layer">
      {activeChunks.map((chunk) => (
        <ReflectiveChunkSurface key={chunk.id} chunk={chunk} />
      ))}
    </group>
  );
}

function ReflectiveChunkSurface({ chunk }: { readonly chunk: WorldChunkDefinition }): React.ReactElement | null {
  if (chunk.region === 'combat') return null;

  const width = chunk.bounds.maxX - chunk.bounds.minX;
  const depth = chunk.bounds.maxZ - chunk.bounds.minZ;
  const centerX = (chunk.bounds.minX + chunk.bounds.maxX) / 2;
  const centerZ = (chunk.bounds.minZ + chunk.bounds.maxZ) / 2;
  const radius = Math.min(3.6, Math.max(1.8, Math.min(width, depth) * 0.2));
  const color = chunk.region === 'exterior' ? '#6e9b8f' : chunk.region === 'cavern' ? '#5da7c0' : '#7894bb';
  const opacity = chunk.region === 'interior' ? 0.105 : chunk.region === 'cavern' ? 0.09 : 0.075;

  return (
    <mesh
      name={`runtime-polished-reflection:${chunk.id}`}
      position={[centerX, 0.164, centerZ]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[1.55, 0.62, 1]}
      renderOrder={1}
    >
      <circleGeometry args={[radius, 96]} />
      <meshPhysicalMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.08}
        roughness={0.24}
        metalness={0.02}
        clearcoat={0.82}
        clearcoatRoughness={0.2}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  );
}

type BakedLightVolumeKind =
  | 'corner-occlusion'
  | 'ambient-fill'
  | 'bounce-pool'
  | 'window-graze'
  | 'specular-kick';

interface BakedLightVolumeInstance {
  readonly key: string;
  readonly kind: BakedLightVolumeKind;
  readonly position: ThreeVec3Tuple;
  readonly rotation: ThreeVec3Tuple;
  readonly scale: ThreeVec3Tuple;
  readonly color: number;
}

const bakedLightAlphaMapCache = new Map<BakedLightVolumeKind, THREE.Texture>();

function BakedLightVolumeLayer({ activeChunks }: { readonly activeChunks: readonly WorldChunkDefinition[] }): React.ReactElement {
  const volumes = useMemo(() => activeChunks.flatMap((chunk) => createBakedLightVolumes(chunk)), [activeChunks]);
  const grouped = useMemo(() => {
    const groups = new Map<BakedLightVolumeKind, BakedLightVolumeInstance[]>();
    for (const volume of volumes) {
      const current = groups.get(volume.kind);
      if (current) current.push(volume);
      else groups.set(volume.kind, [volume]);
    }
    return [...groups.entries()].map(([kind, items]) => ({ kind, items }));
  }, [volumes]);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      bakedLightVolumes: String(volumes.length),
    };
  }, [volumes.length]);

  return (
    <group name="runtime-baked-light-volume-layer">
      {grouped.map((group) => (
        <BakedLightVolumeGroup key={group.kind} kind={group.kind} volumes={group.items} />
      ))}
    </group>
  );
}

function BakedLightVolumeGroup({
  kind,
  volumes,
}: {
  readonly kind: BakedLightVolumeKind;
  readonly volumes: readonly BakedLightVolumeInstance[];
}): React.ReactElement {
  const baseOpacity = getBakedLightVolumeOpacity(kind);
  const material = useMemo(() => createBakedLightVolumeMaterial(kind, baseOpacity), [baseOpacity, kind]);

  useFrame(({ clock }) => {
    if (kind !== 'bounce-pool' && kind !== 'specular-kick') return;
    material.opacity = baseOpacity + Math.sin(clock.elapsedTime * 0.28 + kind.length) * 0.008;
  });

  return (
    <Instances
      name={`instanced-baked-light-volume:${kind}`}
      limit={volumes.length}
      range={volumes.length}
      material={material}
      renderOrder={getBakedLightVolumeRenderOrder(kind)}
    >
      <BakedLightVolumeGeometry kind={kind} />
      {volumes.map((volume) => (
        <Instance
          key={volume.key}
          position={volume.position}
          rotation={volume.rotation}
          scale={volume.scale}
          color={volume.color}
        />
      ))}
    </Instances>
  );
}

function BakedLightVolumeGeometry({ kind }: { readonly kind: BakedLightVolumeKind }): React.ReactElement {
  if (kind === 'bounce-pool' || kind === 'ambient-fill') return <circleGeometry args={[1, 72]} />;
  return <planeGeometry args={[1, 1, 1, 1]} />;
}

function createBakedLightVolumeMaterial(kind: BakedLightVolumeKind, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    name: `runtime-baked-light-volume:${kind}`,
    color: 0xffffff,
    alphaMap: getBakedLightAlphaMap(kind),
    transparent: true,
    opacity,
    alphaTest: 0.005,
    blending: kind === 'corner-occlusion' ? THREE.NormalBlending : THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: kind === 'corner-occlusion',
    polygonOffset: true,
    polygonOffsetFactor: kind === 'corner-occlusion' ? -1 : -3,
    polygonOffsetUnits: -1,
  });
}

function getBakedLightAlphaMap(kind: BakedLightVolumeKind): THREE.Texture {
  const cached = bakedLightAlphaMapCache.get(kind);
  if (cached) return cached;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, size, size);

    if (kind === 'corner-occlusion') {
      const vertical = ctx.createLinearGradient(0, 0, 0, size);
      vertical.addColorStop(0, 'rgba(255,255,255,0)');
      vertical.addColorStop(0.18, 'rgba(255,255,255,0.48)');
      vertical.addColorStop(0.5, 'rgba(255,255,255,0.94)');
      vertical.addColorStop(0.82, 'rgba(255,255,255,0.48)');
      vertical.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = vertical;
      ctx.fillRect(0, 0, size, size);
    } else if (kind === 'window-graze' || kind === 'specular-kick') {
      const radial = ctx.createRadialGradient(size * 0.5, size * 0.5, 2, size * 0.5, size * 0.5, size * 0.62);
      radial.addColorStop(0, 'rgba(255,255,255,0.92)');
      radial.addColorStop(0.38, 'rgba(255,255,255,0.46)');
      radial.addColorStop(0.72, 'rgba(255,255,255,0.12)');
      radial.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, size, size);
    } else {
      const radial = ctx.createRadialGradient(size * 0.5, size * 0.5, 1, size * 0.5, size * 0.5, size * 0.54);
      radial.addColorStop(0, 'rgba(255,255,255,0.96)');
      radial.addColorStop(0.52, 'rgba(255,255,255,0.42)');
      radial.addColorStop(0.82, 'rgba(255,255,255,0.1)');
      radial.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, size, size);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  bakedLightAlphaMapCache.set(kind, texture);
  return texture;
}

function getBakedLightVolumeOpacity(kind: BakedLightVolumeKind): number {
  if (kind === 'corner-occlusion') return 0.135;
  if (kind === 'ambient-fill') return 0.035;
  if (kind === 'bounce-pool') return 0.065;
  if (kind === 'window-graze') return 0.026;
  return 0.046;
}

function getBakedLightVolumeRenderOrder(kind: BakedLightVolumeKind): number {
  if (kind === 'corner-occlusion') return 0;
  if (kind === 'ambient-fill') return 1;
  if (kind === 'bounce-pool') return 2;
  if (kind === 'window-graze') return 3;
  return 10;
}

function createBakedLightVolumes(chunk: WorldChunkDefinition): BakedLightVolumeInstance[] {
  const volumes: BakedLightVolumeInstance[] = [];
  const b = chunk.bounds;
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  const centerX = (b.minX + b.maxX) / 2;
  const centerZ = (b.minZ + b.maxZ) / 2;
  const seed = `${chunk.id}:baked-light-volume`;
  const baseY = chunk.region === 'interior' ? 0.146 : 0.142;
  const add = (
    index: number,
    kind: BakedLightVolumeKind,
    position: ThreeVec3Tuple,
    rotation: ThreeVec3Tuple,
    scale: ThreeVec3Tuple,
  ) => {
    volumes.push({
      key: `${chunk.id}:${kind}:${index}`,
      kind,
      position,
      rotation,
      scale: [
        scale[0] * (0.92 + seededNoise(seed, index + 17) * 0.16),
        scale[1] * (0.9 + seededNoise(seed, index + 23) * 0.2),
        scale[2],
      ],
      color: getBakedLightVolumeColor(chunk, kind, index),
    });
  };

  add(
    0,
    'ambient-fill',
    [centerX, baseY, centerZ],
    [-Math.PI / 2, 0, seededSigned(seed, 1) * 0.18],
    [Math.max(2.8, width * 0.32), Math.max(2.2, depth * 0.28), 1],
  );
  add(
    1,
    'bounce-pool',
    [chunk.heroLight[0], baseY + 0.002, chunk.heroLight[2]],
    [-Math.PI / 2, 0, seededSigned(seed, 2) * 0.26],
    [Math.min(5.4, Math.max(2.1, width * 0.22)), Math.min(4.2, Math.max(1.6, depth * 0.18)), 1],
  );
  add(
    2,
    'bounce-pool',
    [centerX + seededSigned(seed, 3) * width * 0.15, baseY + 0.003, centerZ + seededSigned(seed, 4) * depth * 0.15],
    [-Math.PI / 2, 0, seededSigned(seed, 5) * 0.42],
    [Math.min(4.8, Math.max(1.9, width * 0.18)), Math.min(3.8, Math.max(1.4, depth * 0.16)), 1],
  );

  const edgeInset = chunk.region === 'interior' ? 0.34 : 0.72;
  add(10, 'corner-occlusion', [centerX, baseY + 0.004, b.minZ + edgeInset], [-Math.PI / 2, 0, 0], [width * 0.48, Math.max(0.32, depth * 0.025), 1]);
  add(11, 'corner-occlusion', [centerX, baseY + 0.005, b.maxZ - edgeInset], [-Math.PI / 2, 0, 0], [width * 0.48, Math.max(0.32, depth * 0.025), 1]);
  add(12, 'corner-occlusion', [b.minX + edgeInset, baseY + 0.006, centerZ], [-Math.PI / 2, 0, Math.PI / 2], [depth * 0.46, Math.max(0.32, width * 0.024), 1]);
  add(13, 'corner-occlusion', [b.maxX - edgeInset, baseY + 0.007, centerZ], [-Math.PI / 2, 0, Math.PI / 2], [depth * 0.46, Math.max(0.32, width * 0.024), 1]);

  for (let i = 0; i < 2; i += 1) {
    const side = i === 0 ? -1 : 1;
    const edgeZ = i === 0 ? b.minZ + edgeInset * 1.8 : b.maxZ - edgeInset * 1.8;
    add(
      20 + i,
      'window-graze',
      [
        centerX + seededSigned(seed, i + 31) * width * 0.18,
        baseY + 0.01 + i * 0.001,
        edgeZ + side * depth * 0.12,
      ],
      [-Math.PI / 2, 0, side * 0.28 + seededSigned(seed, i + 37) * 0.18],
      [Math.max(2.4, width * 0.28), Math.max(0.72, depth * 0.07), 1],
    );
    add(
      24 + i,
      'window-graze',
      [
        i === 0 ? b.minX + 0.08 : b.maxX - 0.08,
        chunk.region === 'interior' ? 1.68 : 1.22,
        centerZ + seededSigned(seed, i + 41) * depth * 0.2,
      ],
      [0, i === 0 ? Math.PI / 2 : -Math.PI / 2, seededSigned(seed, i + 43) * 0.08],
      [Math.max(1.7, depth * 0.18), chunk.region === 'interior' ? 2.6 : 1.65, 1],
    );
  }

  const kickCount = chunk.region === 'cavern' || chunk.id === 'dining-hall' ? 4 : 3;
  for (let i = 0; i < kickCount; i += 1) {
    add(
      40 + i,
      'specular-kick',
      [
        b.minX + width * (0.18 + seededNoise(seed, i + 61) * 0.64),
        baseY + 0.018 + i * 0.0008,
        b.minZ + depth * (0.18 + seededNoise(seed, i + 67) * 0.64),
      ],
      [-Math.PI / 2, 0, seededNoise(seed, i + 71) * Math.PI],
      [Math.max(0.85, width * 0.055), Math.max(0.22, depth * 0.022), 1],
    );
  }

  return volumes;
}

function getBakedLightVolumeColor(
  chunk: WorldChunkDefinition,
  kind: BakedLightVolumeKind,
  index: number,
): number {
  const floor = new THREE.Color(chunk.palette.floor);
  const wall = new THREE.Color(chunk.palette.wall);
  const accent = new THREE.Color(chunk.palette.accent);
  const emissive = new THREE.Color(chunk.palette.emissive);
  const variance = seededNoise(`${chunk.id}:${kind}`, index + 4200) * 0.18;

  if (kind === 'corner-occlusion') return new THREE.Color(0x02040a).lerp(floor, 0.18 + variance).getHex();
  if (kind === 'ambient-fill') return floor.clone().lerp(emissive, chunk.region === 'interior' ? 0.36 + variance : 0.48 + variance).getHex();
  if (kind === 'bounce-pool') return emissive.clone().lerp(accent, chunk.id === 'dining-hall' ? 0.52 : 0.22 + variance).getHex();
  if (kind === 'window-graze') return wall.clone().lerp(new THREE.Color(0xdceeff), 0.34 + variance).getHex();
  return accent.clone().lerp(new THREE.Color(0xffffff), 0.42 + variance).getHex();
}

type LivingSurfaceMotionKind =
  | 'caustic-ripple'
  | 'arcane-current'
  | 'wet-glint'
  | 'wind-shadow'
  | 'heat-shimmer';

interface LivingSurfaceMotionInstance {
  readonly key: string;
  readonly kind: LivingSurfaceMotionKind;
  readonly position: ThreeVec3Tuple;
  readonly rotation: ThreeVec3Tuple;
  readonly scale: ThreeVec3Tuple;
  readonly color: number;
}

const livingSurfaceAlphaMapCache = new Map<LivingSurfaceMotionKind, THREE.Texture>();

function LivingSurfaceMotionLayer({ activeChunks }: { readonly activeChunks: readonly WorldChunkDefinition[] }): React.ReactElement {
  const motions = useMemo(() => activeChunks.flatMap((chunk) => createLivingSurfaceMotions(chunk)), [activeChunks]);
  const grouped = useMemo(() => {
    const groups = new Map<LivingSurfaceMotionKind, LivingSurfaceMotionInstance[]>();
    for (const motion of motions) {
      const current = groups.get(motion.kind);
      if (current) current.push(motion);
      else groups.set(motion.kind, [motion]);
    }
    return [...groups.entries()].map(([kind, items]) => ({ kind, items }));
  }, [motions]);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      livingSurfaceMotions: String(motions.length),
    };
  }, [motions.length]);

  return (
    <group name="runtime-living-surface-motion-layer">
      {grouped.map((group) => (
        <LivingSurfaceMotionGroup key={group.kind} kind={group.kind} motions={group.items} />
      ))}
    </group>
  );
}

function LivingSurfaceMotionGroup({
  kind,
  motions,
}: {
  readonly kind: LivingSurfaceMotionKind;
  readonly motions: readonly LivingSurfaceMotionInstance[];
}): React.ReactElement {
  const baseOpacity = getLivingSurfaceMotionOpacity(kind);
  const material = useMemo(() => createLivingSurfaceMotionMaterial(kind), [kind]);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime * getLivingSurfaceMotionSpeed(kind);
    material.opacity = baseOpacity + Math.sin(time * 0.8 + kind.length) * baseOpacity * 0.08;
    if (material.alphaMap) {
      material.alphaMap.offset.x = time * (kind === 'wind-shadow' ? 0.035 : 0.075);
      material.alphaMap.offset.y = time * (kind === 'caustic-ripple' ? -0.045 : 0.025);
      material.alphaMap.rotation = Math.sin(time * 0.2) * (kind === 'wet-glint' ? 0.18 : 0.08);
    }
  });

  return (
    <Instances
      name={`instanced-living-surface-motion:${kind}`}
      limit={motions.length}
      range={motions.length}
      material={material}
      renderOrder={getLivingSurfaceMotionRenderOrder(kind)}
    >
      <LivingSurfaceMotionGeometry kind={kind} />
      {motions.map((motion) => (
        <Instance
          key={motion.key}
          position={motion.position}
          rotation={motion.rotation}
          scale={motion.scale}
          color={motion.color}
        />
      ))}
    </Instances>
  );
}

function LivingSurfaceMotionGeometry({ kind }: { readonly kind: LivingSurfaceMotionKind }): React.ReactElement {
  if (kind === 'caustic-ripple' || kind === 'wet-glint') return <circleGeometry args={[1, 72]} />;
  return <planeGeometry args={[1, 1, 1, 1]} />;
}

function createLivingSurfaceMotionMaterial(kind: LivingSurfaceMotionKind): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    name: `runtime-living-surface-motion:${kind}`,
    color: 0xffffff,
    alphaMap: getLivingSurfaceMotionAlphaMap(kind),
    opacity: getLivingSurfaceMotionOpacity(kind),
    transparent: true,
    alphaTest: 0.005,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexColors: true,
    blending: kind === 'wind-shadow' ? THREE.NormalBlending : THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -6,
    polygonOffsetUnits: -1,
  });
}

function getLivingSurfaceMotionAlphaMap(kind: LivingSurfaceMotionKind): THREE.Texture {
  const cached = livingSurfaceAlphaMapCache.get(kind);
  if (cached) return cached;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);
    const centerX = size * 0.5;
    const centerY = size * 0.5;

    if (kind === 'caustic-ripple') {
      const glow = ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, size * 0.52);
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(0.38, '#7a7a7a');
      glow.addColorStop(1, '#000000');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,255,255,0.82)';
      for (let i = 0; i < 9; i += 1) {
        ctx.globalAlpha = 0.12 + i * 0.035;
        ctx.lineWidth = 1 + (i % 3);
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, 12 + i * 6.2, 8 + i * 4.7, i * 0.22, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (kind === 'arcane-current') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,255,255,0.86)';
      for (let i = -3; i < 9; i += 1) {
        ctx.globalAlpha = 0.2 + (i % 3) * 0.1;
        ctx.lineWidth = i % 2 === 0 ? 3.2 : 1.6;
        ctx.beginPath();
        ctx.moveTo(-20, i * 18);
        ctx.bezierCurveTo(32, i * 18 + 20, 74, i * 18 - 16, 148, i * 18 + 12);
        ctx.stroke();
      }
    } else if (kind === 'wet-glint') {
      const glow = ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, size * 0.48);
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(0.28, '#9a9a9a');
      glow.addColorStop(1, '#000000');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i += 1) {
        ctx.globalAlpha = 0.18 + i * 0.08;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, 18 + i * 8, 3 + i * 1.4, -0.18 + i * 0.08, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (kind === 'wind-shadow') {
      const glow = ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, size * 0.58);
      glow.addColorStop(0, '#d8d8d8');
      glow.addColorStop(0.64, '#505050');
      glow.addColorStop(1, '#000000');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'multiply';
      for (let i = -2; i < 8; i += 1) {
        ctx.globalAlpha = 0.32;
        ctx.fillStyle = i % 2 === 0 ? '#3b3b3b' : '#777777';
        ctx.beginPath();
        ctx.ellipse(20 + i * 18, 58 + Math.sin(i) * 18, 34, 7, 0.34, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const glow = ctx.createRadialGradient(centerX, centerY, 1, centerX, centerY, size * 0.5);
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(0.44, '#767676');
      glow.addColorStop(1, '#000000');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      for (let i = 0; i < 7; i += 1) {
        ctx.globalAlpha = 0.12 + i * 0.04;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(18 + i * 14, 116);
        ctx.bezierCurveTo(8 + i * 15, 82, 34 + i * 12, 44, 24 + i * 14, 6);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === 'arcane-current' ? 1.7 : 1.15, kind === 'wind-shadow' ? 1.35 : 1.05);
  texture.center.set(0.5, 0.5);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  livingSurfaceAlphaMapCache.set(kind, texture);
  return texture;
}

function getLivingSurfaceMotionOpacity(kind: LivingSurfaceMotionKind): number {
  if (kind === 'caustic-ripple') return 0.105;
  if (kind === 'arcane-current') return 0.082;
  if (kind === 'wet-glint') return 0.075;
  if (kind === 'wind-shadow') return 0.12;
  return 0.068;
}

function getLivingSurfaceMotionSpeed(kind: LivingSurfaceMotionKind): number {
  if (kind === 'caustic-ripple') return 0.34;
  if (kind === 'arcane-current') return 0.22;
  if (kind === 'wet-glint') return 0.18;
  if (kind === 'wind-shadow') return 0.12;
  return 0.26;
}

function getLivingSurfaceMotionRenderOrder(kind: LivingSurfaceMotionKind): number {
  if (kind === 'wind-shadow') return 5;
  if (kind === 'wet-glint') return 12;
  if (kind === 'caustic-ripple') return 11;
  if (kind === 'heat-shimmer') return 9;
  return 8;
}

function createLivingSurfaceMotions(chunk: WorldChunkDefinition): LivingSurfaceMotionInstance[] {
  const motions: LivingSurfaceMotionInstance[] = [];
  const b = chunk.bounds;
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  const centerX = (b.minX + b.maxX) / 2;
  const centerZ = (b.minZ + b.maxZ) / 2;
  const seed = `${chunk.id}:living-surface-motion`;
  const baseY = chunk.region === 'interior' ? 0.213 : 0.207;

  const add = (
    index: number,
    kind: LivingSurfaceMotionKind,
    x: number,
    z: number,
    sx: number,
    sz: number,
    angle: number,
    y = baseY,
  ) => {
    motions.push({
      key: `${chunk.id}:${kind}:${index}`,
      kind,
      position: [x, y + index * 0.00035, z],
      rotation: [-Math.PI / 2, 0, angle + seededSigned(seed, index + 31) * 0.16],
      scale: [
        sx * (0.86 + seededNoise(seed, index + 41) * 0.28),
        sz * (0.86 + seededNoise(seed, index + 47) * 0.28),
        1,
      ],
      color: getLivingSurfaceMotionColor(chunk, kind, index),
    });
  };

  const currentCount = chunk.region === 'combat' ? 5 : chunk.region === 'interior' ? 4 : 3;
  for (let i = 0; i < currentCount; i += 1) {
    add(
      10 + i,
      'arcane-current',
      b.minX + width * (0.16 + seededNoise(seed, i + 51) * 0.68),
      b.minZ + depth * (0.16 + seededNoise(seed, i + 57) * 0.68),
      Math.max(1.4, width * (0.11 + seededNoise(seed, i + 61) * 0.05)),
      Math.max(0.28, depth * (0.018 + seededNoise(seed, i + 67) * 0.018)),
      seededSigned(seed, i + 71) * 0.8,
    );
  }

  const glintCount = chunk.region === 'cavern' || chunk.id === 'dining-hall' ? 5 : 3;
  for (let i = 0; i < glintCount; i += 1) {
    add(
      30 + i,
      'wet-glint',
      centerX + seededSigned(seed, i + 81) * width * 0.33,
      centerZ + seededSigned(seed, i + 87) * depth * 0.33,
      Math.max(0.72, width * 0.055),
      Math.max(0.2, depth * 0.018),
      seededNoise(seed, i + 91) * Math.PI,
    );
  }

  if (chunk.region === 'exterior' || chunk.region === 'cavern') {
    const rippleCount = chunk.id === 'lake-grotto' ? 8 : chunk.id === 'crystal-greenhouse' ? 6 : 4;
    for (let i = 0; i < rippleCount; i += 1) {
      const x = chunk.id === 'lake-grotto'
        ? -16 + seededSigned(seed, i + 101) * 5.5
        : centerX + seededSigned(seed, i + 103) * width * 0.34;
      const z = chunk.id === 'lake-grotto'
        ? 21 + seededSigned(seed, i + 107) * 4.8
        : centerZ + seededSigned(seed, i + 109) * depth * 0.34;
      add(
        50 + i,
        'caustic-ripple',
        x,
        z,
        Math.max(1.1, Math.min(width, depth) * (0.09 + seededNoise(seed, i + 111) * 0.06)),
        Math.max(0.8, Math.min(width, depth) * (0.07 + seededNoise(seed, i + 117) * 0.05)),
        seededNoise(seed, i + 121) * Math.PI,
        baseY + 0.012,
      );
    }
  }

  if (chunk.region === 'exterior') {
    for (let i = 0; i < 4; i += 1) {
      add(
        70 + i,
        'wind-shadow',
        b.minX + width * (0.12 + seededNoise(seed, i + 131) * 0.76),
        b.minZ + depth * (0.12 + seededNoise(seed, i + 137) * 0.76),
        Math.max(2.4, width * 0.18),
        Math.max(0.7, depth * 0.045),
        seededSigned(seed, i + 141) * 0.68,
        baseY + 0.004,
      );
    }
  }

  if (chunk.id === 'dining-hall' || chunk.id === 'training-yard') {
    for (let i = 0; i < 5; i += 1) {
      add(
        90 + i,
        'heat-shimmer',
        chunk.heroLight[0] + seededSigned(seed, i + 151) * Math.min(4.5, width * 0.28),
        chunk.heroLight[2] + seededSigned(seed, i + 157) * Math.min(3.6, depth * 0.26),
        Math.max(0.9, width * 0.055),
        Math.max(0.55, depth * 0.05),
        seededNoise(seed, i + 161) * Math.PI,
        baseY + 0.016,
      );
    }
  }

  return motions;
}

function getLivingSurfaceMotionColor(
  chunk: WorldChunkDefinition,
  kind: LivingSurfaceMotionKind,
  index: number,
): number {
  const floor = new THREE.Color(chunk.palette.floor);
  const accent = new THREE.Color(chunk.palette.accent);
  const emissive = new THREE.Color(chunk.palette.emissive);
  const variance = seededNoise(`${chunk.id}:${kind}`, index + 5000) * 0.18;

  if (kind === 'caustic-ripple') return emissive.clone().lerp(new THREE.Color(0xffffff), 0.52 + variance).getHex();
  if (kind === 'arcane-current') return emissive.clone().lerp(accent, 0.18 + variance).getHex();
  if (kind === 'wet-glint') return emissive.clone().lerp(new THREE.Color(0xf7fbff), 0.62 + variance).getHex();
  if (kind === 'wind-shadow') return new THREE.Color(0x06090d).lerp(floor, 0.36 + variance).getHex();
  return accent.clone().lerp(new THREE.Color(0xffe7b0), 0.36 + variance).getHex();
}

type VerticalSurfaceDetailKind =
  | 'wall-grime'
  | 'moss-creep'
  | 'fabric-wear'
  | 'book-dust'
  | 'mineral-runoff'
  | 'arcane-afterimage';

interface VerticalSurfaceDetailInstance {
  readonly key: string;
  readonly kind: VerticalSurfaceDetailKind;
  readonly position: ThreeVec3Tuple;
  readonly rotation: ThreeVec3Tuple;
  readonly scale: ThreeVec3Tuple;
  readonly color: number;
}

const verticalSurfaceAlphaMapCache = new Map<VerticalSurfaceDetailKind, THREE.Texture>();

function VerticalSurfaceDetailLayer({ activeChunks }: { readonly activeChunks: readonly WorldChunkDefinition[] }): React.ReactElement {
  const details = useMemo(() => activeChunks.flatMap((chunk) => createVerticalSurfaceDetails(chunk)), [activeChunks]);
  const grouped = useMemo(() => {
    const groups = new Map<VerticalSurfaceDetailKind, VerticalSurfaceDetailInstance[]>();
    for (const detail of details) {
      const current = groups.get(detail.kind);
      if (current) current.push(detail);
      else groups.set(detail.kind, [detail]);
    }
    return [...groups.entries()].map(([kind, items]) => ({ kind, items }));
  }, [details]);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      verticalSurfaceDetails: String(details.length),
    };
  }, [details.length]);

  return (
    <group name="runtime-vertical-surface-detail-layer">
      {grouped.map((group) => (
        <VerticalSurfaceDetailGroup key={group.kind} kind={group.kind} details={group.items} />
      ))}
    </group>
  );
}

function VerticalSurfaceDetailGroup({
  kind,
  details,
}: {
  readonly kind: VerticalSurfaceDetailKind;
  readonly details: readonly VerticalSurfaceDetailInstance[];
}): React.ReactElement {
  const material = useMemo(() => createVerticalSurfaceDetailMaterial(kind), [kind]);

  useFrame(({ clock }) => {
    if (kind !== 'arcane-afterimage' && kind !== 'mineral-runoff') return;
    const baseOpacity = getVerticalSurfaceDetailOpacity(kind);
    material.opacity = baseOpacity + Math.sin(clock.elapsedTime * 0.24 + kind.length) * baseOpacity * 0.06;
  });

  return (
    <Instances
      name={`instanced-vertical-surface-detail:${kind}`}
      limit={details.length}
      range={details.length}
      material={material}
      renderOrder={getVerticalSurfaceDetailRenderOrder(kind)}
    >
      <planeGeometry args={[1, 1, 1, 1]} />
      {details.map((detail) => (
        <Instance
          key={detail.key}
          position={detail.position}
          rotation={detail.rotation}
          scale={detail.scale}
          color={detail.color}
        />
      ))}
    </Instances>
  );
}

function createVerticalSurfaceDetailMaterial(kind: VerticalSurfaceDetailKind): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    name: `runtime-vertical-surface-detail:${kind}`,
    color: 0xffffff,
    alphaMap: getVerticalSurfaceAlphaMap(kind),
    transparent: true,
    opacity: getVerticalSurfaceDetailOpacity(kind),
    alphaTest: 0.01,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexColors: true,
    blending: kind === 'arcane-afterimage' ? THREE.AdditiveBlending : THREE.NormalBlending,
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -1,
  });
}

function getVerticalSurfaceAlphaMap(kind: VerticalSurfaceDetailKind): THREE.Texture {
  const cached = verticalSurfaceAlphaMapCache.get(kind);
  if (cached) return cached;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);

    const drawSoftSpot = (
      x: number,
      y: number,
      rx: number,
      ry: number,
      alpha: number,
      rotation: number,
    ) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(rx, ry);
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      gradient.addColorStop(0, `rgba(218,218,218,${alpha})`);
      gradient.addColorStop(0.46, `rgba(176,176,176,${alpha * 0.42})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    if (kind === 'wall-grime' || kind === 'book-dust') {
      for (let i = 0; i < 52; i += 1) {
        const x = seededNoise(`vertical-alpha:${kind}`, i) * size;
        const y = size * (0.16 + seededNoise(`vertical-alpha:${kind}`, i + 100) * 0.78);
        drawSoftSpot(
          x,
          y,
          2 + seededNoise(`vertical-alpha:${kind}`, i + 300) * 13,
          6 + seededNoise(`vertical-alpha:${kind}`, i + 400) * 27,
          0.08 + seededNoise(`vertical-alpha:${kind}`, i + 200) * (kind === 'book-dust' ? 0.1 : 0.14),
          seededSigned(`vertical-alpha:${kind}`, i + 500) * 0.34,
        );
      }
    } else if (kind === 'moss-creep') {
      for (let i = 0; i < 42; i += 1) {
        const x = seededNoise(`vertical-alpha:${kind}`, i) * size;
        const y = size * (0.54 + seededNoise(`vertical-alpha:${kind}`, i + 100) * 0.42);
        drawSoftSpot(
          x,
          y,
          4 + seededNoise(`vertical-alpha:${kind}`, i + 200) * 14,
          4 + seededNoise(`vertical-alpha:${kind}`, i + 300) * 16,
          0.1 + seededNoise(`vertical-alpha:${kind}`, i + 350) * 0.12,
          seededSigned(`vertical-alpha:${kind}`, i + 400) * 0.8,
        );
      }
    } else if (kind === 'fabric-wear') {
      ctx.strokeStyle = 'rgba(205,205,205,0.28)';
      ctx.lineCap = 'round';
      for (let i = 0; i < 22; i += 1) {
        const x = i * 8 + seededSigned(`vertical-alpha:${kind}`, i) * 2;
        ctx.lineWidth = i % 5 === 0 ? 1.3 : 0.65;
        ctx.beginPath();
        ctx.moveTo(x, 10 + seededNoise(`vertical-alpha:${kind}`, i + 40) * 16);
        ctx.bezierCurveTo(x + 3, 42, x - 4, 72, x + 2, 112);
        ctx.stroke();
      }
      for (let i = 0; i < 9; i += 1) {
        drawSoftSpot(
          seededNoise(`vertical-alpha:${kind}`, i + 200) * size,
          size * (0.62 + seededNoise(`vertical-alpha:${kind}`, i + 300) * 0.26),
          5 + seededNoise(`vertical-alpha:${kind}`, i + 400) * 12,
          2 + seededNoise(`vertical-alpha:${kind}`, i + 500) * 6,
          0.1,
          seededSigned(`vertical-alpha:${kind}`, i + 600) * 0.22,
        );
      }
    } else if (kind === 'mineral-runoff') {
      ctx.strokeStyle = 'rgba(220,220,220,0.3)';
      ctx.lineCap = 'round';
      for (let i = 0; i < 18; i += 1) {
        const x = size * (0.12 + seededNoise(`vertical-alpha:${kind}`, i) * 0.76);
        ctx.lineWidth = 0.7 + seededNoise(`vertical-alpha:${kind}`, i + 100) * 2.2;
        ctx.beginPath();
        ctx.moveTo(x, 3 + seededNoise(`vertical-alpha:${kind}`, i + 150) * 18);
        ctx.bezierCurveTo(
          x + seededSigned(`vertical-alpha:${kind}`, i + 200) * 8,
          32,
          x + seededSigned(`vertical-alpha:${kind}`, i + 300) * 7,
          78,
          x + seededSigned(`vertical-alpha:${kind}`, i + 400) * 10,
          121,
        );
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = 'rgba(238,238,238,0.24)';
      ctx.lineCap = 'round';
      for (let i = 0; i < 13; i += 1) {
        const y = 12 + i * 9.2;
        ctx.lineWidth = i % 2 === 0 ? 1.4 : 0.8;
        ctx.beginPath();
        ctx.moveTo(9, y);
        ctx.bezierCurveTo(34, y - 13, 72, y + 14, 119, y - 3);
        ctx.stroke();
      }
    }

    ctx.lineCap = 'butt';
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  verticalSurfaceAlphaMapCache.set(kind, texture);
  return texture;
}

function getVerticalSurfaceDetailOpacity(kind: VerticalSurfaceDetailKind): number {
  if (kind === 'wall-grime') return 0.14;
  if (kind === 'moss-creep') return 0.15;
  if (kind === 'fabric-wear') return 0.11;
  if (kind === 'book-dust') return 0.1;
  if (kind === 'mineral-runoff') return 0.13;
  return 0.08;
}

function getVerticalSurfaceDetailRenderOrder(kind: VerticalSurfaceDetailKind): number {
  if (kind === 'arcane-afterimage') return 8;
  if (kind === 'mineral-runoff') return 7;
  return 6;
}

function createVerticalSurfaceDetails(chunk: WorldChunkDefinition): VerticalSurfaceDetailInstance[] {
  if (chunk.id === 'arcane-library') return [];

  const details: VerticalSurfaceDetailInstance[] = [];
  const b = chunk.bounds;
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  const centerX = (b.minX + b.maxX) / 2;
  const centerZ = (b.minZ + b.maxZ) / 2;
  const seed = `${chunk.id}:vertical-surface-detail`;
  const baseHeight = chunk.region === 'interior' ? 1.95 : chunk.region === 'cavern' ? 1.55 : 1.25;
  const yMid = chunk.region === 'interior' ? 1.18 : 0.95;

  const add = (
    index: number,
    kind: VerticalSurfaceDetailKind,
    position: ThreeVec3Tuple,
    rotationY: number,
    sx: number,
    sy: number,
  ) => {
    details.push({
      key: `${chunk.id}:${kind}:${index}`,
      kind,
      position: [
        position[0],
        position[1] + seededSigned(seed, index + 10) * 0.08,
        position[2],
      ],
      rotation: [0, rotationY, seededSigned(seed, index + 20) * 0.025],
      scale: [
        sx * (0.82 + seededNoise(seed, index + 30) * 0.32),
        sy * (0.84 + seededNoise(seed, index + 40) * 0.28),
        1,
      ],
      color: getVerticalSurfaceDetailColor(chunk, kind, index),
    });
  };

  const edgeInset = 0.06;
  const edgeKind: VerticalSurfaceDetailKind = chunk.region === 'cavern'
    ? 'mineral-runoff'
    : chunk.region === 'exterior'
      ? 'moss-creep'
      : 'wall-grime';

  const edgeWidth = Math.min(2.8, Math.max(1.25, width * 0.16));
  const edgeDepth = Math.min(2.55, Math.max(1.15, depth * 0.15));
  add(0, edgeKind, [centerX + seededSigned(seed, 1) * width * 0.12, yMid, b.minZ - edgeInset], 0, edgeWidth, baseHeight * 0.88);
  add(1, edgeKind, [centerX + seededSigned(seed, 2) * width * 0.12, yMid, b.maxZ + edgeInset], Math.PI, edgeWidth, baseHeight * 0.88);
  add(2, edgeKind, [b.minX - edgeInset, yMid, centerZ + seededSigned(seed, 3) * depth * 0.12], Math.PI / 2, edgeDepth, baseHeight * 0.88);
  add(3, edgeKind, [b.maxX + edgeInset, yMid, centerZ + seededSigned(seed, 4) * depth * 0.12], -Math.PI / 2, edgeDepth, baseHeight * 0.88);

  const localCount = chunk.region === 'interior' ? 5 : chunk.region === 'combat' ? 4 : 3;
  for (let i = 0; i < localCount; i += 1) {
    const side = i % 4;
    const kind = getVerticalSurfaceDetailKind(chunk, i);
    const along = side < 2
      ? b.minX + width * (0.16 + seededNoise(seed, i + 50) * 0.68)
      : b.minZ + depth * (0.16 + seededNoise(seed, i + 60) * 0.68);
    const pos: ThreeVec3Tuple = side === 0
      ? [along, yMid + seededSigned(seed, i + 70) * 0.18, b.minZ - edgeInset]
      : side === 1
        ? [along, yMid + seededSigned(seed, i + 70) * 0.18, b.maxZ + edgeInset]
        : side === 2
          ? [b.minX - edgeInset, yMid + seededSigned(seed, i + 70) * 0.18, along]
          : [b.maxX + edgeInset, yMid + seededSigned(seed, i + 70) * 0.18, along];
    const rotationY = side === 0 ? 0 : side === 1 ? Math.PI : side === 2 ? Math.PI / 2 : -Math.PI / 2;
    add(10 + i, kind, pos, rotationY, 0.48 + seededNoise(seed, i + 80) * 0.92, 0.58 + seededNoise(seed, i + 90) * 1.18);
  }

  if (chunk.id === 'dining-hall' || chunk.id === 'grand-hall' || chunk.id === 'training-yard') {
    for (let i = 0; i < 3; i += 1) {
      add(40 + i, 'fabric-wear', [b.minX + width * (0.28 + i * 0.2), 1.35, b.minZ - edgeInset], 0, 0.55, 1.18);
    }
  }

  if (chunk.id === 'lake-grotto' || chunk.id === 'crystal-greenhouse') {
    for (let i = 0; i < 4; i += 1) {
      add(50 + i, 'mineral-runoff', [b.minX + width * (0.18 + i * 0.18), 1.08, b.maxZ + edgeInset], Math.PI, 0.52, 1.2);
    }
  }

  if (chunk.region === 'combat' || chunk.id === 'atrium') {
    for (let i = 0; i < 3; i += 1) {
      add(60 + i, 'arcane-afterimage', [centerX + seededSigned(seed, i + 100) * width * 0.28, 1.18, centerZ + seededSigned(seed, i + 110) * depth * 0.28], seededNoise(seed, i + 120) * Math.PI * 2, 0.62, 1.02);
    }
  }

  return details;
}

function getVerticalSurfaceDetailKind(chunk: WorldChunkDefinition, index: number): VerticalSurfaceDetailKind {
  if (chunk.id === 'arcane-library') return 'wall-grime';
  if (chunk.region === 'cavern') return index % 2 === 0 ? 'mineral-runoff' : 'moss-creep';
  if (chunk.region === 'exterior') return index % 2 === 0 ? 'moss-creep' : 'mineral-runoff';
  if (chunk.region === 'combat') return index % 2 === 0 ? 'arcane-afterimage' : 'wall-grime';
  if (chunk.id === 'dining-hall') return index % 3 === 0 ? 'fabric-wear' : 'wall-grime';
  return index % 4 === 0 ? 'fabric-wear' : 'wall-grime';
}

function getVerticalSurfaceDetailColor(
  chunk: WorldChunkDefinition,
  kind: VerticalSurfaceDetailKind,
  index: number,
): number {
  const wall = new THREE.Color(chunk.palette.wall);
  const floor = new THREE.Color(chunk.palette.floor);
  const accent = new THREE.Color(chunk.palette.accent);
  const emissive = new THREE.Color(chunk.palette.emissive);
  const variance = seededNoise(`${chunk.id}:${kind}`, index + 6200) * 0.18;

  if (kind === 'wall-grime') return new THREE.Color(0x07090d).lerp(wall, 0.16 + variance).getHex();
  if (kind === 'moss-creep') return new THREE.Color(0x17281d).lerp(floor, 0.12 + variance).getHex();
  if (kind === 'fabric-wear') return new THREE.Color(0x766f62).lerp(accent, 0.08 + variance * 0.45).getHex();
  if (kind === 'book-dust') return new THREE.Color(0x7e7159).lerp(wall, 0.12 + variance).getHex();
  if (kind === 'mineral-runoff') return new THREE.Color(0x9fb7b3).lerp(emissive, 0.16 + variance * 0.5).getHex();
  return emissive.clone().lerp(new THREE.Color(0xdbe8ff), 0.28 + variance).getHex();
}

type ArchitecturalWearKind =
  | 'stone-base-rib'
  | 'column-stone-scar'
  | 'column-brass-collar'
  | 'mineral-vein';

interface ArchitecturalWearFragment {
  readonly key: string;
  readonly kind: ArchitecturalWearKind;
  readonly position: ThreeVec3Tuple;
  readonly rotation: ThreeVec3Tuple;
  readonly scale: ThreeVec3Tuple;
  readonly color: number;
}

function ArchitecturalWearLayer({ activeChunks }: { readonly activeChunks: readonly WorldChunkDefinition[] }): React.ReactElement {
  const fragments = useMemo(() => activeChunks.flatMap((chunk) => createArchitecturalWearFragments(chunk)), [activeChunks]);
  const grouped = useMemo(() => {
    const groups = new Map<ArchitecturalWearKind, ArchitecturalWearFragment[]>();
    for (const fragment of fragments) {
      const current = groups.get(fragment.kind);
      if (current) current.push(fragment);
      else groups.set(fragment.kind, [fragment]);
    }
    return [...groups.entries()].map(([kind, items]) => ({ kind, items }));
  }, [fragments]);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      architecturalWearFragments: String(fragments.length),
    };
  }, [fragments.length]);

  return (
    <group name="runtime-architectural-wear-layer">
      {grouped.map((group) => (
        <ArchitecturalWearGroup key={group.kind} kind={group.kind} fragments={group.items} />
      ))}
    </group>
  );
}

function ArchitecturalWearGroup({
  kind,
  fragments,
}: {
  readonly kind: ArchitecturalWearKind;
  readonly fragments: readonly ArchitecturalWearFragment[];
}): React.ReactElement {
  const material = useMemo(() => createArchitecturalWearMaterial(kind), [kind]);

  return (
    <Instances
      name={`instanced-architectural-wear:${kind}`}
      limit={fragments.length}
      range={fragments.length}
      material={material}
      castShadow={kind !== 'mineral-vein'}
      receiveShadow
      renderOrder={kind === 'mineral-vein' ? 7 : 4}
    >
      <ArchitecturalWearGeometry kind={kind} />
      {fragments.map((fragment) => (
        <Instance
          key={fragment.key}
          position={fragment.position}
          rotation={fragment.rotation}
          scale={fragment.scale}
          color={fragment.color}
        />
      ))}
    </Instances>
  );
}

function ArchitecturalWearGeometry({ kind }: { readonly kind: ArchitecturalWearKind }): React.ReactElement {
  if (kind === 'column-brass-collar') return <torusGeometry args={[0.52, 0.022, 8, 36]} />;
  return <boxGeometry args={[1, 1, 1, 1, 1, 1]} />;
}

function createArchitecturalWearMaterial(kind: ArchitecturalWearKind): THREE.Material {
  if (kind === 'column-brass-collar') {
    const material = createPbrMaterial(
      'runtime-architectural-column-brass-collar-pbr',
      createFilePbrSet('metal'),
      { color: 0xffffff, roughness: 0.33, metalness: 0.64, envMapIntensity: 1.02, normalScale: 0.15 },
    );
    material.vertexColors = true;
    return material;
  }

  if (kind === 'mineral-vein') {
    return new THREE.MeshStandardMaterial({
      name: 'runtime-architectural-mineral-vein-pbr',
      color: 0xffffff,
      emissive: 0x79eaff,
      emissiveIntensity: 0.18,
      roughness: 0.42,
      metalness: 0.02,
      envMapIntensity: 0.42,
      vertexColors: true,
    });
  }

  const material = createPbrMaterial(
    `runtime-architectural-${kind}-pbr`,
    createFilePbrSet('stone'),
    {
      color: 0xffffff,
      roughness: kind === 'column-stone-scar' ? 0.9 : 0.82,
      metalness: 0.02,
      envMapIntensity: 0.36,
      normalScale: kind === 'column-stone-scar' ? 0.22 : 0.18,
    },
  );
  material.vertexColors = true;
  return material;
}

function createArchitecturalWearFragments(chunk: WorldChunkDefinition): ArchitecturalWearFragment[] {
  const fragments: ArchitecturalWearFragment[] = [];
  const b = chunk.bounds;
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  const centerX = (b.minX + b.maxX) / 2;
  const centerZ = (b.minZ + b.maxZ) / 2;
  const seed = `${chunk.id}:architectural-wear`;
  const edgeInset = chunk.region === 'exterior' ? 1.06 : 0.52;

  const add = (
    index: number,
    kind: ArchitecturalWearKind,
    position: ThreeVec3Tuple,
    rotation: ThreeVec3Tuple,
    scale: ThreeVec3Tuple,
  ) => {
    fragments.push({
      key: `${chunk.id}:${kind}:${index}`,
      kind,
      position,
      rotation,
      scale,
      color: getArchitecturalWearColor(chunk, kind, index),
    });
  };

  if (chunk.region !== 'exterior') {
    const ribY = 0.36 + seededNoise(seed, 7) * 0.04;
    add(0, 'stone-base-rib', [centerX, ribY, b.minZ + edgeInset], [0, 0, 0], [width * 0.48, 0.22, 0.085]);
    add(1, 'stone-base-rib', [centerX, ribY + 0.012, b.maxZ - edgeInset], [0, 0, 0], [width * 0.44, 0.2, 0.08]);
    add(2, 'stone-base-rib', [b.minX + edgeInset, ribY + 0.006, centerZ], [0, Math.PI / 2, 0], [depth * 0.42, 0.21, 0.08]);
    add(3, 'stone-base-rib', [b.maxX - edgeInset, ribY + 0.018, centerZ], [0, Math.PI / 2, 0], [depth * 0.38, 0.2, 0.08]);

    for (let i = 0; i < 5; i += 1) {
      const onXEdge = i % 2 === 0;
      const side = i % 4 < 2 ? -1 : 1;
      const y = 0.94 + seededNoise(seed, i + 31) * 1.64;
      const length = 0.72 + seededNoise(seed, i + 41) * 0.95;
      const kind: ArchitecturalWearKind = i === 3 && chunk.region !== 'interior' ? 'mineral-vein' : 'column-stone-scar';
      add(
        10 + i,
        kind,
        [
          onXEdge
            ? (side < 0 ? b.minX + edgeInset * 0.54 : b.maxX - edgeInset * 0.54)
            : centerX + seededSigned(seed, i + 51) * width * 0.28,
          y,
          onXEdge
            ? centerZ + seededSigned(seed, i + 61) * depth * 0.34
            : (side < 0 ? b.minZ + edgeInset * 0.54 : b.maxZ - edgeInset * 0.54),
        ],
        [seededSigned(seed, i + 67) * 0.08, onXEdge ? Math.PI / 2 : 0, seededSigned(seed, i + 71) * 0.04],
        [
          0.035 + seededNoise(seed, i + 79) * 0.045,
          length,
          0.018 + seededNoise(seed, i + 83) * 0.018,
        ],
      );
    }
  }

  const columnPlacements = thirdPartyWorldPlacements.filter((placement) => (
    placement.chunkId === chunk.id && placement.sourceId === 'ca-column-01'
  ));

  for (const [placementIndex, placement] of columnPlacements.entries()) {
    const px = placement.position[0];
    const py = placement.position[1];
    const pz = placement.position[2];
    const scale = placement.scale;
    const columnSeed = `${seed}:column:${placement.id}`;
    const radius = 0.46 * scale;
    const collarScale = 0.78 * scale;

    [0.62, 1.82, 3.18].forEach((height, levelIndex) => {
      add(
        40 + placementIndex * 10 + levelIndex,
        'column-brass-collar',
        [px, py + height * scale, pz],
        [Math.PI / 2, placement.rotation[1] + seededSigned(columnSeed, levelIndex + 3) * 0.04, 0],
        [collarScale, collarScale, collarScale],
      );
    });

    for (let i = 0; i < 3; i += 1) {
      const angle = placement.rotation[1] + seededNoise(columnSeed, i + 13) * Math.PI * 2;
      const kind: ArchitecturalWearKind = i === 2 && chunk.region !== 'interior' ? 'mineral-vein' : 'column-stone-scar';
      add(
        70 + placementIndex * 10 + i,
        kind,
        [
          px + Math.cos(angle) * radius,
          py + (1.06 + seededNoise(columnSeed, i + 23) * 1.86) * scale,
          pz + Math.sin(angle) * radius,
        ],
        [seededSigned(columnSeed, i + 31) * 0.06, Math.PI / 2 - angle, seededSigned(columnSeed, i + 37) * 0.08],
        [
          0.045 + seededNoise(columnSeed, i + 43) * 0.04,
          (0.56 + seededNoise(columnSeed, i + 47) * 0.76) * scale,
          0.018 + seededNoise(columnSeed, i + 53) * 0.014,
        ],
      );
    }
  }

  if (chunk.id === 'atrium') {
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2 + seededSigned(seed, i + 101) * 0.08;
      const radius = 3.05 + seededNoise(seed, i + 109) * 0.24;
      add(
        120 + i,
        i % 2 === 0 ? 'column-brass-collar' : 'stone-base-rib',
        [centerX + Math.cos(angle) * radius, 0.47 + i * 0.012, centerZ + Math.sin(angle) * radius],
        i % 2 === 0 ? [Math.PI / 2, angle, 0] : [0, angle + Math.PI / 2, 0],
        i % 2 === 0 ? [0.42, 0.42, 0.42] : [0.86, 0.16, 0.07],
      );
    }
  }

  return fragments;
}

function getArchitecturalWearColor(
  chunk: WorldChunkDefinition,
  kind: ArchitecturalWearKind,
  index: number,
): number {
  const floor = new THREE.Color(chunk.palette.floor);
  const wall = new THREE.Color(chunk.palette.wall);
  const accent = new THREE.Color(chunk.palette.accent);
  const emissive = new THREE.Color(chunk.palette.emissive);
  const variance = seededNoise(`${chunk.id}:${kind}`, index + 5200) * 0.22;

  if (kind === 'column-brass-collar') return accent.clone().lerp(new THREE.Color(0xffdfa2), 0.24 + variance).getHex();
  if (kind === 'mineral-vein') return emissive.clone().lerp(new THREE.Color(0xe4fbff), 0.28 + variance).getHex();
  if (kind === 'column-stone-scar') return wall.clone().lerp(new THREE.Color(0xd8cdbb), 0.18 + variance).getHex();
  return floor.clone().lerp(wall, 0.34 + variance).lerp(new THREE.Color(0xc8bda8), 0.12).getHex();
}

type ArchitecturalDepthKind =
  | 'flying-buttress'
  | 'upper-stone-band'
  | 'arcane-window-slit'
  | 'roofline-metal-finial';

interface ArchitecturalDepthFragment {
  readonly key: string;
  readonly kind: ArchitecturalDepthKind;
  readonly position: ThreeVec3Tuple;
  readonly rotation: ThreeVec3Tuple;
  readonly scale: ThreeVec3Tuple;
  readonly color: number;
}

function ArchitecturalDepthLayer({ activeChunks }: { readonly activeChunks: readonly WorldChunkDefinition[] }): React.ReactElement {
  const fragments = useMemo(() => activeChunks.flatMap((chunk) => createArchitecturalDepthFragments(chunk)), [activeChunks]);
  const grouped = useMemo(() => {
    const groups = new Map<ArchitecturalDepthKind, ArchitecturalDepthFragment[]>();
    for (const fragment of fragments) {
      const current = groups.get(fragment.kind);
      if (current) current.push(fragment);
      else groups.set(fragment.kind, [fragment]);
    }
    return [...groups.entries()].map(([kind, items]) => ({ kind, items }));
  }, [fragments]);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      architecturalDepthFragments: String(fragments.length),
    };
  }, [fragments.length]);

  return (
    <group name="runtime-architectural-depth-layer">
      {grouped.map((group) => (
        <ArchitecturalDepthGroup key={group.kind} kind={group.kind} fragments={group.items} />
      ))}
    </group>
  );
}

function ArchitecturalDepthGroup({
  kind,
  fragments,
}: {
  readonly kind: ArchitecturalDepthKind;
  readonly fragments: readonly ArchitecturalDepthFragment[];
}): React.ReactElement {
  const material = useMemo(() => createArchitecturalDepthMaterial(kind), [kind]);

  return (
    <Instances
      name={`instanced-architectural-depth:${kind}`}
      limit={fragments.length}
      range={fragments.length}
      material={material}
      castShadow={kind !== 'arcane-window-slit'}
      receiveShadow
      renderOrder={kind === 'arcane-window-slit' ? 6 : 3}
    >
      <ArchitecturalDepthGeometry kind={kind} />
      {fragments.map((fragment) => (
        <Instance
          key={fragment.key}
          position={fragment.position}
          rotation={fragment.rotation}
          scale={fragment.scale}
          color={fragment.color}
        />
      ))}
    </Instances>
  );
}

function ArchitecturalDepthGeometry({ kind }: { readonly kind: ArchitecturalDepthKind }): React.ReactElement {
  if (kind === 'roofline-metal-finial') return <cylinderGeometry args={[0.08, 0.05, 1, 6]} />;
  return <boxGeometry args={[1, 1, 1, 1, 1, 1]} />;
}

function createArchitecturalDepthMaterial(kind: ArchitecturalDepthKind): THREE.Material {
  if (kind === 'arcane-window-slit') {
    return new THREE.MeshStandardMaterial({
      name: 'runtime-architectural-window-slit-pbr',
      color: 0xffffff,
      emissive: 0x62d8ff,
      emissiveIntensity: 0.36,
      roughness: 0.5,
      metalness: 0.05,
      envMapIntensity: 0.55,
      vertexColors: true,
    });
  }

  if (kind === 'roofline-metal-finial') {
    const material = createPbrMaterial(
      'runtime-architectural-roofline-metal-finial-pbr',
      createFilePbrSet('metal'),
      { color: 0xffffff, roughness: 0.38, metalness: 0.58, envMapIntensity: 0.86, normalScale: 0.14 },
    );
    material.vertexColors = true;
    return material;
  }

  const material = createPbrMaterial(
    `runtime-architectural-depth-${kind}-pbr`,
    createFilePbrSet('stone'),
    {
      color: 0xffffff,
      roughness: kind === 'flying-buttress' ? 0.86 : 0.8,
      metalness: 0.02,
      envMapIntensity: 0.38,
      normalScale: kind === 'flying-buttress' ? 0.22 : 0.16,
    },
  );
  material.vertexColors = true;
  return material;
}

function createArchitecturalDepthFragments(chunk: WorldChunkDefinition): ArchitecturalDepthFragment[] {
  const fragments: ArchitecturalDepthFragment[] = [];
  const b = chunk.bounds;
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  const centerX = (b.minX + b.maxX) / 2;
  const centerZ = (b.minZ + b.maxZ) / 2;
  const seed = `${chunk.id}:architectural-depth`;
  const exterior = chunk.region === 'exterior';
  const edgeInset = exterior ? 1.18 : 0.72;
  const upperY = exterior ? 2.06 : chunk.region === 'cavern' ? 2.28 : 2.62;
  const buttressHeight = exterior ? 1.72 : chunk.region === 'cavern' ? 2.05 : 2.38;

  const add = (
    index: number,
    kind: ArchitecturalDepthKind,
    position: ThreeVec3Tuple,
    rotation: ThreeVec3Tuple,
    scale: ThreeVec3Tuple,
  ) => {
    if (kind === 'upper-stone-band' || kind === 'flying-buttress') return;

    fragments.push({
      key: `${chunk.id}:${kind}:${index}`,
      kind,
      position,
      rotation,
      scale,
      color: getArchitecturalDepthColor(chunk, kind, index),
    });
  };

  add(
    0,
    'upper-stone-band',
    [centerX + seededSigned(seed, 11) * width * 0.035, upperY, b.minZ + edgeInset],
    [0, seededSigned(seed, 13) * 0.018, 0],
    [Math.max(2.2, width * (exterior ? 0.28 : 0.46)), 0.14, 0.095],
  );
  add(
    1,
    'upper-stone-band',
    [centerX + seededSigned(seed, 17) * width * 0.035, upperY + 0.04, b.maxZ - edgeInset],
    [0, seededSigned(seed, 19) * 0.018, 0],
    [Math.max(2.0, width * (exterior ? 0.24 : 0.42)), 0.13, 0.09],
  );

  if (!exterior) {
    add(
      2,
      'upper-stone-band',
      [b.minX + edgeInset, upperY + 0.02, centerZ + seededSigned(seed, 23) * depth * 0.03],
      [0, Math.PI / 2 + seededSigned(seed, 29) * 0.018, 0],
      [Math.max(2.1, depth * 0.34), 0.13, 0.085],
    );
    add(
      3,
      'upper-stone-band',
      [b.maxX - edgeInset, upperY + 0.05, centerZ + seededSigned(seed, 31) * depth * 0.03],
      [0, Math.PI / 2 + seededSigned(seed, 37) * 0.018, 0],
      [Math.max(1.9, depth * 0.31), 0.13, 0.085],
    );
  }

  for (let i = 0; i < 4; i += 1) {
    const left = i % 2 === 0;
    const north = i < 2;
    const x = left ? b.minX + edgeInset : b.maxX - edgeInset;
    const z = north ? b.minZ + edgeInset : b.maxZ - edgeInset;
    add(
      10 + i,
      'flying-buttress',
      [x + seededSigned(seed, i + 41) * 0.12, 0.38 + buttressHeight * 0.5, z + seededSigned(seed, i + 47) * 0.12],
      [0, north ? 0 : Math.PI, seededSigned(seed, i + 53) * 0.025],
      [
        exterior ? 0.16 : 0.22,
        buttressHeight,
        exterior ? 0.22 : 0.32,
      ],
    );
  }

  const slitCount = exterior ? 3 : chunk.region === 'cavern' ? 5 : 4;
  for (let i = 0; i < slitCount; i += 1) {
    const useXWall = i % 2 === 1;
    const side = i % 4 < 2 ? -1 : 1;
    const x = useXWall
      ? (side < 0 ? b.minX + edgeInset * 0.82 : b.maxX - edgeInset * 0.82)
      : b.minX + width * (0.2 + seededNoise(seed, i + 61) * 0.6);
    const z = useXWall
      ? b.minZ + depth * (0.18 + seededNoise(seed, i + 67) * 0.64)
      : (side < 0 ? b.minZ + edgeInset * 0.82 : b.maxZ - edgeInset * 0.82);
    add(
      30 + i,
      'arcane-window-slit',
      [x, 1.34 + seededNoise(seed, i + 71) * 1.1, z],
      [0, useXWall ? Math.PI / 2 : 0, seededSigned(seed, i + 79) * 0.012],
      [
        0.045 + seededNoise(seed, i + 83) * 0.028,
        0.58 + seededNoise(seed, i + 89) * 0.52,
        0.034,
      ],
    );
  }

  const finialCount = exterior ? 2 : 3;
  for (let i = 0; i < finialCount; i += 1) {
    const t = (i + 1) / (finialCount + 1);
    add(
      50 + i,
      'roofline-metal-finial',
      [b.minX + width * t + seededSigned(seed, i + 101) * width * 0.025, upperY + 0.43, b.maxZ - edgeInset * 0.88],
      [0, seededNoise(seed, i + 107) * Math.PI, 0],
      [
        0.42 + seededNoise(seed, i + 113) * 0.16,
        0.48 + seededNoise(seed, i + 127) * 0.28,
        0.42 + seededNoise(seed, i + 131) * 0.16,
      ],
    );
  }

  if (chunk.id === 'atrium') {
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2 + seededSigned(seed, i + 151) * 0.08;
      const radius = 4.35 + seededNoise(seed, i + 157) * 0.38;
      add(
        80 + i,
        i % 2 === 0 ? 'flying-buttress' : 'roofline-metal-finial',
        [
          centerX + Math.cos(angle) * radius,
          i % 2 === 0 ? 1.42 : 3.16,
          centerZ + Math.sin(angle) * radius,
        ],
        [0, Math.PI / 2 - angle, seededSigned(seed, i + 163) * 0.03],
        i % 2 === 0 ? [0.16, 2.05, 0.24] : [0.36, 0.52, 0.36],
      );
    }
  }

  return fragments;
}

function getArchitecturalDepthColor(
  chunk: WorldChunkDefinition,
  kind: ArchitecturalDepthKind,
  index: number,
): number {
  const floor = new THREE.Color(chunk.palette.floor);
  const wall = new THREE.Color(chunk.palette.wall);
  const accent = new THREE.Color(chunk.palette.accent);
  const emissive = new THREE.Color(chunk.palette.emissive);
  const variance = seededNoise(`${chunk.id}:${kind}`, index + 6100) * 0.2;

  if (kind === 'arcane-window-slit') return emissive.clone().lerp(new THREE.Color(0xecfbff), 0.32 + variance).getHex();
  if (kind === 'roofline-metal-finial') return accent.clone().lerp(new THREE.Color(0xffe0a8), 0.28 + variance).getHex();
  if (kind === 'flying-buttress') return wall.clone().lerp(new THREE.Color(0xbfc8c8), 0.12 + variance).getHex();
  return floor.clone().lerp(wall, 0.42 + variance).lerp(new THREE.Color(0xd6cbb7), 0.1).getHex();
}

function VolumetricLightShaftLayer({ activeChunks }: { readonly activeChunks: readonly WorldChunkDefinition[] }): React.ReactElement {
  return (
    <group name="runtime-volumetric-light-shafts">
      {activeChunks.map((chunk, index) => (
        <ChunkLightShafts key={chunk.id} chunk={chunk} index={index} />
      ))}
    </group>
  );
}

function ChunkLightShafts({
  chunk,
  index,
}: {
  readonly chunk: WorldChunkDefinition;
  readonly index: number;
}): React.ReactElement {
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color: chunk.palette.emissive,
    transparent: true,
    opacity: chunk.region === 'interior' ? 0.014 : 0.009,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [chunk.palette.emissive, chunk.region]);
  const centerX = (chunk.bounds.minX + chunk.bounds.maxX) / 2;
  const centerZ = (chunk.bounds.minZ + chunk.bounds.maxZ) / 2;
  const spread = chunk.region === 'interior' ? 1.7 : 3.1;
  const height = chunk.region === 'interior' ? 4.5 : 5.8;

  return (
    <group name={`light-shafts:${chunk.id}`} position={[centerX, 0.6, centerZ]}>
      {[0, 1, 2].map((shaft) => (
        <mesh
          key={shaft}
          name={`volumetric-light-shaft:${chunk.id}`}
          position={[
            Math.sin(index + shaft * 1.7) * spread,
            2.8 + shaft * 0.18,
            Math.cos(index * 0.7 + shaft) * spread,
          ]}
          rotation={[
            -0.78 + shaft * 0.04,
            0.36 + index * 0.24 + shaft * 0.42,
            0.18 - shaft * 0.08,
          ]}
          scale={[0.62 + shaft * 0.22, height, 1]}
          material={material}
          renderOrder={2}
        >
          <planeGeometry args={[1, 1, 1, 1]} />
        </mesh>
      ))}
    </group>
  );
}

function ChunkLightingLayer({ activeChunks }: { readonly activeChunks: readonly WorldChunkDefinition[] }): React.ReactElement {
  return (
    <group name="authored-chunk-local-lighting">
      {activeChunks.map((chunk) => (
        <ChunkHeroLighting key={chunk.id} chunk={chunk} />
      ))}
    </group>
  );
}

function ChunkHeroLighting({ chunk }: { readonly chunk: WorldChunkDefinition }): React.ReactElement {
  const target = useMemo(() => new THREE.Object3D(), []);
  const poolMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: chunk.palette.emissive,
    transparent: true,
    opacity: chunk.region === 'interior' ? 0.055 : 0.04,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [chunk.palette.emissive, chunk.region]);
  const warmMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: chunk.palette.accent,
    transparent: true,
    opacity: 0.035,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [chunk.palette.accent]);
  const centerX = (chunk.bounds.minX + chunk.bounds.maxX) / 2;
  const centerZ = (chunk.bounds.minZ + chunk.bounds.maxZ) / 2;

  useLayoutEffect(() => {
    target.position.set(centerX, 0.1, centerZ);
    target.updateMatrixWorld();
  }, [centerX, centerZ, target]);

  return (
    <group name={`chunk-lighting:${chunk.id}`}>
      <primitive object={target} />
      <pointLight
        position={chunk.heroLight as [number, number, number]}
        color={chunk.palette.emissive}
        intensity={chunk.region === 'interior' ? 9.5 : 7.2}
        distance={chunk.region === 'interior' ? 13 : 17}
        decay={2.1}
      />
      <spotLight
        position={[chunk.heroLight[0], chunk.heroLight[1] + 2.0, chunk.heroLight[2] + 1.0]}
        target={target}
        color={chunk.palette.accent}
        intensity={chunk.region === 'interior' ? 22 : 14}
        distance={24}
        angle={0.58}
        penumbra={0.68}
        decay={2.2}
        castShadow={chunk.region === 'interior'}
        shadow-mapSize={[1024, 1024]}
      />
      <mesh
        name={`cool-light-pool:${chunk.id}`}
        position={[centerX, 0.156, centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={poolMaterial}
        renderOrder={2}
      >
        <circleGeometry args={[Math.min(7.5, Math.max(3.6, (chunk.bounds.maxX - chunk.bounds.minX) * 0.32)), 48]} />
      </mesh>
      <mesh
        name={`warm-light-pool:${chunk.id}`}
        position={[chunk.heroLight[0], 0.158, chunk.heroLight[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={warmMaterial}
        renderOrder={3}
      >
        <circleGeometry args={[3.6, 40]} />
      </mesh>
    </group>
  );
}

function HeroArchitecture({ activeIds }: { readonly activeIds: ReadonlySet<WorldChunkId> }): React.ReactElement {
  return (
    <group name="r3f-hero-architecture">
      {activeIds.has('atrium') ? <ArchedPortal position={[0, 0, -6.35]} accent={0xd7b469} /> : null}
      {activeIds.has('grand-hall') ? <ArchedPortal position={[0, 0, -21.65]} accent={0xe0bd75} scale={1.4} /> : null}
      {activeIds.has('training-yard') ? <TrainingTargets /> : null}
      {activeIds.has('lake-grotto') ? <ReflectiveLake /> : null}
    </group>
  );
}

function ArchedPortal({
  position,
  accent,
  scale = 1,
}: {
  readonly position: Vec3Tuple;
  readonly accent: number;
  readonly scale?: number;
}): React.ReactElement {
  const trim = useMemo(() => new THREE.MeshStandardMaterial({
    color: accent,
    roughness: 0.28,
    metalness: 0.48,
    envMapIntensity: 1.3,
  }), [accent]);

  return (
    <group position={position as [number, number, number]} scale={scale}>
      <mesh position={[-1.8, 1.4, 0]} castShadow material={trim}>
        <cylinderGeometry args={[0.13, 0.16, 2.8, 18]} />
      </mesh>
      <mesh position={[1.8, 1.4, 0]} castShadow material={trim}>
        <cylinderGeometry args={[0.13, 0.16, 2.8, 18]} />
      </mesh>
      <mesh position={[0, 2.78, 0]} rotation={[0, 0, Math.PI / 2]} castShadow material={trim}>
        <torusGeometry args={[1.8, 0.12, 16, 48, Math.PI]} />
      </mesh>
      <Sparkles count={36} speed={0.34} opacity={0.45} color="#ffe3a0" size={1.2} scale={[3.5, 2.2, 0.5]} position={[0, 1.65, 0.1]} />
    </group>
  );
}

function TrainingTargets(): React.ReactElement {
  return (
    <group position={[17, 0, 35.6]}>
      {[-2.2, 0, 2.2].map((x, index) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.85, 0]} castShadow>
            <cylinderGeometry args={[0.58, 0.58, 0.08, 32]} />
            <meshStandardMaterial color={index === 1 ? 0xffd47d : 0xbd6d5b} roughness={0.55} metalness={0.1} />
          </mesh>
          <mesh position={[0, 0.45, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.05, 0.9, 8]} />
            <meshStandardMaterial color={0x584032} roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ReflectiveLake(): React.ReactElement {
  return (
    <mesh name="shader-reflective-lake-surface" position={[-16, 0.09, 21]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[7.2, 96]} />
      <meshPhysicalMaterial
        color="#3f91a6"
        emissive="#113d56"
        emissiveIntensity={0.35}
        metalness={0}
        roughness={0.12}
        clearcoat={1}
        clearcoatRoughness={0.08}
        transparent
        opacity={0.72}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface SceneStoryAnchor {
  readonly key: string;
  readonly position: ThreeVec3Tuple;
  readonly rotation: ThreeVec3Tuple;
  readonly scale: ThreeVec3Tuple;
  readonly color: number;
  readonly phase: number;
}

const sceneStoryPropCounts: Record<WorldChunkId, number> = {
  atrium: 16,
  'arcane-library': 18,
  'grand-hall': 15,
  'dining-hall': 17,
  'moonlit-lawn': 14,
  'lake-grotto': 17,
  'training-yard': 14,
  'crystal-greenhouse': 16,
};

function SceneStoryLayer({ activeChunks }: { readonly activeChunks: readonly WorldChunkDefinition[] }): React.ReactElement {
  const propCount = useMemo(() => activeChunks.reduce((total, chunk) => total + getSceneStoryPropCount(chunk), 0), [activeChunks]);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      sceneStoryProps: String(propCount),
    };
  }, [propCount]);

  return (
    <group name="runtime-scene-story-layer">
      {activeChunks.map((chunk, index) => (
        <ChunkStoryProps key={chunk.id} chunk={chunk} index={index} />
      ))}
    </group>
  );
}

function ChunkStoryProps({
  chunk,
  index,
}: {
  readonly chunk: WorldChunkDefinition;
  readonly index: number;
}): React.ReactElement {
  const centerX = (chunk.bounds.minX + chunk.bounds.maxX) / 2;
  const centerZ = (chunk.bounds.minZ + chunk.bounds.maxZ) / 2;

  if (chunk.id === 'atrium') {
    return (
      <group name="story-props:atrium">
        <FloatingParchmentSwarm chunk={chunk} count={7} origin={[centerX - 0.4, 2.25, centerZ - 0.6]} radius={[3.6, 2.4]} />
        <CandleCluster chunk={chunk} count={5} origin={[centerX - 3.9, 0.2, centerZ + 2.8]} spread={[2.8, 1.3]} />
        <HangingBannerCluster chunk={chunk} count={4} origin={[centerX, 2.45, chunk.bounds.minZ + 0.72]} spread={8.2} facing={0} />
      </group>
    );
  }

  if (chunk.id === 'arcane-library') {
    return (
      <group name="story-props:arcane-library">
        <CandleCluster chunk={chunk} count={6} origin={[chunk.bounds.maxX - 1.5, 0.23, centerZ - 1.8]} spread={[1.4, 2.3]} />
        <BookStackCluster chunk={chunk} count={7} origin={[chunk.bounds.minX + 1.35, 0.2, centerZ + 2.8]} spread={[2.4, 1.2]} />
      </group>
    );
  }

  if (chunk.id === 'grand-hall') {
    return (
      <group name="story-props:grand-hall">
        <HangingBannerCluster chunk={chunk} count={5} origin={[centerX, 2.9, chunk.bounds.minZ + 1.1]} spread={12.4} facing={0} />
        <CandleCluster chunk={chunk} count={6} origin={[centerX, 0.22, centerZ + 4.1]} spread={[5.8, 1.2]} />
        <GroundRuneCluster chunk={chunk} count={4} origin={[centerX, 0.22, centerZ - 0.9]} radius={[4.8, 2.2]} />
      </group>
    );
  }

  if (chunk.id === 'dining-hall') {
    return (
      <group name="story-props:dining-hall">
        <CandleCluster chunk={chunk} count={7} origin={[centerX + 1.4, 0.24, centerZ - 0.8]} spread={[4.6, 2.5]} />
        <SteamWispCluster chunk={chunk} count={6} origin={[centerX + 0.3, 0.62, centerZ + 1.2]} spread={[3.8, 2.3]} />
        <HangingBannerCluster chunk={chunk} count={4} origin={[chunk.bounds.maxX - 0.58, 2.2, centerZ]} spread={6.0} facing={-Math.PI / 2} />
      </group>
    );
  }

  if (chunk.id === 'moonlit-lawn') {
    return (
      <group name="story-props:moonlit-lawn">
        <GroundRuneCluster chunk={chunk} count={7} origin={[centerX - 2.6, 0.22, centerZ + 1.3]} radius={[8.2, 4.6]} />
        <VialCluster chunk={chunk} count={4} origin={[centerX + 5.5, 0.24, centerZ - 3.6]} spread={[2.6, 1.8]} />
        <HangingBannerCluster chunk={chunk} count={3} origin={[centerX + 1.5, 1.95, chunk.bounds.minZ + 1.3]} spread={7.4} facing={0.18} />
      </group>
    );
  }

  if (chunk.id === 'lake-grotto') {
    return (
      <group name="story-props:lake-grotto">
        <LakeRippleCluster chunk={chunk} count={8} origin={[-16, 0.16, 21]} radius={[5.6, 4.8]} />
        <VialCluster chunk={chunk} count={6} origin={[chunk.bounds.maxX - 2.4, 0.25, centerZ - 1.6]} spread={[2.3, 4.6]} />
        <SteamWispCluster chunk={chunk} count={3} origin={[centerX - 2.1, 0.52, centerZ + 2.8]} spread={[3.0, 2.6]} />
      </group>
    );
  }

  if (chunk.id === 'training-yard') {
    return (
      <group name="story-props:training-yard">
        <HangingBannerCluster chunk={chunk} count={5} origin={[centerX, 2.0, chunk.bounds.maxZ - 0.9]} spread={8.5} facing={Math.PI} />
        <EmberShardCluster chunk={chunk} count={5} origin={[centerX - 2.5, 0.34, centerZ - 1.8]} spread={[3.8, 2.8]} />
        <GroundRuneCluster chunk={chunk} count={4} origin={[centerX + 1.1, 0.22, centerZ + 0.7]} radius={[4.4, 3.2]} />
      </group>
    );
  }

  if (chunk.id === 'crystal-greenhouse') {
    return (
      <group name="story-props:crystal-greenhouse">
        <VialCluster chunk={chunk} count={7} origin={[centerX - 1.1, 0.25, centerZ + 0.8]} spread={[5.6, 3.8]} />
        <SteamWispCluster chunk={chunk} count={5} origin={[centerX - 3.3, 0.55, centerZ + 1.2]} spread={[4.6, 3.5]} />
        <HangingBannerCluster chunk={chunk} count={4} origin={[centerX, 2.25, chunk.bounds.maxZ - 0.95]} spread={9.2} facing={Math.PI} />
      </group>
    );
  }

  return (
    <group name={`story-props:${chunk.id}`}>
      <GroundRuneCluster chunk={chunk} count={getSceneStoryPropCount(chunk)} origin={[centerX, 0.22, centerZ]} radius={[3.8 + index, 2.4 + index * 0.4]} />
    </group>
  );
}

function FloatingParchmentSwarm({
  chunk,
  count,
  origin,
  radius,
}: {
  readonly chunk: WorldChunkDefinition;
  readonly count: number;
  readonly origin: ThreeVec3Tuple;
  readonly radius: readonly [number, number];
}): React.ReactElement {
  const pages = useMemo(() => createSceneStoryAnchors(
    `${chunk.id}:floating-pages`,
    count,
    origin,
    radius,
    [0.44, 0.03, 0.62],
    chunk.palette.accent,
  ), [chunk.id, chunk.palette.accent, count, origin, radius]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    name: `runtime-story-parchment:${chunk.id}`,
    color: 0xf1dfb4,
    roughness: 0.82,
    metalness: 0,
    envMapIntensity: 0.22,
    side: THREE.DoubleSide,
  }), [chunk.id]);

  return (
    <group name={`floating-parchment-swarm:${chunk.id}`}>
      {pages.map((page) => (
        <Float key={page.key} speed={0.55 + page.phase * 0.18} floatIntensity={0.18} rotationIntensity={0.32}>
          <mesh
            name={`story-floating-parchment:${chunk.id}`}
            position={page.position}
            rotation={page.rotation}
            scale={page.scale}
            material={material}
            castShadow
          >
            <planeGeometry args={[1, 1.34, 3, 3]} />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

function CandleCluster({
  chunk,
  count,
  origin,
  spread,
}: {
  readonly chunk: WorldChunkDefinition;
  readonly count: number;
  readonly origin: ThreeVec3Tuple;
  readonly spread: readonly [number, number];
}): React.ReactElement {
  const candles = useMemo(() => createSceneStoryAnchors(
    `${chunk.id}:candles`,
    count,
    origin,
    spread,
    [0.78, 0.78, 0.78],
    chunk.palette.accent,
  ), [chunk.id, chunk.palette.accent, count, origin, spread]);
  const waxMaterial = useMemo(() => createPbrMaterial(
    `runtime-story-wax:${chunk.id}`,
    createFilePbrSet('organic'),
    { color: 0xf0dbc0, roughness: 0.7, metalness: 0, envMapIntensity: 0.18, normalScale: 0.08 },
  ), [chunk.id]);
  const brassMaterial = useMemo(() => createPbrMaterial(
    `runtime-story-candle-brass:${chunk.id}`,
    createFilePbrSet('metal'),
    { color: chunk.palette.accent, roughness: 0.38, metalness: 0.44, envMapIntensity: 0.8, normalScale: 0.12 },
  ), [chunk.id, chunk.palette.accent]);

  return (
    <group name={`candle-cluster:${chunk.id}`}>
      <FlickerPointLight
        position={[origin[0], origin[1] + 1.05, origin[2]]}
        color={chunk.palette.accent}
        intensity={2.3}
        distance={6.5}
        phase={count * 0.37}
      />
      {candles.map((candle, candleIndex) => (
        <group
          key={candle.key}
          name={`story-candle:${chunk.id}`}
          position={candle.position}
          rotation={[0, candle.rotation[1], 0]}
          scale={[candle.scale[0] * 0.44, candle.scale[1] * (0.5 + candleIndex * 0.025), candle.scale[2] * 0.44]}
        >
          <mesh position={[0, 0.17, 0]} castShadow receiveShadow material={waxMaterial}>
            <cylinderGeometry args={[0.12, 0.14, 0.34, 18]} />
          </mesh>
          <mesh position={[0, -0.02, 0]} receiveShadow material={brassMaterial}>
            <cylinderGeometry args={[0.22, 0.24, 0.045, 20]} />
          </mesh>
          <Float speed={0.9 + candle.phase * 0.2} floatIntensity={0.025} rotationIntensity={0.05}>
            <mesh position={[0, 0.42, 0]} scale={[0.46, 0.72, 0.46]}>
              <sphereGeometry args={[0.13, 16, 10]} />
              <meshBasicMaterial color={0xffc56e} transparent opacity={0.74} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          </Float>
        </group>
      ))}
    </group>
  );
}

function HangingBannerCluster({
  chunk,
  count,
  origin,
  spread,
  facing,
}: {
  readonly chunk: WorldChunkDefinition;
  readonly count: number;
  readonly origin: ThreeVec3Tuple;
  readonly spread: number;
  readonly facing: number;
}): React.ReactElement {
  const banners = useMemo(() => createLinearStoryAnchors(
    `${chunk.id}:banners`,
    count,
    origin,
    spread,
    facing,
    [0.82, 0.88, 1],
    chunk.palette.accent,
  ), [chunk.id, chunk.palette.accent, count, facing, origin, spread]);
  const clothPalette = useMemo(() => getBannerClothPalette(chunk), [chunk]);
  const clothSet = useMemo(() => createOrganicPbrSet(
    `banner-cloth:${chunk.id}:${clothPalette.join(':')}`,
    clothPalette[0],
    clothPalette[1],
    clothPalette[2],
  ), [chunk.id, clothPalette]);
  const clothMaterials = useMemo(() => banners.map((banner, bannerIndex) => {
    const material = createPbrMaterial(
      `runtime-story-banner-cloth:${chunk.id}:${bannerIndex}`,
      clothSet,
      {
        color: getBannerClothColor(chunk, banner.color, bannerIndex),
        roughness: 0.9,
        metalness: 0,
        envMapIntensity: 0.18,
        normalScale: 0.18,
      },
    );
    material.side = THREE.DoubleSide;
    return material;
  }), [banners, chunk, clothSet]);
  const trimMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    name: `runtime-story-banner-edge-trim:${chunk.id}`,
    color: new THREE.Color(chunk.palette.accent).lerp(new THREE.Color(0x6e5840), 0.58).getHex(),
    roughness: 0.72,
    metalness: 0.18,
    envMapIntensity: 0.28,
    side: THREE.DoubleSide,
  }), [chunk.id, chunk.palette.accent]);
  const rodMaterial = useMemo(() => createPbrMaterial(
    `runtime-story-banner-rod:${chunk.id}`,
    createFilePbrSet('metal'),
    {
      color: new THREE.Color(chunk.palette.accent).lerp(new THREE.Color(0xa77c43), 0.72).getHex(),
      roughness: 0.42,
      metalness: 0.46,
      envMapIntensity: 0.56,
      normalScale: 0.08,
    },
  ), [chunk.id, chunk.palette.accent]);
  const embroideryMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    name: `runtime-story-banner-embroidery:${chunk.id}`,
    color: new THREE.Color(chunk.palette.emissive).lerp(new THREE.Color(0xe7c987), 0.46).getHex(),
    transparent: true,
    opacity: 0.11,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [chunk.id, chunk.palette.emissive]);
  const foldMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    name: `runtime-story-banner-fold-shadow:${chunk.id}`,
    color: new THREE.Color(chunk.palette.wall).lerp(new THREE.Color(0x11151d), 0.46).getHex(),
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [chunk.id, chunk.palette.wall]);
  const tasselMaterial = useMemo(() => createPbrMaterial(
    `runtime-story-banner-cord:${chunk.id}`,
    createFilePbrSet('organic'),
    {
      color: new THREE.Color(chunk.palette.accent).lerp(new THREE.Color(0xd6b470), 0.36).getHex(),
      roughness: 0.86,
      metalness: 0.02,
      envMapIntensity: 0.24,
      normalScale: 0.16,
    },
  ), [chunk.id, chunk.palette.accent]);

  return (
    <group name={`hanging-banner-cluster:${chunk.id}`}>
      {banners.map((banner, bannerIndex) => (
        <Float key={banner.key} speed={0.22 + banner.phase * 0.1} floatIntensity={0.025} rotationIntensity={0.045}>
          <group position={banner.position} rotation={[0, banner.rotation[1], 0]} scale={banner.scale}>
            <mesh position={[0, 0.7, -0.02]} material={clothMaterials[bannerIndex]} castShadow receiveShadow>
              <planeGeometry args={[0.74, 1.46, 6, 10]} />
            </mesh>
            {bannerIndex === 0 ? [-0.24, -0.07, 0.13, 0.27].map((foldX, foldIndex) => (
                <mesh
                  key={`fold-${foldX}`}
                  position={[foldX, 0.68 + foldIndex * 0.018, -0.041 - foldIndex * 0.001]}
                  rotation={[0, 0, seededSigned(`${chunk.id}:banner-fold`, bannerIndex * 7 + foldIndex) * 0.035]}
                  material={foldMaterial}
                  renderOrder={5}
                >
                  <planeGeometry args={[0.018 + foldIndex * 0.002, 1.18 - foldIndex * 0.05, 1, 5]} />
                </mesh>
              )) : null}
            <mesh position={[-0.39, 0.7, -0.032]} material={trimMaterial} castShadow receiveShadow>
              <planeGeometry args={[0.035, 1.42, 1, 4]} />
            </mesh>
            <mesh position={[0.39, 0.7, -0.032]} material={trimMaterial} castShadow receiveShadow>
              <planeGeometry args={[0.035, 1.42, 1, 4]} />
            </mesh>
            <mesh position={[0, -0.015, -0.034]} material={trimMaterial} castShadow receiveShadow>
              <planeGeometry args={[0.68, 0.04, 4, 1]} />
            </mesh>
            <mesh position={[0, 1.54, 0]} rotation={[0, 0, Math.PI / 2]} material={rodMaterial} castShadow>
              <cylinderGeometry args={[0.035, 0.035, 0.95, 10]} />
            </mesh>
            {bannerIndex === 0 ? [-0.52, 0.52].map((finialX) => (
              <mesh key={`finial-${finialX}`} position={[finialX, 1.54, 0]} material={rodMaterial} castShadow>
                <sphereGeometry args={[0.055, 12, 8]} />
              </mesh>
            )) : null}
            {bannerIndex === 0 ? [-0.43, 0.43].map((cordX) => (
              <mesh key={`cord-${cordX}`} position={[cordX, 0.68, -0.047]} material={tasselMaterial} castShadow>
                <cylinderGeometry args={[0.011, 0.014, 1.26, 7]} />
              </mesh>
            )) : null}
            {bannerIndex === 0 ? [-0.3, 0, 0.3].map((tasselX, tasselIndex) => (
              <mesh
                key={`tassel-${tasselX}`}
                position={[tasselX, -0.13 - tasselIndex * 0.012, -0.046]}
                rotation={[0, 0, seededSigned(`${chunk.id}:banner-tassel`, bannerIndex * 5 + tasselIndex) * 0.08]}
                material={tasselMaterial}
                castShadow
              >
                <coneGeometry args={[0.04, 0.18, 7]} />
              </mesh>
            )) : null}
            <mesh position={[0, 0.34, -0.038]} material={embroideryMaterial} renderOrder={4}>
              <ringGeometry args={[0.105, 0.128, 32]} />
            </mesh>
            <mesh position={[0, 0.34, -0.039]} rotation={[0, 0, Math.PI / 2]} material={embroideryMaterial} renderOrder={4}>
              <planeGeometry args={[0.024, 0.34, 1, 1]} />
            </mesh>
          </group>
        </Float>
      ))}
    </group>
  );
}

function getBannerClothPalette(chunk: WorldChunkDefinition): readonly [string, string, string] {
  const floor = new THREE.Color(chunk.palette.floor);
  const wall = new THREE.Color(chunk.palette.wall);
  const accent = new THREE.Color(chunk.palette.accent);
  const dark = floor.clone().lerp(wall, 0.52).lerp(new THREE.Color(0x26302f), 0.18);
  const mid = wall.clone().lerp(accent, chunk.region === 'exterior' ? 0.16 : 0.22);
  const light = new THREE.Color(0xc2b58c).lerp(accent, chunk.region === 'exterior' ? 0.12 : 0.08);
  dark.offsetHSL(0, -0.08, -0.04);
  mid.offsetHSL(0, -0.1, 0.02);
  light.offsetHSL(0, -0.06, 0.02);
  return [`#${dark.getHexString()}`, `#${mid.getHexString()}`, `#${light.getHexString()}`];
}

function getBannerClothColor(chunk: WorldChunkDefinition, anchorColor: number, index: number): number {
  const wall = new THREE.Color(chunk.palette.wall);
  const accent = new THREE.Color(anchorColor);
  const variation = seededNoise(`${chunk.id}:banner-cloth`, index) * 0.1;
  const color = new THREE.Color(0xd7cfbd)
    .lerp(wall, 0.2)
    .lerp(accent, chunk.region === 'exterior' ? 0.06 + variation : 0.09 + variation);
  color.offsetHSL(0, -0.08, chunk.region === 'interior' ? 0.02 : -0.01);
  return color.getHex();
}

function BookStackCluster({
  chunk,
  count,
  origin,
  spread,
}: {
  readonly chunk: WorldChunkDefinition;
  readonly count: number;
  readonly origin: ThreeVec3Tuple;
  readonly spread: readonly [number, number];
}): React.ReactElement {
  const stacks = useMemo(() => createSceneStoryAnchors(
    `${chunk.id}:book-stacks`,
    count,
    origin,
    spread,
    [0.72, 0.52, 0.82],
    chunk.palette.accent,
  ), [chunk.id, chunk.palette.accent, count, origin, spread]);
  const coverMaterial = useMemo(() => createPbrMaterial(
    `runtime-story-book-cover:${chunk.id}`,
    createFilePbrSet('organic'),
    { color: chunk.palette.wall, roughness: 0.76, metalness: 0.03, envMapIntensity: 0.24, normalScale: 0.14 },
  ), [chunk.id, chunk.palette.wall]);
  const pageMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    name: `runtime-story-book-pages:${chunk.id}`,
    color: 0xd8c8a0,
    roughness: 0.9,
    metalness: 0,
    envMapIntensity: 0.12,
  }), [chunk.id]);

  return (
    <group name={`book-stack-cluster:${chunk.id}`}>
      {stacks.map((stack, stackIndex) => (
        <group key={stack.key} name={`story-book-stack:${chunk.id}`} position={stack.position} rotation={[0, stack.rotation[1], 0]} scale={stack.scale}>
          {[0, 1, 2].map((book) => (
            <group key={book} position={[0, 0.055 + book * 0.082, 0]} rotation={[0, (book - 1) * 0.12 + stack.phase * 0.1, 0]}>
              <mesh castShadow receiveShadow material={coverMaterial}>
                <boxGeometry args={[0.72 + book * 0.04, 0.055, 0.46]} />
              </mesh>
              <mesh position={[0, 0.032, 0.02]} receiveShadow material={pageMaterial}>
                <boxGeometry args={[0.62, 0.018, 0.37]} />
              </mesh>
            </group>
          ))}
          {stackIndex % 2 === 0 ? (
            <mesh position={[0.23, 0.39, -0.08]} rotation={[0, 0, -0.22]} castShadow>
              <planeGeometry args={[0.36, 0.5, 2, 2]} />
              <meshStandardMaterial color={0xeadfbf} roughness={0.84} metalness={0} side={THREE.DoubleSide} />
            </mesh>
          ) : null}
        </group>
      ))}
    </group>
  );
}

function GroundRuneCluster({
  chunk,
  count,
  origin,
  radius,
}: {
  readonly chunk: WorldChunkDefinition;
  readonly count: number;
  readonly origin: ThreeVec3Tuple;
  readonly radius: readonly [number, number];
}): React.ReactElement {
  const runes = useMemo(() => createSceneStoryAnchors(
    `${chunk.id}:ground-runes`,
    count,
    origin,
    radius,
    [1, 1, 1],
    chunk.palette.emissive,
  ), [chunk.id, chunk.palette.emissive, count, origin, radius]);

  return (
    <group name={`ground-rune-cluster:${chunk.id}`}>
      {runes.map((rune) => (
        <AnimatedRune key={rune.key} chunk={chunk} anchor={rune} />
      ))}
    </group>
  );
}

function AnimatedRune({
  chunk,
  anchor,
}: {
  readonly chunk: WorldChunkDefinition;
  readonly anchor: SceneStoryAnchor;
}): React.ReactElement {
  const material = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (!material.current) return;
    material.current.opacity = 0.1 + Math.sin(clock.elapsedTime * 0.7 + anchor.phase * 5.4) * 0.035;
  });

  return (
    <mesh
      name={`story-ground-rune:${chunk.id}`}
      position={[anchor.position[0], 0.205, anchor.position[2]]}
      rotation={[-Math.PI / 2, 0, anchor.rotation[1]]}
      scale={[0.5 + anchor.phase * 0.62, 0.5 + anchor.phase * 0.62, 1]}
      renderOrder={7}
    >
      <torusGeometry args={[0.42, 0.01, 8, 64]} />
      <meshBasicMaterial
        ref={material}
        color={chunk.palette.emissive}
        transparent
        opacity={0.1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function LakeRippleCluster({
  chunk,
  count,
  origin,
  radius,
}: {
  readonly chunk: WorldChunkDefinition;
  readonly count: number;
  readonly origin: ThreeVec3Tuple;
  readonly radius: readonly [number, number];
}): React.ReactElement {
  const ripples = useMemo(() => createSceneStoryAnchors(
    `${chunk.id}:lake-ripples`,
    count,
    origin,
    radius,
    [1, 1, 1],
    chunk.palette.emissive,
  ), [chunk.id, chunk.palette.emissive, count, origin, radius]);

  return (
    <group name={`lake-ripple-cluster:${chunk.id}`}>
      {ripples.map((ripple) => (
        <AnimatedRipple key={ripple.key} chunk={chunk} anchor={ripple} />
      ))}
    </group>
  );
}

function AnimatedRipple({
  chunk,
  anchor,
}: {
  readonly chunk: WorldChunkDefinition;
  readonly anchor: SceneStoryAnchor;
}): React.ReactElement {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const baseScale = 0.48 + anchor.phase * 0.72;

  useFrame(({ clock }) => {
    const pulse = (Math.sin(clock.elapsedTime * 0.5 + anchor.phase * Math.PI * 2) + 1) * 0.5;
    if (mesh.current) {
      const scale = baseScale + pulse * 0.22;
      mesh.current.scale.set(scale, scale * (0.72 + anchor.phase * 0.12), 1);
    }
    if (material.current) material.current.opacity = 0.08 + (1 - pulse) * 0.07;
  });

  return (
    <mesh
      ref={mesh}
      name={`story-lake-ripple:${chunk.id}`}
      position={[anchor.position[0], 0.176, anchor.position[2]]}
      rotation={[-Math.PI / 2, 0, anchor.rotation[1]]}
      renderOrder={8}
    >
      <torusGeometry args={[0.66, 0.012, 8, 72]} />
      <meshBasicMaterial
        ref={material}
        color={chunk.palette.emissive}
        transparent
        opacity={0.12}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function VialCluster({
  chunk,
  count,
  origin,
  spread,
}: {
  readonly chunk: WorldChunkDefinition;
  readonly count: number;
  readonly origin: ThreeVec3Tuple;
  readonly spread: readonly [number, number];
}): React.ReactElement {
  const vials = useMemo(() => createSceneStoryAnchors(
    `${chunk.id}:vials`,
    count,
    origin,
    spread,
    [0.78, 0.78, 0.78],
    chunk.palette.emissive,
  ), [chunk.id, chunk.palette.emissive, count, origin, spread]);
  const glassMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    name: `runtime-story-vial-glass:${chunk.id}`,
    color: chunk.palette.emissive,
    roughness: 0.06,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.2,
    transparent: true,
    opacity: 0.38,
  }), [chunk.id, chunk.palette.emissive]);
  const corkMaterial = useMemo(() => createPbrMaterial(
    `runtime-story-vial-cork:${chunk.id}`,
    createFilePbrSet('wood'),
    { color: 0x705039, roughness: 0.82, metalness: 0, envMapIntensity: 0.18, normalScale: 0.12 },
  ), [chunk.id]);

  return (
    <group name={`vial-cluster:${chunk.id}`}>
      <FlickerPointLight
        position={[origin[0], origin[1] + 0.88, origin[2]]}
        color={chunk.palette.emissive}
        intensity={1.8}
        distance={7.2}
        phase={count * 0.61}
      />
      {vials.map((vial) => (
        <Float key={vial.key} speed={0.26 + vial.phase * 0.12} floatIntensity={0.035} rotationIntensity={0.035}>
          <group
            name={`story-glow-vial:${chunk.id}`}
            position={vial.position}
            rotation={[0, vial.rotation[1], 0]}
            scale={[vial.scale[0] * 0.72, vial.scale[1] * 0.72, vial.scale[2] * 0.72]}
          >
            <mesh position={[0, 0.27, 0]} castShadow receiveShadow material={glassMaterial}>
              <cylinderGeometry args={[0.12, 0.17, 0.42, 20]} />
            </mesh>
            <mesh position={[0, 0.52, 0]} castShadow receiveShadow material={glassMaterial}>
              <cylinderGeometry args={[0.06, 0.08, 0.24, 16]} />
            </mesh>
            <mesh position={[0, 0.68, 0]} castShadow material={corkMaterial}>
              <cylinderGeometry args={[0.07, 0.07, 0.11, 12]} />
            </mesh>
            <mesh position={[0, 0.25, 0]} scale={[1, 0.52, 1]}>
              <sphereGeometry args={[0.18, 18, 10]} />
              <meshBasicMaterial color={chunk.palette.emissive} transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          </group>
        </Float>
      ))}
    </group>
  );
}

function SteamWispCluster({
  chunk,
  count,
  origin,
  spread,
}: {
  readonly chunk: WorldChunkDefinition;
  readonly count: number;
  readonly origin: ThreeVec3Tuple;
  readonly spread: readonly [number, number];
}): React.ReactElement {
  const wisps = useMemo(() => createSceneStoryAnchors(
    `${chunk.id}:steam-wisps`,
    count,
    origin,
    spread,
    [0.82, 1.28, 1],
    chunk.palette.emissive,
  ), [chunk.id, chunk.palette.emissive, count, origin, spread]);

  return (
    <group name={`steam-wisp-cluster:${chunk.id}`}>
      {wisps.map((wisp) => (
        <AnimatedSteamWisp key={wisp.key} chunk={chunk} anchor={wisp} />
      ))}
    </group>
  );
}

function AnimatedSteamWisp({
  chunk,
  anchor,
}: {
  readonly chunk: WorldChunkDefinition;
  readonly anchor: SceneStoryAnchor;
}): React.ReactElement {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const rise = Math.sin(clock.elapsedTime * 0.38 + anchor.phase * Math.PI * 2);
    if (mesh.current) mesh.current.position.y = anchor.position[1] + rise * 0.11;
    if (material.current) material.current.opacity = 0.035 + (rise + 1) * 0.02;
  });

  return (
    <mesh
      ref={mesh}
      name={`story-steam-wisp:${chunk.id}`}
      position={anchor.position}
      rotation={[0, anchor.rotation[1], 0]}
      scale={anchor.scale}
      renderOrder={5}
    >
      <planeGeometry args={[0.72, 1.2, 3, 5]} />
      <meshBasicMaterial
        ref={material}
        color={chunk.palette.emissive}
        transparent
        opacity={0.05}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function EmberShardCluster({
  chunk,
  count,
  origin,
  spread,
}: {
  readonly chunk: WorldChunkDefinition;
  readonly count: number;
  readonly origin: ThreeVec3Tuple;
  readonly spread: readonly [number, number];
}): React.ReactElement {
  const embers = useMemo(() => createSceneStoryAnchors(
    `${chunk.id}:embers`,
    count,
    origin,
    spread,
    [0.72, 0.72, 0.72],
    chunk.palette.accent,
  ), [chunk.id, chunk.palette.accent, count, origin, spread]);

  return (
    <group name={`ember-shard-cluster:${chunk.id}`}>
      <FlickerPointLight
        position={[origin[0], origin[1] + 0.72, origin[2]]}
        color={chunk.palette.accent}
        intensity={1.6}
        distance={6.4}
        phase={count * 0.27}
      />
      {embers.map((ember) => (
        <Float key={ember.key} speed={0.48 + ember.phase * 0.2} floatIntensity={0.12} rotationIntensity={0.2}>
          <mesh
            name={`story-ember-shard:${chunk.id}`}
            position={ember.position}
            rotation={ember.rotation}
            scale={[0.24 + ember.phase * 0.16, 0.18 + ember.phase * 0.22, 0.24 + ember.phase * 0.16]}
            castShadow
          >
            <tetrahedronGeometry args={[0.34, 0]} />
            <meshBasicMaterial color={chunk.palette.accent} transparent opacity={0.72} blending={THREE.AdditiveBlending} />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

function FlickerPointLight({
  position,
  color,
  intensity,
  distance,
  phase,
}: {
  readonly position: ThreeVec3Tuple;
  readonly color: THREE.ColorRepresentation;
  readonly intensity: number;
  readonly distance: number;
  readonly phase: number;
}): React.ReactElement {
  const light = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!light.current) return;
    light.current.intensity = intensity * (
      0.88
      + Math.sin(clock.elapsedTime * 4.1 + phase) * 0.08
      + Math.sin(clock.elapsedTime * 11.3 + phase * 1.7) * 0.035
    );
  });

  return <pointLight ref={light} position={position} color={color} intensity={intensity} distance={distance} decay={2.1} />;
}

function getSceneStoryPropCount(chunk: WorldChunkDefinition): number {
  return sceneStoryPropCounts[chunk.id];
}

function createSceneStoryAnchors(
  seed: string,
  count: number,
  origin: ThreeVec3Tuple,
  spread: readonly [number, number],
  baseScale: ThreeVec3Tuple,
  color: number,
): SceneStoryAnchor[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = seededNoise(seed, index + 11) * Math.PI * 2;
    const ring = 0.24 + seededNoise(seed, index + 17) * 0.76;
    const x = origin[0] + Math.cos(angle) * spread[0] * ring;
    const z = origin[2] + Math.sin(angle) * spread[1] * ring;
    const phase = seededNoise(seed, index + 71);

    return {
      key: `${seed}:${index}`,
      position: [
        x,
        origin[1] + seededSigned(seed, index + 31) * 0.32,
        z,
      ],
      rotation: [
        seededSigned(seed, index + 41) * 0.22,
        seededNoise(seed, index + 47) * Math.PI * 2,
        seededSigned(seed, index + 53) * 0.18,
      ],
      scale: [
        baseScale[0] * (0.78 + phase * 0.48),
        baseScale[1] * (0.82 + seededNoise(seed, index + 59) * 0.42),
        baseScale[2] * (0.8 + seededNoise(seed, index + 67) * 0.44),
      ],
      color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.12 + phase * 0.22).getHex(),
      phase,
    };
  });
}

function createLinearStoryAnchors(
  seed: string,
  count: number,
  origin: ThreeVec3Tuple,
  spread: number,
  facing: number,
  baseScale: ThreeVec3Tuple,
  color: number,
): SceneStoryAnchor[] {
  return Array.from({ length: count }, (_, index) => {
    const t = count <= 1 ? 0.5 : index / (count - 1);
    const offset = (t - 0.5) * spread + seededSigned(seed, index + 13) * 0.28;
    const lateralX = Math.cos(facing) * offset;
    const lateralZ = -Math.sin(facing) * offset;
    const phase = seededNoise(seed, index + 29);

    return {
      key: `${seed}:${index}`,
      position: [
        origin[0] + lateralX,
        origin[1] + seededSigned(seed, index + 31) * 0.12,
        origin[2] + lateralZ,
      ],
      rotation: [
        0,
        facing + seededSigned(seed, index + 37) * 0.05,
        seededSigned(seed, index + 41) * 0.035,
      ],
      scale: [
        baseScale[0] * (0.82 + phase * 0.3),
        baseScale[1] * (0.86 + seededNoise(seed, index + 43) * 0.22),
        baseScale[2],
      ],
      color: new THREE.Color(color).lerp(new THREE.Color(0x2f3650), 0.16 + phase * 0.18).getHex(),
      phase,
    };
  });
}

function NpcLayer({ activeIds }: { readonly activeIds: ReadonlySet<WorldChunkId> }): React.ReactElement {
  return (
    <group name="r3f-npcs">
      {NPC_SCENE_DEFINITIONS.map((npc) => (
        <NpcAvatar key={npc.id} npc={npc} active={isNpcInActiveChunk(npc, activeIds)} />
      ))}
    </group>
  );
}

const NpcAvatar = memo(function NpcAvatar({
  npc,
  active,
}: {
  readonly npc: R3FNpc;
  readonly active: boolean;
}): React.ReactElement | null {
  if (!active) return null;
  return (
    <RigidBody type="fixed" colliders={false} position={npc.position as [number, number, number]}>
      <CuboidCollider args={[0.42, 0.92, 0.42]} position={[0, 0.76, 0]} sensor />
      <Float speed={0.65} floatIntensity={0.08} rotationIntensity={0.06}>
        <group>
          <mesh position={[0, 0.78, 0]} castShadow>
            <capsuleGeometry args={[0.28, 0.9, 8, 16]} />
            <meshStandardMaterial color={npc.color} roughness={0.52} metalness={0.04} envMapIntensity={0.9} />
          </mesh>
          <mesh position={[0, 1.55, 0]} castShadow>
            <sphereGeometry args={[0.25, 24, 16]} />
            <meshStandardMaterial color={0xf4d6bd} roughness={0.48} />
          </mesh>
          <Sparkles count={14} speed={0.25} opacity={0.38} color={npc.color} size={0.8} scale={[1, 1.8, 1]} position={[0, 1.15, 0]} />
        </group>
      </Float>
      <Html position={[0, 2.05, 0]} center distanceFactor={12} className="r3f-npc-label">
        <strong>{npc.name}</strong>
        <span>{npc.title}</span>
      </Html>
    </RigidBody>
  );
});

function WorldCollision({ activeChunks }: { readonly activeChunks: readonly WorldChunkDefinition[] }): React.ReactElement {
  return (
    <group name="streamed-colliders">
      {activeChunks.map((chunk) => (
        <ChunkCollision key={chunk.id} chunk={chunk} />
      ))}
    </group>
  );
}

function ChunkCollision({ chunk }: { readonly chunk: WorldChunkDefinition }): React.ReactElement {
  const centerX = (chunk.bounds.minX + chunk.bounds.maxX) / 2;
  const centerZ = (chunk.bounds.minZ + chunk.bounds.maxZ) / 2;
  const halfW = (chunk.bounds.maxX - chunk.bounds.minX) / 2;
  const halfD = (chunk.bounds.maxZ - chunk.bounds.minZ) / 2;
  const wallThickness = 0.16;

  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[halfW, 0.06, halfD]} position={[centerX, 0, centerZ]} />
      {chunk.region !== 'exterior' ? (
        <>
          <CuboidCollider args={[halfW, 1.3, wallThickness]} position={[centerX, 1.3, chunk.bounds.minZ - wallThickness]} />
          <CuboidCollider args={[halfW, 1.3, wallThickness]} position={[centerX, 1.3, chunk.bounds.maxZ + wallThickness]} />
          <CuboidCollider args={[wallThickness, 1.3, halfD]} position={[chunk.bounds.minX - wallThickness, 1.3, centerZ]} />
          <CuboidCollider args={[wallThickness, 1.3, halfD]} position={[chunk.bounds.maxX + wallThickness, 1.3, centerZ]} />
        </>
      ) : null}
    </RigidBody>
  );
}

function ThirdPartyPropCollisionLayer({
  activeIds,
  playerPosition,
}: {
  readonly activeIds: ReadonlySet<WorldChunkId>;
  readonly playerPosition: THREE.Vector3;
}): React.ReactElement {
  const compactViewport = isCompactViewport();
  const lodKey = `${Math.round(playerPosition.x / 4)}:${Math.round(playerPosition.z / 4)}:${compactViewport ? 'mobile' : 'desktop'}`;
  const lodAnchor = useMemo<ThirdPartyWorldLodAnchor>(() => ({
    position: playerPosition.clone(),
    compactViewport,
  }), [lodKey]);
  const colliders = useMemo(() => thirdPartyWorldPlacements
    .map((placement) => {
      if (!activeIds.has(placement.chunkId)) return null;
      const collider = thirdPartyWorldRuntime.colliders?.[placement.sourceId];
      if (!collider || !shouldRenderThirdPartyPlacement(placement.sourceId, placement, lodAnchor)) return null;
      return { placement, collider };
    })
    .filter((entry): entry is {
      placement: ThirdPartyWorldPropPlacement;
      collider: ThirdPartyWorldBoxCollider;
    } => entry !== null), [activeIds, lodAnchor]);

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      vendorColliders: String(colliders.length),
    };
  }, [colliders.length]);

  return (
    <group name="cc0-third-party-prop-colliders">
      <RigidBody type="fixed" colliders={false}>
        {colliders.map(({ placement, collider }) => (
          <CuboidCollider
            key={`cc0-collider:${placement.id}`}
            args={getScaledColliderHalfExtents(collider, placement.scale)}
            position={getWorldColliderCenter(placement, collider)}
            rotation={toThreeVec3Tuple(placement.rotation)}
          />
        ))}
      </RigidBody>
    </group>
  );
}

function getScaledColliderHalfExtents(
  collider: ThirdPartyWorldBoxCollider,
  scale: number,
): ThreeVec3Tuple {
  return [
    collider.halfExtents[0] * scale,
    collider.halfExtents[1] * scale,
    collider.halfExtents[2] * scale,
  ];
}

function getWorldColliderCenter(
  placement: ThirdPartyWorldPropPlacement,
  collider: ThirdPartyWorldBoxCollider,
): ThreeVec3Tuple {
  const center = collider.center ?? [0, collider.halfExtents[1], 0];
  const offset = new THREE.Vector3(
    center[0] * placement.scale,
    center[1] * placement.scale,
    center[2] * placement.scale,
  );
  offset.applyEuler(new THREE.Euler(placement.rotation[0], placement.rotation[1], placement.rotation[2]));
  return [
    placement.position[0] + offset.x,
    placement.position[1] + offset.y,
    placement.position[2] + offset.z,
  ];
}

function toThreeVec3Tuple(tuple: Vec3Tuple): ThreeVec3Tuple {
  return [tuple[0], tuple[1], tuple[2]];
}

function BiomePhysicsLogicLayer({ activeIds }: { readonly activeIds: ReadonlySet<WorldChunkId> }): React.ReactElement {
  const lakeEnabled = activeIds.has('lake-grotto');
  const barrierCount = lakeEnabled ? 3 : 0;

  useEffect(() => {
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      biomePhysicalBarriers: String(barrierCount),
    };
  }, [barrierCount]);

  return (
    <group name="runtime-biome-physical-logic">
      {lakeEnabled ? (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[5.6, 0.58, 2.45]} position={[-16, 0.58, 21]} />
          <CuboidCollider args={[2.75, 0.58, 4.25]} position={[-16, 0.58, 21]} />
          <CuboidCollider args={[1.55, 0.5, 1.0]} position={[-18.8, 0.5, 17.1]} rotation={[0, 0.42, 0]} />
        </RigidBody>
      ) : null}
    </group>
  );
}

function MagicAtmosphere({ activeIds }: { readonly activeIds: ReadonlySet<WorldChunkId> }): React.ReactElement {
  const mistMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0x9fcfff,
    transparent: true,
    opacity: 0.045,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), []);

  return (
    <group name="r3f-atmosphere">
      <Sparkles count={72} speed={0.16} opacity={0.18} color="#b8dfff" size={0.55} scale={[40, 14, 40]} position={[0, 4, 8]} />
      {[-10, 0, 12, 24].map((z, index) => (
        <mesh
          key={z}
          name="low-lying-moonlit-mist-sheet"
          position={[index % 2 === 0 ? -7 : 7, 0.42 + index * 0.04, z]}
          rotation={[-Math.PI / 2, 0, index * 0.22]}
          material={mistMaterial}
          renderOrder={1}
        >
          <planeGeometry args={[28, 9, 1, 1]} />
        </mesh>
      ))}
      {activeIds.has('crystal-greenhouse') ? (
        <Sparkles count={80} speed={0.35} opacity={0.5} color="#9dffd9" size={2} scale={[14, 6, 10]} position={[-32, 2.8, 5]} />
      ) : null}
      {activeIds.has('lake-grotto') ? (
        <Sparkles count={28} speed={0.18} opacity={0.16} color="#76f0ff" size={0.45} scale={[12, 4, 12]} position={[-16, 2.4, 21]} />
      ) : null}
    </group>
  );
}

function useOptionalGlb(
  url: string | null,
  enhanceWorldMaterials = false,
  lightmapUrl?: string,
  priority: GlbLoadPriority = 'normal',
): THREE.Object3D | null {
  const [scene, setScene] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    if (!url) {
      setScene(null);
      return;
    }
    let cancelled = false;
    let cancelEnhancement: (() => void) | null = null;
    setAssetLoadState(url, 'loading');
    const scheduledLoad = scheduleGlbLoad(url, priority);
    scheduledLoad.promise
      .then((gltf) => {
        if (cancelled) return;
        setAssetLoadState(url, 'cloning');
        const clone = gltf.scene.clone(true);
        clone.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });
        setAssetLoadState(url, 'loaded');
        setScene(clone);
        if (enhanceWorldMaterials) {
          cancelEnhancement = scheduleAuthoredWorldMaterialEnhancement(clone, lightmapUrl);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAssetLoadState(url, `failed:${error instanceof Error ? error.message : String(error)}`);
          setScene(null);
        }
      });
    return () => {
      cancelled = true;
      scheduledLoad.cancel();
      cancelEnhancement?.();
    };
  }, [enhanceWorldMaterials, lightmapUrl, priority, url]);

  return scene;
}

function scheduleGlbLoad(
  url: string,
  priority: GlbLoadPriority,
): { readonly promise: Promise<Awaited<ReturnType<GLTFLoader['parseAsync']>>>; readonly cancel: () => void } {
  let cancelled = false;
  const isCritical = priority === 'critical';
  const promise = new Promise<Awaited<ReturnType<GLTFLoader['parseAsync']>>>((resolve, reject) => {
    const run = () => {
      if (cancelled) {
        reject(new Error('cancelled'));
        return;
      }
      activeGlbLoadCount += 1;
      if (isCritical) activeCriticalGlbLoadCount += 1;
      loadGlbArrayBuffer(url)
        .then(resolve, reject)
        .finally(() => {
          activeGlbLoadCount = Math.max(0, activeGlbLoadCount - 1);
          if (isCritical) activeCriticalGlbLoadCount = Math.max(0, activeCriticalGlbLoadCount - 1);
          flushGlbLoadQueue();
        });
    };
    if (isCritical) pendingCriticalGlbLoadQueue.push(run);
    else if (priority === 'high') pendingHighPriorityGlbLoadQueue.push(run);
    else pendingGlbLoadQueue.push(run);
    flushGlbLoadQueue();
  });
  return {
    promise,
    cancel: () => {
      cancelled = true;
    },
  };
}

async function loadGlbArrayBuffer(url: string): Promise<Awaited<ReturnType<GLTFLoader['parseAsync']>>> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while loading ${url}`);
  }
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const basePath = url.slice(0, url.lastIndexOf('/') + 1);
  const arrayBuffer = await response.arrayBuffer();
  setAssetLoadState(url, `fetched:${arrayBuffer.byteLength}`);
  const gltf = await loader.parseAsync(arrayBuffer, basePath);
  setAssetLoadState(url, 'parsed');
  return gltf;
}

function flushGlbLoadQueue(): void {
  while (activeGlbLoadCount < maxConcurrentGlbLoads) {
    const critical = pendingCriticalGlbLoadQueue.shift();
    if (critical) {
      critical();
      continue;
    }
    if (activeCriticalGlbLoadCount > 0) return;

    const normal = pendingHighPriorityGlbLoadQueue.shift() ?? pendingGlbLoadQueue.shift();
    if (!normal) return;
    normal();
  }
}

function setAssetLoadState(url: string, state: string): void {
  window.__r3fAssetLoads = {
    ...(window.__r3fAssetLoads ?? {}),
    [url]: state,
  };
}

function enhanceAuthoredWorldMaterial(
  source: THREE.MeshStandardMaterial,
  objectName: string,
  lightmap?: THREE.Texture,
  lightmapKey = 'none',
): THREE.MeshStandardMaterial {
  const materialLabel = `${source.name} ${objectName} ${lightmapKey}`;
  const normalizedLabel = materialLabel.toLowerCase();
  const surface = classifyWorldSurface(materialLabel);
  const isThirdPartyShelfWood = /vendor:ca-shelf-|ca-shelf/.test(normalizedLabel) && surface === 'wood';
  const isThirdPartyLibraryFurnitureWood = /vendor:(medieval-table|medieval-cart|ca-bench)/.test(normalizedLabel) && surface === 'wood';
  const thirdPartyWoodTreatment = isThirdPartyShelfWood
    ? 'dark-shelf-wood'
    : isThirdPartyLibraryFurnitureWood
      ? 'library-furniture-wood'
      : 'default';
  const emissiveGroup = source.emissiveIntensity > 0.01 && source.emissive.getHex() !== 0
    ? source.emissive.getHexString()
    : 'none';
  const color = source.color.getHex();
  const cacheKey = [
    surface,
    color.toString(16).padStart(6, '0'),
    emissiveGroup,
    source.transparent ? 'transparent' : 'opaque',
    lightmapKey,
    thirdPartyWoodTreatment,
  ].join(':');
  const cached = enhancedMaterialCache.get(cacheKey);
  if (cached) return cached;

  let material: THREE.MeshStandardMaterial;
  switch (surface) {
    case 'bark':
      material = createPbrMaterial(
        `${source.name || objectName}:bark-pbr`,
        createFilePbrSet('bark'),
        { color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.16).getHex(), roughness: 0.88, metalness: 0.0, envMapIntensity: 0.54, normalScale: 0.88 },
      );
      break;
    case 'foliage':
      material = createPbrMaterial(
        `${source.name || objectName}:foliage-pbr`,
        createFilePbrSet('foliage'),
        { color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.5).getHex(), roughness: 0.78, metalness: 0.0, envMapIntensity: 0.62, normalScale: 0.34 },
      );
      break;
    case 'grass':
      material = createPbrMaterial(
        `${source.name || objectName}:grass-pbr`,
        createFilePbrSet('grass'),
        { color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.34).getHex(), roughness: 0.86, metalness: 0.0, envMapIntensity: 0.46, normalScale: 0.44 },
      );
      break;
    case 'ground':
      material = createPbrMaterial(
        `${source.name || objectName}:ground-pbr`,
        createFilePbrSet('ground'),
        { color, roughness: 0.9, metalness: 0.0, envMapIntensity: 0.42, normalScale: 0.5 },
      );
      break;
    case 'wood':
      const sourceWoodColor = new THREE.Color(color);
      const sourceWoodLuminance = sourceWoodColor.r * 0.2126 + sourceWoodColor.g * 0.7152 + sourceWoodColor.b * 0.0722;
      const woodColor = isThirdPartyShelfWood
        ? sourceWoodColor.multiplyScalar(0.34).lerp(new THREE.Color(0x3a2419), 0.62).getHex()
        : isThirdPartyLibraryFurnitureWood
          ? sourceWoodColor
            .multiplyScalar(sourceWoodLuminance > 0.72 ? 0.42 : 0.68)
            .lerp(new THREE.Color(0x56321f), sourceWoodLuminance > 0.72 ? 0.74 : 0.48)
            .getHex()
          : color;
      material = createPbrMaterial(
        `${source.name || objectName}:wood-pbr`,
        createFilePbrSet('wood'),
        {
          color: woodColor,
          roughness: isThirdPartyShelfWood ? 0.88 : isThirdPartyLibraryFurnitureWood ? 0.78 : 0.62,
          metalness: isThirdPartyShelfWood ? 0.01 : isThirdPartyLibraryFurnitureWood ? 0.02 : 0.03,
          envMapIntensity: isThirdPartyShelfWood ? 0.18 : isThirdPartyLibraryFurnitureWood ? 0.32 : 0.82,
          normalScale: isThirdPartyShelfWood ? 0.34 : isThirdPartyLibraryFurnitureWood ? 0.38 : 0.52,
        },
      );
      break;
    case 'metal':
      material = createPbrMaterial(
        `${source.name || objectName}:aged-metal-pbr`,
        createFilePbrSet('metal'),
        { color, roughness: Math.min(source.roughness, 0.38), metalness: Math.max(source.metalness, 0.58), envMapIntensity: 1.45, normalScale: 0.28 },
      );
      break;
    case 'organic':
      material = createPbrMaterial(
        `${source.name || objectName}:organic-pbr`,
        createFilePbrSet('organic'),
        { color, roughness: 0.88, metalness: 0.0, envMapIntensity: 0.38, normalScale: 0.42 },
      );
      break;
    case 'crystal':
      material = createPbrMaterial(
        `${source.name || objectName}:crystal-pbr`,
        createFilePbrSet('crystal'),
        { color, roughness: 0.12, metalness: 0.0, envMapIntensity: 1.8, normalScale: 0.18 },
      );
      material.transparent = source.transparent || true;
      material.opacity = Math.min(source.opacity, 0.82);
      break;
    case 'stone':
    default:
      material = createPbrMaterial(
        `${source.name || objectName}:stone-pbr`,
        createFilePbrSet('stone'),
        { color, roughness: Math.max(source.roughness, 0.66), metalness: Math.min(source.metalness, 0.08), envMapIntensity: 0.9, normalScale: 0.62 },
      );
      break;
  }

  if (lightmap && surface !== 'crystal') {
    material.lightMap = lightmap;
    material.lightMapIntensity = surface === 'metal'
      ? 0.45
      : surface === 'foliage' || surface === 'grass'
        ? 0.44
        : surface === 'bark' || surface === 'ground'
          ? 0.62
          : 0.72;
  }
  material.emissive.copy(source.emissive);
  material.emissiveIntensity = source.emissiveIntensity;
  material.transparent = source.transparent || material.transparent;
  material.opacity = source.transparent ? source.opacity : material.opacity;
  material.side = source.side;
  material.alphaTest = source.alphaTest;
  material.depthWrite = source.depthWrite;
  if (surface === 'foliage' || surface === 'grass') {
    material.transparent = false;
    material.opacity = 1;
    material.side = THREE.DoubleSide;
    material.alphaTest = Math.max(material.alphaTest, surface === 'foliage' ? 0.22 : 0.18);
    material.depthWrite = true;
  }
  material.needsUpdate = true;
  enhancedMaterialCache.set(cacheKey, material);
  return material;
}

function scheduleAuthoredWorldMaterialEnhancement(root: THREE.Object3D, lightmapUrl?: string): () => void {
  const meshes: THREE.Mesh[] = [];
  const lightmap = lightmapUrl ? getWorldLightmap(lightmapUrl) : undefined;
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) {
      meshes.push(object);
    }
  });

  let index = 0;
  let cancelled = false;
  let timer = 0;
  const batchSize = 8;

  const processBatch = (): void => {
    if (cancelled) return;
    const limit = Math.min(meshes.length, index + batchSize);
    while (index < limit) {
      const mesh = meshes[index];
      const sourceMaterial = mesh.material;
      if (!(sourceMaterial instanceof THREE.MeshStandardMaterial)) {
        index += 1;
        continue;
      }
      ensureAoUv(mesh.geometry);
      mesh.material = enhanceAuthoredWorldMaterial(sourceMaterial, mesh.name, lightmap, lightmapUrl);
      index += 1;
    }
    if (index < meshes.length) {
      timer = window.setTimeout(processBatch, 48);
    }
  };

  timer = window.setTimeout(processBatch, 250);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}

function getWorldLightmap(url: string): THREE.Texture {
  const cached = lightmapCache.get(url);
  if (cached) return cached;
  const texture = worldTextureLoader.load(url);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  if (texture.image) texture.needsUpdate = true;
  lightmapCache.set(url, texture);
  return texture;
}

type AuthoredSurface = 'stone' | 'wood' | 'metal' | 'organic' | 'crystal' | 'ground' | 'bark' | 'foliage' | 'grass';

function classifyWorldSurface(label: string): AuthoredSurface {
  const value = label.toLowerCase();
  if (/(bark|trunk|secondary_branch|fine_fork_branch|branch|root_flare|gnarled_root|twig|splinter)/.test(value)) return 'bark';
  if (/(leaf|leaves|canopy|foliage|frond|greenhouse_broad|individual_greenhouse_leaf|fallen_leaf_litter)/.test(value)) return 'foliage';
  if (/(grass|reed|blade|weed)/.test(value)) return 'grass';
  if (/(moss|mud|soil|ground_patch|organic_litter)/.test(value)) return 'ground';
  if (/(parchment|paper|scroll|wax|fabric|carpet|rug|curtain|cloth|thread|banner|tapestry)/.test(value)) return 'organic';
  if (/(wood|oak|walnut|shelf|book|table|bench|dock|plank|platform|barrel|cart|wheel|signpost|sign|booth|stall|rack|planter|counter)/.test(value)) return 'wood';
  if (/(brass|gold|metal|iron|silver|lamp|lantern|weapon|sword|chandelier|ring|trim|band|chain|dish)/.test(value)) return 'metal';
  if (/(tree|fern|plant|litter|root|vine)/.test(value)) return 'organic';
  if (/(crystal|glass|water|wet|puddle|mineral|sheen|glow|flame|portal|rune|arcane|emissive)/.test(value)) return 'crystal';
  return 'stone';
}

function ensureAoUv(geometry: THREE.BufferGeometry): void {
  const uv = geometry.getAttribute('uv');
  if (!uv || geometry.getAttribute('uv2')) return;
  geometry.setAttribute('uv2', uv);
}

function isInteriorCutawaySurface(name: string): boolean {
  return name.includes('south_authored_wall')
    || name.includes('east_authored_wall')
    || name.includes('dark_oak_ceiling_crossbeam')
    || name.includes('dark_ceiling_beam')
    || name.includes('ceiling_shadow_occlusion_panel')
    || name.includes('ceiling_baked_shadow')
    || name.includes('vaulted_ceiling_soft_occlusion')
    || name.includes('upper_vault_stone_rib_crosswise')
    || name.includes('upper_vault')
    || name.includes('vault_rib_left_impost_block')
    || name.includes('vault_rib_right_impost_block')
    || name.includes('wall_brass_relief_plaque_south')
    || name.includes('faded_fabric_wall_hanging_south')
    || name.includes('south_crown_trim')
    || name.includes('south_base_trim')
    || name.includes('cavern_backplate_shadow');
}

function getCutawayLabel(object: THREE.Mesh): string {
  const materialNames = Array.isArray(object.material)
    ? object.material.map((material) => material.name).join(' ')
    : object.material.name;
  return `${object.name} ${object.geometry.name} ${materialNames}`.toLowerCase();
}

function isNatureChunkReplacedSurface(chunkId: WorldChunkId, label: string): boolean {
  const replacedFloor = /authored_floor_slab|stone_wear_chip|individual_settled_beveled_floor_tile|chipped_floor_tile|deepened_tile_gap|chipped_tile_exposed|settled_dust|hairline_floor_crack|loose_brass|pinpoint_worn_brass|soft_contact_ao/.test(label);
  if (chunkId === 'moonlit-lawn') {
    return replacedFloor
      || /fountain_outer_basin|fountain_water_disc|weathered_stepping_stone/.test(label);
  }
  if (chunkId === 'lake-grotto') {
    return replacedFloor
      || /reflective_moon_lake_surface|nearfield_wet_rock_pooled_sheen|lake_grotto_submerged_silt_bed|lake_grotto_shallow_mineral_water_shelf|lake_grotto_deep_irregular_water_pool/.test(label);
  }
  return false;
}

function applyChunkCutaway(root: THREE.Object3D, chunk: WorldChunkDefinition): void {
  if (chunk.id === 'moonlit-lawn' || chunk.id === 'lake-grotto') {
    let suppressed = 0;
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (isNatureChunkReplacedSurface(chunk.id, getCutawayLabel(object))) {
        object.visible = false;
        suppressed += 1;
      }
    });
    window.__r3fChunkRenderState = {
      ...(window.__r3fChunkRenderState ?? {}),
      [`natureReplaced:${chunk.id}`]: String(suppressed),
    };
  }

  if (chunk.id === 'crystal-greenhouse') {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (getCutawayLabel(object).includes('greenhouse_glass_roof')) {
        object.visible = false;
      }
    });
    return;
  }

  if (chunk.region === 'exterior' || chunk.region === 'combat') return;

  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    box.setFromObject(object);
    const sizeX = box.max.x - box.min.x;
    const sizeY = box.max.y - box.min.y;
    const sizeZ = box.max.z - box.min.z;
    const nearCameraWall = box.max.z > chunk.bounds.maxZ - 0.55
      && sizeX > 2.4
      && sizeY > 1.4;
    const overheadCutaway = box.min.y > 2.35 && (sizeX > 1.2 || sizeZ > 1.2);
    if (nearCameraWall || overheadCutaway || isInteriorCutawaySurface(getCutawayLabel(object))) {
      object.visible = false;
    }
  });
}

function shouldProbeAuthoredChunks(): boolean {
  return new URLSearchParams(window.location.search).get('authoredChunks') !== '0';
}

function shouldRenderLegacyPrefabPack(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('legacyPrefabs') === '1' || params.get('authoredChunks') === '0';
}

function shouldUseMaterialQaShot(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('shot') === 'materials' || params.get('qaShot') === 'materials';
}

function shouldUseBiomeQaShot(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('qaFocus') === 'biome' || params.get('shot') === 'biome' || params.get('qaShot') === 'biome';
}

function shouldUseLibraryQaShot(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('qaFocus') === 'library' || params.get('shot') === 'library' || params.get('qaShot') === 'library';
}

function shouldDisablePostprocessing(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('qaNoPost') === '1' || params.get('postprocessing') === '0';
}

function createScatterPoints(bounds: Bounds2D, count: number, seed: string): readonly {
  readonly x: number;
  readonly z: number;
  readonly scale: number;
  readonly rotation: number;
  readonly tilt: number;
}[] {
  return Array.from({ length: count }, (_, index) => {
    const u = seeded(seed, index);
    const v = seeded(seed, index + 1000);
    return {
      x: bounds.minX + u * (bounds.maxX - bounds.minX),
      z: bounds.minZ + v * (bounds.maxZ - bounds.minZ),
      scale: 0.7 + seeded(seed, index + 2000) * 0.75,
      rotation: seeded(seed, index + 3000) * Math.PI * 2,
      tilt: (seeded(seed, index + 4000) - 0.5) * 0.35,
    };
  });
}

function findNearbyNpc(position: THREE.Vector3): R3FNpc | null {
  let best: R3FNpc | null = null;
  let bestDistance = 1.85;
  for (const npc of NPC_SCENE_DEFINITIONS) {
    const dx = npc.position[0] - position.x;
    const dz = npc.position[2] - position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < bestDistance) {
      best = npc;
      bestDistance = distance;
    }
  }
  return best;
}

function isNpcInActiveChunk(npc: R3FNpc, activeIds: ReadonlySet<WorldChunkId>): boolean {
  const matchingChunk = WORLD_CHUNKS.find((chunk) => (
    npc.position[0] >= chunk.bounds.minX
    && npc.position[0] <= chunk.bounds.maxX
    && npc.position[2] >= chunk.bounds.minZ
    && npc.position[2] <= chunk.bounds.maxZ
  ));
  return matchingChunk ? activeIds.has(matchingChunk.id) : true;
}

function seeded(seed: string, n: number): number {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  h = Math.imul(h ^ n, 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^= h >>> 16) >>> 0) / 4294967295;
}
