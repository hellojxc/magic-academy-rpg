import * as THREE from 'three';

const geoCache = new Map<string, THREE.BufferGeometry>();
const matCache = new Map<string, THREE.MeshStandardMaterial>();
const texCache = new Map<string, THREE.CanvasTexture>();

function paramKey(prefix: string, params: Record<string, unknown>): string {
  return prefix + '|' + Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
}

export const Geo = {
  box: (w: number, h: number, d: number): THREE.BoxGeometry => {
    const key = paramKey('box', { w, h, d });
    if (geoCache.has(key)) return geoCache.get(key) as THREE.BoxGeometry;
    const g = new THREE.BoxGeometry(w, h, d);
    geoCache.set(key, g);
    return g;
  },
  plane: (w: number, h: number): THREE.PlaneGeometry => {
    const key = paramKey('plane', { w, h });
    if (geoCache.has(key)) return geoCache.get(key) as THREE.PlaneGeometry;
    const g = new THREE.PlaneGeometry(w, h);
    geoCache.set(key, g);
    return g;
  },
  cylinder: (rt: number, rb: number, h: number, s: number): THREE.CylinderGeometry => {
    const key = paramKey('cyl', { rt, rb, h, s });
    if (geoCache.has(key)) return geoCache.get(key) as THREE.CylinderGeometry;
    const g = new THREE.CylinderGeometry(rt, rb, h, s);
    geoCache.set(key, g);
    return g;
  },
  sphere: (r: number, ws: number, hs: number): THREE.SphereGeometry => {
    const key = paramKey('sphere', { r, ws, hs });
    if (geoCache.has(key)) return geoCache.get(key) as THREE.SphereGeometry;
    const g = new THREE.SphereGeometry(r, ws, hs);
    geoCache.set(key, g);
    return g;
  },
  spherePartial: (r: number, ws: number, hs: number, phiStart: number, phiLength: number, thetaStart: number, thetaLength: number): THREE.SphereGeometry => {
    const key = paramKey('spherePartial', { r, ws, hs, phiStart, phiLength, thetaStart, thetaLength });
    if (geoCache.has(key)) return geoCache.get(key) as THREE.SphereGeometry;
    const g = new THREE.SphereGeometry(r, ws, hs, phiStart, phiLength, thetaStart, thetaLength);
    geoCache.set(key, g);
    return g;
  },
  torus: (r: number, tube: number, rs: number, ts: number): THREE.TorusGeometry => {
    const key = paramKey('torus', { r, tube, rs, ts });
    if (geoCache.has(key)) return geoCache.get(key) as THREE.TorusGeometry;
    const g = new THREE.TorusGeometry(r, tube, rs, ts);
    geoCache.set(key, g);
    return g;
  },
  torusArc: (r: number, tube: number, rs: number, ts: number, arc: number): THREE.TorusGeometry => {
    const key = paramKey('torusArc', { r, tube, rs, ts, arc });
    if (geoCache.has(key)) return geoCache.get(key) as THREE.TorusGeometry;
    const g = new THREE.TorusGeometry(r, tube, rs, ts, arc);
    geoCache.set(key, g);
    return g;
  },
  cone: (r: number, h: number, s: number): THREE.ConeGeometry => {
    const key = paramKey('cone', { r, h, s });
    if (geoCache.has(key)) return geoCache.get(key) as THREE.ConeGeometry;
    const g = new THREE.ConeGeometry(r, h, s);
    geoCache.set(key, g);
    return g;
  },
  coneOpen: (r: number, h: number, s: number, hs: number, openEnded: boolean): THREE.ConeGeometry => {
    const key = paramKey('coneOpen', { r, h, s, hs, openEnded });
    if (geoCache.has(key)) return geoCache.get(key) as THREE.ConeGeometry;
    const g = new THREE.ConeGeometry(r, h, s, hs, openEnded);
    geoCache.set(key, g);
    return g;
  },
  octahedron: (r: number, d: number): THREE.OctahedronGeometry => {
    const key = paramKey('octa', { r, d });
    if (geoCache.has(key)) return geoCache.get(key) as THREE.OctahedronGeometry;
    const g = new THREE.OctahedronGeometry(r, d);
    geoCache.set(key, g);
    return g;
  },
  dodecahedron: (r: number, d: number): THREE.DodecahedronGeometry => {
    const key = paramKey('dodeca', { r, d });
    if (geoCache.has(key)) return geoCache.get(key) as THREE.DodecahedronGeometry;
    const g = new THREE.DodecahedronGeometry(r, d);
    geoCache.set(key, g);
    return g;
  },
  capsule: (r: number, len: number, cs: number, rs: number): THREE.CapsuleGeometry => {
    const key = paramKey('capsule', { r, len, cs, rs });
    if (geoCache.has(key)) return geoCache.get(key) as THREE.CapsuleGeometry;
    const g = new THREE.CapsuleGeometry(r, len, cs, rs);
    geoCache.set(key, g);
    return g;
  },
  circle: (r: number, s: number): THREE.CircleGeometry => {
    const key = paramKey('circle', { r, s });
    if (geoCache.has(key)) return geoCache.get(key) as THREE.CircleGeometry;
    const g = new THREE.CircleGeometry(r, s);
    geoCache.set(key, g);
    return g;
  },
};

export const UNIT_BOX = Geo.box(1, 1, 1);

export function getStandardMaterial(params: {
  color: number;
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  map?: THREE.Texture;
  bumpMap?: THREE.Texture;
  bumpScale?: number;
  roughnessMap?: THREE.Texture;
  depthWrite?: boolean;
}): THREE.MeshStandardMaterial {
  const r = params.roughness ?? 0.5;
  const m = params.metalness ?? 0.0;
  const key = paramKey('mat', {
    c: params.color, r: r.toFixed(3), m: m.toFixed(3),
    e: params.emissive ?? 0, ei: (params.emissiveIntensity ?? 0).toFixed(2),
    tr: params.transparent ?? false, op: (params.opacity ?? 1).toFixed(2),
    dw: params.depthWrite ?? true,
    map: params.map?.uuid ?? '0',
    bm: params.bumpMap?.uuid ?? '0',
    bs: (params.bumpScale ?? 0).toFixed(4),
    rm: params.roughnessMap?.uuid ?? '0',
  });
  if (matCache.has(key)) return matCache.get(key)!;
  const ctorParams: THREE.MeshStandardMaterialParameters = {
    color: params.color, roughness: r, metalness: m,
  };
  if (params.emissive !== undefined) ctorParams.emissive = params.emissive;
  if (params.emissiveIntensity !== undefined) ctorParams.emissiveIntensity = params.emissiveIntensity;
  if (params.transparent !== undefined) ctorParams.transparent = params.transparent;
  if (params.opacity !== undefined) ctorParams.opacity = params.opacity;
  if (params.depthWrite !== undefined) ctorParams.depthWrite = params.depthWrite;
  if (params.map) ctorParams.map = params.map;
  if (params.bumpMap) ctorParams.bumpMap = params.bumpMap;
  if (params.bumpScale !== undefined) ctorParams.bumpScale = params.bumpScale;
  if (params.roughnessMap) ctorParams.roughnessMap = params.roughnessMap;
  const mat = new THREE.MeshStandardMaterial(ctorParams);
  matCache.set(key, mat);
  return mat;
}

export const MatLib = {
  gold: getStandardMaterial({ color: 0xc7a060, roughness: 0.24, metalness: 0.48 }),
  goldFrame: getStandardMaterial({ color: 0xc7a060, roughness: 0.24, metalness: 0.45 }),
  wallLower: getStandardMaterial({ color: 0x7b6680, roughness: 0.5, metalness: 0.08 }),
  wallLowerWarm: getStandardMaterial({ color: 0x7b6a5e, roughness: 0.5, metalness: 0.08 }),
  warmLight: getStandardMaterial({ color: 0xffd674, emissive: 0xffb847, emissiveIntensity: 1.8 }),
  warmGlowWeak: getStandardMaterial({ color: 0xffd674, emissive: 0xffb847, emissiveIntensity: 1.65 }),
  windowGlass: getStandardMaterial({ color: 0xbfe7ff, emissive: 0x5c8eda, emissiveIntensity: 0.18, transparent: true, opacity: 0.58, roughness: 0.12, metalness: 0.02 }),
  windowGlassDining: getStandardMaterial({ color: 0xbfe7ff, emissive: 0x5c8eda, emissiveIntensity: 0.15, transparent: true, opacity: 0.55, roughness: 0.12, metalness: 0.02 }),
  crystal: getStandardMaterial({ color: 0xbfe7ff, emissive: 0x5c8eda, emissiveIntensity: 1.5, transparent: true, opacity: 0.75 }),
  fire: getStandardMaterial({ color: 0xff6020, emissive: 0xff4010, emissiveIntensity: 2.5 }),
  firefly: getStandardMaterial({ color: 0xfff4a0, emissive: 0xffd674, emissiveIntensity: 2.5 }),
  waterBlue: getStandardMaterial({ color: 0x4a9ec9, transparent: true, opacity: 0.75, roughness: 0.1, metalness: 0.03 }),
  waterSpout: getStandardMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.5, roughness: 0.05 }),
  leafGreen: getStandardMaterial({ color: 0x3d7a30, roughness: 0.75 }),
  leafGreenMid: getStandardMaterial({ color: 0x4f8b3e, roughness: 0.75 }),
  leafGreenLight: getStandardMaterial({ color: 0x5a9b4a, roughness: 0.75 }),
  bark: getStandardMaterial({ color: 0x5a3e28, roughness: 0.65, metalness: 0.05 }),
  sand: getStandardMaterial({ color: 0xc4a86a, roughness: 0.7, metalness: 0.02 }),
  lakeBed: getStandardMaterial({ color: 0x2a3a4a, roughness: 0.9 }),
  waterSparkle: getStandardMaterial({ color: 0xc8e8ff, emissive: 0x9fdcff, emissiveIntensity: 1.5, transparent: true, opacity: 0.6 }),
  plate: getStandardMaterial({ color: 0xf0eadf, roughness: 0.3, metalness: 0.05 }),
  cup: getStandardMaterial({ color: 0xddc8a0, roughness: 0.2 }),
  chandelier: getStandardMaterial({ color: 0xd6b45d, roughness: 0.28, metalness: 0.42 }),
  candleWax: getStandardMaterial({ color: 0xf0e8d0, roughness: 0.3 }),
  reed: getStandardMaterial({ color: 0x6b8a3a, roughness: 0.7 }),
  lilyPad: getStandardMaterial({ color: 0x2d6b1a, roughness: 0.6, metalness: 0.03 }),
  lilyFlower: getStandardMaterial({ color: 0xfff4e0, roughness: 0.3 }),
  fireStone: getStandardMaterial({ color: 0x5a4a3e, roughness: 0.6, metalness: 0.06 }),
};

function makeTextureImpl(
  key: string,
  size: number,
  paint: (ctx: CanvasRenderingContext2D, size: number) => void,
  setup: (tex: THREE.CanvasTexture) => void
): THREE.CanvasTexture {
  if (texCache.has(key)) return texCache.get(key)!;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  paint(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  setup(texture);
  texCache.set(key, texture);
  return texture;
}

export function makeSharedSurfaceDetailTexture(key: string, repeatX: number, repeatY: number): THREE.CanvasTexture {
  return makeTextureImpl(`surface-detail|${key}|${repeatX}|${repeatY}`, 512, (ctx, size) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 1800; i += 1) {
      const shade = 92 + Math.random() * 86;
      ctx.fillStyle = `rgba(${shade},${shade},${shade},${0.16 + Math.random() * 0.28})`;
      const w = 1 + Math.random() * 5;
      const h = 1 + Math.random() * 5;
      ctx.fillRect(Math.random() * size, Math.random() * size, w, h);
    }

    ctx.strokeStyle = 'rgba(44,44,44,0.34)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 56; i += 1) {
      const y = Math.random() * size;
      ctx.beginPath();
      ctx.moveTo(-24, y);
      ctx.bezierCurveTo(size * 0.25, y + Math.random() * 42 - 21, size * 0.72, y + Math.random() * 48 - 24, size + 24, y + Math.random() * 34 - 17);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(220,220,220,0.16)';
    for (let i = 0; i < 24; i += 1) {
      const x = Math.random() * size;
      ctx.beginPath();
      ctx.moveTo(x, -20);
      ctx.lineTo(x + Math.random() * 60 - 30, size + 20);
      ctx.stroke();
    }
  }, (tex) => {
    tex.colorSpace = THREE.NoColorSpace;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = 8;
  });
}

export function makeSharedMarbleTexture(light: string, mid: string, dark: string): THREE.CanvasTexture {
  return makeTextureImpl(`marble|${light}|${mid}|${dark}`, 512, (ctx, size) => {
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, light); g.addColorStop(0.48, mid); g.addColorStop(1, dark);
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = 2;
    for (let i = 0; i <= size; i += 128) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(64,48,82,0.18)';
    for (let i = 0; i < 42; i++) { const y = Math.random() * size; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(size * 0.28, y + Math.random() * 80 - 40, size * 0.62, y + Math.random() * 90 - 45, size, y + Math.random() * 80 - 40); ctx.stroke(); }
  }, (tex) => { tex.repeat.set(4.4, 3.1); tex.anisotropy = 8; });
}

export function makeSharedPlasterTexture(light: string, mid: string, dark: string): THREE.CanvasTexture {
  return makeTextureImpl(`plaster|${light}|${mid}|${dark}`, 512, (ctx, size) => {
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, light); g.addColorStop(0.52, mid); g.addColorStop(1, dark);
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 140; i++) ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
    ctx.strokeStyle = 'rgba(91,76,98,0.16)';
    for (let y = 42; y < size; y += 84) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y + 8); ctx.stroke(); }
  }, (tex) => { tex.repeat.set(2.4, 1.2); tex.anisotropy = 8; });
}

export function makeSharedWoodTexture(): THREE.CanvasTexture {
  return makeTextureImpl('wood', 256, (ctx, size) => {
    const g = ctx.createLinearGradient(0, 0, size, 0);
    g.addColorStop(0, '#3a211a'); g.addColorStop(0.46, '#74462d'); g.addColorStop(1, '#4f2f24');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    for (let y = 8; y < size; y += 13) { ctx.strokeStyle = y % 2 === 0 ? 'rgba(255,213,153,0.12)' : 'rgba(16,7,5,0.18)'; ctx.lineWidth = 1 + (y % 5); ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(size * 0.25, y - 8, size * 0.62, y + 9, size, y - 2); ctx.stroke(); }
  }, (tex) => { tex.repeat.set(1.4, 2.4); tex.anisotropy = 8; });
}

export function makeSharedGrassTexture(): THREE.CanvasTexture {
  return makeTextureImpl('grass', 512, (ctx, size) => {
    ctx.fillStyle = '#4a8b3a'; ctx.fillRect(0, 0, size, size);
    const g = ctx.createRadialGradient(size * 0.35, size * 0.35, 20, size * 0.5, size * 0.5, size * 0.75);
    g.addColorStop(0, 'rgba(115,166,78,0.34)'); g.addColorStop(0.55, 'rgba(64,122,48,0.18)'); g.addColorStop(1, 'rgba(35,78,36,0.28)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    const greens = ['#5d9b47', '#3f7d34', '#6dae55', '#4e8d3e', '#345f2d', '#7ca95b'];
    for (let i = 0; i < 1200; i++) { ctx.fillStyle = greens[Math.floor(Math.random() * greens.length)]; ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 4, 1 + Math.random() * 2); }
    ctx.lineWidth = 0.85;
    for (let i = 0; i < 520; i++) { const x = Math.random() * size; const y = Math.random() * size; ctx.strokeStyle = i % 3 === 0 ? 'rgba(160,205,108,0.34)' : 'rgba(39,86,37,0.26)'; ctx.beginPath(); ctx.moveTo(x, y + 3); ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 3, y - 1, x + (Math.random() - 0.5) * 6, y - 6 - Math.random() * 5); ctx.stroke(); }
  }, (tex) => { tex.repeat.set(8, 8); tex.anisotropy = 8; });
}

export function makeSharedWaterTexture(): THREE.CanvasTexture {
  return makeTextureImpl('water', 256, (ctx, size) => {
    ctx.fillStyle = '#2a6e9e'; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(140,200,255,0.25)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 60; i++) { const x = Math.random() * size; const y = Math.random() * size; const r = 8 + Math.random() * 24; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.4, Math.random() * Math.PI, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(200,230,255,0.15)';
    for (let i = 0; i < 80; i++) ctx.fillRect(Math.random() * size, Math.random() * size, 2, 1);
  }, (tex) => { tex.repeat.set(6, 6); tex.anisotropy = 8; });
}

export function makeSharedCarpetTexture(): THREE.CanvasTexture {
  return makeTextureImpl('carpet', 256, (ctx, size) => {
    ctx.fillStyle = '#6c2f71'; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(255,220,139,0.32)'; ctx.lineWidth = 5; ctx.strokeRect(16, 16, size - 32, size - 32);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    for (let x = 12; x < size; x += 18) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 42, size); ctx.stroke(); }
  }, (tex) => { tex.repeat.set(1.15, 0.8); tex.anisotropy = 8; });
}
