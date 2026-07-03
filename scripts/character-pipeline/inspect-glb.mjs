import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const DEFAULT_FILES = [
  'public/assets/models/player.glb',
  'public/assets/models/lyra.glb',
  'public/assets/models/player.blender-template.glb',
  'public/assets/models/lyra.blender-template.glb',
];

function readGlbJson(filePath) {
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

  throw new Error(`${filePath} does not contain a JSON chunk`);
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

function summarizeGlb(filePath) {
  const json = readGlbJson(filePath);
  let primitiveCount = 0;
  let triangleCount = 0;
  let morphTargetPrimitiveCount = 0;

  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      primitiveCount += 1;
      triangleCount += primitiveTriangleCount(json, primitive);
      if (Array.isArray(primitive.targets) && primitive.targets.length > 0) {
        morphTargetPrimitiveCount += 1;
      }
    }
  }

  const skins = json.skins ?? [];
  const animations = json.animations ?? [];
  const materials = json.materials ?? [];

  return {
    file: filePath,
    sizeKb: Math.round(readFileSync(filePath).byteLength / 102.4) / 10,
    nodes: json.nodes?.length ?? 0,
    meshes: json.meshes?.length ?? 0,
    primitives: primitiveCount,
    materials: materials.length,
    skins: skins.length,
    bones: Math.max(0, ...skins.map((skin) => skin.joints?.length ?? 0)),
    animations: animations.map((animation) => animation.name ?? '(unnamed)'),
    morphTargetPrimitiveCount,
    triangleCount,
  };
}

function printSummary(summary) {
  const animationNames = summary.animations.length > 0 ? summary.animations.join(', ') : 'none';
  console.log(`${basename(summary.file)}`);
  console.log(`  size: ${summary.sizeKb} KB`);
  console.log(`  nodes: ${summary.nodes}`);
  console.log(`  meshes/primitives: ${summary.meshes}/${summary.primitives}`);
  console.log(`  estimated triangles: ${summary.triangleCount}`);
  console.log(`  materials: ${summary.materials}`);
  console.log(`  skins/bones: ${summary.skins}/${summary.bones}`);
  console.log(`  morph target primitives: ${summary.morphTargetPrimitiveCount}`);
  console.log(`  animations: ${animationNames}`);
}

const files = process.argv.slice(2);
const inputFiles = files.length > 0 ? files : DEFAULT_FILES;
let failed = false;

for (const file of inputFiles) {
  try {
    printSummary(summarizeGlb(resolve(file)));
  } catch (error) {
    failed = true;
    console.error(`[inspect-glb] ${error.message}`);
  }
}

if (failed) process.exit(1);
