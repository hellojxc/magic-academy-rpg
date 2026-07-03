import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const referenceTypes = new Set([
  'portrait',
  'front',
  'side',
  'back',
  'model-sheet',
  'face-detail',
  'hair-breakdown',
  'outfit-breakdown',
]);

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const characterId = readArg('--character', 'lyra');
const type = readArg('--type', 'model-sheet');
const input = readArg('--input');

if (!referenceTypes.has(type)) {
  console.error(`[reference-register] Unsupported reference type: ${type}`);
  console.error(`[reference-register] Supported types: ${[...referenceTypes].join(', ')}`);
  process.exit(1);
}

if (!input) {
  console.error('[reference-register] Missing --input /path/to/reference.png');
  process.exit(1);
}

const inputPath = resolve(input);
if (!existsSync(inputPath)) {
  console.error(`[reference-register] Missing input: ${inputPath}`);
  process.exit(1);
}

const extension = extname(inputPath).toLowerCase();
if (!['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) {
  console.error(`[reference-register] Unsupported reference image format: ${extension}`);
  process.exit(1);
}

const briefPath = resolve(`assets/characters/${characterId}/character-model-brief.json`);
const brief = readJson(briefPath);
const outDir = resolve(`assets/characters/${characterId}/references`);
mkdirSync(outDir, { recursive: true });
const publicDir = resolve('public/assets/character-reviews');
mkdirSync(publicDir, { recursive: true });

const canonicalName = `${type}${extension === '.jpeg' ? '.jpg' : extension}`;
const outputPath = resolve(outDir, canonicalName);
copyFileSync(inputPath, outputPath);
const publicName = `${characterId}-${type}${extension === '.jpeg' ? '.jpg' : extension}`;
const publicPath = resolve(publicDir, publicName);
copyFileSync(inputPath, publicPath);

const indexPath = resolve(outDir, 'references.json');
const existing = existsSync(indexPath) ? readJson(indexPath) : {
  version: 'character-reference-index-v1',
  characterId,
  displayName: brief.displayName,
  references: {},
};

existing.references[type] = {
  path: `assets/characters/${characterId}/references/${canonicalName}`,
  publicUrl: `/assets/character-reviews/${publicName}`,
  registeredAt: new Date().toISOString(),
};

writeFileSync(indexPath, `${JSON.stringify(existing, null, 2)}\n`);
console.log(`[reference-register] wrote ${existing.references[type].path}`);
console.log(`[reference-register] wrote ${existing.references[type].publicUrl}`);
console.log(`[reference-register] updated assets/characters/${characterId}/references/references.json`);
