import * as THREE from 'three';
import { Geo, MatLib, getStandardMaterial } from './RenderResources';

export interface TreeSpec {
  x: number;
  z: number;
  scale: number;
  seed: number;
  variant: 'oak' | 'willow' | 'maple';
  rotation?: number;
  baseY?: number;
}

export interface GroundDecalSpec {
  x: number;
  z: number;
  radiusX: number;
  radiusZ: number;
  color: number;
  opacity: number;
  seed: number;
  y?: number;
}

export interface FoliageFieldSpec {
  x: number;
  z: number;
  width: number;
  depth: number;
  count: number;
  seed: number;
  heightMin: number;
  heightMax: number;
  colors: [number, number, number];
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const leafMaterials = new Map<number, THREE.MeshStandardMaterial>();
const grassMaterials = new Map<number, THREE.MeshStandardMaterial>();
const groundDecalMaterials = new Map<string, THREE.MeshBasicMaterial>();
let leafTexture: THREE.CanvasTexture | null = null;
let grassBladeTexture: THREE.CanvasTexture | null = null;
let treeCanopyShadowMaterial: THREE.MeshBasicMaterial | null = null;

type CanopyCenter = readonly [number, number, number, number];

export function addNaturalTree(scene: THREE.Scene, spec: TreeSpec): THREE.Group {
  const rand = seededRandom(spec.seed);
  const group = new THREE.Group();
  group.position.set(spec.x, spec.baseY ?? 0, spec.z);
  group.rotation.y = spec.rotation ?? rand() * Math.PI * 2;

  const barkMat = MatLib.bark;
  const darkBarkMat = getStandardMaterial({ color: 0x382717, roughness: 0.82, metalness: 0.02 });
  const height = spec.scale * (2.25 + rand() * 0.45);
  const bend = new THREE.Vector2((rand() - 0.5) * 0.34, (rand() - 0.5) * 0.34);
  let previous = new THREE.Vector3(0, 0.08, 0);

  for (let i = 1; i <= 5; i += 1) {
    const t = i / 5;
    const next = new THREE.Vector3(
      bend.x * t * t * spec.scale,
      height * t,
      bend.y * t * t * spec.scale
    );
    addCylinderBetween(group, previous, next, (0.2 - t * 0.055) * spec.scale, (0.24 - t * 0.055) * spec.scale, barkMat, 12);
    previous = next;
  }

  addBarkRidges(group, spec.scale, height, darkBarkMat, rand);
  addBranches(group, previous, spec, barkMat, rand);
  addLeafCanopy(group, previous, spec, rand);

  scene.add(group);
  return group;
}

export function addGroundDecals(scene: THREE.Scene, decals: GroundDecalSpec[]): void {
  for (const decal of decals) {
    const mat = getGroundDecalMaterial(decal.color, decal.opacity);
    const mesh = new THREE.Mesh(Geo.circle(1, 18), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = seededRandom(decal.seed)() * Math.PI * 2;
    mesh.scale.set(decal.radiusX, decal.radiusZ, 1);
    mesh.position.set(decal.x, decal.y ?? 0.004, decal.z);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}

export function addFoliageField(
  scene: THREE.Scene,
  spec: FoliageFieldSpec,
  avoid?: (x: number, z: number) => boolean
): void {
  const rand = seededRandom(spec.seed);
  const dummy = new THREE.Object3D();
  const bladeGeo = Geo.plane(0.16, 1);

  for (let matIndex = 0; matIndex < spec.colors.length; matIndex += 1) {
    const count = Math.floor(spec.count / spec.colors.length);
    const placements: Array<{ x: number; z: number; height: number; width: number; rotation: number; leanX: number; leanZ: number }> = [];

    for (let i = 0; i < count; i += 1) {
      let x = spec.x;
      let z = spec.z;
      let accepted = false;
      for (let attempts = 0; attempts < 24; attempts += 1) {
        x = spec.x + (rand() - 0.5) * spec.width;
        z = spec.z + (rand() - 0.5) * spec.depth;
        if (!avoid?.(x, z)) {
          accepted = true;
          break;
        }
      }
      if (!accepted) continue;

      const height = lerp(spec.heightMin, spec.heightMax, rand());
      placements.push({
        x,
        z,
        height,
        width: lerp(0.55, 1.2, rand()),
        rotation: rand() * Math.PI * 2,
        leanX: (rand() - 0.5) * 0.32,
        leanZ: (rand() - 0.5) * 0.32,
      });
    }

    if (placements.length === 0) continue;

    const material = getGrassBladeMaterial(spec.colors[matIndex]);
    const primary = new THREE.InstancedMesh(bladeGeo, material, placements.length);
    const cross = new THREE.InstancedMesh(bladeGeo, material, placements.length);

    for (let i = 0; i < placements.length; i += 1) {
      const placement = placements[i];
      dummy.position.set(placement.x, placement.height * 0.48, placement.z);
      dummy.rotation.set(placement.leanX, placement.rotation, placement.leanZ);
      dummy.scale.set(placement.width, placement.height, 1);
      dummy.updateMatrix();
      primary.setMatrixAt(i, dummy.matrix);

      dummy.rotation.set(placement.leanX * 0.6, placement.rotation + Math.PI / 2, placement.leanZ * 0.6);
      dummy.scale.set(placement.width * 0.72, placement.height * 0.92, 1);
      dummy.updateMatrix();
      cross.setMatrixAt(i, dummy.matrix);
    }

    primary.instanceMatrix.needsUpdate = true;
    cross.instanceMatrix.needsUpdate = true;
    primary.castShadow = true;
    primary.receiveShadow = true;
    cross.castShadow = true;
    cross.receiveShadow = true;
    scene.add(primary, cross);
  }
}

export function createLakeWaterMaterial(deep = 0x1f587f, shallow = 0x62b4c7, foam = 0xd2f3ff): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(deep) },
      uShallow: { value: new THREE.Color(shallow) },
      uFoam: { value: new THREE.Color(foam) },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vPos;
      void main() {
        vUv = uv;
        vPos = position;
        vec3 p = position;
        float waveA = sin(position.x * 1.25 + position.y * 1.9 + uTime * 0.82) * 0.018;
        float waveB = sin(position.x * 3.2 - position.y * 2.4 - uTime * 0.55) * 0.009;
        p.z += waveA + waveB;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uFoam;
      varying vec2 vUv;
      varying vec3 vPos;

      void main() {
        vec2 lakeUv = vec2(vPos.x / 12.0, vPos.y / 8.6);
        float radial = clamp(length(lakeUv), 0.0, 1.35);
        float waveA = sin(vPos.x * 1.65 + vPos.y * 0.72 + uTime * 0.92);
        float waveB = sin(vPos.x * -0.88 + vPos.y * 2.35 - uTime * 0.66);
        float waveC = sin((vPos.x + vPos.y) * 5.4 + uTime * 1.55);
        float ripple = waveA * 0.42 + waveB * 0.34 + waveC * 0.12;

        float depth = smoothstep(0.08, 0.92, radial + ripple * 0.035);
        vec3 color = mix(uShallow, uDeep, depth);

        float shore = smoothstep(0.72, 1.02, radial);
        float foamNoise = sin(vPos.x * 8.5 + uTime * 1.7) * sin(vPos.y * 7.2 - uTime * 1.2);
        float foamMask = shore * smoothstep(0.2, 0.86, foamNoise * 0.5 + 0.5);
        color = mix(color, uFoam, foamMask * 0.28);

        float highlightLine = sin((vUv.x * 0.9 + vUv.y * 1.8) * 60.0 + uTime * 2.4);
        float sparkle = pow(smoothstep(0.68, 0.98, highlightLine), 8.0) * (1.0 - radial * 0.42);
        color += uFoam * sparkle * 0.34;

        vec3 shallowTint = vec3(0.72, 0.95, 0.88);
        color = mix(color, color * shallowTint, shore * 0.18);
        float alpha = mix(0.78, 0.92, depth) + foamMask * 0.06;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function updateLakeWaterMaterial(material: THREE.ShaderMaterial, elapsedTime: number): void {
  material.uniforms.uTime.value = elapsedTime;
}

function addBranches(
  group: THREE.Group,
  trunkTop: THREE.Vector3,
  spec: TreeSpec,
  barkMat: THREE.Material,
  rand: () => number
): void {
  const branchCount = spec.variant === 'willow' ? 7 : 9;
  for (let i = 0; i < branchCount; i += 1) {
    const angle = (i / branchCount) * Math.PI * 2 + rand() * 0.5;
    const startY = spec.scale * lerp(1.1, 2.05, rand());
    const start = new THREE.Vector3(trunkTop.x * 0.45, startY, trunkTop.z * 0.45);
    const len = spec.scale * lerp(0.55, spec.variant === 'willow' ? 1.2 : 0.95, rand());
    const lift = spec.scale * lerp(0.18, 0.58, rand()) * (spec.variant === 'willow' ? 0.55 : 1);
    const end = new THREE.Vector3(start.x + Math.cos(angle) * len, start.y + lift, start.z + Math.sin(angle) * len);
    addCylinderBetween(group, start, end, 0.035 * spec.scale, 0.075 * spec.scale, barkMat, 8);
  }
}

function addLeafCanopy(group: THREE.Group, trunkTop: THREE.Vector3, spec: TreeSpec, rand: () => number): void {
  const leafPalette = spec.variant === 'maple'
    ? [0x547f31, 0x789b3e, 0xb48a39]
    : spec.variant === 'willow'
      ? [0x4d8c3f, 0x6ea957, 0x8ab76a]
      : [0x3e7b32, 0x5a9b45, 0x77a952];
  const centers: CanopyCenter[] = spec.variant === 'willow'
    ? [[0, 0.05, 0, 1.1], [0.34, -0.22, 0.2, 0.9], [-0.36, -0.2, -0.16, 0.85], [0.08, -0.5, -0.34, 0.72]]
    : [[0, 0.18, 0, 1.1], [0.42, 0.02, 0.16, 0.86], [-0.34, 0.04, -0.2, 0.82], [0.06, 0.42, -0.12, 0.76]];

  addCanopyShadowProxies(group, trunkTop, spec, centers);

  const leafGeo = Geo.plane(0.42, 0.24);
  const dummy = new THREE.Object3D();
  const leafMatrices = new Map<number, THREE.Matrix4[]>();

  for (const [cx, cy, cz, radius] of centers) {
    const count = Math.floor(42 * radius * spec.scale);
    for (let i = 0; i < count; i += 1) {
      const color = leafPalette[Math.floor(rand() * leafPalette.length)];
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(lerp(-0.55, 0.9, rand()));
      const r = spec.scale * radius * Math.pow(rand(), 0.48);
      dummy.position.set(
        trunkTop.x + (cx + Math.cos(theta) * Math.sin(phi) * r) * spec.scale,
        trunkTop.y + (cy + Math.cos(phi) * r * 0.62) * spec.scale,
        trunkTop.z + (cz + Math.sin(theta) * Math.sin(phi) * r) * spec.scale
      );
      dummy.rotation.set(rand() * Math.PI, rand() * Math.PI * 2, rand() * Math.PI);
      const leafScale = spec.scale * lerp(0.62, 1.35, rand());
      dummy.scale.set(leafScale, leafScale * lerp(0.8, 1.5, rand()), 1);
      dummy.updateMatrix();
      const matrices = leafMatrices.get(color);
      if (matrices) {
        matrices.push(dummy.matrix.clone());
      } else {
        leafMatrices.set(color, [dummy.matrix.clone()]);
      }
    }
  }

  for (const [color, matrices] of leafMatrices) {
    const leaves = new THREE.InstancedMesh(leafGeo, getLeafMaterial(color), matrices.length);
    leaves.name = `natural-tree-leaves:${color.toString(16)}`;
    leaves.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    matrices.forEach((matrix, index) => leaves.setMatrixAt(index, matrix));
    leaves.instanceMatrix.needsUpdate = true;
    leaves.castShadow = false;
    leaves.receiveShadow = false;
    leaves.computeBoundingSphere();
    group.add(leaves);
  }
}

function addCanopyShadowProxies(
  group: THREE.Group,
  trunkTop: THREE.Vector3,
  spec: TreeSpec,
  centers: readonly CanopyCenter[]
): void {
  const material = getTreeCanopyShadowMaterial();
  const geometry = Geo.sphere(1, 8, 6);

  for (const [cx, cy, cz, radius] of centers) {
    const proxy = new THREE.Mesh(geometry, material);
    const canopyRadius = radius * spec.scale * spec.scale;
    proxy.position.set(
      trunkTop.x + cx * spec.scale,
      trunkTop.y + cy * spec.scale,
      trunkTop.z + cz * spec.scale
    );
    proxy.scale.set(canopyRadius * 1.08, canopyRadius * 0.66, canopyRadius * 1.08);
    proxy.castShadow = true;
    proxy.receiveShadow = false;
    proxy.userData.shadowProxy = true;
    group.add(proxy);
  }
}

function addBarkRidges(group: THREE.Group, scale: number, height: number, mat: THREE.Material, rand: () => number): void {
  for (let i = 0; i < 13; i += 1) {
    const angle = (i / 13) * Math.PI * 2;
    const ridgeHeight = height * lerp(0.34, 0.7, rand());
    const ridge = new THREE.Mesh(Geo.box(0.018 * scale, ridgeHeight, 0.022 * scale), mat);
    ridge.position.set(Math.cos(angle) * 0.22 * scale, height * lerp(0.28, 0.48, rand()), Math.sin(angle) * 0.22 * scale);
    ridge.rotation.y = -angle;
    ridge.castShadow = false;
    group.add(ridge);
  }
}

function addCylinderBetween(
  parent: THREE.Object3D,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radiusTop: number,
  radiusBottom: number,
  material: THREE.Material,
  segments: number
): THREE.Mesh {
  const direction = end.clone().sub(start);
  const length = Math.max(0.001, direction.length());
  const mesh = new THREE.Mesh(Geo.cylinder(radiusTop, radiusBottom, length, segments), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, direction.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function getTreeCanopyShadowMaterial(): THREE.MeshBasicMaterial {
  if (treeCanopyShadowMaterial) return treeCanopyShadowMaterial;
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  mat.colorWrite = false;
  mat.depthWrite = false;
  mat.depthTest = false;
  treeCanopyShadowMaterial = mat;
  return treeCanopyShadowMaterial;
}

function getLeafMaterial(color: number): THREE.MeshStandardMaterial {
  if (leafMaterials.has(color)) return leafMaterials.get(color)!;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: getLeafTexture(),
    roughness: 0.72,
    metalness: 0,
    alphaTest: 0.24,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  mat.color.setHex(color);
  leafMaterials.set(color, mat);
  return mat;
}

function getLeafTexture(): THREE.CanvasTexture {
  if (leafTexture) return leafTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 96);
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.beginPath();
  ctx.moveTo(32, 4);
  ctx.bezierCurveTo(62, 26, 54, 72, 32, 92);
  ctx.bezierCurveTo(10, 72, 2, 26, 32, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(210,240,210,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(32, 12);
  ctx.lineTo(32, 88);
  ctx.stroke();
  leafTexture = new THREE.CanvasTexture(canvas);
  leafTexture.colorSpace = THREE.SRGBColorSpace;
  return leafTexture;
}

function getGrassBladeMaterial(color: number): THREE.MeshStandardMaterial {
  if (grassMaterials.has(color)) return grassMaterials.get(color)!;
  const mat = new THREE.MeshStandardMaterial({
    color,
    map: getGrassBladeTexture(),
    roughness: 0.88,
    metalness: 0,
    alphaTest: 0.18,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  grassMaterials.set(color, mat);
  return mat;
}

function getGrassBladeTexture(): THREE.CanvasTexture {
  if (grassBladeTexture) return grassBladeTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, 'rgba(255,255,255,0.08)');
  grad.addColorStop(0.28, 'rgba(255,255,255,0.82)');
  grad.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(24, 4);
  ctx.bezierCurveTo(38, 34, 34, 92, 27, 126);
  ctx.lineTo(18, 126);
  ctx.bezierCurveTo(13, 86, 12, 38, 24, 4);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.38)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(24, 16);
  ctx.bezierCurveTo(27, 46, 25, 86, 23, 122);
  ctx.stroke();

  grassBladeTexture = new THREE.CanvasTexture(canvas);
  grassBladeTexture.colorSpace = THREE.SRGBColorSpace;
  return grassBladeTexture;
}

function getGroundDecalMaterial(color: number, opacity: number): THREE.MeshBasicMaterial {
  const key = `${color}:${opacity.toFixed(2)}`;
  if (groundDecalMaterials.has(key)) return groundDecalMaterials.get(key)!;
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -2;
  groundDecalMaterials.set(key, mat);
  return mat;
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
