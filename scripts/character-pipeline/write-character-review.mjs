import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ids = process.argv.slice(2);
const characterIds = ids.length > 0 ? ids : ['player', 'lyra'];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function firstExistingUrl(paths) {
  for (const path of paths) {
    if (existsSync(resolve(`public${path}`))) return path;
  }
  return paths[0];
}

mkdirSync(resolve('public/assets/character-reviews'), { recursive: true });

for (const id of characterIds) {
  const briefPath = resolve(`assets/characters/${id}/character-model-brief.json`);
  if (!existsSync(briefPath)) {
    console.warn(`[character-review] missing brief for ${id}: ${briefPath}`);
    continue;
  }

  const brief = readJson(briefPath);
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
