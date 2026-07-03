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
      animationClips: ['idle', 'walk'],
      materialProfile: 'toon',
      supportsFacialMorphs: false,
      supportsSpringBones: false,
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
      animationClips: ['idle', 'walk'],
      materialProfile: 'toon',
      supportsFacialMorphs: false,
      supportsSpringBones: false,
      triangleBudget: 66000,
      textureBudgetKb: 4096,
    },
  ],
};

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
  if (value.characterId !== 'player' && value.characterId !== 'lyra') return undefined;
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
