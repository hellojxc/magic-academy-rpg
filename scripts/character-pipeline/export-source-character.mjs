import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

const character = readArg('--character', 'lyra');
const source = resolve(readArg('--source', `assets/characters/${character}/source/${character}.blend`));
const out = resolve(readArg('--out', `public/assets/models/${character}.glb`));
const preview = resolve(readArg('--preview', `public/assets/character-reviews/${character}-source-preview.png`));
const audit = resolve(readArg('--audit', `public/assets/character-reviews/${character}-source-audit.json`));

const candidates = [
  process.env.BLENDER_BIN,
  'blender',
  'blender-4.3',
  'blender-4.2',
  'blender-4.1',
  '/Applications/Blender.app/Contents/MacOS/Blender',
].filter(Boolean);

function canRun(command) {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

function findBlender() {
  for (const command of candidates) {
    if (command.includes('/') && !existsSync(command)) continue;
    if (canRun(command)) return command;
  }
  return undefined;
}

const blender = findBlender();
if (!blender) {
  console.error('[source-character-export] Blender executable not found.');
  console.error('[source-character-export] Install Blender, or set BLENDER_BIN=/absolute/path/to/blender.');
  process.exit(1);
}

if (!existsSync(source)) {
  console.error(`[source-character-export] Missing source model: ${source}`);
  console.error('[source-character-export] Create or place the production .blend source model first.');
  process.exit(1);
}

const scriptPath = resolve('scripts/blender/export_source_character.py');
const args = [
  '--background',
  '--python',
  scriptPath,
  '--',
  '--character',
  character,
  '--source',
  source,
  '--out',
  out,
  '--preview',
  preview,
  '--audit',
  audit,
];

console.log(`[source-character-export] using ${blender}`);
const result = spawnSync(blender, args, { stdio: 'inherit' });
process.exit(result.status ?? 1);
