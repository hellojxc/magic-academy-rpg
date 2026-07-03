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
const groundDecalMaterials = new Map<string, THREE.MeshBasicMaterial>();
let leafTexture: THREE.CanvasTexture | null = null;

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

  for (let matIndex = 0; matIndex < spec.colors.length; matIndex += 1) {
    const count = Math.floor(spec.count / spec.colors.length);
    const mesh = new THREE.InstancedMesh(
      Geo.cone(0.025, 1, 4),
      getStandardMaterial({ color: spec.colors[matIndex], roughness: 0.9, metalness: 0 }),
      count
    );

    for (let i = 0; i < count; i += 1) {
      let x = spec.x;
      let z = spec.z;
      for (let attempts = 0; attempts < 12; attempts += 1) {
        x = spec.x + (rand() - 0.5) * spec.width;
        z = spec.z + (rand() - 0.5) * spec.depth;
        if (!avoid?.(x, z)) break;
      }

      const height = lerp(spec.heightMin, spec.heightMax, rand());
      dummy.position.set(x, height / 2 - 0.005, z);
      dummy.rotation.set((rand() - 0.5) * 0.34, rand() * Math.PI * 2, (rand() - 0.5) * 0.34);
      dummy.scale.set(0.7 + rand() * 1.2, height, 0.7 + rand() * 0.8);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
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
      varying vec2 vUv;
      varying vec3 vPos;
      void main() {
        vUv = uv;
        vPos = position;
        vec3 p = position;
        p.z += sin(position.x * 1.7 + position.y * 2.3) * 0.015;
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
        float waveA = sin(vPos.x * 1.9 + uTime * 0.95);
        float waveB = sin(vPos.y * 2.8 - uTime * 0.7);
        float ripple = waveA * 0.5 + waveB * 0.5;
        float shimmer = smoothstep(0.72, 0.96, sin((vUv.x + vUv.y) * 44.0 + uTime * 2.2));
        float depth = smoothstep(0.12, 0.86, length(vPos.xy) * 0.055 + ripple * 0.08);
        vec3 color = mix(uShallow, uDeep, depth);
        color += uFoam * shimmer * 0.16;
        gl_FragColor = vec4(color, 0.78);
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
  const centers = spec.variant === 'willow'
    ? [[0, 0.05, 0, 1.1], [0.34, -0.22, 0.2, 0.9], [-0.36, -0.2, -0.16, 0.85], [0.08, -0.5, -0.34, 0.72]]
    : [[0, 0.18, 0, 1.1], [0.42, 0.02, 0.16, 0.86], [-0.34, 0.04, -0.2, 0.82], [0.06, 0.42, -0.12, 0.76]];

  const leafGeo = Geo.plane(0.42, 0.24);
  for (const [cx, cy, cz, radius] of centers) {
    const count = Math.floor(42 * radius * spec.scale);
    for (let i = 0; i < count; i += 1) {
      const mat = getLeafMaterial(leafPalette[Math.floor(rand() * leafPalette.length)]);
      const leaf = new THREE.Mesh(leafGeo, mat);
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(lerp(-0.55, 0.9, rand()));
      const r = spec.scale * radius * Math.pow(rand(), 0.48);
      leaf.position.set(
        trunkTop.x + (cx + Math.cos(theta) * Math.sin(phi) * r) * spec.scale,
        trunkTop.y + (cy + Math.cos(phi) * r * 0.62) * spec.scale,
        trunkTop.z + (cz + Math.sin(theta) * Math.sin(phi) * r) * spec.scale
      );
      leaf.rotation.set(rand() * Math.PI, rand() * Math.PI * 2, rand() * Math.PI);
      const leafScale = spec.scale * lerp(0.62, 1.35, rand());
      leaf.scale.set(leafScale, leafScale * lerp(0.8, 1.5, rand()), 1);
      leaf.castShadow = true;
      group.add(leaf);
    }
  }
}

function addBarkRidges(group: THREE.Group, scale: number, height: number, mat: THREE.Material, rand: () => number): void {
  for (let i = 0; i < 13; i += 1) {
    const angle = (i / 13) * Math.PI * 2;
    const ridgeHeight = height * lerp(0.34, 0.7, rand());
    const ridge = new THREE.Mesh(Geo.box(0.018 * scale, ridgeHeight, 0.022 * scale), mat);
    ridge.position.set(Math.cos(angle) * 0.22 * scale, height * lerp(0.28, 0.48, rand()), Math.sin(angle) * 0.22 * scale);
    ridge.rotation.y = -angle;
    ridge.castShadow = true;
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

function getLeafMaterial(color: number): THREE.MeshStandardMaterial {
  if (leafMaterials.has(color)) return leafMaterials.get(color)!;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: getLeafTexture(),
    roughness: 0.72,
    metalness: 0,
    transparent: true,
    alphaTest: 0.24,
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
