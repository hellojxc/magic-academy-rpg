import * as THREE from 'three';
import type { Obstacle } from './WorldTypes';
import { addPointLight } from './WorldHelpers';
import {
  Geo,
  MatLib,
  getStandardMaterial,
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
}

interface TerrainSample {
  height: number;
  color: THREE.Color;
}

const TERRAIN_MIN_X = -26;
const TERRAIN_MAX_X = 16;
const TERRAIN_MIN_Z = 7;
const TERRAIN_MAX_Z = 29;
const LAKE_CENTER_X = -15;
const LAKE_CENTER_Z = 19;
const GRASS = new THREE.Color(0x4f8b3a);
const DARK_GRASS = new THREE.Color(0x2f5f2f);
const WARM_GRASS = new THREE.Color(0x7d9a4e);
const SHORE = new THREE.Color(0xb69a62);
const DAMP_SHORE = new THREE.Color(0x756d4b);
const PATH = new THREE.Color(0x8f8575);
const LAKEBED = new THREE.Color(0x263746);

export class LawnLakeEnvironment {
  private readonly animatedObjects: AnimatedObject[] = [];
  private readonly waterMaterials: THREE.ShaderMaterial[] = [];
  private lastUpdateTime = -1;

  constructor(private readonly scene: THREE.Scene) {}

  build(): Obstacle[] {
    const obstacles: Obstacle[] = [];
    this.addTerrain();
    this.addLakeWater();
    this.addMeadowDecals();
    this.addStonePaths();
    this.addMeadowGrass();
    this.addShorelineDetails();
    this.addDock();
    this.addFountainAndBeds(obstacles);
    this.addTrees(obstacles);
    this.addBenchesAndLights();
    this.addFireflies();
    return obstacles;
  }

  update(elapsedTime: number, delta: number): void {
    if (elapsedTime === this.lastUpdateTime) return;
    this.lastUpdateTime = elapsedTime;

    const frameScale = delta * 60;
    for (const item of this.animatedObjects) {
      item.obj.position.y = item.baseY + Math.sin(elapsedTime * item.speed + item.phase) * item.amp;
      if (item.rotateY) item.obj.rotation.y += item.rotateY * frameScale;
    }

    for (const material of this.waterMaterials) {
      updateLakeWaterMaterial(material, elapsedTime);
    }
  }

  private addTerrain(): void {
    const width = TERRAIN_MAX_X - TERRAIN_MIN_X;
    const depth = TERRAIN_MAX_Z - TERRAIN_MIN_Z;
    const segmentsX = 112;
    const segmentsZ = 68;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    for (let zIndex = 0; zIndex <= segmentsZ; zIndex += 1) {
      const z = TERRAIN_MIN_Z + (zIndex / segmentsZ) * depth;
      for (let xIndex = 0; xIndex <= segmentsX; xIndex += 1) {
        const x = TERRAIN_MIN_X + (xIndex / segmentsX) * width;
        const sample = this.sampleTerrain(x, z);
        positions.push(x, sample.height, z);
        colors.push(sample.color.r, sample.color.g, sample.color.b);
      }
    }

    for (let zIndex = 0; zIndex < segmentsZ; zIndex += 1) {
      for (let xIndex = 0; xIndex < segmentsX; xIndex += 1) {
        const a = zIndex * (segmentsX + 1) + xIndex;
        const b = a + 1;
        const c = a + segmentsX + 1;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const detail = makeSharedSurfaceDetailTexture('outdoor-terrain-bump', 9, 5);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.9,
      metalness: 0,
      bumpMap: detail,
      bumpScale: 0.026,
      roughnessMap: detail,
    });
    const terrain = new THREE.Mesh(geometry, material);
    terrain.name = 'lawn_lake_terrain';
    terrain.receiveShadow = true;
    this.scene.add(terrain);
  }

  private addLakeWater(): void {
    const waterMat = createLakeWaterMaterial(0x0e3650, 0x4db7bb, 0xdff9ff);
    this.waterMaterials.push(waterMat);
    const water = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(this.makeLakeOutline(12.1, 8.7, 72))), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(LAKE_CENTER_X, 0.035, LAKE_CENTER_Z);
    water.name = 'lawn_lake_water_surface';
    water.receiveShadow = true;
    this.scene.add(water);

    const deepMat = createLakeWaterMaterial(0x09283f, 0x1d6c86, 0xbcefff);
    this.waterMaterials.push(deepMat);
    const deep = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(this.makeLakeOutline(8.2, 5.5, 56))), deepMat);
    deep.rotation.x = -Math.PI / 2;
    deep.position.set(LAKE_CENTER_X, 0.018, LAKE_CENTER_Z);
    deep.receiveShadow = true;
    this.scene.add(deep);

    const shelfMat = getStandardMaterial({
      color: 0x8bc9bd,
      transparent: true,
      opacity: 0.34,
      roughness: 0.42,
      metalness: 0.02,
      depthWrite: false,
    });
    const shelfMatrices: THREE.Matrix4[] = [];
    const shelfDummy = new THREE.Object3D();
    for (let i = 0; i < 34; i += 1) {
      const angle = (i / 34) * Math.PI * 2;
      const x = LAKE_CENTER_X + Math.cos(angle) * (10.1 + Math.sin(i * 1.7) * 0.9);
      const z = LAKE_CENTER_Z + Math.sin(angle) * (7.2 + Math.cos(i * 1.3) * 0.7);
      const radius = 0.48 + (i % 5) * 0.08;
      shelfDummy.position.set(x, 0.043, z);
      shelfDummy.rotation.set(-Math.PI / 2, 0, angle * 0.7);
      shelfDummy.scale.set(radius * (2.1 + (i % 4) * 0.3), radius * (0.34 + (i % 3) * 0.08), 1);
      shelfDummy.updateMatrix();
      shelfMatrices.push(shelfDummy.matrix.clone());
    }
    this.addInstancedStaticMesh(Geo.circle(1, 18), shelfMat, shelfMatrices, false, false);
  }

  private addMeadowDecals(): void {
    const mats = [
      new THREE.MeshBasicMaterial({ color: 0x244f2a, transparent: true, opacity: 0.18, depthWrite: false }),
      new THREE.MeshBasicMaterial({ color: 0x78914c, transparent: true, opacity: 0.14, depthWrite: false }),
      new THREE.MeshBasicMaterial({ color: 0x8b7248, transparent: true, opacity: 0.18, depthWrite: false }),
      new THREE.MeshBasicMaterial({ color: 0xb29b63, transparent: true, opacity: 0.22, depthWrite: false }),
    ];

    for (const mat of mats) {
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -2;
    }

    const decalMatricesByMaterial = mats.map((): THREE.Matrix4[] => []);
    const decalDummy = new THREE.Object3D();
    for (let i = 0; i < 96; i += 1) {
      const x = TERRAIN_MIN_X + 1.2 + seeded(i * 71) * (TERRAIN_MAX_X - TERRAIN_MIN_X - 2.4);
      const z = TERRAIN_MIN_Z + 0.9 + seeded(i * 97 + 3) * (TERRAIN_MAX_Z - TERRAIN_MIN_Z - 1.8);
      if (this.isInsideLake(x, z, 0.25) || this.isPath(x, z, 0.3) || this.isNearFeature(x, z, 0.35)) continue;

      decalDummy.position.set(x, this.terrainHeight(x, z) + 0.018 + i * 0.00002, z);
      decalDummy.rotation.set(-Math.PI / 2, 0, seeded(i * 37) * Math.PI * 2);
      decalDummy.scale.set(0.5 + seeded(i * 19) * 2.2, 0.18 + seeded(i * 23) * 0.62, 1);
      decalDummy.updateMatrix();
      decalMatricesByMaterial[i % mats.length].push(decalDummy.matrix.clone());
    }

    decalMatricesByMaterial.forEach((matrices, index) => {
      this.addInstancedStaticMesh(Geo.circle(1, 18), mats[index], matrices, false, true);
    });
  }

  private addStonePaths(): void {
    const stoneMat = getStandardMaterial({
      color: 0x8f877a,
      roughness: 0.76,
      metalness: 0.02,
      bumpMap: makeSharedSurfaceDetailTexture('outdoor-path-stone', 3, 3),
      bumpScale: 0.02,
    });
    const pathStoneMatrices: THREE.Matrix4[] = [];
    this.addSteppingStoneStrip({ from: new THREE.Vector2(0, 7.2), to: new THREE.Vector2(0, 22.2), count: 12, width: 0.92 }, pathStoneMatrices);
    this.addSteppingStoneStrip({ from: new THREE.Vector2(-15.5, 18), to: new THREE.Vector2(-1.8, 18), count: 10, width: 0.82 }, pathStoneMatrices);
    this.addSteppingStoneStrip({ from: new THREE.Vector2(1.8, 18), to: new THREE.Vector2(15.5, 18), count: 10, width: 0.82 }, pathStoneMatrices);
    this.addSteppingStoneStrip({ from: new THREE.Vector2(-4.2, 17.1), to: new THREE.Vector2(-7.1, 15.8), count: 4, width: 0.72 }, pathStoneMatrices);
    this.addInstancedStaticMesh(Geo.dodecahedron(1, 0), stoneMat, pathStoneMatrices, true, true);
  }

  private addSteppingStoneStrip(
    config: { from: THREE.Vector2; to: THREE.Vector2; count: number; width: number },
    matrices: THREE.Matrix4[]
  ): void {
    const direction = config.to.clone().sub(config.from);
    const angle = Math.atan2(direction.y, direction.x);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < config.count; i += 1) {
      const t = config.count === 1 ? 0 : i / (config.count - 1);
      const x = THREE.MathUtils.lerp(config.from.x, config.to.x, t) + (seeded(i * 23 + config.count) - 0.5) * 0.22;
      const z = THREE.MathUtils.lerp(config.from.y, config.to.y, t) + (seeded(i * 31 + config.count) - 0.5) * 0.18;
      dummy.position.set(x, this.terrainHeight(x, z) + 0.045, z);
      dummy.rotation.set(0, -angle + (seeded(i * 53) - 0.5) * 0.35, 0);
      dummy.scale.set(
        config.width * (1.08 + seeded(i * 41) * 0.38),
        config.width * 0.055,
        config.width * (0.68 + seeded(i * 47) * 0.18)
      );
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
    }
  }

  private addMeadowGrass(): void {
    const fields: FoliageFieldSpec[] = [
      { x: -3, z: 14.4, width: 34, depth: 14.4, count: 2100, seed: 8201, heightMin: 0.06, heightMax: 0.18, colors: [0x3b7a34, 0x5f9a45, 0x86ac58] },
      { x: -12, z: 12.2, width: 22, depth: 4.2, count: 950, seed: 8202, heightMin: 0.12, heightMax: 0.34, colors: [0x2d632a, 0x5e873e, 0x9a9a52] },
      { x: -22.2, z: 19.6, width: 4.8, depth: 10.6, count: 650, seed: 8203, heightMin: 0.18, heightMax: 0.52, colors: [0x36562a, 0x728331, 0xa18a4d] },
      { x: -15.6, z: 27.0, width: 12.4, depth: 2.4, count: 520, seed: 8204, heightMin: 0.12, heightMax: 0.34, colors: [0x345e2e, 0x66843d, 0x9a8b4d] },
      { x: 10.2, z: 20.5, width: 11.6, depth: 3.8, count: 620, seed: 8205, heightMin: 0.14, heightMax: 0.42, colors: [0x32672d, 0x639646, 0x8fb25d] },
    ];

    for (const field of fields) {
      addFoliageField(this.scene, field, (x, z) => this.shouldAvoidGrass(x, z));
    }

    const reedFields: FoliageFieldSpec[] = [
      { x: -7.3, z: 14.4, width: 3.2, depth: 6.8, count: 290, seed: 8301, heightMin: 0.35, heightMax: 0.9, colors: [0x667737, 0x8d8a3a, 0xb09a58] },
      { x: -22.4, z: 19.4, width: 3.0, depth: 8.8, count: 330, seed: 8302, heightMin: 0.36, heightMax: 1.0, colors: [0x596a31, 0x7c8535, 0xa88b4b] },
      { x: -15.6, z: 26.3, width: 8.8, depth: 2.4, count: 260, seed: 8303, heightMin: 0.32, heightMax: 0.82, colors: [0x587035, 0x819143, 0xb19b55] },
    ];
    for (const field of reedFields) {
      addFoliageField(this.scene, field, (x, z) => !this.isShoreBand(x, z));
    }
  }

  private addShorelineDetails(): void {
    const sandMat = getStandardMaterial({
      color: 0xb99b62,
      roughness: 0.88,
      metalness: 0,
      bumpMap: makeSharedSurfaceDetailTexture('lake-shore-sand', 5, 3),
      bumpScale: 0.018,
    });
    const rockMats = [
      getStandardMaterial({ color: 0x696760, roughness: 0.84 }),
      getStandardMaterial({ color: 0x9b907b, roughness: 0.8 }),
      getStandardMaterial({ color: 0x514f4a, roughness: 0.9 }),
    ];

    const sandMatrices: THREE.Matrix4[] = [];
    const sandDummy = new THREE.Object3D();
    for (let i = 0; i < 82; i += 1) {
      const point = this.pointOnLakeRing(i, 82, 0.1 + seeded(i * 11) * 1.0);
      const radius = 0.52 + seeded(i * 17) * 0.48;
      sandDummy.position.set(point.x, this.terrainHeight(point.x, point.z) + 0.024 + i * 0.00002, point.z);
      sandDummy.rotation.set(-Math.PI / 2, 0, seeded(i * 19) * Math.PI);
      sandDummy.scale.set(radius * (1.55 + seeded(i * 23) * 1.5), radius * (0.28 + seeded(i * 29) * 0.24), 1);
      sandDummy.updateMatrix();
      sandMatrices.push(sandDummy.matrix.clone());
    }
    this.addInstancedStaticMesh(Geo.circle(1, 14), sandMat, sandMatrices, false, true);

    const rockGeometry = Geo.dodecahedron(1, 0);
    const rockMatricesByMaterial = rockMats.map((): THREE.Matrix4[] => []);
    const rockDummy = new THREE.Object3D();
    for (let i = 0; i < 110; i += 1) {
      const point = this.pointOnLakeRing(i, 110, 0.45 + seeded(i * 43) * 1.2);
      if (this.isInsideLake(point.x, point.z, -0.08)) continue;
      const radius = 0.05 + seeded(i * 3) * 0.12;
      rockDummy.position.set(point.x, this.terrainHeight(point.x, point.z) + 0.045, point.z);
      rockDummy.rotation.set(seeded(i * 31) * Math.PI, seeded(i * 37) * Math.PI, seeded(i * 41) * Math.PI);
      rockDummy.scale.set(
        radius * (1.15 + seeded(i * 5) * 1.1),
        radius * (0.35 + seeded(i * 7) * 0.42),
        radius * (0.7 + seeded(i * 13) * 0.74)
      );
      rockDummy.updateMatrix();
      rockMatricesByMaterial[i % rockMats.length].push(rockDummy.matrix.clone());
    }
    rockMatricesByMaterial.forEach((matrices, index) => {
      this.addInstancedStaticMesh(rockGeometry, rockMats[index], matrices, true, true);
    });

    const lilyMat = getStandardMaterial({ color: 0x2c6a29, roughness: 0.72, metalness: 0.02 });
    const flowerMat = MatLib.lilyFlower;
    for (let i = 0; i < 34; i += 1) {
      const x = LAKE_CENTER_X + (seeded(i * 17) - 0.5) * 15.8;
      const z = LAKE_CENTER_Z + (seeded(i * 19) - 0.5) * 11.4;
      if (!this.isInsideLake(x, z, -1.1)) continue;
      const lily = new THREE.Mesh(Geo.circle(0.18 + seeded(i * 23) * 0.18, 12), lilyMat);
      lily.rotation.x = -Math.PI / 2;
      lily.rotation.z = seeded(i * 29) * Math.PI * 2;
      lily.scale.set(1.2, 0.72, 1);
      lily.position.set(x, 0.062, z);
      lily.receiveShadow = true;
      this.scene.add(lily);
      this.animatedObjects.push({ obj: lily, baseY: 0.062, amp: 0.008, speed: 1.2 + seeded(i) * 0.7, phase: seeded(i * 31) * Math.PI * 2 });
      if (i % 4 === 0) {
        const flower = new THREE.Mesh(Geo.sphere(0.045, 8, 6), flowerMat);
        flower.position.set(x + 0.05, 0.105, z - 0.02);
        flower.castShadow = true;
        this.scene.add(flower);
      }
    }

    this.addWaterSparkles();
  }

  private addDock(): void {
    const woodDetail = makeSharedSurfaceDetailTexture('lake-dock-wood', 2, 3);
    const plankMat = getStandardMaterial({
      color: 0x6d432b,
      roughness: 0.68,
      metalness: 0.05,
      bumpMap: woodDetail,
      bumpScale: 0.02,
      roughnessMap: woodDetail,
    });
    const darkMat = getStandardMaterial({ color: 0x3a2619, roughness: 0.84 });
    const startX = -6.6;
    const z = 16.0;
    for (let i = 0; i < 7; i += 1) {
      const x = startX + i * 0.82;
      const plank = new THREE.Mesh(Geo.box(0.78 + seeded(i * 3) * 0.14, 0.09, 0.74 + seeded(i * 5) * 0.12), plankMat);
      plank.position.set(x, 0.16 + (i % 2) * 0.014, z + (seeded(i * 7) - 0.5) * 0.08);
      plank.rotation.y = (seeded(i * 11) - 0.5) * 0.08;
      plank.castShadow = true;
      plank.receiveShadow = true;
      this.scene.add(plank);

      const seam = new THREE.Mesh(Geo.box(0.68, 0.012, 0.035), darkMat);
      seam.position.set(x, 0.214, z + 0.22);
      seam.rotation.y = plank.rotation.y;
      seam.receiveShadow = true;
      this.scene.add(seam);
    }

    for (let i = 0; i < 5; i += 1) {
      for (const dz of [-0.44, 0.44]) {
        const post = new THREE.Mesh(Geo.box(0.12, 0.62, 0.12), plankMat);
        post.position.set(startX + i * 1.05, -0.12, z + dz);
        post.castShadow = true;
        post.receiveShadow = true;
        this.scene.add(post);
      }
    }

    const lamp = new THREE.Mesh(Geo.octahedron(0.16, 1), MatLib.warmGlowWeak);
    lamp.position.set(startX + 5.6, 0.82, z);
    this.scene.add(lamp);
    this.animatedObjects.push({ obj: lamp, baseY: 0.82, amp: 0.035, speed: 1.8, phase: 0.2, rotateY: 0.008 });
    addPointLight(this.scene, startX + 5.6, 0.82, z, 0xffc96d, 1.15, 5.6);
  }

  private addFountainAndBeds(obstacles: Obstacle[]): void {
    const stoneMat = getStandardMaterial({
      color: 0x8a8278,
      roughness: 0.72,
      metalness: 0.04,
      bumpMap: makeSharedSurfaceDetailTexture('outdoor-fountain-stone', 2, 2),
      bumpScale: 0.018,
    });
    const goldMat = MatLib.gold;
    const x = 0;
    const z = 14.5;
    const baseY = this.terrainHeight(x, z);
    const base = new THREE.Mesh(Geo.cylinder(1.2, 1.4, 0.4, 40), stoneMat);
    base.position.set(x, baseY + 0.2, z);
    base.castShadow = true;
    base.receiveShadow = true;
    this.scene.add(base);

    const water = new THREE.Mesh(Geo.circle(1.08, 40), MatLib.waterBlue);
    water.rotation.x = -Math.PI / 2;
    water.position.set(x, baseY + 0.415, z);
    this.scene.add(water);
    this.animatedObjects.push({ obj: water, baseY: baseY + 0.415, amp: 0.006, speed: 1.8, phase: 0.2 });

    const pillar = new THREE.Mesh(Geo.cylinder(0.16, 0.22, 0.72, 18), stoneMat);
    pillar.position.set(x, baseY + 0.72, z);
    pillar.castShadow = true;
    this.scene.add(pillar);

    const bowl = new THREE.Mesh(Geo.cylinder(0.52, 0.3, 0.16, 28), goldMat);
    bowl.position.set(x, baseY + 1.08, z);
    bowl.castShadow = true;
    this.scene.add(bowl);

    const spout = new THREE.Mesh(Geo.cylinder(0.05, 0.08, 0.42, 12), MatLib.waterSpout);
    spout.position.set(x, baseY + 1.33, z);
    this.scene.add(spout);
    this.animatedObjects.push({ obj: spout, baseY: baseY + 1.33, amp: 0.035, speed: 4.0, phase: 0 });
    addPointLight(this.scene, x, baseY + 0.8, z, 0x6fc4ff, 0.65, 4);
    obstacles.push({ minX: -1.25, maxX: 1.25, minZ: 13.35, maxZ: 15.65 });

    const colors = [0xd85f9e, 0xf1c45f, 0x7356d9, 0xd85f5f, 0xffd674];
    for (const [fx, fz] of [[-10, 10], [10, 10], [-10, 19], [10, 19]] as Array<[number, number]>) {
      this.addFlowerBed(fx, fz, colors);
      obstacles.push({ minX: fx - 0.82, maxX: fx + 0.82, minZ: fz - 0.82, maxZ: fz + 0.82 });
    }
  }

  private addFlowerBed(x: number, z: number, colors: number[]): void {
    const y = this.terrainHeight(x, z);
    const stoneMat = getStandardMaterial({ color: 0x8a8278, roughness: 0.68 });
    const ring = new THREE.Mesh(Geo.cylinder(0.7, 0.75, 0.25, 22), stoneMat);
    ring.position.set(x, y + 0.12, z);
    ring.castShadow = true;
    ring.receiveShadow = true;
    this.scene.add(ring);

    const dirt = new THREE.Mesh(Geo.cylinder(0.65, 0.65, 0.04, 22), getStandardMaterial({ color: 0x4a3020, roughness: 0.82 }));
    dirt.position.set(x, y + 0.25, z);
    dirt.receiveShadow = true;
    this.scene.add(dirt);

    const stemMat = getStandardMaterial({ color: 0x4a8b3a, roughness: 0.72 });
    const flowerMats = colors.map((c) => getStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.08, roughness: 0.46 }));
    const stemMatrices: THREE.Matrix4[] = [];
    const flowerMatricesByMaterial = flowerMats.map((): THREE.Matrix4[] => []);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 18; i += 1) {
      const angle = (i / 18) * Math.PI * 2;
      const radius = seeded(i * 17 + x * 9) * 0.52;
      const fx = x + Math.cos(angle) * radius;
      const fz = z + Math.sin(angle) * radius;
      dummy.position.set(fx, y + 0.34, fz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      stemMatrices.push(dummy.matrix.clone());

      dummy.position.set(fx, y + 0.45, fz);
      dummy.updateMatrix();
      flowerMatricesByMaterial[i % flowerMats.length].push(dummy.matrix.clone());
    }

    this.addInstancedStaticMesh(Geo.cylinder(0.012, 0.015, 0.18, 5), stemMat, stemMatrices, true, false);
    flowerMatricesByMaterial.forEach((matrices, index) => {
      this.addInstancedStaticMesh(Geo.sphere(0.04, 8, 6), flowerMats[index], matrices, true, false);
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

  private addTrees(obstacles: Obstacle[]): void {
    const trees: TreeSpec[] = [
      { x: -14, z: 9, scale: 1.1, seed: 9101, variant: 'oak', rotation: 0.2 },
      { x: 14, z: 9, scale: 1.15, seed: 9102, variant: 'maple', rotation: -0.4 },
      { x: -14, z: 20, scale: 0.96, seed: 9103, variant: 'willow', rotation: 0.6 },
      { x: 14, z: 20, scale: 1.04, seed: 9104, variant: 'oak', rotation: -0.1 },
      { x: -7, z: 21, scale: 0.88, seed: 9105, variant: 'maple', rotation: 0.85 },
      { x: 7, z: 21, scale: 0.98, seed: 9106, variant: 'willow', rotation: -0.75 },
      { x: -5, z: 8.5, scale: 0.86, seed: 9107, variant: 'oak', rotation: 0.35 },
      { x: 5, z: 8.5, scale: 0.9, seed: 9108, variant: 'maple', rotation: -0.3 },
      { x: -23.0, z: 24.7, scale: 0.66, seed: 9109, variant: 'willow', rotation: 0.4 },
      { x: -23.4, z: 15.0, scale: 0.82, seed: 9110, variant: 'oak', rotation: 1.2 },
      { x: -8.6, z: 11.4, scale: 0.74, seed: 9111, variant: 'maple', rotation: -0.6 },
    ];

    for (const tree of trees) {
      if (this.isInsideLake(tree.x, tree.z, 0.35)) continue;
      const y = this.terrainHeight(tree.x, tree.z);
      const group = addNaturalTree(this.scene, { ...tree, baseY: y });
      this.animatedObjects.push({ obj: group, baseY: y, amp: 0.006, speed: 0.45, phase: tree.seed * 0.01, rotateY: 0.0008 });
      const radius = 0.28 * tree.scale;
      obstacles.push({ minX: tree.x - radius, maxX: tree.x + radius, minZ: tree.z - radius, maxZ: tree.z + radius });
    }
  }

  private addBenchesAndLights(): void {
    const benchMat = getStandardMaterial({
      color: 0x6d432b,
      roughness: 0.58,
      metalness: 0.06,
      bumpMap: makeSharedSurfaceDetailTexture('outdoor-bench-wood', 2, 2),
      bumpScale: 0.018,
    });
    for (const [x, z, ry] of [[-6, 12, 0], [6, 12, 0], [-6, 17, 0], [6, 17, 0]] as Array<[number, number, number]>) {
      this.addBench(x, z, ry, benchMat);
    }

    for (const [x, z] of [[-12, 7.5], [12, 7.5], [-12, 21.5], [12, 21.5], [-7.2, 14.2], [-20.8, 23.8]] as Array<[number, number]>) {
      this.addLampPost(x, z);
    }
    addPointLight(this.scene, LAKE_CENTER_X, 5.2, LAKE_CENTER_Z, 0x9fc4ff, 1.55, 22);
  }

  private addBench(x: number, z: number, rotY: number, mat: THREE.Material): void {
    const group = new THREE.Group();
    const y = this.terrainHeight(x, z);
    const seat = new THREE.Mesh(Geo.box(1.6, 0.08, 0.4), mat);
    seat.position.y = 0.44;
    seat.castShadow = true;
    seat.receiveShadow = true;
    group.add(seat);

    const back = new THREE.Mesh(Geo.box(1.6, 0.42, 0.07), mat);
    back.position.set(0, 0.68, -0.18);
    back.castShadow = true;
    group.add(back);

    for (const dx of [-0.7, 0.7]) {
      for (const dz of [-0.15, 0.15]) {
        const leg = new THREE.Mesh(Geo.box(0.08, 0.42, 0.08), mat);
        leg.position.set(dx, 0.21, dz);
        leg.castShadow = true;
        group.add(leg);
      }
    }
    group.position.set(x, y, z);
    group.rotation.y = rotY;
    this.scene.add(group);
  }

  private addLampPost(x: number, z: number): void {
    const y = this.terrainHeight(x, z);
    const pole = new THREE.Mesh(Geo.cylinder(0.055, 0.08, 3.0, 14), MatLib.gold);
    pole.position.set(x, y + 1.5, z);
    pole.castShadow = true;
    this.scene.add(pole);

    const lamp = new THREE.Mesh(Geo.octahedron(0.2, 1), MatLib.warmLight);
    lamp.position.set(x, y + 3.1, z);
    this.scene.add(lamp);
    this.animatedObjects.push({ obj: lamp, baseY: y + 3.1, amp: 0.035, speed: 1.8, phase: seeded(x * 31 + z * 17) * Math.PI * 2, rotateY: 0.006 });
    addPointLight(this.scene, x, y + 3.05, z, 0xffc96d, 1.2, 6);
  }

  private addFireflies(): void {
    const fireflyMat = MatLib.firefly;
    for (let i = 0; i < 42; i += 1) {
      const x = -24 + seeded(i * 13) * 38;
      const z = 8 + seeded(i * 19) * 19;
      if (this.isInsideLake(x, z, -0.4)) continue;
      const y = this.terrainHeight(x, z) + 0.5 + seeded(i * 23) * 1.4;
      const fly = new THREE.Mesh(Geo.sphere(0.028, 6, 4), fireflyMat);
      fly.position.set(x, y, z);
      this.scene.add(fly);
      this.animatedObjects.push({ obj: fly, baseY: y, amp: 0.28 + seeded(i * 29) * 0.36, speed: 0.45 + seeded(i * 31) * 0.8, phase: seeded(i * 37) * Math.PI * 2 });
    }
  }

  private addWaterSparkles(): void {
    const sparkMat = MatLib.waterSparkle;
    const geo = Geo.sphere(0.018, 4, 3);
    for (let i = 0; i < 48; i += 1) {
      const x = LAKE_CENTER_X + (seeded(i * 17) - 0.5) * 16;
      const z = LAKE_CENTER_Z + (seeded(i * 19) - 0.5) * 12;
      if (!this.isInsideLake(x, z, -1.2)) continue;
      const spark = new THREE.Mesh(geo, sparkMat);
      spark.position.set(x, 0.078, z);
      this.scene.add(spark);
      this.animatedObjects.push({ obj: spark, baseY: 0.078, amp: 0.015, speed: 1.8 + seeded(i * 23) * 1.7, phase: seeded(i * 29) * Math.PI * 2 });
    }
  }

  private shouldAvoidGrass(x: number, z: number): boolean {
    return this.isInsideLake(x, z, 0.42) || this.isPath(x, z, 0.22) || this.isNearFeature(x, z, 0.32);
  }

  private isNearFeature(x: number, z: number, margin: number): boolean {
    if (Math.hypot(x, z - 14.5) < 1.8 + margin) return true;
    for (const [fx, fz] of [[-10, 10], [10, 10], [-10, 19], [10, 19]] as Array<[number, number]>) {
      if (Math.hypot(x - fx, z - fz) < 1.1 + margin) return true;
    }
    return false;
  }

  private isPath(x: number, z: number, margin: number): boolean {
    if (Math.abs(x) < 0.86 + margin && z > 6.7 && z < 22.4) return true;
    if (Math.abs(z - 18) < 0.68 + margin && Math.abs(x) > 1.6 && Math.abs(x) < 16.4) return true;
    return false;
  }

  private isShoreBand(x: number, z: number): boolean {
    return this.isInsideLake(x, z, 0.9) && !this.isInsideLake(x, z, -0.38);
  }

  private sampleTerrain(x: number, z: number): TerrainSample {
    const noise =
      Math.sin(x * 0.23 + z * 0.11) * 0.035 +
      Math.sin(x * 0.61 - z * 0.17) * 0.018 +
      Math.cos((x + z) * 0.13) * 0.012;
    const lakeCore = this.isInsideLake(x, z, -0.2);
    const shoreBand = this.isInsideLake(x, z, 1.05);
    const path = this.isPath(x, z, 0.1);
    const color = new THREE.Color();

    if (lakeCore) {
      const centerDepth = 1 - Math.min(1, Math.hypot((x - LAKE_CENTER_X) / 12, (z - LAKE_CENTER_Z) / 8.6));
      color.copy(LAKEBED).lerp(DAMP_SHORE, 0.18 + centerDepth * 0.18);
      return { height: -0.24 - centerDepth * 0.18 + noise * 0.2, color };
    }

    if (path) {
      color.copy(PATH).lerp(SHORE, 0.16 + Math.sin(x * 0.7 + z * 0.5) * 0.06);
      return { height: noise * 0.25 + 0.005, color };
    }

    if (shoreBand) {
      const damp = this.isInsideLake(x, z, 0.38) ? 0.65 : 0.35;
      color.copy(SHORE).lerp(DAMP_SHORE, damp);
      return { height: -0.03 + noise * 0.35, color };
    }

    const warm = THREE.MathUtils.clamp((z - 10) / 18, 0, 1);
    color.copy(DARK_GRASS).lerp(GRASS, 0.62 + Math.sin(x * 0.2) * 0.08).lerp(WARM_GRASS, warm * 0.18);
    return { height: noise, color };
  }

  private terrainHeight(x: number, z: number): number {
    return this.sampleTerrain(x, z).height;
  }

  private makeLakeOutline(radiusX: number, radiusZ: number, segments: number): THREE.Vector2[] {
    const points: THREE.Vector2[] = [];
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const wobble = lakeWobble(angle);
      const notch = angle > Math.PI * 1.76 || angle < Math.PI * 0.08 ? 0.82 : 1;
      points.push(new THREE.Vector2(Math.cos(angle) * radiusX * wobble * notch, Math.sin(angle) * radiusZ * wobble));
    }
    return points;
  }

  private pointOnLakeRing(index: number, count: number, offset: number): { x: number; z: number } {
    const angle = (index / count) * Math.PI * 2 + Math.sin(index * 1.37) * 0.08;
    const wobble = lakeWobble(angle);
    const notch = angle > Math.PI * 1.76 || angle < Math.PI * 0.08 ? 0.82 : 1;
    return {
      x: LAKE_CENTER_X + Math.cos(angle) * (12.0 * wobble * notch + offset),
      z: LAKE_CENTER_Z + Math.sin(angle) * (8.6 * wobble + offset * 0.62),
    };
  }

  private isInsideLake(x: number, z: number, margin: number): boolean {
    const localX = x - LAKE_CENTER_X;
    const localZ = z - LAKE_CENTER_Z;
    const angle = Math.atan2(localZ / 8.6, localX / 12.0);
    const normalized = angle < 0 ? angle + Math.PI * 2 : angle;
    const notch = normalized > Math.PI * 1.76 || normalized < Math.PI * 0.08 ? 0.82 : 1;
    const radiusX = Math.max(0.2, 12.0 * lakeWobble(normalized) * notch + margin);
    const radiusZ = Math.max(0.2, 8.6 * lakeWobble(normalized) + margin);
    const dx = localX / radiusX;
    const dz = localZ / radiusZ;
    return dx * dx + dz * dz < 1;
  }
}

function lakeWobble(angle: number): number {
  return 1 + Math.sin(angle * 2.1 + 0.35) * 0.08 + Math.cos(angle * 3.4 - 0.7) * 0.055 + Math.sin(angle * 5.2) * 0.035;
}

function seeded(seed: number): number {
  let value = (Math.floor(seed) >>> 0) + 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}
