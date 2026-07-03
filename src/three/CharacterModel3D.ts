import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  VRM,
  VRMExpressionPresetName,
  VRMHumanBoneName,
  VRMLoaderPlugin,
  VRMUtils,
} from '@pixiv/three-vrm';
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

type CharacterAssetState = 'loading' | 'vrm' | 'gltf' | 'fallback' | 'failed';

export class CharacterModel3D {
  readonly root = new THREE.Group();
  private readonly fallback: CharacterRig3D;
  private readonly loader = CharacterModel3D.createLoader();
  private readonly lookTarget = new THREE.Object3D();
  private vrm?: VRM;
  private bones: BoneSet = {};
  private moving = false;
  private movementBlend = 0;
  private blinkTimer = 0;
  private blinkDuration = 0;
  private readonly propRoot = new THREE.Group();
  private assetState: CharacterAssetState = 'loading';

  constructor(private readonly kind: CharacterKind) {
    this.root.userData.characterKind = kind;
    this.root.userData.characterAssetState = this.assetState;
    this.fallback = new CharacterRig3D(kind);
    this.root.add(this.fallback.root);
    this.root.add(this.propRoot);
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
    this.updateLookTarget(lookAtWorldPosition);
    this.applyHumanoidPose(elapsedTime);
    this.applyExpressions(elapsedTime, delta);
    this.animateProps(elapsedTime);
    this.vrm.update(delta);
  }

  private async loadModel(): Promise<void> {
    const url = await this.findModelUrl();
    if (!url) {
      this.setAssetState('fallback');
      return;
    }

    try {
      const gltf = await this.loader.loadAsync(url);
      const vrm = gltf.userData.vrm as VRM | undefined;
      if (vrm) {
        this.installVRM(vrm);
      } else {
        this.installGLTF(gltf.scene);
      }
    } catch (error) {
      this.setAssetState('failed');
      console.warn(`Failed to load ${this.kind} character asset`, error);
    }
  }

  private async findModelUrl(): Promise<string | undefined> {
    const candidates = this.kind === 'lyra'
      ? ['/assets/models/lyra.vrm', '/assets/models/lyra.glb']
      : ['/assets/models/player.vrm', '/assets/models/player.glb'];

    for (const url of candidates) {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        const contentType = response.headers.get('content-type') ?? '';
        if (response.ok && !contentType.includes('text/html')) return url;
      } catch {
        // Missing optional assets should silently fall back to the procedural rig.
      }
    }
    return undefined;
  }

  private installVRM(vrm: VRM): void {
    this.vrm = vrm;
    this.setAssetState('vrm');
    VRMUtils.rotateVRM0(vrm);
    VRMUtils.combineSkeletons(vrm.scene);
    VRMUtils.combineMorphs(vrm);

    this.fallback.root.visible = false;
    this.prepareModelRoot(vrm.scene, this.kind === 'lyra' ? 1.92 : 1.98);
    vrm.scene.rotation.y = Math.PI;
    this.root.add(vrm.scene);
    this.bones = this.collectBones(vrm);
    this.setVRMShadows(vrm.scene);
    if (vrm.lookAt) {
      vrm.lookAt.target = this.lookTarget;
      vrm.lookAt.autoUpdate = true;
    }
    this.addCharacterProps();
  }

  private installGLTF(scene: THREE.Group): void {
    this.setAssetState('gltf');
    this.fallback.root.visible = false;
    this.prepareModelRoot(scene, this.kind === 'lyra' ? 1.92 : 1.98);
    scene.rotation.y = Math.PI;
    this.root.add(scene);
    this.setVRMShadows(scene);
    this.addCharacterProps();
  }

  private prepareModelRoot(model: THREE.Object3D, targetHeight: number): void {
    const box = new THREE.Box3().setFromObject(model);
    const height = Math.max(0.001, box.max.y - box.min.y);
    const scale = targetHeight / height;
    model.scale.multiplyScalar(scale);

    const scaledBox = new THREE.Box3().setFromObject(model);
    model.position.y -= scaledBox.min.y;
  }

  private collectBones(vrm: VRM): BoneSet {
    const humanoid = vrm.humanoid;
    return {
      hips: humanoid.getNormalizedBoneNode(VRMHumanBoneName.Hips) ?? undefined,
      spine: humanoid.getNormalizedBoneNode(VRMHumanBoneName.Spine) ?? undefined,
      chest: humanoid.getNormalizedBoneNode(VRMHumanBoneName.Chest) ?? undefined,
      head: humanoid.getNormalizedBoneNode(VRMHumanBoneName.Head) ?? undefined,
      leftUpperArm: humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm) ?? undefined,
      leftLowerArm: humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftLowerArm) ?? undefined,
      rightUpperArm: humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm) ?? undefined,
      rightLowerArm: humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightLowerArm) ?? undefined,
      leftUpperLeg: humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperLeg) ?? undefined,
      leftLowerLeg: humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftLowerLeg) ?? undefined,
      leftFoot: humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftFoot) ?? undefined,
      rightUpperLeg: humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperLeg) ?? undefined,
      rightLowerLeg: humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightLowerLeg) ?? undefined,
      rightFoot: humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightFoot) ?? undefined,
    };
  }

  private updateLookTarget(lookAtWorldPosition?: THREE.Vector3): void {
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
      this.lookTarget.position.x += Math.sin(performance.now() * 0.00035) * 0.42;
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
      manager.setValue(VRMExpressionPresetName.Blink, Math.sin(phase * Math.PI));
    } else {
      manager.setValue(VRMExpressionPresetName.Blink, 0);
    }

    const mood = this.kind === 'lyra' ? 0.28 + Math.sin(elapsedTime * 1.1) * 0.04 : 0.12;
    manager.setValue(VRMExpressionPresetName.Happy, mood);
  }

  private animateProps(elapsedTime: number): void {
    this.propRoot.position.y = Math.sin(elapsedTime * 2.1) * 0.008;
    this.propRoot.rotation.z = Math.sin(elapsedTime * 1.4) * 0.01;
  }

  private addCharacterProps(): void {
    this.propRoot.clear();
    if (this.kind === 'lyra') {
      const book = new THREE.Group();
      book.position.set(0, 1.16, -0.24);
      book.rotation.x = -0.08;
      this.propRoot.add(book);
      const cover = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.5, 0.07),
        new THREE.MeshStandardMaterial({ color: 0x35212e, roughness: 0.58, metalness: 0.08 })
      );
      const pages = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.42, 0.022),
        new THREE.MeshStandardMaterial({ color: 0xf0dfb7, roughness: 0.72 })
      );
      pages.position.z = -0.05;
      book.add(cover, pages);
    }
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

  private static createLoader(): GLTFLoader {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    return loader;
  }
}
