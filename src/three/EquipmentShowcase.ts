import * as THREE from 'three';
import { ITEM_DEFINITIONS } from '../data/itemsAndWeapons';
import type { Obstacle } from './WorldTypes';
import { createItemWeaponModel } from './ItemWeaponModels';
import { Geo, MatLib, getStandardMaterial, makeSharedSurfaceDetailTexture } from './RenderResources';

interface DisplayObject {
  root: THREE.Object3D;
  model: THREE.Object3D;
  baseY: number;
  speed: number;
  phase: number;
}

export class EquipmentShowcase {
  private readonly displayObjects: DisplayObject[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  build(): Obstacle[] {
    const obstacles: Obstacle[] = [];
    const plinthMat = getStandardMaterial({
      color: 0x6b5f58,
      roughness: 0.68,
      metalness: 0.06,
      bumpMap: makeSharedSurfaceDetailTexture('equipment-plinth-stone', 2, 2),
      bumpScale: 0.018,
    });
    const trimMat = MatLib.goldFrame;

    ITEM_DEFINITIONS.forEach((item, index) => {
      const placement = this.getPlacement(index);
      const stand = new THREE.Group();
      stand.position.set(placement.x, 0, placement.z);
      stand.rotation.y = placement.rotationY;

      const plinth = new THREE.Mesh(Geo.cylinder(0.38, 0.46, 0.2, 18), plinthMat);
      plinth.position.y = 0.1;
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      stand.add(plinth);

      const ring = new THREE.Mesh(Geo.torus(0.39, 0.014, 8, 28), trimMat);
      ring.position.y = 0.22;
      ring.rotation.x = Math.PI / 2;
      ring.castShadow = true;
      stand.add(ring);

      const model = createItemWeaponModel(item);
      model.position.y = 0.32;
      model.rotation.y = placement.modelYaw;
      stand.add(model);

      this.scene.add(stand);
      this.displayObjects.push({
        root: stand,
        model,
        baseY: 0.32,
        speed: 0.55 + (index % 5) * 0.08,
        phase: index * 0.37,
      });

      obstacles.push({
        minX: placement.x - 0.36,
        maxX: placement.x + 0.36,
        minZ: placement.z - 0.36,
        maxZ: placement.z + 0.36,
      });
    });

    this.addSectionLights();
    return obstacles;
  }

  update(elapsedTime: number): void {
    for (const display of this.displayObjects) {
      display.model.position.y = display.baseY + Math.sin(elapsedTime * display.speed + display.phase) * 0.045;
      display.model.rotation.y += 0.006;
    }
  }

  getDynamicObjects(): readonly THREE.Object3D[] {
    return this.displayObjects.map((display) => display.model);
  }

  private getPlacement(index: number): { x: number; z: number; rotationY: number; modelYaw: number } {
    if (index < 10) {
      return { x: 8.1, z: 24 + index * 1.52, rotationY: Math.PI / 2, modelYaw: -Math.PI / 2 };
    }
    if (index < 20) {
      const i = index - 10;
      return { x: 25.9, z: 24 + i * 1.52, rotationY: -Math.PI / 2, modelYaw: Math.PI / 2 };
    }
    if (index < 30) {
      const i = index - 20;
      return { x: 9.4 + i * 1.7, z: 23.0, rotationY: 0, modelYaw: 0 };
    }
    const i = index - 30;
    return { x: 9.4 + i * 1.9, z: 39.0, rotationY: Math.PI, modelYaw: Math.PI };
  }

  private addSectionLights(): void {
    for (const [x, z, color] of [
      [8.4, 31.2, 0x9fdcff],
      [25.6, 31.2, 0xffd674],
      [17.0, 23.4, 0xc6a6ff],
      [17.0, 38.6, 0xaef5c8],
    ] as Array<[number, number, number]>) {
      const lantern = new THREE.Mesh(
        Geo.octahedron(0.13, 1),
        getStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2, roughness: 0.22 })
      );
      lantern.position.set(x, 1.32, z);
      this.scene.add(lantern);
      const light = new THREE.PointLight(color, 0.8, 5.2, 2);
      light.position.set(x, 1.22, z);
      this.scene.add(light);
    }
  }
}
