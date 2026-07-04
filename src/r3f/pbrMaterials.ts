import * as THREE from 'three';

export interface PbrTextureSet {
  readonly albedo: THREE.Texture;
  readonly normal: THREE.Texture;
  readonly roughness: THREE.Texture;
  readonly ao: THREE.Texture;
}

export interface DecalTextureSet {
  readonly albedo: THREE.Texture;
  readonly normal: THREE.Texture;
  readonly roughness: THREE.Texture;
}

export interface VegetationTextureSet {
  readonly albedo: THREE.Texture;
  readonly normal: THREE.Texture;
  readonly roughness: THREE.Texture;
}

const textureCache = new Map<string, PbrTextureSet>();
const fileTextureCache = new Map<string, PbrTextureSet>();
const decalTextureCache = new Map<string, DecalTextureSet>();
const vegetationTextureCache = new Map<string, VegetationTextureSet>();
const fileTextureLoader = new THREE.TextureLoader();
const materialTextureRoot = '/assets/world/materials/procedural';
const decalTextureRoot = '/assets/world/decals/procedural';
const vegetationTextureRoot = '/assets/world/vegetation/procedural';

export type FilePbrSurface = 'stone' | 'wood' | 'metal' | 'organic' | 'crystal' | 'ground' | 'bark' | 'foliage' | 'grass';
export type WorldDecalTextureId =
  | 'rune-wear'
  | 'grime'
  | 'metal-wear'
  | 'crack'
  | 'spill'
  | 'dust'
  | 'organic-litter'
  | 'mineral-stain'
  | 'impact';
export type WorldVegetationTextureId = 'grass-clump' | 'fern-frond' | 'reed-clump';

export function createFilePbrSet(surface: FilePbrSurface): PbrTextureSet {
  const cached = fileTextureCache.get(surface);
  if (cached) return cached;

  const set = {
    albedo: configureTexture(fileTextureLoader.load(`${materialTextureRoot}/${surface}.basecolor.png`), 3),
    normal: configureDataTexture(fileTextureLoader.load(`${materialTextureRoot}/${surface}.normal.png`), 3),
    roughness: configureDataTexture(fileTextureLoader.load(`${materialTextureRoot}/${surface}.roughness.png`), 3),
    ao: configureDataTexture(fileTextureLoader.load(`${materialTextureRoot}/${surface}.ao.png`), 3),
  };
  fileTextureCache.set(surface, set);
  return set;
}

export function createWorldDecalSet(decal: WorldDecalTextureId): DecalTextureSet {
  const cached = decalTextureCache.get(decal);
  if (cached) return cached;

  const set = {
    albedo: configureTexture(fileTextureLoader.load(`${decalTextureRoot}/${decal}.albedo.png`), 1),
    normal: configureDataTexture(fileTextureLoader.load(`${decalTextureRoot}/${decal}.normal.png`), 1),
    roughness: configureDataTexture(fileTextureLoader.load(`${decalTextureRoot}/${decal}.roughness.png`), 1),
  };
  decalTextureCache.set(decal, set);
  return set;
}

export function createWorldVegetationSet(vegetation: WorldVegetationTextureId): VegetationTextureSet {
  const cached = vegetationTextureCache.get(vegetation);
  if (cached) return cached;

  const set = {
    albedo: configureTexture(fileTextureLoader.load(`${vegetationTextureRoot}/${vegetation}.albedo.png`), 1),
    normal: configureDataTexture(fileTextureLoader.load(`${vegetationTextureRoot}/${vegetation}.normal.png`), 1),
    roughness: configureDataTexture(fileTextureLoader.load(`${vegetationTextureRoot}/${vegetation}.roughness.png`), 1),
  };
  vegetationTextureCache.set(vegetation, set);
  return set;
}

export function createStonePbrSet(key: string, base: string, vein: string, accent: string): PbrTextureSet {
  return getOrCreateTextureSet(`stone:${key}:${base}:${vein}:${accent}`, (ctx, size) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 220; i += 1) {
      const x = seededNoise(key, i) * size;
      const y = seededNoise(key, i + 1000) * size;
      const len = 18 + seededNoise(key, i + 2000) * 72;
      ctx.strokeStyle = i % 7 === 0 ? accent : vein;
      ctx.globalAlpha = 0.12 + seededNoise(key, i + 3000) * 0.22;
      ctx.lineWidth = 0.4 + seededNoise(key, i + 4000) * 2.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(
        x + seededSigned(key, i + 10) * len,
        y + seededSigned(key, i + 11) * len * 0.45,
        x + seededSigned(key, i + 12) * len,
        y + seededSigned(key, i + 13) * len,
        x + seededSigned(key, i + 14) * len,
        y + seededSigned(key, i + 15) * len,
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

export function createGroundPbrSet(key: string, dark: string, mid: string, light: string): PbrTextureSet {
  return getOrCreateTextureSet(`ground:${key}:${dark}:${mid}:${light}`, (ctx, size) => {
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, dark);
    gradient.addColorStop(0.52, mid);
    gradient.addColorStop(1, light);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 1000; i += 1) {
      const x = seededNoise(key, i) * size;
      const y = seededNoise(key, i + 2000) * size;
      const r = 0.5 + seededNoise(key, i + 4000) * 2.4;
      ctx.globalAlpha = 0.08 + seededNoise(key, i + 6000) * 0.28;
      ctx.fillStyle = i % 5 === 0 ? light : dark;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.8, r, seededNoise(key, i + 8000) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

export function createWoodPbrSet(key: string, dark: string, mid: string, highlight: string): PbrTextureSet {
  return getOrCreateTextureSet(`wood:${key}:${dark}:${mid}:${highlight}`, (ctx, size) => {
    ctx.fillStyle = mid;
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 1) {
      const wave = Math.sin(y * 0.045 + seededNoise(key, y) * 3.2) * 10;
      ctx.globalAlpha = 0.2 + seededNoise(key, y + 800) * 0.28;
      ctx.strokeStyle = y % 9 === 0 ? highlight : dark;
      ctx.lineWidth = y % 11 === 0 ? 2.2 : 0.8;
      ctx.beginPath();
      ctx.moveTo(0, y + wave);
      ctx.bezierCurveTo(size * 0.28, y - wave * 0.4, size * 0.72, y + wave * 0.7, size, y - wave);
      ctx.stroke();
    }
    for (let i = 0; i < 70; i += 1) {
      const x = seededNoise(key, i + 1200) * size;
      const y = seededNoise(key, i + 2400) * size;
      ctx.globalAlpha = 0.12 + seededNoise(key, i + 3600) * 0.18;
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.ellipse(x, y, 8 + seededNoise(key, i + 4800) * 22, 2 + seededNoise(key, i + 6000) * 5, seededNoise(key, i + 7200) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

export function createMetalPbrSet(key: string, base: string, tarnish: string, highlight: string): PbrTextureSet {
  return getOrCreateTextureSet(`metal:${key}:${base}:${tarnish}:${highlight}`, (ctx, size) => {
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, tarnish);
    gradient.addColorStop(0.42, base);
    gradient.addColorStop(1, highlight);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 260; i += 1) {
      const y = seededNoise(key, i + 500) * size;
      ctx.globalAlpha = 0.08 + seededNoise(key, i + 1200) * 0.2;
      ctx.strokeStyle = i % 5 === 0 ? highlight : tarnish;
      ctx.lineWidth = 0.4 + seededNoise(key, i + 2200) * 1.4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y + seededSigned(key, i + 3200) * 14);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

export function createOrganicPbrSet(key: string, dark: string, mid: string, light: string): PbrTextureSet {
  return getOrCreateTextureSet(`organic:${key}:${dark}:${mid}:${light}`, (ctx, size) => {
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 850; i += 1) {
      const x = seededNoise(key, i) * size;
      const y = seededNoise(key, i + 2000) * size;
      const len = 12 + seededNoise(key, i + 4000) * 42;
      ctx.globalAlpha = 0.1 + seededNoise(key, i + 6000) * 0.35;
      ctx.strokeStyle = i % 4 === 0 ? light : mid;
      ctx.lineWidth = 0.5 + seededNoise(key, i + 8000) * 1.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + seededSigned(key, i + 10000) * len, y + seededSigned(key, i + 12000) * len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

export function createCrystalPbrSet(key: string, dark: string, mid: string, highlight: string): PbrTextureSet {
  return getOrCreateTextureSet(`crystal:${key}:${dark}:${mid}:${highlight}`, (ctx, size) => {
    const gradient = ctx.createRadialGradient(size * 0.35, size * 0.3, size * 0.04, size * 0.5, size * 0.5, size * 0.78);
    gradient.addColorStop(0, highlight);
    gradient.addColorStop(0.45, mid);
    gradient.addColorStop(1, dark);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 44; i += 1) {
      ctx.globalAlpha = 0.16 + seededNoise(key, i) * 0.34;
      ctx.strokeStyle = i % 3 === 0 ? highlight : '#ffffff';
      ctx.lineWidth = 1 + seededNoise(key, i + 1000) * 2;
      ctx.beginPath();
      ctx.moveTo(seededNoise(key, i + 2000) * size, seededNoise(key, i + 3000) * size);
      ctx.lineTo(seededNoise(key, i + 4000) * size, seededNoise(key, i + 5000) * size);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

export function createPbrMaterial(
  name: string,
  set: PbrTextureSet,
  options: {
    readonly color?: number;
    readonly roughness?: number;
    readonly metalness?: number;
    readonly envMapIntensity?: number;
    readonly normalScale?: number;
  } = {},
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    name,
    color: options.color ?? 0xffffff,
    map: set.albedo,
    normalMap: set.normal,
    roughnessMap: set.roughness,
    aoMap: set.ao,
    roughness: options.roughness ?? 0.72,
    metalness: options.metalness ?? 0.04,
    envMapIntensity: options.envMapIntensity ?? 0.7,
  });
  material.normalScale.setScalar(options.normalScale ?? 0.45);
  return material;
}

export function configureTexture(texture: THREE.Texture, repeat = 1): THREE.Texture {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (texture.image) texture.needsUpdate = true;
  return texture;
}

export function configureDataTexture(texture: THREE.Texture, repeat = 1): THREE.Texture {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 8;
  if (texture.image) texture.needsUpdate = true;
  return texture;
}

function getOrCreateTextureSet(
  key: string,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
): PbrTextureSet {
  const cached = textureCache.get(key);
  if (cached) return cached;

  const size = 384;
  const albedo = drawCanvas(size, draw);
  const normal = drawCanvas(size, (ctx) => drawNormalTexture(ctx, size, key));
  const roughness = drawCanvas(size, (ctx) => drawScalarTexture(ctx, size, key, 132, 224));
  const ao = drawCanvas(size, (ctx) => drawScalarTexture(ctx, size, key, 178, 255));
  const set = {
    albedo: configureTexture(albedo, 3) as THREE.CanvasTexture,
    normal: configureDataTexture(normal, 3) as THREE.CanvasTexture,
    roughness: configureDataTexture(roughness, 3) as THREE.CanvasTexture,
    ao: configureDataTexture(ao, 3) as THREE.CanvasTexture,
  };
  textureCache.set(key, set);
  return set;
}

function drawCanvas(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  draw(ctx, size);
  return new THREE.CanvasTexture(canvas);
}

function drawNormalTexture(ctx: CanvasRenderingContext2D, size: number, key: string): void {
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const n = seededNoise(key, x * 17 + y * 71);
      const ridge = Math.sin((x + n * 28) * 0.09) * Math.cos((y - n * 20) * 0.08);
      const idx = (y * size + x) * 4;
      image.data[idx] = 128 + ridge * 18;
      image.data[idx + 1] = 128 + Math.sin((x + y) * 0.06) * 14;
      image.data[idx + 2] = 216 + n * 28;
      image.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function drawScalarTexture(
  ctx: CanvasRenderingContext2D,
  size: number,
  key: string,
  minValue: number,
  maxValue: number,
): void {
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const n = seededNoise(key, x * 31 + y * 37);
      const v = Math.floor(minValue + n * (maxValue - minValue));
      const idx = (y * size + x) * 4;
      image.data[idx] = v;
      image.data[idx + 1] = v;
      image.data[idx + 2] = v;
      image.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function seededNoise(seed: string, n: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= n;
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^= h >>> 16) >>> 0) / 4294967295;
}

function seededSigned(seed: string, n: number): number {
  return seededNoise(seed, n) * 2 - 1;
}
