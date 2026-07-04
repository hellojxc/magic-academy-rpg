import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const worldRoot = path.join(root, 'public/assets/world');
const dirs = ['chunks', 'chunks/optimized', 'materials', 'hdri', 'lightmaps'];

console.log('Magic Academy world asset report');
console.log('================================');

for (const dir of dirs) {
  const absolute = path.join(worldRoot, dir);
  if (!existsSync(absolute)) {
    console.log(`${dir}: missing`);
    continue;
  }
  const files = readdirSync(absolute).filter((file) => !file.startsWith('.'));
  const totalBytes = files.reduce((sum, file) => sum + statSync(path.join(absolute, file)).size, 0);
  console.log(`${dir}: ${files.length} file(s), ${formatBytes(totalBytes)}`);
  for (const file of files.slice(0, 12)) {
    console.log(`  - ${file}`);
  }
  if (files.length > 12) console.log(`  ... ${files.length - 12} more`);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
