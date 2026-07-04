export type WorldChunkId =
  | 'atrium'
  | 'arcane-library'
  | 'grand-hall'
  | 'dining-hall'
  | 'moonlit-lawn'
  | 'lake-grotto'
  | 'training-yard'
  | 'crystal-greenhouse';

export interface Vec3Tuple {
  readonly 0: number;
  readonly 1: number;
  readonly 2: number;
}

export interface Bounds2D {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface WorldChunkDefinition {
  readonly id: WorldChunkId;
  readonly label: string;
  readonly region: 'interior' | 'exterior' | 'cavern' | 'combat';
  readonly origin: Vec3Tuple;
  readonly bounds: Bounds2D;
  readonly streamingRadius: number;
  readonly glb: string;
  readonly collisionGlb: string;
  readonly lightmap: string;
  readonly fallbackPrefabRegion?: 'atrium' | 'library' | 'grand_hall' | 'dining_hall' | 'lawn' | 'lake';
  readonly heroLight: Vec3Tuple;
  readonly palette: {
    readonly floor: number;
    readonly wall: number;
    readonly accent: number;
    readonly emissive: number;
  };
}

export interface VegetationScatter {
  readonly id: string;
  readonly chunkId: WorldChunkId;
  readonly count: number;
  readonly bounds: Bounds2D;
  readonly baseScale: number;
  readonly colorA: number;
  readonly colorB: number;
}

export interface DecalDefinition {
  readonly id: string;
  readonly chunkId: WorldChunkId;
  readonly position: Vec3Tuple;
  readonly rotation: Vec3Tuple;
  readonly scale: Vec3Tuple;
  readonly color: number;
  readonly opacity: number;
}

export interface NpcSceneDefinition {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly area: string;
  readonly position: Vec3Tuple;
  readonly color: number;
}

export const WORLD_ASSET_ROOT = '/assets/world';
const MAX_STREAMED_CHUNKS = 8;

export const WORLD_CHUNKS: readonly WorldChunkDefinition[] = [
  {
    id: 'atrium',
    label: '学院中庭',
    region: 'interior',
    origin: [0, 0, 0],
    bounds: { minX: -11, maxX: 11, minZ: -8, maxZ: 8 },
    streamingRadius: 28,
    glb: `${WORLD_ASSET_ROOT}/chunks/optimized/atrium.high.optimized.glb`,
    collisionGlb: `${WORLD_ASSET_ROOT}/chunks/optimized/atrium.collision.optimized.glb`,
    lightmap: `${WORLD_ASSET_ROOT}/lightmaps/atrium.lightmap.png`,
    fallbackPrefabRegion: 'atrium',
    heroLight: [-5.8, 4.4, -4.2],
    palette: { floor: 0x7d7189, wall: 0x9d8eaa, accent: 0xd9b267, emissive: 0x8ac7ff },
  },
  {
    id: 'arcane-library',
    label: '秘法图书馆',
    region: 'interior',
    origin: [5.6, 0, -2.4],
    bounds: { minX: 2, maxX: 10, minZ: -7, maxZ: 2 },
    streamingRadius: 24,
    glb: `${WORLD_ASSET_ROOT}/chunks/optimized/arcane-library.high.optimized.glb`,
    collisionGlb: `${WORLD_ASSET_ROOT}/chunks/optimized/arcane-library.collision.optimized.glb`,
    lightmap: `${WORLD_ASSET_ROOT}/lightmaps/arcane-library.lightmap.png`,
    fallbackPrefabRegion: 'library',
    heroLight: [8.2, 3.4, -3.4],
    palette: { floor: 0x514356, wall: 0x75607d, accent: 0xb9824f, emissive: 0xc78aff },
  },
  {
    id: 'grand-hall',
    label: '星穹礼堂',
    region: 'interior',
    origin: [0, 0, -15.5],
    bounds: { minX: -12.5, maxX: 12.5, minZ: -23, maxZ: -8 },
    streamingRadius: 32,
    glb: `${WORLD_ASSET_ROOT}/chunks/optimized/grand-hall.high.optimized.glb`,
    collisionGlb: `${WORLD_ASSET_ROOT}/chunks/optimized/grand-hall.collision.optimized.glb`,
    lightmap: `${WORLD_ASSET_ROOT}/lightmaps/grand-hall.lightmap.png`,
    fallbackPrefabRegion: 'grand_hall',
    heroLight: [0, 6.2, -19.4],
    palette: { floor: 0x686077, wall: 0x9484a2, accent: 0xe0bd75, emissive: 0x8feaff },
  },
  {
    id: 'dining-hall',
    label: '烛火餐厅',
    region: 'interior',
    origin: [17, 0, 0.5],
    bounds: { minX: 11, maxX: 24, minZ: -7, maxZ: 7 },
    streamingRadius: 28,
    glb: `${WORLD_ASSET_ROOT}/chunks/optimized/dining-hall.high.optimized.glb`,
    collisionGlb: `${WORLD_ASSET_ROOT}/chunks/optimized/dining-hall.collision.optimized.glb`,
    lightmap: `${WORLD_ASSET_ROOT}/lightmaps/dining-hall.lightmap.png`,
    fallbackPrefabRegion: 'dining_hall',
    heroLight: [23, 3.1, -3.2],
    palette: { floor: 0x654b3d, wall: 0x8d735f, accent: 0xd89d5e, emissive: 0xffb066 },
  },
  {
    id: 'moonlit-lawn',
    label: '月光草坪',
    region: 'exterior',
    origin: [0, 0, 16],
    bounds: { minX: -16, maxX: 16, minZ: 7, maxZ: 26 },
    streamingRadius: 34,
    glb: `${WORLD_ASSET_ROOT}/chunks/optimized/moonlit-lawn.high.optimized.glb`,
    collisionGlb: `${WORLD_ASSET_ROOT}/chunks/optimized/moonlit-lawn.collision.optimized.glb`,
    lightmap: `${WORLD_ASSET_ROOT}/lightmaps/moonlit-lawn.lightmap.png`,
    fallbackPrefabRegion: 'lawn',
    heroLight: [-8.5, 5.8, 12],
    palette: { floor: 0x41634a, wall: 0x526b5c, accent: 0xa5d07f, emissive: 0xa0c7ff },
  },
  {
    id: 'lake-grotto',
    label: '湖畔晶洞',
    region: 'cavern',
    origin: [-16, 0, 21],
    bounds: { minX: -25, maxX: -5, minZ: 10, maxZ: 30 },
    streamingRadius: 34,
    glb: `${WORLD_ASSET_ROOT}/chunks/optimized/lake-grotto.high.optimized.glb`,
    collisionGlb: `${WORLD_ASSET_ROOT}/chunks/optimized/lake-grotto.collision.optimized.glb`,
    lightmap: `${WORLD_ASSET_ROOT}/lightmaps/lake-grotto.lightmap.png`,
    fallbackPrefabRegion: 'lake',
    heroLight: [-18.5, 3.1, 22],
    palette: { floor: 0x334d63, wall: 0x4f6679, accent: 0x7ac7d8, emissive: 0x76f0ff },
  },
  {
    id: 'training-yard',
    label: '训练庭院',
    region: 'combat',
    origin: [17, 0, 33],
    bounds: { minX: 9, maxX: 25, minZ: 26, maxZ: 40 },
    streamingRadius: 38,
    glb: `${WORLD_ASSET_ROOT}/chunks/optimized/training-yard.high.optimized.glb`,
    collisionGlb: `${WORLD_ASSET_ROOT}/chunks/optimized/training-yard.collision.optimized.glb`,
    lightmap: `${WORLD_ASSET_ROOT}/lightmaps/training-yard.lightmap.png`,
    heroLight: [14, 4.5, 29],
    palette: { floor: 0x6b6255, wall: 0x817568, accent: 0xbe8c55, emissive: 0xffd57b },
  },
  {
    id: 'crystal-greenhouse',
    label: '水晶温室',
    region: 'exterior',
    origin: [-31, 0, 5],
    bounds: { minX: -42, maxX: -21, minZ: -2, maxZ: 13 },
    streamingRadius: 34,
    glb: `${WORLD_ASSET_ROOT}/chunks/optimized/crystal-greenhouse.high.optimized.glb`,
    collisionGlb: `${WORLD_ASSET_ROOT}/chunks/optimized/crystal-greenhouse.collision.optimized.glb`,
    lightmap: `${WORLD_ASSET_ROOT}/lightmaps/crystal-greenhouse.lightmap.png`,
    heroLight: [-33, 4.2, 4],
    palette: { floor: 0x49625c, wall: 0x88a7a1, accent: 0x75c7b7, emissive: 0x9dffd9 },
  },
];

export const NPC_SCENE_DEFINITIONS: readonly NpcSceneDefinition[] = [
  { id: 'lyra', name: 'Lyra', title: '星象学徒', area: '学院中庭', position: [1.8, 0.18, 1.15], color: 0xd49cff },
  { id: 'seren', name: 'Seren', title: '图书馆管理员', area: '秘法图书馆', position: [6.9, 0.18, -2.35], color: 0xffd98a },
  { id: 'kael', name: 'Kael', title: '战斗导师', area: '训练庭院', position: [17, 0.18, 32], color: 0xff986b },
  { id: 'mira', name: 'Mira', title: '温室研究员', area: '水晶温室', position: [-32, 0.18, 4.5], color: 0x85ffd3 },
];

export const VEGETATION_SCATTERS: readonly VegetationScatter[] = [
  {
    id: 'lawn-layered-grass',
    chunkId: 'moonlit-lawn',
    count: 620,
    bounds: { minX: -15, maxX: 15, minZ: 8, maxZ: 25 },
    baseScale: 0.96,
    colorA: 0xa8c977,
    colorB: 0x335f43,
  },
  {
    id: 'lake-reeds',
    chunkId: 'lake-grotto',
    count: 380,
    bounds: { minX: -24, maxX: -7, minZ: 12, maxZ: 29 },
    baseScale: 1.18,
    colorA: 0xa4bf7a,
    colorB: 0x3c6d5f,
  },
  {
    id: 'greenhouse-ferns',
    chunkId: 'crystal-greenhouse',
    count: 230,
    bounds: { minX: -41, maxX: -23, minZ: -1, maxZ: 12 },
    baseScale: 0.74,
    colorA: 0x8dce8c,
    colorB: 0x3d7d59,
  },
  {
    id: 'training-yard-weeds',
    chunkId: 'training-yard',
    count: 120,
    bounds: { minX: 10, maxX: 24, minZ: 27, maxZ: 39 },
    baseScale: 0.56,
    colorA: 0x8f9f70,
    colorB: 0x4f6544,
  },
  {
    id: 'atrium-corner-ferns',
    chunkId: 'atrium',
    count: 70,
    bounds: { minX: -10, maxX: 10, minZ: -7, maxZ: 7 },
    baseScale: 0.5,
    colorA: 0x6f9f70,
    colorB: 0x355c45,
  },
];

export const DECALS: readonly DecalDefinition[] = [
  {
    id: 'atrium-worn-rune',
    chunkId: 'atrium',
    position: [0, 0.091, 2.25],
    rotation: [-Math.PI / 2, 0, 0.08],
    scale: [2.2, 2.2, 0.12],
    color: 0xe9d27c,
    opacity: 0.32,
  },
  {
    id: 'atrium-cold-shadow-grime',
    chunkId: 'atrium',
    position: [-4.6, 0.153, -1.5],
    rotation: [-Math.PI / 2, 0, -0.32],
    scale: [3.2, 1.35, 0.12],
    color: 0x202633,
    opacity: 0.28,
  },
  {
    id: 'atrium-gold-inlay-wear',
    chunkId: 'atrium',
    position: [3.8, 0.155, 3.0],
    rotation: [-Math.PI / 2, 0, 0.44],
    scale: [2.4, 0.64, 0.12],
    color: 0xb79a55,
    opacity: 0.24,
  },
  {
    id: 'library-ink-spill',
    chunkId: 'arcane-library',
    position: [5.6, 0.156, -2.6],
    rotation: [-Math.PI / 2, 0, 0.21],
    scale: [1.5, 0.88, 0.12],
    color: 0x171221,
    opacity: 0.46,
  },
  {
    id: 'library-violet-dust',
    chunkId: 'arcane-library',
    position: [8.4, 0.154, -5.2],
    rotation: [-Math.PI / 2, 0, -0.18],
    scale: [2.5, 1.1, 0.12],
    color: 0x4f3d63,
    opacity: 0.26,
  },
  {
    id: 'grand-hall-crack',
    chunkId: 'grand-hall',
    position: [-3.4, 0.091, -14.4],
    rotation: [-Math.PI / 2, 0, -0.2],
    scale: [2.8, 1.2, 0.12],
    color: 0x362f3c,
    opacity: 0.4,
  },
  {
    id: 'grand-hall-worn-carpet-shadow',
    chunkId: 'grand-hall',
    position: [2.4, 0.154, -18.2],
    rotation: [-Math.PI / 2, 0, 0.08],
    scale: [3.9, 1.2, 0.12],
    color: 0x201824,
    opacity: 0.34,
  },
  {
    id: 'dining-hall-soot-track',
    chunkId: 'dining-hall',
    position: [21.2, 0.154, -0.8],
    rotation: [-Math.PI / 2, 0, Math.PI / 2],
    scale: [3.2, 1.0, 0.12],
    color: 0x231813,
    opacity: 0.42,
  },
  {
    id: 'dining-hall-spilled-wine',
    chunkId: 'dining-hall',
    position: [16.3, 0.156, 3.7],
    rotation: [-Math.PI / 2, 0, -0.36],
    scale: [1.25, 0.74, 0.12],
    color: 0x5a1f2b,
    opacity: 0.44,
  },
  {
    id: 'moonlit-lawn-damp-grass-shadow',
    chunkId: 'moonlit-lawn',
    position: [-6.4, 0.154, 16.4],
    rotation: [-Math.PI / 2, 0, 0.28],
    scale: [4.2, 1.8, 0.12],
    color: 0x1d3a2a,
    opacity: 0.34,
  },
  {
    id: 'moonlit-lawn-pale-pollen',
    chunkId: 'moonlit-lawn',
    position: [6.7, 0.157, 19.8],
    rotation: [-Math.PI / 2, 0, -0.24],
    scale: [2.6, 1.3, 0.12],
    color: 0xb7cf8d,
    opacity: 0.22,
  },
  {
    id: 'lake-grotto-wet-edge',
    chunkId: 'lake-grotto',
    position: [-15.6, 0.157, 18.4],
    rotation: [-Math.PI / 2, 0, 0.1],
    scale: [5.0, 1.1, 0.12],
    color: 0x2f6e7d,
    opacity: 0.38,
  },
  {
    id: 'lake-grotto-mineral-stain',
    chunkId: 'lake-grotto',
    position: [-21.8, 0.157, 25.5],
    rotation: [-Math.PI / 2, 0, -0.55],
    scale: [2.4, 1.0, 0.12],
    color: 0x83ced4,
    opacity: 0.22,
  },
  {
    id: 'training-yard-impact',
    chunkId: 'training-yard',
    position: [17.2, 0.091, 35.2],
    rotation: [-Math.PI / 2, 0, 0.42],
    scale: [3.1, 2.4, 0.12],
    color: 0x302a24,
    opacity: 0.38,
  },
  {
    id: 'training-yard-chalk-ring-wear',
    chunkId: 'training-yard',
    position: [14.2, 0.154, 32.2],
    rotation: [-Math.PI / 2, 0, 0.32],
    scale: [2.8, 0.85, 0.12],
    color: 0xc8bd98,
    opacity: 0.34,
  },
  {
    id: 'greenhouse-leaf-litter',
    chunkId: 'crystal-greenhouse',
    position: [-31.2, 0.156, 5.0],
    rotation: [-Math.PI / 2, 0, -0.2],
    scale: [3.5, 1.4, 0.12],
    color: 0x2f6b4b,
    opacity: 0.36,
  },
  {
    id: 'greenhouse-watered-soil',
    chunkId: 'crystal-greenhouse',
    position: [-36.8, 0.157, 8.2],
    rotation: [-Math.PI / 2, 0, 0.15],
    scale: [2.6, 1.2, 0.12],
    color: 0x203c34,
    opacity: 0.42,
  },
];

export const WORLD_PIPELINE = {
  blenderScene: 'assets/world/magic-academy.blend',
  chunkPrefix: 'chunk_',
  collisionSuffix: '.collision',
  optimizedDir: `${WORLD_ASSET_ROOT}/chunks/optimized`,
  textureTargets: ['baseColor', 'normal', 'roughness', 'metallic', 'ao', 'emissive'],
} as const;

export function getChunkCenter(chunk: WorldChunkDefinition): { x: number; z: number } {
  return {
    x: (chunk.bounds.minX + chunk.bounds.maxX) / 2,
    z: (chunk.bounds.minZ + chunk.bounds.maxZ) / 2,
  };
}

export function getActiveChunks(player: { x: number; z: number }): readonly WorldChunkDefinition[] {
  return WORLD_CHUNKS
    .map((chunk) => {
      const center = getChunkCenter(chunk);
      const dx = center.x - player.x;
      const dz = center.z - player.z;
      return { chunk, distance: Math.hypot(dx, dz) };
    })
    .filter(({ chunk, distance }) => distance <= chunk.streamingRadius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_STREAMED_CHUNKS)
    .map(({ chunk }) => chunk);
}
