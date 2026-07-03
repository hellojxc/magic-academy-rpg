import type { FoliageFieldSpec, GroundDecalSpec, TreeSpec } from './EnvironmentDetailKit';

export const LAWN_TREE_SPECS: TreeSpec[] = [
  { x: -14, z: 9, scale: 1.05, seed: 1101, variant: 'oak', rotation: 0.2 },
  { x: 14, z: 9, scale: 1.12, seed: 1102, variant: 'maple', rotation: -0.4 },
  { x: -14, z: 20, scale: 0.92, seed: 1103, variant: 'willow', rotation: 0.6 },
  { x: 14, z: 20, scale: 1.02, seed: 1104, variant: 'oak', rotation: -0.1 },
  { x: -7, z: 21, scale: 0.86, seed: 1105, variant: 'maple', rotation: 0.85 },
  { x: 7, z: 21, scale: 0.96, seed: 1106, variant: 'willow', rotation: -0.75 },
  { x: -5, z: 8.5, scale: 0.84, seed: 1107, variant: 'oak', rotation: 0.35 },
  { x: 5, z: 8.5, scale: 0.88, seed: 1108, variant: 'maple', rotation: -0.3 },
];

export const LAWN_GROUND_DECALS: GroundDecalSpec[] = [
  { x: -12.8, z: 12.2, radiusX: 2.2, radiusZ: 0.8, color: 0x2f5f2d, opacity: 0.26, seed: 2001 },
  { x: 11.6, z: 12.9, radiusX: 2.0, radiusZ: 0.7, color: 0x547838, opacity: 0.22, seed: 2002 },
  { x: -7.2, z: 15.4, radiusX: 1.4, radiusZ: 0.42, color: 0x604a2f, opacity: 0.2, seed: 2003 },
  { x: 8.6, z: 16.2, radiusX: 1.7, radiusZ: 0.5, color: 0x365b2b, opacity: 0.23, seed: 2004 },
  { x: -2.4, z: 20.6, radiusX: 1.1, radiusZ: 0.34, color: 0x6f6940, opacity: 0.18, seed: 2005 },
  { x: 2.6, z: 10.4, radiusX: 1.2, radiusZ: 0.38, color: 0x5a4d2d, opacity: 0.2, seed: 2006 },
];

export const LAWN_FOLIAGE_FIELDS: FoliageFieldSpec[] = [
  { x: -12.6, z: 10.7, width: 4.2, depth: 3.2, count: 240, seed: 3001, heightMin: 0.22, heightMax: 0.68, colors: [0x2f6d2c, 0x4f8d3f, 0x76a957] },
  { x: 12.6, z: 10.9, width: 4.0, depth: 3.4, count: 220, seed: 3002, heightMin: 0.18, heightMax: 0.58, colors: [0x356f2b, 0x5f9848, 0x86b65c] },
  { x: -10.2, z: 20.2, width: 6.5, depth: 2.7, count: 260, seed: 3003, heightMin: 0.2, heightMax: 0.72, colors: [0x2d6228, 0x5e9142, 0x9ab35d] },
  { x: 10.4, z: 20.0, width: 6.0, depth: 2.8, count: 240, seed: 3004, heightMin: 0.22, heightMax: 0.66, colors: [0x32652b, 0x639646, 0x83ad55] },
];

export const LAKE_BANK_DECALS: GroundDecalSpec[] = [
  { x: -8.0, z: 12.2, radiusX: 3.1, radiusZ: 0.62, color: 0xcbb27a, opacity: 0.26, seed: 4001, y: 0.006 },
  { x: -12.3, z: 10.8, radiusX: 3.6, radiusZ: 0.5, color: 0x566c35, opacity: 0.24, seed: 4002, y: 0.006 },
  { x: -21.4, z: 15.6, radiusX: 2.5, radiusZ: 0.42, color: 0x354d2e, opacity: 0.22, seed: 4003, y: 0.006 },
  { x: -23.0, z: 24.8, radiusX: 2.2, radiusZ: 0.48, color: 0xb99862, opacity: 0.2, seed: 4004, y: 0.006 },
  { x: -15.4, z: 27.0, radiusX: 3.4, radiusZ: 0.56, color: 0x6d623e, opacity: 0.18, seed: 4005, y: 0.006 },
  { x: -5.8, z: 18.2, radiusX: 2.5, radiusZ: 0.52, color: 0x6f8a45, opacity: 0.22, seed: 4006, y: 0.006 },
];

export const LAKE_EDGE_FOLIAGE_FIELDS: FoliageFieldSpec[] = [
  { x: -7.0, z: 13.2, width: 3.8, depth: 5.0, count: 230, seed: 5001, heightMin: 0.28, heightMax: 0.85, colors: [0x47762e, 0x6f8d35, 0x9d9342] },
  { x: -22.2, z: 19.5, width: 3.6, depth: 7.2, count: 260, seed: 5002, heightMin: 0.34, heightMax: 0.95, colors: [0x415f2a, 0x728331, 0x8e7a3f] },
  { x: -15.2, z: 26.2, width: 8.0, depth: 2.8, count: 240, seed: 5003, heightMin: 0.24, heightMax: 0.72, colors: [0x355f2d, 0x66843d, 0x9a8b4d] },
];
