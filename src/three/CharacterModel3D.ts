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

type ThreeVRMModule = typeof import('@pixiv/three-vrm');

export class CharacterModel3D {
  readonly root = new THREE.Group();
  private readonly fallback: ProceduralCharacterRig;
  private readonly lookTarget = new THREE.Object3D();
  private readonly animationState = new CharacterAnimationStateMachine();
  private vrmModule?: ThreeVRMModule;
  private vrm?: VRM;
  private bones: BoneSet = {};
  private gltfMixer?: THREE.AnimationMixer;
  private readonly gltfActions = new Map<string, THREE.AnimationAction>();
  private activeGLTFAction?: THREE.AnimationAction;
  private buildPlan: CharacterBuildPlan;
  private moving = false;
  private blinkTimer = 0;
  private blinkDuration = 0;
  private assetState: CharacterAssetState = 'loading';

  constructor(private readonly spec: CharacterSpec) {
    this.buildPlan = createCharacterBuildPlan(spec);
    this.root.userData.characterId = spec.id;
    this.root.userData.characterDisplayName = spec.displayName;
    this.root.userData.characterBuildPlan = this.buildPlan;
    this.root.userData.characterAssetState = this.assetState;
    this.fallback = new ProceduralCharacterRig(spec.id);
    this.root.add(this.fallback.root);
    void this.loadModel();
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
      this.updateGLTFAnimation(delta);
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

    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentType = response.headers.get('content-type') ?? '';
      if (response.ok && !contentType.includes('text/html')) return url;
    } catch {
      // Missing optional assets should silently fall back to the authored rig.
    }
    return undefined;
  }

  private installVRM(vrm: VRM, vrmModule: ThreeVRMModule): void {
    this.vrm = vrm;
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

    if (animations.length > 0) {
      this.gltfMixer = new THREE.AnimationMixer(scene);
      this.gltfActions.clear();
      for (const clip of animations) {
        const action = this.gltfMixer.clipAction(clip);
        action.enabled = true;
        this.gltfActions.set(clip.name.toLowerCase(), action);
      }
      this.playGLTFAction('idle', 0);
    }
  }

  private updateGLTFAnimation(delta: number): void {
    this.playGLTFAction(this.moving ? 'walk' : 'idle', 0.22);
    this.gltfMixer?.update(delta);
  }

  private playGLTFAction(name: string, fadeDuration: number): void {
    const next = this.gltfActions.get(name) ?? this.gltfActions.get('idle');
    if (!next || next === this.activeGLTFAction) return;

    next.reset().play();
    if (this.activeGLTFAction && fadeDuration > 0) {
      this.activeGLTFAction.crossFadeTo(next, fadeDuration, false);
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
