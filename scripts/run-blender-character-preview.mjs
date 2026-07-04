import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const scriptPath = resolve('scripts/blender/render_character_preview.py');
const defaultInputs = [
  resolve('public/assets/models/player.blender-template.glb'),
  resolve('public/assets/models/lyra.blender-template.glb'),
  resolve('public/assets/models/mira_voss.blender-template.glb'),
];

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
  console.error('[character-preview] Blender executable not found.');
  console.error('[character-preview] Install Blender, or set BLENDER_BIN=/absolute/path/to/blender.');
  console.error(`[character-preview] Checked: ${candidates.join(', ')}`);
  process.exit(1);
}

const passthroughArgs = process.argv.slice(2);
const inputs = passthroughArgs.length > 0 ? passthroughArgs : defaultInputs;
const args = ['--background', '--python', scriptPath, '--', ...inputs];

console.log(`[character-preview] using ${blender}`);
const result = spawnSync(blender, args, { stdio: 'inherit' });
process.exit(result.status ?? 1);
