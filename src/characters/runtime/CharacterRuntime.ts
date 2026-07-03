export type CharacterLodTier = 'hero' | 'mid' | 'low' | 'culled';

export type CharacterAnimationState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'turn'
  | 'talk'
  | 'interact'
  | 'emote';

export type CharacterAssetState = 'loading' | 'vrm' | 'gltf' | 'fallback' | 'failed';

export interface CharacterPerformanceBudget {
  readonly heroMaxTriangles: number;
  readonly midMaxTriangles: number;
  readonly lowMaxTriangles: number;
  readonly heroTextureBudgetKb: number;
  readonly midTextureBudgetKb: number;
  readonly maxBones: number;
  readonly maxActiveBlendshapes: number;
  readonly maxShadowCasters: number;
}

export interface CharacterRuntimeState {
  readonly lodTier: CharacterLodTier;
  readonly animationState: CharacterAnimationState;
  readonly hasLoadedHeroAsset: boolean;
  readonly isUsingFallbackRig: boolean;
  readonly distanceToCameraMeters: number;
}

export const defaultCharacterPerformanceBudget: CharacterPerformanceBudget = {
  heroMaxTriangles: 36000,
  midMaxTriangles: 16000,
  lowMaxTriangles: 6000,
  heroTextureBudgetKb: 4096,
  midTextureBudgetKb: 2048,
  maxBones: 80,
  maxActiveBlendshapes: 16,
  maxShadowCasters: 2,
};

export function resolveCharacterLod(distanceToCameraMeters: number): CharacterLodTier {
  if (distanceToCameraMeters > 42) {
    return 'culled';
  }

  if (distanceToCameraMeters > 24) {
    return 'low';
  }

  if (distanceToCameraMeters > 10) {
    return 'mid';
  }

  return 'hero';
}
