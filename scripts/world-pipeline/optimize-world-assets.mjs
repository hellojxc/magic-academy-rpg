import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const chunksDir = path.join(root, 'public/assets/world/chunks');
const optimizedDir = path.join(chunksDir, 'optimized');

mkdirSync(optimizedDir, { recursive: true });

const glbs = existsSync(chunksDir)
  ? readdirSync(chunksDir).filter((file) => file.endsWith('.glb') && !file.endsWith('.optimized.glb'))
  : [];

if (glbs.length === 0) {
  console.log('[world-optimize] no authored chunk GLBs found; run assets:world:blender after adding a Blender scene.');
  process.exit(0);
}

for (const file of glbs) {
  const input = path.join(chunksDir, file);
  const output = path.join(optimizedDir, file.replace(/\.glb$/, '.optimized.glb'));
  const compressionArgs = file === 'arcane-library.high.glb'
    ? ['--compress', 'false', '--instance', 'false']
    : ['--compress', 'quantize'];
  run('npx', [
    'gltf-transform',
    'optimize',
    input,
    output,
    ...compressionArgs,
    '--palette',
    'false',
    '--prune-attributes',
    'false',
    '--texture-compress',
    'false',
    '--texture-size',
    '2048',
  ]);
}

console.log(`[world-optimize] wrote ${glbs.length} optimized chunk(s) to ${path.relative(root, optimizedDir)}`);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
