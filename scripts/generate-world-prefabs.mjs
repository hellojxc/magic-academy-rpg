import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class NodeFileReader {
    result = null;
    onloadend = null;

    async readAsArrayBuffer(blob) {
      this.result = await blob.arrayBuffer();
      this.onloadend?.();
    }

    async readAsDataURL(blob) {
      const buffer = Buffer.from(await blob.arrayBuffer());
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${buffer.toString('base64')}`;
      this.onloadend?.();
    }
  };
}

const outDir = path.resolve('public/assets/world');
const outFile = path.join(outDir, 'academy-prefabs.glb');

const root = new THREE.Group();
root.name = 'academy_prefab_pack';

const materials = {
  stone: mat(0x887c73, 0.72, 0.02),
  stoneDark: mat(0x5f5651, 0.78, 0.02),
  plaster: mat(0xb8aa9b, 0.68, 0.01),
  plasterWarm: mat(0xc4b49f, 0.64, 0.01),
  gold: mat(0xc7a060, 0.32, 0.46),
  darkWood: mat(0x3b2418, 0.62, 0.04),
  wood: mat(0x6a3e27, 0.58, 0.04),
  page: mat(0xe8d8b3, 0.72, 0.01),
  glass: mat(0x9fdcff, 0.2, 0.02, { transparent: true, opacity: 0.55, emissive: 0x4f8cc2, emissiveIntensity: 0.18 }),
  leaf: mat(0x4f8d3d, 0.82, 0.0, { side: THREE.DoubleSide }),
  leafDark: mat(0x2f6a2a, 0.86, 0.0, { side: THREE.DoubleSide }),
  leafWarm: mat(0x82a64b, 0.8, 0.0, { side: THREE.DoubleSide }),
  bark: mat(0x5a3e28, 0.78, 0.03),
  waterPlant: mat(0x6f8a3a, 0.82, 0.0),
  sand: mat(0xc4a86a, 0.78, 0.0),
  cloth: mat(0xe8dcc0, 0.78, 0.01),
  fire: mat(0xff7b2a, 0.28, 0, { emissive: 0xff4010, emissiveIntensity: 1.6 }),
};

addPrefab('wall_segment', makeWallSegment());
addPrefab('floor_inlay_tile', makeFloorInlayTile());
addPrefab('ornate_column', makeOrnateColumn(2.8));
addPrefab('grand_column', makeOrnateColumn(4.8));
addPrefab('arched_window', makeArchedWindow());
addPrefab('library_bookshelf', makeBookshelf());
addPrefab('reading_table_set', makeReadingTableSet());
addPrefab('book_stack', makeBookStack());
addPrefab('scroll_bundle', makeScrollBundle());
addPrefab('dining_table_set', makeDiningTableSet());
addPrefab('food_counter', makeFoodCounter());
addPrefab('fireplace', makeFireplace());
addPrefab('chandelier', makeChandelier());
addPrefab('fountain_prefab', makeFountain());
addPrefab('oak_tree', makeTree('oak'));
addPrefab('willow_tree', makeTree('willow'));
addPrefab('grass_clump', makeGrassClump());
addPrefab('shrub_patch', makeShrubPatch());
addPrefab('dock_segment', makeDockSegment());
addPrefab('shore_rock_cluster', makeRockCluster());
addPrefab('reed_cluster', makeReedCluster());
addPrefab('lily_cluster', makeLilyCluster());
addPrefab('magic_lantern', makeMagicLantern());
addPrefab('market_stall', makeMarketStall());

await fs.mkdir(outDir, { recursive: true });
const exporter = new GLTFExporter();
const result = await exporter.parseAsync(root, { binary: true });
await fs.writeFile(outFile, Buffer.from(result));
console.log(`[world-prefabs] wrote ${outFile}`);

function mat(color, roughness, metalness, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

function addPrefab(name, object) {
  object.name = name;
  root.add(object);
}

function box(name, size, position, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(name, radii, height, position, material, segments = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radii[0], radii[1], height, segments), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeWallSegment() {
  const g = new THREE.Group();
  g.add(box('plaster_body', [2.8, 3.2, 0.18], [0, 1.6, 0], materials.plaster));
  g.add(box('lower_wainscot', [2.86, 0.7, 0.22], [0, 0.48, 0.03], materials.stoneDark));
  g.add(box('top_trim', [2.9, 0.12, 0.28], [0, 3.12, 0.06], materials.gold));
  g.add(box('middle_trim', [2.7, 0.06, 0.24], [0, 1.06, 0.07], materials.gold));
  for (let y = 1.55; y < 2.8; y += 0.42) g.add(box('stone_seam_h', [2.55, 0.018, 0.03], [0, y, 0.11], materials.stoneDark));
  for (let x = -1.0; x <= 1.0; x += 1.0) g.add(box('stone_seam_v', [0.018, 1.2, 0.03], [x, 2.1, 0.12], materials.stoneDark));
  return g;
}

function makeFloorInlayTile() {
  const g = new THREE.Group();
  g.add(box('marble_slab', [1.2, 0.04, 1.2], [0, 0.02, 0], materials.stone));
  g.add(box('gold_inlay_a', [1.05, 0.012, 0.035], [0, 0.048, 0], materials.gold));
  g.add(box('gold_inlay_b', [0.035, 0.012, 1.05], [0, 0.05, 0], materials.gold));
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), materials.glass);
  gem.name = 'center_gem';
  gem.position.set(0, 0.12, 0);
  g.add(gem);
  return g;
}

function makeOrnateColumn(height) {
  const g = new THREE.Group();
  g.add(cyl('base', [0.46, 0.56], 0.22, [0, 0.11, 0], materials.stone, 28));
  g.add(cyl('shaft', [0.24, 0.29], height - 0.45, [0, height / 2, 0], materials.stone, 28));
  g.add(cyl('capital', [0.52, 0.42], 0.24, [0, height - 0.12, 0], materials.stone, 28));
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    const ridge = box('flute', [0.024, height - 0.85, 0.032], [Math.cos(a) * 0.28, height / 2, Math.sin(a) * 0.28], materials.stoneDark);
    ridge.rotation.y = -a;
    g.add(ridge);
  }
  for (const y of [0.36, height - 0.34]) g.add(cyl('gold_ring', [0.34, 0.36], 0.08, [0, y, 0], materials.gold, 28));
  return g;
}

function makeArchedWindow() {
  const g = new THREE.Group();
  g.add(box('glass', [1.1, 1.8, 0.035], [0, 1.45, 0], materials.glass));
  g.add(box('sill', [1.34, 0.12, 0.18], [0, 0.48, 0.05], materials.stone));
  g.add(box('left_frame', [0.08, 1.8, 0.12], [-0.6, 1.45, 0.07], materials.gold));
  g.add(box('right_frame', [0.08, 1.8, 0.12], [0.6, 1.45, 0.07], materials.gold));
  g.add(box('cross_h', [1.12, 0.06, 0.11], [0, 1.45, 0.08], materials.gold));
  g.add(box('cross_v', [0.06, 1.74, 0.11], [0, 1.45, 0.08], materials.gold));
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.61, 0.045, 10, 28, Math.PI), materials.gold);
  arch.name = 'arch_frame';
  arch.position.set(0, 2.34, 0.08);
  arch.rotation.z = Math.PI;
  g.add(arch);
  return g;
}

function makeBookshelf() {
  const g = new THREE.Group();
  g.add(box('back', [1.22, 2.82, 0.08], [0, 1.41, -0.27], materials.darkWood));
  g.add(box('left_side', [0.12, 2.95, 0.58], [-0.66, 1.47, 0], materials.wood));
  g.add(box('right_side', [0.12, 2.95, 0.58], [0.66, 1.47, 0], materials.wood));
  for (const y of [0.18, 0.72, 1.22, 1.72, 2.22, 2.78]) g.add(box('shelf', [1.42, 0.07, 0.62], [0, y, 0], materials.wood));
  const colors = [0x7651b9, 0xb9505c, 0xd2ad5f, 0x4f94a7, 0x6f9348, 0xdfd0ae];
  for (let row = 0; row < 5; row += 1) {
    let x = -0.52;
    for (let i = 0; i < 10; i += 1) {
      const w = 0.055 + ((row + i) % 4) * 0.012;
      const h = 0.28 + ((row * 2 + i) % 4) * 0.04;
      const book = box('book', [w, h, 0.16], [x + w / 2, 0.23 + row * 0.5 + h / 2, 0.22], mat(colors[(row + i) % colors.length], 0.58, 0.02));
      book.rotation.z = (((row + i) % 5) - 2) * 0.02;
      g.add(book);
      x += w + 0.035;
    }
  }
  return g;
}

function makeReadingTableSet() {
  const g = new THREE.Group();
  g.add(box('table_top', [2.4, 0.12, 1.1], [0, 0.74, 0], materials.wood));
  g.add(box('cloth_runner', [2.0, 0.035, 0.34], [0, 0.83, 0], materials.cloth));
  for (const x of [-0.95, 0.95]) for (const z of [-0.42, 0.42]) g.add(box('leg', [0.12, 0.7, 0.12], [x, 0.36, z], materials.darkWood));
  g.add(makeBookStack());
  g.children[g.children.length - 1].position.set(-0.42, 0.9, 0.15);
  g.add(makeScrollBundle());
  g.children[g.children.length - 1].position.set(0.48, 0.92, -0.16);
  return g;
}

function makeBookStack() {
  const g = new THREE.Group();
  const colors = [0x7d4fd6, 0xd16d85, 0xf0c56c, 0x4c9fb8];
  for (let i = 0; i < 4; i += 1) {
    const book = box('stack_book', [0.44 - i * 0.03, 0.07, 0.32 - i * 0.02], [i * 0.012, i * 0.075, 0], mat(colors[i], 0.55, 0.02));
    book.rotation.y = (i - 1.5) * 0.12;
    g.add(book);
  }
  return g;
}

function makeScrollBundle() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const scroll = cyl('scroll', [0.035, 0.035], 0.42, [(i - 1) * 0.09, 0, (i % 2) * 0.06], materials.page, 12);
    scroll.rotation.z = Math.PI / 2;
    g.add(scroll);
    g.add(box('tie', [0.025, 0.018, 0.095], [scroll.position.x, 0, scroll.position.z], materials.wood));
  }
  return g;
}

function makeDiningTableSet() {
  const g = new THREE.Group();
  g.add(box('long_table', [3.6, 0.12, 0.82], [0, 0.72, 0], materials.wood));
  g.add(box('runner', [3.35, 0.035, 0.46], [0, 0.82, 0], materials.cloth));
  for (const x of [-1.55, 1.55]) for (const z of [-0.3, 0.3]) g.add(box('leg', [0.12, 0.68, 0.12], [x, 0.34, z], materials.darkWood));
  for (const z of [-0.72, 0.72]) g.add(box('bench', [3.2, 0.08, 0.28], [0, 0.43, z], materials.darkWood));
  for (let i = 0; i < 5; i += 1) for (const z of [-0.25, 0.25]) g.add(cyl('plate', [0.12, 0.13], 0.025, [-1.35 + i * 0.68, 0.86, z], materials.page, 18));
  return g;
}

function makeFoodCounter() {
  const g = new THREE.Group();
  g.add(box('counter', [2.4, 0.9, 0.58], [0, 0.45, 0], materials.wood));
  g.add(box('counter_trim', [2.5, 0.045, 0.68], [0, 0.92, 0], materials.gold));
  for (const x of [-0.7, 0, 0.7]) {
    g.add(cyl('bowl', [0.14, 0.2], 0.1, [x, 1.0, 0], mat(0xd4a76a, 0.4, 0.02), 16));
    for (let i = 0; i < 5; i += 1) {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat([0xd85f5f, 0xf1c45f, 0x6b9e4a][i % 3], 0.5, 0));
      fruit.name = 'fruit';
      fruit.position.set(x + (i - 2) * 0.045, 1.08, (i % 2) * 0.055);
      g.add(fruit);
    }
  }
  return g;
}

function makeFireplace() {
  const g = new THREE.Group();
  g.add(box('left_jamb', [0.26, 1.9, 1.2], [-0.5, 0.95, 0], materials.stoneDark));
  g.add(box('right_jamb', [0.26, 1.9, 1.2], [0.5, 0.95, 0], materials.stoneDark));
  g.add(box('mantel', [1.45, 0.24, 1.28], [0, 1.9, 0], materials.stoneDark));
  g.add(box('hearth', [1.2, 0.18, 0.82], [0, 0.18, 0], materials.stone));
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 8), materials.fire);
  flame.name = 'flame';
  flame.position.set(0, 0.62, 0);
  g.add(flame);
  return g;
}

function makeChandelier() {
  const g = new THREE.Group();
  g.add(cyl('chain', [0.025, 0.025], 1.0, [0, 0.5, 0], materials.gold, 8));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.025, 8, 28), materials.gold);
  ring.name = 'ring';
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    g.add(cyl('candle', [0.035, 0.035], 0.16, [Math.cos(a) * 0.36, -0.02, Math.sin(a) * 0.36], materials.page, 8));
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), materials.fire);
    flame.name = 'candle_flame';
    flame.position.set(Math.cos(a) * 0.36, 0.1, Math.sin(a) * 0.36);
    g.add(flame);
  }
  return g;
}

function makeFountain() {
  const g = new THREE.Group();
  g.add(cyl('basin', [1.2, 1.42], 0.38, [0, 0.2, 0], materials.stone, 36));
  g.add(cyl('water', [1.04, 1.04], 0.035, [0, 0.42, 0], materials.glass, 36));
  g.add(cyl('pillar', [0.16, 0.22], 0.62, [0, 0.72, 0], materials.stone, 16));
  g.add(cyl('top_bowl', [0.46, 0.28], 0.14, [0, 1.1, 0], materials.gold, 24));
  return g;
}

function makeTree(kind) {
  const g = new THREE.Group();
  g.add(cyl('trunk', [0.16, 0.24], kind === 'willow' ? 2.0 : 2.25, [0, kind === 'willow' ? 1.0 : 1.12, 0], materials.bark, 12));
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2;
    const branch = cyl('branch', [0.04, 0.08], 0.85, [Math.cos(a) * 0.32, 1.7 + (i % 3) * 0.18, Math.sin(a) * 0.32], materials.bark, 8);
    branch.rotation.z = Math.PI / 2.8;
    branch.rotation.y = -a;
    g.add(branch);
  }
  const leafMats = kind === 'willow' ? [materials.leafDark, materials.leaf, materials.leafWarm] : [materials.leafDark, materials.leaf, materials.leafWarm];
  for (let i = 0; i < (kind === 'willow' ? 68 : 88); i += 1) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.34, kind === 'willow' ? 0.44 : 0.22), leafMats[i % leafMats.length]);
    leaf.name = 'leaf_card';
    const a = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.5) * (kind === 'willow' ? 1.05 : 1.25);
    leaf.position.set(Math.cos(a) * r, 2.05 + Math.random() * (kind === 'willow' ? 0.9 : 1.0), Math.sin(a) * r);
    leaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI * 2, Math.random() * Math.PI);
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}

function makeGrassClump() {
  const g = new THREE.Group();
  for (let i = 0; i < 18; i += 1) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.35 + Math.random() * 0.25, 4), materials.waterPlant);
    blade.name = 'grass_blade';
    blade.position.set((Math.random() - 0.5) * 0.45, 0.16, (Math.random() - 0.5) * 0.45);
    blade.rotation.set((Math.random() - 0.5) * 0.35, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.35);
    g.add(blade);
  }
  return g;
}

function makeShrubPatch() {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i += 1) {
    const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22 + Math.random() * 0.16, 0), i % 2 ? materials.leaf : materials.leafDark);
    shrub.name = 'shrub';
    shrub.position.set((Math.random() - 0.5) * 1.0, 0.2, (Math.random() - 0.5) * 0.6);
    shrub.scale.y = 0.7;
    shrub.castShadow = true;
    g.add(shrub);
  }
  return g;
}

function makeDockSegment() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const plank = box('plank', [0.82, 0.08, 0.72], [(i - 1) * 0.82, 0.12 + (i % 2) * 0.012, 0], materials.wood);
    plank.rotation.y = (i - 1) * 0.025;
    g.add(plank);
  }
  for (const x of [-1.1, 1.1]) for (const z of [-0.4, 0.4]) g.add(box('post', [0.12, 0.55, 0.12], [x, -0.12, z], materials.darkWood));
  return g;
}

function makeRockCluster() {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i += 1) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12 + Math.random() * 0.14, 0), i % 2 ? materials.stone : materials.stoneDark);
    rock.name = 'rock';
    rock.position.set((Math.random() - 0.5) * 1.1, 0.08, (Math.random() - 0.5) * 0.7);
    rock.scale.y = 0.45 + Math.random() * 0.35;
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    g.add(rock);
  }
  return g;
}

function makeReedCluster() {
  const g = new THREE.Group();
  for (let i = 0; i < 12; i += 1) {
    const reed = cyl('reed', [0.012, 0.018], 0.75 + Math.random() * 0.45, [(Math.random() - 0.5) * 0.5, 0.38, (Math.random() - 0.5) * 0.5], materials.waterPlant, 5);
    reed.rotation.set((Math.random() - 0.5) * 0.22, 0, (Math.random() - 0.5) * 0.22);
    g.add(reed);
  }
  return g;
}

function makeLilyCluster() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i += 1) {
    const lily = new THREE.Mesh(new THREE.CircleGeometry(0.16 + Math.random() * 0.08, 12), materials.leafDark);
    lily.name = 'lily';
    lily.rotation.x = -Math.PI / 2;
    lily.position.set((Math.random() - 0.5) * 1.3, 0.02, (Math.random() - 0.5) * 0.7);
    g.add(lily);
  }
  return g;
}

function makeMagicLantern() {
  const g = new THREE.Group();
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 1), mat(0xffd674, 0.25, 0.1, { emissive: 0xffb847, emissiveIntensity: 1.5 }));
  crystal.name = 'lantern_crystal';
  crystal.position.y = 0.25;
  g.add(crystal);
  g.add(cyl('chain', [0.018, 0.018], 0.5, [0, 0.55, 0], materials.gold, 6));
  return g;
}

function makeMarketStall() {
  const g = new THREE.Group();
  g.add(box('stall_table', [1.6, 0.12, 0.82], [0, 0.65, 0], materials.wood));
  for (const x of [-0.72, 0.72]) for (const z of [-0.32, 0.32]) g.add(box('stall_leg', [0.08, 0.65, 0.08], [x, 0.32, z], materials.darkWood));
  g.add(box('awning', [1.9, 0.08, 1.02], [0, 1.55, 0], mat(0x8e3f56, 0.68, 0.02)));
  for (const x of [-0.8, 0.8]) g.add(box('awning_post', [0.05, 1.0, 0.05], [x, 1.05, -0.38], materials.darkWood));
  return g;
}
