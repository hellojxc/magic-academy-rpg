import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const EXCLUDED_IDS = new Set(['player', 'lyra', 'mira_voss']);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function discoverBriefIds() {
  const root = resolve('assets/characters');
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((id) => !EXCLUDED_IDS.has(id))
    .filter((id) => existsSync(resolve(`assets/characters/${id}/character-model-brief.json`)))
    .sort();
}

function textOf(value) {
  if (Array.isArray(value)) return value.join(' ');
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return Object.values(value).map(textOf).join(' ');
  return '';
}

function pickColor(text, fallback, rules) {
  const lower = text.toLowerCase();
  for (const [keyword, color] of rules) {
    if (lower.includes(keyword)) return color;
  }
  return fallback;
}

function inferPresentation(brief) {
  const narrativeText = textOf(brief.narrativeSource);
  if (/(她|少女|女性|女生)/u.test(narrativeText)) return 'female';
  if (/(他|少年|男性|男生)/u.test(narrativeText)) return 'male';

  const text = textOf(brief.targetIdentity).toLowerCase();
  if (text.includes('female') || text.includes('heroine') || text.includes('skirt') || text.includes('petite')) {
    return 'female';
  }
  if (text.includes('male') || text.includes('boy') || text.includes('sword') || text.includes('mechanic')) {
    return 'male';
  }
  return 'female';
}

function inferHairLength(identity) {
  const text = textOf(identity.hairPriorities).toLowerCase();
  if (text.includes('long') || text.includes('waist') || text.includes('ponytail') || text.includes('twin')) {
    return 'long';
  }
  if (text.includes('bob') || text.includes('medium') || text.includes('shoulder')) {
    return 'medium';
  }
  return 'short';
}

function makePalette(brief, presentation) {
  const text = textOf(brief.targetIdentity);
  const isFemale = presentation === 'female';
  const hairColor = pickColor(text, isFemale ? '#7d6f95' : '#2a1d17', [
    ['silver', '#9fc8df'],
    ['white', '#dce5f4'],
    ['lavender', '#b9a3ff'],
    ['violet', '#4b2d78'],
    ['midnight', '#182946'],
    ['black', '#16131c'],
    ['dark', '#211b24'],
    ['indigo', '#232f66'],
    ['chestnut', '#7a4a32'],
    ['brown', '#6b4a2f'],
    ['sandy', '#b89358'],
    ['copper', '#b45f38'],
    ['yellow', '#d9b84f'],
    ['plum', '#4c243f'],
    ['moss', '#546b3d'],
    ['green', '#546b3d'],
    ['blue', '#3f74b8'],
  ]);
  const accentColor = pickColor(text, '#7d56d9', [
    ['amber', '#d99b4d'],
    ['golden', '#f1c84d'],
    ['yellow', '#e7c955'],
    ['green', '#6fbf82'],
    ['violet', '#8d72ff'],
    ['purple', '#7d56d9'],
    ['magenta', '#c45ab2'],
    ['red', '#b84659'],
    ['blue', '#3f74b8'],
    ['aqua', '#6fc8f1'],
    ['moon', '#b8a6e8'],
    ['ember', '#c66742'],
    ['copper', '#b45f38'],
    ['silver', '#b8c7d9'],
  ]);
  const eyeColor = pickColor(text, '#7b66ff', [
    ['amber eyes', '#d99b4d'],
    ['golden eyes', '#f1c84d'],
    ['green', '#79c98a'],
    ['brown eyes', '#9a6a42'],
    ['blue', '#4f8ed9'],
    ['aqua', '#7dd9f4'],
    ['violet', '#8d72ff'],
    ['magenta', '#c45ab2'],
    ['red', '#b84659'],
  ]);
  return { hairColor, accentColor, eyeColor };
}

function makeBlenderSpec(brief) {
  const presentation = inferPresentation(brief);
  const isFemale = presentation === 'female';
  const identity = brief.targetIdentity;
  const { hairColor, accentColor, eyeColor } = makePalette(brief, presentation);
  const hairLength = inferHairLength(identity);

  return {
    id: brief.characterId,
    displayName: brief.displayName,
    heightMeters: Number(identity.heightMeters ?? (isFemale ? 1.6 : 1.7)),
    body: {
      presentation,
      headScale: isFemale ? [0.92, 1.06, 0.79] : [0.9, 1.03, 0.78],
      shoulderWidth: isFemale ? 0.34 : 0.42,
      torsoLength: isFemale ? 0.49 : 0.54,
      waistWidth: isFemale ? 0.25 : 0.31,
      hipWidth: isFemale ? 0.34 : 0.34,
      armLength: isFemale ? 0.56 : 0.61,
      legLength: isFemale ? 0.77 : 0.83,
      handScale: isFemale ? 0.9 : 0.96,
      footScale: isFemale ? 0.9 : 1.0,
    },
    face: {
      eyeScale: isFemale ? 1.13 : 1.06,
      eyeColor,
      browColor: hairColor,
      cheekTint: isFemale ? '#d7a9be' : '#e4aa98',
    },
    hair: {
      style: identity.hairPriorities?.[0] ?? (isFemale ? 'story heroine hair' : 'story hero hair'),
      length: hairLength,
      color: hairColor,
      highlightColor: accentColor,
      volume: isFemale ? 0.9 : 0.78,
    },
    outfit: {
      style: isFemale ? 'academy-uniform-heroine' : 'academy-uniform-male',
      primaryColor: isFemale ? '#eef9ff' : '#132b68',
      secondaryColor: accentColor,
      darkColor: isFemale ? '#24436f' : '#18204c',
      accentColor,
      trimColor: '#d9c47a',
      shoeColor: isFemale ? '#e8eff7' : '#16131c',
      cape: isFemale ? 'short-capelet' : 'short-mage-cape',
      heldItem: isFemale ? 'spellbook' : 'practice-wand',
    },
    animation: {
      idlePersonality: isFemale ? 'gentle' : 'reserved',
      walkPersonality: isFemale ? 'light' : 'calm',
      talkPersonality: isFemale ? 'warm' : 'confident',
    },
  };
}

function makeRuntimeSpec(brief) {
  const blender = makeBlenderSpec(brief);
  const isFemale = blender.body.presentation === 'female';
  const identity = brief.targetIdentity;
  const role = brief.runtimeAssetId?.includes('background') ? 'background' : 'supporting';
  const hairLength = blender.hair.length;
  const secondaryMotion = [
    hairLength === 'long' ? 'long-hair-sway' : 'hair-tip-sway',
    isFemale ? 'skirt-sway' : 'cape-sway',
  ];

  return {
    id: brief.characterId,
    displayName: brief.displayName,
    designIntent: `${identity.style}; ${identity.silhouette}. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.`,
    body: {
      heightMeters: blender.heightMeters,
      headToBodyRatio: Number(identity.headToBodyRatio ?? (isFemale ? 0.2 : 0.18)),
      silhouette: isFemale ? 'petite-heroine' : 'slim-male-academy',
      shoulderWidth: blender.body.shoulderWidth,
      torsoLength: blender.body.torsoLength,
      waistWidth: blender.body.waistWidth,
      hipWidth: blender.body.hipWidth,
      armLength: blender.body.armLength,
      handScale: blender.body.handScale,
      legLength: blender.body.legLength,
      footScale: blender.body.footScale,
    },
    face: {
      eyeShape: identity.facePriorities?.[0] ?? (isFemale ? 'large expressive anime eyes' : 'sharp anime eyes'),
      eyeColor: blender.face.eyeColor,
      eyeScale: blender.face.eyeScale,
      browShape: identity.facePriorities?.[1] ?? 'story-matched brows',
      browColor: blender.face.browColor,
      noseBridge: 'stylized-minimal',
      mouthShape: identity.facePriorities?.[2] ?? 'small story-matched mouth',
      cheekTint: blender.face.cheekTint,
      expressionSet: ['neutral', 'blink', 'smile', 'concerned', 'surprised'],
    },
    hair: {
      color: blender.hair.color,
      highlightColor: blender.hair.highlightColor,
      style: identity.hairPriorities?.[0] ?? blender.hair.style,
      bangs: identity.hairPriorities?.[1] ?? 'story-matched bangs',
      length: hairLength,
      volume: blender.hair.volume,
      secondaryMotion: hairLength === 'long' ? 'full' : 'tips',
      accessories: identity.hairPriorities?.slice(2, 4) ?? [],
    },
    outfit: {
      style: identity.outfitPriorities?.[0] ?? blender.outfit.style,
      primaryColor: blender.outfit.primaryColor,
      secondaryColor: blender.outfit.secondaryColor,
      accentColor: blender.outfit.accentColor,
      torso: identity.outfitPriorities?.[0] ?? 'story academy uniform torso',
      sleeves: identity.outfitPriorities?.[1] ?? 'academy sleeves with trim',
      lowerBody: identity.outfitPriorities?.[2] ?? (isFemale ? 'academy skirt' : 'academy trousers'),
      outerwear: identity.outfitPriorities?.[3] ?? blender.outfit.cape,
      shoes: isFemale ? 'light academy ankle boots' : 'dark academy boots',
      accessories: identity.outfitPriorities?.slice(2, 5) ?? [],
      heldItems: [blender.outfit.heldItem],
    },
    animation: {
      locomotionSet: isFemale ? 'academy-female-locomotion' : 'academy-male-locomotion',
      idleSet: isFemale ? 'story-female-idles' : 'story-male-idles',
      interactionSet: isFemale ? 'conversation-female-warm' : 'conversation-male-calm',
      facialSet: 'anime-supporting-basic',
      secondaryMotion,
    },
    runtime: {
      role,
      preferredAssetId: brief.runtimeAssetId,
      fallbackRigId: `${brief.characterId}-procedural-rig`,
      lodProfile: role === 'background' ? 'background-low' : 'supporting-mid',
      maxVisibleDistanceMeters: role === 'background' ? 28 : 36,
    },
  };
}

function updateManifest(briefs) {
  const manifestPath = resolve('public/assets/models/character-models.json');
  const manifest = readJson(manifestPath);
  const ids = new Set(briefs.map((brief) => brief.characterId));
  const existing = manifest.assets.filter((asset) => !ids.has(asset.characterId));
  const enabledExisting = existing.filter((asset) => asset.enabled);
  const disabledExisting = existing.filter((asset) => !asset.enabled);
  const storyAssets = briefs.map((brief) => ({
    id: brief.runtimeAssetId,
    characterId: brief.characterId,
    enabled: true,
    format: 'glb',
    quality: 'mid',
    url: `/assets/models/${brief.characterId}.glb`,
    thumbnailUrl: `/assets/models/${brief.characterId}.blender-template.png`,
    animationClips: ['idle', 'walk', 'talk'],
    materialProfile: 'toon',
    supportsFacialMorphs: true,
    supportsSpringBones: false,
    triangleBudget: 32000,
    textureBudgetKb: 2048,
  }));

  writeJson(manifestPath, {
    ...manifest,
    assets: [...enabledExisting, ...storyAssets, ...disabledExisting],
  });
}

function writeRuntimeSpecs(runtimeSpecs) {
  const outPath = resolve('src/characters/StoryNpcCharacterSpecs.ts');
  const body = JSON.stringify(Object.fromEntries(runtimeSpecs.map((spec) => [spec.id, spec])), null, 2);
  const content = `import type { CharacterSpec } from './CharacterSpec';\n\n` +
    `export const storyNpcCharacterSpecs = ${body} as const satisfies Record<string, CharacterSpec>;\n`;
  writeFileSync(outPath, content);
}

const ids = discoverBriefIds();
const briefs = ids.map((id) => readJson(resolve(`assets/characters/${id}/character-model-brief.json`)));
const blenderSpecs = briefs.map(makeBlenderSpec);
const runtimeSpecs = briefs.map(makeRuntimeSpec);

writeJson(resolve('scripts/blender/story_npc_template_specs.json'), {
  version: 'story-npc-blender-template-specs-v1',
  generatedFrom: 'assets/characters/*/character-model-brief.json',
  outputDir: 'public/assets/models',
  characters: blenderSpecs,
});
writeRuntimeSpecs(runtimeSpecs);
updateManifest(briefs);

console.log(`[story-character-runtime-specs] generated ${briefs.length} story NPC specs`);
console.log(`[story-character-runtime-specs] characters: ${ids.join(', ')}`);
