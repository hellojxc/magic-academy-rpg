import * as THREE from 'three';
import { addFlatPlane, addPointLight, makeWaterTexture } from './WorldHelpers';

/**
 * 湖泊 — 西南方向 (x:[-26,-4], z:[10,28])
 * 巨大水面、码头、芦苇、睡莲、远处小岛
 */
export class Lake {
  private readonly animatedObjects: { obj: THREE.Object3D; baseY: number; amp: number; speed: number; phase: number }[] = [];
  private readonly waterMeshes: THREE.Mesh[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  build(): void {
    const waterTex = makeWaterTexture();
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x3a7eac,
      roughness: 0.12,
      metalness: 0.35,
      map: waterTex,
      transparent: true,
      opacity: 0.82,
    });

    // 主水面 — 用不规则几何做岸线，避免像几块矩形贴图拼起来。
    this.addWaterBody(waterMat);
    this.addShallowWaterShelf();

    // 湖底
    const lakeBedMat = new THREE.MeshStandardMaterial({ color: 0x2a3a4a, roughness: 0.9, metalness: 0.0 });
    const bed = new THREE.Mesh(new THREE.CircleGeometry(13, 32), lakeBedMat);
    bed.rotation.x = -Math.PI / 2;
    bed.position.set(-15, -0.5, 19);
    bed.receiveShadow = true;
    this.scene.add(bed);

    // 沙滩/岸边
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xc4a86a, roughness: 0.7, metalness: 0.02 });
    for (let i = 0; i < 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      const r = 11.5 + Math.random() * 1.5;
      const x = -15 + Math.cos(angle) * r;
      const z = 19 + Math.sin(angle) * r * 0.82;
      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(0.6 + Math.random() * 0.4, 12),
        sandMat
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(x, -0.01, z);
      patch.receiveShadow = true;
      this.scene.add(patch);
    }
    this.addShoreDetails();

    // 码头 — 从东岸伸入湖中
    this.addDock(-6, 16, barkMat());

    // 芦苇
    const reedMat = new THREE.MeshStandardMaterial({ color: 0x6b8a3a, roughness: 0.7 });
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 10 + Math.random() * 1.5;
      const x = -15 + Math.cos(angle) * r;
      const z = 19 + Math.sin(angle) * r * 0.82;
      for (let j = 0; j < 3; j++) {
        const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.8 + Math.random() * 0.6, 4), reedMat);
        reed.position.set(x + (Math.random() - 0.5) * 0.3, 0.4 + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.3);
        reed.castShadow = true;
        this.scene.add(reed);
      }
    }

    // 睡莲
    const lilyMat = new THREE.MeshStandardMaterial({ color: 0x2d6b1a, roughness: 0.6, metalness: 0.03 });
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xfff4e0, roughness: 0.3 });
    for (let i = 0; i < 25; i++) {
      const x = -15 + (Math.random() - 0.5) * 18;
      const z = 19 + (Math.random() - 0.5) * 14;
      if (Math.abs(x + 15) > 9 || Math.abs(z - 19) > 7) continue;

      const lily = new THREE.Mesh(new THREE.CircleGeometry(0.2 + Math.random() * 0.15, 8), lilyMat);
      lily.rotation.x = -Math.PI / 2;
      lily.position.set(x, 0.02, z);
      lily.receiveShadow = true;
      this.scene.add(lily);
      this.animatedObjects.push({ obj: lily, baseY: 0.02, amp: 0.015, speed: 1.5, phase: Math.random() * Math.PI * 2 });

      // 偶尔开花
      if (Math.random() > 0.6) {
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), flowerMat);
        flower.position.set(x, 0.06, z);
        flower.castShadow = true;
        this.scene.add(flower);
      }
    }

    // 远处小岛
    this.addIsland(-22, 24);

    // 水面反光粒子
    this.addWaterSparkles();

    // 月光投射
    addPointLight(this.scene, -15, 6, 19, 0x9fc4ff, 1.8, 22);

    // 草地延伸到湖边
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4a8b3a, roughness: 0.85 });
    addFlatPlane(this.scene, new THREE.Vector3(-15, -0.03, 12), new THREE.Vector2(22, 4), grassMat);
  }

  update(elapsedTime: number): void {
    for (const item of this.animatedObjects) {
      item.obj.position.y = item.baseY + Math.sin(elapsedTime * item.speed + item.phase) * item.amp;
    }

    // 水面 UV 偏移 — 模拟波纹流动
    for (const mesh of this.waterMeshes) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat.map) {
        mat.map.offset.x = elapsedTime * 0.015;
        mat.map.offset.y = elapsedTime * 0.008;
      }
    }
  }

  private addWaterBody(waterMat: THREE.MeshStandardMaterial): void {
    const points = this.makeLakeOutline(12.0, 8.6, 44);
    const shape = new THREE.Shape(points);
    const water = new THREE.Mesh(new THREE.ShapeGeometry(shape), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(-15, 0, 19);
    water.receiveShadow = true;
    this.scene.add(water);
    this.waterMeshes.push(water);

    const deepMat = waterMat.clone();
    deepMat.color = new THREE.Color(0x235d86);
    deepMat.opacity = 0.55;
    const deepShape = new THREE.Shape(this.makeLakeOutline(8.4, 5.6, 36));
    const deep = new THREE.Mesh(new THREE.ShapeGeometry(deepShape), deepMat);
    deep.rotation.x = -Math.PI / 2;
    deep.position.set(-15, -0.022, 19);
    deep.receiveShadow = true;
    this.scene.add(deep);
    this.waterMeshes.push(deep);
  }

  private addShallowWaterShelf(): void {
    const shelfMat = new THREE.MeshStandardMaterial({
      color: 0x68b6bd,
      transparent: true,
      opacity: 0.32,
      roughness: 0.24,
      metalness: 0.08,
      depthWrite: false,
    });

    for (let i = 0; i < 30; i += 1) {
      const angle = (i / 30) * Math.PI * 2 + Math.sin(i * 1.7) * 0.08;
      const radiusX = 10.2 + Math.sin(i * 1.31) * 1.2;
      const radiusZ = 7.1 + Math.cos(i * 1.63) * 0.8;
      const patch = new THREE.Mesh(new THREE.CircleGeometry(0.45 + Math.random() * 0.55, 12), shelfMat);
      patch.rotation.x = -Math.PI / 2;
      patch.rotation.z = Math.random() * Math.PI;
      patch.scale.set(1.8 + Math.random() * 1.4, 0.26 + Math.random() * 0.24, 1);
      patch.position.set(-15 + Math.cos(angle) * radiusX, 0.012, 19 + Math.sin(angle) * radiusZ,);
      this.scene.add(patch);
    }
  }

  private addShoreDetails(): void {
    const pebbleMats = [
      new THREE.MeshStandardMaterial({ color: 0x726b61, roughness: 0.78 }),
      new THREE.MeshStandardMaterial({ color: 0x9b907b, roughness: 0.75 }),
      new THREE.MeshStandardMaterial({ color: 0x554d48, roughness: 0.82 }),
    ];
    const driftwoodMat = new THREE.MeshStandardMaterial({ color: 0x6d4a2d, roughness: 0.82, metalness: 0.02 });

    for (let i = 0; i < 90; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const x = -15 + Math.cos(angle) * (11.1 + Math.random() * 1.7);
      const z = 19 + Math.sin(angle) * (8.0 + Math.random() * 1.1);
      const pebble = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.05 + Math.random() * 0.08, 0),
        pebbleMats[i % pebbleMats.length]
      );
      pebble.scale.set(1.25 + Math.random(), 0.42 + Math.random() * 0.35, 0.75 + Math.random() * 0.7);
      pebble.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      pebble.position.set(x, 0.035, z);
      pebble.castShadow = true;
      pebble.receiveShadow = true;
      this.scene.add(pebble);
    }

    for (const [x, z, rot] of [[-9.8, 11.8, -0.5], [-22.8, 18.2, 0.7], [-17.6, 27.0, 0.15]] as Array<[number, number, number]>) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 1.2, 8), driftwoodMat);
      log.position.set(x, 0.12, z);
      log.rotation.set(Math.PI / 2, 0, rot);
      log.castShadow = true;
      log.receiveShadow = true;
      this.scene.add(log);
    }

    const rippleMat = new THREE.MeshBasicMaterial({ color: 0xc7ecff, transparent: true, opacity: 0.26, depthWrite: false });
    for (const [x, z, sx, sz] of [
      [-11.5, 15.4, 1.4, 0.45],
      [-17.8, 20.5, 1.9, 0.56],
      [-21.0, 25.2, 1.2, 0.38],
      [-8.6, 20.8, 1.6, 0.42],
      [-15.1, 13.1, 1.1, 0.35],
    ] as Array<[number, number, number, number]>) {
      const ripple = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.45, 42), rippleMat);
      ripple.rotation.x = -Math.PI / 2;
      ripple.scale.set(sx, sz, 1);
      ripple.position.set(x, 0.035, z);
      this.scene.add(ripple);
      this.animatedObjects.push({ obj: ripple, baseY: 0.035, amp: 0.006, speed: 1.2 + Math.random(), phase: Math.random() * Math.PI * 2 });
    }
  }

  private makeLakeOutline(radiusX: number, radiusZ: number, segments: number): THREE.Vector2[] {
    const points: THREE.Vector2[] = [];
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const wobble =
        1 +
        Math.sin(angle * 2.1 + 0.35) * 0.08 +
        Math.cos(angle * 3.4 - 0.7) * 0.055 +
        Math.sin(angle * 5.2) * 0.035;
      const notch = angle > Math.PI * 1.76 || angle < Math.PI * 0.08 ? 0.82 : 1;
      points.push(new THREE.Vector2(Math.cos(angle) * radiusX * wobble * notch, Math.sin(angle) * radiusZ * wobble));
    }
    return points;
  }

  private addDock(x: number, z: number, mat: THREE.Material): void {
    // 木栈道
    for (let i = 0; i < 5; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.3 + Math.random() * 0.22, 0.08, 0.72 + Math.random() * 0.16), mat);
      plank.position.set(x + i * 0.82, 0.15 + (i % 2) * 0.012, z + (Math.random() - 0.5) * 0.08);
      plank.rotation.y = (Math.random() - 0.5) * 0.05;
      plank.castShadow = true; plank.receiveShadow = true;
      this.scene.add(plank);

      const seam = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.012, 0.035), new THREE.MeshStandardMaterial({ color: 0x3a2619, roughness: 0.85 }));
      seam.position.set(x + i * 0.82, 0.198, z + 0.18);
      seam.rotation.y = plank.rotation.y;
      seam.receiveShadow = true;
      this.scene.add(seam);
    }

    // 桩
    for (let i = 0; i < 5; i++) {
      for (const dx of [-0.65, 0.65]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), mat);
        post.position.set(x + i * 0.82 + dx, -0.1, z);
        post.castShadow = true;
        this.scene.add(post);
      }
    }

    // 码头尽头灯笼
    const lamp = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.15, 1),
      new THREE.MeshStandardMaterial({ color: 0xffd674, emissive: 0xffb847, emissiveIntensity: 2 })
    );
    lamp.position.set(x + 4.1, 0.7, z);
    this.scene.add(lamp);
    this.animatedObjects.push({ obj: lamp, baseY: 0.7, amp: 0.03, speed: 1.8, phase: 0 });
    addPointLight(this.scene, x + 4.1, 0.7, z, 0xffc96d, 1.0, 5);
  }

  private addIsland(x: number, z: number): void {
    // 小岛基座
    const islandMat = new THREE.MeshStandardMaterial({ color: 0x6a8b4a, roughness: 0.8 });
    const island = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.4, 0.6, 24), islandMat);
    island.position.set(x, 0.1, z);
    island.receiveShadow = true;
    this.scene.add(island);

    // 岛上树
    const barkMat = new THREE.MeshStandardMaterial({ color: 0x5a3e28, roughness: 0.65 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.8, 8), barkMat);
    trunk.position.set(x, 1.0, z);
    trunk.castShadow = true;
    this.scene.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3d7a30, roughness: 0.75 });
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), leafMat);
    crown.position.set(x, 2.0, z);
    crown.castShadow = true;
    this.scene.add(crown);
    this.animatedObjects.push({ obj: crown, baseY: 2.0, amp: 0.02, speed: 0.7, phase: 0 });
  }

  private addWaterSparkles(): void {
    const sparkMat = new THREE.MeshStandardMaterial({ color: 0xc8e8ff, emissive: 0x9fdcff, emissiveIntensity: 1.5, transparent: true, opacity: 0.6 });
    for (let i = 0; i < 40; i++) {
      const x = -15 + (Math.random() - 0.5) * 16;
      const z = 19 + (Math.random() - 0.5) * 12;
      if (Math.abs(x + 15) > 8 || Math.abs(z - 19) > 6) continue;

      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 3), sparkMat);
      spark.position.set(x, 0.03, z);
      this.scene.add(spark);
      this.animatedObjects.push({
        obj: spark,
        baseY: 0.03,
        amp: 0.02,
        speed: 2 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }
}

function barkMat(): THREE.Material {
  return new THREE.MeshStandardMaterial({ color: 0x6d432b, roughness: 0.44, metalness: 0.08 });
}
