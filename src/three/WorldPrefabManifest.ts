export type WorldRegionId = 'atrium' | 'grand_hall' | 'dining_hall' | 'lawn' | 'lake';

export interface WorldPrefabPlacement {
  region: WorldRegionId;
  prefab: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number | [number, number, number];
}

export const WORLD_PREFAB_PACK_URL = '/assets/world/academy-prefabs.glb';

export const WORLD_PREFAB_PLACEMENTS: WorldPrefabPlacement[] = [
  { region: 'atrium', prefab: 'floor_inlay_tile', position: [-5.4, 0.08, 4.4], rotationY: 0.4, scale: 0.72 },
  { region: 'atrium', prefab: 'floor_inlay_tile', position: [-2.4, 0.08, 4.3], rotationY: 0.1, scale: 0.68 },
  { region: 'atrium', prefab: 'floor_inlay_tile', position: [1.8, 0.08, 4.2], rotationY: -0.2, scale: 0.7 },
  { region: 'atrium', prefab: 'floor_inlay_tile', position: [5.2, 0.08, 4.3], rotationY: 0.3, scale: 0.66 },
  { region: 'atrium', prefab: 'ornate_column', position: [-7.2, 0, -4.85], scale: 1.0 },
  { region: 'atrium', prefab: 'ornate_column', position: [7.2, 0, -4.85], scale: 1.0 },
  { region: 'atrium', prefab: 'ornate_column', position: [-7.2, 0, 3.15], scale: 1.0 },
  { region: 'atrium', prefab: 'ornate_column', position: [7.2, 0, 3.15], scale: 1.0 },
  { region: 'atrium', prefab: 'arched_window', position: [-5.65, 1.1, -5.98], scale: 0.92 },
  { region: 'atrium', prefab: 'arched_window', position: [5.65, 1.1, -5.98], scale: 0.92 },
  { region: 'atrium', prefab: 'library_bookshelf', position: [3.7, 0, -5.8], scale: 0.96 },
  { region: 'atrium', prefab: 'library_bookshelf', position: [5.05, 0, -5.8], scale: 0.96 },
  { region: 'atrium', prefab: 'library_bookshelf', position: [6.4, 0, -5.8], scale: 0.96 },
  { region: 'atrium', prefab: 'reading_table_set', position: [5.2, 0.02, -0.08], rotationY: 0.04, scale: 0.88 },
  { region: 'atrium', prefab: 'scroll_bundle', position: [7.4, 0.26, 0.68], rotationY: -0.3, scale: 0.9 },
  { region: 'atrium', prefab: 'magic_lantern', position: [0, 3.0, -5.62], scale: 1.0 },

  { region: 'grand_hall', prefab: 'grand_column', position: [-10, 0, -19], scale: 1.0 },
  { region: 'grand_hall', prefab: 'grand_column', position: [10, 0, -19], scale: 1.0 },
  { region: 'grand_hall', prefab: 'grand_column', position: [-10, 0, -15.5], scale: 1.0 },
  { region: 'grand_hall', prefab: 'grand_column', position: [10, 0, -15.5], scale: 1.0 },
  { region: 'grand_hall', prefab: 'grand_column', position: [-10, 0, -10], scale: 1.0 },
  { region: 'grand_hall', prefab: 'grand_column', position: [10, 0, -10], scale: 1.0 },
  { region: 'grand_hall', prefab: 'wall_segment', position: [-8.4, 0.02, -21.86], scale: 1.35 },
  { region: 'grand_hall', prefab: 'wall_segment', position: [-4.2, 0.02, -21.86], scale: 1.35 },
  { region: 'grand_hall', prefab: 'wall_segment', position: [4.2, 0.02, -21.86], scale: 1.35 },
  { region: 'grand_hall', prefab: 'wall_segment', position: [8.4, 0.02, -21.86], scale: 1.35 },
  { region: 'grand_hall', prefab: 'arched_window', position: [0, 1.38, -21.8], scale: 1.65 },
  { region: 'grand_hall', prefab: 'floor_inlay_tile', position: [-4, 0.08, -14.5], rotationY: 0.35, scale: 1.0 },
  { region: 'grand_hall', prefab: 'floor_inlay_tile', position: [4, 0.08, -14.5], rotationY: -0.28, scale: 1.0 },
  { region: 'grand_hall', prefab: 'magic_lantern', position: [-7, 3.0, -18], scale: 1.1 },
  { region: 'grand_hall', prefab: 'magic_lantern', position: [7, 3.0, -18], scale: 1.1 },

  { region: 'dining_hall', prefab: 'dining_table_set', position: [17, 0, -3], rotationY: 0, scale: [2.75, 1, 1.1] },
  { region: 'dining_hall', prefab: 'dining_table_set', position: [17, 0, 0.5], rotationY: 0, scale: [2.75, 1, 1.1] },
  { region: 'dining_hall', prefab: 'dining_table_set', position: [17, 0, 4], rotationY: 0, scale: [2.75, 1, 1.1] },
  { region: 'dining_hall', prefab: 'food_counter', position: [14, 0, -5.48], rotationY: 0, scale: 1.0 },
  { region: 'dining_hall', prefab: 'fireplace', position: [23.16, 0, 1], rotationY: Math.PI / 2, scale: 1.0 },
  { region: 'dining_hall', prefab: 'chandelier', position: [15, 3.45, -3], scale: 1.0 },
  { region: 'dining_hall', prefab: 'chandelier', position: [19, 3.45, -3], scale: 1.0 },
  { region: 'dining_hall', prefab: 'chandelier', position: [15, 3.45, 4], scale: 1.0 },
  { region: 'dining_hall', prefab: 'chandelier', position: [19, 3.45, 4], scale: 1.0 },
  { region: 'dining_hall', prefab: 'wall_segment', position: [23.58, 0.02, -4.2], rotationY: Math.PI / 2, scale: 1.1 },
  { region: 'dining_hall', prefab: 'wall_segment', position: [23.58, 0.02, 4.2], rotationY: Math.PI / 2, scale: 1.1 },

  { region: 'lawn', prefab: 'fountain_prefab', position: [0, 0, 14.5], scale: 1.0 },
  { region: 'lawn', prefab: 'oak_tree', position: [-14, 0, 9], rotationY: 0.2, scale: 1.05 },
  { region: 'lawn', prefab: 'oak_tree', position: [14, 0, 9], rotationY: -0.4, scale: 1.1 },
  { region: 'lawn', prefab: 'willow_tree', position: [-14, 0, 20], rotationY: 0.55, scale: 0.92 },
  { region: 'lawn', prefab: 'oak_tree', position: [14, 0, 20], rotationY: -0.1, scale: 1.0 },
  { region: 'lawn', prefab: 'grass_clump', position: [-12.2, 0, 11.2], scale: 1.6 },
  { region: 'lawn', prefab: 'grass_clump', position: [12.4, 0, 10.7], scale: 1.5 },
  { region: 'lawn', prefab: 'grass_clump', position: [-8.6, 0, 20.2], scale: 1.7 },
  { region: 'lawn', prefab: 'grass_clump', position: [8.9, 0, 20.4], scale: 1.6 },
  { region: 'lawn', prefab: 'shrub_patch', position: [-10.4, 0, 13.4], rotationY: 0.5, scale: 1.1 },
  { region: 'lawn', prefab: 'shrub_patch', position: [10.8, 0, 13.7], rotationY: -0.4, scale: 1.05 },
  { region: 'lawn', prefab: 'magic_lantern', position: [-12, 3.0, 7.5], scale: 1.0 },
  { region: 'lawn', prefab: 'magic_lantern', position: [12, 3.0, 7.5], scale: 1.0 },

  { region: 'lake', prefab: 'dock_segment', position: [-6, 0.02, 16], rotationY: 0, scale: 1.0 },
  { region: 'lake', prefab: 'dock_segment', position: [-3.55, 0.02, 16], rotationY: 0.02, scale: 1.0 },
  { region: 'lake', prefab: 'willow_tree', position: [-22, 0.28, 24], rotationY: 0.4, scale: 0.65 },
  { region: 'lake', prefab: 'shore_rock_cluster', position: [-9.2, 0, 11.8], rotationY: 0.2, scale: 1.2 },
  { region: 'lake', prefab: 'shore_rock_cluster', position: [-21.5, 0, 14.6], rotationY: -0.3, scale: 1.2 },
  { region: 'lake', prefab: 'shore_rock_cluster', position: [-23.2, 0, 24.8], rotationY: 0.8, scale: 1.1 },
  { region: 'lake', prefab: 'reed_cluster', position: [-7.4, 0, 13.2], scale: 1.2 },
  { region: 'lake', prefab: 'reed_cluster', position: [-22.6, 0, 18.6], rotationY: 0.6, scale: 1.4 },
  { region: 'lake', prefab: 'reed_cluster', position: [-15.6, 0, 26.2], rotationY: -0.2, scale: 1.3 },
  { region: 'lake', prefab: 'lily_cluster', position: [-14.4, 0.02, 18.6], scale: 1.2 },
  { region: 'lake', prefab: 'lily_cluster', position: [-18.2, 0.02, 22.6], rotationY: 0.4, scale: 1.1 },
  { region: 'lake', prefab: 'shrub_patch', position: [-6.2, 0, 20.2], rotationY: -0.2, scale: 0.9 },
];
