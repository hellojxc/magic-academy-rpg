import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

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
    .filter((id) => !['player', 'lyra', 'mira_voss'].includes(id))
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

  const identity = brief.targetIdentity;
  const text = textOf(identity).toLowerCase();
  if (text.includes('heroine') || text.includes('female') || text.includes('petite') || text.includes('skirt')) {
    return 'female';
  }
  if (text.includes('male') || text.includes('boy') || text.includes('mechanic') || text.includes('sword')) {
    return 'male';
  }
  return 'female';
}

function inferHairLength(identity) {
  const text = textOf(identity.hairPriorities).toLowerCase();
  if (text.includes('long') || text.includes('waist') || text.includes('ponytail') || text.includes('tail')) {
    return 'long';
  }
  return 'short';
}

function makeCharacterSpec(brief) {
  const identity = brief.targetIdentity;
  const presentation = inferPresentation(brief);
  const text = textOf(identity);
  const height = Number(identity.heightMeters ?? 1.62);
  const isFemale = presentation === 'female';
  const hairLength = inferHairLength(identity);
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

  return {
    id: brief.characterId,
    displayName: brief.displayName,
    heightMeters: height,
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

const out = resolve(readArg('--out', 'scripts/blender/story_npc_template_specs.json'));
const limit = Number(readArg('--limit', '0'));
const include = readArg('--include', '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);
const ids = include.length > 0 ? include : discoverBriefIds();
const selectedIds = limit > 0 ? ids.slice(0, limit) : ids;

const characters = selectedIds.map((id) => {
  const briefPath = resolve(`assets/characters/${id}/character-model-brief.json`);
  return makeCharacterSpec(readJson(briefPath));
});

writeJson(out, {
  version: 'story-npc-blender-template-specs-v1',
  generatedFrom: 'assets/characters/*/character-model-brief.json',
  outputDir: 'public/assets/models',
  characters,
});

console.log(`[npc-template-specs] wrote ${out}`);
console.log(`[npc-template-specs] characters: ${characters.map((character) => character.id).join(', ')}`);
