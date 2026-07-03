import * as THREE from 'three';
import { Geo, MatLib, getStandardMaterial, makeSharedWoodTexture } from './RenderResources';

interface LooseBookSpec {
  x: number;
  y: number;
  z: number;
  rotation: number;
  color: number;
  scale: THREE.Vector3;
}

export class LibraryEnvironment {
  private readonly dummy = new THREE.Object3D();
  private readonly woodTex = makeSharedWoodTexture();

  constructor(private readonly scene: THREE.Scene) {}

  build(): void {
    this.addInstancedLooseBooks();
    this.addScrollClusters();
    this.addReadingProps();
    this.addShelfSignage();
  }

  private addInstancedLooseBooks(): void {
    const rand = seededRandom(7011);
    const colors = [0x7651b9, 0xb9505c, 0xd2ad5f, 0x4f94a7, 0x6f9348, 0x5d3a31];
    const specs: LooseBookSpec[] = [];

    for (let i = 0; i < 42; i += 1) {
      const onTable = i < 18;
      const x = onTable ? 4.0 + rand() * 2.4 : 3.2 + rand() * 4.9;
      const z = onTable ? -0.62 + rand() * 1.08 : -5.15 + rand() * 4.1;
      specs.push({
        x,
        y: onTable ? 0.88 + rand() * 0.06 : 0.12 + rand() * 0.08,
        z,
        rotation: rand() * Math.PI * 2,
        color: colors[Math.floor(rand() * colors.length)],
        scale: new THREE.Vector3(0.28 + rand() * 0.16, 0.045 + rand() * 0.045, 0.2 + rand() * 0.12),
      });
    }

    for (const color of colors) {
      const matching = specs.filter((spec) => spec.color === color);
      if (matching.length === 0) continue;
      const mesh = new THREE.InstancedMesh(
        Geo.box(1, 1, 1),
        getStandardMaterial({ color, roughness: 0.55, metalness: 0.03 }),
        matching.length
      );
      matching.forEach((spec, index) => {
        this.dummy.position.set(spec.x, spec.y, spec.z);
        this.dummy.rotation.set(0, spec.rotation, (rand() - 0.5) * 0.08);
        this.dummy.scale.copy(spec.scale);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(index, this.dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
  }

  private addScrollClusters(): void {
    const parchmentMat = getStandardMaterial({ color: 0xd9c08e, roughness: 0.68, metalness: 0.02 });
    const bindingMat = getStandardMaterial({ color: 0x8b5a35, roughness: 0.6, metalness: 0.03 });

    for (const [x, y, z, rot] of [
      [6.35, 0.9, -0.32, 0.22],
      [4.28, 0.9, 0.32, -0.4],
      [7.68, 0.34, -2.08, 0.8],
      [3.35, 0.24, -1.36, -0.65],
    ] as Array<[number, number, number, number]>) {
      const group = new THREE.Group();
      for (let i = 0; i < 3; i += 1) {
        const scroll = new THREE.Mesh(Geo.cylinder(0.035, 0.035, 0.42, 12), parchmentMat);
        scroll.position.set((i - 1) * 0.075, 0, (i % 2) * 0.055);
        scroll.rotation.z = Math.PI / 2;
        scroll.castShadow = true;
        scroll.receiveShadow = true;
        group.add(scroll);

        const tie = new THREE.Mesh(Geo.box(0.024, 0.018, 0.095), bindingMat);
        tie.position.copy(scroll.position);
        tie.castShadow = true;
        group.add(tie);
      }
      group.position.set(x, y, z);
      group.rotation.y = rot;
      this.scene.add(group);
    }
  }

  private addReadingProps(): void {
    const woodMat = getStandardMaterial({ color: 0x5b3324, roughness: 0.48, metalness: 0.08, map: this.woodTex });
    const brassMat = MatLib.gold;
    const glassMat = getStandardMaterial({ color: 0x7ad1e0, roughness: 0.12, metalness: 0.02, transparent: true, opacity: 0.68 });

    for (const [x, z, rot] of [[4.2, 1.02, 0.15], [6.2, 1.02, -0.22]] as Array<[number, number, number]>) {
      const stand = new THREE.Group();
      const base = new THREE.Mesh(Geo.box(0.62, 0.04, 0.38), woodMat);
      base.position.y = 0.02;
      base.castShadow = true;
      stand.add(base);

      const pageLeft = new THREE.Mesh(Geo.box(0.29, 0.02, 0.34), getStandardMaterial({ color: 0xf0dfbd, roughness: 0.68 }));
      pageLeft.position.set(-0.15, 0.07, 0);
      pageLeft.rotation.z = 0.08;
      stand.add(pageLeft);

      const pageRight = pageLeft.clone();
      pageRight.position.x = 0.15;
      pageRight.rotation.z = -0.08;
      stand.add(pageRight);

      const pointer = new THREE.Mesh(Geo.cylinder(0.012, 0.012, 0.52, 8), brassMat);
      pointer.position.set(0.18, 0.13, -0.08);
      pointer.rotation.set(Math.PI / 2, 0, 0.9);
      pointer.castShadow = true;
      stand.add(pointer);

      stand.position.set(x, 0.86, z);
      stand.rotation.y = rot;
      this.scene.add(stand);
    }

    for (const [x, z] of [[4.75, -0.62], [5.72, 0.46], [6.8, -2.18]] as Array<[number, number]>) {
      const bottle = new THREE.Mesh(Geo.cylinder(0.052, 0.065, 0.22, 12), glassMat);
      bottle.position.set(x, 0.96, z);
      bottle.castShadow = true;
      this.scene.add(bottle);

      const stopper = new THREE.Mesh(Geo.box(0.045, 0.045, 0.045), brassMat);
      stopper.position.set(x, 1.105, z);
      stopper.castShadow = true;
      this.scene.add(stopper);
    }
  }

  private addShelfSignage(): void {
    const plaqueMat = MatLib.goldFrame;
    const darkMat = getStandardMaterial({ color: 0x34201a, roughness: 0.62, metalness: 0.04 });

    for (const [x, z, rot] of [
      [3.7, -5.64, 0],
      [5.05, -5.64, 0],
      [6.4, -5.64, 0],
      [8.02, -3.25, Math.PI / 2],
      [8.02, -1.95, Math.PI / 2],
    ] as Array<[number, number, number]>) {
      const plaque = new THREE.Group();
      const frame = new THREE.Mesh(Geo.box(0.42, 0.18, 0.024), plaqueMat);
      frame.castShadow = true;
      plaque.add(frame);
      const inset = new THREE.Mesh(Geo.box(0.34, 0.11, 0.026), darkMat);
      inset.position.z = 0.004;
      plaque.add(inset);
      plaque.position.set(x, 2.72, z);
      plaque.rotation.y = rot;
      this.scene.add(plaque);
    }
  }
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
