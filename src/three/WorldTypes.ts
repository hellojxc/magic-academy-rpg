import type * as THREE from 'three';

export interface Obstacle {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface AcademyWorldObjects {
  player: THREE.Object3D;
  lyra: THREE.Object3D;
  obstacles: readonly Obstacle[];
}
