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
  dictionary: Record<string, number>;
  influences: number[];
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
}

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

type ThreeVRMModule = typeof import('@pixiv/three-vrm');

export class CharacterModel3D {
  private static readonly maxConcurrentAssetLoads = 2;
  private static readonly pendingAssetLoads: AssetLoadQueueEntry[] = [];
  private static readonly assetUrlAvailability = new Map<string, Promise<boolean>>();
  private static activeAssetLoads = 0;
  private static assetLoadSequence = 0;

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
  private buildPlan: CharacterBuildPlan;
  private moving = false;
  private blinkTimer = 0;
  private blinkDuration = 0;
  private gltfLookYaw = 0;
  private gltfLookPitch = 0;
  private assetState: CharacterAssetState = 'loading';

  constructor(private readonly spec: CharacterSpec) {
    this.buildPlan = createCharacterBuildPlan(spec);
    this.root.userData.characterId = spec.id;
    this.root.userData.characterDisplayName = spec.displayName;
    this.root.userData.characterBuildPlan = this.buildPlan;
    this.root.userData.characterAssetState = this.assetState;
    this.fallback = new ProceduralCharacterRig(spec.id);
    this.root.add(this.fallback.root);
    void CharacterModel3D.enqueueAssetLoad(
      () => this.loadModel(),
      this.getAssetLoadPriority(),
    ).catch((error) => {
      this.setAssetState('failed');
      this.fallback.root.visible = true;
      console.warn(`Failed to schedule ${this.spec.id} character asset`, error);
    });
  }

  setMoving(moving: boolean): void {
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
      void entry.task()
        .then(entry.resolve, entry.reject)
        .finally(() => {
          CharacterModel3D.activeAssetLoads -= 1;
          CharacterModel3D.drainAssetLoadQueue();
        });
    }
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

    this.fallback.root.visible = false;
    this.prepareModelRoot(vrm.scene, this.spec.body.heightMeters);
    vrm.scene.rotation.y = Math.PI;
    this.root.add(vrm.scene);
    this.bones = this.collectBones(vrm, vrmModule);
    this.setVRMShadows(vrm.scene);
    if (vrm.lookAt) {
      vrm.lookAt.target = this.lookTarget;
      vrm.lookAt.autoUpdate = true;
    }
  }

  private installGLTF(scene: THREE.Group, animations: THREE.AnimationClip[]): void {
    this.setAssetState('gltf');
    this.fallback.root.visible = false;
    this.prepareModelRoot(scene, this.spec.body.heightMeters);
    scene.rotation.y = Math.PI;
    this.root.add(scene);
    this.setVRMShadows(scene);
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
  }

  private updateGLTFAnimation(elapsedTime: number, delta: number, lookAtWorldPosition?: THREE.Vector3): void {
    this.playGLTFAction(this.moving ? 'walk' : 'idle', 0.22);
    this.restoreGLTFBoneBasePoses();
    this.gltfMixer?.update(delta);
    this.applyGLTFPoseOverlay(elapsedTime);
    this.applyGLTFLookAt(lookAtWorldPosition, elapsedTime, delta);
    this.applyGLTFEyeFocus();
    this.applyGLTFSecondaryMotion(elapsedTime);
    this.applyGLTFMorphExpressions(elapsedTime, delta);
  }

  private playGLTFAction(name: string, fadeDuration: number): void {
    const next = this.gltfActions.get(name) ?? this.gltfActions.get('idle');
    if (!next || next === this.activeGLTFAction) return;

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
      bindings.push({
        mesh: object,
        dictionary: object.morphTargetDictionary,
        influences: object.morphTargetInfluences,
      });
    });
    return bindings;
  }

  private collectSecondaryMotionObjects(model: THREE.Object3D): GLTFSecondaryMotionBinding[] {
    const bindings: GLTFSecondaryMotionBinding[] = [];
    model.traverse((object) => {
      if (!this.isSecondaryMotionBone(object)) return;
      const profile = this.getSecondaryMotionProfile(object.name);
      if (!profile) return;
      bindings.push({
        object,
        basePosition: object.position.clone(),
        baseRotation: object.rotation.clone(),
        phase: bindings.length * 0.73 + object.name.length * 0.11,
        ...profile,
      });
    });
    if (bindings.length > 0) return bindings;

    model.traverse((object) => {
      const profile = this.getSecondaryMotionProfile(object.name);
      if (!profile) return;
      if (!this.hasCenteredRuntimePivot(object)) return;
      bindings.push({
        object,
        basePosition: object.position.clone(),
        baseRotation: object.rotation.clone(),
        phase: bindings.length * 0.73 + object.name.length * 0.11,
        ...profile,
      });
    });
    return bindings;
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

  private getSecondaryMotionProfile(name: string): Omit<GLTFSecondaryMotionBinding, keyof GLTFTransformBase | 'phase'> | undefined {
    const normalized = name.replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (!normalized) return undefined;
    if (/(hair|bang|lock|braid|ponytail|cowlick)/.test(normalized)) {
      const isLong = /(long|back|outer|tip|tail)/.test(normalized);
      return {
        sway: isLong ? 0.052 : 0.034,
        bob: isLong ? 0.014 : 0.008,
        twist: isLong ? 0.024 : 0.014,
      };
    }
    if (/(cape|capelet|skirt|ruffle|sash|ribbon|tail)/.test(normalized)) {
      return { sway: 0.038, bob: 0.01, twist: 0.018 };
    }
    if (/(sleeve|tie|strap)/.test(normalized)) {
      return { sway: 0.018, bob: 0.004, twist: 0.008 };
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

    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    // Older generated panels had absolute vertices around the character body. Skip
    // those so secondary motion only runs on assets with usable local pivots.
    return center.length() < 0.18;
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
      this.poseLyraIdle(breathe, soft, talkBlend);
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

  private poseLyraIdle(breathe: number, soft: number, talkBlend: number): void {
    if (this.bones.leftUpperArm) this.bones.leftUpperArm.rotation.set(-0.28 + breathe * 0.015, -0.16, -0.72 + soft * 0.012);
    if (this.bones.leftLowerArm) this.bones.leftLowerArm.rotation.set(-1.05 + breathe * 0.014, 0, 0.46);
    if (this.bones.rightUpperArm) this.bones.rightUpperArm.rotation.set(-0.34 - breathe * 0.012, 0.16, 0.72 - soft * 0.012);
    if (this.bones.rightLowerArm) this.bones.rightLowerArm.rotation.set(-1.08 - breathe * 0.014, 0, -0.42);
    if (this.bones.leftUpperLeg) this.bones.leftUpperLeg.rotation.x = -0.035 + breathe * 0.006;
    if (this.bones.rightUpperLeg) this.bones.rightUpperLeg.rotation.x = 0.03 - breathe * 0.006;
    if (this.bones.head) this.bones.head.rotation.y += Math.sin(performance.now() * 0.009) * 0.035 * talkBlend;
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
      const headWorld = new THREE.Vector3();
      const targetLocal = lookAtWorldPosition.clone();
      const headLocal = headWorld;
      this.bones.head.getWorldPosition(headWorld);
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

  private applyGLTFSecondaryMotion(elapsedTime: number): void {
    if (this.gltfSecondaryBindings.length === 0) return;

    const movement = this.moving ? 1 : 0;
    const idle = 1 - movement;
    for (const binding of this.gltfSecondaryBindings) {
      const stride = Math.sin(elapsedTime * 8.2 + binding.phase);
      const settle = Math.sin(elapsedTime * 1.55 + binding.phase);
      const flutter = Math.sin(elapsedTime * 2.35 + binding.phase * 0.7);
      const moveScale = 0.45 + movement * 0.95;

      binding.object.position.copy(binding.basePosition);
      binding.object.rotation.copy(binding.baseRotation);
      binding.object.rotation.x += binding.bob * (Math.abs(stride) * movement + settle * 0.45 * idle);
      binding.object.rotation.y += binding.twist * (stride * movement + flutter * 0.35 * idle);
      binding.object.rotation.z += binding.sway * moveScale * (stride * movement + settle * 0.55 * idle);
      binding.object.position.y += binding.bob * 0.012 * flutter * idle;
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

    const baseSmile = this.spec.id === 'player' ? 0.035 : this.spec.id === 'lyra' ? 0.18 : 0.08;
    const smile = baseSmile + Math.sin(elapsedTime * 1.15) * (this.spec.id === 'lyra' ? 0.035 : 0.018);

    for (const binding of this.gltfMorphBindings) {
      for (const [name, index] of Object.entries(binding.dictionary)) {
        const normalized = name.toLowerCase();
        if (normalized.includes('blink')) {
          binding.influences[index] = blink;
        } else if (normalized.includes('smile') || normalized.includes('warm')) {
          binding.influences[index] = Math.max(0, smile);
        } else if (normalized.includes('concerned') || normalized.includes('surprised')) {
          binding.influences[index] = 0;
        }
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
        object.castShadow = true;
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
}
