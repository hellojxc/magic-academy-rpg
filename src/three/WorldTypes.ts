import type * as THREE from 'three';

export interface Obstacle {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface AcademyWorldObjects {
  player: THREE.Sprite;
  lyra: THREE.Sprite;
  obstacles: readonly Obstacle[];
}
