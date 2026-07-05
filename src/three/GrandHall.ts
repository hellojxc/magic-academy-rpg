import * as THREE from 'three';
import type { Obstacle } from './WorldTypes';
import {
  addBox, addPointLight,
  makeMarbleTexture, makePlasterTexture,
} from './WorldHelpers';
import { MatLib, getStandardMaterial, Geo, makeSharedSurfaceDetailTexture } from './RenderResources';
import { addWorldPrefabRegion } from './WorldPrefabLayer';

/**
 * 大厅 — 中庭北面 (x:[-13,13], z:[-22,-7])
 * 高穹顶、巨大拱门、星图地板、魔法灯笼
 */
export class GrandHall {
  private readonly animatedObjects: { obj: THREE.Object3D; baseY: number; amp: number; speed: number; phase: number }[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  build(): Obstacle[] {
    const obstacles: Obstacle[] = [];

    const marbleTex = makeMarbleTexture({ light: '#e8dcc8', mid: '#c9b896', dark: '#f0e8d8' });
    const plasterTex = makePlasterTexture({ light: '#d4c9b8', mid: '#b8a898', dark: '#d8cdb8' });
    const marbleDetailTex = makeSharedSurfaceDetailTexture('grand-hall-marble', 4.8, 3.2);
    const plasterDetailTex = makeSharedSurfaceDetailTexture('grand-hall-plaster', 2.8, 1.4);
    const goldMat = MatLib.gold;
    const stoneMat = getStandardMaterial({ color: 0x80706a, roughness: 0.42, metalness: 0.12 });

    // 地板
    const floor = new THREE.Mesh(
      Geo.box(26, 0.16, 15),
      new THREE.MeshStandardMaterial({
        color: 0xd8ccb8,
        roughness: 0.42,
        metalness: 0.05,
        map: marbleTex,
        bumpMap: marbleDetailTex,
        bumpScale: 0.024,
        roughnessMap: marbleDetailTex,
      })
    );
    floor.position.set(0, -0.08, -14.5);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 星图地板纹饰 — 中央魔法阵
    const circleMat = getStandardMaterial({ color: 0xc7a060, roughness: 0.3, metalness: 0.5, emissive: 0xc7a060, emissiveIntensity: 0.08 });
    const ring1 = new THREE.Mesh(Geo.cylinder(3.5, 3.5, 0.02, 64), circleMat);
    ring1.position.set(0, 0.02, -14.5);
    ring1.receiveShadow = true;
    this.scene.add(ring1);

    const ring2 = new THREE.Mesh(Geo.cylinder(2.2, 2.2, 0.02, 48), circleMat);
    ring2.position.set(0, 0.02, -14.5);
    this.scene.add(ring2);

    // 魔法阵内的星形
    const starShape = new THREE.Shape();
    const starR = 1.5;
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? starR : starR * 0.4;
      if (i === 0) starShape.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      else starShape.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    const star = new THREE.Mesh(
      new THREE.ExtrudeGeometry(starShape, { depth: 0.02, bevelEnabled: false }),
      getStandardMaterial({ color: 0xd6b45d, roughness: 0.25, metalness: 0.5, emissive: 0xffd700, emissiveIntensity: 0.15 })
    );
    star.rotation.x = -Math.PI / 2;
    star.position.set(0, 0.03, -14.5);
    star.receiveShadow = true;
    this.scene.add(star);

    // 墙壁
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xc4b8a8,
      roughness: 0.64,
      metalness: 0.03,
      map: plasterTex,
      bumpMap: plasterDetailTex,
      bumpScale: 0.036,
      roughnessMap: plasterDetailTex,
    });
    const lowerMat = getStandardMaterial({ color: 0x7b6a5e, roughness: 0.5, metalness: 0.08 });

    // 后墙 (北)
    addBox(this.scene, new THREE.Vector3(0, 2.5, -22.4), new THREE.Vector3(26.5, 5, 0.45), wallMat, false, true);
    addBox(this.scene, new THREE.Vector3(0, 0.6, -22.1), new THREE.Vector3(26, 0.9, 0.28), lowerMat, true, true);
    addBox(this.scene, new THREE.Vector3(0, 4.85, -22.1), new THREE.Vector3(26, 0.2, 0.14), goldMat, true, true);

    // 左墙 (西)
    addBox(this.scene, new THREE.Vector3(-13.2, 2.5, -14.5), new THREE.Vector3(0.45, 5, 15.2), wallMat, false, true);
    addBox(this.scene, new THREE.Vector3(-12.9, 0.6, -14.5), new THREE.Vector3(0.28, 0.9, 14.8), lowerMat, true, true);

    // 右墙 (东)
    addBox(this.scene, new THREE.Vector3(13.2, 2.5, -14.5), new THREE.Vector3(0.45, 5, 15.2), wallMat, false, true);
    addBox(this.scene, new THREE.Vector3(12.9, 0.6, -14.5), new THREE.Vector3(0.28, 0.9, 14.8), lowerMat, true, true);
    this.addWallStonework(stoneMat, lowerMat, goldMat);

    // 穹顶 — 高拱形天花板
    const domeMat = new THREE.MeshStandardMaterial({ color: 0x6a5a6e, roughness: 0.6, metalness: 0.04, side: THREE.DoubleSide });
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(13, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      domeMat
    );
    dome.position.set(0, 5, -14.5);
    dome.scale.set(1, 0.45, 0.58);
    this.scene.add(dome);

    // 穹顶顶部水晶
    const crystal = new THREE.Mesh(
      Geo.octahedron(0.6, 0),
      MatLib.crystal
    );
    crystal.position.set(0, 5.8, -14.5);
    this.scene.add(crystal);
    this.animatedObjects.push({ obj: crystal, baseY: 5.8, amp: 0.15, speed: 1.2, phase: 0 });
    addPointLight(this.scene, 0, 5.5, -14.5, 0xbfe7ff, 3.5, 18);

    // 柱子 — 6 根高大石柱
    for (const [x, z] of [[-10, -19], [10, -19], [-10, -10], [10, -10], [-10, -15.5], [10, -15.5]] as Array<[number, number]>) {
      this.addColumn(x, z, stoneMat, goldMat);
    }

    // 墙面装饰板
    const panelMat = getStandardMaterial({ color: 0x9f8e7a, roughness: 0.56, metalness: 0.04 });
    const insetMat = getStandardMaterial({ color: 0x6f5e4f, roughness: 0.62, metalness: 0.04 });
    for (const x of [-9, -5, 5, 9]) {
      this.addFramedPanel(new THREE.Vector3(x, 2.8, -22.1), 2.2, 3.2, 'back', panelMat, insetMat, goldMat);
    }
    for (const z of [-19, -15, -11]) {
      this.addFramedPanel(new THREE.Vector3(-12.9, 2.6, z), 2.0, 2.8, 'left', panelMat, insetMat, goldMat);
      this.addFramedPanel(new THREE.Vector3(12.9, 2.6, z), 2.0, 2.8, 'right', panelMat, insetMat, goldMat);
    }

    // 灯笼 — 漂浮魔法灯
    for (const [x, z] of [[-7, -18], [7, -18], [-7, -11], [7, -11], [0, -14.5]] as Array<[number, number]>) {
      const lamp = new THREE.Mesh(
        Geo.octahedron(0.2, 1),
        MatLib.warmLight
      );
      lamp.position.set(x, 3.2, z);
      this.scene.add(lamp);
      addPointLight(this.scene, x, 3.2, z, 0xffc96d, 1.2, 5);
      this.animatedObjects.push({ obj: lamp, baseY: 3.2, amp: 0.12, speed: 1.5 + Math.random() * 0.5, phase: Math.random() * Math.PI * 2 });
    }

    // 北面大型彩色玻璃窗
    this.addStainedGlass(0, 3.2, -22.05, 5, 3.5);
    addWorldPrefabRegion(this.scene, 'grand_hall');

    // 障碍物 — 墙壁和柱子
    obstacles.push(
      { minX: -13.2, maxX: -12.6, minZ: -22, maxZ: -7.5 },   // 西墙
      { minX: 12.6, maxX: 13.2, minZ: -22, maxZ: -7.5 },      // 东墙
      { minX: -13, maxX: 13, minZ: -22.4, maxZ: -21.8 },      // 北墙
      // 柱子
      { minX: -10.4, maxX: -9.6, minZ: -19.4, maxZ: -18.6 },
      { minX: 9.6, maxX: 10.4, minZ: -19.4, maxZ: -18.6 },
      { minX: -10.4, maxX: -9.6, minZ: -10.4, maxZ: -9.6 },
      { minX: 9.6, maxX: 10.4, minZ: -10.4, maxZ: -9.6 },
      { minX: -10.4, maxX: -9.6, minZ: -15.9, maxZ: -15.1 },
      { minX: 9.6, maxX: 10.4, minZ: -15.9, maxZ: -15.1 },
    );

    return obstacles;
  }

  update(elapsedTime: number, delta: number): void {
    const frameScale = delta * 60;
    for (const item of this.animatedObjects) {
      item.obj.position.y = item.baseY + Math.sin(elapsedTime * item.speed + item.phase) * item.amp;
      item.obj.rotation.y += 0.008 * frameScale;
    }
  }

  private addColumn(x: number, z: number, stoneMat: THREE.Material, trimMat: THREE.Material): void {
    const baseGeo = Geo.cylinder(0.45, 0.52, 0.2, 28);
    const base = new THREE.Mesh(baseGeo, stoneMat);
    base.position.set(x, 0.1, z); base.castShadow = true; base.receiveShadow = true;
    this.scene.add(base);

    const pillarGeo = Geo.cylinder(0.24, 0.27, 4.5, 28);
    const pillar = new THREE.Mesh(pillarGeo, stoneMat);
    pillar.position.set(x, 2.35, z); pillar.castShadow = true; pillar.receiveShadow = true;
    this.scene.add(pillar);

    const ringGeo = Geo.cylinder(0.34, 0.36, 0.09, 28);
    for (const y of [0.36, 4.3]) {
      const ring = new THREE.Mesh(ringGeo, trimMat);
      ring.position.set(x, y, z); ring.castShadow = true; ring.receiveShadow = true;
      this.scene.add(ring);
    }

    const grooveMat = getStandardMaterial({ color: 0x514844, roughness: 0.68, metalness: 0.02 });
    const grooveGeo = Geo.box(0.025, 3.65, 0.035);
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const groove = new THREE.Mesh(grooveGeo, grooveMat);
      groove.position.set(x + Math.cos(angle) * 0.265, 2.34, z + Math.sin(angle) * 0.265);
      groove.rotation.y = -angle;
      groove.castShadow = true;
      groove.receiveShadow = true;
      this.scene.add(groove);
    }

    for (const [dy, angle, width] of [[1.35, 0.4, 0.18], [2.55, 2.1, 0.14], [3.52, 4.3, 0.16]] as Array<[number, number, number]>) {
      const scar = new THREE.Mesh(Geo.box(width, 0.022, 0.026), grooveMat);
      scar.position.set(x + Math.cos(angle) * 0.286, dy, z + Math.sin(angle) * 0.286);
      scar.rotation.set(0, -angle + 0.35, 0.38);
      scar.castShadow = true;
      this.scene.add(scar);
    }
  }

  private addWallStonework(stoneMat: THREE.Material, lowerMat: THREE.Material, trimMat: THREE.Material): void {
    const seamMat = getStandardMaterial({ color: 0x665a54, roughness: 0.72, metalness: 0.02 });
    const reliefMat = getStandardMaterial({ color: 0x9a8978, roughness: 0.58, metalness: 0.04 });

    for (const y of [1.2, 2.05, 2.9, 3.75]) {
      addBox(this.scene, new THREE.Vector3(0, y, -22.0), new THREE.Vector3(25.2, 0.026, 0.055), seamMat, false, true);
      addBox(this.scene, new THREE.Vector3(-12.86, y, -14.5), new THREE.Vector3(0.055, 0.026, 14.1), seamMat, false, true);
      addBox(this.scene, new THREE.Vector3(12.86, y, -14.5), new THREE.Vector3(0.055, 0.026, 14.1), seamMat, false, true);
    }

    for (const x of [-11.2, -8.4, -5.6, -2.8, 2.8, 5.6, 8.4, 11.2]) {
      addBox(this.scene, new THREE.Vector3(x, 2.48, -21.98), new THREE.Vector3(0.03, 3.0, 0.06), seamMat, false, true);
    }

    for (const z of [-20.0, -17.4, -14.8, -12.2, -9.6]) {
      addBox(this.scene, new THREE.Vector3(-12.84, 2.44, z), new THREE.Vector3(0.06, 3.0, 0.03), seamMat, false, true);
      addBox(this.scene, new THREE.Vector3(12.84, 2.44, z), new THREE.Vector3(0.06, 3.0, 0.03), seamMat, false, true);
    }

    for (const [x, y, z, side] of [
      [-7.2, 3.55, -21.93, 'back'],
      [3.4, 1.85, -21.93, 'back'],
      [-12.78, 3.1, -18.0, 'side'],
      [12.78, 1.72, -11.8, 'side'],
    ] as Array<[number, number, number, 'back' | 'side']>) {
      const chip = new THREE.Mesh(Geo.dodecahedron(0.16, 0), stoneMat);
      chip.scale.set(1, 0.34, 0.55);
      chip.position.set(x, y, z);
      chip.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.6);
      chip.castShadow = true;
      chip.receiveShadow = true;
      if (side === 'side') chip.scale.set(0.4, 0.34, 1.0);
      this.scene.add(chip);
    }

    for (const x of [-6.6, 0, 6.6]) {
      addBox(this.scene, new THREE.Vector3(x, 4.52, -22.02), new THREE.Vector3(1.6, 0.08, 0.08), trimMat, true, true);
      addBox(this.scene, new THREE.Vector3(x, 0.98, -22.0), new THREE.Vector3(1.2, 0.05, 0.08), lowerMat, true, true);
      const medallion = new THREE.Mesh(Geo.torus(0.28, 0.022, 8, 28), reliefMat);
      medallion.position.set(x, 3.78, -21.96);
      medallion.rotation.x = Math.PI / 2;
      medallion.castShadow = true;
      this.scene.add(medallion);
    }
  }

  private addFramedPanel(
    center: THREE.Vector3, width: number, height: number,
    side: 'back' | 'left' | 'right',
    panelMat: THREE.Material, insetMat: THREE.Material, trimMat: THREE.Material
  ): void {
    if (side === 'back') {
      addBox(this.scene, center, new THREE.Vector3(width, height, 0.06), panelMat, true, true);
      addBox(this.scene, center.clone().add(new THREE.Vector3(0, 0, 0.04)), new THREE.Vector3(width - 0.18, height - 0.22, 0.06), insetMat, false, true);
      // 上下装饰条
      addBox(this.scene, center.clone().add(new THREE.Vector3(0, height / 2, 0.07)), new THREE.Vector3(width + 0.1, 0.06, 0.08), trimMat, true, true);
      addBox(this.scene, center.clone().add(new THREE.Vector3(0, -height / 2, 0.07)), new THREE.Vector3(width + 0.1, 0.06, 0.08), trimMat, true, true);
      return;
    }
    const xOffset = side === 'left' ? 0.05 : -0.05;
    addBox(this.scene, center, new THREE.Vector3(0.06, height, width), panelMat, true, true);
    addBox(this.scene, center.clone().add(new THREE.Vector3(xOffset, 0, 0)), new THREE.Vector3(0.06, height - 0.22, width - 0.18), insetMat, false, true);
    addBox(this.scene, center.clone().add(new THREE.Vector3(xOffset, height / 2, 0)), new THREE.Vector3(0.08, 0.06, width + 0.1), trimMat, true, true);
    addBox(this.scene, center.clone().add(new THREE.Vector3(xOffset, -height / 2, 0)), new THREE.Vector3(0.08, 0.06, width + 0.1), trimMat, true, true);
  }

  private addStainedGlass(x: number, y: number, z: number, w: number, h: number): void {
    const colors = [0x7356d9, 0xf1c45f, 0x57b9d8, 0xd85f9e, 0x88bd64];
    const segMats = colors.map((c) => getStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.25, transparent: true, opacity: 0.7, roughness: 0.15 }));
    const segW = w / 5;
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Mesh(
        Geo.plane(segW * 0.95, h),
        segMats[i]
      );
      seg.position.set(x - w / 2 + segW * (i + 0.5), y, z);
      this.scene.add(seg);
    }
    // 窗框
    const frameMat = getStandardMaterial({ color: 0x5d3a59, roughness: 0.45, metalness: 0.12 });
    addBox(this.scene, new THREE.Vector3(x, y - h / 2 - 0.1, z + 0.02), new THREE.Vector3(w + 0.2, 0.15, 0.1), frameMat, true, true);
    addBox(this.scene, new THREE.Vector3(x, y + h / 2 + 0.1, z + 0.02), new THREE.Vector3(w + 0.2, 0.15, 0.1), frameMat, true, true);
    for (let i = 0; i <= 5; i++) {
      addBox(this.scene, new THREE.Vector3(x - w / 2 + segW * i, y, z + 0.02), new THREE.Vector3(0.08, h + 0.2, 0.1), frameMat, true, true);
    }
  }
}
