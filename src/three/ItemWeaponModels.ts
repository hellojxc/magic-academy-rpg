import * as THREE from 'three';
import type { ItemDefinition } from '../types';
import { Geo, MatLib, getStandardMaterial, makeSharedSurfaceDetailTexture } from './RenderResources';

export function createItemWeaponModel(item: ItemDefinition): THREE.Group {
  const group = new THREE.Group();
  group.name = `item_model_${item.id}`;

  const primary = getStandardMaterial({
    color: item.model.primaryColor,
    roughness: item.kind === 'weapon' ? 0.34 : 0.56,
    metalness: item.kind === 'weapon' ? 0.42 : 0.12,
    emissive: item.model.emissiveColor,
    emissiveIntensity: item.model.emissiveColor ? 0.18 : 0,
    bumpMap: makeSharedSurfaceDetailTexture(`item-${item.model.archetype}-${item.rarity}`, 1.5, 1.5),
    bumpScale: 0.01,
  });
  const secondary = getStandardMaterial({
    color: item.model.secondaryColor,
    roughness: 0.28,
    metalness: 0.48,
    emissive: item.model.emissiveColor,
    emissiveIntensity: item.model.emissiveColor ? 0.32 : 0,
  });
  const glow = getStandardMaterial({
    color: item.model.emissiveColor ?? item.model.secondaryColor,
    emissive: item.model.emissiveColor ?? item.model.secondaryColor,
    emissiveIntensity: item.model.emissiveColor ? 1.25 : 0.45,
    transparent: true,
    opacity: item.model.emissiveColor ? 0.82 : 0.58,
    roughness: 0.18,
    metalness: 0.02,
  });

  switch (item.model.archetype) {
    case 'sword':
      addSword(group, primary, secondary, glow);
      break;
    case 'dagger':
      addDaggerPair(group, primary, secondary, glow);
      break;
    case 'staff':
      addStaff(group, primary, secondary, glow);
      break;
    case 'wand':
      addWand(group, primary, secondary, glow);
      break;
    case 'bow':
      addBow(group, primary, secondary, glow);
      break;
    case 'crossbow':
      addCrossbow(group, primary, secondary, glow);
      break;
    case 'spear':
      addSpear(group, primary, secondary, glow);
      break;
    case 'shield':
      addShield(group, primary, secondary, glow);
      break;
    case 'tome':
      addTome(group, primary, secondary, glow);
      break;
    case 'orb':
      addOrb(group, primary, secondary, glow);
      break;
    case 'armor':
      addArmor(group, primary, secondary, glow);
      break;
    case 'robe':
      addRobe(group, primary, secondary, glow);
      break;
    case 'ring':
      addRing(group, primary, secondary, glow);
      break;
    case 'amulet':
      addAmulet(group, primary, secondary, glow);
      break;
    case 'potion':
      addPotion(group, primary, secondary, glow);
      break;
    case 'bomb':
      addBomb(group, primary, secondary, glow);
      break;
    case 'boots':
      addBoots(group, primary, secondary, glow);
      break;
    case 'gloves':
      addGloves(group, primary, secondary, glow);
      break;
    case 'relic':
      addRelic(group, primary, secondary, glow);
      break;
  }

  group.scale.setScalar(item.model.scale);
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
  });
  return group;
}

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1]
): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...position);
  m.rotation.set(...rotation);
  m.scale.set(...scale);
  return m;
}

function addSword(group: THREE.Group, blade: THREE.Material, trim: THREE.Material, glow: THREE.Material): void {
  group.add(mesh(Geo.box(0.08, 1.28, 0.035), blade, [0, 0.72, 0]));
  group.add(mesh(Geo.cone(0.085, 0.24, 4), blade, [0, 1.48, 0], [0, Math.PI / 4, 0]));
  group.add(mesh(Geo.box(0.42, 0.08, 0.08), trim, [0, 0.12, 0]));
  group.add(mesh(Geo.cylinder(0.035, 0.04, 0.42, 10), trim, [0, -0.14, 0], [0, 0, Math.PI / 2]));
  group.add(mesh(Geo.octahedron(0.07, 0), glow, [0, 0.22, 0.045]));
}

function addDaggerPair(group: THREE.Group, blade: THREE.Material, trim: THREE.Material, glow: THREE.Material): void {
  for (const x of [-0.14, 0.14]) {
    group.add(mesh(Geo.box(0.055, 0.62, 0.03), blade, [x, 0.46, 0], [0, 0, x < 0 ? -0.22 : 0.22]));
    group.add(mesh(Geo.cone(0.055, 0.14, 4), blade, [x, 0.84, 0], [0, Math.PI / 4, x < 0 ? -0.22 : 0.22]));
    group.add(mesh(Geo.box(0.22, 0.04, 0.055), trim, [x, 0.17, 0], [0, 0, x < 0 ? -0.22 : 0.22]));
    group.add(mesh(Geo.sphere(0.045, 10, 8), glow, [x, 0.1, 0.035]));
  }
}

function addStaff(group: THREE.Group, shaft: THREE.Material, trim: THREE.Material, glow: THREE.Material): void {
  group.add(mesh(Geo.cylinder(0.035, 0.045, 1.65, 12), shaft, [0, 0.72, 0]));
  group.add(mesh(Geo.torus(0.18, 0.018, 8, 28), trim, [0, 1.58, 0], [Math.PI / 2, 0, 0]));
  group.add(mesh(Geo.octahedron(0.18, 1), glow, [0, 1.75, 0]));
  group.add(mesh(Geo.cylinder(0.08, 0.11, 0.16, 12), trim, [0, -0.1, 0]));
}

function addWand(group: THREE.Group, shaft: THREE.Material, trim: THREE.Material, glow: THREE.Material): void {
  group.add(mesh(Geo.cylinder(0.022, 0.035, 1.0, 10), shaft, [0, 0.42, 0], [0.1, 0, -0.18]));
  group.add(mesh(Geo.sphere(0.09, 16, 12), glow, [0.12, 0.96, 0]));
  group.add(mesh(Geo.torus(0.09, 0.012, 6, 20), trim, [0.1, 0.86, 0], [Math.PI / 2, 0, 0]));
}

function addBow(group: THREE.Group, wood: THREE.Material, trim: THREE.Material, glow: THREE.Material): void {
  const upper = mesh(Geo.torus(0.45, 0.018, 8, 36, ), wood, [0, 0.55, 0], [0, 0, Math.PI / 2], [0.38, 1.0, 1]);
  const lower = mesh(Geo.torus(0.45, 0.018, 8, 36), wood, [0, 0.2, 0], [0, 0, Math.PI / 2], [0.38, 1.0, 1]);
  group.add(upper, lower);
  group.add(mesh(Geo.box(0.03, 1.08, 0.018), trim, [0.24, 0.38, 0]));
  group.add(mesh(Geo.box(0.42, 0.03, 0.03), glow, [0.0, 0.38, 0.03]));
}

function addCrossbow(group: THREE.Group, body: THREE.Material, trim: THREE.Material, glow: THREE.Material): void {
  group.add(mesh(Geo.box(0.82, 0.08, 0.08), body, [0, 0.48, 0]));
  group.add(mesh(Geo.box(0.1, 0.62, 0.08), trim, [0, 0.34, 0]));
  group.add(mesh(Geo.box(0.04, 0.78, 0.035), glow, [0, 0.64, 0.045]));
  group.add(mesh(Geo.cone(0.045, 0.18, 4), glow, [0, 1.07, 0.045], [0, Math.PI / 4, 0]));
}

function addSpear(group: THREE.Group, shaft: THREE.Material, trim: THREE.Material, glow: THREE.Material): void {
  group.add(mesh(Geo.cylinder(0.025, 0.032, 1.5, 10), shaft, [0, 0.56, 0], [0, 0, 0.18]));
  group.add(mesh(Geo.cone(0.09, 0.32, 5), trim, [0.18, 1.28, 0], [0, Math.PI / 5, 0.18]));
  group.add(mesh(Geo.octahedron(0.07, 0), glow, [0.11, 1.08, 0.035]));
}

function addShield(group: THREE.Group, face: THREE.Material, trim: THREE.Material, glow: THREE.Material): void {
  group.add(mesh(Geo.cylinder(0.42, 0.34, 0.12, 5), face, [0, 0.55, 0], [Math.PI / 2, 0, Math.PI / 5], [1, 1.15, 1]));
  group.add(mesh(Geo.torus(0.34, 0.02, 8, 5), trim, [0, 0.55, 0.065], [0, 0, Math.PI / 5], [1.08, 1.22, 1]));
  group.add(mesh(Geo.octahedron(0.09, 0), glow, [0, 0.62, 0.13]));
}

function addTome(group: THREE.Group, cover: THREE.Material, trim: THREE.Material, glow: THREE.Material): void {
  group.add(mesh(Geo.box(0.56, 0.72, 0.1), cover, [0, 0.52, 0], [0.18, -0.28, 0.05]));
  group.add(mesh(Geo.box(0.48, 0.62, 0.035), MatLib.plate, [0.02, 0.52, 0.07], [0.18, -0.28, 0.05]));
  group.add(mesh(Geo.box(0.08, 0.72, 0.12), trim, [-0.28, 0.52, 0.02], [0.18, -0.28, 0.05]));
  group.add(mesh(Geo.octahedron(0.075, 0), glow, [0.12, 0.58, 0.15]));
}

function addOrb(group: THREE.Group, _primary: THREE.Material, trim: THREE.Material, glow: THREE.Material): void {
  group.add(mesh(Geo.sphere(0.28, 24, 16), glow, [0, 0.58, 0]));
  group.add(mesh(Geo.torus(0.35, 0.015, 8, 36), trim, [0, 0.58, 0], [Math.PI / 2, 0.3, 0]));
  group.add(mesh(Geo.torus(0.35, 0.012, 8, 36), trim, [0, 0.58, 0], [0.45, Math.PI / 2, 0]));
}

function addArmor(group: THREE.Group, plate: THREE.Material, trim: THREE.Material, glow: THREE.Material): void {
  group.add(mesh(Geo.box(0.5, 0.72, 0.18), plate, [0, 0.62, 0]));
  group.add(mesh(Geo.box(0.64, 0.14, 0.22), trim, [0, 0.96, 0]));
  group.add(mesh(Geo.box(0.18, 0.36, 0.14), plate, [-0.42, 0.58, 0]));
  group.add(mesh(Geo.box(0.18, 0.36, 0.14), plate, [0.42, 0.58, 0]));
  group.add(mesh(Geo.octahedron(0.07, 0), glow, [0, 0.74, 0.13]));
}

function addRobe(group: THREE.Group, cloth: THREE.Material, trim: THREE.Material, glow: THREE.Material): void {
  group.add(mesh(Geo.cone(0.45, 0.9, 4), cloth, [0, 0.48, 0], [0, Math.PI / 4, 0], [0.9, 1, 0.55]));
  group.add(mesh(Geo.box(0.58, 0.08, 0.12), trim, [0, 0.9, 0]));
  group.add(mesh(Geo.box(0.055, 0.58, 0.13), glow, [0, 0.52, 0.08]));
}

function addRing(group: THREE.Group, _primary: THREE.Material, trim: THREE.Material, glow: THREE.Material): void {
  group.add(mesh(Geo.torus(0.28, 0.035, 12, 36), trim, [0, 0.52, 0], [Math.PI / 2, 0, 0]));
  group.add(mesh(Geo.octahedron(0.09, 0), glow, [0, 0.79, 0.02]));
}

function addAmulet(group: THREE.Group, cord: THREE.Material, trim: THREE.Material, glow: THREE.Material): void {
  group.add(mesh(Geo.torus(0.28, 0.012, 8, 32), cord, [0, 0.72, 0], [Math.PI / 2, 0, 0], [0.78, 1, 1]));
  group.add(mesh(Geo.octahedron(0.16, 0), glow, [0, 0.38, 0]));
  group.add(mesh(Geo.torus(0.18, 0.012, 8, 28), trim, [0, 0.38, 0], [Math.PI / 2, 0, 0]));
}

function addPotion(group: THREE.Group, liquid: THREE.Material, trim: THREE.Material, glow: THREE.Material): void {
  group.add(mesh(Geo.sphere(0.2, 18, 12), liquid, [0, 0.34, 0], [0, 0, 0], [1, 1.12, 1]));
  group.add(mesh(Geo.cylinder(0.06, 0.08, 0.22, 12), trim, [0, 0.6, 0]));
  group.add(mesh(Geo.sphere(0.09, 12, 8), glow, [0, 0.34, 0.04]));
}

function addBomb(group: THREE.Group, shell: THREE.Material, trim: THREE.Material, glow: THREE.Material): void {
  group.add(mesh(Geo.sphere(0.26, 18, 12), shell, [0, 0.34, 0]));
  group.add(mesh(Geo.cylinder(0.04, 0.065, 0.18, 8), trim, [0.04, 0.58, 0], [0.2, 0, -0.25]));
  group.add(mesh(Geo.octahedron(0.085, 0), glow, [-0.08, 0.42, 0.16]));
}

function addBoots(group: THREE.Group, leather: THREE.Material, trim: THREE.Material, glow: THREE.Material): void {
  for (const x of [-0.16, 0.16]) {
    group.add(mesh(Geo.box(0.18, 0.34, 0.18), leather, [x, 0.35, 0]));
    group.add(mesh(Geo.box(0.18, 0.1, 0.36), leather, [x, 0.16, 0.08]));
    group.add(mesh(Geo.box(0.16, 0.035, 0.24), trim, [x, 0.52, 0.02]));
    group.add(mesh(Geo.octahedron(0.04, 0), glow, [x, 0.24, 0.24]));
  }
}

function addGloves(group: THREE.Group, cloth: THREE.Material, trim: THREE.Material, glow: THREE.Material): void {
  for (const x of [-0.18, 0.18]) {
    group.add(mesh(Geo.sphere(0.15, 14, 10), cloth, [x, 0.38, 0], [0, 0, 0], [0.8, 1, 0.7]));
    group.add(mesh(Geo.box(0.12, 0.22, 0.08), trim, [x, 0.22, 0]));
    group.add(mesh(Geo.octahedron(0.045, 0), glow, [x, 0.41, 0.12]));
  }
}

function addRelic(group: THREE.Group, body: THREE.Material, trim: THREE.Material, glow: THREE.Material): void {
  group.add(mesh(Geo.octahedron(0.24, 1), body, [0, 0.5, 0]));
  group.add(mesh(Geo.torus(0.32, 0.014, 8, 36), trim, [0, 0.5, 0], [Math.PI / 2, 0.2, 0]));
  group.add(mesh(Geo.octahedron(0.11, 0), glow, [0, 0.86, 0]));
  group.add(mesh(Geo.cylinder(0.035, 0.05, 0.24, 8), trim, [0, 0.16, 0]));
}
