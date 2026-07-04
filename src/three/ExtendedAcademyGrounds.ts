import * as THREE from 'three';
import type { Obstacle } from './WorldTypes';
import { addBox, addPointLight } from './WorldHelpers';
import {
  Geo,
  MatLib,
  getStandardMaterial,
  makeSharedGrassTexture,
  makeSharedSurfaceDetailTexture,
} from './RenderResources';
import {
  addFoliageField,
  addNaturalTree,
  createLakeWaterMaterial,
  updateLakeWaterMaterial,
  type FoliageFieldSpec,
  type TreeSpec,
} from './EnvironmentDetailKit';

interface AnimatedObject {
  obj: THREE.Object3D;
  baseY: number;
  amp: number;
  speed: number;
  phase: number;
  rotateY?: number;
  rotateZ?: number;
}

/**
 * Extra explorable academy spaces.
 *
 * This layer intentionally stays procedural: it adds richer silhouettes, dense
 * props, lit hero objects and varied ground treatment without increasing the
 * asset pipeline burden.
 */
export class ExtendedAcademyGrounds {
  private readonly animatedObjects: AnimatedObject[] = [];
  private readonly waterMaterials: THREE.ShaderMaterial[] = [];
  private lastUpdateTime = -1;

  constructor(private readonly scene: THREE.Scene) {}

  build(): Obstacle[] {
    const obstacles: Obstacle[] = [];
    this.addCrystalGreenhouse(obstacles);
    this.addRunicTrainingGrounds(obstacles);
    this.addMoonstoneGrotto(obstacles);
    return obstacles;
  }

  update(elapsedTime: number, _delta: number): void {
    if (elapsedTime === this.lastUpdateTime) return;
    this.lastUpdateTime = elapsedTime;

    for (const item of this.animatedObjects) {
      item.obj.position.y = item.baseY + Math.sin(elapsedTime * item.speed + item.phase) * item.amp;
      if (item.rotateY) item.obj.rotation.y += item.rotateY;
      if (item.rotateZ) item.obj.rotation.z += item.rotateZ;
    }

    for (const material of this.waterMaterials) {
      updateLakeWaterMaterial(material, elapsedTime);
    }
  }

  private addCrystalGreenhouse(obstacles: Obstacle[]): void {
    const floorTex = makeSharedSurfaceDetailTexture('greenhouse-mosaic-floor', 5, 4);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x7d9f78,
      roughness: 0.74,
      metalness: 0.03,
      map: makeSharedGrassTexture(),
      bumpMap: floorTex,
      bumpScale: 0.016,
      roughnessMap: floorTex,
    });
    addBox(this.scene, new THREE.Vector3(-17, -0.07, 1), new THREE.Vector3(16, 0.14, 14), floorMat, false, true);

    const glassMat = getStandardMaterial({
      color: 0xbdf5e8,
      emissive: 0x4aa7bb,
      emissiveIntensity: 0.18,
      transparent: true,
      opacity: 0.34,
      roughness: 0.08,
      metalness: 0.02,
      depthWrite: false,
    });
    const frameMat = getStandardMaterial({ color: 0xb99d62, roughness: 0.28, metalness: 0.48 });
    const stoneMat = getStandardMaterial({
      color: 0x777f75,
      roughness: 0.7,
      metalness: 0.04,
      bumpMap: makeSharedSurfaceDetailTexture('greenhouse-stone', 2.2, 2.2),
      bumpScale: 0.018,
    });
    const darkSoilMat = getStandardMaterial({ color: 0x322219, roughness: 0.88, metalness: 0.02 });

    this.addGreenhouseFrames(frameMat, glassMat, obstacles);
    this.addGreenhousePlanters(stoneMat, darkSoilMat, obstacles);
    this.addGreenhousePond(obstacles);
    this.addGreenhousePlants();
    this.addCrystalCluster(-17.2, 0.35, 0.9, 0.9, 1121, 0x93e6ff, 0x5f9fff);
    this.addCrystalCluster(-22.3, 0.08, -4.5, 0.52, 1122, 0xc6a6ff, 0x8560ff);
    this.addCrystalCluster(-11.7, 0.08, 6.0, 0.58, 1123, 0xaef5c8, 0x54c979);
    this.addHangingPlanters();
    this.addSpecimenBenches(stoneMat, obstacles);

    addPointLight(this.scene, -17, 3.4, 1.2, 0x9fffe2, 1.8, 10);
    addPointLight(this.scene, -23.4, 2.2, -4.8, 0x9fdcff, 1.1, 5.8);
    addPointLight(this.scene, -10.7, 2.1, 6.0, 0xb8ffa8, 0.95, 5.2);
  }

  private addGreenhouseFrames(
    frameMat: THREE.Material,
    glassMat: THREE.Material,
    obstacles: Obstacle[]
  ): void {
    const y = 2.0;
    addBox(this.scene, new THREE.Vector3(-25.1, y, 1), new THREE.Vector3(0.34, 4, 14.3), glassMat, false, true);
    addBox(this.scene, new THREE.Vector3(-17, y, -6.1), new THREE.Vector3(16.2, 4, 0.34), glassMat, false, true);
    addBox(this.scene, new THREE.Vector3(-17, y, 8.1), new THREE.Vector3(16.2, 4, 0.34), glassMat, false, true);
    addBox(this.scene, new THREE.Vector3(-9.08, 2.75, -4.0), new THREE.Vector3(0.28, 2.5, 4.2), glassMat, false, true);
    addBox(this.scene, new THREE.Vector3(-9.08, 2.75, 4.2), new THREE.Vector3(0.28, 2.5, 4.2), glassMat, false, true);

    for (const x of [-24.9, -22.6, -20.3, -18.0, -15.7, -13.4, -11.1, -9.2]) {
      addBox(this.scene, new THREE.Vector3(x, 2.2, -6.0), new THREE.Vector3(0.08, 4.05, 0.18), frameMat, true, true);
      addBox(this.scene, new THREE.Vector3(x, 2.2, 8.0), new THREE.Vector3(0.08, 4.05, 0.18), frameMat, true, true);
      const rib = new THREE.Mesh(Geo.cylinder(0.036, 0.05, 8.5, 10), frameMat);
      rib.position.set(x, 4.12, 1);
      rib.rotation.z = Math.PI / 2;
      rib.scale.z = 1.0;
      rib.castShadow = true;
      this.scene.add(rib);
    }

    for (const z of [-5.9, -3.6, -1.3, 3.3, 5.6, 7.9]) {
      addBox(this.scene, new THREE.Vector3(-25.0, 2.2, z), new THREE.Vector3(0.18, 4.05, 0.08), frameMat, true, true);
    }

    for (const z of [-5.95, 7.95]) {
      addBox(this.scene, new THREE.Vector3(-17, 0.18, z), new THREE.Vector3(16.4, 0.36, 0.34), frameMat, true, true);
      addBox(this.scene, new THREE.Vector3(-17, 4.15, z), new THREE.Vector3(16.3, 0.18, 0.22), frameMat, true, true);
    }
    addBox(this.scene, new THREE.Vector3(-25.0, 0.18, 1), new THREE.Vector3(0.34, 0.36, 14.3), frameMat, true, true);
    addBox(this.scene, new THREE.Vector3(-25.0, 4.15, 1), new THREE.Vector3(0.22, 0.18, 14.0), frameMat, true, true);

    const arch = new THREE.Mesh(Geo.torus(1.1, 0.045, 10, 30), frameMat);
    arch.position.set(-9.0, 2.28, 0);
    arch.rotation.set(0, Math.PI / 2, 0);
    arch.castShadow = true;
    this.scene.add(arch);

    obstacles.push(
      { minX: -25.4, maxX: -24.7, minZ: -6.2, maxZ: 8.2 },
      { minX: -25.2, maxX: -8.8, minZ: -6.35, maxZ: -5.75 },
      { minX: -25.2, maxX: -8.8, minZ: 7.75, maxZ: 8.35 },
      { minX: -9.3, maxX: -8.75, minZ: -6.1, maxZ: -1.55 },
      { minX: -9.3, maxX: -8.75, minZ: 1.55, maxZ: 8.1 }
    );
  }

  private addGreenhousePlanters(
    stoneMat: THREE.Material,
    soilMat: THREE.Material,
    obstacles: Obstacle[]
  ): void {
    const beds: Array<[number, number, number, number]> = [
      [-22.3, -2.9, 3.4, 1.0],
      [-21.8, 4.2, 3.0, 1.0],
      [-13.0, -4.0, 3.1, 1.0],
      [-12.0, 4.5, 2.7, 0.9],
      [-17.0, 6.6, 5.4, 0.72],
    ];

    for (const [x, z, w, d] of beds) {
      addBox(this.scene, new THREE.Vector3(x, 0.23, z), new THREE.Vector3(w, 0.46, d), stoneMat, true, true);
      addBox(this.scene, new THREE.Vector3(x, 0.49, z), new THREE.Vector3(w - 0.24, 0.08, d - 0.18), soilMat, false, true);
      this.addPlanterFlowers(x, z, w, d);
      obstacles.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    }
  }

  private addPlanterFlowers(x: number, z: number, width: number, depth: number): void {
    const stemMat = getStandardMaterial({ color: 0x4f8b3e, roughness: 0.78 });
    const flowerMats = [0x8fffb3, 0xd7a6ff, 0xffd27a, 0xff7aa8, 0x8bdcff]
      .map((c) => getStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.12, roughness: 0.5 }));

    const stemMatrices: THREE.Matrix4[] = [];
    const flowerMatricesByMaterial = flowerMats.map((): THREE.Matrix4[] => []);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 26; i += 1) {
      const px = x + (seeded(i * 31 + x * 13) - 0.5) * (width - 0.55);
      const pz = z + (seeded(i * 41 + z * 17) - 0.5) * (depth - 0.35);
      const stemHeight = 0.18 + seeded(i * 47) * 0.22;
      dummy.position.set(px, 0.54 + stemHeight / 2, pz);
      dummy.rotation.set((seeded(i * 53) - 0.5) * 0.22, 0, (seeded(i * 59) - 0.5) * 0.22);
      dummy.scale.set(1, stemHeight, 1);
      dummy.updateMatrix();
      stemMatrices.push(dummy.matrix.clone());

      const flowerRadius = 0.035 + seeded(i * 61) * 0.025;
      dummy.position.set(px, 0.56 + stemHeight, pz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(flowerRadius);
      dummy.updateMatrix();
      flowerMatricesByMaterial[i % flowerMats.length].push(dummy.matrix.clone());
    }

    this.addInstancedStaticMesh(Geo.cylinder(0.01, 0.013, 1, 5), stemMat, stemMatrices, true, false);
    flowerMatricesByMaterial.forEach((matrices, index) => {
      this.addInstancedStaticMesh(Geo.sphere(1, 8, 6), flowerMats[index], matrices, true, false);
    });
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

  private addGreenhousePond(obstacles: Obstacle[]): void {
    const rimMat = getStandardMaterial({ color: 0x829089, roughness: 0.72, metalness: 0.04 });
    const waterMat = createLakeWaterMaterial(0x0d4759, 0x7fe2d6, 0xe5ffff);
    this.waterMaterials.push(waterMat);

    const rim = new THREE.Mesh(Geo.cylinder(1.55, 1.75, 0.22, 42), rimMat);
    rim.position.set(-18.4, 0.08, -4.2);
    rim.scale.set(1.35, 1, 0.74);
    rim.castShadow = true;
    rim.receiveShadow = true;
    this.scene.add(rim);

    const water = new THREE.Mesh(Geo.circle(1.42, 42), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.scale.set(1.35, 0.74, 1);
    water.position.set(-18.4, 0.215, -4.2);
    this.scene.add(water);
    obstacles.push({ minX: -20.25, maxX: -16.55, minZ: -5.35, maxZ: -3.05 });
  }

  private addGreenhousePlants(): void {
    const trees: TreeSpec[] = [
      { x: -23.4, z: 5.9, scale: 0.6, seed: 1201, variant: 'willow', rotation: 0.4 },
      { x: -15.0, z: 5.7, scale: 0.58, seed: 1202, variant: 'maple', rotation: -0.2 },
      { x: -22.7, z: -4.8, scale: 0.48, seed: 1203, variant: 'oak', rotation: 0.9 },
      { x: -10.8, z: -4.8, scale: 0.52, seed: 1204, variant: 'willow', rotation: -0.5 },
    ];
    for (const tree of trees) {
      const group = addNaturalTree(this.scene, tree);
      this.animatedObjects.push({ obj: group, baseY: 0, amp: 0.004, speed: 0.42, phase: tree.seed * 0.1, rotateY: 0.0009 });
    }

    const fields: FoliageFieldSpec[] = [
      { x: -17.5, z: 1.1, width: 11.4, depth: 8.8, count: 780, seed: 1301, heightMin: 0.06, heightMax: 0.26, colors: [0x35743d, 0x6fb460, 0x9fdc7e] },
      { x: -23.5, z: 0.0, width: 2.5, depth: 10.4, count: 260, seed: 1302, heightMin: 0.18, heightMax: 0.58, colors: [0x386d47, 0x6c9f58, 0xb3c97b] },
      { x: -10.8, z: 1.2, width: 1.8, depth: 8.6, count: 180, seed: 1303, heightMin: 0.16, heightMax: 0.45, colors: [0x437e4e, 0x7dbb70, 0xa8dc8c] },
    ];
    for (const field of fields) {
      addFoliageField(this.scene, field, (x, z) => this.isInsideGreenhouseFeature(x, z));
    }
  }

  private addHangingPlanters(): void {
    const chainMat = MatLib.goldFrame;
    const potMat = getStandardMaterial({ color: 0x8a5a45, roughness: 0.7, metalness: 0.04 });
    const vineMat = getStandardMaterial({ color: 0x5ba66a, roughness: 0.76 });
    for (let i = 0; i < 8; i += 1) {
      const x = -23 + i * 1.7;
      const z = i % 2 === 0 ? -4.8 : 6.4;
      const group = new THREE.Group();
      const chain = new THREE.Mesh(Geo.cylinder(0.012, 0.012, 0.72, 6), chainMat);
      chain.position.y = 0.35;
      group.add(chain);
      const pot = new THREE.Mesh(Geo.cylinder(0.16, 0.22, 0.22, 12), potMat);
      pot.position.y = -0.12;
      pot.castShadow = true;
      group.add(pot);
      for (let v = 0; v < 5; v += 1) {
        const vine = new THREE.Mesh(Geo.box(0.018, 0.42 + seeded(i * 97 + v) * 0.32, 0.018), vineMat);
        vine.position.set((seeded(i * 17 + v) - 0.5) * 0.28, -0.36, (seeded(i * 23 + v) - 0.5) * 0.28);
        vine.rotation.set((seeded(i * 31 + v) - 0.5) * 0.32, seeded(i * 37 + v) * Math.PI, (seeded(i * 41 + v) - 0.5) * 0.32);
        group.add(vine);
      }
      group.position.set(x, 3.55, z);
      this.scene.add(group);
      this.animatedObjects.push({ obj: group, baseY: 3.55, amp: 0.04, speed: 0.75 + i * 0.04, phase: i, rotateY: 0.0016 });
    }
  }

  private addSpecimenBenches(stoneMat: THREE.Material, obstacles: Obstacle[]): void {
    const woodMat = getStandardMaterial({
      color: 0x68422f,
      roughness: 0.62,
      metalness: 0.04,
      bumpMap: makeSharedSurfaceDetailTexture('greenhouse-specimen-wood', 2, 2),
      bumpScale: 0.015,
    });
    const vialMats = [0x7fe2ff, 0xb78dff, 0x9ff08d].map((c) => getStandardMaterial({
      color: c,
      emissive: c,
      emissiveIntensity: 0.42,
      transparent: true,
      opacity: 0.7,
      roughness: 0.1,
    }));

    for (const [x, z, rot] of [
      [-13.2, 1.3, Math.PI / 2],
      [-20.8, 1.5, -Math.PI / 2],
    ] as Array<[number, number, number]>) {
      const table = new THREE.Group();
      addBoxToObject(table, new THREE.Vector3(0, 0.78, 0), new THREE.Vector3(2.4, 0.12, 0.72), woodMat, true, true);
      for (const sx of [-0.96, 0.96]) {
        for (const sz of [-0.25, 0.25]) {
          addBoxToObject(table, new THREE.Vector3(sx, 0.38, sz), new THREE.Vector3(0.1, 0.76, 0.1), stoneMat, true, true);
        }
      }
      for (let i = 0; i < 5; i += 1) {
        const vial = new THREE.Mesh(Geo.cylinder(0.04, 0.055, 0.2, 12), vialMats[i % vialMats.length]);
        vial.position.set(-0.78 + i * 0.38, 0.96, (i % 2 === 0 ? -0.16 : 0.18));
        vial.castShadow = true;
        table.add(vial);
      }
      table.position.set(x, 0, z);
      table.rotation.y = rot;
      this.scene.add(table);
      obstacles.push({ minX: x - 0.54, maxX: x + 0.54, minZ: z - 1.35, maxZ: z + 1.35 });
    }
  }

  private addRunicTrainingGrounds(obstacles: Obstacle[]): void {
    const groundDetail = makeSharedSurfaceDetailTexture('training-packed-clay', 7, 5);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x8d765f,
      roughness: 0.86,
      metalness: 0.02,
      bumpMap: groundDetail,
      bumpScale: 0.022,
      roughnessMap: groundDetail,
    });
    addBox(this.scene, new THREE.Vector3(17, -0.08, 31), new THREE.Vector3(20, 0.16, 18), groundMat, false, true);
    this.addTrainingWalls(obstacles);
    this.addTrainingArena(obstacles);
    this.addSpellTargets(obstacles);
    this.addWeaponRacks(obstacles);
    this.addTrainingWatchtower(obstacles);
    this.addTrainingVegetation();

    addPointLight(this.scene, 17, 2.8, 31, 0xffb65c, 1.5, 13);
    addPointLight(this.scene, 9.0, 2.4, 38.0, 0x8fc7ff, 0.95, 6);
    addPointLight(this.scene, 25.4, 2.4, 24.2, 0xffd674, 1.0, 6);
  }

  private addTrainingWalls(obstacles: Obstacle[]): void {
    const wallMat = getStandardMaterial({
      color: 0x75675b,
      roughness: 0.72,
      metalness: 0.04,
      bumpMap: makeSharedSurfaceDetailTexture('training-wall-stone', 3, 2),
      bumpScale: 0.025,
    });
    const trimMat = getStandardMaterial({ color: 0xae8b52, roughness: 0.34, metalness: 0.42 });

    addBox(this.scene, new THREE.Vector3(6.8, 0.75, 31), new THREE.Vector3(0.45, 1.5, 17.4), wallMat, true, true);
    addBox(this.scene, new THREE.Vector3(27.2, 0.75, 31), new THREE.Vector3(0.45, 1.5, 17.4), wallMat, true, true);
    addBox(this.scene, new THREE.Vector3(17, 0.75, 40.2), new THREE.Vector3(20.6, 1.5, 0.45), wallMat, true, true);
    addBox(this.scene, new THREE.Vector3(10.0, 0.55, 22.0), new THREE.Vector3(5.8, 1.1, 0.35), wallMat, true, true);
    addBox(this.scene, new THREE.Vector3(24.2, 0.55, 22.0), new THREE.Vector3(6.2, 1.1, 0.35), wallMat, true, true);

    for (const [x, z] of [
      [6.8, 22.0], [6.8, 40.0], [27.2, 22.0], [27.2, 40.0],
      [12, 40.0], [17, 40.0], [22, 40.0],
    ] as Array<[number, number]>) {
      const post = new THREE.Mesh(Geo.cylinder(0.22, 0.28, 2.1, 16), wallMat);
      post.position.set(x, 1.05, z);
      post.castShadow = true;
      post.receiveShadow = true;
      this.scene.add(post);
      const brazier = new THREE.Mesh(Geo.octahedron(0.16, 1), MatLib.warmLight);
      brazier.position.set(x, 2.22, z);
      this.scene.add(brazier);
      this.animatedObjects.push({ obj: brazier, baseY: 2.22, amp: 0.035, speed: 1.5, phase: x + z, rotateY: 0.006 });
      addPointLight(this.scene, x, 2.1, z, 0xffb45f, 0.72, 4.6);
    }

    for (const z of [25.0, 29.0, 33.0, 37.0]) {
      addBox(this.scene, new THREE.Vector3(6.96, 1.58, z), new THREE.Vector3(0.16, 0.12, 1.4), trimMat, true, true);
      addBox(this.scene, new THREE.Vector3(27.04, 1.58, z), new THREE.Vector3(0.16, 0.12, 1.4), trimMat, true, true);
    }

    obstacles.push(
      { minX: 6.55, maxX: 7.1, minZ: 22, maxZ: 40.2 },
      { minX: 26.9, maxX: 27.45, minZ: 22, maxZ: 40.2 },
      { minX: 6.8, maxX: 27.2, minZ: 39.9, maxZ: 40.5 },
      { minX: 7.0, maxX: 12.9, minZ: 21.75, maxZ: 22.25 },
      { minX: 21.0, maxX: 27.3, minZ: 21.75, maxZ: 22.25 }
    );
  }

  private addTrainingArena(obstacles: Obstacle[]): void {
    const ringMat = getStandardMaterial({
      color: 0xd7bd74,
      emissive: 0xffd674,
      emissiveIntensity: 0.2,
      roughness: 0.32,
      metalness: 0.46,
    });
    const innerMat = getStandardMaterial({
      color: 0x5a4f48,
      roughness: 0.82,
      metalness: 0.03,
      bumpMap: makeSharedSurfaceDetailTexture('training-ring-scuffed', 4, 4),
      bumpScale: 0.018,
    });

    const inner = new THREE.Mesh(Geo.cylinder(4.1, 4.25, 0.08, 72), innerMat);
    inner.position.set(17, 0.02, 31);
    inner.receiveShadow = true;
    this.scene.add(inner);

    for (const radius of [4.35, 3.05, 1.8]) {
      const ring = new THREE.Mesh(Geo.torus(radius, 0.026, 8, 96), ringMat);
      ring.position.set(17, 0.095, 31);
      ring.rotation.x = Math.PI / 2;
      ring.receiveShadow = true;
      this.scene.add(ring);
    }

    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      const rune = new THREE.Mesh(Geo.box(0.08, 0.026, 0.7), ringMat);
      rune.position.set(17 + Math.cos(angle) * 3.55, 0.12, 31 + Math.sin(angle) * 3.55);
      rune.rotation.y = -angle;
      rune.receiveShadow = true;
      this.scene.add(rune);
    }

    const core = new THREE.Mesh(Geo.octahedron(0.42, 1), getStandardMaterial({
      color: 0x9fdcff,
      emissive: 0x4f8cff,
      emissiveIntensity: 1.6,
      transparent: true,
      opacity: 0.86,
      roughness: 0.18,
    }));
    core.position.set(17, 1.25, 31);
    this.scene.add(core);
    this.animatedObjects.push({ obj: core, baseY: 1.25, amp: 0.18, speed: 1.2, phase: 0, rotateY: 0.012 });
    addPointLight(this.scene, 17, 1.4, 31, 0x8fc7ff, 2.0, 7.5);

    obstacles.push({ minX: 16.58, maxX: 17.42, minZ: 30.58, maxZ: 31.42 });
  }

  private addSpellTargets(obstacles: Obstacle[]): void {
    const woodMat = getStandardMaterial({
      color: 0x5d3928,
      roughness: 0.68,
      metalness: 0.04,
      bumpMap: makeSharedSurfaceDetailTexture('training-target-wood', 1.5, 2),
      bumpScale: 0.018,
    });
    const targetMat = getStandardMaterial({ color: 0xcfc3a3, roughness: 0.62, metalness: 0.02 });
    const redMat = getStandardMaterial({ color: 0xb64f3f, roughness: 0.54 });
    const blueMat = getStandardMaterial({ color: 0x4b8cc8, roughness: 0.48, emissive: 0x255f9f, emissiveIntensity: 0.08 });

    for (const [x, z, rot] of [
      [10.2, 27.2, 0.35],
      [23.8, 27.2, -0.35],
      [10.8, 35.8, -0.2],
      [23.0, 36.2, 0.25],
    ] as Array<[number, number, number]>) {
      const group = new THREE.Group();
      const post = new THREE.Mesh(Geo.box(0.16, 1.5, 0.16), woodMat);
      post.position.y = 0.75;
      post.castShadow = true;
      group.add(post);
      const target = new THREE.Mesh(Geo.cylinder(0.62, 0.62, 0.06, 36), targetMat);
      target.position.y = 1.62;
      target.rotation.x = Math.PI / 2;
      target.castShadow = true;
      group.add(target);
      const stripeA = new THREE.Mesh(Geo.torus(0.42, 0.024, 8, 42), redMat);
      stripeA.position.set(0, 1.625, 0.04);
      stripeA.rotation.x = Math.PI / 2;
      group.add(stripeA);
      const stripeB = new THREE.Mesh(Geo.torus(0.21, 0.024, 8, 36), blueMat);
      stripeB.position.set(0, 1.63, 0.05);
      stripeB.rotation.x = Math.PI / 2;
      group.add(stripeB);
      group.position.set(x, 0, z);
      group.rotation.y = rot;
      this.scene.add(group);
      obstacles.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    }

    for (let i = 0; i < 18; i += 1) {
      const bolt = new THREE.Mesh(Geo.sphere(0.035, 6, 4), MatLib.crystal);
      bolt.position.set(9.5 + seeded(i * 11) * 15, 0.6 + seeded(i * 17) * 1.8, 24.8 + seeded(i * 23) * 12.6);
      this.scene.add(bolt);
      this.animatedObjects.push({ obj: bolt, baseY: bolt.position.y, amp: 0.1 + seeded(i * 29) * 0.16, speed: 1.3 + seeded(i * 31), phase: i, rotateY: 0.01 });
    }
  }

  private addWeaponRacks(obstacles: Obstacle[]): void {
    const woodMat = getStandardMaterial({ color: 0x553523, roughness: 0.68, metalness: 0.04 });
    const metalMat = getStandardMaterial({ color: 0xa8a7a0, roughness: 0.34, metalness: 0.62 });
    const bannerMats = [0x6940b6, 0xc75656, 0xd4a34f].map((c) => getStandardMaterial({ color: c, roughness: 0.72 }));

    for (const [x, z, rot] of [
      [8.3, 24.5, Math.PI / 2],
      [25.6, 33.5, -Math.PI / 2],
    ] as Array<[number, number, number]>) {
      const rack = new THREE.Group();
      addBoxToObject(rack, new THREE.Vector3(0, 0.7, 0), new THREE.Vector3(1.5, 0.12, 0.12), woodMat, true, true);
      addBoxToObject(rack, new THREE.Vector3(0, 1.24, 0), new THREE.Vector3(1.5, 0.12, 0.12), woodMat, true, true);
      for (const sx of [-0.65, 0.65]) {
        addBoxToObject(rack, new THREE.Vector3(sx, 0.72, 0), new THREE.Vector3(0.1, 1.42, 0.1), woodMat, true, true);
      }
      for (let i = 0; i < 5; i += 1) {
        const staff = new THREE.Mesh(Geo.cylinder(0.018, 0.022, 1.65, 8), metalMat);
        staff.position.set(-0.48 + i * 0.24, 0.86, -0.03);
        staff.rotation.z = -0.16 + i * 0.08;
        staff.castShadow = true;
        rack.add(staff);
        const gem = new THREE.Mesh(Geo.octahedron(0.07, 0), i % 2 === 0 ? MatLib.crystal : MatLib.warmLight);
        gem.position.set(-0.48 + i * 0.24, 1.7, -0.03);
        rack.add(gem);
      }
      rack.position.set(x, 0, z);
      rack.rotation.y = rot;
      this.scene.add(rack);
      obstacles.push({ minX: x - 0.38, maxX: x + 0.38, minZ: z - 0.92, maxZ: z + 0.92 });
    }

    for (let i = 0; i < 7; i += 1) {
      const banner = new THREE.Mesh(Geo.plane(0.62, 1.25), bannerMats[i % bannerMats.length]);
      const onLeft = i < 3;
      banner.position.set(onLeft ? 6.98 : 27.02, 1.85, 26 + (i % 4) * 3.2);
      banner.rotation.y = onLeft ? Math.PI / 2 : -Math.PI / 2;
      banner.castShadow = true;
      this.scene.add(banner);
    }
  }

  private addTrainingWatchtower(obstacles: Obstacle[]): void {
    const woodMat = getStandardMaterial({
      color: 0x60402c,
      roughness: 0.64,
      metalness: 0.04,
      bumpMap: makeSharedSurfaceDetailTexture('training-watchtower-wood', 1.5, 2),
      bumpScale: 0.014,
    });
    const roofMat = getStandardMaterial({ color: 0x4f3b60, roughness: 0.66, metalness: 0.04 });
    const group = new THREE.Group();
    for (const [x, z] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]] as Array<[number, number]>) {
      addBoxToObject(group, new THREE.Vector3(x, 1.0, z), new THREE.Vector3(0.12, 2.0, 0.12), woodMat, true, true);
    }
    addBoxToObject(group, new THREE.Vector3(0, 2.0, 0), new THREE.Vector3(1.55, 0.16, 1.55), woodMat, true, true);
    addBoxToObject(group, new THREE.Vector3(0, 2.35, -0.68), new THREE.Vector3(1.55, 0.46, 0.1), woodMat, true, true);
    addBoxToObject(group, new THREE.Vector3(-0.68, 2.35, 0), new THREE.Vector3(0.1, 0.46, 1.55), woodMat, true, true);
    addBoxToObject(group, new THREE.Vector3(0.68, 2.35, 0), new THREE.Vector3(0.1, 0.46, 1.55), woodMat, true, true);
    const roof = new THREE.Mesh(Geo.cone(1.18, 0.72, 4), roofMat);
    roof.position.y = 2.9;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
    const lamp = new THREE.Mesh(Geo.octahedron(0.14, 1), MatLib.warmLight);
    lamp.position.set(0, 2.55, 0.02);
    group.add(lamp);
    group.position.set(9.1, 0, 38.0);
    group.rotation.y = -0.45;
    this.scene.add(group);
    addPointLight(this.scene, 9.1, 2.55, 38.0, 0xffd08a, 1.0, 5.5);
    obstacles.push({ minX: 8.2, maxX: 10.0, minZ: 37.1, maxZ: 38.9 });
  }

  private addTrainingVegetation(): void {
    const fields: FoliageFieldSpec[] = [
      { x: 17, z: 23.1, width: 17, depth: 1.8, count: 260, seed: 2201, heightMin: 0.1, heightMax: 0.32, colors: [0x486a35, 0x758048, 0x9e8f54] },
      { x: 25.6, z: 31.2, width: 1.6, depth: 13.8, count: 280, seed: 2202, heightMin: 0.12, heightMax: 0.38, colors: [0x405d34, 0x6d7d41, 0x9a8750] },
      { x: 8.4, z: 31.4, width: 1.5, depth: 13.2, count: 240, seed: 2203, heightMin: 0.12, heightMax: 0.34, colors: [0x405f32, 0x708746, 0xa09458] },
    ];
    for (const field of fields) {
      addFoliageField(this.scene, field, (x, z) => Math.hypot(x - 17, z - 31) < 4.8);
    }
  }

  private addMoonstoneGrotto(obstacles: Obstacle[]): void {
    const groundDetail = makeSharedSurfaceDetailTexture('grotto-wet-rock', 5, 6);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x4b5260,
      roughness: 0.82,
      metalness: 0.06,
      bumpMap: groundDetail,
      bumpScale: 0.035,
      roughnessMap: groundDetail,
    });
    const dampMat = getStandardMaterial({
      color: 0x303946,
      roughness: 0.9,
      metalness: 0.04,
      bumpMap: groundDetail,
      bumpScale: 0.04,
    });
    addBox(this.scene, new THREE.Vector3(-34, -0.1, 21.5), new THREE.Vector3(16, 0.2, 19), dampMat, false, true);
    this.addGrottoRim(rockMat, obstacles);
    this.addGrottoPools(obstacles);
    this.addGrottoCrystals();
    this.addGrottoRuins(obstacles);
    this.addGrottoMist();

    addPointLight(this.scene, -34.4, 2.6, 21.0, 0x8fc7ff, 2.2, 13);
    addPointLight(this.scene, -40.2, 1.4, 28.0, 0xcaa8ff, 1.0, 6.5);
    addPointLight(this.scene, -27.8, 1.2, 16.8, 0x7fffe0, 0.9, 6.0);
  }

  private addGrottoRim(rockMat: THREE.Material, obstacles: Obstacle[]): void {
    const cliffSpecs: Array<[number, number, number, number, number]> = [
      [-42.1, 21.5, 0.65, 19.2, 2.7],
      [-34.0, 12.0, 16.3, 0.65, 2.4],
      [-34.0, 31.2, 16.3, 0.65, 2.6],
      [-26.0, 27.0, 0.55, 8.0, 2.2],
      [-26.0, 13.5, 0.55, 3.2, 2.0],
    ];
    for (const [x, z, w, d, h] of cliffSpecs) {
      addBox(this.scene, new THREE.Vector3(x, h / 2 - 0.02, z), new THREE.Vector3(w, h, d), rockMat, true, true);
    }

    const boulders = [
      [-40.2, 15.4, 1.1], [-39.4, 29.0, 0.9], [-33.5, 30.2, 0.78],
      [-28.6, 29.2, 0.7], [-27.0, 23.2, 0.82], [-36.8, 13.0, 0.86],
      [-31.2, 13.2, 0.64], [-41.2, 24.8, 0.72],
    ] as Array<[number, number, number]>;
    for (let i = 0; i < boulders.length; i += 1) {
      const [x, z, scale] = boulders[i];
      const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rockMat);
      boulder.scale.set(scale * (1.0 + seeded(i * 7) * 0.5), scale * (0.42 + seeded(i * 11) * 0.28), scale * (0.8 + seeded(i * 13) * 0.35));
      boulder.rotation.set(seeded(i * 17) * Math.PI, seeded(i * 19) * Math.PI, seeded(i * 23) * Math.PI);
      boulder.position.set(x, 0.25 + scale * 0.12, z);
      boulder.castShadow = true;
      boulder.receiveShadow = true;
      this.scene.add(boulder);
      obstacles.push({ minX: x - scale * 0.72, maxX: x + scale * 0.72, minZ: z - scale * 0.72, maxZ: z + scale * 0.72 });
    }

    obstacles.push(
      { minX: -42.5, maxX: -41.75, minZ: 12, maxZ: 31.2 },
      { minX: -42, maxX: -26, minZ: 11.65, maxZ: 12.35 },
      { minX: -42, maxX: -26, minZ: 30.85, maxZ: 31.55 },
      { minX: -26.35, maxX: -25.75, minZ: 22.6, maxZ: 31.2 },
      { minX: -26.35, maxX: -25.75, minZ: 12, maxZ: 14.9 }
    );
  }

  private addGrottoPools(obstacles: Obstacle[]): void {
    const waterMat = createLakeWaterMaterial(0x062c43, 0x3aaeb2, 0xd9ffff);
    this.waterMaterials.push(waterMat);
    for (const [x, z, sx, sz] of [
      [-34.8, 20.6, 3.9, 2.1],
      [-38.5, 26.0, 2.2, 1.25],
      [-29.2, 17.0, 2.1, 1.2],
    ] as Array<[number, number, number, number]>) {
      const pool = new THREE.Mesh(Geo.circle(1, 46), waterMat);
      pool.rotation.x = -Math.PI / 2;
      pool.scale.set(sx, sz, 1);
      pool.position.set(x, 0.035, z);
      this.scene.add(pool);
      obstacles.push({ minX: x - sx * 0.8, maxX: x + sx * 0.8, minZ: z - sz * 0.8, maxZ: z + sz * 0.8 });
    }

    const fallMat = getStandardMaterial({
      color: 0xa6f4ff,
      emissive: 0x68cfff,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.42,
      roughness: 0.08,
      depthWrite: false,
    });
    for (let i = 0; i < 5; i += 1) {
      const fall = new THREE.Mesh(Geo.plane(0.22 + i * 0.035, 2.9 + seeded(i * 11) * 0.7), fallMat);
      fall.position.set(-41.72, 1.5, 18.8 + i * 0.28);
      fall.rotation.y = Math.PI / 2 + (seeded(i * 19) - 0.5) * 0.08;
      this.scene.add(fall);
      this.animatedObjects.push({ obj: fall, baseY: 1.5, amp: 0.05, speed: 2.4 + i * 0.2, phase: i * 0.7 });
    }
  }

  private addGrottoCrystals(): void {
    const clusters: Array<[number, number, number, number, number, number]> = [
      [-39.8, 0.05, 15.6, 0.7, 3001, 0x9fdcff],
      [-40.2, 0.05, 28.0, 0.9, 3002, 0xc6a6ff],
      [-31.2, 0.05, 28.5, 0.68, 3003, 0x8fffe0],
      [-27.7, 0.05, 16.2, 0.72, 3004, 0x94b6ff],
      [-35.4, 0.05, 24.8, 0.52, 3005, 0xffe6a2],
    ];
    for (const [x, y, z, scale, seed, color] of clusters) {
      this.addCrystalCluster(x, y, z, scale, seed, color, color);
    }
  }

  private addGrottoRuins(obstacles: Obstacle[]): void {
    const stoneMat = getStandardMaterial({
      color: 0x697079,
      roughness: 0.76,
      metalness: 0.04,
      bumpMap: makeSharedSurfaceDetailTexture('grotto-ruin-stone', 2, 2),
      bumpScale: 0.02,
    });
    const runeMat = getStandardMaterial({
      color: 0x8fc7ff,
      emissive: 0x4f8cff,
      emissiveIntensity: 0.72,
      roughness: 0.28,
      metalness: 0.18,
    });
    const centerX = -33.2;
    const centerZ = 26.7;
    for (let i = 0; i < 7; i += 1) {
      const angle = (i / 7) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * 2.3;
      const z = centerZ + Math.sin(angle) * 1.55;
      const height = 0.85 + seeded(i * 11) * 1.15;
      const pillar = new THREE.Mesh(Geo.cylinder(0.18, 0.24, height, 14), stoneMat);
      pillar.position.set(x, height / 2, z);
      pillar.rotation.z = (seeded(i * 17) - 0.5) * 0.18;
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.scene.add(pillar);
      const rune = new THREE.Mesh(Geo.box(0.04, 0.18, 0.024), runeMat);
      rune.position.set(x + Math.cos(angle) * 0.19, Math.min(height - 0.12, 1.25), z + Math.sin(angle) * 0.19);
      rune.rotation.y = -angle;
      this.scene.add(rune);
      obstacles.push({ minX: x - 0.26, maxX: x + 0.26, minZ: z - 0.26, maxZ: z + 0.26 });
    }
  }

  private addGrottoMist(): void {
    const mistMat = new THREE.MeshBasicMaterial({ color: 0xc7e8ff, transparent: true, opacity: 0.12, depthWrite: false });
    for (let i = 0; i < 28; i += 1) {
      const mist = new THREE.Mesh(Geo.circle(0.6 + seeded(i * 7) * 1.2, 18), mistMat);
      mist.rotation.x = -Math.PI / 2;
      mist.scale.set(1.8 + seeded(i * 11) * 2.6, 0.5 + seeded(i * 13) * 0.8, 1);
      mist.position.set(-41 + seeded(i * 17) * 14.2, 0.07 + i * 0.0004, 13.4 + seeded(i * 19) * 16.2);
      this.scene.add(mist);
      this.animatedObjects.push({ obj: mist, baseY: mist.position.y, amp: 0.012, speed: 0.35 + seeded(i * 23) * 0.45, phase: i, rotateZ: 0.0009 + seeded(i * 29) * 0.0008 });
    }
  }

  private addCrystalCluster(
    x: number,
    y: number,
    z: number,
    scale: number,
    seed: number,
    color: number,
    lightColor: number
  ): void {
    const mat = getStandardMaterial({
      color,
      emissive: lightColor,
      emissiveIntensity: 0.72,
      transparent: true,
      opacity: 0.82,
      roughness: 0.12,
      metalness: 0.05,
    });
    for (let i = 0; i < 9; i += 1) {
      const rand = seeded(seed + i * 29);
      const angle = seeded(seed + i * 31) * Math.PI * 2;
      const r = seeded(seed + i * 37) * 0.58 * scale;
      const crystal = new THREE.Mesh(Geo.octahedron(0.22 + rand * 0.18, 0), mat);
      crystal.position.set(x + Math.cos(angle) * r, y + 0.2 + seeded(seed + i * 41) * 0.35 * scale, z + Math.sin(angle) * r);
      crystal.scale.set(0.52 + seeded(seed + i * 43) * 0.48, 1.15 + seeded(seed + i * 47) * 1.6, 0.52 + seeded(seed + i * 53) * 0.4);
      crystal.rotation.set((seeded(seed + i * 59) - 0.5) * 0.42, angle, (seeded(seed + i * 61) - 0.5) * 0.42);
      crystal.castShadow = true;
      this.scene.add(crystal);
      this.animatedObjects.push({ obj: crystal, baseY: crystal.position.y, amp: 0.012 + seeded(seed + i * 67) * 0.018, speed: 0.7 + seeded(seed + i * 71) * 0.7, phase: seed * 0.01 + i, rotateY: 0.0018 });
    }
    addPointLight(this.scene, x, y + 0.9 * scale, z, lightColor, 0.8 + scale * 0.52, 4.5 + scale * 3.0);
  }

  private isInsideGreenhouseFeature(x: number, z: number): boolean {
    if (Math.hypot((x + 18.4) / 1.85, (z + 4.2) / 1.15) < 1) return true;
    const beds: Array<[number, number, number, number]> = [
      [-22.3, -2.9, 3.8, 1.4],
      [-21.8, 4.2, 3.4, 1.4],
      [-13.0, -4.0, 3.5, 1.4],
      [-12.0, 4.5, 3.1, 1.3],
      [-17.0, 6.6, 5.8, 1.1],
      [-13.2, 1.3, 1.2, 2.9],
      [-20.8, 1.5, 1.2, 2.9],
    ];
    return beds.some(([bx, bz, w, d]) => Math.abs(x - bx) < w / 2 && Math.abs(z - bz) < d / 2);
  }
}

function seeded(seed: number): number {
  let value = (Math.floor(seed) >>> 0) + 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function addBoxToObject(
  parent: THREE.Object3D,
  position: THREE.Vector3,
  scale: THREE.Vector3,
  material: THREE.Material,
  castShadow: boolean,
  receiveShadow: boolean
): THREE.Mesh {
  const mesh = new THREE.Mesh(Geo.box(1, 1, 1), material);
  mesh.position.copy(position);
  mesh.scale.copy(scale);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  parent.add(mesh);
  return mesh;
}
