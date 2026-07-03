import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class NodeFileReader {
    result = null;
    error = null;
    onloadend = null;
    onerror = null;

    readAsArrayBuffer(blob) {
      blob.arrayBuffer()
        .then((buffer) => {
          this.result = buffer;
          this.onloadend?.({ target: this });
        })
        .catch((error) => {
          this.error = error;
          this.onerror?.(error);
        });
    }
  };
}

const OUT_DIR = resolve('public/assets/models');

const specs = {
  player: {
    id: 'player',
    heightMeters: 1.68,
    headScale: [0.9, 1.03, 0.78],
    shoulder: 0.43,
    eyeScale: 1.08,
    hairLength: 'short',
    palette: {
      skin: 0xf0c3a5,
      skinWarm: 0xe5a98d,
      blush: 0xef8f96,
      hair: 0x2a1d17,
      hairShade: 0x6d4a32,
      outfit: 0x132b68,
      outfitDark: 0x18204c,
      clothLight: 0xf6f0dc,
      accent: 0x8d2834,
      gold: 0xd7b45f,
      eye: 0x355c9a,
      dark: 0x16131c,
    },
  },
  lyra: {
    id: 'lyra',
    heightMeters: 1.55,
    headScale: [0.94, 1.08, 0.8],
    shoulder: 0.33,
    eyeScale: 1.18,
    hairLength: 'long',
    palette: {
      skin: 0xf7c9bd,
      skinWarm: 0xebaaa1,
      blush: 0xf4a8c4,
      hair: 0xb69cff,
      hairShade: 0xf0dcff,
      outfit: 0x7d56d9,
      outfitDark: 0x4b2d78,
      clothLight: 0xf8f2ff,
      accent: 0xa568df,
      gold: 0xf0c86e,
      eye: 0x7b66ff,
      dark: 0x1e1630,
    },
  },
};

const materials = new Map();

function material(name, color, roughness = 0.68, metalness = 0.02) {
  const key = `${name}-${color}-${roughness}-${metalness}`;
  const cached = materials.get(key);
  if (cached) return cached;
  const mat = new THREE.MeshStandardMaterial({
    name,
    color,
    roughness,
    metalness,
  });
  materials.set(key, mat);
  return mat;
}

function basicMaterial(name, color) {
  const key = `${name}-${color}-basic`;
  const cached = materials.get(key);
  if (cached) return cached;
  const mat = new THREE.MeshBasicMaterial({ name, color, side: THREE.BackSide });
  materials.set(key, mat);
  return mat;
}

function group(name, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const node = new THREE.Group();
  node.name = name;
  node.position.set(...position);
  node.rotation.set(...rotation);
  return node;
}

function addMesh(parent, name, geometry, mat, position, rotation = [0, 0, 0], scale = [1, 1, 1], outline = true) {
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);

  if (outline) {
    const outlineMesh = new THREE.Mesh(geometry, basicMaterial(`${name}Outline`, 0x15131d));
    outlineMesh.name = `${name}_outline`;
    outlineMesh.position.copy(mesh.position);
    outlineMesh.rotation.copy(mesh.rotation);
    outlineMesh.scale.set(scale[0] * 1.026, scale[1] * 1.026, scale[2] * 1.026);
    outlineMesh.renderOrder = -1;
    parent.add(outlineMesh);
  }

  return mesh;
}

function capsule(radius, length, segments = 18) {
  return new THREE.CapsuleGeometry(radius, length, 10, segments);
}

function buildCharacter(spec) {
  const p = spec.palette;
  const root = group(`${spec.id}_generated_v1`);
  root.userData.generatedBy = 'scripts/generate-character-glb.mjs';
  root.userData.characterId = spec.id;
  root.userData.assetVersion = 'generated-glb-v1';

  const rig = group('Rig');
  const hips = group('Hips', [0, 0.92, 0.02]);
  const chest = group('Chest', [0, 0.31, 0]);
  const head = group('Head', [0, 0.61, -0.02]);
  const hair = group('Hair', [0, 0.02, 0.02]);

  root.add(rig);
  rig.add(hips);
  hips.add(chest);
  chest.add(head);
  head.add(hair);

  const skin = material('Skin', p.skin);
  const skinWarm = material('SkinWarm', p.skinWarm);
  const blush = material('Blush', p.blush, 0.8, 0);
  const hairMat = material('Hair', p.hair, 0.55, 0.02);
  const hairShade = material('HairHighlight', p.hairShade, 0.5, 0.02);
  const outfit = material('Outfit', p.outfit, 0.62, 0.03);
  const outfitDark = material('OutfitDark', p.outfitDark, 0.68, 0.03);
  const clothLight = material('ClothLight', p.clothLight, 0.72, 0.01);
  const accent = material('Accent', p.accent, 0.62, 0.02);
  const gold = material('GoldTrim', p.gold, 0.35, 0.35);
  const eye = material('EyeIris', p.eye, 0.24, 0.02);
  const dark = material('Dark', p.dark, 0.58, 0.02);
  const white = material('EyeWhite', 0xfaf6ff, 0.42, 0);

  addMesh(hips, 'Pelvis', new THREE.SphereGeometry(0.25, 32, 18), spec.id === 'player' ? outfitDark : clothLight, [0, 0, 0], [0, 0, 0], [1.08, 0.72, 0.84]);
  addMesh(chest, 'Torso', capsule(spec.id === 'player' ? 0.275 : 0.255, 0.48, 24), outfit, [0, 0, 0], [0, 0, 0], [1.08, 1.04, 0.78]);
  addMesh(chest, 'ShirtFront', capsule(0.2, 0.43, 20), clothLight, [0, 0.025, -0.22], [0, 0, 0], [0.82, 1, 0.18], true);
  addMesh(chest, 'LeftJacketPanel', new THREE.BoxGeometry(0.12, 0.48, 0.035), outfitDark, [-0.09, 0, -0.252], [0, 0, -0.12], [1, 1, 1]);
  addMesh(chest, 'RightJacketPanel', new THREE.BoxGeometry(0.12, 0.48, 0.035), outfitDark, [0.09, 0, -0.252], [0, 0, 0.12], [1, 1, 1]);
  addMesh(chest, 'LeftTrim', new THREE.BoxGeometry(0.026, 0.52, 0.024), gold, [-0.175, 0.02, -0.285], [0, 0, -0.28], [1, 1, 1], false);
  addMesh(chest, 'RightTrim', new THREE.BoxGeometry(0.026, 0.52, 0.024), gold, [0.175, 0.02, -0.285], [0, 0, 0.28], [1, 1, 1], false);
  addMesh(chest, 'Neck', new THREE.CylinderGeometry(0.07, 0.09, 0.15, 24), skin, [0, 0.43, -0.005], [0, 0, 0], [0.78, 1, 0.78]);

  if (spec.id === 'player') {
    addTie(chest, accent, gold);
    addPlayerCape(chest, outfitDark, gold);
    addWand(root, dark, gold);
  } else {
    addBow(chest, accent, gold);
    addLyraCape(chest, outfitDark, gold);
    addSkirt(hips, clothLight, outfit, gold);
    addBook(chest, dark, gold, clothLight);
  }

  addHead(head, hair, spec, { skin, skinWarm, blush, hairMat, hairShade, eye, white, dark, gold });
  addArms(chest, spec, { skin, skinWarm, outfit, outfitDark, clothLight, gold });
  addLegs(hips, spec, { outfitDark, clothLight, dark, gold });

  const floorRing = addMesh(root, 'SelectionRing', new THREE.TorusGeometry(0.47, 0.008, 10, 64), gold, [0, 0.025, 0], [Math.PI / 2, 0, 0], [1, 1, 1], false);
  floorRing.castShadow = false;
  floorRing.receiveShadow = false;

  const clips = makeClips(spec);
  normalizeHeight(root, spec.heightMeters);
  return { root, clips };
}

function addHead(head, hair, spec, mats) {
  addMesh(head, 'Face', new THREE.SphereGeometry(0.225, 48, 28), mats.skin, [0, 0, 0], [0, 0, 0], spec.headScale);
  addMesh(head, 'Nose', new THREE.SphereGeometry(0.018, 16, 8), mats.skinWarm, [0, -0.018, -0.205], [0, 0, 0], [0.55, 0.82, 0.16], false);
  addMesh(head, 'Mouth', new THREE.TorusGeometry(0.027, 0.0025, 6, 18, Math.PI), mats.dark, [0.006, -0.083, -0.205], [0, 0, Math.PI * 1.05], [1, 0.42, 1], false);

  for (const side of [-1, 1]) {
    const eyeX = side * 0.067;
    const eyeScale = spec.eyeScale;
    addMesh(head, `EyeWhite_${side}`, new THREE.SphereGeometry(0.043, 28, 14), mats.white, [eyeX, 0.038, -0.198], [0, 0, side * 0.06], [1.35 * eyeScale, 0.88 * eyeScale, 0.1], false);
    addMesh(head, `Iris_${side}`, new THREE.SphereGeometry(0.026, 24, 12), mats.eye, [eyeX + side * 0.005, 0.033, -0.207], [0, 0, 0], [0.95 * eyeScale, 1.1 * eyeScale, 0.06], false);
    addMesh(head, `Pupil_${side}`, new THREE.SphereGeometry(0.012, 16, 8), mats.dark, [eyeX + side * 0.006, 0.029, -0.213], [0, 0, 0], [0.72, 1, 0.04], false);
    addMesh(head, `EyeHighlight_${side}`, new THREE.SphereGeometry(0.006, 12, 8), mats.white, [eyeX - side * 0.011, 0.048, -0.217], [0, 0, 0], [1, 1, 0.03], false);
    addMesh(head, `Brow_${side}`, new THREE.BoxGeometry(0.074, 0.01, 0.01), mats.hairShade, [eyeX, 0.088, -0.199], [0, 0, side * 0.15], [1, 1, 1], false);
    addMesh(head, `Cheek_${side}`, new THREE.SphereGeometry(0.027, 16, 8), mats.blush, [side * 0.112, -0.032, -0.198], [0, 0, 0], [1.25, 0.42, 0.06], false);
  }

  addMesh(hair, 'HairCap', new THREE.SphereGeometry(0.255, 48, 22, 0, Math.PI * 2, 0, Math.PI * 0.68), mats.hairMat, [0, 0.085, 0.016], [0, 0, 0], [1, 0.84, 0.92]);
  addMesh(hair, 'BackHairMass', new THREE.SphereGeometry(0.225, 40, 18, 0, Math.PI * 2, Math.PI * 0.24, Math.PI * 0.56), mats.hairShade, [0, -0.005, 0.085], [0.08, 0, 0], [1.08, 0.86, 0.88]);

  if (spec.hairLength === 'long') {
    addLyraHair(hair, mats.hairMat, mats.hairShade, mats.gold);
  } else {
    addPlayerHair(hair, mats.hairMat, mats.hairShade);
  }
}

function addPlayerHair(hair, hairMat, hairShade) {
  const bangs = [
    [-0.18, 0.17, -0.17, 0.22, -0.05, -0.5],
    [-0.07, 0.16, -0.21, 0.25, -0.02, -0.22],
    [0.04, 0.16, -0.215, 0.22, 0.02, 0.08],
    [0.15, 0.15, -0.19, 0.21, 0.04, 0.34],
  ];
  bangs.forEach(([x, y, z, len, rx, rz], index) => addHairLock(hair, `FrontHair_${index}`, hairMat, hairShade, [x, y, z], [rx, 0, rz], 0.055, len));
  for (let i = 0; i < 10; i += 1) {
    const a = -1.1 + i * 0.24;
    addHairLock(hair, `SideHair_${i}`, hairMat, hairShade, [Math.sin(a) * 0.25, 0.04 + Math.cos(a) * 0.035, Math.cos(a) * 0.16 + 0.055], [0.18, 0.12 * Math.sin(a), Math.sin(a) * 0.58], 0.04, 0.2 + (i % 3) * 0.035);
  }
}

function addLyraHair(hair, hairMat, hairShade, gold) {
  const frontLocks = [
    [-0.19, 0.12, -0.17, 0.44, -0.36],
    [-0.07, 0.105, -0.21, 0.36, -0.08],
    [0.065, 0.11, -0.205, 0.34, 0.08],
    [0.19, 0.105, -0.16, 0.4, 0.34],
  ];
  frontLocks.forEach(([x, y, z, len, rz], index) => addHairLock(hair, `LyraFrontHair_${index}`, hairMat, hairShade, [x, y, z], [0.08, 0, rz], 0.048, len));

  for (let i = 0; i < 14; i += 1) {
    const side = i < 7 ? -1 : 1;
    const local = i % 7;
    const strand = group(`LongHair_${i}`, [side * (0.17 + local * 0.025), -0.08 - local * 0.013, 0.07 + local * 0.015], [0.14 + local * 0.018, side * (0.12 + local * 0.025), side * (0.16 + local * 0.035)]);
    hair.add(strand);
    addMesh(strand, `LongHairMesh_${i}`, capsule(0.032 + local * 0.002, 0.68 + local * 0.07, 16), local % 2 === 0 ? hairMat : hairShade, [0, -0.34 - local * 0.035, 0], [0, 0, 0], [0.78, 1, 0.58]);
  }
  addMesh(hair, 'StarHairClip', new THREE.OctahedronGeometry(0.052, 0), gold, [0.22, 0.12, -0.19], [0, 0, Math.PI / 4], [1, 1, 0.28], false);
}

function addHairLock(parent, name, hairMat, hairShade, position, rotation, radius, length) {
  const lock = group(name, position, rotation);
  parent.add(lock);
  addMesh(lock, `${name}Main`, new THREE.ConeGeometry(radius, length, 18), hairMat, [0, -length / 2, 0], [0, 0, Math.PI], [1, 1, 0.48]);
  addMesh(lock, `${name}Shade`, new THREE.ConeGeometry(radius * 0.46, length * 0.9, 14), hairShade, [radius * 0.28, -length / 2 + 0.012, -radius * 0.08], [0, 0, Math.PI + 0.04], [1, 1, 0.28], false);
}

function addArms(chest, spec, mats) {
  for (const side of [-1, 1]) {
    const upper = group(side < 0 ? 'LeftUpperArm' : 'RightUpperArm', [side * spec.shoulder * 0.76, 0.29, -0.01], [spec.id === 'player' ? -0.14 : -0.38, 0, side * (spec.id === 'player' ? 0.19 : 0.76)]);
    const fore = group(side < 0 ? 'LeftForearm' : 'RightForearm', [side * 0.012, -0.42, -0.004], [-0.22, 0, side * 0.02]);
    const hand = group(side < 0 ? 'LeftHand' : 'RightHand', [side * 0.006, -0.39, -0.012]);
    chest.add(upper);
    upper.add(fore);
    fore.add(hand);
    const sleeve = spec.id === 'lyra' ? mats.clothLight : mats.outfit;
    addMesh(upper, `${upper.name}Sleeve`, capsule(spec.id === 'player' ? 0.068 : 0.06, 0.39, 18), sleeve, [0, -0.2, 0], [0, 0, 0], [0.84, 1, 0.78]);
    addMesh(fore, `${fore.name}Sleeve`, capsule(spec.id === 'player' ? 0.058 : 0.052, 0.34, 18), sleeve, [0, -0.17, 0], [0, 0, 0], [0.8, 1, 0.74]);
    addMesh(hand, `${hand.name}Palm`, new THREE.SphereGeometry(0.055, 20, 12), mats.skin, [0, 0, 0], [0, 0, 0], [0.88, 0.68, 0.82]);
    for (let i = 0; i < 4; i += 1) {
      addMesh(hand, `${hand.name}Finger_${i}`, capsule(0.0075, 0.055, 8), mats.skinWarm, [side * (-0.022 + i * 0.014), -0.045, -0.025], [0.18, 0, side * (0.08 - i * 0.035)], [1, 1, 0.72], false);
    }
    addMesh(chest, `${upper.name}Pad`, new THREE.SphereGeometry(0.125, 24, 12), mats.outfitDark, [side * spec.shoulder * 0.78, 0.29, -0.01], [0, 0, 0], [1.22, 0.54, 0.86]);
    addMesh(chest, `${upper.name}Trim`, new THREE.TorusGeometry(0.115, 0.007, 8, 30), mats.gold, [side * spec.shoulder * 0.78, 0.29, -0.01], [Math.PI / 2, 0, -side * 0.1], [1.2, 0.72, 1], false);
  }
}

function addLegs(hips, spec, mats) {
  for (const side of [-1, 1]) {
    const upper = group(side < 0 ? 'LeftUpperLeg' : 'RightUpperLeg', [side * 0.135, -0.02, 0.015], [0.03, 0, side * 0.035]);
    const lower = group(side < 0 ? 'LeftLowerLeg' : 'RightLowerLeg', [side * 0.01, -0.49, -0.004]);
    const foot = group(side < 0 ? 'LeftFoot' : 'RightFoot', [0, -0.52, -0.055], [-0.06, side * 0.04, 0]);
    hips.add(upper);
    upper.add(lower);
    lower.add(foot);
    const legMat = spec.id === 'player' ? mats.outfitDark : mats.clothLight;
    addMesh(upper, `${upper.name}Mesh`, capsule(spec.id === 'player' ? 0.077 : 0.066, 0.45, 18), legMat, [0, -0.225, 0], [0, 0, 0], [0.84, 1, 0.74]);
    addMesh(lower, `${lower.name}Mesh`, capsule(spec.id === 'player' ? 0.064 : 0.056, 0.48, 18), legMat, [0, -0.24, 0], [0, 0, 0], [0.8, 1, 0.7]);
    addMesh(foot, `${foot.name}Shoe`, new THREE.SphereGeometry(0.092, 22, 12), mats.dark, [0, 0, -0.065], [0, 0, 0], [0.72, 0.34, 1.34]);
    addMesh(foot, `${foot.name}Trim`, new THREE.BoxGeometry(0.12, 0.025, 0.22), mats.gold, [0, 0.018, -0.06], [0, 0, 0], [1, 1, 1], false);
  }
}

function addTie(chest, accent, gold) {
  addMesh(chest, 'Tie', new THREE.ConeGeometry(0.055, 0.28, 4), accent, [0, 0.18, -0.32], [0, 0, Math.PI / 4], [0.84, 1.1, 0.28]);
  addMesh(chest, 'TiePin', new THREE.SphereGeometry(0.028, 14, 8), gold, [0, 0.32, -0.324], [0, 0, 0], [1, 0.78, 0.3], false);
}

function addBow(chest, accent, gold) {
  addMesh(chest, 'LeftRibbon', clothPanel(0.025, 0.1, 0.18), accent, [-0.09, 0.27, -0.326], [0, 0, 1.32], [1, 1, 1]);
  addMesh(chest, 'RightRibbon', clothPanel(0.025, 0.1, 0.18), accent, [0.09, 0.27, -0.326], [0, 0, -1.32], [1, 1, 1]);
  addMesh(chest, 'RibbonGem', new THREE.SphereGeometry(0.035, 16, 8), gold, [0, 0.27, -0.334], [0, 0, 0], [1, 0.85, 0.5], false);
}

function addPlayerCape(chest, outfitDark, gold) {
  const cape = group('PlayerCape', [0, 0.28, 0.23], [-0.08, 0, 0]);
  chest.add(cape);
  for (const [name, x, h, rz] of [['CapeCenter', 0, 0.62, 0], ['CapeLeft', -0.22, 0.52, -0.15], ['CapeRight', 0.22, 0.52, 0.15]]) {
    const panel = group(name, [x, 0, 0.02], [-0.08, 0, rz]);
    cape.add(panel);
    addMesh(panel, `${name}Panel`, clothPanel(0.11, 0.17, h), outfitDark, [0, -0.03, 0], [0, 0, 0], [1, 1, 1]);
    addMesh(panel, `${name}Trim`, new THREE.BoxGeometry(0.02, h * 0.82, 0.016), gold, [0.14 * Math.sign(x || 1), -h * 0.4, -0.006], [0, 0, 0], [1, 1, 1], false);
  }
}

function addLyraCape(chest, outfitDark, gold) {
  const cape = group('LyraCapelet', [0, 0.28, 0.22], [-0.08, 0, 0]);
  chest.add(cape);
  for (const [name, x, h, rz] of [['CapeletLeft', -0.27, 0.74, -0.12], ['CapeletRight', 0.27, 0.74, 0.12], ['CapeletBack', 0, 0.62, 0]]) {
    const panel = group(name, [x, 0, 0.03], [-0.08, 0, rz]);
    cape.add(panel);
    addMesh(panel, `${name}Panel`, clothPanel(0.1, x === 0 ? 0.16 : 0.22, h), outfitDark, [0, -0.02, 0], [0, 0, 0], [1, 1, 1]);
    addMesh(panel, `${name}Trim`, new THREE.BoxGeometry(0.018, h * 0.82, 0.016), gold, [0.15 * Math.sign(x || 1), -h * 0.42, -0.006], [0, 0, 0], [1, 1, 1], false);
  }
}

function addSkirt(hips, clothLight, outfit, gold) {
  const skirt = group('Skirt', [0, -0.06, -0.005]);
  hips.add(skirt);
  addMesh(skirt, 'SkirtBase', new THREE.ConeGeometry(0.42, 0.46, 40, 1, true), clothLight, [0, -0.2, 0], [0, 0, 0], [1, 1, 0.86]);
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    const panel = group(`SkirtPanel_${i}`, [Math.sin(a) * 0.19, -0.01, Math.cos(a) * 0.19], [0.16, a, i % 2 === 0 ? 0.03 : -0.03]);
    skirt.add(panel);
    addMesh(panel, `SkirtPleat_${i}`, clothPanel(0.04, 0.08, 0.4), i % 2 === 0 ? clothLight : outfit, [0, -0.08, 0], [0, 0, 0], [1, 1, 1], i % 3 === 0);
    if (i % 3 === 0) addMesh(panel, `SkirtGoldLine_${i}`, new THREE.BoxGeometry(0.014, 0.32, 0.01), gold, [0.052, -0.23, -0.003], [0, 0, 0], [1, 1, 1], false);
  }
}

function addWand(root, dark, gold) {
  const wand = group('PracticeWand', [0.38, 0.87, -0.12], [0.35, 0.1, -0.28]);
  root.add(wand);
  addMesh(wand, 'WandShaft', new THREE.CylinderGeometry(0.012, 0.018, 0.58, 14), dark, [0, -0.25, -0.02], [0.2, 0, 0], [1, 1, 1]);
  addMesh(wand, 'WandPommel', new THREE.SphereGeometry(0.032, 16, 10), gold, [0, -0.54, -0.08], [0, 0, 0], [1, 1, 1], false);
  addMesh(wand, 'WandStar', new THREE.OctahedronGeometry(0.04, 0), gold, [0, -0.58, -0.08], [0, 0, Math.PI / 4], [1, 1, 0.28], false);
}

function addBook(chest, dark, gold, clothLight) {
  const book = group('Spellbook', [0, -0.05, -0.355], [-0.1, 0, 0]);
  chest.add(book);
  addMesh(book, 'BookCover', new THREE.BoxGeometry(0.48, 0.5, 0.085), dark, [0, 0, 0], [0, 0, 0], [1, 1, 1]);
  addMesh(book, 'BookPages', new THREE.BoxGeometry(0.42, 0.42, 0.025), clothLight, [0.01, 0, -0.058], [0, 0, 0], [1, 1, 1], false);
  addMesh(book, 'BookSpine', new THREE.BoxGeometry(0.04, 0.48, 0.1), gold, [-0.225, 0, 0.01], [0, 0, 0], [1, 1, 1], false);
  addMesh(book, 'BookStar', new THREE.OctahedronGeometry(0.07, 0), gold, [0.04, 0, 0.055], [0, 0, Math.PI / 4], [1, 1, 0.28], false);
}

function clothPanel(topHalfWidth, bottomHalfWidth, height) {
  const shape = new THREE.Shape();
  shape.moveTo(-topHalfWidth, 0);
  shape.lineTo(topHalfWidth, 0);
  shape.lineTo(bottomHalfWidth, -height);
  shape.lineTo(-bottomHalfWidth, -height);
  shape.lineTo(-topHalfWidth, 0);
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.computeVertexNormals();
  return geometry;
}

function makeClips(spec) {
  const idleTimes = [0, 1, 2, 3, 4];
  const walkTimes = [0, 0.25, 0.5, 0.75, 1];
  const idle = new THREE.AnimationClip('idle', 4, [
    positionTrack('Rig.position', idleTimes, [[0, 0, 0], [0, 0.014, 0], [0, 0, 0], [0, -0.008, 0], [0, 0, 0]]),
    rotationTrack('Chest.quaternion', idleTimes, [[-0.015, 0, 0], [-0.005, 0, 0], [-0.015, 0, 0], [-0.025, 0, 0], [-0.015, 0, 0]]),
    rotationTrack('Head.quaternion', idleTimes, [[0, 0, 0], [0, 0.035, 0], [0, 0, 0], [0, -0.028, 0], [0, 0, 0]]),
    rotationTrack('Hair.quaternion', idleTimes, [[0, 0, 0], [0, 0, 0.018], [0, 0, 0], [0, 0, -0.014], [0, 0, 0]]),
  ]);

  const walk = new THREE.AnimationClip('walk', 1, [
    positionTrack('Rig.position', walkTimes, [[0, 0, 0], [0, 0.025, 0], [0, 0, 0], [0, 0.025, 0], [0, 0, 0]]),
    rotationTrack('Chest.quaternion', walkTimes, [[0, 0, 0], [0, 0, -0.03], [0, 0, 0], [0, 0, 0.03], [0, 0, 0]]),
    rotationTrack('Head.quaternion', walkTimes, [[0, 0, 0], [0, 0, 0.015], [0, 0, 0], [0, 0, -0.015], [0, 0, 0]]),
    rotationTrack('LeftUpperLeg.quaternion', walkTimes, [[0.18, 0, 0], [-0.42, 0, 0], [0.18, 0, 0], [0.5, 0, 0], [0.18, 0, 0]]),
    rotationTrack('RightUpperLeg.quaternion', walkTimes, [[-0.42, 0, 0], [0.18, 0, 0], [0.5, 0, 0], [0.18, 0, 0], [-0.42, 0, 0]]),
    rotationTrack('LeftLowerLeg.quaternion', walkTimes, [[0.12, 0, 0], [0.42, 0, 0], [0.08, 0, 0], [0, 0, 0], [0.12, 0, 0]]),
    rotationTrack('RightLowerLeg.quaternion', walkTimes, [[0.42, 0, 0], [0.08, 0, 0], [0, 0, 0], [0.12, 0, 0], [0.42, 0, 0]]),
    rotationTrack('LeftUpperArm.quaternion', walkTimes, [[-0.45, 0, 0], [0.24, 0, 0], [-0.45, 0, 0], [0.22, 0, 0], [-0.45, 0, 0]]),
    rotationTrack('RightUpperArm.quaternion', walkTimes, [[0.24, 0, 0], [-0.45, 0, 0], [0.22, 0, 0], [-0.45, 0, 0], [0.24, 0, 0]]),
    rotationTrack('Hair.quaternion', walkTimes, [[0, 0, 0], [0, 0, 0.035], [0, 0, 0], [0, 0, -0.035], [0, 0, 0]]),
  ]);

  if (spec.id === 'lyra') {
    walk.tracks.push(rotationTrack('Skirt.quaternion', walkTimes, [[0, 0, 0], [0, 0, 0.022], [0, 0, 0], [0, 0, -0.022], [0, 0, 0]]));
  }

  idle.optimize();
  walk.optimize();
  return [idle, walk];
}

function positionTrack(path, times, vectors) {
  return new THREE.VectorKeyframeTrack(path, times, vectors.flat());
}

function rotationTrack(path, times, rotations) {
  const values = [];
  for (const rotation of rotations) {
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    values.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  }
  return new THREE.QuaternionKeyframeTrack(path, times, values);
}

function normalizeHeight(root, targetHeight) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const height = Math.max(0.001, box.max.y - box.min.y);
  const scale = targetHeight / height;
  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);
  const scaled = new THREE.Box3().setFromObject(root);
  root.position.y -= scaled.min.y;
}

async function exportGLB(root, clips, outPath) {
  const exporter = new GLTFExporter();
  const result = await new Promise((resolveResult, rejectResult) => {
    exporter.parse(
      root,
      resolveResult,
      rejectResult,
      {
        animations: clips,
        binary: true,
        forcePowerOfTwoTextures: false,
        includeCustomExtensions: false,
        onlyVisible: true,
        trs: true,
      },
    );
  });

  const buffer = result instanceof ArrayBuffer
    ? Buffer.from(result)
    : Buffer.from(JSON.stringify(result));
  await writeFile(outPath, buffer);
}

await mkdir(OUT_DIR, { recursive: true });

for (const spec of Object.values(specs)) {
  const { root, clips } = buildCharacter(spec);
  const outPath = resolve(OUT_DIR, `${spec.id}.glb`);
  await exportGLB(root, clips, outPath);
  console.log(`generated ${outPath}`);
}
