import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const scriptPath = resolve('scripts/blender/character_template.py');
const defaultConfig = resolve('scripts/blender/character_template_specs.json');

const candidates = [
  process.env.BLENDER_BIN,
  'blender',
  'blender-4.3',
  'blender-4.2',
  'blender-4.1',
  '/home/dennisj/tools/blender/blender',
  '/home/dennisj/.local/blender-4.0.2-linux-x64/blender',
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
  console.error('[character-template] Blender executable not found.');
  console.error('[character-template] Install Blender, or set BLENDER_BIN=/absolute/path/to/blender.');
  console.error(`[character-template] Checked: ${candidates.join(', ')}`);
  process.exit(1);
}

const passthroughArgs = process.argv.slice(2);
const hasConfig = passthroughArgs.includes('--config');
const args = [
  '--background',
  '--python',
  scriptPath,
  '--',
  ...(hasConfig ? passthroughArgs : ['--config', defaultConfig, ...passthroughArgs]),
];

console.log(`[character-template] using ${blender}`);
const result = spawnSync(blender, args, { stdio: 'inherit' });
process.exit(result.status ?? 1);
