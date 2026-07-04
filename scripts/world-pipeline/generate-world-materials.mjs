import { deflateSync } from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';

const materialDir = path.resolve('public/assets/world/materials/procedural');
const lightmapDir = path.resolve('public/assets/world/lightmaps');
const decalDir = path.resolve('public/assets/world/decals/procedural');
const hdriDir = path.resolve('public/assets/world/hdri');
const vegetationDir = path.resolve('public/assets/world/vegetation/procedural');
const textureSize = 512;
const lightmapSize = 512;
const decalTextureSize = 512;
const vegetationTextureSize = 512;
const hdriWidth = 1024;
const hdriHeight = 512;

const surfaces = [
  { id: 'stone', dark: '#3f4250', mid: '#7f7988', light: '#d0b46e', roughness: [160, 230], normal: 32 },
  { id: 'wood', dark: '#271711', mid: '#714628', light: '#c28b55', roughness: [135, 212], normal: 24 },
  { id: 'metal', dark: '#403522', mid: '#b8944e', light: '#fff1bd', roughness: [90, 172], normal: 18 },
  { id: 'organic', dark: '#1f351f', mid: '#557f45', light: '#9dcf75', roughness: [180, 244], normal: 28 },
  { id: 'crystal', dark: '#19364c', mid: '#77d6ff', light: '#ffffff', roughness: [42, 136], normal: 16 },
  { id: 'ground', dark: '#273a32', mid: '#59715a', light: '#a0a46e', roughness: [174, 238], normal: 22 },
  { id: 'bark', dark: '#1f130d', mid: '#60412c', light: '#b27848', roughness: [178, 250], normal: 58 },
  { id: 'foliage', dark: '#1f4a2c', mid: '#66a85e', light: '#c8ee90', roughness: [150, 224], normal: 34 },
  { id: 'grass', dark: '#20431f', mid: '#6b914d', light: '#c6df78', roughness: [160, 232], normal: 40 },
];

const chunks = [
  { id: 'atrium', color: '#8ac7ff', warm: '#d9b267', center: [0.38, 0.36] },
  { id: 'arcane-library', color: '#c78aff', warm: '#b9824f', center: [0.72, 0.42] },
  { id: 'grand-hall', color: '#8feaff', warm: '#e0bd75', center: [0.52, 0.25] },
  { id: 'dining-hall', color: '#ffb066', warm: '#d89d5e', center: [0.78, 0.48] },
  { id: 'moonlit-lawn', color: '#a0c7ff', warm: '#a5d07f', center: [0.32, 0.62] },
  { id: 'lake-grotto', color: '#76f0ff', warm: '#7ac7d8', center: [0.48, 0.52] },
  { id: 'training-yard', color: '#ffd57b', warm: '#be8c55', center: [0.35, 0.35] },
  { id: 'crystal-greenhouse', color: '#9dffd9', warm: '#75c7b7', center: [0.58, 0.42] },
];

const decals = [
  { id: 'rune-wear', base: '#c9b66f', accent: '#7deeff', kind: 'rune', roughness: [150, 230], normal: 42 },
  { id: 'grime', base: '#171d24', accent: '#4f5f68', kind: 'grime', roughness: [190, 248], normal: 18 },
  { id: 'metal-wear', base: '#8a6a32', accent: '#f1d78a', kind: 'scrape', roughness: [104, 184], normal: 34 },
  { id: 'crack', base: '#18151b', accent: '#6b6068', kind: 'crack', roughness: [198, 252], normal: 54 },
  { id: 'spill', base: '#241019', accent: '#774052', kind: 'spill', roughness: [62, 132], normal: 22 },
  { id: 'dust', base: '#887f9a', accent: '#d8cfb9', kind: 'dust', roughness: [214, 255], normal: 12 },
  { id: 'organic-litter', base: '#234a34', accent: '#8fa66a', kind: 'leaf', roughness: [176, 242], normal: 30 },
  { id: 'mineral-stain', base: '#27616d', accent: '#a8f2e9', kind: 'mineral', roughness: [72, 158], normal: 26 },
  { id: 'impact', base: '#18120f', accent: '#9a7050', kind: 'impact', roughness: [182, 250], normal: 58 },
];

const vegetation = [
  { id: 'grass-clump', dark: '#193520', mid: '#4f7f43', light: '#a3d66f', kind: 'grass', roughness: [168, 238], normal: 32 },
  { id: 'fern-frond', dark: '#123427', mid: '#4d8b5d', light: '#9ad881', kind: 'fern', roughness: [160, 230], normal: 28 },
  { id: 'reed-clump', dark: '#1a3f37', mid: '#5f8e72', light: '#b6c982', kind: 'reed', roughness: [154, 224], normal: 30 },
];

const crcTable = createCrcTable();

await fs.mkdir(materialDir, { recursive: true });
await fs.mkdir(lightmapDir, { recursive: true });
await fs.mkdir(decalDir, { recursive: true });
await fs.mkdir(hdriDir, { recursive: true });
await fs.mkdir(vegetationDir, { recursive: true });

for (const surface of surfaces) {
  await writePng(path.join(materialDir, `${surface.id}.basecolor.png`), textureSize, textureSize, (x, y) => drawBaseColor(surface, x, y));
  await writePng(path.join(materialDir, `${surface.id}.normal.png`), textureSize, textureSize, (x, y) => drawNormal(surface, x, y));
  await writePng(path.join(materialDir, `${surface.id}.roughness.png`), textureSize, textureSize, (x, y) => drawScalar(surface, x, y, surface.roughness[0], surface.roughness[1]));
  await writePng(path.join(materialDir, `${surface.id}.ao.png`), textureSize, textureSize, (x, y) => drawAo(surface, x, y));
}

for (const chunk of chunks) {
  await writePng(path.join(lightmapDir, `${chunk.id}.lightmap.png`), lightmapSize, lightmapSize, (x, y) => drawLightmap(chunk, x, y));
}

for (const decal of decals) {
  await writePng(path.join(decalDir, `${decal.id}.albedo.png`), decalTextureSize, decalTextureSize, (x, y) => drawDecalAlbedo(decal, x, y));
  await writePng(path.join(decalDir, `${decal.id}.normal.png`), decalTextureSize, decalTextureSize, (x, y) => drawDecalNormal(decal, x, y));
  await writePng(path.join(decalDir, `${decal.id}.roughness.png`), decalTextureSize, decalTextureSize, (x, y) => drawDecalRoughness(decal, x, y));
}

for (const plant of vegetation) {
  await writePng(path.join(vegetationDir, `${plant.id}.albedo.png`), vegetationTextureSize, vegetationTextureSize, (x, y) => drawVegetationAlbedo(plant, x, y));
  await writePng(path.join(vegetationDir, `${plant.id}.normal.png`), vegetationTextureSize, vegetationTextureSize, (x, y) => drawVegetationNormal(plant, x, y));
  await writePng(path.join(vegetationDir, `${plant.id}.roughness.png`), vegetationTextureSize, vegetationTextureSize, (x, y) => drawVegetationRoughness(plant, x, y));
}

await writeHdr(path.join(hdriDir, 'academy-night-atrium.hdr'), hdriWidth, hdriHeight, drawAcademyHdri);
await writePng(path.join(hdriDir, 'academy-night-atrium.preview.png'), hdriWidth, hdriHeight, (u, v) => toneMapPreview(drawAcademyHdri(u, v), 1.05));

console.log(`[world-materials] wrote ${surfaces.length * 4} PBR textures to ${path.relative(process.cwd(), materialDir)}`);
console.log(`[world-materials] wrote ${chunks.length} lightmaps to ${path.relative(process.cwd(), lightmapDir)}`);
console.log(`[world-materials] wrote ${decals.length * 3} decal textures to ${path.relative(process.cwd(), decalDir)}`);
console.log(`[world-materials] wrote ${vegetation.length * 3} vegetation textures to ${path.relative(process.cwd(), vegetationDir)}`);
console.log(`[world-materials] wrote 1 HDRI environment to ${path.relative(process.cwd(), hdriDir)}`);

async function writePng(file, width, height, sample) {
  const rowLength = width * 4 + 1;
  const raw = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * rowLength;
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a = 255] = sample(x / (width - 1), y / (height - 1), x, y);
      const index = row + 1 + x * 4;
      raw[index] = clampByte(r);
      raw[index + 1] = clampByte(g);
      raw[index + 2] = clampByte(b);
      raw[index + 3] = clampByte(a);
    }
  }

  const png = Buffer.concat([
    pngSignature(),
    chunk('IHDR', Buffer.concat([
      uint32(width),
      uint32(height),
      Buffer.from([8, 6, 0, 0, 0]),
    ])),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  await fs.writeFile(file, png);
}

async function writeHdr(file, width, height, sample) {
  const header = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\nEXPOSURE=1.0000000000000\n\n-Y ${height} +X ${width}\n`, 'ascii');
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = sample(x / (width - 1), y / (height - 1));
      const [re, ge, be, ee] = toRgbe(r, g, b);
      const index = (y * width + x) * 4;
      pixels[index] = re;
      pixels[index + 1] = ge;
      pixels[index + 2] = be;
      pixels[index + 3] = ee;
    }
  }
  await fs.writeFile(file, Buffer.concat([header, pixels]));
}

function drawBaseColor(surface, u, v) {
  const n = fbm(surface.id, u * 7.5, v * 7.5, 5);
  const ridge = Math.abs(Math.sin((u * 18 + n * 4) + Math.cos(v * 13) * 0.8));
  const speckle = noise(`${surface.id}:speckle`, Math.floor(u * 180), Math.floor(v * 180));
  let t = 0.25 + n * 0.55;

  if (surface.id === 'wood') {
    t = 0.34 + 0.46 * Math.abs(Math.sin(v * 52 + fbm(surface.id, u * 2, v * 9, 4) * 5));
  } else if (surface.id === 'bark') {
    const fissure = barkFissure(u, v);
    const lichen = speckle > 0.965 ? 0.42 : 0;
    const base = mixColor(hex(surface.dark), hex(surface.mid), 0.34 + n * 0.38);
    const raised = mixColor(base, hex(surface.light), Math.max(0, 1 - fissure) * 0.24 + lichen * 0.18);
    const cracked = mixColor(raised, hex(surface.dark), fissure * 0.72);
    return [...cracked, 255];
  } else if (surface.id === 'foliage') {
    const mask = foliageClusterMask(u, v);
    const vein = Math.max(0, Math.cos((u - 0.5) * 38 + v * 9 + n * 2.2) - 0.28);
    const tipLight = Math.max(0, 0.55 - v) * 0.28;
    const base = mixColor(hex(surface.dark), hex(surface.mid), 0.28 + n * 0.32 + tipLight);
    const color = mixColor(base, hex(surface.light), vein * 0.34 + speckle * 0.08);
    return [color[0], color[1], color[2], Math.pow(mask, 0.68) * 255];
  } else if (surface.id === 'grass') {
    const mask = grassBladeMask(u, v);
    const bladeRidge = Math.max(0, Math.cos((u - 0.5) * 52 + v * 16) - 0.34);
    const base = mixColor(hex(surface.dark), hex(surface.mid), 0.34 + (1 - v) * 0.34 + n * 0.22);
    const color = mixColor(base, hex(surface.light), bladeRidge * 0.36 + Math.max(0, 0.22 - v) * 0.26);
    return [color[0], color[1], color[2], Math.pow(mask, 0.72) * 255];
  } else if (surface.id === 'metal') {
    t = 0.42 + 0.3 * u + 0.2 * ridge;
  } else if (surface.id === 'crystal') {
    const radial = Math.hypot(u - 0.38, v - 0.32);
    t = 0.18 + Math.max(0, 1 - radial * 1.8) * 0.66 + speckle * 0.18;
  }

  const base = mixColor(hex(surface.dark), hex(surface.mid), t);
  const accent = mixColor(base, hex(surface.light), Math.max(0, ridge - 0.62) * 0.42 + (speckle > 0.94 ? 0.22 : 0));
  return [...accent, 255];
}

function drawNormal(surface, u, v) {
  const e = 0.004;
  const h = height(surface, u, v);
  const hx = height(surface, u + e, v) - height(surface, u - e, v);
  const hy = height(surface, u, v + e) - height(surface, u, v - e);
  const scale = surface.normal;
  return [
    128 - hx * scale,
    128 - hy * scale,
    218 + h * 28,
    255,
  ];
}

function drawScalar(surface, u, v, minValue, maxValue) {
  const n = fbm(`${surface.id}:rough`, u * 9, v * 9, 5);
  const wear = Math.max(0, Math.sin(u * 34 + n * 4) * Math.cos(v * 28) - 0.18);
  const value = minValue + (maxValue - minValue) * (0.62 * n + 0.38 * wear);
  return [value, value, value, 255];
}

function drawAo(surface, u, v) {
  if (surface.id === 'bark') {
    const fissure = barkFissure(u, v);
    const value = 224 - fissure * 92 - (1 - fbm(`${surface.id}:ao`, u * 10, v * 16, 5)) * 24;
    return [value, value, value, 255];
  }
  if (surface.id === 'foliage') {
    const mask = foliageClusterMask(u, v);
    const overlap = Math.max(0, Math.sin(u * 31 + v * 17) * Math.cos(v * 39) - 0.1);
    const value = 235 - mask * 22 - overlap * 48;
    return [value, value, value, 255];
  }
  if (surface.id === 'grass') {
    const mask = grassBladeMask(u, v);
    const clump = Math.max(0, Math.sin(u * 48) * Math.cos(v * 26) - 0.18);
    const value = 230 - mask * 18 - clump * 44;
    return [value, value, value, 255];
  }
  const n = fbm(`${surface.id}:ao`, u * 11, v * 11, 5);
  const groove = Math.max(0, 0.72 - Math.abs(Math.sin(u * 22) * Math.cos(v * 20)));
  const value = 210 - groove * 58 - (1 - n) * 34;
  return [value, value, value, 255];
}

function drawLightmap(chunk, u, v) {
  const cool = hex(chunk.color);
  const warm = hex(chunk.warm);
  const radial = Math.max(0, 1 - Math.hypot(u - chunk.center[0], v - chunk.center[1]) * 1.75);
  const side = Math.max(0, 1 - Math.hypot(u - 0.82, v - 0.28) * 2.2);
  const ambient = 42 + fbm(`${chunk.id}:bake`, u * 8, v * 8, 4) * 30;
  const color = mixColor(
    [ambient, ambient + 6, ambient + 12],
    cool,
    radial * 0.58,
  );
  const warmed = mixColor(color, warm, side * 0.34);
  const occlusion = Math.max(0, 1 - edgeDistance(u, v) * 2.1);
  return [
    warmed[0] * (1 - occlusion * 0.35),
    warmed[1] * (1 - occlusion * 0.35),
    warmed[2] * (1 - occlusion * 0.35),
    255,
  ];
}

function drawDecalAlbedo(decal, u, v) {
  const mask = decalMask(decal, u, v);
  const grain = fbm(`${decal.id}:grain`, u * 18, v * 18, 5);
  const streak = Math.max(0, Math.sin((u + grain * 0.18) * 42) * Math.cos((v - grain * 0.12) * 28));
  const color = mixColor(hex(decal.base), hex(decal.accent), Math.min(1, grain * 0.48 + streak * 0.34));
  return [
    color[0],
    color[1],
    color[2],
    Math.pow(mask, 0.82) * 232,
  ];
}

function drawDecalNormal(decal, u, v) {
  const e = 0.0035;
  const h = decalHeight(decal, u, v);
  const hx = decalHeight(decal, u + e, v) - decalHeight(decal, u - e, v);
  const hy = decalHeight(decal, u, v + e) - decalHeight(decal, u, v - e);
  return [
    128 - hx * decal.normal,
    128 - hy * decal.normal,
    218 + h * 32,
    255,
  ];
}

function drawDecalRoughness(decal, u, v) {
  const [minValue, maxValue] = decal.roughness;
  const mask = decalMask(decal, u, v);
  const n = fbm(`${decal.id}:roughness`, u * 14, v * 14, 4);
  const edgePolish = Math.max(0, 1 - mask) * 0.22;
  const value = minValue + (maxValue - minValue) * Math.min(1, n * 0.72 + edgePolish);
  return [value, value, value, 255];
}

function drawVegetationAlbedo(plant, u, v) {
  const mask = vegetationMask(plant, u, v);
  const vertical = Math.max(0, 1 - v);
  const n = fbm(`${plant.id}:color`, u * 10, v * 14, 5);
  const vein = Math.max(0, Math.cos((u - 0.5) * 42 + n * 1.8) - 0.24);
  const base = mixColor(hex(plant.dark), hex(plant.mid), 0.28 + vertical * 0.48 + n * 0.18);
  const color = mixColor(base, hex(plant.light), vein * 0.28 + Math.max(0, 0.35 - v) * 0.32);
  return [color[0], color[1], color[2], Math.pow(mask, 0.72) * 255];
}

function drawVegetationNormal(plant, u, v) {
  const e = 0.0035;
  const h = vegetationHeight(plant, u, v);
  const hx = vegetationHeight(plant, u + e, v) - vegetationHeight(plant, u - e, v);
  const hy = vegetationHeight(plant, u, v + e) - vegetationHeight(plant, u, v - e);
  return [
    128 - hx * plant.normal,
    128 - hy * plant.normal,
    220 + h * 28,
    255,
  ];
}

function drawVegetationRoughness(plant, u, v) {
  const [minValue, maxValue] = plant.roughness;
  const n = fbm(`${plant.id}:roughness`, u * 11, v * 13, 4);
  const dew = vegetationMask(plant, u, v) * Math.max(0, Math.sin(u * 54 + v * 18) - 0.72);
  const value = minValue + (maxValue - minValue) * (0.52 + n * 0.4) - dew * 34;
  return [value, value, value, 255];
}

function vegetationHeight(plant, u, v) {
  const mask = vegetationMask(plant, u, v);
  const veins = plant.kind === 'fern'
    ? Math.max(0, Math.cos((u - 0.5) * 36) - 0.15)
    : Math.max(0, Math.cos((u - 0.5) * 28 + v * 8) - 0.28);
  return mask * (0.16 + veins * 0.72 + fbm(`${plant.id}:height`, u * 18, v * 18, 3) * 0.18);
}

function vegetationMask(plant, u, v) {
  if (plant.kind === 'fern') {
    const stem = Math.max(0, 1 - Math.abs(u - 0.5 - Math.sin(v * 6) * 0.035) * 44) * Math.max(0, 1 - v * 0.88);
    let leaflets = 0;
    for (let i = 0; i < 9; i += 1) {
      const cy = 0.14 + i * 0.084;
      const side = i % 2 === 0 ? -1 : 1;
      const cx = 0.5 + side * (0.08 + i * 0.012);
      const blade = softBlade(u, v, cx, cy, 0.18 + i * 0.01, 0.04, side * -0.72);
      leaflets = Math.max(leaflets, blade);
    }
    return clamp01(stem * 0.8 + leaflets);
  }

  if (plant.kind === 'reed') {
    let mask = 0;
    for (let i = 0; i < 7; i += 1) {
      const x = 0.22 + i * 0.092 + Math.sin(i * 2.1) * 0.018;
      const width = 0.034 + (i % 3) * 0.006;
      const curve = Math.sin(v * Math.PI * (1.2 + i * 0.08) + i) * 0.075 * (1 - v);
      const blade = Math.max(0, 1 - Math.abs(u - x - curve) / width) * Math.max(0, 1 - Math.pow(v, 1.7));
      mask = Math.max(mask, blade);
    }
    return clamp01(mask * softOval(u, v + 0.08, 0.98, 1.22));
  }

  let mask = 0;
  for (let i = 0; i < 9; i += 1) {
    const x = 0.14 + i * 0.09 + Math.sin(i * 1.7) * 0.025;
    const lean = (i - 4) * 0.025 + Math.sin(i * 3.1) * 0.055;
    const width = 0.026 + (i % 4) * 0.005;
    const blade = Math.max(0, 1 - Math.abs(u - x - lean * (1 - v)) / width) * Math.max(0, 1 - v * 0.92);
    mask = Math.max(mask, blade);
  }
  const tuft = Math.max(0, 1 - Math.hypot((u - 0.5) * 1.7, (v - 0.92) * 3.4));
  return clamp01(mask + tuft * 0.6);
}

function softBlade(u, v, cx, cy, length, width, angle) {
  const dx = u - cx;
  const dy = v - cy;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const x = dx * ca - dy * sa;
  const y = dx * sa + dy * ca;
  const taper = Math.max(0, 1 - Math.abs(x) / length);
  return clamp01(Math.max(0, 1 - Math.abs(y) / (width * taper + 0.002)) * taper);
}

function drawAcademyHdri(u, v) {
  const phi = u * Math.PI * 2;
  const y = 1 - v * 2;
  const horizon = Math.exp(-Math.abs(y) * 3.2);
  const upper = Math.max(0, y);
  const lower = Math.max(0, -y);
  const cloud = fbm('hdri:cloud', u * 9, v * 5, 5);
  let color = mixColor([0.035, 0.055, 0.11], [0.24, 0.34, 0.44], horizon * 0.62 + upper * 0.16);
  color = addColor(color, scaleColor([0.05, 0.09, 0.12], lower * 0.42));
  color = addColor(color, scaleColor([0.18, 0.26, 0.32], Math.max(0, cloud - 0.55) * 0.16));

  const moon = angularLight(phi, v, 5.42, 0.27, 0.08);
  const portal = angularLight(phi, v, 1.18, 0.53, 0.09);
  const windowA = angularLight(phi, v, 0.42, 0.48, 0.12);
  const windowB = angularLight(phi, v, 2.72, 0.46, 0.1);
  const libraryGlow = angularLight(phi, v, 3.52, 0.55, 0.16);
  const lakeGlow = angularLight(phi, v, 4.38, 0.62, 0.13);
  const star = starField(u, v);

  color = addColor(color, scaleColor([0.72, 0.9, 1.0], moon * 7.5));
  color = addColor(color, scaleColor([0.52, 0.95, 1.35], portal * 4.8));
  color = addColor(color, scaleColor([1.0, 0.62, 0.28], windowA * 3.2 + windowB * 2.8));
  color = addColor(color, scaleColor([0.62, 0.3, 1.1], libraryGlow * 3.1));
  color = addColor(color, scaleColor([0.22, 1.0, 1.2], lakeGlow * 2.4));
  color = addColor(color, scaleColor([0.78, 0.9, 1.0], star * 2.4));

  return color.map((channel) => Math.max(0, channel));
}

function angularLight(phi, v, centerPhi, centerV, radius) {
  const wrapped = Math.atan2(Math.sin(phi - centerPhi), Math.cos(phi - centerPhi));
  const d = Math.hypot(wrapped / Math.PI, (v - centerV) * 2.0);
  return Math.exp(-Math.pow(d / radius, 2.0));
}

function starField(u, v) {
  if (v > 0.58) return 0;
  const cellX = Math.floor(u * 720);
  const cellY = Math.floor(v * 260);
  const n = noise('hdri:stars', cellX, cellY);
  if (n < 0.9972) return 0;
  const twinkle = noise('hdri:twinkle', cellX + 17, cellY + 43);
  return (n - 0.9972) * 360 * (0.45 + twinkle * 0.75);
}

function toneMapPreview([r, g, b], exposure) {
  return [
    srgbByte(1 - Math.exp(-r * exposure)),
    srgbByte(1 - Math.exp(-g * exposure)),
    srgbByte(1 - Math.exp(-b * exposure)),
    255,
  ];
}

function toRgbe(r, g, b) {
  const maxValue = Math.max(r, g, b);
  if (maxValue < 1e-32) return [0, 0, 0, 0];
  const exponent = Math.ceil(Math.log2(maxValue));
  const scale = 256 / Math.pow(2, exponent);
  return [
    clampByte(r * scale),
    clampByte(g * scale),
    clampByte(b * scale),
    Math.max(0, Math.min(255, exponent + 128)),
  ];
}

function decalHeight(decal, u, v) {
  const mask = decalMask(decal, u, v);
  if (decal.kind === 'crack' || decal.kind === 'impact') return Math.pow(mask, 1.6);
  if (decal.kind === 'rune' || decal.kind === 'scrape') return mask * (0.44 + fbm(`${decal.id}:height`, u * 28, v * 28, 3) * 0.56);
  return mask * (0.18 + fbm(`${decal.id}:height`, u * 10, v * 10, 3) * 0.42);
}

function decalMask(decal, u, v) {
  const dx = u - 0.5;
  const dy = v - 0.5;
  const edge = softOval(u, v, 0.98, 0.82);
  const n = fbm(`${decal.id}:mask`, u * 7.5, v * 7.5, 5);

  if (decal.kind === 'rune') {
    const radius = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const ringA = Math.max(0, 1 - Math.abs(radius - 0.31) * 34);
    const ringB = Math.max(0, 1 - Math.abs(radius - 0.43) * 28);
    const glyph = Math.max(0, Math.cos(angle * 12 + n * 2.4) - 0.48) * Math.max(0, 1 - Math.abs(radius - 0.36) * 7);
    return clamp01((ringA * 0.72 + ringB * 0.36 + glyph * 0.68) * edge * (0.68 + n * 0.55));
  }

  if (decal.kind === 'crack') {
    const path = 0.5 + Math.sin(u * 10.5 + n * 2.2) * 0.09 + (u - 0.5) * 0.16;
    const main = Math.max(0, 1 - Math.abs(v - path) * 70);
    const branchA = Math.max(0, 1 - Math.abs(v - (0.38 + u * 0.2 + Math.sin(u * 16) * 0.04)) * 88) * Math.max(0, 1 - Math.abs(u - 0.42) * 6);
    const branchB = Math.max(0, 1 - Math.abs(v - (0.62 - u * 0.18 + Math.cos(u * 12) * 0.05)) * 78) * Math.max(0, 1 - Math.abs(u - 0.68) * 7);
    return clamp01((main + branchA * 0.62 + branchB * 0.5) * edge);
  }

  if (decal.kind === 'impact') {
    const radius = Math.hypot(dx * 1.1, dy * 0.9);
    const ring = Math.max(0, 1 - Math.abs(radius - 0.23) * 20);
    const radial = Math.max(0, 1 - radius * 2.8);
    const cracks = Math.max(0, Math.cos(Math.atan2(dy, dx) * 10 + n * 2) - 0.22) * Math.max(0, 1 - radius * 1.6);
    return clamp01((ring * 0.55 + radial * 0.7 + cracks * 0.5) * edge);
  }

  if (decal.kind === 'scrape') {
    const bands = Math.max(0, Math.sin((u * 74 + n * 7)) - 0.08);
    const scratches = Math.max(0, Math.cos((v + u * 0.24) * 52 + n * 4) - 0.24);
    return clamp01((bands * 0.42 + scratches * 0.64) * softOval(u, v, 0.96, 0.42));
  }

  if (decal.kind === 'leaf') {
    const blades = Math.max(0, Math.sin((u * 46 + n * 8)) * Math.cos((v * 38 - n * 5)) - 0.06);
    return clamp01((n * 0.72 + blades * 0.64) * softOval(u, v, 0.96, 0.66));
  }

  if (decal.kind === 'mineral') {
    const flow = Math.max(0, Math.sin((v + n * 0.22) * 32) + Math.cos(u * 18) * 0.4);
    return clamp01((n * 0.62 + flow * 0.24) * softOval(u, v, 1.0, 0.46));
  }

  if (decal.kind === 'spill') {
    return clamp01((0.45 + n * 0.72) * softOval(u + Math.sin(v * 9) * 0.035, v, 0.72, 0.52));
  }

  if (decal.kind === 'dust') {
    const powder = noise(`${decal.id}:powder`, Math.floor(u * 220), Math.floor(v * 220));
    return clamp01((n * 0.48 + (powder > 0.82 ? 0.46 : 0)) * softOval(u, v, 0.95, 0.62));
  }

  return clamp01((0.35 + n * 0.82) * edge);
}

function barkFissure(u, v) {
  const flow = Math.sin((u + fbm('bark:fissure-flow', u * 2.4, v * 9.5, 4) * 0.12) * 38);
  const split = Math.sin((u * 1.8 + v * 0.35) * 24 + fbm('bark:split', u * 8, v * 18, 4) * 4.8);
  const crack = Math.max(0, 0.74 - Math.abs(flow)) + Math.max(0, 0.7 - Math.abs(split)) * 0.62;
  const knots = Math.max(0, 1 - Math.hypot((u - 0.34) * 8.5, (v - 0.28) * 5.2))
    + Math.max(0, 1 - Math.hypot((u - 0.68) * 7.2, (v - 0.72) * 5.8)) * 0.7;
  return clamp01(crack * 0.72 + knots * 0.44);
}

function foliageClusterMask(u, v) {
  let mask = 0;
  for (let i = 0; i < 11; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const cx = 0.5 + side * (0.04 + (i % 5) * 0.032) + Math.sin(i * 1.9) * 0.045;
    const cy = 0.12 + i * 0.07 + Math.cos(i * 2.3) * 0.025;
    const angle = side * (-0.82 + i * 0.04) + Math.sin(i) * 0.28;
    const blade = softBlade(u, v, cx, cy, 0.18 + (i % 4) * 0.025, 0.052 + (i % 3) * 0.008, angle);
    mask = Math.max(mask, blade);
  }
  const central = Math.max(0, 1 - Math.abs(u - 0.5 - Math.sin(v * 7) * 0.024) * 36) * Math.max(0, 1 - v * 0.82);
  return clamp01(mask + central * 0.72);
}

function grassBladeMask(u, v) {
  let mask = 0;
  for (let i = 0; i < 13; i += 1) {
    const x = 0.09 + i * 0.07 + Math.sin(i * 2.7) * 0.026;
    const lean = (i - 6) * 0.018 + Math.sin(i * 1.4) * 0.068;
    const width = 0.018 + (i % 4) * 0.005;
    const blade = Math.max(0, 1 - Math.abs(u - x - lean * (1 - v)) / width) * Math.max(0, 1 - v * 0.94);
    mask = Math.max(mask, blade);
  }
  const baseClump = Math.max(0, 1 - Math.hypot((u - 0.5) * 1.8, (v - 0.94) * 4.0));
  return clamp01(mask + baseClump * 0.58);
}

function softOval(u, v, sx, sy) {
  const dx = (u - 0.5) / Math.max(0.001, sx * 0.5);
  const dy = (v - 0.5) / Math.max(0.001, sy * 0.5);
  const d = Math.hypot(dx, dy);
  return clamp01((1 - d) * 2.4);
}

function height(surface, u, v) {
  if (surface.id === 'wood') {
    return Math.abs(Math.sin(v * 48 + fbm(surface.id, u * 2, v * 9, 4) * 5));
  }
  if (surface.id === 'bark') {
    const fissure = barkFissure(u, v);
    const raisedGrain = Math.abs(Math.sin(u * 72 + fbm(`${surface.id}:grain`, u * 5, v * 20, 4) * 7));
    return Math.max(0, 0.78 - fissure) * 0.82 + raisedGrain * 0.24;
  }
  if (surface.id === 'foliage') {
    const mask = foliageClusterMask(u, v);
    const veins = Math.max(0, Math.cos((u - 0.5) * 42 + v * 8) - 0.2);
    return mask * (0.2 + veins * 0.68 + fbm(`${surface.id}:height`, u * 16, v * 16, 3) * 0.18);
  }
  if (surface.id === 'grass') {
    const mask = grassBladeMask(u, v);
    const veins = Math.max(0, Math.cos((u - 0.5) * 56 + v * 14) - 0.24);
    return mask * (0.18 + veins * 0.7 + fbm(`${surface.id}:height`, u * 18, v * 20, 3) * 0.18);
  }
  if (surface.id === 'metal') {
    return 0.5 + Math.sin((u + v) * 38) * 0.18 + fbm(surface.id, u * 12, v * 12, 4) * 0.28;
  }
  return fbm(`${surface.id}:height`, u * 8.5, v * 8.5, 5);
}

function edgeDistance(u, v) {
  return Math.min(u, 1 - u, v, 1 - v);
}

function fbm(seed, x, y, octaves) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  for (let i = 0; i < octaves; i += 1) {
    value += smoothNoise(seed, x * frequency, y * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / total;
}

function smoothNoise(seed, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const a = noise(seed, x0, y0);
  const b = noise(seed, x0 + 1, y0);
  const c = noise(seed, x0, y0 + 1);
  const d = noise(seed, x0 + 1, y0 + 1);
  return lerp(lerp(a, b, smoothstep(tx)), lerp(c, d, smoothstep(tx)), smoothstep(ty));
}

function noise(seed, x, y) {
  let h = 2166136261;
  const value = `${seed}:${x}:${y}`;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hex(value) {
  const clean = value.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function mixColor(a, b, t) {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];
}

function addColor(a, b) {
  return [
    a[0] + b[0],
    a[1] + b[1],
    a[2] + b[2],
  ];
}

function scaleColor(color, scale) {
  return [
    color[0] * scale,
    color[1] * scale,
    color[2] * scale,
  ];
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function srgbByte(linear) {
  const value = linear <= 0.0031308 ? linear * 12.92 : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
  return clampByte(value * 255);
}

function pngSignature() {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  return Buffer.concat([
    uint32(data.length),
    typeBuffer,
    data,
    uint32(crc32(Buffer.concat([typeBuffer, data]))),
  ]);
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function createCrcTable() {
  return new Uint32Array(256).map((_, index) => {
    let c = index;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return c >>> 0;
  });
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}
