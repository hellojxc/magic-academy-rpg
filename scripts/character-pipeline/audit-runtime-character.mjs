import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_CHARACTERS = ['player', 'lyra'];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readGlbJson(filePath) {
  const data = readFileSync(filePath);
  if (data.length < 20 || data.toString('utf8', 0, 4) !== 'glTF') {
    throw new Error(`${filePath} is not a binary glTF file`);
  }

  let offset = 12;
  while (offset + 8 <= data.length) {
    const chunkLength = data.readUInt32LE(offset);
    const chunkType = data.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = data.subarray(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === 0x4e4f534a) {
      return JSON.parse(chunk.toString('utf8').replace(/\0+$/g, '').trim());
    }
  }

  throw new Error(`${filePath} does not contain a JSON chunk`);
}

function primitiveTriangleCount(json, primitive) {
  const mode = primitive.mode ?? 4;
  const indexAccessor = primitive.indices !== undefined ? json.accessors?.[primitive.indices] : undefined;
  const positionAccessor =
    primitive.attributes?.POSITION !== undefined ? json.accessors?.[primitive.attributes.POSITION] : undefined;
  const count = indexAccessor?.count ?? positionAccessor?.count ?? 0;

  if (mode === 4) return Math.floor(count / 3);
  if (mode === 5 || mode === 6) return Math.max(0, count - 2);
  return 0;
}

function summarizeGlb(filePath, displayPath = filePath) {
  const json = readGlbJson(filePath);
  let primitiveCount = 0;
  let triangleCount = 0;
  let morphTargetPrimitiveCount = 0;

  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      primitiveCount += 1;
      triangleCount += primitiveTriangleCount(json, primitive);
      if (Array.isArray(primitive.targets) && primitive.targets.length > 0) {
        morphTargetPrimitiveCount += 1;
      }
    }
  }

  const skins = json.skins ?? [];
  const animations = json.animations ?? [];

  return {
    file: displayPath,
    sizeKb: Math.round(readFileSync(filePath).byteLength / 102.4) / 10,
    nodes: json.nodes?.length ?? 0,
    meshes: json.meshes?.length ?? 0,
    primitives: primitiveCount,
    materials: json.materials?.length ?? 0,
    skins: skins.length,
    bones: Math.max(0, ...skins.map((skin) => skin.joints?.length ?? 0)),
    animations: animations.map((animation) => animation.name ?? '(unnamed)'),
    morphTargetPrimitiveCount,
    triangleCount,
  };
}

function pass(name, passed, detail) {
  return { name, passed, detail };
}

function auditCharacter(characterId) {
  const briefPath = resolve(`assets/characters/${characterId}/character-model-brief.json`);
  const brief = readJson(briefPath);
  const runtimeRelativePath = brief.sourceModelRequirements.targetRuntimeFile;
  const runtimePath = resolve(runtimeRelativePath);
  const exists = existsSync(runtimePath);
  const summary = exists ? summarizeGlb(runtimePath, runtimeRelativePath) : undefined;
  const requirements = brief.sourceModelRequirements;
  const requiredClips = requirements.requiredAnimationClips.map((clip) => clip.toLowerCase());
  const animationSet = new Set((summary?.animations ?? []).map((clip) => clip.toLowerCase()));
  const [minTriangles, maxTriangles] = requirements.triangleBudget.hero;

  const checks = [
    pass('runtime model exists', exists, runtimeRelativePath),
    pass(
      'triangle budget',
      Boolean(summary && summary.triangleCount >= minTriangles && summary.triangleCount <= maxTriangles),
      summary ? `${summary.triangleCount} triangles, target ${minTriangles}-${maxTriangles}` : 'missing model',
    ),
    pass(
      'humanoid skin',
      Boolean(summary && summary.skins > 0 && summary.bones > 0),
      summary ? `${summary.skins} skins, ${summary.bones} bones` : 'missing model',
    ),
    pass(
      'facial morph targets',
      Boolean(summary && summary.morphTargetPrimitiveCount > 0),
      summary ? `${summary.morphTargetPrimitiveCount} primitives with morph targets` : 'missing model',
    ),
    pass(
      'required animation clips',
      Boolean(summary && requiredClips.every((clip) => animationSet.has(clip))),
      summary ? `has [${summary.animations.join(', ')}], requires [${requirements.requiredAnimationClips.join(', ')}]` : 'missing model',
    ),
    pass(
      'material count',
      Boolean(summary && summary.materials <= 32),
      summary ? `${summary.materials} materials, target <= 32` : 'missing model',
    ),
  ];

  const accepted = checks.every((check) => check.passed);
  return {
    version: 'runtime-character-audit-v1',
    characterId,
    displayName: brief.displayName,
    accepted,
    summary,
    requirements: {
      triangleBudgetHero: requirements.triangleBudget.hero,
      requiredAnimationClips: requirements.requiredAnimationClips,
      requiredExpressions: requirements.requiredExpressions,
      requiredSecondaryMotion: requirements.requiredSecondaryMotion,
    },
    checks,
    conclusion: accepted
      ? 'Runtime asset passes the current production gate.'
      : 'Runtime asset is not yet a production-quality RPG character model.',
    generatedAt: new Date().toISOString(),
  };
}

const characters = process.argv.slice(2);
const characterIds = characters.length > 0 ? characters : DEFAULT_CHARACTERS;
mkdirSync(resolve('public/assets/character-reviews'), { recursive: true });

let failed = false;
for (const characterId of characterIds) {
  try {
    const audit = auditCharacter(characterId);
    const outPath = resolve(`public/assets/character-reviews/${characterId}-runtime-audit.json`);
    writeFileSync(outPath, `${JSON.stringify(audit, null, 2)}\n`);
    console.log(`[runtime-character-audit] ${characterId}: ${audit.accepted ? 'accepted' : 'not accepted'}`);
    console.log(`[runtime-character-audit] wrote ${outPath}`);
  } catch (error) {
    failed = true;
    console.error(`[runtime-character-audit] ${characterId}: ${error.message}`);
  }
}

if (failed) process.exit(1);
