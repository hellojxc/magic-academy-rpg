import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';

const supportedTools = new Set([
  'charactergen',
  'hunyuan3d',
  'comfyui-3d-pack',
  'trellis',
  'triposr',
  'unirig',
  'manual',
]);

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
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

function readJsonIfExists(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined;
}

const characterId = readArg('--character', 'lyra');
const tool = readArg('--tool', 'manual');
const input = readArg('--input');
const preview = readArg('--preview');
const jobId = readArg('--job', 'manual-import');
const label = slug(readArg('--label', `${characterId}-${tool}-${timestamp()}`));

if (!supportedTools.has(tool)) {
  console.error(`[ai-candidate-register] Unsupported tool: ${tool}`);
  process.exit(1);
}

if (!input) {
  console.error('[ai-candidate-register] Missing --input /path/to/generated.glb');
  process.exit(1);
}

const inputPath = resolve(input);
if (!existsSync(inputPath)) {
  console.error(`[ai-candidate-register] Missing input: ${inputPath}`);
  process.exit(1);
}

const extension = extname(inputPath).toLowerCase();
if (!['.glb', '.gltf', '.obj', '.fbx', '.vrm'].includes(extension)) {
  console.error(`[ai-candidate-register] Unsupported candidate format: ${extension}`);
  process.exit(1);
}

const candidateDir = resolve(`assets/characters/${characterId}/candidates/registered/${label}`);
mkdirSync(candidateDir, { recursive: true });

const candidateFile = `${characterId}-${tool}${extension}`;
const candidatePath = resolve(candidateDir, candidateFile);
copyFileSync(inputPath, candidatePath);

let previewFile;
if (preview) {
  const previewPath = resolve(preview);
  if (!existsSync(previewPath)) {
    console.error(`[ai-candidate-register] Missing preview: ${previewPath}`);
    process.exit(1);
  }
  previewFile = `${characterId}-${tool}-preview${extname(previewPath).toLowerCase()}`;
  copyFileSync(previewPath, resolve(candidateDir, previewFile));
}

const brief = readJsonIfExists(resolve(`assets/characters/${characterId}/character-model-brief.json`));
const job = readJsonIfExists(resolve(`assets/characters/${characterId}/candidates/jobs/${jobId}/job.json`));
const manifest = {
  version: 'ai-character-candidate-v1',
  characterId,
  displayName: brief?.displayName ?? characterId,
  label,
  tool,
  sourceJobId: jobId,
  sourceJobStatus: job?.status ?? 'unknown',
  files: {
    candidate: `assets/characters/${characterId}/candidates/registered/${label}/${candidateFile}`,
    preview: previewFile
      ? `assets/characters/${characterId}/candidates/registered/${label}/${previewFile}`
      : undefined,
  },
  sourceInput: basename(inputPath),
  registeredAt: new Date().toISOString(),
  nextSteps: [
    'Inspect geometry and portrait likeness.',
    'Import candidate into Blender source scene.',
    'Retopologize and rebuild face, hair, body, clothing, hands, and shoes.',
    'Add humanoid armature, skin weights, facial morphs, and secondary-motion bones.',
    'Export through assets:characters:source:export before runtime promotion.',
  ],
};

writeFileSync(resolve(candidateDir, 'candidate.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[ai-candidate-register] registered ${manifest.files.candidate}`);
console.log(`[ai-candidate-register] wrote ${manifest.files.candidate.replace(candidateFile, 'candidate.json')}`);
