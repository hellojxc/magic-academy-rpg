import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const supportedFormats = new Set(['.glb', '.vrm']);
const qualityValues = new Set(['hero', 'mid', 'low']);
const materialProfiles = new Set(['toon', 'mtoon', 'standard']);

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

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function slug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function timestamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

function publicUrlFor(path) {
  const publicRoot = resolve('public');
  const target = resolve(path);
  if (target !== publicRoot && !target.startsWith(`${publicRoot}${sep}`)) {
    throw new Error(`Promoted runtime file must live under public/: ${target}`);
  }
  return `/${relative(publicRoot, target).replaceAll(sep, '/')}`;
}

function normalizePublicUrl(value) {
  if (!value) return undefined;
  if (value.startsWith('/')) return value;
  if (value.startsWith('public/')) return `/${value.slice('public/'.length)}`;
  return value;
}

function runNodeScript(args) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runtimeOutputPath({ brief, characterId, inputExtension, explicitOutput }) {
  if (explicitOutput) return resolve(explicitOutput);

  const declaredTarget = brief.sourceModelRequirements?.targetRuntimeFile;
  if (declaredTarget && extname(declaredTarget).toLowerCase() === inputExtension) {
    return resolve(declaredTarget);
  }

  if (inputExtension === '.glb') {
    return resolve(`public/assets/models/${characterId}.glb`);
  }

  return resolve(`public/assets/models/${characterId}${inputExtension}`);
}

function triangleBudgetFor(brief, quality, existing) {
  const budget = brief.sourceModelRequirements?.triangleBudget?.[quality];
  if (Array.isArray(budget) && budget.length >= 2 && typeof budget[1] === 'number') return budget[1];
  return existing?.triangleBudget ?? (quality === 'hero' ? 45000 : quality === 'mid' ? 18000 : 7000);
}

function updateRuntimeManifest({
  manifestPath,
  brief,
  characterId,
  runtimePath,
  format,
  quality,
  materialProfile,
  assetId,
  thumbnailUrl,
  audit,
}) {
  const manifest = existsSync(manifestPath)
    ? readJson(manifestPath)
    : {
      version: 'character-assets-v1',
      loadStrategy: {
        lazyLoad: true,
        preloadDistanceMeters: 18,
        maxActiveHeroCharacters: 2,
        keepFallbackUntilAssetReady: true,
      },
      assets: [],
    };
  const assets = Array.isArray(manifest.assets) ? [...manifest.assets] : [];
  const existingIndex = assets.findIndex((asset) => asset.characterId === characterId && asset.enabled);
  const existing = existingIndex >= 0 ? assets[existingIndex] : undefined;
  const requiredClips = brief.sourceModelRequirements?.requiredAnimationClips;
  const summary = audit?.summary;
  const entry = {
    id: assetId ?? existing?.id ?? `${characterId}-${quality}-commercial-v1`,
    characterId,
    enabled: true,
    format,
    quality,
    url: publicUrlFor(runtimePath),
    thumbnailUrl: thumbnailUrl ?? existing?.thumbnailUrl,
    animationClips: Array.isArray(requiredClips) && requiredClips.length > 0
      ? requiredClips
      : existing?.animationClips ?? ['idle', 'walk', 'talk'],
    materialProfile,
    supportsFacialMorphs: hasFlag('--supports-facial-morphs')
      || Boolean(summary && summary.morphTargetPrimitiveCount > 0),
    supportsSpringBones: hasFlag('--supports-spring-bones')
      || Boolean(summary && summary.secondaryNodes > 0),
    triangleBudget: triangleBudgetFor(brief, quality, existing),
    textureBudgetKb: brief.sourceModelRequirements?.textureBudgetKb ?? existing?.textureBudgetKb ?? 4096,
  };

  if (existingIndex >= 0) {
    assets[existingIndex] = entry;
  } else {
    assets.push(entry);
  }

  writeJson(manifestPath, {
    ...manifest,
    assets,
  });

  return entry;
}

const characterId = readArg('--character', 'lyra');
const input = readArg('--input');
const explicitRuntimeOutput = readArg('--runtime-output');
const label = slug(readArg('--label', `${characterId}-commercial-${timestamp()}`));
const quality = readArg('--quality', 'hero');
const materialProfileArg = readArg('--material-profile');
const assetId = readArg('--asset-id');
const thumbnail = readArg('--thumbnail');
const thumbnailUrl = readArg('--thumbnail-url');
const promote = hasFlag('--promote');
const skipAudit = hasFlag('--skip-audit');
const allowRuntimeReject = hasFlag('--allow-runtime-reject');

if (!input) {
  console.error('[commercial-character-promote] Missing --input /path/to/model.glb');
  process.exit(1);
}

if (!qualityValues.has(quality)) {
  console.error(`[commercial-character-promote] Unsupported --quality: ${quality}`);
  process.exit(1);
}

const inputPath = resolve(input);
if (!existsSync(inputPath)) {
  console.error(`[commercial-character-promote] Missing input: ${inputPath}`);
  process.exit(1);
}

const extension = extname(inputPath).toLowerCase();
if (!supportedFormats.has(extension)) {
  console.error(`[commercial-character-promote] Unsupported runtime format: ${extension}`);
  process.exit(1);
}

const briefPath = resolve(`assets/characters/${characterId}/character-model-brief.json`);
if (!existsSync(briefPath)) {
  console.error(`[commercial-character-promote] Missing character brief: ${briefPath}`);
  process.exit(1);
}

const brief = readJson(briefPath);
const candidateDir = resolve(`assets/characters/${characterId}/candidates/commercial/${label}`);
mkdirSync(candidateDir, { recursive: true });

const candidateFile = `${characterId}-commercial${extension}`;
const candidatePath = resolve(candidateDir, candidateFile);
copyFileSync(inputPath, candidatePath);

let previewFile;
if (thumbnail) {
  const thumbnailPath = resolve(thumbnail);
  if (existsSync(thumbnailPath)) {
    previewFile = `${characterId}-commercial-preview${extname(thumbnailPath).toLowerCase()}`;
    copyFileSync(thumbnailPath, resolve(candidateDir, previewFile));
  }
}

let audit;
let auditFile;
if (!skipAudit) {
  auditFile = `${characterId}-commercial-candidate-audit.json`;
  const auditPath = resolve(candidateDir, auditFile);
  runNodeScript([
    resolve('scripts/character-pipeline/audit-character-candidate.mjs'),
    '--character',
    characterId,
    '--tool',
    'manual',
    '--label',
    label,
    '--input',
    candidatePath,
    '--out',
    auditPath,
  ]);
  audit = readJson(auditPath);
}

const candidateManifest = {
  version: 'commercial-character-candidate-v1',
  characterId,
  displayName: brief.displayName ?? characterId,
  label,
  files: {
    candidate: relative(resolve('.'), candidatePath).replaceAll(sep, '/'),
    preview: previewFile
      ? relative(resolve('.'), resolve(candidateDir, previewFile)).replaceAll(sep, '/')
      : undefined,
    audit: auditFile
      ? relative(resolve('.'), resolve(candidateDir, auditFile)).replaceAll(sep, '/')
      : undefined,
  },
  candidateGate: audit
    ? {
      acceptedForCleanup: audit.acceptedForCleanup,
      runtimeReady: audit.runtimeReady,
      score: audit.score,
    }
    : {
      acceptedForCleanup: false,
      runtimeReady: false,
      score: 0,
      reason: 'audit skipped',
    },
  sourceInput: basename(inputPath),
  registeredAt: new Date().toISOString(),
};

if (!promote) {
  writeJson(resolve(candidateDir, 'candidate.json'), candidateManifest);
  console.log(`[commercial-character-promote] registered ${candidateManifest.files.candidate}`);
  console.log('[commercial-character-promote] pass --promote after visual review to replace the runtime model');
  process.exit(0);
}

if (audit && !audit.runtimeReady && !allowRuntimeReject) {
  writeJson(resolve(candidateDir, 'candidate.json'), {
    ...candidateManifest,
    promotion: {
      promoted: false,
      reason: 'candidate audit is not runtime ready; use --allow-runtime-reject only for deliberate prototype overrides',
    },
  });
  console.error('[commercial-character-promote] Candidate is not runtime ready; promotion blocked');
  process.exit(2);
}

if (!audit && !allowRuntimeReject) {
  writeJson(resolve(candidateDir, 'candidate.json'), {
    ...candidateManifest,
    promotion: {
      promoted: false,
      reason: 'candidate audit was skipped; pass --allow-runtime-reject only for deliberate prototype overrides',
    },
  });
  console.error('[commercial-character-promote] Candidate audit was skipped; promotion blocked');
  process.exit(2);
}

const materialProfile = materialProfileArg
  ?? (extension === '.vrm' ? 'mtoon' : 'toon');
if (!materialProfiles.has(materialProfile)) {
  console.error(`[commercial-character-promote] Unsupported --material-profile: ${materialProfile}`);
  process.exit(1);
}

const runtimePath = runtimeOutputPath({
  brief,
  characterId,
  inputExtension: extension,
  explicitOutput: explicitRuntimeOutput,
});
mkdirSync(dirname(runtimePath), { recursive: true });
copyFileSync(candidatePath, runtimePath);

const runtimeManifestPath = resolve('public/assets/models/character-models.json');
const entry = updateRuntimeManifest({
  manifestPath: runtimeManifestPath,
  brief,
  characterId,
  runtimePath,
  format: extension === '.vrm' ? 'vrm' : 'glb',
  quality,
  materialProfile,
  assetId,
  thumbnailUrl: normalizePublicUrl(thumbnailUrl),
  audit,
});

const promotionManifest = {
  ...candidateManifest,
  promotion: {
    promoted: true,
    runtimeFile: relative(resolve('.'), runtimePath).replaceAll(sep, '/'),
    runtimeManifest: relative(resolve('.'), runtimeManifestPath).replaceAll(sep, '/'),
    assetEntry: entry,
    promotedAt: new Date().toISOString(),
  },
};
writeJson(resolve(candidateDir, 'candidate.json'), promotionManifest);

const declaredRuntimePath = brief.sourceModelRequirements?.targetRuntimeFile
  ? resolve(brief.sourceModelRequirements.targetRuntimeFile)
  : undefined;
if (declaredRuntimePath && declaredRuntimePath === runtimePath) {
  runNodeScript([
    resolve('scripts/character-pipeline/audit-runtime-character.mjs'),
    characterId,
  ]);
} else {
  console.warn('[commercial-character-promote] Runtime audit skipped because promoted file differs from brief sourceModelRequirements.targetRuntimeFile');
}

console.log(`[commercial-character-promote] promoted ${relative(resolve('.'), runtimePath).replaceAll(sep, '/')}`);
console.log(`[commercial-character-promote] updated ${relative(resolve('.'), runtimeManifestPath).replaceAll(sep, '/')}`);
