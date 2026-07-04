import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

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

const outDir = path.resolve('public/assets/world/chunks');
const lightmapDir = path.resolve('public/assets/world/lightmaps');
const exporter = new GLTFExporter();

const chunks = [
  { id: 'atrium', region: 'interior', bounds: { minX: -11, maxX: 11, minZ: -8, maxZ: 8 }, floor: 0x756a82, wall: 0x9688a1, accent: 0xd9b267, emissive: 0x8ac7ff },
  { id: 'arcane-library', region: 'interior', bounds: { minX: 2, maxX: 10, minZ: -7, maxZ: 2 }, floor: 0x514356, wall: 0x75607d, accent: 0xb9824f, emissive: 0xc78aff },
  { id: 'grand-hall', region: 'interior', bounds: { minX: -12.5, maxX: 12.5, minZ: -23, maxZ: -8 }, floor: 0x686077, wall: 0x9484a2, accent: 0xe0bd75, emissive: 0x8feaff },
  { id: 'dining-hall', region: 'interior', bounds: { minX: 11, maxX: 24, minZ: -7, maxZ: 7 }, floor: 0x654b3d, wall: 0x8d735f, accent: 0xd89d5e, emissive: 0xffb066 },
  { id: 'moonlit-lawn', region: 'exterior', bounds: { minX: -16, maxX: 16, minZ: 7, maxZ: 26 }, floor: 0x41634a, wall: 0x526b5c, accent: 0xa5d07f, emissive: 0xa0c7ff },
  { id: 'lake-grotto', region: 'cavern', bounds: { minX: -25, maxX: -5, minZ: 10, maxZ: 30 }, floor: 0x334d63, wall: 0x4f6679, accent: 0x7ac7d8, emissive: 0x76f0ff },
  { id: 'training-yard', region: 'combat', bounds: { minX: 9, maxX: 25, minZ: 26, maxZ: 40 }, floor: 0x6b6255, wall: 0x817568, accent: 0xbe8c55, emissive: 0xffd57b },
  { id: 'crystal-greenhouse', region: 'exterior', bounds: { minX: -42, maxX: -21, minZ: -2, maxZ: 13 }, floor: 0x49625c, wall: 0x88a7a1, accent: 0x75c7b7, emissive: 0x9dffd9 },
];

const materialLibrary = new Map();

await fs.mkdir(outDir, { recursive: true });
await fs.mkdir(lightmapDir, { recursive: true });

for (const chunk of chunks) {
  const scene = makeChunk(chunk);
  const collision = makeCollisionChunk(chunk);
  await writeGlb(scene, path.join(outDir, `${chunk.id}.high.glb`));
  await writeGlb(collision, path.join(outDir, `${chunk.id}.collision.glb`));
}

console.log(`[world-chunks] wrote ${chunks.length} authored chunks to ${outDir}`);

async function writeGlb(object, file) {
  const result = await exporter.parseAsync(object, {
    binary: true,
    trs: false,
    onlyVisible: true,
  });
  await fs.writeFile(file, Buffer.from(result));
  console.log(`[world-chunks] ${path.relative(process.cwd(), file)}`);
}

function makeChunk(chunk) {
  const root = new THREE.Group();
  root.name = `chunk_${chunk.id}_authored`;
  root.userData = {
    role: 'authored-world-chunk',
    chunk: chunk.id,
    materialModel: 'procedural-pbr-blockout',
  };

  if (isNatureChunk(chunk)) {
    addNatureTerrain(root, chunk);
  } else {
    addGround(root, chunk);
    addSettledFloorTileRelief(root, chunk);
  }
  if (chunk.region === 'interior') addInteriorShell(root, chunk);
  if (chunk.region === 'cavern') addCavernShell(root, chunk);

  switch (chunk.id) {
    case 'atrium':
      addAtriumSet(root, chunk);
      break;
    case 'arcane-library':
      addLibrarySet(root, chunk);
      break;
    case 'grand-hall':
      addGrandHallSet(root, chunk);
      break;
    case 'dining-hall':
      addDiningHallSet(root, chunk);
      break;
    case 'moonlit-lawn':
      addLawnSet(root, chunk);
      break;
    case 'lake-grotto':
      addLakeGrottoSet(root, chunk);
      break;
    case 'training-yard':
      addTrainingYardSet(root, chunk);
      break;
    case 'crystal-greenhouse':
      addGreenhouseSet(root, chunk);
      break;
  }

  addHeroDetailPass(root, chunk);
  addHeroSurfaceDressingPass(root, chunk);
  addSpatialDepthPass(root, chunk);
  addChunkLightMarkers(root, chunk);
  return root;
}

function addGround(root, chunk) {
  const width = chunk.bounds.maxX - chunk.bounds.minX;
  const depth = chunk.bounds.maxZ - chunk.bounds.minZ;
  const center = centerOf(chunk);
  const floorMat = material(`${chunk.id}_floor_pbr`, chunk.floor, {
    roughness: 0.82,
    metalness: 0.03,
  });
  root.add(box('authored_floor_slab', [width, 0.18, depth], [center.x, 0.0, center.z], floorMat));

  const seamMat = material(`${chunk.id}_dark_grout`, shade(chunk.floor, -0.42), { roughness: 0.95 });
  const tileSize = chunk.region === 'exterior' ? 3.2 : 2.2;
  for (let x = chunk.bounds.minX + tileSize; x < chunk.bounds.maxX; x += tileSize) {
    root.add(box('floor_grout_x', [0.035, 0.022, depth], [x, 0.105, center.z], seamMat));
  }
  for (let z = chunk.bounds.minZ + tileSize; z < chunk.bounds.maxZ; z += tileSize) {
    root.add(box('floor_grout_z', [width, 0.022, 0.035], [center.x, 0.108, z], seamMat));
  }

  const wearMat = material(`${chunk.id}_worn_edges`, shade(chunk.floor, 0.35), { roughness: 0.9 });
  for (let i = 0; i < 18; i += 1) {
    const r = rng(chunk.id, i);
    const x = lerp(chunk.bounds.minX + 1, chunk.bounds.maxX - 1, r());
    const z = lerp(chunk.bounds.minZ + 1, chunk.bounds.maxZ - 1, r());
    const chip = box('stone_wear_chip', [0.25 + r() * 0.8, 0.018, 0.025 + r() * 0.08], [x, 0.125, z], wearMat);
    chip.rotation.y = r() * Math.PI;
    root.add(chip);
  }
}

function addSettledFloorTileRelief(root, chunk) {
  const b = chunk.bounds;
  const r = rng(`${chunk.id}-settled-floor-tiles`, 0);
  const tileSize = chunk.region === 'exterior' ? 3.2 : 2.2;
  const gap = chunk.region === 'exterior' ? 0.16 : 0.105;
  const tileInset = gap * 0.5;
  const tileBaseY = 0.101;
  const radius = chunk.region === 'exterior' ? 0.055 : 0.04;
  const variants = [
    material(`${chunk.id}_individual_beveled_floor_tile_mid`, shade(chunk.floor, 0.05), { roughness: 0.82, metalness: 0.025 }),
    material(`${chunk.id}_individual_beveled_floor_tile_cool`, shade(chunk.floor, -0.04), { roughness: 0.86, metalness: 0.02 }),
    material(`${chunk.id}_individual_beveled_floor_tile_worn_high`, shade(chunk.floor, 0.14), { roughness: 0.78, metalness: 0.03 }),
  ];
  const darkRecess = material(`${chunk.id}_chipped_tile_corner_dark_recess`, shade(chunk.floor, -0.58), {
    roughness: 0.98,
    transparent: true,
    opacity: 0.64,
    side: THREE.DoubleSide,
  });
  const exposedCore = material(`${chunk.id}_chipped_tile_corner_exposed_core`, shade(chunk.floor, 0.32), {
    roughness: 0.76,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  let index = 0;
  for (let minX = b.minX; minX < b.maxX - 0.36; minX += tileSize) {
    for (let minZ = b.minZ; minZ < b.maxZ - 0.36; minZ += tileSize) {
      const maxX = Math.min(minX + tileSize, b.maxX);
      const maxZ = Math.min(minZ + tileSize, b.maxZ);
      const width = Math.max(0.42, maxX - minX - gap);
      const depth = Math.max(0.42, maxZ - minZ - gap);
      const height = 0.034 + r() * 0.018;
      const x = (minX + maxX) / 2 + (r() - 0.5) * 0.035;
      const z = (minZ + maxZ) / 2 + (r() - 0.5) * 0.035;
      const y = tileBaseY + height / 2 + r() * 0.006;
      const tile = beveledBox(
        'individual_settled_beveled_floor_tile',
        [width, height, depth],
        [x, y, z],
        variants[(index + Math.floor(r() * variants.length)) % variants.length],
        radius,
        2,
      );
      tile.rotation.y = (r() - 0.5) * 0.012;
      root.add(tile);

      if (index % 5 === 0 || r() > 0.78) {
        const cornerX = x + (r() > 0.5 ? 1 : -1) * (width / 2 - tileInset * 0.6);
        const cornerZ = z + (r() > 0.5 ? 1 : -1) * (depth / 2 - tileInset * 0.6);
        const chip = new THREE.Mesh(new THREE.CircleGeometry(0.12 + r() * 0.18, 3), index % 2 === 0 ? darkRecess : exposedCore);
        chip.name = index % 2 === 0 ? 'chipped_floor_tile_corner_dark_recess' : 'chipped_floor_tile_corner_exposed_core';
        chip.position.set(cornerX, y + height / 2 + 0.004, cornerZ);
        chip.rotation.x = -Math.PI / 2;
        chip.rotation.z = r() * Math.PI;
        chip.scale.set(1.0 + r() * 1.4, 0.48 + r() * 0.64, 1);
        chip.receiveShadow = true;
        root.add(chip);
      }

      index += 1;
    }
  }
}

function addNatureTerrain(root, chunk) {
  if (chunk.id === 'moonlit-lawn') {
    addMoonlitLawnTerrain(root, chunk);
    return;
  }
  if (chunk.id === 'lake-grotto') {
    addLakeGrottoTerrain(root, chunk);
  }
}

function addMoonlitLawnTerrain(root, chunk) {
  const c = centerOf(chunk);
  const grass = material('moonlit_lawn_irregular_meadow_sod', 0x557247, {
    roughness: 0.96,
    metalness: 0,
  });
  const coolGrass = material('moonlit_lawn_cool_mossy_understory', 0x314d3c, {
    roughness: 0.98,
    metalness: 0,
  });
  const dryGrass = material('moonlit_lawn_dry_raised_turf', 0x84945c, {
    roughness: 0.94,
    metalness: 0,
  });

  root.add(irregularDisc('moonlit_lawn_irregular_terrain_sod', [c.x, c.z], [15.8, 8.65], 0.088, grass, `${chunk.id}-terrain`, 112));

  const r = rng(`${chunk.id}-natural-patches`, 0);
  for (let i = 0; i < 58; i += 1) {
    const x = lerp(chunk.bounds.minX + 0.7, chunk.bounds.maxX - 0.7, r());
    const z = lerp(chunk.bounds.minZ + 0.7, chunk.bounds.maxZ - 0.7, r());
    const patch = irregularDisc(
      i % 4 === 0 ? 'moonlit_lawn_dry_turf_island' : 'moonlit_lawn_mossy_turf_island',
      [x, z],
      [0.42 + r() * 1.65, 0.18 + r() * 0.72],
      0.118 + i * 0.0004,
      i % 4 === 0 ? dryGrass : coolGrass,
      `${chunk.id}-patch-${i}`,
      28,
    );
    patch.rotation.y = r() * Math.PI;
    root.add(patch);
  }

  const mound = material('moonlit_lawn_low_earth_mound', 0x3f553d, { roughness: 0.98 });
  for (let i = 0; i < 24; i += 1) {
    const x = lerp(chunk.bounds.minX + 1.4, chunk.bounds.maxX - 1.4, r());
    const z = lerp(chunk.bounds.minZ + 1.2, chunk.bounds.maxZ - 1.2, r());
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 + r() * 0.52, 1), mound);
    mesh.name = 'moonlit_lawn_subtle_earth_mound';
    mesh.position.set(x, 0.14 + r() * 0.025, z);
    mesh.scale.set(1.8 + r() * 2.4, 0.16 + r() * 0.2, 1.1 + r() * 1.8);
    mesh.rotation.set(r() * 0.12, r() * Math.PI, r() * 0.08);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
}

function addLakeGrottoTerrain(root, chunk) {
  const c = centerOf(chunk);
  const bank = material('lake_grotto_irregular_wet_rock_bank', 0x2f4c47, {
    roughness: 0.88,
    metalness: 0.02,
  });
  const silt = material('lake_grotto_submerged_dark_silt', 0x182b2f, {
    roughness: 0.96,
    metalness: 0,
  });
  const shallow = material('lake_grotto_mineral_shallow_water', 0x5fb6bb, {
    roughness: 0.08,
    metalness: 0,
    transparent: true,
    opacity: 0.44,
    emissive: 0x0b3444,
    emissiveIntensity: 0.22,
    side: THREE.DoubleSide,
  });
  const deep = material('lake_grotto_deep_blue_water_body', 0x276f8a, {
    roughness: 0.04,
    metalness: 0,
    transparent: true,
    opacity: 0.66,
    emissive: 0x082a42,
    emissiveIntensity: 0.34,
    side: THREE.DoubleSide,
  });

  root.add(irregularDisc('lake_grotto_wet_rocky_bank_terrain', [c.x, c.z], [9.7, 7.45], 0.088, bank, `${chunk.id}-bank`, 120));
  root.add(irregularDisc('lake_grotto_submerged_silt_bed', [c.x, c.z], [8.35, 6.05], 0.11, silt, `${chunk.id}-silt`, 112));
  root.add(irregularDisc('lake_grotto_shallow_mineral_water_shelf', [c.x, c.z], [8.05, 5.75], 0.127, shallow, `${chunk.id}-shallow`, 112));
  root.add(irregularDisc('lake_grotto_deep_irregular_water_pool', [c.x, c.z], [6.82, 4.82], 0.139, deep, `${chunk.id}-deep`, 112));

  const r = rng(`${chunk.id}-shore-rocks`, 0);
  const rockA = material('lake_grotto_stratified_shore_rock', 0x405a5b, { roughness: 0.84, metalness: 0.02 });
  const rockB = material('lake_grotto_dark_wet_shore_rock', 0x1d3437, { roughness: 0.72, metalness: 0.03 });
  for (let i = 0; i < 48; i += 1) {
    const angle = (i / 48) * Math.PI * 2 + (r() - 0.5) * 0.22;
    const radiusX = 8.25 + r() * 1.18;
    const radiusZ = 5.9 + r() * 0.92;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18 + r() * 0.52, 1), i % 3 === 0 ? rockA : rockB);
    rock.name = 'lake_grotto_natural_shore_rock_cluster';
    rock.position.set(c.x + Math.cos(angle) * radiusX, 0.2 + r() * 0.22, c.z + Math.sin(angle) * radiusZ);
    rock.scale.set(1.4 + r() * 2.4, 0.45 + r() * 0.82, 0.85 + r() * 1.55);
    rock.rotation.set(r() * Math.PI, r() * Math.PI, r() * Math.PI);
    rock.castShadow = true;
    rock.receiveShadow = true;
    root.add(rock);
  }
}

function addInteriorShell(root, chunk) {
  const b = chunk.bounds;
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  const c = centerOf(chunk);
  const wallMat = material(`${chunk.id}_wall_plaster`, chunk.wall, { roughness: 0.7, metalness: 0.02 });
  const trimMat = material(`${chunk.id}_aged_brass`, chunk.accent, { roughness: 0.3, metalness: 0.48 });
  const shadowMat = material(`${chunk.id}_recess_shadow`, shade(chunk.wall, -0.38), { roughness: 0.9 });

  root.add(box('north_authored_wall', [width, 3.6, 0.32], [c.x, 1.8, b.minZ - 0.16], wallMat));
  root.add(box('south_authored_wall', [width, 3.6, 0.32], [c.x, 1.8, b.maxZ + 0.16], wallMat));
  root.add(box('west_authored_wall', [0.32, 3.6, depth], [b.minX - 0.16, 1.8, c.z], wallMat));
  root.add(box('east_authored_wall', [0.32, 3.6, depth], [b.maxX + 0.16, 1.8, c.z], wallMat));
  root.add(box('north_base_trim', [width, 0.24, 0.44], [c.x, 0.32, b.minZ], trimMat));
  root.add(box('south_base_trim', [width, 0.24, 0.44], [c.x, 0.32, b.maxZ], trimMat));
  root.add(box('north_crown_trim', [width, 0.18, 0.42], [c.x, 3.52, b.minZ], trimMat));
  root.add(box('south_crown_trim', [width, 0.18, 0.42], [c.x, 3.52, b.maxZ], trimMat));

  for (let x = b.minX + 2.2; x < b.maxX; x += 3.4) {
    root.add(box('wall_recess_panel_n', [1.5, 1.8, 0.055], [x, 1.85, b.minZ + 0.02], shadowMat));
    root.add(box('wall_recess_panel_s', [1.5, 1.8, 0.055], [x, 1.85, b.maxZ - 0.02], shadowMat));
  }
}

function addCavernShell(root, chunk) {
  const b = chunk.bounds;
  const c = centerOf(chunk);
  const rockMat = material(`${chunk.id}_wet_cavern_rock`, chunk.wall, { roughness: 0.76, metalness: 0.02 });
  for (let i = 0; i < 42; i += 1) {
    const r = rng(chunk.id, i + 200);
    const edge = i % 4;
    const x = edge === 0 ? b.minX + r() * 2 : edge === 1 ? b.maxX - r() * 2 : lerp(b.minX, b.maxX, r());
    const z = edge === 2 ? b.minZ + r() * 2 : edge === 3 ? b.maxZ - r() * 2 : lerp(b.minZ, b.maxZ, r());
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 + r() * 1.1, 1), rockMat);
    rock.name = 'wet_cavern_rock_cluster';
    rock.position.set(x, 0.35 + r() * 0.7, z);
    rock.scale.set(1.4 + r() * 1.8, 0.6 + r() * 1.7, 1.2 + r() * 1.9);
    rock.rotation.set(r() * Math.PI, r() * Math.PI, r() * Math.PI);
    rock.castShadow = true;
    rock.receiveShadow = true;
    root.add(rock);
  }
  root.add(box('cavern_backplate_shadow', [b.maxX - b.minX, 1.6, 0.28], [c.x, 0.8, b.maxZ + 0.12], rockMat));
}

function addAtriumSet(root, chunk) {
  const c = centerOf(chunk);
  addColumnRing(root, chunk, 4, 3.2);
  addRuneCircle(root, [c.x, 0.18, c.z + 2.2], 3.6, chunk.accent, chunk.emissive);
  addArchedPortal(root, [c.x, 0, chunk.bounds.minZ - 0.05], 2.2, chunk.accent, chunk.emissive);
  addFloatingCrystals(root, [c.x + 2.3, 1.8, c.z - 1.0], chunk.emissive, 5);
  addBenches(root, [c.x - 4.8, 0, c.z + 2.8], chunk.accent);
  addBenches(root, [c.x + 4.8, 0, c.z + 2.8], chunk.accent);
}

function addLibrarySet(root, chunk) {
  const b = chunk.bounds;
  for (let z = b.minZ + 0.8; z < b.maxZ - 0.5; z += 1.6) {
    addBookshelf(root, [b.maxX - 0.55, 0, z], -Math.PI / 2, chunk);
  }
  for (let x = b.minX + 0.9; x < b.maxX - 1.2; x += 1.8) {
    addBookshelf(root, [x, 0, b.minZ + 0.48], 0, chunk);
  }
  addReadingTable(root, [5.8, 0, -1.6], chunk);
  addBookStacks(root, chunk, 24);
  addFloatingCrystals(root, [7.4, 2.4, -4.2], chunk.emissive, 4);
}

function addGrandHallSet(root, chunk) {
  addColumnRing(root, chunk, 6, 4.6);
  addRuneCircle(root, [0, 0.18, -15.4], 5.2, chunk.accent, chunk.emissive);
  addArchedPortal(root, [0, 0, chunk.bounds.minZ - 0.08], 3.3, chunk.accent, chunk.emissive);
  addFountain(root, [0, 0.1, -12.8], chunk);
  for (const x of [-6, 0, 6]) addChandelier(root, [x, 3.4, -15.5], chunk.accent, chunk.emissive);
  addDais(root, [0, 0.2, -20.4], chunk);
}

function addDiningHallSet(root, chunk) {
  for (const z of [-3.2, 0.5, 4.2]) addDiningTable(root, [17, 0, z], chunk);
  addFireplace(root, [23.4, 0, 0.6], Math.PI / 2, chunk);
  addServiceCounter(root, [14, 0, -5.7], chunk);
  for (const z of [-3.2, 4.2]) addChandelier(root, [17, 3.2, z], chunk.accent, chunk.emissive);
}

function addLawnSet(root, chunk) {
  for (const p of [[-12, 0, 10], [12, 0, 10], [-13, 0, 22], [13, 0, 22], [-3.4, 0, 24.2], [8.5, 0, 13.0]]) addTree(root, p, chunk);
  addGrassField(root, chunk, 320);
  addFloatingCrystals(root, [-5.5, 1.6, 19.4], chunk.emissive, 6);
}

function addLakeGrottoSet(root, chunk) {
  addDock(root, [-7.2, 0.18, 16.2], chunk);
  addReeds(root, chunk, 150);
  addFloatingCrystals(root, [-18.6, 1.4, 22.2], chunk.emissive, 8);
}

function addTrainingYardSet(root, chunk) {
  addRuneCircle(root, [17, 0.18, 34], 4.2, chunk.accent, chunk.emissive);
  for (const x of [13.5, 17, 20.5]) addTrainingTarget(root, [x, 0, 37.2], chunk);
  addWeaponRack(root, [10.8, 0, 29.2], chunk);
  addWeaponRack(root, [23.4, 0, 29.2], chunk);
  for (const p of [[11, 0, 39], [23, 0, 39], [10, 0, 27], [24, 0, 27]]) addTorch(root, p, chunk);
}

function addGreenhouseSet(root, chunk) {
  const b = chunk.bounds;
  const c = centerOf(chunk);
  const glass = material('greenhouse_blue_glass', 0x9dffe4, {
    roughness: 0.1,
    metalness: 0.02,
    transparent: true,
    opacity: 0.32,
    emissive: 0x2a8b77,
    emissiveIntensity: 0.18,
    side: THREE.DoubleSide,
  });
  const frame = material('greenhouse_verdigris_frame', chunk.accent, { roughness: 0.38, metalness: 0.45 });
  for (let x = b.minX + 2.2; x < b.maxX - 1; x += 3.2) {
    addArchFrame(root, [x, 0, c.z], 2.8, frame, glass);
  }
  root.add(box('greenhouse_glass_roof', [b.maxX - b.minX - 1.8, 0.08, b.maxZ - b.minZ - 1.2], [c.x, 3.1, c.z], glass));
  addPlanterBeds(root, chunk, 8);
  addFloatingCrystals(root, [c.x, 1.8, c.z], chunk.emissive, 10);
}

function addHeroDetailPass(root, chunk) {
  if (isNatureChunk(chunk)) {
    addNaturalGroundDebris(root, chunk);
  } else {
    addFloorMicroDamage(root, chunk);
    addLooseDebris(root, chunk);
  }

  if (chunk.region === 'interior') {
    addInteriorArchitecturalDetail(root, chunk);
    addWallSconces(root, chunk);
  }

  if (chunk.region === 'exterior' || chunk.region === 'combat') {
    addGroundPatches(root, chunk);
  }

  if (chunk.region === 'cavern') {
    addWetRockHighlights(root, chunk);
  }

  switch (chunk.id) {
    case 'atrium':
      addAtriumNarrativeProps(root, chunk);
      break;
    case 'arcane-library':
      addLibraryNarrativeProps(root, chunk);
      break;
    case 'grand-hall':
      addGrandHallNarrativeProps(root, chunk);
      break;
    case 'dining-hall':
      addDiningHallNarrativeProps(root, chunk);
      break;
    case 'moonlit-lawn':
      addLawnNarrativeProps(root, chunk);
      break;
    case 'lake-grotto':
      addGrottoNarrativeProps(root, chunk);
      break;
    case 'training-yard':
      addTrainingNarrativeProps(root, chunk);
      break;
    case 'crystal-greenhouse':
      addGreenhouseNarrativeProps(root, chunk);
      break;
  }
}

function addSpatialDepthPass(root, chunk) {
  if (chunk.region === 'interior') {
    addVaultedInteriorDepth(root, chunk);
    return;
  }

  if (chunk.region === 'cavern') {
    addCavernDepthBackdrop(root, chunk);
    return;
  }

  addExteriorCampusDepth(root, chunk);
}

function addHeroSurfaceDressingPass(root, chunk) {
  if (isNatureChunk(chunk)) {
    addNaturalSurfaceDressing(root, chunk);
  } else {
    addTileEdgeMaterialBreakup(root, chunk);
    addGroundContactOcclusion(root, chunk);
  }

  if (chunk.region === 'interior') {
    addInteriorHeroSurfaceDressing(root, chunk);
  }

  if (chunk.region === 'exterior') {
    addExteriorHeroSurfaceDressing(root, chunk);
  }

  if (chunk.region === 'cavern') {
    addCavernHeroSurfaceDressing(root, chunk);
  }

  if (chunk.region === 'combat') {
    addCombatHeroSurfaceDressing(root, chunk);
  }
}

function addTileEdgeMaterialBreakup(root, chunk) {
  const b = chunk.bounds;
  const r = rng(`${chunk.id}-tile-edge-breakup`, 0);
  const tileSize = chunk.region === 'exterior' ? 3.2 : 2.2;
  const exposedStone = material(`${chunk.id}_exposed_stone_edge_micro_highlight`, shade(chunk.floor, 0.42), {
    roughness: 0.78,
    metalness: 0.02,
  });
  const darkGap = material(`${chunk.id}_deepened_tile_gap_contact_shadow`, shade(chunk.floor, -0.62), {
    roughness: 0.98,
    transparent: true,
    opacity: 0.58,
  });
  const warmInlay = material(`${chunk.id}_pinpoint_worn_brass_inlay_glints`, chunk.accent, {
    roughness: 0.24,
    metalness: 0.62,
  });

  const groutX = [];
  for (let x = b.minX + tileSize; x < b.maxX; x += tileSize) groutX.push(x);
  const groutZ = [];
  for (let z = b.minZ + tileSize; z < b.maxZ; z += tileSize) groutZ.push(z);

  const count = chunk.region === 'interior' ? 56 : 78;
  for (let i = 0; i < count; i += 1) {
    const useVertical = (i + Math.floor(r() * 10)) % 2 === 0 && groutX.length > 0;
    const x = useVertical ? groutX[Math.floor(r() * groutX.length)] : lerp(b.minX + 0.8, b.maxX - 0.8, r());
    const z = useVertical ? lerp(b.minZ + 0.8, b.maxZ - 0.8, r()) : groutZ[Math.floor(r() * Math.max(1, groutZ.length))] ?? lerp(b.minZ + 0.8, b.maxZ - 0.8, r());
    const isGlint = i % 11 === 0;
    const detail = box(
      isGlint ? 'pinpoint_worn_brass_inlay_glint' : i % 3 === 0 ? 'deepened_tile_gap_contact_shadow' : 'chipped_tile_exposed_edge_highlight',
      useVertical ? [0.018 + r() * 0.025, 0.012, 0.18 + r() * 0.72] : [0.18 + r() * 0.72, 0.012, 0.018 + r() * 0.025],
      [x + (r() - 0.5) * 0.12, 0.158 + i * 0.00018, z + (r() - 0.5) * 0.12],
      isGlint ? warmInlay : i % 3 === 0 ? darkGap : exposedStone,
    );
    detail.rotation.y = useVertical ? (r() - 0.5) * 0.28 : Math.PI / 2 + (r() - 0.5) * 0.28;
    root.add(detail);
  }
}

function addGroundContactOcclusion(root, chunk) {
  const b = chunk.bounds;
  const r = rng(`${chunk.id}-contact-occlusion`, 0);
  const occlusion = material(`${chunk.id}_prop_contact_ambient_occlusion`, shade(chunk.floor, -0.54), {
    roughness: 0.98,
    transparent: true,
    opacity: chunk.region === 'exterior' ? 0.16 : 0.24,
    side: THREE.DoubleSide,
  });
  const count = chunk.region === 'interior' ? 18 : 24;
  for (let i = 0; i < count; i += 1) {
    const patch = new THREE.Mesh(new THREE.CircleGeometry(0.1 + r() * 0.32, 20), occlusion);
    patch.name = 'soft_contact_ao_under_prop_cluster';
    patch.position.set(
      lerp(b.minX + 0.7, b.maxX - 0.7, r()),
      0.162 + i * 0.00022,
      lerp(b.minZ + 0.7, b.maxZ - 0.7, r()),
    );
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = r() * Math.PI;
    patch.scale.set(0.75 + r() * 0.85, 0.18 + r() * 0.32, 1);
    patch.receiveShadow = true;
    root.add(patch);
  }
}

function addInteriorHeroSurfaceDressing(root, chunk) {
  const b = chunk.bounds;
  const r = rng(`${chunk.id}-interior-hero-dressing`, 0);
  const paper = material(`${chunk.id}_torn_parchment_page_fragments`, 0xd2c39a, { roughness: 0.86, side: THREE.DoubleSide });
  const wax = material(`${chunk.id}_dried_candle_wax_drops`, 0xe5d7b4, { roughness: 0.64 });
  const soot = material(`${chunk.id}_smudged_soot_and_ink_marks`, 0x24202a, {
    roughness: 0.96,
    transparent: true,
    opacity: 0.36,
    side: THREE.DoubleSide,
  });
  const thread = material(`${chunk.id}_frayed_fabric_threads`, shade(chunk.wall, 0.12), { roughness: 0.94 });

  for (let i = 0; i < 34; i += 1) {
    const x = lerp(b.minX + 1.0, b.maxX - 1.0, r());
    const z = lerp(b.minZ + 1.0, b.maxZ - 1.0, r());
    if (i % 5 === 0) {
      const stain = new THREE.Mesh(new THREE.CircleGeometry(0.1 + r() * 0.26, 14), soot);
      stain.name = 'irregular_ink_soot_floor_smudge';
      stain.position.set(x, 0.172 + i * 0.0002, z);
      stain.rotation.x = -Math.PI / 2;
      stain.rotation.z = r() * Math.PI;
      stain.scale.set(1.0 + r() * 1.2, 0.28 + r() * 0.42, 1);
      root.add(stain);
    } else if (i % 3 === 0) {
      const drip = new THREE.Mesh(new THREE.SphereGeometry(0.035 + r() * 0.045, 10, 6), wax);
      drip.name = 'raised_dried_candle_wax_drop';
      drip.position.set(x, 0.2 + r() * 0.018, z);
      drip.scale.set(1.3 + r() * 1.5, 0.22 + r() * 0.32, 1.0 + r() * 1.3);
      drip.receiveShadow = true;
      root.add(drip);
    } else if (i % 2 === 0) {
      const scrap = new THREE.Mesh(new THREE.PlaneGeometry(0.16 + r() * 0.32, 0.08 + r() * 0.24), paper);
      scrap.name = 'torn_parchment_page_fragment';
      scrap.position.set(x, 0.176 + i * 0.0002, z);
      scrap.rotation.x = -Math.PI / 2;
      scrap.rotation.z = r() * Math.PI;
      scrap.receiveShadow = true;
      root.add(scrap);
    } else {
      const fiber = box('single_frayed_fabric_thread_on_floor', [0.34 + r() * 0.5, 0.01, 0.015], [x, 0.18 + i * 0.0002, z], thread);
      fiber.rotation.y = r() * Math.PI;
      root.add(fiber);
    }
  }
}

function addExteriorHeroSurfaceDressing(root, chunk) {
  const b = chunk.bounds;
  const r = rng(`${chunk.id}-exterior-hero-dressing`, 0);
  const leaf = material(`${chunk.id}_fallen_leaf_litter_layer`, 0x8e9c58, { roughness: 0.9, side: THREE.DoubleSide });
  const twig = material(`${chunk.id}_fallen_twig_bark`, 0x3c2c22, { roughness: 0.88 });
  const puddle = material(`${chunk.id}_thin_moonlit_wet_puddle`, 0x8fc7d7, {
    roughness: 0.08,
    metalness: 0,
    transparent: true,
    opacity: 0.2,
    emissive: 0x0a2731,
    emissiveIntensity: 0.08,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < 54; i += 1) {
    const x = lerp(b.minX + 0.8, b.maxX - 0.8, r());
    const z = lerp(b.minZ + 0.8, b.maxZ - 0.8, r());
    if (i % 9 === 0) {
      const wet = new THREE.Mesh(new THREE.CircleGeometry(0.24 + r() * 0.62, 20), puddle);
      wet.name = 'thin_moonlit_wet_puddle';
      wet.position.set(x, 0.168 + i * 0.00018, z);
      wet.rotation.x = -Math.PI / 2;
      wet.rotation.z = r() * Math.PI;
      wet.scale.set(1.6 + r() * 2.4, 0.38 + r() * 0.7, 1);
      root.add(wet);
    } else if (i % 4 === 0) {
      const fallenTwig = cyl('fallen_twig_on_ground', [0.015 + r() * 0.018, 0.018 + r() * 0.02], 0.42 + r() * 0.72, [x, 0.196, z], twig, 6);
      fallenTwig.rotation.z = Math.PI / 2;
      fallenTwig.rotation.y = r() * Math.PI;
      root.add(fallenTwig);
    } else {
      const fallenLeaf = new THREE.Mesh(new THREE.PlaneGeometry(0.1 + r() * 0.16, 0.18 + r() * 0.28), leaf);
      fallenLeaf.name = 'individual_fallen_leaf_litter';
      fallenLeaf.position.set(x, 0.18 + i * 0.00016, z);
      fallenLeaf.rotation.x = -Math.PI / 2 + (r() - 0.5) * 0.08;
      fallenLeaf.rotation.z = r() * Math.PI;
      root.add(fallenLeaf);
    }
  }
}

function addCavernHeroSurfaceDressing(root, chunk) {
  const b = chunk.bounds;
  const r = rng(`${chunk.id}-cavern-hero-dressing`, 0);
  const mineral = material(`${chunk.id}_mineral_bloom_crust`, 0x8fd3df, {
    roughness: 0.34,
    transparent: true,
    opacity: 0.46,
    emissive: 0x0d3c45,
    emissiveIntensity: 0.16,
    side: THREE.DoubleSide,
  });
  const crystal = material(`${chunk.id}_broken_crystal_flake`, chunk.emissive, {
    roughness: 0.1,
    metalness: 0,
    transparent: true,
    opacity: 0.74,
    emissive: chunk.emissive,
    emissiveIntensity: 0.32,
  });
  const wet = material(`${chunk.id}_nearfield_wet_rock_pooled_sheen`, 0xa8ddea, {
    roughness: 0.06,
    transparent: true,
    opacity: 0.28,
    emissive: 0x0b3440,
    emissiveIntensity: 0.12,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < 44; i += 1) {
    const x = lerp(b.minX + 0.9, b.maxX - 0.9, r());
    const z = lerp(b.minZ + 0.9, b.maxZ - 0.9, r());
    if (i % 7 === 0) {
      const pool = new THREE.Mesh(new THREE.CircleGeometry(0.16 + r() * 0.52, 18), wet);
      pool.name = 'nearfield_wet_rock_pooled_sheen';
      pool.position.set(x, 0.174 + i * 0.0002, z);
      pool.rotation.x = -Math.PI / 2;
      pool.rotation.z = r() * Math.PI;
      pool.scale.set(1.6 + r() * 1.8, 0.35 + r() * 0.7, 1);
      root.add(pool);
    } else if (i % 4 === 0) {
      const flake = new THREE.Mesh(new THREE.OctahedronGeometry(0.04 + r() * 0.08, 1), crystal);
      flake.name = 'broken_crystal_flake_on_floor';
      flake.position.set(x, 0.21 + r() * 0.06, z);
      flake.scale.set(1.0 + r() * 1.8, 0.35 + r() * 0.6, 0.8 + r() * 1.2);
      flake.rotation.set(r() * Math.PI, r() * Math.PI, r() * Math.PI);
      root.add(flake);
    } else {
      const crust = new THREE.Mesh(new THREE.CircleGeometry(0.1 + r() * 0.32, 14), mineral);
      crust.name = 'powdery_mineral_bloom_crust';
      crust.position.set(x, 0.18 + i * 0.0002, z);
      crust.rotation.x = -Math.PI / 2;
      crust.rotation.z = r() * Math.PI;
      crust.scale.set(1.4 + r() * 1.6, 0.42 + r() * 0.8, 1);
      root.add(crust);
    }
  }
}

function addCombatHeroSurfaceDressing(root, chunk) {
  const b = chunk.bounds;
  const r = rng(`${chunk.id}-combat-hero-dressing`, 0);
  const chalk = material(`${chunk.id}_powdered_chalk_boot_scuff`, 0xd4c7a3, {
    roughness: 0.96,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  const splinter = material(`${chunk.id}_fresh_training_wood_splinter`, 0x8a5a33, { roughness: 0.76 });
  const metal = material(`${chunk.id}_dull_weapon_scrape_exposed_metal`, 0xbcb3a4, { roughness: 0.32, metalness: 0.58 });

  for (let i = 0; i < 46; i += 1) {
    const x = lerp(b.minX + 0.8, b.maxX - 0.8, r());
    const z = lerp(b.minZ + 0.8, b.maxZ - 0.8, r());
    if (i % 6 === 0) {
      const scrape = box('dull_weapon_scrape_exposed_metal_line', [0.44 + r() * 1.2, 0.012, 0.018], [x, 0.178 + i * 0.0002, z], metal);
      scrape.rotation.y = r() * Math.PI;
      root.add(scrape);
    } else if (i % 3 === 0) {
      const wood = box('fresh_training_wood_splinter', [0.08 + r() * 0.14, 0.026, 0.38 + r() * 0.5], [x, 0.192, z], splinter);
      wood.rotation.y = r() * Math.PI;
      root.add(wood);
    } else {
      const scuff = new THREE.Mesh(new THREE.CircleGeometry(0.14 + r() * 0.36, 18), chalk);
      scuff.name = 'powdered_chalk_boot_scuff';
      scuff.position.set(x, 0.17 + i * 0.0002, z);
      scuff.rotation.x = -Math.PI / 2;
      scuff.rotation.z = r() * Math.PI;
      scuff.scale.set(1.8 + r() * 2.4, 0.22 + r() * 0.55, 1);
      root.add(scuff);
    }
  }
}

function addVaultedInteriorDepth(root, chunk) {
  const b = chunk.bounds;
  const c = centerOf(chunk);
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  const stone = material(`${chunk.id}_upper_vault_stone`, shade(chunk.wall, -0.08), { roughness: 0.74, metalness: 0.02 });
  const shadow = material(`${chunk.id}_vaulted_ceiling_soft_occlusion`, shade(chunk.wall, -0.48), {
    roughness: 0.96,
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide,
  });
  const glass = material(`${chunk.id}_clerestory_blue_leaded_glass`, chunk.emissive, {
    roughness: 0.08,
    metalness: 0,
    transparent: true,
    opacity: 0.34,
    emissive: chunk.emissive,
    emissiveIntensity: 0.22,
    side: THREE.DoubleSide,
  });
  const brass = material(`${chunk.id}_clerestory_leaded_brass`, chunk.accent, { roughness: 0.32, metalness: 0.5 });

  root.add(box('upper_vault_soft_shadow_plane', [Math.max(1, width - 1.2), 0.028, Math.max(1, depth - 1.2)], [c.x, 3.72, c.z], shadow));

  for (let z = b.minZ + 1.6; z < b.maxZ - 1.2; z += 3.0) {
    const rib = cyl('upper_vault_stone_rib_crosswise', [0.055, 0.065], Math.max(1.2, width - 1.0), [c.x, 3.86, z], stone, 14);
    rib.rotation.z = Math.PI / 2;
    root.add(rib);
    root.add(box('vault_rib_left_impost_block', [0.34, 0.36, 0.42], [b.minX + 0.28, 3.24, z], stone));
    root.add(box('vault_rib_right_impost_block', [0.34, 0.36, 0.42], [b.maxX - 0.28, 3.24, z], stone));
  }

  for (let x = b.minX + 1.8; x < b.maxX - 1.2; x += 2.8) {
    root.add(box('north_clerestory_glass_lancet', [0.72, 0.84, 0.035], [x, 2.92, b.minZ + 0.055], glass));
    root.add(box('north_clerestory_vertical_mullion', [0.045, 0.92, 0.05], [x, 2.92, b.minZ + 0.03], brass));
    root.add(box('north_clerestory_sill_brass', [0.82, 0.055, 0.055], [x, 2.48, b.minZ + 0.035], brass));
  }

  for (let z = b.minZ + 1.8; z < b.maxZ - 1.4; z += 3.2) {
    root.add(box('west_clerestory_glass_lancet', [0.035, 0.78, 0.7], [b.minX + 0.055, 2.88, z], glass));
    root.add(box('west_clerestory_vertical_mullion', [0.05, 0.88, 0.045], [b.minX + 0.03, 2.88, z], brass));
  }
}

function addExteriorCampusDepth(root, chunk) {
  const b = chunk.bounds;
  const c = centerOf(chunk);
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  const r = rng(`${chunk.id}-campus-depth`, 0);
  const ground = material(`${chunk.id}_terrain_skirt_blended_ground`, shade(chunk.floor, -0.08), { roughness: 0.92 });
  const wall = material(`${chunk.id}_distant_campus_perimeter_stone`, shade(chunk.wall, -0.04), { roughness: 0.78, metalness: 0.02 });
  const cap = material(`${chunk.id}_worn_perimeter_wall_cap`, shade(chunk.wall, 0.18), { roughness: 0.68, metalness: 0.03 });
  const silhouette = material(`${chunk.id}_distant_academy_silhouette`, shade(chunk.wall, -0.28), { roughness: 0.82, metalness: 0.02 });
  const leaf = material(`${chunk.id}_distant_tree_line_canopy_cards`, shade(0x5f8e5a, -0.04), {
    roughness: 0.9,
    transparent: true,
    opacity: 0.7,
    emissive: 0x102315,
    emissiveIntensity: 0.04,
    side: THREE.DoubleSide,
  });
  const trunk = material(`${chunk.id}_distant_tree_trunk`, 0x3f3025, { roughness: 0.88 });

  root.add(box('terrain_skirt_blended_ground', [width + 9.5, 0.08, depth + 9.5], [c.x, -0.08, c.z], ground));
  root.add(box('campus_perimeter_wall_far', [width + 6.4, 0.92, 0.42], [c.x, 0.46, b.maxZ + 2.4], wall));
  root.add(box('campus_perimeter_wall_west', [0.42, 1.05, depth + 5.2], [b.minX - 2.4, 0.52, c.z], wall));
  root.add(box('campus_wall_far_capstone', [width + 6.7, 0.14, 0.52], [c.x, 0.99, b.maxZ + 2.4], cap));
  root.add(box('campus_wall_west_capstone', [0.52, 0.16, depth + 5.5], [b.minX - 2.4, 1.12, c.z], cap));

  const towerPositions = [
    [b.minX - 3.0, b.maxZ + 3.0],
    [b.maxX + 2.8, b.maxZ + 2.6],
    [b.minX - 2.8, b.maxZ + 2.6],
  ];
  for (const [x, z] of towerPositions) {
    root.add(cyl('distant_academy_round_tower', [0.42, 0.52], 2.6 + r() * 0.9, [x, 1.2, z], silhouette, 18));
    const roof = cyl('distant_academy_tower_roof', [0.0, 0.72], 0.62, [x, 2.82 + r() * 0.3, z], cap, 18);
    root.add(roof);
  }

  for (let i = 0; i < 18; i += 1) {
    const alongFarEdge = i % 2 === 0;
    const x = alongFarEdge ? lerp(b.minX - 3.6, b.maxX + 3.6, i / 17) : b.minX - 3.2 - r() * 1.2;
    const z = alongFarEdge ? b.maxZ + 4.2 + r() * 1.6 : lerp(b.minZ + 1.8, b.maxZ + 3.2, i / 17);
    addDistantTreeLineCluster(root, x, z, r, trunk, leaf);
  }
}

function addDistantTreeLineCluster(root, x, z, random, trunkMat, leafMat) {
  root.add(cyl('distant_tree_line_trunk', [0.045, 0.078], 1.0 + random() * 0.5, [x, 0.52, z], trunkMat, 7));
  for (let layer = 0; layer < 4; layer += 1) {
    const y = 1.05 + layer * 0.22 + random() * 0.18;
    const card = leafCard(
      'distant_tree_line_cross_leaf_card',
      [x + (random() - 0.5) * 0.7, y, z + (random() - 0.5) * 0.7],
      [0.85 + random() * 0.55, 0.52 + random() * 0.34],
      [0.05 + (random() - 0.5) * 0.28, random() * Math.PI * 2, (random() - 0.5) * 0.38],
      leafMat,
      14,
    );
    card.castShadow = true;
    card.receiveShadow = true;
    root.add(card);
  }
}

function addCavernDepthBackdrop(root, chunk) {
  const b = chunk.bounds;
  const c = centerOf(chunk);
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  const r = rng(`${chunk.id}-cavern-depth`, 0);
  const rock = material(`${chunk.id}_layered_cavern_depth_rock`, shade(chunk.wall, -0.12), { roughness: 0.82, metalness: 0.02 });
  const wet = material(`${chunk.id}_distant_wet_rock_sheen`, 0x8cc7d7, {
    roughness: 0.18,
    metalness: 0,
    transparent: true,
    opacity: 0.24,
    emissive: 0x123d46,
    emissiveIntensity: 0.1,
  });
  const mist = material(`${chunk.id}_cavern_depth_blue_mist`, 0x7ac7d8, {
    roughness: 0.35,
    metalness: 0,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
  });

  root.add(box('cavern_lower_terrain_skirt', [width + 6.0, 0.08, depth + 6.0], [c.x, -0.08, c.z], rock));
  root.add(box('layered_cavern_back_wall_north', [width + 3.4, 2.6, 0.72], [c.x, 1.25, b.minZ - 1.4], rock));
  root.add(box('layered_cavern_wall_west', [0.72, 2.3, depth + 2.4], [b.minX - 1.2, 1.16, c.z], rock));
  root.add(box('cavern_depth_blue_mist_sheet', [width + 2.2, 1.2, 0.035], [c.x, 0.95, b.minZ - 0.92], mist));

  for (let i = 0; i < 26; i += 1) {
    const x = i % 2 === 0 ? lerp(b.minX - 0.8, b.maxX + 0.8, r()) : b.minX - 0.8 - r() * 0.8;
    const z = i % 2 === 0 ? b.minZ - 0.8 - r() * 1.4 : lerp(b.minZ - 0.6, b.maxZ + 0.6, r());
    const stalactite = cyl('overhead_cavern_stalactite', [0.18 + r() * 0.16, 0.0], 0.8 + r() * 1.1, [x, 2.55 + r() * 0.65, z], rock, 9);
    stalactite.rotation.z = (r() - 0.5) * 0.2;
    root.add(stalactite);
  }

  for (let i = 0; i < 18; i += 1) {
    const streak = box('distant_wet_rock_sheen_streak', [0.07 + r() * 0.12, 0.018, 0.72 + r() * 1.2], [lerp(b.minX, b.maxX, r()), 0.74 + r() * 1.2, b.minZ - 1.02], wet);
    streak.rotation.y = (r() - 0.5) * 0.6;
    root.add(streak);
  }
}

function addFloorMicroDamage(root, chunk) {
  const r = rng(`${chunk.id}-micro-damage`, 0);
  const crack = material(`${chunk.id}_thin_stone_crack_dark`, shade(chunk.floor, -0.58), {
    roughness: 0.96,
    metalness: 0.0,
  });
  const dust = material(`${chunk.id}_settled_dust_ao_patch`, shade(chunk.floor, 0.18), {
    roughness: 0.98,
    transparent: true,
    opacity: 0.42,
  });
  const count = chunk.region === 'interior' ? 34 : 52;
  for (let i = 0; i < count; i += 1) {
    const x = lerp(chunk.bounds.minX + 0.7, chunk.bounds.maxX - 0.7, r());
    const z = lerp(chunk.bounds.minZ + 0.7, chunk.bounds.maxZ - 0.7, r());
    const isDust = i % 3 === 0;
    const detail = box(
      isDust ? 'settled_dust_soft_ao_patch' : 'hairline_floor_crack',
      isDust ? [0.35 + r() * 1.4, 0.012, 0.08 + r() * 0.35] : [0.42 + r() * 1.8, 0.014, 0.018 + r() * 0.025],
      [x, 0.142 + i * 0.0003, z],
      isDust ? dust : crack,
    );
    detail.rotation.y = r() * Math.PI;
    root.add(detail);
  }
}

function addLooseDebris(root, chunk) {
  const r = rng(`${chunk.id}-debris`, 0);
  const stone = material(`${chunk.id}_loose_chipped_stone`, shade(chunk.floor, -0.08), { roughness: 0.86 });
  const metal = material(`${chunk.id}_tiny_lost_metal_inlay`, chunk.accent, { roughness: 0.38, metalness: 0.54 });
  const count = chunk.region === 'interior' ? 16 : 28;
  for (let i = 0; i < count; i += 1) {
    const x = lerp(chunk.bounds.minX + 0.8, chunk.bounds.maxX - 0.8, r());
    const z = lerp(chunk.bounds.minZ + 0.8, chunk.bounds.maxZ - 0.8, r());
    if (i % 5 === 0) {
      const shard = box('loose_brass_inlay_shard', [0.18 + r() * 0.24, 0.026, 0.035 + r() * 0.06], [x, 0.18, z], metal);
      shard.rotation.y = r() * Math.PI;
      root.add(shard);
    } else {
      const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.045 + r() * 0.11, 0), stone);
      pebble.name = 'loose_chipped_stone_pebble';
      pebble.position.set(x, 0.19 + r() * 0.035, z);
      pebble.scale.set(1 + r() * 1.6, 0.45 + r() * 0.6, 0.8 + r() * 1.3);
      pebble.rotation.set(r() * Math.PI, r() * Math.PI, r() * Math.PI);
      pebble.castShadow = true;
      pebble.receiveShadow = true;
      root.add(pebble);
    }
  }
}

function addInteriorArchitecturalDetail(root, chunk) {
  const b = chunk.bounds;
  const c = centerOf(chunk);
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  const beam = material(`${chunk.id}_dark_ceiling_beam_aged_oak`, 0x2f2119, { roughness: 0.72, metalness: 0.02 });
  const brass = material(`${chunk.id}_engraved_wall_brass_relief`, chunk.accent, { roughness: 0.34, metalness: 0.5 });
  const fabric = material(`${chunk.id}_faded_velvet_wall_hanging`, shade(chunk.wall, -0.2), {
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  for (let z = b.minZ + 1.8; z < b.maxZ - 1.4; z += 3.2) {
    root.add(box('dark_oak_ceiling_crossbeam', [width + 0.35, 0.16, 0.18], [c.x, 3.36, z], beam));
  }
  for (let x = b.minX + 2.2; x < b.maxX - 1.8; x += 4.2) {
    root.add(box('wall_brass_relief_plaque_north', [1.45, 0.08, 0.045], [x, 2.72, b.minZ + 0.04], brass));
    root.add(box('wall_brass_relief_plaque_south', [1.45, 0.08, 0.045], [x, 2.72, b.maxZ - 0.04], brass));
    root.add(box('faded_fabric_wall_hanging_north', [0.82, 1.18, 0.035], [x + 0.08, 1.78, b.minZ + 0.065], fabric));
    root.add(box('faded_fabric_wall_hanging_south', [0.82, 1.18, 0.035], [x - 0.08, 1.78, b.maxZ - 0.065], fabric));
  }
  for (let z = b.minZ + 2.4; z < b.maxZ - 2.0; z += 4.0) {
    root.add(box('west_wall_vertical_relief_strip', [0.045, 2.4, 0.08], [b.minX + 0.04, 1.72, z], brass));
    root.add(box('east_wall_vertical_relief_strip', [0.045, 2.4, 0.08], [b.maxX - 0.04, 1.72, z], brass));
  }
  root.add(box('ceiling_shadow_occlusion_panel', [width - 0.8, 0.035, depth - 0.8], [c.x, 3.18, c.z], material(`${chunk.id}_ceiling_baked_shadow`, shade(chunk.wall, -0.5), {
    roughness: 0.95,
    transparent: true,
    opacity: 0.28,
  })));
}

function addWallSconces(root, chunk) {
  const b = chunk.bounds;
  const brass = material(`${chunk.id}_sconce_blackened_brass`, chunk.accent, { roughness: 0.34, metalness: 0.52 });
  const flame = material(`${chunk.id}_warm_sconce_flame`, chunk.emissive, {
    roughness: 0.18,
    metalness: 0,
    emissive: chunk.emissive,
    emissiveIntensity: 1.4,
  });
  for (let x = b.minX + 2.0; x < b.maxX - 1.4; x += 4.0) {
    addWallSconce(root, [x, 2.05, b.minZ + 0.22], 0, brass, flame);
    addWallSconce(root, [x, 2.05, b.maxZ - 0.22], Math.PI, brass, flame);
  }
}

function addWallSconce(root, pos, rotY, brass, flame) {
  const g = new THREE.Group();
  g.name = 'wall_sconce_cluster';
  g.add(box('sconce_backplate', [0.34, 0.5, 0.055], [0, 0, 0], brass));
  const arm = cyl('sconce_curved_arm_proxy', [0.025, 0.032], 0.38, [0, -0.08, 0.22], brass, 8);
  arm.rotation.x = Math.PI / 2;
  g.add(arm);
  g.add(cyl('sconce_flame_proxy', [0.08, 0.0], 0.22, [0, 0.12, 0.42], flame, 12));
  g.position.set(...pos);
  g.rotation.y = rotY;
  root.add(g);
}

function addGroundPatches(root, chunk) {
  const r = rng(`${chunk.id}-ground-patches`, 0);
  const moss = material(`${chunk.id}_moss_and_mud_pbr_patch`, shade(chunk.floor, -0.12), {
    roughness: 0.94,
    transparent: true,
    opacity: 0.52,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 30; i += 1) {
    const x = lerp(chunk.bounds.minX + 0.8, chunk.bounds.maxX - 0.8, r());
    const z = lerp(chunk.bounds.minZ + 0.8, chunk.bounds.maxZ - 0.8, r());
    const patch = new THREE.Mesh(new THREE.CircleGeometry(0.25 + r() * 0.78, 18), moss);
    patch.name = 'irregular_moss_mud_ground_patch';
    patch.position.set(x, 0.151 + i * 0.0005, z);
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = r() * Math.PI;
    patch.scale.set(1.4 + r() * 1.8, 0.55 + r(), 1);
    patch.receiveShadow = true;
    root.add(patch);
  }
}

function addWetRockHighlights(root, chunk) {
  const r = rng(`${chunk.id}-wet-rock-highlights`, 0);
  const wet = material(`${chunk.id}_wet_rock_specular_streak`, 0x9bd8e6, {
    roughness: 0.18,
    metalness: 0,
    transparent: true,
    opacity: 0.38,
    emissive: 0x123d46,
    emissiveIntensity: 0.18,
  });
  for (let i = 0; i < 24; i += 1) {
    const x = lerp(chunk.bounds.minX + 1.0, chunk.bounds.maxX - 1.0, r());
    const z = lerp(chunk.bounds.minZ + 1.0, chunk.bounds.maxZ - 1.0, r());
    const streak = box('wet_rock_highlight_streak', [0.08 + r() * 0.18, 0.015, 0.6 + r() * 1.2], [x, 0.2 + r() * 0.9, z], wet);
    streak.rotation.y = r() * Math.PI;
    root.add(streak);
  }
}

function addNaturalGroundDebris(root, chunk) {
  const b = chunk.bounds;
  const r = rng(`${chunk.id}-natural-ground-debris`, 0);
  if (chunk.id === 'moonlit-lawn') {
    const leaf = material('moonlit_lawn_scattered_leaf_litter', 0x8f9d5f, { roughness: 0.92, side: THREE.DoubleSide });
    const twig = material('moonlit_lawn_scattered_twig_bark', 0x352519, { roughness: 0.9 });
    const petal = material('moonlit_lawn_pale_wildflower_petals', 0xcad9b6, { roughness: 0.82, side: THREE.DoubleSide });
    for (let i = 0; i < 82; i += 1) {
      const x = lerp(b.minX + 0.9, b.maxX - 0.9, r());
      const z = lerp(b.minZ + 0.9, b.maxZ - 0.9, r());
      if (i % 7 === 0) {
        const piece = cyl('moonlit_lawn_fallen_twig', [0.012 + r() * 0.018, 0.015 + r() * 0.02], 0.36 + r() * 0.78, [x, 0.19, z], twig, 6);
        piece.rotation.z = Math.PI / 2 + (r() - 0.5) * 0.2;
        piece.rotation.y = r() * Math.PI;
        root.add(piece);
      } else {
        const card = new THREE.Mesh(new THREE.PlaneGeometry(0.08 + r() * 0.12, 0.13 + r() * 0.2), i % 5 === 0 ? petal : leaf);
        card.name = i % 5 === 0 ? 'moonlit_lawn_wildflower_petal' : 'moonlit_lawn_fallen_leaf_litter';
        card.position.set(x, 0.172 + i * 0.0002, z);
        card.rotation.x = -Math.PI / 2 + (r() - 0.5) * 0.06;
        card.rotation.z = r() * Math.PI;
        card.receiveShadow = true;
        root.add(card);
      }
    }
    return;
  }

  const pebble = material('lake_grotto_wet_pebbles_and_gravel', 0x546a66, { roughness: 0.82, metalness: 0.02 });
  const mineral = material('lake_grotto_powdery_blue_mineral_specks', 0x8ed5dc, {
    roughness: 0.38,
    transparent: true,
    opacity: 0.54,
    emissive: 0x0c3440,
    emissiveIntensity: 0.12,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 86; i += 1) {
    const angle = r() * Math.PI * 2;
    const radiusX = 5.4 + r() * 4.3;
    const radiusZ = 3.6 + r() * 3.7;
    const x = -16 + Math.cos(angle) * radiusX;
    const z = 21 + Math.sin(angle) * radiusZ;
    if (i % 6 === 0) {
      const crust = irregularDisc('lake_grotto_mineral_speckle_on_wet_bank', [x, z], [0.12 + r() * 0.38, 0.05 + r() * 0.16], 0.178 + i * 0.0002, mineral, `${chunk.id}-mineral-speck-${i}`, 14);
      crust.rotation.y = r() * Math.PI;
      root.add(crust);
    } else {
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.045 + r() * 0.12, 0), pebble);
      stone.name = 'lake_grotto_loose_wet_pebble';
      stone.position.set(x, 0.18 + r() * 0.05, z);
      stone.scale.set(1.2 + r() * 1.4, 0.35 + r() * 0.42, 0.8 + r() * 1.2);
      stone.rotation.set(r() * Math.PI, r() * Math.PI, r() * Math.PI);
      stone.castShadow = true;
      stone.receiveShadow = true;
      root.add(stone);
    }
  }
}

function addNaturalSurfaceDressing(root, chunk) {
  const b = chunk.bounds;
  const r = rng(`${chunk.id}-natural-surface-dressing`, 0);
  if (chunk.id === 'moonlit-lawn') {
    const dark = material('moonlit_lawn_soft_root_contact_shadow', 0x142318, {
      roughness: 0.98,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 34; i += 1) {
      const x = lerp(b.minX + 0.8, b.maxX - 0.8, r());
      const z = lerp(b.minZ + 0.8, b.maxZ - 0.8, r());
      const shadow = irregularDisc('moonlit_lawn_irregular_grass_shadow_pool', [x, z], [0.32 + r() * 1.1, 0.08 + r() * 0.32], 0.166 + i * 0.0002, dark, `${chunk.id}-grass-shadow-${i}`, 18);
      shadow.rotation.y = r() * Math.PI;
      root.add(shadow);
    }
    return;
  }

  const wet = material('lake_grotto_thin_wet_bank_sheen', 0x9bddea, {
    roughness: 0.05,
    transparent: true,
    opacity: 0.34,
    emissive: 0x0a3442,
    emissiveIntensity: 0.14,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 40; i += 1) {
    const angle = (i / 40) * Math.PI * 2 + (r() - 0.5) * 0.35;
    const x = -16 + Math.cos(angle) * (6.9 + r() * 2.2);
    const z = 21 + Math.sin(angle) * (4.9 + r() * 1.7);
    const sheen = irregularDisc('lake_grotto_irregular_wet_bank_sheen', [x, z], [0.22 + r() * 0.9, 0.06 + r() * 0.22], 0.18 + i * 0.0002, wet, `${chunk.id}-wet-sheen-${i}`, 18);
    sheen.rotation.y = angle + Math.PI / 2 + (r() - 0.5) * 0.7;
    root.add(sheen);
  }
}

function addAtriumNarrativeProps(root, chunk) {
  const c = centerOf(chunk);
  addScrollCluster(root, [c.x - 2.6, 0.18, c.z + 0.8], chunk);
  addMapTableProps(root, [c.x + 2.8, 0.92, c.z + 2.6], chunk);
  addCandleCluster(root, [c.x - 5.1, 0.65, c.z - 1.7], chunk, 5);
}

function addLibraryNarrativeProps(root, chunk) {
  addScrollCluster(root, [4.0, 0.18, -5.6], chunk);
  addScrollCluster(root, [8.6, 0.18, -0.2], chunk);
  addCandleCluster(root, [5.8, 0.96, -1.6], chunk, 6);
  addMapTableProps(root, [6.4, 0.98, -2.25], chunk);
}

function addGrandHallNarrativeProps(root, chunk) {
  addCarpetRunner(root, [0, 0.17, -15.5], [3.2, 11.5], 0x5e2738);
  for (const x of [-4.5, 4.5]) addCandleCluster(root, [x, 0.55, -20.1], chunk, 5);
}

function addDiningHallNarrativeProps(root, chunk) {
  const food = material('dining_food_and_fruit_still_life', 0xb65f3e, { roughness: 0.74 });
  const glass = material('dining_glass_goblet', 0xd6f4ff, { roughness: 0.08, transparent: true, opacity: 0.52 });
  for (const z of [-3.2, 0.5, 4.2]) {
    for (const x of [-1.7, -0.3, 1.2]) {
      root.add(cyl('small_goblet_on_table', [0.055, 0.075], 0.18, [17 + x, 0.99, z + 0.26], glass, 12));
      root.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), food));
      root.children[root.children.length - 1].name = 'small_food_still_life';
      root.children[root.children.length - 1].position.set(17 + x + 0.24, 0.98, z - 0.18);
    }
  }
}

function addLawnNarrativeProps(root, chunk) {
  addSteppingStones(root, [[-6.8, 0.18, 10.2], [-5.2, 0.18, 11.7], [-3.4, 0.18, 13.1], [-1.5, 0.18, 14.4]], chunk);
  addCandleCluster(root, [-7.2, 0.38, 15.6], chunk, 4);
}

function addGrottoNarrativeProps(root, chunk) {
  addSteppingStones(root, [[-21, 0.18, 16.4], [-19.2, 0.18, 17.8], [-17.8, 0.18, 19.4], [-16.3, 0.18, 20.6]], chunk);
  addCandleCluster(root, [-10.4, 0.58, 15.8], chunk, 4);
}

function addTrainingNarrativeProps(root, chunk) {
  const mat = material('chalk_training_tactics_lines', 0xd6caa8, { roughness: 0.92, transparent: true, opacity: 0.58 });
  for (let i = 0; i < 8; i += 1) {
    const line = box('chalk_tactics_line_on_floor', [1.1 + i * 0.12, 0.012, 0.032], [13.6 + i * 0.86, 0.17, 31.1 + Math.sin(i) * 0.5], mat);
    line.rotation.y = -0.35 + i * 0.08;
    root.add(line);
  }
  addScrollCluster(root, [22.6, 0.18, 31.8], chunk);
}

function addGreenhouseNarrativeProps(root, chunk) {
  const vial = material('greenhouse_glass_vials', 0xb8fff1, { roughness: 0.06, transparent: true, opacity: 0.55, emissive: 0x245b4e, emissiveIntensity: 0.12 });
  const c = centerOf(chunk);
  for (let i = 0; i < 16; i += 1) {
    const r = rng(`${chunk.id}-vials`, i);
    root.add(cyl('small_alchemy_glass_vial', [0.045, 0.055], 0.24 + r() * 0.1, [c.x - 2.8 + r() * 5.6, 0.72, c.z - 3.0 + r() * 6.0], vial, 10));
  }
}

function addScrollCluster(root, pos, chunk) {
  const paper = material('aged_parchment_scrolls', 0xd7c59d, { roughness: 0.82 });
  const ribbon = material('scroll_ribbon_wax_seal', chunk.accent, { roughness: 0.44, metalness: 0.08 });
  for (let i = 0; i < 4; i += 1) {
    const scroll = cyl('rolled_parchment_scroll', [0.045, 0.045], 0.58, [pos[0] + i * 0.16, pos[1] + 0.04, pos[2] + (i % 2) * 0.16], paper, 12);
    scroll.rotation.z = Math.PI / 2;
    scroll.rotation.y = i * 0.4;
    root.add(scroll);
    root.add(box('scroll_wax_ribbon', [0.035, 0.018, 0.16], [pos[0] + i * 0.16, pos[1] + 0.04, pos[2] + 0.05 + (i % 2) * 0.16], ribbon));
  }
}

function addMapTableProps(root, pos, chunk) {
  const map = material('hand_drawn_strategy_map', 0xc9ba8d, { roughness: 0.88 });
  const ink = material('dark_ink_map_lines', 0x292323, { roughness: 0.9 });
  root.add(box('unfurled_parchment_map', [1.15, 0.018, 0.72], [pos[0], pos[1], pos[2]], map));
  for (let i = 0; i < 5; i += 1) {
    const line = box('inked_map_contour_line', [0.65 + i * 0.08, 0.012, 0.018], [pos[0] - 0.15 + i * 0.08, pos[1] + 0.018, pos[2] - 0.22 + i * 0.11], ink);
    line.rotation.y = -0.35 + i * 0.18;
    root.add(line);
  }
  root.add(cyl('small_brass_map_weight', [0.06, 0.07], 0.04, [pos[0] + 0.45, pos[1] + 0.04, pos[2] + 0.25], material('small_brass_table_weight', chunk.accent, { roughness: 0.3, metalness: 0.54 }), 16));
}

function addCandleCluster(root, pos, chunk, count) {
  const wax = material('warm_wax_candle_body', 0xe6d7b7, { roughness: 0.72 });
  const flame = material('small_live_flame_emissive', chunk.emissive, {
    roughness: 0.2,
    emissive: chunk.emissive,
    emissiveIntensity: 1.5,
  });
  for (let i = 0; i < count; i += 1) {
    const x = pos[0] + (i % 3) * 0.16;
    const z = pos[2] + Math.floor(i / 3) * 0.14;
    root.add(cyl('small_wax_candle', [0.035, 0.04], 0.18 + (i % 2) * 0.09, [x, pos[1] + 0.08, z], wax, 12));
    root.add(cyl('small_live_flame', [0.035, 0.0], 0.11, [x, pos[1] + 0.22 + (i % 2) * 0.09, z], flame, 10));
  }
}

function addCarpetRunner(root, pos, size, color) {
  const mat = material('worn_woven_carpet_runner', color, {
    roughness: 0.94,
    metalness: 0,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });
  const trim = material('frayed_carpet_gold_thread', 0xb99250, { roughness: 0.8, metalness: 0.08 });
  root.add(box('worn_woven_carpet_runner', [size[0], 0.022, size[1]], [pos[0], pos[1], pos[2]], mat));
  root.add(box('carpet_frayed_left_trim', [0.08, 0.026, size[1]], [pos[0] - size[0] / 2 + 0.08, pos[1] + 0.01, pos[2]], trim));
  root.add(box('carpet_frayed_right_trim', [0.08, 0.026, size[1]], [pos[0] + size[0] / 2 - 0.08, pos[1] + 0.01, pos[2]], trim));
}

function addSteppingStones(root, positions, chunk) {
  const mat = material(`${chunk.id}_weathered_stepping_stone`, shade(chunk.floor, 0.12), { roughness: 0.82 });
  positions.forEach((pos, index) => {
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42 + index * 0.035, 0), mat);
    stone.name = 'weathered_stepping_stone';
    stone.position.set(pos[0], pos[1], pos[2]);
    stone.scale.set(1.4, 0.18, 0.9);
    stone.rotation.y = index * 0.52;
    stone.castShadow = true;
    stone.receiveShadow = true;
    root.add(stone);
  });
}

function addColumnRing(root, chunk, count, height) {
  const b = chunk.bounds;
  const positions = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    positions.push([lerp(b.minX + 1.3, b.maxX - 1.3, t), b.minZ + 1.0]);
    positions.push([lerp(b.minX + 1.3, b.maxX - 1.3, t), b.maxZ - 1.0]);
  }
  for (const [x, z] of positions) addColumn(root, [x, 0, z], height, chunk);
}

function addColumn(root, pos, height, chunk) {
  const stone = material(`${chunk.id}_column_stone`, shade(chunk.wall, 0.02), { roughness: 0.64, metalness: 0.04 });
  const brass = material(`${chunk.id}_column_brass`, chunk.accent, { roughness: 0.28, metalness: 0.52 });
  root.add(cyl('authored_column_base', [0.58, 0.7], 0.24, [pos[0], 0.12, pos[2]], stone, 32));
  root.add(cyl('authored_column_shaft', [0.27, 0.32], height - 0.5, [pos[0], height / 2, pos[2]], stone, 32));
  root.add(cyl('authored_column_capital', [0.66, 0.52], 0.3, [pos[0], height - 0.15, pos[2]], stone, 32));
  for (const y of [0.42, height - 0.46]) root.add(cyl('column_brass_band', [0.38, 0.39], 0.08, [pos[0], y, pos[2]], brass, 32));
}

function addRuneCircle(root, pos, radius, accent, emissive) {
  const brass = material('inlaid_brass_rune_lines', accent, { roughness: 0.3, metalness: 0.55, emissive, emissiveIntensity: 0.05 });
  const glow = material('soft_arcane_rune_glow', emissive, { roughness: 0.18, metalness: 0, emissive, emissiveIntensity: 1.2 });
  for (const r of [radius, radius * 0.68, radius * 0.38]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 8, 128), r === radius * 0.38 ? glow : brass);
    ring.name = 'authored_floor_rune_ring';
    ring.position.set(pos[0], pos[1], pos[2]);
    ring.rotation.x = Math.PI / 2;
    root.add(ring);
  }
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    const glyph = box('rune_glyph_dash', [0.44, 0.018, 0.045], [pos[0] + Math.cos(a) * radius * 0.82, pos[1] + 0.02, pos[2] + Math.sin(a) * radius * 0.82], glow);
    glyph.rotation.y = -a;
    root.add(glyph);
  }
}

function addArchedPortal(root, pos, scale, accent, emissive) {
  const brass = material('portal_aged_brass', accent, { roughness: 0.24, metalness: 0.58 });
  const glow = material('portal_inner_arcane_glow', emissive, {
    roughness: 0.2,
    metalness: 0,
    transparent: true,
    opacity: 0.36,
    emissive,
    emissiveIntensity: 1.1,
    side: THREE.DoubleSide,
  });
  root.add(cyl('portal_left_pillar', [0.16 * scale, 0.2 * scale], 2.8 * scale, [pos[0] - 1.55 * scale, 1.4 * scale, pos[2]], brass, 24));
  root.add(cyl('portal_right_pillar', [0.16 * scale, 0.2 * scale], 2.8 * scale, [pos[0] + 1.55 * scale, 1.4 * scale, pos[2]], brass, 24));
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.55 * scale, 0.12 * scale, 16, 72, Math.PI), brass);
  arch.name = 'portal_arch';
  arch.position.set(pos[0], 2.8 * scale, pos[2]);
  arch.rotation.z = Math.PI;
  root.add(arch);
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(2.8 * scale, 2.7 * scale), glow);
  veil.name = 'portal_glow_veil';
  veil.position.set(pos[0], 1.55 * scale, pos[2] + 0.05);
  root.add(veil);
}

function addFloatingCrystals(root, pos, color, count) {
  const crystal = material('faceted_arcane_crystal', color, {
    roughness: 0.08,
    metalness: 0.02,
    transparent: true,
    opacity: 0.78,
    emissive: color,
    emissiveIntensity: 0.45,
  });
  for (let i = 0; i < count; i += 1) {
    const r = rng(`crystal-${pos.join('-')}`, i);
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.22 + r() * 0.28, 2), crystal);
    mesh.name = 'floating_faceted_crystal';
    mesh.position.set(pos[0] + (r() - 0.5) * 3.4, pos[1] + r() * 1.8, pos[2] + (r() - 0.5) * 3.4);
    mesh.rotation.set(r() * Math.PI, r() * Math.PI, r() * Math.PI);
    mesh.castShadow = true;
    root.add(mesh);
  }
}

function addBenches(root, pos, accent) {
  const wood = material('bench_dark_oak', 0x4a2b1c, { roughness: 0.68, metalness: 0.03 });
  const brass = material('bench_brass_mount', accent, { roughness: 0.36, metalness: 0.45 });
  root.add(box('carved_bench_seat', [2.4, 0.18, 0.55], [pos[0], 0.46, pos[2]], wood));
  root.add(box('carved_bench_back', [2.4, 0.82, 0.14], [pos[0], 0.88, pos[2] - 0.32], wood));
  for (const x of [-0.95, 0.95]) root.add(box('bench_brass_foot', [0.18, 0.42, 0.16], [pos[0] + x, 0.22, pos[2]], brass));
}

function addBookshelf(root, pos, rotY, chunk) {
  const wood = material('library_dark_wood', 0x3a2418, { roughness: 0.64, metalness: 0.04 });
  const g = new THREE.Group();
  g.name = 'authored_loaded_bookshelf';
  g.add(box('shelf_back', [1.2, 2.7, 0.18], [0, 1.35, -0.24], wood));
  g.add(box('shelf_left', [0.14, 2.9, 0.58], [-0.67, 1.45, 0], wood));
  g.add(box('shelf_right', [0.14, 2.9, 0.58], [0.67, 1.45, 0], wood));
  for (const y of [0.18, 0.7, 1.2, 1.72, 2.24, 2.76]) g.add(box('shelf_board', [1.42, 0.07, 0.62], [0, y, 0], wood));
  const colors = [0x7651b9, 0xb9505c, 0xd2ad5f, 0x4f94a7, 0x6f9348, 0xdfd0ae];
  for (let row = 0; row < 5; row += 1) {
    for (let i = 0; i < 9; i += 1) {
      const bookMat = material(`book_${colors[(row + i) % colors.length].toString(16)}`, colors[(row + i) % colors.length], { roughness: 0.62, metalness: 0.02 });
      g.add(box('individual_book_spine', [0.08, 0.24 + ((i + row) % 4) * 0.04, 0.16], [-0.5 + i * 0.12, 0.28 + row * 0.5, 0.18], bookMat));
    }
  }
  g.position.set(...pos);
  g.rotation.y = rotY;
  root.add(g);
}

function addReadingTable(root, pos, chunk) {
  const wood = material('reading_table_walnut', 0x58351f, { roughness: 0.55, metalness: 0.04 });
  root.add(box('reading_table_top', [2.2, 0.16, 1.15], [pos[0], 0.75, pos[2]], wood));
  for (const x of [-0.86, 0.86]) for (const z of [-0.4, 0.4]) root.add(box('reading_table_leg', [0.12, 0.7, 0.12], [pos[0] + x, 0.35, pos[2] + z], wood));
  addBookStacks(root, { id: `${chunk.id}-table`, bounds: { minX: pos[0] - 0.9, maxX: pos[0] + 0.9, minZ: pos[2] - 0.42, maxZ: pos[2] + 0.42 }, accent: chunk.accent }, 4, 0.88);
}

function addBookStacks(root, chunk, count, y = 0.18) {
  for (let i = 0; i < count; i += 1) {
    const r = rng(`${chunk.id}-books`, i);
    const x = lerp(chunk.bounds.minX + 0.5, chunk.bounds.maxX - 0.5, r());
    const z = lerp(chunk.bounds.minZ + 0.5, chunk.bounds.maxZ - 0.5, r());
    for (let n = 0; n < 2 + Math.floor(r() * 4); n += 1) {
      root.add(box('loose_book_stack', [0.36 + r() * 0.12, 0.045, 0.24 + r() * 0.12], [x, y + n * 0.05, z], material('loose_book_cover', 0x8e5bb6, { roughness: 0.6 })));
    }
  }
}

function addChandelier(root, pos, accent, emissive) {
  const brass = material('chandelier_brass', accent, { roughness: 0.25, metalness: 0.58 });
  const fire = material('chandelier_flame', emissive, { roughness: 0.2, metalness: 0, emissive, emissiveIntensity: 1.8 });
  root.add(cyl('chandelier_chain', [0.025, 0.025], 0.85, [pos[0], pos[1] + 0.42, pos[2]], brass, 8));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.035, 8, 48), brass);
  ring.name = 'chandelier_ring';
  ring.position.set(...pos);
  ring.rotation.x = Math.PI / 2;
  root.add(ring);
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    root.add(cyl('candle_flame', [0.04, 0.0], 0.18, [pos[0] + Math.cos(a) * 0.66, pos[1] + 0.08, pos[2] + Math.sin(a) * 0.66], fire, 12));
  }
}

function addDais(root, pos, chunk) {
  const matA = material('grand_dais_stone', shade(chunk.floor, 0.1), { roughness: 0.68, metalness: 0.03 });
  const matB = material('grand_dais_gold', chunk.accent, { roughness: 0.28, metalness: 0.55 });
  root.add(box('raised_dais_step_a', [7.0, 0.24, 2.8], [pos[0], pos[1], pos[2]], matA));
  root.add(box('raised_dais_step_b', [5.2, 0.22, 1.8], [pos[0], pos[1] + 0.24, pos[2] - 0.2], matA));
  root.add(box('dais_gold_front_trim', [5.4, 0.1, 0.12], [pos[0], pos[1] + 0.42, pos[2] + 0.72], matB));
}

function addDiningTable(root, pos, chunk) {
  const wood = material('dining_polished_oak', 0x5d351f, { roughness: 0.48, metalness: 0.04 });
  root.add(box('long_dining_table_top', [5.6, 0.18, 1.05], [pos[0], 0.76, pos[2]], wood));
  for (const x of [-2.2, 2.2]) for (const z of [-0.38, 0.38]) root.add(box('dining_table_leg', [0.16, 0.72, 0.16], [pos[0] + x, 0.36, pos[2] + z], wood));
  const dish = material('ceramic_plate', 0xd8d0bd, { roughness: 0.5, metalness: 0.02 });
  for (let x = -2.1; x <= 2.1; x += 0.7) {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.025, 24), dish);
    plate.name = 'individual_plate';
    plate.position.set(pos[0] + x, 0.88, pos[2] + (Math.round(x * 10) % 2) * 0.38 - 0.19);
    root.add(plate);
  }
  addChandelier(root, [pos[0], 3.1, pos[2]], chunk.accent, chunk.emissive);
}

function addFireplace(root, pos, rotY, chunk) {
  const stone = material('fireplace_carved_stone', shade(chunk.wall, -0.1), { roughness: 0.68 });
  const fire = material('fireplace_fire_core', 0xff7432, { roughness: 0.2, emissive: 0xff4010, emissiveIntensity: 1.8 });
  const g = new THREE.Group();
  g.name = 'large_lit_fireplace';
  g.add(box('fireplace_body', [2.0, 1.6, 0.42], [0, 0.8, 0], stone));
  g.add(box('fireplace_opening', [1.25, 0.85, 0.08], [0, 0.62, -0.23], material('fireplace_soot_shadow', 0x201616, { roughness: 0.95 })));
  g.add(cyl('animated_flame_proxy', [0.2, 0.02], 0.6, [0, 0.62, -0.31], fire, 16));
  g.position.set(...pos);
  g.rotation.y = rotY;
  root.add(g);
}

function addServiceCounter(root, pos, chunk) {
  const wood = material('service_counter_oak', 0x623b22, { roughness: 0.56 });
  root.add(box('food_service_counter', [3.8, 0.9, 0.7], [pos[0], 0.45, pos[2]], wood));
  const metal = material('serving_silverware', 0xb9b7ad, { roughness: 0.28, metalness: 0.6 });
  for (let x = -1.3; x <= 1.3; x += 0.65) root.add(cyl('covered_serving_dish', [0.22, 0.28], 0.16, [pos[0] + x, 1.0, pos[2]], metal, 24));
}

function addFountain(root, pos, chunk) {
  const stone = material('fountain_moonstone', shade(chunk.floor, 0.25), { roughness: 0.58, metalness: 0.04 });
  const water = material('fountain_water', 0x75d6ff, { roughness: 0.05, transparent: true, opacity: 0.58, emissive: 0x1a6d8b, emissiveIntensity: 0.25 });
  root.add(cyl('fountain_outer_basin', [1.9, 2.1], 0.32, [pos[0], pos[1] + 0.16, pos[2]], stone, 48));
  root.add(cyl('fountain_water_disc', [1.65, 1.65], 0.04, [pos[0], pos[1] + 0.36, pos[2]], water, 48));
  root.add(cyl('fountain_center_pillar', [0.26, 0.34], 1.05, [pos[0], pos[1] + 0.84, pos[2]], stone, 24));
  addFloatingCrystals(root, [pos[0], pos[1] + 1.55, pos[2]], chunk.emissive, 3);
}

function addTree(root, pos, chunk) {
  const bark = material('old_campus_tree_bark_fissured', 0x4d3827, { roughness: 0.88 });
  const darkBark = material('old_campus_tree_bark_dark_crevice', 0x241a14, { roughness: 0.95 });
  const leafA = material('moonlit_tree_leaf_cards_outer', 0x6f9b62, {
    roughness: 0.9,
    transparent: true,
    opacity: 0.78,
    emissive: 0x102616,
    emissiveIntensity: 0.06,
    side: THREE.DoubleSide,
  });
  const leafB = material('moonlit_tree_leaf_cards_inner_shadow', 0x3f6943, {
    roughness: 0.94,
    transparent: true,
    opacity: 0.64,
    emissive: 0x07130c,
    emissiveIntensity: 0.04,
    side: THREE.DoubleSide,
  });
  const r = rng(`hero-tree-${pos.join('-')}`, 0);
  const trunkHeight = 2.05 + r() * 0.5;
  const trunkLean = [(r() - 0.5) * 0.24, (r() - 0.5) * 0.24];
  const trunkBase = [pos[0], 0.12, pos[2]];
  const trunkTop = [pos[0] + trunkLean[0], trunkHeight, pos[2] + trunkLean[1]];
  root.add(branchBetween('hero_tree_tapered_fissured_trunk', trunkBase, trunkTop, [0.2, 0.42], bark, 16));

  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2 + r() * 0.45;
    const rootEnd = [
      pos[0] + Math.cos(angle) * (0.76 + r() * 0.44),
      0.13 + r() * 0.05,
      pos[2] + Math.sin(angle) * (0.76 + r() * 0.44),
    ];
    root.add(branchBetween('hero_tree_gnarled_root_flare', [pos[0], 0.18, pos[2]], rootEnd, [0.035, 0.12], bark, 9));
  }

  for (let i = 0; i < 9; i += 1) {
    const y = 0.35 + i * 0.18;
    const ring = cyl('hero_tree_irregular_bark_ridge', [0.235 - i * 0.006, 0.25 - i * 0.006], 0.026, [pos[0] + trunkLean[0] * (y / trunkHeight), y, pos[2] + trunkLean[1] * (y / trunkHeight)], darkBark, 12);
    ring.rotation.z = (r() - 0.5) * 0.12;
    root.add(ring);
  }

  const branchTips = [];
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2 + r() * 0.7;
    const startY = 1.2 + r() * 0.75;
    const start = [
      pos[0] + trunkLean[0] * (startY / trunkHeight),
      startY,
      pos[2] + trunkLean[1] * (startY / trunkHeight),
    ];
    const length = 0.86 + r() * 1.15;
    const end = [
      start[0] + Math.cos(angle) * length,
      start[1] + 0.42 + r() * 0.72,
      start[2] + Math.sin(angle) * length,
    ];
    branchTips.push(end);
    root.add(branchBetween('hero_tree_secondary_branch', start, end, [0.035 + r() * 0.025, 0.07 + r() * 0.04], bark, 10));
    if (i % 2 === 0) {
      const forkAngle = angle + (r() > 0.5 ? 0.48 : -0.48);
      const forkEnd = [
        end[0] + Math.cos(forkAngle) * (0.34 + r() * 0.36),
        end[1] + 0.16 + r() * 0.26,
        end[2] + Math.sin(forkAngle) * (0.34 + r() * 0.36),
      ];
      branchTips.push(forkEnd);
      root.add(branchBetween('hero_tree_fine_fork_branch', end, forkEnd, [0.018, 0.04], bark, 8));
    }
  }

  for (let i = 0; i < 38; i += 1) {
    const tip = branchTips[Math.floor(r() * branchTips.length)] ?? trunkTop;
    const layer = i % 3;
    const x = tip[0] + (r() - 0.5) * (1.05 + layer * 0.28);
    const y = tip[1] + (r() - 0.5) * 0.72 + layer * 0.08;
    const z = tip[2] + (r() - 0.5) * (1.05 + layer * 0.28);
    const card = leafCard(
      layer === 0 ? 'hero_tree_outer_leaf_cluster_card' : 'hero_tree_inner_leaf_shadow_card',
      [x, y, z],
      [0.85 + r() * 0.72, 0.46 + r() * 0.44],
      [(r() - 0.5) * 0.5, r() * Math.PI * 2, (r() - 0.5) * 0.65],
      layer === 0 ? leafA : leafB,
      18,
    );
    card.castShadow = true;
    card.receiveShadow = true;
    root.add(card);
  }
}

function addGrassField(root, chunk, count) {
  const bladeMat = material('varied_grass_blades', 0x73a362, { roughness: 0.92, side: THREE.DoubleSide });
  const r = rng(`${chunk.id}-grass`, 0);
  for (let i = 0; i < count; i += 1) {
    const x = lerp(chunk.bounds.minX + 0.6, chunk.bounds.maxX - 0.6, r());
    const z = lerp(chunk.bounds.minZ + 0.6, chunk.bounds.maxZ - 0.6, r());
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.12 + r() * 0.1, 0.45 + r() * 0.5), bladeMat);
    blade.name = 'individual_grass_blade_cluster';
    blade.position.set(x, 0.28, z);
    blade.rotation.y = r() * Math.PI * 2;
    blade.rotation.z = (r() - 0.5) * 0.4;
    root.add(blade);
  }
}

function addDock(root, pos, chunk) {
  const wood = material('weathered_lake_dock', 0x5b3d28, { roughness: 0.78 });
  for (let i = 0; i < 5; i += 1) root.add(box('dock_plank', [2.4, 0.12, 0.34], [pos[0] + i * 1.05, pos[1], pos[2]], wood));
  for (let i = 0; i < 4; i += 1) root.add(cyl('dock_post', [0.08, 0.1], 1.0, [pos[0] + i * 1.2, 0.5, pos[2] + 0.55], wood, 10));
}

function addReeds(root, chunk, count) {
  const reed = material('lake_reed_material', 0x7fa46b, { roughness: 0.9, side: THREE.DoubleSide });
  const r = rng(`${chunk.id}-reeds`, 0);
  for (let i = 0; i < count; i += 1) {
    const x = lerp(chunk.bounds.minX + 1, chunk.bounds.maxX - 1, r());
    const z = lerp(chunk.bounds.minZ + 1, chunk.bounds.maxZ - 1, r());
    const stalk = cyl('individual_reed_stalk', [0.018, 0.026], 0.65 + r() * 0.8, [x, 0.42, z], reed, 6);
    stalk.rotation.z = (r() - 0.5) * 0.28;
    root.add(stalk);
  }
}

function addTrainingTarget(root, pos, chunk) {
  const wood = material('training_target_wood', 0x6a4329, { roughness: 0.72 });
  const paint = material('training_target_paint', 0xc65043, { roughness: 0.65 });
  root.add(cyl('target_support_post', [0.07, 0.09], 1.15, [pos[0], 0.58, pos[2]], wood, 10));
  const target = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 40), paint);
  target.name = 'painted_combat_target';
  target.position.set(pos[0], 1.28, pos[2]);
  target.rotation.x = Math.PI / 2;
  target.castShadow = true;
  root.add(target);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 8, 40), material('target_gold_ring', chunk.accent, { roughness: 0.38, metalness: 0.4 }));
  ring.name = 'target_scoring_ring';
  ring.position.copy(target.position);
  root.add(ring);
}

function addWeaponRack(root, pos, chunk) {
  const wood = material('weapon_rack_dark_wood', 0x463020, { roughness: 0.72 });
  const metal = material('practice_weapon_metal', 0xb8afa0, { roughness: 0.3, metalness: 0.55 });
  root.add(box('weapon_rack_frame', [2.2, 1.2, 0.22], [pos[0], 0.7, pos[2]], wood));
  for (let x = -0.8; x <= 0.8; x += 0.4) {
    const blade = box('practice_sword_blade', [0.055, 0.95, 0.035], [pos[0] + x, 0.85, pos[2] - 0.18], metal);
    blade.rotation.z = x * 0.16;
    root.add(blade);
  }
}

function addTorch(root, pos, chunk) {
  const metal = material('torch_blackened_iron', 0x2f2824, { roughness: 0.44, metalness: 0.5 });
  const fire = material('torch_arcane_flame', chunk.emissive, { emissive: chunk.emissive, emissiveIntensity: 1.8, roughness: 0.2 });
  root.add(cyl('torch_stand', [0.04, 0.05], 1.2, [pos[0], 0.6, pos[2]], metal, 10));
  root.add(cyl('torch_flame', [0.14, 0.02], 0.32, [pos[0], 1.34, pos[2]], fire, 14));
}

function addArchFrame(root, pos, height, frameMat, glassMat) {
  root.add(cyl('greenhouse_arch_left', [0.06, 0.08], height, [pos[0] - 1.1, height / 2, pos[2]], frameMat, 12));
  root.add(cyl('greenhouse_arch_right', [0.06, 0.08], height, [pos[0] + 1.1, height / 2, pos[2]], frameMat, 12));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.1, height - 0.45), glassMat);
  glass.name = 'greenhouse_glass_panel';
  glass.position.set(pos[0], height / 2, pos[2]);
  glass.rotation.y = Math.PI / 2;
  root.add(glass);
}

function addPlanterBeds(root, chunk, count) {
  const wood = material('greenhouse_planter_wood', 0x5a432c, { roughness: 0.7 });
  const soil = material('greenhouse_dark_soil', 0x2d241d, { roughness: 0.96 });
  const leaf = material('greenhouse_broad_leaf', 0x4ca466, { roughness: 0.86, side: THREE.DoubleSide });
  const r = rng(`${chunk.id}-planters`, 0);
  for (let i = 0; i < count; i += 1) {
    const x = lerp(chunk.bounds.minX + 2, chunk.bounds.maxX - 2, r());
    const z = lerp(chunk.bounds.minZ + 1.5, chunk.bounds.maxZ - 1.5, r());
    root.add(box('raised_planter_box', [1.65, 0.42, 0.72], [x, 0.22, z], wood));
    root.add(box('planter_soil_surface', [1.5, 0.04, 0.58], [x, 0.46, z], soil));
    for (let p = 0; p < 8; p += 1) {
      const leafMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.58), leaf);
      leafMesh.name = 'individual_greenhouse_leaf';
      leafMesh.position.set(x + (r() - 0.5) * 1.2, 0.78 + r() * 0.32, z + (r() - 0.5) * 0.45);
      leafMesh.rotation.set((r() - 0.5) * 0.7, r() * Math.PI * 2, (r() - 0.5) * 0.8);
      root.add(leafMesh);
    }
  }
}

function makeCollisionChunk(chunk) {
  const root = new THREE.Group();
  root.name = `chunk_${chunk.id}_collision`;
  root.userData = { role: 'collision-world-chunk', chunk: chunk.id };
  const b = chunk.bounds;
  const c = centerOf(chunk);
  const invisible = material('collision_proxy_material', 0x00ff00, { transparent: true, opacity: 0.12 });
  root.add(box('floor_collision_proxy', [b.maxX - b.minX, 0.2, b.maxZ - b.minZ], [c.x, 0, c.z], invisible));
  if (chunk.region === 'interior') {
    root.add(box('north_wall_collision_proxy', [b.maxX - b.minX, 3, 0.4], [c.x, 1.5, b.minZ - 0.2], invisible));
    root.add(box('south_wall_collision_proxy', [b.maxX - b.minX, 3, 0.4], [c.x, 1.5, b.maxZ + 0.2], invisible));
    root.add(box('west_wall_collision_proxy', [0.4, 3, b.maxZ - b.minZ], [b.minX - 0.2, 1.5, c.z], invisible));
    root.add(box('east_wall_collision_proxy', [0.4, 3, b.maxZ - b.minZ], [b.maxX + 0.2, 1.5, c.z], invisible));
  }
  return root;
}

function addChunkLightMarkers(root, chunk) {
  const glow = material(`${chunk.id}_authored_light_marker`, chunk.emissive, {
    roughness: 0.2,
    emissive: chunk.emissive,
    emissiveIntensity: 1.4,
  });
  const c = centerOf(chunk);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), glow);
  marker.name = 'baked_light_probe_marker';
  marker.position.set((c.x + chunk.bounds.minX) / 2, 2.6, (c.z + chunk.bounds.minZ) / 2);
  root.add(marker);
}

function isNatureChunk(chunk) {
  return chunk.id === 'moonlit-lawn' || chunk.id === 'lake-grotto';
}

function irregularDisc(name, center, radii, y, materialRef, seed, segments = 64) {
  const r = rng(seed, 0);
  const points = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const noise = 0.86 + r() * 0.22 + Math.sin(angle * 3.0 + r() * 2.0) * 0.035;
    points.push(new THREE.Vector2(Math.cos(angle) * radii[0] * noise, Math.sin(angle) * radii[1] * noise));
  }

  const shape = new THREE.Shape(points);
  const geometry = new THREE.ShapeGeometry(shape, Math.max(8, Math.floor(segments / 4)));
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, materialRef);
  mesh.name = name;
  mesh.position.set(center[0], y, center[1]);
  mesh.receiveShadow = true;
  return mesh;
}

function box(name, size, position, materialRef) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), materialRef);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function beveledBox(name, size, position, materialRef, radius = 0.035, segments = 2) {
  const safeRadius = Math.min(radius, size[0] * 0.16, size[1] * 0.46, size[2] * 0.16);
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], segments, safeRadius), materialRef);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(name, radii, height, position, materialRef, segments = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radii[0], radii[1], height, segments), materialRef);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function branchBetween(name, start, end, radii, materialRef, segments = 10) {
  const a = new THREE.Vector3(start[0], start[1], start[2]);
  const b = new THREE.Vector3(end[0], end[1], end[2]);
  const delta = new THREE.Vector3().subVectors(b, a);
  const length = Math.max(0.001, delta.length());
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radii[0], radii[1], length, segments), materialRef);
  mesh.name = name;
  mesh.position.copy(a).addScaledVector(delta, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function leafCard(name, position, size, rotation, materialRef, segments = 16) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.5, segments), materialRef);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.scale.set(size[0], size[1], 1);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function material(name, color, options = {}) {
  const key = JSON.stringify([name, color, options]);
  if (materialLibrary.has(key)) return materialLibrary.get(key);
  const params = {
    name,
    color,
    roughness: options.roughness ?? 0.72,
    metalness: options.metalness ?? 0.04,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    side: options.side ?? THREE.FrontSide,
  };
  if (options.transparent !== undefined) params.transparent = options.transparent;
  if (options.opacity !== undefined) params.opacity = options.opacity;
  const mat = new THREE.MeshStandardMaterial(params);
  materialLibrary.set(key, mat);
  return mat;
}

function centerOf(chunk) {
  return {
    x: (chunk.bounds.minX + chunk.bounds.maxX) / 2,
    z: (chunk.bounds.minZ + chunk.bounds.maxZ) / 2,
  };
}

function shade(color, amount) {
  const c = new THREE.Color(color);
  if (amount >= 0) c.lerp(new THREE.Color(0xffffff), amount);
  else c.lerp(new THREE.Color(0x000000), -amount);
  return c.getHex();
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function rng(seed, salt) {
  let h = 2166136261;
  const value = `${seed}:${salt}`;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
