import { readFile, writeFile } from 'node:fs/promises';

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error('Usage: node strip-gltf-textures.mjs <input.glb> <output.glb>');
  process.exit(1);
}

const glb = await readFile(inputPath);
const json = readGlbJson(glb);

for (const material of json.materials ?? []) {
  delete material.normalTexture;
  delete material.occlusionTexture;
  delete material.emissiveTexture;

  if (material.pbrMetallicRoughness) {
    delete material.pbrMetallicRoughness.baseColorTexture;
    delete material.pbrMetallicRoughness.metallicRoughnessTexture;
  }

  const specular = material.extensions?.KHR_materials_specular;
  if (specular) {
    delete specular.specularTexture;
    delete specular.specularColorTexture;
    if (Object.keys(specular).length === 0) delete material.extensions.KHR_materials_specular;
  }

  if (material.extensions && Object.keys(material.extensions).length === 0) {
    delete material.extensions;
  }
}

await writeFile(outputPath, writeGlbJson(glb, json));

function readGlbJson(glbBuffer) {
  if (glbBuffer.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error(`${inputPath} is not a binary glTF file`);
  }
  const jsonLength = glbBuffer.readUInt32LE(12);
  const chunkType = glbBuffer.toString('ascii', 16, 20);
  if (chunkType !== 'JSON') {
    throw new Error(`${inputPath} does not start with a JSON chunk`);
  }
  return JSON.parse(glbBuffer.toString('utf8', 20, 20 + jsonLength));
}

function writeGlbJson(glbBuffer, json) {
  const originalJsonLength = glbBuffer.readUInt32LE(12);
  const binOffset = 20 + originalJsonLength;
  const binChunk = glbBuffer.subarray(binOffset);
  const jsonBytes = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
  const paddedJsonLength = jsonBytes.length + jsonPadding;
  const totalLength = 12 + 8 + paddedJsonLength + binChunk.length;
  const output = Buffer.alloc(totalLength);

  output.write('glTF', 0, 'ascii');
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(totalLength, 8);
  output.writeUInt32LE(paddedJsonLength, 12);
  output.write('JSON', 16, 'ascii');
  jsonBytes.copy(output, 20);
  output.fill(0x20, 20 + jsonBytes.length, 20 + paddedJsonLength);
  binChunk.copy(output, 20 + paddedJsonLength);
  return output;
}
