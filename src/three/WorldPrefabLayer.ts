import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WORLD_PREFAB_PACK_URL, WORLD_PREFAB_PLACEMENTS, type WorldRegionId } from './WorldPrefabManifest';

const loader = new GLTFLoader();
let packPromise: Promise<THREE.Group> | null = null;
const appliedRegions = new WeakMap<THREE.Scene, Set<WorldRegionId>>();

export function addWorldPrefabRegion(scene: THREE.Scene, region: WorldRegionId): void {
  let regions = appliedRegions.get(scene);
  if (!regions) {
    regions = new Set();
    appliedRegions.set(scene, regions);
  }
  if (regions.has(region)) return;
  regions.add(region);

  void getPrefabPack()
    .then((pack) => {
      for (const placement of WORLD_PREFAB_PLACEMENTS) {
        if (placement.region !== region) continue;
        const source = pack.getObjectByName(placement.prefab);
        if (!source) {
          console.warn(`Missing world prefab: ${placement.prefab}`);
          continue;
        }

        const instance = source.clone(true);
        instance.name = `${placement.region}:${placement.prefab}`;
        instance.position.set(...placement.position);
        instance.rotation.y = placement.rotationY ?? 0;
        applyScale(instance, placement.scale);
        instance.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });
        freezeStaticSubtree(instance);
        scene.add(instance);
      }
    })
    .catch((error) => {
      console.warn('Failed to load world prefab pack', error);
    });
}

function getPrefabPack(): Promise<THREE.Group> {
  if (packPromise) return packPromise;
  packPromise = loader.loadAsync(WORLD_PREFAB_PACK_URL).then((gltf) => gltf.scene);
  return packPromise;
}

function applyScale(object: THREE.Object3D, scale: number | [number, number, number] | undefined): void {
  if (scale === undefined) return;
  if (Array.isArray(scale)) {
    object.scale.set(scale[0], scale[1], scale[2]);
    return;
  }
  object.scale.setScalar(scale);
}

function freezeStaticSubtree(root: THREE.Object3D): void {
  root.traverse((object) => {
    object.updateMatrix();
    object.matrixAutoUpdate = false;
  });
  root.updateMatrixWorld(true);
}
