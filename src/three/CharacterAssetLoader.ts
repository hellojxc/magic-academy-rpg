import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CharacterKind } from './CharacterRig3D';

export interface CharacterModelManifestEntry {
  enabled?: boolean;
  url?: string;
}

export type CharacterModelManifest = Partial<Record<CharacterKind, CharacterModelManifestEntry>>;
export type CharacterAssetProbeState = 'available' | 'missing' | 'unsupported';

interface ProbeResult {
  state: CharacterAssetProbeState;
  url?: string;
}

const MANIFEST_URL = '/assets/models/character-models.json';
const manifestCache = new Map<string, Promise<CharacterModelManifest | undefined>>();
const probeCache = new Map<string, Promise<ProbeResult>>();

export class CharacterAssetLoader {
  constructor(
    private readonly gltfLoaderFactory: () => GLTFLoader,
    private readonly manifestUrl = MANIFEST_URL
  ) {}

  async resolveModelUrl(kind: CharacterKind): Promise<string | undefined> {
    const manifest = await this.loadManifest();
    const entry = manifest?.[kind];
    if (!entry?.enabled || !entry.url) return undefined;

    const url = entry.url.startsWith('/') ? entry.url : `/assets/models/${entry.url}`;
    const probe = await this.probeModelUrl(url);
    return probe.state === 'available' ? probe.url : undefined;
  }

  async loadGLTF(url: string): Promise<GLTF> {
    return await this.gltfLoaderFactory().loadAsync(url);
  }

  private async loadManifest(): Promise<CharacterModelManifest | undefined> {
    const cached = manifestCache.get(this.manifestUrl);
    if (cached) return cached;

    const promise = fetch(this.manifestUrl, { cache: 'no-cache' })
      .then(async (response) => {
        const contentType = response.headers.get('content-type') ?? '';
        if (!response.ok || contentType.includes('text/html')) return undefined;
        return await response.json() as CharacterModelManifest;
      })
      .catch(() => undefined);
    manifestCache.set(this.manifestUrl, promise);
    return promise;
  }

  private async probeModelUrl(url: string): Promise<ProbeResult> {
    if (!/\.(vrm|glb|gltf)$/i.test(url)) {
      console.warn(`Ignoring unsupported character asset: ${url}`);
      return { state: 'unsupported' };
    }

    const cached = probeCache.get(url);
    if (cached) return cached;

    const promise = fetch(url, { method: 'HEAD', cache: 'no-cache' })
      .then((response): ProbeResult => {
        const contentType = response.headers.get('content-type') ?? '';
        if (response.ok && !contentType.includes('text/html')) return { state: 'available', url };
        return { state: 'missing' };
      })
      .catch((): ProbeResult => ({ state: 'missing' }));
    probeCache.set(url, promise);
    return promise;
  }
}
