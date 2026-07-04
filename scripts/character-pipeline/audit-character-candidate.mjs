import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readBinaryGltfJson(filePath) {
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

  throw new Error(`${filePath} does not contain a glTF JSON chunk`);
}

function readCandidateJson(filePath) {
  const extension = extname(filePath).toLowerCase();
  if (extension === '.glb' || extension === '.vrm') return readBinaryGltfJson(filePath);
  if (extension === '.gltf') return readJson(filePath);
  throw new Error(`${filePath} is ${extension || 'unknown'}; convert it to GLB/VRM before candidate audit`);
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

function mergeBounds(bounds, min, max) {
  if (!Array.isArray(min) || !Array.isArray(max) || min.length < 3 || max.length < 3) return bounds;
  if (!bounds) {
    return {
      min: [min[0], min[1], min[2]],
      max: [max[0], max[1], max[2]],
    };
  }
  return {
    min: [
      Math.min(bounds.min[0], min[0]),
      Math.min(bounds.min[1], min[1]),
      Math.min(bounds.min[2], min[2]),
    ],
    max: [
      Math.max(bounds.max[0], max[0]),
      Math.max(bounds.max[1], max[1]),
      Math.max(bounds.max[2], max[2]),
    ],
  };
}

function summarizeCandidate(filePath) {
  const json = readCandidateJson(filePath);
  let primitiveCount = 0;
  let triangleCount = 0;
  let morphTargetPrimitiveCount = 0;
  let bounds;

  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      primitiveCount += 1;
      triangleCount += primitiveTriangleCount(json, primitive);
      if (Array.isArray(primitive.targets) && primitive.targets.length > 0) {
        morphTargetPrimitiveCount += 1;
      }
      const positionAccessorIndex = primitive.attributes?.POSITION;
      const positionAccessor =
        positionAccessorIndex !== undefined ? json.accessors?.[positionAccessorIndex] : undefined;
      bounds = mergeBounds(bounds, positionAccessor?.min, positionAccessor?.max);
    }
  }

  const nodes = json.nodes ?? [];
  const nodeNames = nodes.map((node) => node.name).filter(Boolean);
  const meshNames = (json.meshes ?? []).map((mesh) => mesh.name).filter(Boolean);
  const materialNames = (json.materials ?? []).map((material) => material.name).filter(Boolean);
  const skins = json.skins ?? [];
  const animations = json.animations ?? [];
  const dimensions = bounds
    ? {
      x: Number((bounds.max[0] - bounds.min[0]).toFixed(4)),
      y: Number((bounds.max[1] - bounds.min[1]).toFixed(4)),
      z: Number((bounds.max[2] - bounds.min[2]).toFixed(4)),
    }
    : undefined;

  const normalizedNames = [...nodeNames, ...meshNames, ...materialNames]
    .join(' ')
    .replace(/[^a-z0-9]+/gi, ' ')
    .toLowerCase();
  const compactNames = normalizedNames.replace(/\s+/g, '');
  const nameMatches = {
    face: /(face|head|mouth|nose|brow|cheek)/.test(compactNames),
    eyes: /(eye|iris|pupil|catchlight)/.test(compactNames),
    hair: /(hair|bang|lock|fringe|braid|ponytail)/.test(compactNames),
    outfit: /(outfit|cloth|shirt|jacket|skirt|cape|ribbon|tie|shoe|boot)/.test(compactNames),
    hands: /(hand|finger|thumb)/.test(compactNames),
  };

  const secondaryNodes = nodeNames.filter((name) => /secondary/i.test(name));
  return {
    file: filePath,
    format: extname(filePath).toLowerCase().replace('.', '') || 'unknown',
    sizeKb: Math.round(readFileSync(filePath).byteLength / 102.4) / 10,
    nodes: nodes.length,
    meshes: json.meshes?.length ?? 0,
    primitives: primitiveCount,
    materials: json.materials?.length ?? 0,
    skins: skins.length,
    bones: Math.max(0, ...skins.map((skin) => skin.joints?.length ?? 0)),
    animations: animations.map((animation) => animation.name ?? '(unnamed)'),
    morphTargetPrimitiveCount,
    triangleCount,
    bounds: bounds ? { ...bounds, dimensions } : undefined,
    secondaryNodes: secondaryNodes.length,
    secondaryTipNodes: secondaryNodes.filter((name) => /tip/i.test(name)).length,
    nameMatches,
  };
}

function check(name, passed, detail, level = 'cleanup') {
  return { name, passed, level, detail };
}

function auditCandidate({ characterId, inputPath, tool, label }) {
  const briefPath = resolve(`assets/characters/${characterId}/character-model-brief.json`);
  if (!existsSync(briefPath)) throw new Error(`Missing character brief: ${briefPath}`);
  const brief = readJson(briefPath);
  const requirements = brief.sourceModelRequirements;
  const [heroMin, heroMax] = requirements.triangleBudget.hero;
  const animationSet = new Set();
  let summary;
  let inspectError;

  try {
    summary = summarizeCandidate(inputPath);
    for (const clip of summary.animations) animationSet.add(clip.toLowerCase());
  } catch (error) {
    inspectError = error.message;
  }

  const generousTriangleMax = Math.max(heroMax * 3, 120000);
  const cleanupChecks = [
    check('inspectable GLB/VRM metadata', Boolean(summary), inspectError ?? basename(inputPath), 'cleanup'),
    check(
      'has mesh geometry',
      Boolean(summary && summary.meshes > 0 && summary.primitives > 0 && summary.triangleCount > 0),
      summary ? `${summary.meshes} meshes, ${summary.primitives} primitives, ${summary.triangleCount} triangles` : 'not inspectable',
      'cleanup',
    ),
    check(
      'candidate triangle range',
      Boolean(summary && summary.triangleCount >= 2000 && summary.triangleCount <= generousTriangleMax),
      summary ? `${summary.triangleCount} triangles, cleanup candidate target 2,000-${generousTriangleMax}` : 'not inspectable',
      'cleanup',
    ),
    check(
      'candidate material range',
      Boolean(summary && summary.materials > 0 && summary.materials <= 80),
      summary ? `${summary.materials} materials, cleanup candidate target 1-80` : 'not inspectable',
      'cleanup',
    ),
    check(
      'named anime character regions',
      Boolean(summary && Object.values(summary.nameMatches).filter(Boolean).length >= 3),
      summary ? JSON.stringify(summary.nameMatches) : 'not inspectable',
      'cleanup',
    ),
  ];

  const requiredClips = requirements.requiredAnimationClips.map((clip) => clip.toLowerCase());
  const runtimeChecks = [
    check(
      'runtime triangle budget',
      Boolean(summary && summary.triangleCount >= heroMin && summary.triangleCount <= heroMax),
      summary ? `${summary.triangleCount} triangles, runtime target ${heroMin}-${heroMax}` : 'not inspectable',
      'runtime',
    ),
    check(
      'humanoid skin',
      Boolean(summary && summary.skins > 0 && summary.bones >= 20),
      summary ? `${summary.skins} skins, ${summary.bones} bones` : 'not inspectable',
      'runtime',
    ),
    check(
      'facial morph targets',
      Boolean(summary && summary.morphTargetPrimitiveCount > 0),
      summary ? `${summary.morphTargetPrimitiveCount} primitives with morph targets` : 'not inspectable',
      'runtime',
    ),
    check(
      'required animation clips',
      Boolean(summary && requiredClips.every((clip) => animationSet.has(clip))),
      summary ? `has [${summary.animations.join(', ')}], requires [${requirements.requiredAnimationClips.join(', ')}]` : 'not inspectable',
      'runtime',
    ),
    check(
      'secondary motion hooks',
      Boolean(summary && summary.secondaryNodes > 0),
      summary ? `${summary.secondaryNodes} Secondary* nodes, ${summary.secondaryTipNodes} tips` : 'not inspectable',
      'runtime',
    ),
    check(
      'runtime material budget',
      Boolean(summary && summary.materials > 0 && summary.materials <= 32),
      summary ? `${summary.materials} materials, runtime target 1-32` : 'not inspectable',
      'runtime',
    ),
  ];

  const cleanupPassed = cleanupChecks.every((item) => item.passed);
  const runtimePassed = cleanupPassed && runtimeChecks.every((item) => item.passed);
  const checks = [...cleanupChecks, ...runtimeChecks];
  const score = checks.filter((item) => item.passed).length / checks.length;

  return {
    version: 'character-candidate-audit-v1',
    characterId,
    displayName: brief.displayName,
    label,
    tool,
    sourceInput: inputPath,
    acceptedForCleanup: cleanupPassed,
    runtimeReady: runtimePassed,
    score: Number(score.toFixed(3)),
    summary,
    requirements: {
      targetIdentity: brief.targetIdentity,
      triangleBudgetHero: requirements.triangleBudget.hero,
      requiredAnimationClips: requirements.requiredAnimationClips,
      requiredExpressions: requirements.requiredExpressions,
      requiredSecondaryMotion: requirements.requiredSecondaryMotion,
      aiAcceptanceGate: brief.aiCandidatePlan?.acceptanceGate ?? [],
    },
    checks,
    nextSteps: runtimePassed
      ? [
        'Run source export and runtime audit before replacing the manifest entry.',
        'Review portrait likeness and animation deformation in preview.',
      ]
      : cleanupPassed
        ? [
          'Import candidate into Blender source scene.',
          'Retopologize and separate face, hair, body, clothing, hands, and shoes.',
          'Add humanoid rig, skin weights, expression morphs, and Secondary* motion bones.',
          'Export to GLB/VRM and rerun runtime audit.',
        ]
        : [
          'Reject this candidate or regenerate with stronger front/side/back references.',
          'If the source is OBJ/FBX, convert to GLB first so geometry can be audited.',
        ],
    generatedAt: new Date().toISOString(),
  };
}

const characterId = readArg('--character', 'lyra');
const input = readArg('--input');
const tool = readArg('--tool', 'manual');
const label = readArg('--label', `${characterId}-${tool}-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`);

if (!input) {
  console.error('[candidate-audit] Missing --input /path/to/candidate.glb');
  process.exit(1);
}

const inputPath = resolve(input);
if (!existsSync(inputPath)) {
  console.error(`[candidate-audit] Missing input: ${inputPath}`);
  process.exit(1);
}

let audit;
try {
  audit = auditCandidate({ characterId, inputPath, tool, label });
} catch (error) {
  console.error(`[candidate-audit] ${error.message}`);
  process.exit(1);
}

const out = readArg('--out', `assets/characters/${characterId}/candidates/audits/${label}-candidate-audit.json`);
const outPath = resolve(out);
mkdirSync(resolve(outPath, '..'), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(`[candidate-audit] ${characterId}/${label}: cleanup=${audit.acceptedForCleanup ? 'accepted' : 'rejected'}, runtime=${audit.runtimeReady ? 'ready' : 'not-ready'}, score=${audit.score}`);
console.log(`[candidate-audit] wrote ${out}`);

if (hasFlag('--fail-on-reject') && !audit.acceptedForCleanup) process.exit(2);
if (hasFlag('--fail-on-runtime-reject') && !audit.runtimeReady) process.exit(3);
