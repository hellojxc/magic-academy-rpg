import type { CharacterId } from './CharacterSpec';

export type CharacterAssetFormat = 'glb' | 'vrm';

export type CharacterAssetQuality = 'hero' | 'mid' | 'low';

export interface CharacterAssetEntry {
  readonly id: string;
  readonly characterId: CharacterId;
  readonly enabled: boolean;
  readonly format: CharacterAssetFormat;
  readonly quality: CharacterAssetQuality;
  readonly url: string;
  readonly thumbnailUrl?: string;
  readonly animationClips: readonly string[];
  readonly materialProfile: 'toon' | 'mtoon' | 'standard';
  readonly supportsFacialMorphs: boolean;
  readonly supportsSpringBones: boolean;
  readonly triangleBudget: number;
  readonly textureBudgetKb: number;
}

export interface CharacterLoadStrategy {
  readonly lazyLoad: boolean;
  readonly preloadDistanceMeters: number;
  readonly maxActiveHeroCharacters: number;
  readonly keepFallbackUntilAssetReady: boolean;
}

export interface CharacterAssetManifest {
  readonly version: string;
  readonly loadStrategy: CharacterLoadStrategy;
  readonly assets: readonly CharacterAssetEntry[];
}

export const defaultCharacterAssetManifest: CharacterAssetManifest = {
  version: 'character-assets-v1',
  loadStrategy: {
    lazyLoad: true,
    preloadDistanceMeters: 18,
    maxActiveHeroCharacters: 2,
    keepFallbackUntilAssetReady: true,
  },
  assets: [
    {
      id: 'player-hero-v1',
      characterId: 'player',
      enabled: true,
      format: 'glb',
      quality: 'hero',
      url: '/assets/models/player.glb',
      thumbnailUrl: '/assets/portraits/player-3d.png',
      animationClips: ['idle', 'walk', 'talk'],
      materialProfile: 'toon',
      supportsFacialMorphs: true,
      supportsSpringBones: true,
      triangleBudget: 48000,
      textureBudgetKb: 4096,
    },
    {
      id: 'lyra-hero-v1',
      characterId: 'lyra',
      enabled: true,
      format: 'glb',
      quality: 'hero',
      url: '/assets/models/lyra.glb',
      thumbnailUrl: '/assets/portraits/lyra-3d.png',
      animationClips: ['idle', 'walk', 'talk'],
      materialProfile: 'toon',
      supportsFacialMorphs: true,
      supportsSpringBones: true,
      triangleBudget: 66000,
      textureBudgetKb: 4096,
    },
    {
      id: 'mira-voss-supporting-v1',
      characterId: 'mira_voss',
      enabled: true,
      format: 'glb',
      quality: 'mid',
      url: '/assets/models/mira_voss.glb',
      thumbnailUrl: '/assets/models/mira_voss.blender-template.png',
      animationClips: ['idle', 'walk', 'talk'],
      materialProfile: 'toon',
      supportsFacialMorphs: true,
      supportsSpringBones: true,
      triangleBudget: 32000,
      textureBudgetKb: 2048,
    },
    {
      id: 'mature-senpai-production-v1',
      characterId: 'mature_senpai',
      enabled: false,
      format: 'glb',
      quality: 'hero',
      url: '/assets/models/mature_senpai_production_v1.glb',
      thumbnailUrl: '/assets/models/mature_senpai_production_v1.png',
      animationClips: ['idle', 'walk', 'talk'],
      materialProfile: 'toon',
      supportsFacialMorphs: true,
      supportsSpringBones: true,
      triangleBudget: 76000,
      textureBudgetKb: 2048,
    },
    {
      id: 'mature-senpai-commercial-v26',
      characterId: 'mature_senpai',
      enabled: true,
      format: 'glb',
      quality: 'hero',
      url: '/assets/models/mature_senpai_commercial_v26.glb',
      thumbnailUrl: '/assets/models/mature_senpai_commercial_v26.png',
      animationClips: [
        'idle',
        'walk',
        'talk',
        'v17_deformation_stress',
        'v17_secondary_sway_test',
      ],
      materialProfile: 'toon',
      supportsFacialMorphs: true,
      supportsSpringBones: true,
      triangleBudget: 65000,
      textureBudgetKb: 37000,
    },
    {
      id: 'mature-senpai-commercial-v17',
      characterId: 'mature_senpai',
      enabled: true,
      format: 'glb',
      quality: 'hero',
      url: '/assets/models/mature_senpai_commercial_v17.glb',
      thumbnailUrl: '/assets/models/mature_senpai_commercial_v17.png',
      animationClips: [
        'idle',
        'walk',
        'talk',
        'v17_deformation_stress',
        'v17_secondary_sway_test',
      ],
      materialProfile: 'toon',
      supportsFacialMorphs: true,
      supportsSpringBones: true,
      triangleBudget: 65000,
      textureBudgetKb: 37000,
    },
    {
      id: 'mature-senpai-commercial-v16',
      characterId: 'mature_senpai',
      enabled: true,
      format: 'glb',
      quality: 'hero',
      url: '/assets/models/mature_senpai_commercial_v16.glb',
      thumbnailUrl: '/assets/models/mature_senpai_commercial_v16.png',
      animationClips: ['idle', 'walk', 'talk'],
      materialProfile: 'toon',
      supportsFacialMorphs: true,
      supportsSpringBones: true,
      triangleBudget: 65000,
      textureBudgetKb: 37000,
    },
    {
      id: 'mature-senpai-commercial-v15',
      characterId: 'mature_senpai',
      enabled: true,
      format: 'glb',
      quality: 'hero',
      url: '/assets/models/mature_senpai_commercial_v15.glb',
      thumbnailUrl: '/assets/models/mature_senpai_commercial_v15.png',
      animationClips: ['idle', 'walk', 'talk'],
      materialProfile: 'toon',
      supportsFacialMorphs: true,
      supportsSpringBones: true,
      triangleBudget: 65000,
      textureBudgetKb: 37000,
    },
    {
      id: 'mature-senpai-commercial-v14',
      characterId: 'mature_senpai',
      enabled: true,
      format: 'glb',
      quality: 'hero',
      url: '/assets/models/mature_senpai_commercial_v14.glb',
      thumbnailUrl: '/assets/models/mature_senpai_commercial_v14.png',
      animationClips: ['idle', 'walk', 'talk'],
      materialProfile: 'toon',
      supportsFacialMorphs: true,
      supportsSpringBones: true,
      triangleBudget: 65000,
      textureBudgetKb: 37000,
    },
    {
      id: 'mature-senpai-commercial-v12',
      characterId: 'mature_senpai',
      enabled: true,
      format: 'glb',
      quality: 'hero',
      url: '/assets/models/mature_senpai_commercial_v12.glb',
      thumbnailUrl: '/assets/models/mature_senpai_commercial_v12.png',
      animationClips: ['idle', 'walk', 'talk'],
      materialProfile: 'toon',
      supportsFacialMorphs: true,
      supportsSpringBones: true,
      triangleBudget: 65000,
      textureBudgetKb: 37000,
    },
    {
      id: 'mature-senpai-commercial-v11',
      characterId: 'mature_senpai',
      enabled: true,
      format: 'glb',
      quality: 'hero',
      url: '/assets/models/mature_senpai_commercial_v11.glb',
      thumbnailUrl: '/assets/models/mature_senpai_commercial_v11.png',
      animationClips: ['idle', 'walk', 'talk'],
      materialProfile: 'toon',
      supportsFacialMorphs: true,
      supportsSpringBones: true,
      triangleBudget: 62000,
      textureBudgetKb: 36000,
    },
    {
      id: 'mature-senpai-commercial-v10',
      characterId: 'mature_senpai',
      enabled: true,
      format: 'glb',
      quality: 'hero',
      url: '/assets/models/mature_senpai_commercial_v10.glb',
      thumbnailUrl: '/assets/models/mature_senpai_commercial_v10.png',
      animationClips: ['idle', 'walk', 'talk'],
      materialProfile: 'toon',
      supportsFacialMorphs: true,
      supportsSpringBones: true,
      triangleBudget: 62000,
      textureBudgetKb: 36000,
    },
    {
      id: 'mature-senpai-commercial-v9',
      characterId: 'mature_senpai',
      enabled: true,
      format: 'glb',
      quality: 'hero',
      url: '/assets/models/mature_senpai_commercial_v9.glb',
      thumbnailUrl: '/assets/models/mature_senpai_commercial_v9.png',
      animationClips: ['idle', 'walk', 'talk'],
      materialProfile: 'toon',
      supportsFacialMorphs: true,
      supportsSpringBones: true,
      triangleBudget: 62000,
      textureBudgetKb: 36000,
    },
    {
      id: 'mature-senpai-commercial-v8',
      characterId: 'mature_senpai',
      enabled: true,
      format: 'glb',
      quality: 'hero',
      url: '/assets/models/mature_senpai_commercial_v8.glb',
      thumbnailUrl: '/assets/models/mature_senpai_commercial_v8.png',
      animationClips: ['idle', 'walk', 'talk'],
      materialProfile: 'toon',
      supportsFacialMorphs: true,
      supportsSpringBones: true,
      triangleBudget: 62000,
      textureBudgetKb: 36000,
    },
    {
      id: 'mature-senpai-commercial-v7',
      characterId: 'mature_senpai',
      enabled: true,
      format: 'glb',
      quality: 'hero',
      url: '/assets/models/mature_senpai_commercial_v7.glb',
      thumbnailUrl: '/assets/models/mature_senpai_commercial_v7.png',
      animationClips: ['idle', 'walk', 'talk'],
      materialProfile: 'toon',
      supportsFacialMorphs: true,
      supportsSpringBones: true,
      triangleBudget: 60000,
      textureBudgetKb: 36000,
    },
    {
      id: 'mature-senpai-commercial-v6',
      characterId: 'mature_senpai',
      enabled: true,
      format: 'glb',
      quality: 'hero',
      url: '/assets/models/mature_senpai_commercial_v6.glb',
      thumbnailUrl: '/assets/models/mature_senpai_commercial_v6.png',
      animationClips: ['idle', 'walk', 'talk'],
      materialProfile: 'toon',
      supportsFacialMorphs: true,
      supportsSpringBones: true,
      triangleBudget: 60000,
      textureBudgetKb: 36000,
    },
    {
      id: 'mature-senpai-commercial-v5',
      characterId: 'mature_senpai',
      enabled: true,
      format: 'glb',
      quality: 'hero',
      url: '/assets/models/mature_senpai_commercial_v5.glb',
      thumbnailUrl: '/assets/models/mature_senpai_commercial_v5.png',
      animationClips: ['idle', 'walk', 'talk'],
      materialProfile: 'toon',
      supportsFacialMorphs: true,
      supportsSpringBones: true,
      triangleBudget: 60000,
      textureBudgetKb: 36000,
    },
    {
      id: 'mature-senpai-commercial-v4',
      characterId: 'mature_senpai',
      enabled: true,
      format: 'glb',
      quality: 'hero',
      url: '/assets/models/mature_senpai_commercial_v4.glb',
      thumbnailUrl: '/assets/models/mature_senpai_commercial_v4.png',
      animationClips: ['idle', 'walk', 'talk'],
      materialProfile: 'toon',
      supportsFacialMorphs: true,
      supportsSpringBones: true,
      triangleBudget: 60000,
      textureBudgetKb: 36000,
    },
    {
      id: 'mature-senpai-retopo-v3',
      characterId: 'mature_senpai',
      enabled: true,
      format: 'glb',
      quality: 'hero',
      url: '/assets/models/mature_senpai_retopo_v3.glb',
      thumbnailUrl: '/assets/models/mature_senpai_retopo_v3.png',
      animationClips: ['idle', 'walk', 'talk'],
      materialProfile: 'toon',
      supportsFacialMorphs: true,
      supportsSpringBones: true,
      triangleBudget: 60000,
      textureBudgetKb: 43000,
    },
    {
      id: 'mature-senpai-mcp-polish-v2',
      characterId: 'mature_senpai',
      enabled: true,
      format: 'glb',
      quality: 'hero',
      url: '/assets/models/mature_senpai_mcp_polish_v2.glb',
      thumbnailUrl: '/assets/models/mature_senpai_mcp_polish_v2.png',
      animationClips: ['idle', 'walk', 'talk'],
      materialProfile: 'toon',
      supportsFacialMorphs: false,
      supportsSpringBones: true,
      triangleBudget: 60000,
      textureBudgetKb: 34816,
    },
    {
      id: 'mature-senpai-mcp-retouch-v1',
      characterId: 'mature_senpai',
      enabled: true,
      format: 'glb',
      quality: 'hero',
      url: '/assets/models/mature_senpai_mcp_retouch_v1.glb',
      thumbnailUrl: '/assets/models/mature_senpai_mcp_retouch_v1.png',
      animationClips: ['idle', 'walk', 'talk'],
      materialProfile: 'toon',
      supportsFacialMorphs: false,
      supportsSpringBones: true,
      triangleBudget: 60000,
      textureBudgetKb: 34816,
    },
    {
      id: 'mature-senpai-rigged-v1',
      characterId: 'mature_senpai',
      enabled: true,
      format: 'glb',
      quality: 'hero',
      url: '/assets/models/mature_senpai_rigged_v1.glb',
      thumbnailUrl: '/assets/portraits/mature-senpai-v7.png',
      animationClips: ['idle', 'walk', 'talk'],
      materialProfile: 'toon',
      supportsFacialMorphs: false,
      supportsSpringBones: true,
      triangleBudget: 60000,
      textureBudgetKb: 34816,
    },
  ],
};

const manifestCache = new Map<string, Promise<CharacterAssetManifest>>();

export function getCharacterAsset(
  manifest: CharacterAssetManifest,
  characterId: CharacterId,
): CharacterAssetEntry | undefined {
  return manifest.assets.find((asset) => asset.characterId === characterId && asset.enabled);
}

export function getDeclaredCharacterAsset(
  manifest: CharacterAssetManifest,
  assetId: string,
): CharacterAssetEntry | undefined {
  return manifest.assets.find((asset) => asset.id === assetId);
}

export async function loadCharacterAssetManifest(
  manifestUrl = '/assets/models/character-models.json',
): Promise<CharacterAssetManifest> {
  const cached = manifestCache.get(manifestUrl);
  if (cached) return cached;

  const request = fetchCharacterAssetManifest(manifestUrl);
  manifestCache.set(manifestUrl, request);
  return request;
}

async function fetchCharacterAssetManifest(manifestUrl: string): Promise<CharacterAssetManifest> {
  try {
    const response = await fetch(manifestUrl, { cache: 'no-cache' });
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || contentType.includes('text/html')) return defaultCharacterAssetManifest;

    const data = await response.json() as unknown;
    return normalizeCharacterAssetManifest(data);
  } catch {
    return defaultCharacterAssetManifest;
  }
}

export function normalizeCharacterAssetManifest(data: unknown): CharacterAssetManifest {
  if (!isRecord(data)) return defaultCharacterAssetManifest;

  if (Array.isArray(data.assets)) {
    return {
      version: typeof data.version === 'string' ? data.version : defaultCharacterAssetManifest.version,
      loadStrategy: normalizeLoadStrategy(data.loadStrategy),
      assets: data.assets
        .map(normalizeAssetEntry)
        .filter((asset): asset is CharacterAssetEntry => asset !== undefined),
    };
  }

  return normalizeLegacyManifest(data);
}

function normalizeLoadStrategy(value: unknown): CharacterLoadStrategy {
  if (!isRecord(value)) return defaultCharacterAssetManifest.loadStrategy;
  const fallback = defaultCharacterAssetManifest.loadStrategy;

  return {
    lazyLoad: typeof value.lazyLoad === 'boolean' ? value.lazyLoad : fallback.lazyLoad,
    preloadDistanceMeters:
      typeof value.preloadDistanceMeters === 'number'
        ? value.preloadDistanceMeters
        : fallback.preloadDistanceMeters,
    maxActiveHeroCharacters:
      typeof value.maxActiveHeroCharacters === 'number'
        ? value.maxActiveHeroCharacters
        : fallback.maxActiveHeroCharacters,
    keepFallbackUntilAssetReady:
      typeof value.keepFallbackUntilAssetReady === 'boolean'
        ? value.keepFallbackUntilAssetReady
        : fallback.keepFallbackUntilAssetReady,
  };
}

function normalizeAssetEntry(value: unknown): CharacterAssetEntry | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.characterId !== 'string' || value.characterId.length === 0) return undefined;
  if (value.format !== 'glb' && value.format !== 'vrm') return undefined;
  if (value.quality !== 'hero' && value.quality !== 'mid' && value.quality !== 'low') return undefined;
  if (typeof value.id !== 'string' || typeof value.url !== 'string') return undefined;

  return {
    id: value.id,
    characterId: value.characterId,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : false,
    format: value.format,
    quality: value.quality,
    url: value.url,
    thumbnailUrl: typeof value.thumbnailUrl === 'string' ? value.thumbnailUrl : undefined,
    animationClips: normalizeStringArray(value.animationClips),
    materialProfile: normalizeMaterialProfile(value.materialProfile),
    supportsFacialMorphs:
      typeof value.supportsFacialMorphs === 'boolean' ? value.supportsFacialMorphs : false,
    supportsSpringBones:
      typeof value.supportsSpringBones === 'boolean' ? value.supportsSpringBones : false,
    triangleBudget: typeof value.triangleBudget === 'number' ? value.triangleBudget : 0,
    textureBudgetKb: typeof value.textureBudgetKb === 'number' ? value.textureBudgetKb : 0,
  };
}

function normalizeLegacyManifest(data: Record<string, unknown>): CharacterAssetManifest {
  const assets = defaultCharacterAssetManifest.assets.map((asset) => {
    const legacy = data[asset.characterId];
    if (!isRecord(legacy)) return asset;
    const url = typeof legacy.url === 'string' ? legacy.url : asset.url;

    return {
      ...asset,
      enabled: typeof legacy.enabled === 'boolean' ? legacy.enabled : asset.enabled,
      url: url.startsWith('/') ? url : `/assets/models/${url}`,
      format: /\.(vrm)$/i.test(url) ? 'vrm' : asset.format,
    } satisfies CharacterAssetEntry;
  });

  return {
    ...defaultCharacterAssetManifest,
    version: 'legacy-character-assets',
    assets,
  };
}

function normalizeStringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeMaterialProfile(value: unknown): CharacterAssetEntry['materialProfile'] {
  if (value === 'toon' || value === 'mtoon' || value === 'standard') return value;
  return 'toon';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
