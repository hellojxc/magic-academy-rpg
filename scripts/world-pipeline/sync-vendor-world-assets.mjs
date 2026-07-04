import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const manifestPath = path.join(root, 'src/r3f/third-party-world-props.json');
const publicRoot = path.join(root, 'public');
const rawCacheRoot = path.join(root, 'assets/world/vendor-cache/cc0/polygonal-mind');
const force = process.argv.includes('--force');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const sources = Array.isArray(manifest.sources) ? manifest.sources : [];

if (sources.length === 0) {
  console.log('[vendor-assets] no third-party world sources found.');
  process.exit(0);
}

let downloaded = 0;
let optimized = 0;
let skipped = 0;
let outputBytes = 0;

for (const source of sources) {
  validateSource(source);
  const outputPath = path.join(publicRoot, source.url.replace(/^\//, ''));
  const rawPath = path.join(rawCacheRoot, source.collection, path.basename(new URL(source.originalUrl).pathname));

  if (!force && existsSync(outputPath)) {
    skipped += 1;
    outputBytes += (await stat(outputPath)).size;
    continue;
  }

  await mkdir(path.dirname(rawPath), { recursive: true });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await downloadFile(source.originalUrl, rawPath);
  downloaded += 1;

  run('npx', [
    'gltf-transform',
    'optimize',
    rawPath,
    outputPath,
    '--compress',
    'quantize',
    '--palette',
    'false',
    '--prune-attributes',
    'false',
    '--texture-compress',
    'false',
    '--texture-size',
    '2048',
  ]);
  optimized += 1;
  outputBytes += (await stat(outputPath)).size;
}

console.log(`[vendor-assets] sources=${sources.length} downloaded=${downloaded} optimized=${optimized} skipped=${skipped} output=${formatBytes(outputBytes)}`);

function validateSource(source) {
  for (const key of ['id', 'collection', 'license', 'originalUrl', 'url']) {
    if (typeof source[key] !== 'string' || source[key].length === 0) {
      throw new Error(`Invalid vendor asset source: missing ${key}`);
    }
  }
  if (source.license !== 'CC0') {
    throw new Error(`Refusing non-CC0 vendor asset ${source.id}: ${source.license}`);
  }
  if (!source.url.startsWith('/assets/world/vendor/cc0/')) {
    throw new Error(`Vendor asset ${source.id} must output under /assets/world/vendor/cc0/`);
  }
}

async function downloadFile(url, filePath) {
  console.log(`[vendor-assets] download ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length < 256) {
    throw new Error(`Downloaded asset is unexpectedly small: ${url}`);
  }
  await writeFile(filePath, data);
}

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

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
