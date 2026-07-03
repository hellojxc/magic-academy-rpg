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

/** 区域定义 — 用于小地图和玩家位置追踪 */
export interface RegionDef {
  id: string;
  label: string;
  /** 区域边界（世界坐标 AABB） */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** 小地图上的颜色 */
  color: number;
}

/** 全局世界边界 */
export const WORLD_BOUNDS = {
  minX: -28,
  maxX: 28,
  minZ: -24,
  maxZ: 30,
};
