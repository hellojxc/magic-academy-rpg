import * as THREE from 'three';
import type { Obstacle } from './WorldTypes';
import { addFlatPlane, addPointLight, makeGrassTexture } from './WorldHelpers';

/**
 * 草坪 — 中庭南面 (x:[-16,16], z:[7,22])
 * 开放草地、石径、花坛、树木、长椅、喷泉
 */
export class Lawn {
  private readonly animatedObjects: { obj: THREE.Object3D; baseY: number; amp: number; speed: number; phase: number }[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  build(): Obstacle[] {
    const obstacles: Obstacle[] = [];

    const grassTex = makeGrassTexture();
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4a8b3a, roughness: 0.85, metalness: 0.0, map: grassTex });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a8278, roughness: 0.6, metalness: 0.05 });
    const barkMat = new THREE.MeshStandardMaterial({ color: 0x5a3e28, roughness: 0.65, metalness: 0.05 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xc7a060, roughness: 0.24, metalness: 0.48 });

    // 草地
    addFlatPlane(this.scene, new THREE.Vector3(0, -0.02, 14.5), new THREE.Vector2(32, 15), grassMat);
    this.addGroundPatches();
    this.addGrassBlades();

    // 石径 — 从中庭南门到草坪
    for (let z = 7; z <= 22; z += 1.5) {
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.04, 16), stoneMat);
      stone.position.set(0, 0.01, z);
      stone.rotation.y = Math.random() * 0.3;
      stone.receiveShadow = true;
      this.scene.add(stone);
    }
    // 分支路径
    for (let x = -16; x <= -2; x += 1.5) {
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 16), stoneMat);
      stone.position.set(x, 0.01, 18);
      stone.receiveShadow = true;
      this.scene.add(stone);
    }
    for (let x = 2; x <= 16; x += 1.5) {
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 16), stoneMat);
      stone.position.set(x, 0.01, 18);
      stone.receiveShadow = true;
      this.scene.add(stone);
    }

    // 喷泉 — 草坪中央
    this.addFountain(0, 14.5, stoneMat, goldMat);

    // 花坛 — 四角
    const flowerColors = [0xd85f9e, 0xf1c45f, 0x7356d9, 0xd85f5f, 0xffd674];
    for (const [x, z] of [[-10, 10], [10, 10], [-10, 19], [10, 19]] as Array<[number, number]>) {
      this.addFlowerBed(x, z, flowerColors);
    }

    // 树木
    for (const [x, z, scale] of [
      [-14, 9, 1], [14, 9, 1.1], [-14, 20, 0.9], [14, 20, 1],
      [-7, 21, 0.85], [7, 21, 0.95], [-5, 8.5, 0.8], [5, 8.5, 0.85],
    ] as Array<[number, number, number]>) {
      this.addTree(x, z, scale, barkMat);
    }

    // 长椅
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x6d432b, roughness: 0.44, metalness: 0.08 });
    for (const [x, z, ry] of [[-6, 12, 0], [6, 12, 0], [-6, 17, 0], [6, 17, 0]] as Array<[number, number, number]>) {
      this.addBench(x, z, ry, benchMat);
    }

    // 萤火虫粒子
    this.addFireflies();

    // 路灯
    for (const [x, z] of [[-12, 7.5], [12, 7.5], [-12, 21.5], [12, 21.5]] as Array<[number, number]>) {
      this.addLampPost(x, z, goldMat);
    }

    // 障碍 — 树干和花坛边
    for (const [x, z] of [[-14, 9], [14, 9], [-14, 20], [14, 20], [-7, 21], [7, 21], [-5, 8.5], [5, 8.5]] as Array<[number, number]>) {
      obstacles.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    }
    for (const [x, z] of [[-10, 10], [10, 10], [-10, 19], [10, 19]] as Array<[number, number]>) {
      obstacles.push({ minX: x - 0.8, maxX: x + 0.8, minZ: z - 0.8, maxZ: z + 0.8 });
    }
    obstacles.push(
      { minX: -1.2, maxX: 1.2, minZ: 13.5, maxZ: 15.5 }, // 喷泉
    );

    return obstacles;
  }

  update(elapsedTime: number): void {
    for (const item of this.animatedObjects) {
      item.obj.position.y = item.baseY + Math.sin(elapsedTime * item.speed + item.phase) * item.amp;
      if (item.obj instanceof THREE.Group) {
        item.obj.rotation.y += 0.002;
      }
    }
  }

  private addFountain(x: number, z: number, stoneMat: THREE.Material, goldMat: THREE.Material): void {
    // 外圈
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.4, 32), stoneMat);
    base.position.set(x, 0.2, z);
    base.castShadow = true; base.receiveShadow = true;
    this.scene.add(base);

    // 水面
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 32),
      new THREE.MeshStandardMaterial({ color: 0x4a9ec9, transparent: true, opacity: 0.75, roughness: 0.1, metalness: 0.03 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(x, 0.38, z);
    this.scene.add(water);
    this.animatedObjects.push({ obj: water, baseY: 0.38, amp: 0.008, speed: 2, phase: 0 });

    // 中央柱
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.6, 16), stoneMat);
    pillar.position.set(x, 0.6, z);
    pillar.castShadow = true;
    this.scene.add(pillar);

    // 顶层碗
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.3, 0.15, 24), goldMat);
    bowl.position.set(x, 0.95, z);
    bowl.castShadow = true;
    this.scene.add(bowl);

    // 水柱
    const spout = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.08, 0.4, 12),
      new THREE.MeshStandardMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.5, roughness: 0.05 })
    );
    spout.position.set(x, 1.2, z);
    this.scene.add(spout);
    this.animatedObjects.push({ obj: spout, baseY: 1.2, amp: 0.04, speed: 4, phase: 0 });
    addPointLight(this.scene, x, 0.8, z, 0x6fc4ff, 0.6, 4);
  }

  private addGroundPatches(): void {
    const patchMats = [
      new THREE.MeshStandardMaterial({ color: 0x356f32, roughness: 0.92, metalness: 0.0 }),
      new THREE.MeshStandardMaterial({ color: 0x5a8d42, roughness: 0.9, metalness: 0.0 }),
      new THREE.MeshStandardMaterial({ color: 0x3d5f2f, roughness: 0.94, metalness: 0.0 }),
      new THREE.MeshStandardMaterial({ color: 0x6a583a, roughness: 0.96, metalness: 0.0 }),
    ];

    for (let i = 0; i < 58; i += 1) {
      const x = -15 + Math.random() * 30;
      const z = 7.3 + Math.random() * 14.4;
      if (this.isNearLawnFeature(x, z, 0.7)) continue;

      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(0.28 + Math.random() * 0.9, 9 + Math.floor(Math.random() * 5)),
        patchMats[i % patchMats.length]
      );
      patch.rotation.x = -Math.PI / 2;
      patch.rotation.z = Math.random() * Math.PI;
      patch.scale.set(1, 0.34 + Math.random() * 0.48, 1);
      patch.position.set(x, -0.012 + i * 0.00001, z);
      patch.receiveShadow = true;
      this.scene.add(patch);
    }

    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x2f6f2f, roughness: 0.9, metalness: 0.0 });
    for (let i = 0; i < 46; i += 1) {
      const alongMain = i % 2 === 0;
      const x = alongMain ? (Math.random() > 0.5 ? -0.78 : 0.78) + (Math.random() - 0.5) * 0.24 : -15 + Math.random() * 30;
      const z = alongMain ? 7 + Math.random() * 15 : 18 + (Math.random() > 0.5 ? -0.74 : 0.74) + (Math.random() - 0.5) * 0.22;
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.28 + Math.random() * 0.18, 5), edgeMat);
      tuft.position.set(x, 0.13, z);
      tuft.rotation.y = Math.random() * Math.PI;
      tuft.castShadow = true;
      tuft.receiveShadow = true;
      this.scene.add(tuft);
    }
  }

  private addGrassBlades(): void {
    const bladeGeometry = new THREE.ConeGeometry(0.026, 1, 4);
    const bladeMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x3e8a35, roughness: 0.88, metalness: 0.0 }),
      new THREE.MeshStandardMaterial({ color: 0x6fae54, roughness: 0.86, metalness: 0.0 }),
      new THREE.MeshStandardMaterial({ color: 0x2f6c2c, roughness: 0.9, metalness: 0.0 }),
    ];
    const dummy = new THREE.Object3D();

    for (let matIndex = 0; matIndex < bladeMaterials.length; matIndex += 1) {
      const count = 190;
      const mesh = new THREE.InstancedMesh(bladeGeometry, bladeMaterials[matIndex], count);

      for (let i = 0; i < count; i += 1) {
        let x = 0;
        let z = 0;
        for (let attempts = 0; attempts < 8; attempts += 1) {
          x = -15.6 + Math.random() * 31.2;
          z = 7.2 + Math.random() * 14.6;
          if (!this.isNearLawnFeature(x, z, 0.45)) break;
        }

        const height = 0.16 + Math.random() * 0.36;
        dummy.position.set(x, height / 2 - 0.01, z);
        dummy.rotation.set((Math.random() - 0.5) * 0.26, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.26);
        dummy.scale.set(0.75 + Math.random() * 0.7, height, 0.75 + Math.random() * 0.5);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }

      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
  }

  private isNearLawnFeature(x: number, z: number, margin: number): boolean {
    if (Math.abs(x) < 0.86 + margin && z > 6.7 && z < 22.3) return true;
    if (Math.abs(z - 18) < 0.68 + margin && Math.abs(x) > 1.6 && Math.abs(x) < 16.4) return true;
    if (Math.hypot(x, z - 14.5) < 1.7 + margin) return true;

    for (const [fx, fz] of [[-10, 10], [10, 10], [-10, 19], [10, 19]] as Array<[number, number]>) {
      if (Math.hypot(x - fx, z - fz) < 1.1 + margin) return true;
    }

    return false;
  }

  private addFlowerBed(x: number, z: number, colors: number[]): void {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a8278, roughness: 0.6 });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.75, 0.25, 20), stoneMat);
    ring.position.set(x, 0.12, z);
    ring.castShadow = true; ring.receiveShadow = true;
    this.scene.add(ring);

    // 土
    const dirt = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.04, 20), new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.8 }));
    dirt.position.set(x, 0.24, z);
    this.scene.add(dirt);

    // 花
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const r = Math.random() * 0.5;
      const fx = x + Math.cos(angle) * r;
      const fz = z + Math.sin(angle) * r;

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.15, 4), new THREE.MeshStandardMaterial({ color: 0x4a8b3a, roughness: 0.7 }));
      stem.position.set(fx, 0.33, fz);
      this.scene.add(stem);

      const flower = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 6),
        new THREE.MeshStandardMaterial({ color: colors[i % colors.length], emissive: colors[i % colors.length], emissiveIntensity: 0.08, roughness: 0.4 })
      );
      flower.position.set(fx, 0.42, fz);
      flower.castShadow = true;
      this.scene.add(flower);
    }
  }

  private addTree(x: number, z: number, scale: number, barkMat: THREE.Material): void {
    const group = new THREE.Group();

    // 树干
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.25 * scale, 2.2 * scale, 12), barkMat);
    trunk.position.y = 1.1 * scale;
    trunk.castShadow = true; trunk.receiveShadow = true;
    group.add(trunk);

    // 树冠 — 三层球
    const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x3d7a30, roughness: 0.75, metalness: 0.0 });
    const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x4f8b3e, roughness: 0.75, metalness: 0.0 });
    const leafMat3 = new THREE.MeshStandardMaterial({ color: 0x5a9b4a, roughness: 0.75, metalness: 0.0 });

    const c1 = new THREE.Mesh(new THREE.SphereGeometry(1.1 * scale, 16, 12), leafMat1);
    c1.position.y = 2.4 * scale; c1.castShadow = true; c1.receiveShadow = true;
    group.add(c1);

    const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.9 * scale, 16, 12), leafMat2);
    c2.position.set(0.3 * scale, 2.9 * scale, 0.2 * scale); c2.castShadow = true;
    group.add(c2);

    const c3 = new THREE.Mesh(new THREE.SphereGeometry(0.85 * scale, 16, 12), leafMat3);
    c3.position.set(-0.25 * scale, 3.1 * scale, -0.15 * scale); c3.castShadow = true;
    group.add(c3);

    group.position.set(x, 0, z);
    this.scene.add(group);
    this.animatedObjects.push({ obj: group, baseY: 0, amp: 0.015, speed: 0.8, phase: Math.random() * Math.PI * 2 });
  }

  private addBench(x: number, z: number, rotY: number, mat: THREE.Material): void {
    const group = new THREE.Group();

    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.4), mat);
    seat.position.y = 0.42; seat.castShadow = true; seat.receiveShadow = true;
    group.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.06), mat);
    back.position.set(0, 0.64, -0.17); back.castShadow = true;
    group.add(back);

    for (const dx of [-0.7, 0.7]) {
      for (const dz of [-0.15, 0.15]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.08), mat);
        leg.position.set(dx, 0.21, dz); leg.castShadow = true;
        group.add(leg);
      }
    }

    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    this.scene.add(group);
  }

  private addLampPost(x: number, z: number, goldMat: THREE.Material): void {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 12), goldMat);
    pole.position.set(x, 1.6, z);
    pole.castShadow = true;
    this.scene.add(pole);

    const lamp = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.2, 1),
      new THREE.MeshStandardMaterial({ color: 0xffd674, emissive: 0xffb847, emissiveIntensity: 1.8 })
    );
    lamp.position.set(x, 3.3, z);
    this.scene.add(lamp);
    this.animatedObjects.push({ obj: lamp, baseY: 3.3, amp: 0.04, speed: 2, phase: Math.random() * Math.PI * 2 });
    addPointLight(this.scene, x, 3.2, z, 0xffc96d, 1.4, 6);
  }

  private addFireflies(): void {
    const fireflyMat = new THREE.MeshStandardMaterial({ color: 0xfff4a0, emissive: 0xffd674, emissiveIntensity: 2.5 });
    for (let i = 0; i < 30; i++) {
      const fly = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), fireflyMat);
      const x = (Math.random() - 0.5) * 30;
      const y = 0.5 + Math.random() * 1.5;
      const z = 8 + Math.random() * 13;
      fly.position.set(x, y, z);
      this.scene.add(fly);
      this.animatedObjects.push({
        obj: fly,
        baseY: y,
        amp: 0.3 + Math.random() * 0.4,
        speed: 0.5 + Math.random() * 1,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }
}
