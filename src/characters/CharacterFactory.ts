import {
  defaultCharacterAssetManifest,
  getCharacterAsset,
  type CharacterAssetEntry,
  type CharacterAssetManifest,
} from './CharacterManifest';
import type { CharacterSpec } from './CharacterSpec';
import { resolveCharacterLod, type CharacterLodTier } from './runtime/CharacterRuntime';

export type CharacterBuildSource = 'optimized-asset' | 'procedural-fallback';

export interface CharacterBuildPlan {
  readonly characterId: CharacterSpec['id'];
  readonly displayName: string;
  readonly source: CharacterBuildSource;
  readonly asset?: CharacterAssetEntry;
  readonly fallbackRigId: string;
  readonly lodTier: CharacterLodTier;
  readonly needsFacialController: boolean;
  readonly needsSecondaryMotion: boolean;
  readonly animationSet: string;
}

export interface CharacterBuildPlanOptions {
  readonly manifest?: CharacterAssetManifest;
  readonly distanceToCameraMeters?: number;
}

export function createCharacterBuildPlan(
  spec: CharacterSpec,
  options: CharacterBuildPlanOptions = {},
): CharacterBuildPlan {
  const manifest = options.manifest ?? defaultCharacterAssetManifest;
  const distanceToCameraMeters = options.distanceToCameraMeters ?? 0;
  const asset = getCharacterAsset(manifest, spec.id);

  return {
    characterId: spec.id,
    displayName: spec.displayName,
    source: asset ? 'optimized-asset' : 'procedural-fallback',
    asset,
    fallbackRigId: spec.runtime.fallbackRigId,
    lodTier: resolveCharacterLod(distanceToCameraMeters),
    needsFacialController: asset?.supportsFacialMorphs ?? true,
    needsSecondaryMotion:
      asset?.supportsSpringBones ?? spec.animation.secondaryMotion.length > 0,
    animationSet: spec.animation.locomotionSet,
  };
}
