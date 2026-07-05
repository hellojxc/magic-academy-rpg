import * as THREE from 'three';
import type { Obstacle } from './WorldTypes';
import { addBox, addPointLight, makeWoodTexture, makePlasterTexture } from './WorldHelpers';
import { MatLib, getStandardMaterial, Geo, makeSharedSurfaceDetailTexture } from './RenderResources';
import { addWorldPrefabRegion } from './WorldPrefabLayer';

/**
 * 食堂 — 中庭东面 (x:[10,24], z:[-6,8])
 * 长条桌椅、壁炉、吊灯、食物台
 */
export class DiningHall {
  private readonly animatedObjects: { obj: THREE.Object3D; baseY: number; amp: number; speed: number; phase: number }[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly onSceneAssetInstalled?: () => void,
  ) {}

  build(): Obstacle[] {
    const obstacles: Obstacle[] = [];

    const woodTex = makeWoodTexture();
    const plasterTex = makePlasterTexture({ light: '#d4c4b0', mid: '#b8a690', dark: '#d0c0a8' });
    const woodDetailTex = makeSharedSurfaceDetailTexture('dining-wood', 3, 3);
    const plasterDetailTex = makeSharedSurfaceDetailTexture('dining-plaster', 2.4, 1.2);
    const woodMat = getStandardMaterial({
      color: 0x5b3324,
      roughness: 0.48,
      metalness: 0.1,
      map: woodTex,
      bumpMap: woodDetailTex,
      bumpScale: 0.02,
      roughnessMap: woodDetailTex,
    });
    const darkWoodMat = getStandardMaterial({ color: 0x3a211a, roughness: 0.5, metalness: 0.08 });
    const wallMat = getStandardMaterial({
      color: 0xc4b4a0,
      roughness: 0.64,
      metalness: 0.03,
      map: plasterTex,
      bumpMap: plasterDetailTex,
      bumpScale: 0.034,
      roughnessMap: plasterDetailTex,
    });
    const lowerMat = getStandardMaterial({ color: 0x7b6a5e, roughness: 0.5, metalness: 0.08 });
    const goldMat = MatLib.gold;
    const clothMat = getStandardMaterial({ color: 0xe8dcc0, roughness: 0.72, metalness: 0.02 });
    const wallDetailWoodMat = getStandardMaterial({ color: 0x3d2418, roughness: 0.58, metalness: 0.06, map: woodTex });
    const floorWoodTex = woodTex.clone();
    floorWoodTex.repeat.set(3, 3);

    // 地板
    const floor = new THREE.Mesh(
      Geo.box(14, 0.16, 14),
      getStandardMaterial({
        color: 0x8a6b4e,
        roughness: 0.46,
        metalness: 0.06,
        map: floorWoodTex,
        bumpMap: woodDetailTex,
        bumpScale: 0.022,
        roughnessMap: woodDetailTex,
      })
    );
    floor.position.set(17, -0.08, 1);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 墙壁
    // 东墙
    addBox(this.scene, new THREE.Vector3(24.1, 2.3, 1), new THREE.Vector3(0.45, 4.6, 14.5), wallMat, false, true);
    addBox(this.scene, new THREE.Vector3(23.8, 0.6, 1), new THREE.Vector3(0.28, 0.9, 14), lowerMat, true, true);
    addBox(this.scene, new THREE.Vector3(23.8, 4.2, 1), new THREE.Vector3(0.14, 0.18, 14), goldMat, true, true);

    // 北墙
    addBox(this.scene, new THREE.Vector3(17, 2.3, -6.6), new THREE.Vector3(14.5, 4.6, 0.45), wallMat, false, true);
    addBox(this.scene, new THREE.Vector3(17, 0.6, -6.35), new THREE.Vector3(14, 0.9, 0.28), lowerMat, true, true);

    // 南墙 (部分 — 留通道)
    addBox(this.scene, new THREE.Vector3(22, 2.3, 7.6), new THREE.Vector3(4.5, 4.6, 0.45), wallMat, false, true);
    addBox(this.scene, new THREE.Vector3(22, 0.6, 7.35), new THREE.Vector3(4, 0.9, 0.28), lowerMat, true, true);
    this.addWallDetails(lowerMat, goldMat, wallDetailWoodMat);

    // 天花板
    const ceilMat = getStandardMaterial({ color: 0x6a5a4e, roughness: 0.62, metalness: 0.03 });
    const ceiling = new THREE.Mesh(Geo.box(14, 0.12, 14), ceilMat);
    ceiling.position.set(17, 4.6, 1);
    ceiling.receiveShadow = true;
    this.scene.add(ceiling);

    // 壁炉 (东墙中部)
    this.addFireplace(23.3, 1);

    // 长桌 — 三排
    for (const z of [-3, 0.5, 4]) {
      this.addDiningTable(17, z, 10, woodMat, clothMat, darkWoodMat);
    }

    // 食物台 (北墙下)
    this.addFoodCounter(14, -5.5, woodMat, goldMat);

    // 吊灯
    const chandelierMat = MatLib.chandelier;
    for (const [x, z] of [[15, -3], [19, -3], [15, 0.5], [19, 0.5], [15, 4], [19, 4]] as Array<[number, number]>) {
      this.addChandelier(x, z, chandelierMat);
    }

    // 窗户
    for (const z of [-4, -1, 2, 5]) {
      this.addWindow(23.7, 2.5, z, 'side');
    }
    addWorldPrefabRegion(this.scene, 'dining_hall', this.onSceneAssetInstalled);

    // 障碍物
    obstacles.push(
      // 东墙
      { minX: 23.8, maxX: 24.4, minZ: -6.5, maxZ: 8 },
      // 北墙
      { minX: 9.8, maxX: 24, minZ: -6.6, maxZ: -6.0 },
      // 南墙
      { minX: 19.5, maxX: 24, minZ: 7.3, maxZ: 7.9 },
      // 长桌
      { minX: 11.5, maxX: 22.5, minZ: -3.6, maxZ: -2.4 },
      { minX: 11.5, maxX: 22.5, minZ: -0.1, maxZ: 1.1 },
      { minX: 11.5, maxX: 22.5, minZ: 3.4, maxZ: 4.6 },
      // 食物台
      { minX: 12.5, maxX: 15.5, minZ: -5.8, maxZ: -5.2 },
      // 壁炉
      { minX: 22.6, maxX: 24, minZ: 0.2, maxZ: 1.8 },
    );

    return obstacles;
  }

  update(elapsedTime: number, delta: number): void {
    const frameScale = delta * 60;
    for (const item of this.animatedObjects) {
      item.obj.position.y = item.baseY + Math.sin(elapsedTime * item.speed + item.phase) * item.amp;
      item.obj.rotation.y += 0.01 * frameScale;
    }
  }

  getDynamicObjects(): readonly THREE.Object3D[] {
    return this.animatedObjects.map((item) => item.obj);
  }

  private addDiningTable(centerX: number, centerZ: number, length: number, woodMat: THREE.Material, clothMat: THREE.Material, darkWoodMat: THREE.Material): void {
    // 桌面
    const top = new THREE.Mesh(Geo.box(length, 0.08, 1.2), woodMat);
    top.position.set(centerX, 0.74, centerZ);
    top.castShadow = true; top.receiveShadow = true;
    this.scene.add(top);

    // 桌布
    const cloth = new THREE.Mesh(Geo.box(length * 0.98, 0.04, 1.1), clothMat);
    cloth.position.set(centerX, 0.78, centerZ);
    cloth.castShadow = true; cloth.receiveShadow = true;
    this.scene.add(cloth);

    // 桌腿
    const legGeo = Geo.box(0.12, 0.72, 0.12);
    for (const dx of [-length / 2 + 0.3, length / 2 - 0.3]) {
      for (const dz of [-0.45, 0.45]) {
        const leg = new THREE.Mesh(legGeo, darkWoodMat);
        leg.position.set(centerX + dx, 0.36, centerZ + dz);
        leg.castShadow = true; leg.receiveShadow = true;
        this.scene.add(leg);
      }
    }

    // 板凳 (两侧)
    for (const dz of [-0.85, 0.85]) {
      const bench = new THREE.Mesh(Geo.box(length * 0.9, 0.06, 0.3), darkWoodMat);
      bench.position.set(centerX, 0.42, centerZ + dz);
      bench.castShadow = true; bench.receiveShadow = true;
      this.scene.add(bench);

      const benchLegGeo = Geo.box(0.08, 0.4, 0.08);
      for (const dx of [-length * 0.4, 0, length * 0.4]) {
        const bl = new THREE.Mesh(benchLegGeo, darkWoodMat);
        bl.position.set(centerX + dx, 0.2, centerZ + dz);
        bl.castShadow = true;
        this.scene.add(bl);
      }
    }

    // 餐具 — 盘子
    const plateMat = MatLib.plate;
    const cupMat = MatLib.cup;
    const plateGeo = Geo.cylinder(0.12, 0.1, 0.02, 16);
    const cupGeo = Geo.cylinder(0.04, 0.035, 0.08, 12);
    const plateMatrices: THREE.Matrix4[] = [];
    const cupMatrices: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 6; i++) {
      const dx = -length / 2 + 1 + i * (length - 2) / 5;
      for (const dz of [-0.3, 0.3]) {
        dummy.position.set(centerX + dx, 0.81, centerZ + dz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        plateMatrices.push(dummy.matrix.clone());

        dummy.position.set(centerX + dx + 0.16, 0.84, centerZ + dz);
        dummy.updateMatrix();
        cupMatrices.push(dummy.matrix.clone());
      }
    }

    this.addInstancedStaticMesh(plateGeo, plateMat, plateMatrices, true, false);
    this.addInstancedStaticMesh(cupGeo, cupMat, cupMatrices, true, false);
  }

  private addFoodCounter(x: number, z: number, woodMat: THREE.Material, goldMat: THREE.Material): void {
    const counter = new THREE.Mesh(Geo.box(3, 0.9, 0.6), woodMat);
    counter.position.set(x, 0.45, z);
    counter.castShadow = true; counter.receiveShadow = true;
    this.scene.add(counter);

    // 顶部金色边
    const trim = new THREE.Mesh(Geo.box(3.1, 0.04, 0.7), goldMat);
    trim.position.set(x, 0.92, z);
    trim.castShadow = true;
    this.scene.add(trim);

    // 食物 — 水果碗
    const bowlMat = getStandardMaterial({ color: 0xd4a76a, roughness: 0.3 });
    const fruitColors = [0xd85f5f, 0xf1c45f, 0x6b9e4a, 0xd85f9e];
    const fruitMats = fruitColors.map((c) => getStandardMaterial({ color: c, roughness: 0.4 }));
    const bowlMatrices: THREE.Matrix4[] = [];
    const fruitMatricesByMaterial = fruitMats.map((): THREE.Matrix4[] => []);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 3; i++) {
      const dx = (i - 1) * 0.8;
      dummy.position.set(x + dx, 0.96, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bowlMatrices.push(dummy.matrix.clone());

      // 水果
      for (let j = 0; j < 4; j++) {
        const fruitScale = 0.05 + Math.random() * 0.03;
        const materialIndex = Math.floor(Math.random() * fruitMats.length);
        dummy.position.set(
          x + dx + (Math.random() - 0.5) * 0.2,
          1.0 + Math.random() * 0.05,
          z + (Math.random() - 0.5) * 0.15
        );
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(fruitScale);
        dummy.updateMatrix();
        fruitMatricesByMaterial[materialIndex].push(dummy.matrix.clone());
      }
    }

    this.addInstancedStaticMesh(Geo.cylinder(0.18, 0.12, 0.08, 16), bowlMat, bowlMatrices, true, false);
    for (let i = 0; i < fruitMats.length; i += 1) {
      this.addInstancedStaticMesh(Geo.sphere(1, 8, 6), fruitMats[i], fruitMatricesByMaterial[i], true, false);
    }
  }

  private addInstancedStaticMesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    matrices: THREE.Matrix4[],
    castShadow: boolean,
    receiveShadow: boolean
  ): void {
    if (matrices.length === 0) return;
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.computeBoundingSphere();
    this.scene.add(mesh);
  }

  private addFireplace(x: number, z: number): void {
    const stoneMat = getStandardMaterial({ color: 0x5a4a3e, roughness: 0.6, metalness: 0.06 });
    const fireMat = MatLib.fire;
    const sootMat = new THREE.MeshBasicMaterial({ color: 0x1f1714, transparent: true, opacity: 0.28, depthWrite: false });

    // 壁炉框架
    addBox(this.scene, new THREE.Vector3(x - 0.6, 1.0, z), new THREE.Vector3(0.3, 2, 1.6), stoneMat, true, true);
    addBox(this.scene, new THREE.Vector3(x + 0.6, 1.0, z), new THREE.Vector3(0.3, 2, 1.6), stoneMat, true, true);
    addBox(this.scene, new THREE.Vector3(x, 2.1, z), new THREE.Vector3(1.8, 0.3, 1.6), stoneMat, true, true);
    addBox(this.scene, new THREE.Vector3(x, 0.5, z), new THREE.Vector3(1.4, 0.2, 0.8), stoneMat, true, true);

    const soot = new THREE.Mesh(Geo.plane(1.25, 1.55), sootMat);
    soot.position.set(x - 0.03, 1.55, z);
    soot.rotation.y = Math.PI / 2;
    this.scene.add(soot);

    // 火焰
    const fire = new THREE.Mesh(Geo.sphere(0.25, 12, 8), fireMat);
    fire.position.set(x, 0.7, z);
    fire.scale.set(1, 1.5, 1);
    this.scene.add(fire);
    this.animatedObjects.push({ obj: fire, baseY: 0.7, amp: 0.06, speed: 5, phase: 0 });

    addPointLight(this.scene, x, 0.8, z, 0xff6020, 2.5, 6);
  }

  private addChandelier(x: number, z: number, mat: THREE.Material): void {
    const group = new THREE.Group();

    // 链
    const chain = new THREE.Mesh(Geo.cylinder(0.02, 0.02, 1.2, 6), mat);
    chain.position.set(0, -0.6, 0);
    group.add(chain);

    // 主体环
    const ring = new THREE.Mesh(Geo.torus(0.35, 0.03, 8, 24), mat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    // 蜡烛灯
    const candleMat = MatLib.candleWax;
    const flameMat = getStandardMaterial({ color: 0xffd674, emissive: 0xffb847, emissiveIntensity: 2 });
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const candle = new THREE.Mesh(
        Geo.cylinder(0.04, 0.04, 0.12, 8),
        candleMat
      );
      candle.position.set(Math.cos(angle) * 0.35, -0.06, Math.sin(angle) * 0.35);
      group.add(candle);

      // 火焰
      const flame = new THREE.Mesh(
        Geo.sphere(0.03, 8, 6),
        flameMat
      );
      flame.position.set(Math.cos(angle) * 0.35, 0.02, Math.sin(angle) * 0.35);
      group.add(flame);
    }

    group.position.set(x, 4.0, z);
    this.scene.add(group);
    addPointLight(this.scene, x, 3.8, z, 0xffc96d, 1.0, 4);
    this.animatedObjects.push({ obj: group, baseY: 4.0, amp: 0.03, speed: 1.2, phase: Math.random() * Math.PI * 2 });
  }

  private addWindow(x: number, y: number, z: number, _side: string): void {
    const frameMat = MatLib.goldFrame;
    const glassMat = MatLib.windowGlassDining;

    const glass = new THREE.Mesh(Geo.plane(1.4, 2.2), glassMat);
    glass.position.set(x - 0.05, y, z);
    glass.rotation.y = Math.PI / 2;
    this.scene.add(glass);

    addBox(this.scene, new THREE.Vector3(x, y, z), new THREE.Vector3(0.06, 2.4, 1.7), frameMat, true, true);
    addBox(this.scene, new THREE.Vector3(x, y, z + 0.75), new THREE.Vector3(0.06, 0.08, 1.8), frameMat, true, true);
    addBox(this.scene, new THREE.Vector3(x, y, z - 0.75), new THREE.Vector3(0.06, 0.08, 1.8), frameMat, true, true);
  }

  private addWallDetails(lowerMat: THREE.Material, goldMat: THREE.Material, darkWoodMat: THREE.Material): void {
    const seamMat = getStandardMaterial({ color: 0x756656, roughness: 0.72, metalness: 0.02 });
    const plateMat = getStandardMaterial({ color: 0xe8dcc0, roughness: 0.38, metalness: 0.04 });

    for (const y of [1.35, 2.3, 3.25]) {
      addBox(this.scene, new THREE.Vector3(23.56, y, 1), new THREE.Vector3(0.05, 0.022, 13.2), seamMat, false, true);
      addBox(this.scene, new THREE.Vector3(17, y, -6.08), new THREE.Vector3(13.0, 0.022, 0.05), seamMat, false, true);
    }

    for (const z of [-5.0, -3.0, -1.0, 1.0, 3.0, 5.0, 6.8]) {
      addBox(this.scene, new THREE.Vector3(23.55, 2.35, z), new THREE.Vector3(0.05, 2.05, 0.025), seamMat, false, true);
    }
    for (const x of [11.2, 13.2, 15.2, 17.2, 19.2, 21.2, 23.0]) {
      addBox(this.scene, new THREE.Vector3(x, 2.35, -6.07), new THREE.Vector3(0.025, 2.0, 0.05), seamMat, false, true);
    }

    for (const z of [-4.8, -2.0, 3.8, 6.2]) {
      addBox(this.scene, new THREE.Vector3(23.5, 1.05, z), new THREE.Vector3(0.09, 0.58, 1.05), lowerMat, true, true);
      addBox(this.scene, new THREE.Vector3(23.43, 1.36, z), new THREE.Vector3(0.08, 0.045, 0.9), goldMat, true, true);
    }

    const hookGeo = Geo.torusArc(0.06, 0.01, 6, 14, Math.PI);
    for (const [x, z, rot] of [[12.0, -6.02, 0], [16.3, -6.02, 0], [20.8, -6.02, 0], [23.48, -2.6, Math.PI / 2], [23.48, 4.2, Math.PI / 2]] as Array<[number, number, number]>) {
      const bracket = new THREE.Group();
      const rail = new THREE.Mesh(Geo.cylinder(0.025, 0.025, 0.82, 8), darkWoodMat);
      rail.rotation.z = Math.PI / 2;
      bracket.add(rail);
      for (const dx of [-0.32, 0.32]) {
        const hook = new THREE.Mesh(hookGeo, goldMat);
        hook.position.x = dx;
        hook.rotation.z = Math.PI;
        bracket.add(hook);
      }
      bracket.position.set(x, 2.05, z);
      bracket.rotation.y = rot;
      this.scene.add(bracket);
    }

    for (const [x, z, rot] of [[13.6, -6.0, 0], [18.4, -6.0, 0], [23.46, -0.3, Math.PI / 2], [23.46, 2.5, Math.PI / 2]] as Array<[number, number, number]>) {
      const plate = new THREE.Mesh(Geo.cylinder(0.18, 0.18, 0.018, 24), plateMat);
      plate.position.set(x, 2.74, z);
      plate.rotation.set(Math.PI / 2, rot, 0);
      plate.castShadow = true;
      this.scene.add(plate);
    }
  }
}
