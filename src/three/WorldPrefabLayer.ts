import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WORLD_PREFAB_PACK_URL, WORLD_PREFAB_PLACEMENTS, type WorldRegionId } from './WorldPrefabManifest';

const loader = new GLTFLoader();
let packPromise: Promise<THREE.Group> | null = null;
const appliedRegions = new WeakMap<THREE.Scene, Set<WorldRegionId>>();

const NO_SHADOW_PREFABS = new Set([
  'floor_inlay_tile',
  'rug_runner',
  'weathered_floor_slab',
  'window_light_beam',
]);
const LIBRARY_BOOKSHELF_SHADOW_MESHES = new Set(['back', 'left_side', 'right_side', 'shelf']);

export function addWorldPrefabRegion(
  scene: THREE.Scene,
  region: WorldRegionId,
  onInstalled?: () => void,
): void {
  let regions = appliedRegions.get(scene);
  if (!regions) {
    regions = new Set();
    appliedRegions.set(scene, regions);
  }
  if (regions.has(region)) return;
  regions.add(region);

  void getPrefabPack()
    .then((pack) => {
      let installed = 0;
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
            object.castShadow = shouldPrefabMeshCastShadow(placement.prefab, object);
            object.receiveShadow = true;
          }
        });
        freezeStaticSubtree(instance);
        scene.add(instance);
        installed += 1;
      }
      if (installed > 0) onInstalled?.();
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

function shouldPrefabMeshCastShadow(prefab: string, mesh: THREE.Mesh): boolean {
  if (NO_SHADOW_PREFABS.has(prefab)) return false;
  if (prefab === 'library_bookshelf') {
    return LIBRARY_BOOKSHELF_SHADOW_MESHES.has(mesh.name);
  }
  return true;
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
