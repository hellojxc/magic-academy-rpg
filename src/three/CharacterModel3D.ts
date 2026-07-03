import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { VRM } from '@pixiv/three-vrm';
import { CharacterRig3D, type CharacterKind } from './CharacterRig3D';

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

interface CharacterModelManifestEntry {
  enabled?: boolean;
  url?: string;
}

type CharacterModelManifest = Partial<Record<CharacterKind, CharacterModelManifestEntry>>;
type CharacterAssetState = 'loading' | 'vrm' | 'gltf' | 'rig' | 'failed';
type ThreeVRMModule = typeof import('@pixiv/three-vrm');

export class CharacterModel3D {
  readonly root = new THREE.Group();
  private readonly fallback: CharacterRig3D;
  private readonly lookTarget = new THREE.Object3D();
  private vrmModule?: ThreeVRMModule;
  private vrm?: VRM;
  private bones: BoneSet = {};
  private moving = false;
  private movementBlend = 0;
  private blinkTimer = 0;
  private blinkDuration = 0;
  private assetState: CharacterAssetState = 'loading';

  constructor(private readonly kind: CharacterKind) {
    this.root.userData.characterKind = kind;
    this.root.userData.characterAssetState = this.assetState;
    this.fallback = new CharacterRig3D(kind);
    this.root.add(this.fallback.root);
    void this.loadModel();
  }

  setMoving(moving: boolean): void {
    this.moving = moving;
    this.fallback.setMoving(moving);
  }

  getModelState(): CharacterAssetState {
    return this.assetState;
  }

  update(elapsedTime: number, delta: number, lookAtWorldPosition?: THREE.Vector3): void {
    if (!this.vrm) {
      this.fallback.update(elapsedTime);
      return;
    }

    this.movementBlend = THREE.MathUtils.lerp(this.movementBlend, this.moving ? 1 : 0, 0.14);
    this.updateLookTarget(lookAtWorldPosition, elapsedTime);
    this.applyHumanoidPose(elapsedTime);
    this.applyExpressions(elapsedTime, delta);
    this.vrm.update(delta);
  }

  private async loadModel(): Promise<void> {
    const url = await this.findModelUrl();
    if (!url) {
      this.setAssetState('rig');
      return;
    }

    try {
      const vrmModule = await this.loadVRMModule();
      const loader = CharacterModel3D.createLoader(vrmModule);
      const gltf = await loader.loadAsync(url);
      const vrm = gltf.userData.vrm as VRM | undefined;
      if (vrm) {
        this.installVRM(vrm, vrmModule);
      } else {
        this.installGLTF(gltf.scene);
      }
    } catch (error) {
      this.setAssetState('failed');
      console.warn(`Failed to load ${this.kind} character asset`, error);
    }
  }

  private async loadVRMModule(): Promise<ThreeVRMModule> {
    if (!this.vrmModule) this.vrmModule = await import('@pixiv/three-vrm');
    return this.vrmModule;
  }

  private async findModelUrl(): Promise<string | undefined> {
    const manifest = await this.loadManifest();
    const entry = manifest?.[this.kind];
    if (!entry?.enabled || !entry.url) return undefined;

    const url = entry.url.startsWith('/') ? entry.url : `/assets/models/${entry.url}`;
    if (!/\.(vrm|glb|gltf)$/i.test(url)) {
      console.warn(`Ignoring unsupported ${this.kind} character asset: ${url}`);
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

  private async loadManifest(): Promise<CharacterModelManifest | undefined> {
    try {
      const response = await fetch('/assets/models/character-models.json', { cache: 'no-cache' });
      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok || contentType.includes('text/html')) return undefined;
      return await response.json() as CharacterModelManifest;
    } catch {
      return undefined;
    }
  }

  private installVRM(vrm: VRM, vrmModule: ThreeVRMModule): void {
    this.vrm = vrm;
    this.setAssetState('vrm');
    vrmModule.VRMUtils.rotateVRM0(vrm);
    vrmModule.VRMUtils.combineSkeletons(vrm.scene);
    vrmModule.VRMUtils.combineMorphs(vrm);

    this.fallback.root.visible = false;
    this.prepareModelRoot(vrm.scene, this.kind === 'lyra' ? 1.92 : 1.98);
    vrm.scene.rotation.y = Math.PI;
    this.root.add(vrm.scene);
    this.bones = this.collectBones(vrm, vrmModule);
    this.setVRMShadows(vrm.scene);
    if (vrm.lookAt) {
      vrm.lookAt.target = this.lookTarget;
      vrm.lookAt.autoUpdate = true;
    }
  }

  private installGLTF(scene: THREE.Group): void {
    this.setAssetState('gltf');
    this.fallback.root.visible = false;
    this.prepareModelRoot(scene, this.kind === 'lyra' ? 1.92 : 1.98);
    scene.rotation.y = Math.PI;
    this.root.add(scene);
    this.setVRMShadows(scene);
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

  private applyHumanoidPose(elapsedTime: number): void {
    if (!this.vrm) return;

    const walk = Math.sin(elapsedTime * 8.2);
    const opposite = Math.sin(elapsedTime * 8.2 + Math.PI);
    const bounce = Math.abs(Math.cos(elapsedTime * 8.2));
    const breathe = Math.sin(elapsedTime * 2.1);
    const soft = Math.sin(elapsedTime * 1.1);
    const blend = this.movementBlend;
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

    if (this.kind === 'player') {
      this.poseWalk(walk, opposite, blend);
    } else {
      this.poseLyraIdle(breathe, soft);
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

  private poseLyraIdle(breathe: number, soft: number): void {
    if (this.bones.leftUpperArm) this.bones.leftUpperArm.rotation.set(-0.28 + breathe * 0.015, -0.16, -0.72 + soft * 0.012);
    if (this.bones.leftLowerArm) this.bones.leftLowerArm.rotation.set(-1.05 + breathe * 0.014, 0, 0.46);
    if (this.bones.rightUpperArm) this.bones.rightUpperArm.rotation.set(-0.34 - breathe * 0.012, 0.16, 0.72 - soft * 0.012);
    if (this.bones.rightLowerArm) this.bones.rightLowerArm.rotation.set(-1.08 - breathe * 0.014, 0, -0.42);
    if (this.bones.leftUpperLeg) this.bones.leftUpperLeg.rotation.x = -0.035 + breathe * 0.006;
    if (this.bones.rightUpperLeg) this.bones.rightUpperLeg.rotation.x = 0.03 - breathe * 0.006;
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

    const mood = this.kind === 'lyra' ? 0.28 + Math.sin(elapsedTime * 1.1) * 0.04 : 0.12;
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
  }

  private static createLoader(vrmModule: ThreeVRMModule): GLTFLoader {
    const loader = new GLTFLoader();
    loader.register((parser) => new vrmModule.VRMLoaderPlugin(parser));
    return loader;
  }
}
