export type CharacterId = string;

export type CharacterAssetRole = 'hero' | 'supporting' | 'background';

export type CharacterSilhouette =
  | 'slim-male-academy'
  | 'petite-heroine'
  | 'average-student'
  | 'teacher';

export interface CharacterBodySpec {
  readonly heightMeters: number;
  readonly headToBodyRatio: number;
  readonly silhouette: CharacterSilhouette;
  readonly shoulderWidth: number;
  readonly torsoLength: number;
  readonly waistWidth: number;
  readonly hipWidth: number;
  readonly armLength: number;
  readonly handScale: number;
  readonly legLength: number;
  readonly footScale: number;
}

export interface CharacterFaceSpec {
  readonly eyeShape: string;
  readonly eyeColor: string;
  readonly eyeScale: number;
  readonly browShape: string;
  readonly browColor: string;
  readonly noseBridge: 'soft' | 'defined' | 'stylized-minimal';
  readonly mouthShape: string;
  readonly cheekTint: string;
  readonly expressionSet: readonly string[];
}

export interface CharacterHairSpec {
  readonly color: string;
  readonly highlightColor: string;
  readonly style: string;
  readonly bangs: string;
  readonly length: 'short' | 'medium' | 'long';
  readonly volume: number;
  readonly secondaryMotion: 'none' | 'tips' | 'locks' | 'full';
  readonly accessories: readonly string[];
}

export interface CharacterOutfitSpec {
  readonly style: string;
  readonly primaryColor: string;
  readonly secondaryColor: string;
  readonly accentColor: string;
  readonly torso: string;
  readonly sleeves: string;
  readonly lowerBody: string;
  readonly outerwear: string;
  readonly shoes: string;
  readonly accessories: readonly string[];
  readonly heldItems: readonly string[];
}

export interface CharacterAnimationSpec {
  readonly locomotionSet: string;
  readonly idleSet: string;
  readonly interactionSet: string;
  readonly facialSet: string;
  readonly secondaryMotion: readonly string[];
}

export interface CharacterRuntimeSpec {
  readonly role: CharacterAssetRole;
  readonly preferredAssetId: string;
  readonly fallbackRigId: string;
  readonly lodProfile: 'hero-near' | 'supporting-mid' | 'background-low';
  readonly maxVisibleDistanceMeters: number;
}

export interface CharacterSpec {
  readonly id: CharacterId;
  readonly displayName: string;
  readonly designIntent: string;
  readonly body: CharacterBodySpec;
  readonly face: CharacterFaceSpec;
  readonly hair: CharacterHairSpec;
  readonly outfit: CharacterOutfitSpec;
  readonly animation: CharacterAnimationSpec;
  readonly runtime: CharacterRuntimeSpec;
}

export const CHARACTER_SPEC_VERSION = 'character-system-v1';
