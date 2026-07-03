import * as THREE from 'three';

/** 世界区域列表 — 供小地图和场景构建使用 */
export const REGIONS = [
  {
    id: 'atrium',
    label: '中庭',
    bounds: { minX: -9, maxX: 9, minZ: -7, maxZ: 7 },
    color: 0xb8a0d0,
  },
  {
    id: 'grand_hall',
    label: '大厅',
    bounds: { minX: -13, maxX: 13, minZ: -22, maxZ: -7 },
    color: 0xc9a06a,
  },
  {
    id: 'dining_hall',
    label: '食堂',
    bounds: { minX: 10, maxX: 24, minZ: -6, maxZ: 8 },
    color: 0xd4a76a,
  },
  {
    id: 'lawn',
    label: '草坪',
    bounds: { minX: -16, maxX: 16, minZ: 7, maxZ: 22 },
    color: 0x6abe5a,
  },
  {
    id: 'lake',
    label: '湖泊',
    bounds: { minX: -26, maxX: -4, minZ: 10, maxZ: 28 },
    color: 0x4a9ec9,
  },
] as const;

export interface RegionEntry {
  id: string;
  label: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  color: number;
}

/** 当前所在区域（根据坐标判断） */
export function getRegion(x: number, z: number): RegionEntry | null {
  for (const r of REGIONS) {
    if (x >= r.bounds.minX && x <= r.bounds.maxX && z >= r.bounds.minZ && z <= r.bounds.maxZ) {
      return r;
    }
  }
  return null;
}

/** 创建木质纹理 */
export function makeWoodTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, size, 0);
  gradient.addColorStop(0, '#3a211a');
  gradient.addColorStop(0.46, '#74462d');
  gradient.addColorStop(1, '#4f2f24');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  for (let y = 8; y < size; y += 13) {
    ctx.strokeStyle = y % 2 === 0 ? 'rgba(255,213,153,0.12)' : 'rgba(16,7,5,0.18)';
    ctx.lineWidth = 1 + (y % 5);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.25, y - 8, size * 0.62, y + 9, size, y - 2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.4, 2.4);
  texture.anisotropy = 8;
  return texture;
}

/** 创建大理石纹理 */
export function makeMarbleTexture(baseColor: { light: string; mid: string; dark: string }): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, baseColor.light);
  gradient.addColorStop(0.48, baseColor.mid);
  gradient.addColorStop(1, baseColor.dark);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(255,255,255,0.32)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= size; i += 128) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(64,48,82,0.18)';
  for (let i = 0; i < 42; i++) {
    const y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.28, y + Math.random() * 80 - 40, size * 0.62, y + Math.random() * 90 - 45, size, y + Math.random() * 80 - 40);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4.4, 3.1);
  texture.anisotropy = 8;
  return texture;
}

/** 创建灰泥墙壁纹理 */
export function makePlasterTexture(baseColor: { light: string; mid: string; dark: string }): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, baseColor.light);
  gradient.addColorStop(0.52, baseColor.mid);
  gradient.addColorStop(1, baseColor.dark);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let i = 0; i < 140; i++) {
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }

  ctx.strokeStyle = 'rgba(91,76,98,0.16)';
  for (let y = 42; y < size; y += 84) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + 8);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.4, 1.2);
  texture.anisotropy = 8;
  return texture;
}

/** 创建草地纹理 */
export function makeGrassTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // 基色
  ctx.fillStyle = '#4a8b3a';
  ctx.fillRect(0, 0, size, size);

  // 随机草色斑块
  const greens = ['#5a9b4a', '#3d7a30', '#6bb55a', '#4f8b3e', '#3a6b2c'];
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = greens[Math.floor(Math.random() * greens.length)];
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 3 + Math.random() * 6;
    const h = 1 + Math.random() * 3;
    ctx.fillRect(x, y, w, h);
  }

  // 草叶
  ctx.strokeStyle = 'rgba(120,180,80,0.4)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 4, y - 3 - Math.random() * 4);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.anisotropy = 8;
  return texture;
}

/** 创建水面法线扰动纹理 */
export function makeWaterTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2a6e9e';
  ctx.fillRect(0, 0, size, size);

  // 波纹
  ctx.strokeStyle = 'rgba(140,200,255,0.25)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 8 + Math.random() * 24;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.4, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 高光点
  ctx.fillStyle = 'rgba(200,230,255,0.15)';
  for (let i = 0; i < 80; i++) {
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.anisotropy = 8;
  return texture;
}

/** 工具：添加 box mesh 到场景 */
export function addBox(
  scene: THREE.Scene,
  position: THREE.Vector3,
  scale: THREE.Vector3,
  material: THREE.Material,
  castShadow = true,
  receiveShadow = true
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(scale.x, scale.y, scale.z), material);
  mesh.position.copy(position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  scene.add(mesh);
  return mesh;
}

/** 工具：添加 box mesh 到 group */
export function addBoxToGroup(
  parent: THREE.Object3D,
  position: THREE.Vector3,
  scale: THREE.Vector3,
  material: THREE.Material
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(scale.x, scale.y, scale.z), material);
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** 工具：添加扁平 plane */
export function addFlatPlane(
  scene: THREE.Scene,
  position: THREE.Vector3,
  size: THREE.Vector2,
  material: THREE.Material
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.y), material);
  mesh.position.copy(position);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

/** 工具：添加点光源 */
export function addPointLight(
  scene: THREE.Scene,
  x: number, y: number, z: number,
  color: number, intensity: number, distance: number
): void {
  const light = new THREE.PointLight(color, intensity, distance, 2);
  light.position.set(x, y, z);
  scene.add(light);
}
