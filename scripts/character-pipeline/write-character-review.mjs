import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ids = process.argv.slice(2);
const characterIds = ids.length > 0 ? ids : discoverCharacterIds();

function discoverCharacterIds() {
  const root = resolve('assets/characters');
  if (!existsSync(root)) return ['player', 'lyra'];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((id) => existsSync(resolve(`assets/characters/${id}/character-model-brief.json`)))
    .sort((left, right) => {
      if (left === 'player') return -1;
      if (right === 'player') return 1;
      if (left === 'lyra') return -1;
      if (right === 'lyra') return 1;
      return left.localeCompare(right);
    });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function firstExistingUrl(paths) {
  for (const path of paths) {
    if (existsSync(resolve(`public${path}`))) return path;
  }
  return '/assets/portraits/story-npc-placeholder.svg';
}

function referenceStatus(id, type, brief) {
  if (type === 'portrait') {
    const portraitPath = brief.referenceImages.portrait.startsWith('/')
      ? `public${brief.referenceImages.portrait}`
      : brief.referenceImages.portrait;
    const exists = existsSync(resolve(portraitPath));
    return {
      type,
      exists,
      sourcePath: portraitPath,
      publicUrl: exists ? brief.referenceImages.portrait : '/assets/portraits/story-npc-placeholder.svg',
    };
  }

  const allowedExtensions = ['png', 'jpg', 'jpeg', 'webp'];
  for (const extension of allowedExtensions) {
    const sourcePath = `assets/characters/${id}/references/${type}.${extension}`;
    const publicUrl = `/assets/character-reviews/${id}-${type}.${extension}`;
    if (existsSync(resolve(sourcePath))) {
      return {
        type,
        exists: true,
        sourcePath,
        publicUrl: existsSync(resolve(`public${publicUrl}`)) ? publicUrl : undefined,
      };
    }
    if (existsSync(resolve(`public${publicUrl}`))) {
      return { type, exists: true, sourcePath, publicUrl };
    }
  }
  return {
    type,
    exists: false,
    sourcePath: `assets/characters/${id}/references/${type}.png`,
  };
}

mkdirSync(resolve('public/assets/character-reviews'), { recursive: true });

const index = {
  version: 'character-review-index-v1',
  characters: [],
};

for (const id of characterIds) {
  const briefPath = resolve(`assets/characters/${id}/character-model-brief.json`);
  if (!existsSync(briefPath)) {
    console.warn(`[character-review] missing brief for ${id}: ${briefPath}`);
    continue;
  }

  const brief = readJson(briefPath);
  index.characters.push({
    id,
    displayName: brief.displayName,
    reviewUrl: `/assets/character-reviews/${id}.json`,
    runtimeModelUrl: `/assets/models/${id}.glb`,
    hasRuntimeModel: existsSync(resolve(`public/assets/models/${id}.glb`)),
  });

  const review = {
    version: 'character-review-v1',
    characterId: id,
    displayName: brief.displayName,
    portraitUrl: brief.referenceImages.portrait,
    currentRuntimeModelUrl: `/assets/models/${id}.glb`,
    currentPreviewUrl: firstExistingUrl([
      `/assets/character-reviews/${id}-source-preview.png`,
      `/assets/models/${id}.blender-template.png`,
      `/assets/portraits/${id}-3d.png`,
    ]),
    runtimeAuditUrl: `/assets/character-reviews/${id}-runtime-audit.json`,
    sourceModelPath: brief.sourceModelRequirements.sourceFile,
    targetRuntimeFile: brief.sourceModelRequirements.targetRuntimeFile,
    referenceStatus: [
      referenceStatus(id, 'portrait', brief),
      referenceStatus(id, 'front', brief),
      referenceStatus(id, 'side', brief),
      referenceStatus(id, 'back', brief),
      referenceStatus(id, 'model-sheet', brief),
      referenceStatus(id, 'face-detail', brief),
      referenceStatus(id, 'hair-breakdown', brief),
      referenceStatus(id, 'outfit-breakdown', brief),
    ],
    targetIdentity: brief.targetIdentity,
    requirements: brief.sourceModelRequirements,
    aiCandidatePlan: brief.aiCandidatePlan,
    reviewChecklist: [
      'portrait likeness: head silhouette, eyes, face shape, expression',
      'hair structure: separate editable bangs, side locks, back hair, tips',
      'body proportion: target height, head ratio, shoulder and hip silhouette',
      'outfit accuracy: blouse, ribbon, skirt or trousers, cape, shoes, accessories',
      'animation readiness: humanoid skeleton, skin weights, idle/walk/talk clips',
      'facial readiness: blink, smile, shy, surprised, thinking morphs',
      'web budget: triangles, materials, texture memory, animation count',
      'runtime proof: model loads through CharacterManifest without fallback'
    ]
  };

  writeFileSync(
    resolve(`public/assets/character-reviews/${id}.json`),
    `${JSON.stringify(review, null, 2)}\n`
  );
  console.log(`[character-review] wrote public/assets/character-reviews/${id}.json`);
}

writeFileSync(
  resolve('public/assets/character-reviews/index.json'),
  `${JSON.stringify(index, null, 2)}\n`
);
console.log('[character-review] wrote public/assets/character-reviews/index.json');
