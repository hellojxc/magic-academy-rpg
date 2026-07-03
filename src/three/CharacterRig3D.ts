import * as THREE from 'three';

export type CharacterKind = 'player' | 'lyra';

interface RigParts {
  body: THREE.Group;
  chest: THREE.Group;
  head: THREE.Group;
  hair: THREE.Group;
  leftUpperArm: THREE.Group;
  leftForearm: THREE.Group;
  leftHand: THREE.Group;
  rightUpperArm: THREE.Group;
  rightForearm: THREE.Group;
  rightHand: THREE.Group;
  leftThigh: THREE.Group;
  leftShin: THREE.Group;
  leftFoot: THREE.Group;
  rightThigh: THREE.Group;
  rightShin: THREE.Group;
  rightFoot: THREE.Group;
  hairStrands: THREE.Group[];
  capePanels: THREE.Group[];
  skirtPanels: THREE.Group[];
  braidSegments: THREE.Group[];
  cape?: THREE.Group;
  skirt?: THREE.Group;
  book?: THREE.Group;
  wand?: THREE.Group;
}

interface CharacterPalette {
  skin: THREE.MeshToonMaterial;
  skinWarm: THREE.MeshToonMaterial;
  blush: THREE.MeshToonMaterial;
  hair: THREE.MeshToonMaterial;
  hairShade: THREE.MeshToonMaterial;
  outfit: THREE.MeshToonMaterial;
  outfitDark: THREE.MeshToonMaterial;
  clothLight: THREE.MeshToonMaterial;
  gold: THREE.MeshToonMaterial;
  dark: THREE.MeshToonMaterial;
  eye: THREE.MeshToonMaterial;
  pupil: THREE.MeshToonMaterial;
  accent: THREE.MeshToonMaterial;
  white: THREE.MeshToonMaterial;
  outline: THREE.MeshBasicMaterial;
}

type Vec3 = [number, number, number];

export class CharacterRig3D {
  readonly root = new THREE.Group();
  private readonly parts: RigParts;
  private moving = false;
  private movementBlend = 0;

  private static toonGradient: THREE.DataTexture | undefined;

  constructor(private readonly kind: CharacterKind) {
    const palette = this.createPalette(kind);
    this.parts = this.buildRig(palette);
    this.root.userData.characterKind = kind;
  }

  setMoving(moving: boolean): void {
    this.moving = moving;
  }

  update(elapsedTime: number): void {
    this.movementBlend = THREE.MathUtils.lerp(this.movementBlend, this.moving ? 1 : 0, 0.14);
    const walk = Math.sin(elapsedTime * 8.4);
    const walkOpposite = Math.sin(elapsedTime * 8.4 + Math.PI);
    const walkCos = Math.cos(elapsedTime * 8.4);
    const idle = Math.sin(elapsedTime * 1.55);
    const breathe = Math.sin(elapsedTime * 2.35);
    const soft = Math.sin(elapsedTime * 0.9);
    const blend = this.movementBlend;
    const idleBlend = 1 - blend;

    this.root.position.y = Math.abs(walkCos) * 0.032 * blend + breathe * 0.011 * idleBlend;
    this.parts.body.rotation.x = -0.015 + Math.abs(walkCos) * 0.03 * blend;
    this.parts.body.rotation.z = walk * 0.022 * blend + idle * 0.01 * idleBlend;
    this.parts.chest.rotation.x = -0.03 + Math.abs(walkCos) * 0.025 * blend + breathe * 0.015 * idleBlend;
    this.parts.chest.rotation.y = walk * 0.035 * blend;
    this.parts.chest.rotation.z = -walk * 0.022 * blend + soft * 0.012 * idleBlend;
    this.parts.head.rotation.x = -Math.abs(walkCos) * 0.02 * blend + breathe * 0.012 * idleBlend;
    this.parts.head.rotation.y = soft * (this.kind === 'lyra' ? 0.052 : 0.034) * idleBlend;
    this.parts.head.rotation.z = -walk * 0.016 * blend;

    if (this.kind === 'player') {
      this.animatePlayer(walk, walkOpposite, walkCos, breathe, blend, idleBlend);
    } else {
      this.animateLyra(breathe, soft);
    }

    this.animateSecondaryMotion(elapsedTime, walk, breathe, blend);
  }

  private animatePlayer(
    walk: number,
    walkOpposite: number,
    walkCos: number,
    breathe: number,
    blend: number,
    idleBlend: number
  ): void {
    this.parts.leftThigh.rotation.x = 0.03 + walk * 0.58 * blend;
    this.parts.rightThigh.rotation.x = 0.03 + walkOpposite * 0.58 * blend;
    this.parts.leftThigh.rotation.z = -0.035 + walkCos * 0.025 * blend;
    this.parts.rightThigh.rotation.z = 0.035 - walkCos * 0.025 * blend;
    this.parts.leftShin.rotation.x = Math.max(0, -walk) * 0.58 * blend;
    this.parts.rightShin.rotation.x = Math.max(0, walk) * 0.58 * blend;
    this.parts.leftFoot.rotation.x = -0.06 + Math.max(0, walk) * 0.22 * blend - Math.max(0, -walk) * 0.12 * blend;
    this.parts.rightFoot.rotation.x = -0.06 + Math.max(0, -walk) * 0.22 * blend - Math.max(0, walk) * 0.12 * blend;

    this.parts.leftUpperArm.rotation.x = -0.14 + walkOpposite * 0.46 * blend + breathe * 0.018 * idleBlend;
    this.parts.rightUpperArm.rotation.x = -0.14 + walk * 0.46 * blend - breathe * 0.018 * idleBlend;
    this.parts.leftUpperArm.rotation.z = -0.19 - Math.abs(walk) * 0.035 * blend;
    this.parts.rightUpperArm.rotation.z = 0.17 + Math.abs(walk) * 0.035 * blend;
    this.parts.leftForearm.rotation.x = -0.26 - Math.max(0, walk) * 0.15 * blend;
    this.parts.rightForearm.rotation.x = -0.18 - Math.max(0, walkOpposite) * 0.12 * blend;
    this.parts.leftHand.rotation.z = -0.04 + walk * 0.045 * blend;
    this.parts.rightHand.rotation.z = 0.05 + walkOpposite * 0.045 * blend;

    if (this.parts.wand) {
      this.parts.wand.rotation.x = 0.08 + walkOpposite * 0.05 * blend;
      this.parts.wand.rotation.z = 0.18 + breathe * 0.02 + walk * 0.025 * blend;
    }
  }

  private animateLyra(breathe: number, soft: number): void {
    this.parts.leftThigh.rotation.x = -0.04 + breathe * 0.01;
    this.parts.rightThigh.rotation.x = 0.035 - breathe * 0.008;
    this.parts.leftShin.rotation.x = 0.04;
    this.parts.rightShin.rotation.x = -0.02;
    this.parts.leftFoot.rotation.y = -0.1 + soft * 0.012;
    this.parts.rightFoot.rotation.y = 0.08 - soft * 0.012;

    this.parts.leftUpperArm.rotation.x = -0.34 + breathe * 0.02;
    this.parts.leftUpperArm.rotation.y = -0.18 + soft * 0.012;
    this.parts.leftUpperArm.rotation.z = -0.78 + breathe * 0.016;
    this.parts.leftForearm.rotation.x = -1.03 + breathe * 0.018;
    this.parts.leftForearm.rotation.z = 0.42;

    this.parts.rightUpperArm.rotation.x = -0.42 - breathe * 0.018;
    this.parts.rightUpperArm.rotation.y = 0.2 - soft * 0.012;
    this.parts.rightUpperArm.rotation.z = 0.74 - breathe * 0.014;
    this.parts.rightForearm.rotation.x = -1.08 - breathe * 0.015;
    this.parts.rightForearm.rotation.z = -0.38;

    if (this.parts.book) {
      this.parts.book.position.y = -0.04 + breathe * 0.012;
      this.parts.book.rotation.x = -0.1 + breathe * 0.012;
      this.parts.book.rotation.z = soft * 0.012;
    }
  }

  private animateSecondaryMotion(elapsedTime: number, walk: number, breathe: number, blend: number): void {
    this.parts.hair.rotation.x = -0.02 - blend * 0.045 + breathe * 0.012;
    this.parts.hair.rotation.z = Math.sin(elapsedTime * 1.9) * 0.018 + walk * 0.02 * blend;

    this.parts.hairStrands.forEach((strand, index) => {
      const base = strand.userData.baseRotation as THREE.Euler;
      strand.rotation.set(
        base.x - blend * (0.07 + index * 0.002) + Math.sin(elapsedTime * 2.1 + index) * 0.016,
        base.y + walk * blend * 0.018 + Math.sin(elapsedTime * 1.25 + index * 0.6) * 0.014,
        base.z + Math.sin(elapsedTime * 1.7 + index * 0.55) * 0.018
      );
    });

    this.parts.braidSegments.forEach((segment, index) => {
      const base = segment.userData.baseRotation as THREE.Euler;
      segment.rotation.set(
        base.x + Math.sin(elapsedTime * 1.8 + index * 0.35) * 0.018,
        base.y,
        base.z + Math.sin(elapsedTime * 1.4 + index * 0.65) * 0.03
      );
    });

    this.parts.capePanels.forEach((panel, index) => {
      const base = panel.userData.baseRotation as THREE.Euler;
      panel.rotation.set(
        base.x - Math.abs(walk) * 0.18 * blend + Math.sin(elapsedTime * 2.0 + index) * 0.024,
        base.y + walk * 0.025 * blend,
        base.z + Math.sin(elapsedTime * 1.35 + index * 0.75) * 0.035
      );
    });

    this.parts.skirtPanels.forEach((panel, index) => {
      const base = panel.userData.baseRotation as THREE.Euler;
      panel.rotation.set(
        base.x + Math.sin(elapsedTime * 1.6 + index) * 0.012,
        base.y,
        base.z + Math.sin(elapsedTime * 1.45 + index * 0.6) * 0.016
      );
    });
  }

  private buildRig(palette: CharacterPalette): RigParts {
    const body = new THREE.Group();
    const chest = new THREE.Group();
    const head = new THREE.Group();
    const hair = new THREE.Group();
    const leftUpperArm = new THREE.Group();
    const leftForearm = new THREE.Group();
    const leftHand = new THREE.Group();
    const rightUpperArm = new THREE.Group();
    const rightForearm = new THREE.Group();
    const rightHand = new THREE.Group();
    const leftThigh = new THREE.Group();
    const leftShin = new THREE.Group();
    const leftFoot = new THREE.Group();
    const rightThigh = new THREE.Group();
    const rightShin = new THREE.Group();
    const rightFoot = new THREE.Group();
    const hairStrands: THREE.Group[] = [];
    const capePanels: THREE.Group[] = [];
    const skirtPanels: THREE.Group[] = [];
    const braidSegments: THREE.Group[] = [];

    this.root.scale.setScalar(this.kind === 'player' ? 1.02 : 1.0);
    this.root.add(body);
    body.add(chest, leftThigh, rightThigh);
    chest.position.set(0, 1.16, 0);
    leftThigh.position.set(-0.14, 0.98, 0.02);
    rightThigh.position.set(0.14, 0.98, 0.02);

    this.addPelvis(body, palette);
    this.addLeg(leftThigh, leftShin, leftFoot, -1, palette);
    this.addLeg(rightThigh, rightShin, rightFoot, 1, palette);
    this.addTorso(chest, palette);
    this.addShouldersAndArms(chest, leftUpperArm, leftForearm, leftHand, rightUpperArm, rightForearm, rightHand, palette);

    head.position.set(0, 0.74, -0.01);
    chest.add(head);
    this.addHead(head, hair, hairStrands, braidSegments, palette);

    let cape: THREE.Group | undefined;
    let skirt: THREE.Group | undefined;
    let book: THREE.Group | undefined;
    let wand: THREE.Group | undefined;
    if (this.kind === 'player') {
      cape = this.addPlayerCape(chest, capePanels, palette);
      wand = this.addPlayerWand(rightHand, palette);
    } else {
      skirt = this.addLyraSkirt(body, skirtPanels, palette);
      book = this.addLyraBook(chest, palette);
    }

    const groundRing = this.addMesh(
      this.root,
      new THREE.TorusGeometry(0.48, 0.01, 10, 52),
      palette.gold,
      [0, 0.035, 0],
      [Math.PI / 2, 0, 0],
      [1, 1, 1],
      false
    );
    groundRing.castShadow = false;
    groundRing.receiveShadow = false;

    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    return {
      body,
      chest,
      head,
      hair,
      leftUpperArm,
      leftForearm,
      leftHand,
      rightUpperArm,
      rightForearm,
      rightHand,
      leftThigh,
      leftShin,
      leftFoot,
      rightThigh,
      rightShin,
      rightFoot,
      hairStrands,
      capePanels,
      skirtPanels,
      braidSegments,
      cape,
      skirt,
      book,
      wand,
    };
  }

  private addPelvis(body: THREE.Group, palette: CharacterPalette): void {
    this.addMesh(
      body,
      new THREE.SphereGeometry(0.245, 28, 16),
      this.kind === 'player' ? palette.outfitDark : palette.clothLight,
      [0, 0.91, 0.02],
      [0, 0, 0],
      [1.15, 0.72, 0.86]
    );

    if (this.kind === 'player') {
      this.addMesh(body, new THREE.BoxGeometry(0.56, 0.06, 0.07), palette.gold, [0, 0.93, -0.235], [0, 0, 0], [1, 1, 1]);
      this.addMesh(body, new THREE.BoxGeometry(0.11, 0.09, 0.08), palette.dark, [0, 0.93, -0.275], [0, 0, 0], [1, 1, 1]);
    }
  }

  private addTorso(chest: THREE.Group, palette: CharacterPalette): void {
    this.addMesh(
      chest,
      new THREE.CapsuleGeometry(0.255, 0.5, 14, 24),
      palette.outfit,
      [0, 0.03, 0],
      [0, 0, 0],
      [this.kind === 'lyra' ? 1.0 : 1.06, 1.05, 0.78]
    );
    this.addMesh(
      chest,
      new THREE.CapsuleGeometry(0.205, 0.47, 12, 22),
      palette.clothLight,
      [0, 0.055, -0.225],
      [0, 0, 0],
      [0.88, 1.0, 0.2],
      true,
      1.018
    );

    this.addUniformDetails(chest, palette);

    const collarLeft = this.addMesh(chest, new THREE.BoxGeometry(0.18, 0.08, 0.035), palette.clothLight, [-0.11, 0.37, -0.245], [0, 0, -0.34], [1, 1, 1]);
    const collarRight = collarLeft.clone();
    collarRight.material = palette.clothLight;
    collarRight.position.x = 0.11;
    collarRight.rotation.z = 0.34;
    chest.add(collarRight);

    this.addMesh(chest, new THREE.CylinderGeometry(0.07, 0.09, 0.14, 20), palette.skin, [0, 0.47, -0.005], [0, 0, 0], [0.78, 1, 0.78]);
  }

  private addUniformDetails(chest: THREE.Group, palette: CharacterPalette): void {
    const leftPanel = this.addMesh(chest, new THREE.BoxGeometry(0.13, 0.54, 0.04), palette.outfitDark, [-0.095, 0.035, -0.257], [0, 0, -0.11], [1, 1, 1]);
    const rightPanel = leftPanel.clone();
    rightPanel.material = palette.outfitDark;
    rightPanel.position.x = 0.095;
    rightPanel.rotation.z = 0.11;
    chest.add(rightPanel);

    const leftTrim = this.addMesh(chest, new THREE.BoxGeometry(0.032, 0.58, 0.026), palette.gold, [-0.18, 0.04, -0.29], [0, 0, -0.28], [1, 1, 1], false);
    const rightTrim = leftTrim.clone();
    rightTrim.material = palette.gold;
    rightTrim.position.x = 0.18;
    rightTrim.rotation.z = 0.28;
    chest.add(rightTrim);

    if (this.kind === 'player') {
      this.addTie(chest, palette, 0.28, 0.12);
      this.addStar(chest, new THREE.Vector3(-0.22, 0.2, -0.312), 0.053, palette.gold);
      this.addStar(chest, new THREE.Vector3(0.21, 0.0, -0.312), 0.041, palette.gold);
      this.addChain(chest, palette.gold);
      this.addMesh(chest, new THREE.SphereGeometry(0.035, 14, 10), palette.gold, [-0.05, -0.17, -0.31], [0, 0, 0], [1, 1, 0.45], false);
      this.addMesh(chest, new THREE.SphereGeometry(0.035, 14, 10), palette.gold, [-0.05, -0.28, -0.31], [0, 0, 0], [1, 1, 0.45], false);
    } else {
      this.addBow(chest, palette);
      this.addStar(chest, new THREE.Vector3(0, 0.22, -0.335), 0.058, palette.gold);
      this.addMesh(chest, new THREE.BoxGeometry(0.5, 0.052, 0.032), palette.gold, [0, -0.2, -0.305], [0, 0, 0], [1, 1, 1], false);
    }
  }

  private addShouldersAndArms(
    chest: THREE.Group,
    leftUpperArm: THREE.Group,
    leftForearm: THREE.Group,
    leftHand: THREE.Group,
    rightUpperArm: THREE.Group,
    rightForearm: THREE.Group,
    rightHand: THREE.Group,
    palette: CharacterPalette
  ): void {
    const shoulderY = 0.32;
    leftUpperArm.position.set(-0.315, shoulderY, -0.005);
    rightUpperArm.position.set(0.315, shoulderY, -0.005);
    chest.add(leftUpperArm, rightUpperArm);

    this.addArm(leftUpperArm, leftForearm, leftHand, -1, palette);
    this.addArm(rightUpperArm, rightForearm, rightHand, 1, palette);

    if (this.kind === 'player') {
      leftUpperArm.rotation.set(-0.14, 0, -0.19);
      rightUpperArm.rotation.set(-0.12, 0, 0.17);
    } else {
      leftUpperArm.rotation.set(-0.34, -0.18, -0.78);
      rightUpperArm.rotation.set(-0.42, 0.2, 0.74);
    }

    this.addMesh(chest, new THREE.SphereGeometry(0.13, 20, 12), palette.outfitDark, [-0.325, shoulderY, -0.005], [0, 0, 0], [1.22, 0.54, 0.86]);
    this.addMesh(chest, new THREE.SphereGeometry(0.13, 20, 12), palette.outfitDark, [0.325, shoulderY, -0.005], [0, 0, 0], [1.22, 0.54, 0.86]);
    this.addMesh(chest, new THREE.TorusGeometry(0.118, 0.008, 8, 28), palette.gold, [-0.325, shoulderY, -0.005], [Math.PI / 2, 0, 0.1], [1.2, 0.72, 1], false);
    this.addMesh(chest, new THREE.TorusGeometry(0.118, 0.008, 8, 28), palette.gold, [0.325, shoulderY, -0.005], [Math.PI / 2, 0, -0.1], [1.2, 0.72, 1], false);
  }

  private addArm(
    upperArm: THREE.Group,
    forearm: THREE.Group,
    hand: THREE.Group,
    side: -1 | 1,
    palette: CharacterPalette
  ): void {
    const upperLength = 0.42;
    const lowerLength = 0.38;
    const sleeveMat = this.kind === 'lyra' ? palette.clothLight : palette.outfit;

    this.addMesh(upperArm, new THREE.CapsuleGeometry(0.055, upperLength, 12, 18), sleeveMat, [0, -upperLength / 2, 0], [0, 0, 0], [0.82, 1, 0.78]);
    this.addMesh(upperArm, new THREE.TorusGeometry(0.063, 0.006, 8, 22), palette.gold, [0, -0.08, -0.002], [Math.PI / 2, 0, 0], [1, 1, 1], false);

    forearm.position.set(side * 0.012, -upperLength, -0.005);
    upperArm.add(forearm);

    this.addMesh(forearm, new THREE.CapsuleGeometry(0.05, lowerLength, 12, 18), sleeveMat, [0, -lowerLength / 2, 0], [0, 0, 0], [0.78, 1, 0.74]);
    this.addMesh(forearm, new THREE.TorusGeometry(0.057, 0.008, 8, 22), palette.gold, [0, -lowerLength + 0.045, 0], [Math.PI / 2, 0, 0], [1, 1, 1], false);

    hand.position.set(side * 0.006, -lowerLength - 0.045, -0.012);
    forearm.add(hand);
    this.addMesh(hand, new THREE.SphereGeometry(0.055, 18, 12), palette.skin, [0, 0, 0], [0, 0, 0], [0.88, 0.68, 0.82]);
    this.addMesh(hand, new THREE.CapsuleGeometry(0.012, 0.08, 6, 8), palette.skinWarm, [side * 0.035, -0.025, -0.014], [0.25, 0, side * 0.45], [1, 1, 0.8], false);
    for (let i = 0; i < 3; i += 1) {
      this.addMesh(hand, new THREE.CapsuleGeometry(0.008, 0.058, 5, 7), palette.skinWarm, [side * (-0.016 + i * 0.015), -0.048, -0.026], [0.18, 0, side * (0.08 - i * 0.04)], [1, 1, 0.7], false);
    }
  }

  private addLeg(
    upperLeg: THREE.Group,
    lowerLeg: THREE.Group,
    foot: THREE.Group,
    side: -1 | 1,
    palette: CharacterPalette
  ): void {
    const upperLength = 0.49;
    const lowerLength = 0.54;
    const legMat = this.kind === 'player' ? palette.outfitDark : palette.clothLight;

    this.addMesh(upperLeg, new THREE.CapsuleGeometry(0.063, upperLength, 12, 18), legMat, [0, -upperLength / 2, 0], [0, 0, 0], [0.82, 1, 0.72]);
    lowerLeg.position.set(side * 0.012, -upperLength, -0.005);
    upperLeg.add(lowerLeg);
    this.addMesh(lowerLeg, new THREE.CapsuleGeometry(0.052, lowerLength, 12, 18), legMat, [0, -lowerLength / 2, 0], [0, 0, 0], [0.78, 1, 0.68]);

    foot.position.set(0, -lowerLength - 0.045, -0.055);
    lowerLeg.add(foot);
    this.addMesh(foot, new THREE.SphereGeometry(0.092, 20, 12), palette.dark, [0, 0, -0.065], [0, 0, 0], [0.72, 0.34, 1.34]);
    this.addMesh(foot, new THREE.BoxGeometry(0.12, 0.025, 0.22), palette.gold, [0, 0.018, -0.06], [0, 0, 0], [1, 1, 1], false);
  }

  private addHead(
    head: THREE.Group,
    hair: THREE.Group,
    hairStrands: THREE.Group[],
    braidSegments: THREE.Group[],
    palette: CharacterPalette
  ): void {
    this.addMesh(head, new THREE.SphereGeometry(0.225, 42, 26), palette.skin, [0, 0, 0], [0, 0, 0], [0.9, 1.05, 0.78]);
    this.addMesh(head, new THREE.SphereGeometry(0.038, 16, 10), palette.skinWarm, [-0.198, -0.012, -0.003], [0, 0, 0], [0.52, 0.82, 0.38]);
    this.addMesh(head, new THREE.SphereGeometry(0.038, 16, 10), palette.skinWarm, [0.198, -0.012, -0.003], [0, 0, 0], [0.52, 0.82, 0.38]);

    hair.position.set(0, 0.015, 0.015);
    head.add(hair);

    this.addMesh(
      hair,
      new THREE.SphereGeometry(0.252, 42, 18, 0, Math.PI * 2, 0, Math.PI * 0.68),
      palette.hair,
      [0, 0.08, 0.015],
      [0, 0, 0],
      [1.0, 0.84, 0.92]
    );
    this.addMesh(
      hair,
      new THREE.SphereGeometry(0.222, 34, 16, 0, Math.PI * 2, Math.PI * 0.25, Math.PI * 0.55),
      palette.hairShade,
      [0, -0.005, 0.085],
      [0.08, 0, 0],
      [1.06, 0.86, 0.88]
    );

    if (this.kind === 'player') {
      this.addPlayerHair(hair, hairStrands, palette);
    } else {
      this.addLyraHair(hair, hairStrands, braidSegments, palette);
    }

    this.addAnimeFace(head, palette);
  }

  private addAnimeFace(head: THREE.Group, palette: CharacterPalette): void {
    for (const side of [-1, 1] as const) {
      const eyeX = side * 0.068;
      this.addMesh(head, new THREE.SphereGeometry(0.042, 24, 14), palette.white, [eyeX, 0.036, -0.195], [0, 0, side * 0.05], [1.32, 0.9, 0.12], false);
      this.addMesh(head, new THREE.SphereGeometry(0.026, 22, 12), palette.eye, [eyeX + side * 0.005, 0.033, -0.204], [0, 0, 0], [0.95, 1.12, 0.08], false);
      this.addMesh(head, new THREE.SphereGeometry(0.013, 14, 8), palette.pupil, [eyeX + side * 0.006, 0.028, -0.211], [0, 0, 0], [0.74, 1.0, 0.05], false);
      this.addMesh(head, new THREE.SphereGeometry(0.0065, 10, 6), palette.white, [eyeX - side * 0.009, 0.046, -0.215], [0, 0, 0], [1, 1, 0.035], false);
      this.addMesh(head, new THREE.BoxGeometry(0.07, 0.01, 0.01), palette.hairShade, [eyeX, 0.084, -0.199], [0, 0, side * 0.15], [1, 1, 1], false);
      this.addMesh(head, new THREE.SphereGeometry(0.026, 16, 8), palette.blush, [side * 0.11, -0.032, -0.196], [0, 0, 0], [1.35, 0.48, 0.07], false);
    }

    this.addMesh(head, new THREE.SphereGeometry(0.016, 14, 8), palette.skinWarm, [0, -0.018, -0.207], [0, 0, 0], [0.55, 0.8, 0.16], false);
    this.addMesh(head, new THREE.TorusGeometry(0.026, 0.0024, 6, 18, Math.PI), palette.accent, [0.006, -0.084, -0.199], [0, 0, Math.PI * 1.05], [1, 0.42, 1], false);
  }

  private addPlayerHair(hair: THREE.Group, hairStrands: THREE.Group[], palette: CharacterPalette): void {
    const bangs: Array<[number, number, number, number, number, number]> = [
      [-0.18, 0.16, -0.17, 0.2, -0.05, -0.5],
      [-0.075, 0.155, -0.205, 0.245, -0.02, -0.22],
      [0.035, 0.155, -0.212, 0.22, 0.02, 0.08],
      [0.145, 0.15, -0.188, 0.215, 0.04, 0.34],
      [0.225, 0.12, -0.11, 0.19, 0.08, 0.68],
    ];
    bangs.forEach(([x, y, z, length, rx, rz], index) => {
      const lock = this.createHairLock(palette, 0.055 + (index % 2) * 0.012, length);
      lock.position.set(x, y, z);
      lock.rotation.set(rx, 0, rz);
      hair.add(lock);
      this.rememberBaseRotation(lock);
      hairStrands.push(lock);
    });

    for (let i = 0; i < 10; i += 1) {
      const angle = -1.1 + i * 0.24;
      const lock = this.createHairLock(palette, 0.042, 0.2 + (i % 3) * 0.035);
      lock.position.set(Math.sin(angle) * 0.25, 0.035 + Math.cos(angle) * 0.035, Math.cos(angle) * 0.16 + 0.055);
      lock.rotation.set(0.18, 0.12 * Math.sin(angle), Math.sin(angle) * 0.58);
      hair.add(lock);
      this.rememberBaseRotation(lock);
      hairStrands.push(lock);
    }

    const crownTufts: Array<[number, number, number, number, number]> = [
      [-0.12, 0.22, 0.01, -0.42, 0.13],
      [0.02, 0.24, -0.005, -0.05, 0.11],
      [0.14, 0.21, 0.015, 0.34, 0.12],
    ];
    for (const [x, y, z, rz, length] of crownTufts) {
      const tuft = this.createHairLock(palette, 0.03, length);
      tuft.position.set(x, y, z);
      tuft.rotation.set(-0.55, 0.16, rz);
      hair.add(tuft);
      this.rememberBaseRotation(tuft);
      hairStrands.push(tuft);
    }
  }

  private addLyraHair(
    hair: THREE.Group,
    hairStrands: THREE.Group[],
    braidSegments: THREE.Group[],
    palette: CharacterPalette
  ): void {
    const frontLocks: Array<[number, number, number, number, number]> = [
      [-0.18, 0.12, -0.17, 0.44, -0.36],
      [-0.07, 0.105, -0.21, 0.36, -0.08],
      [0.065, 0.11, -0.205, 0.34, 0.08],
      [0.18, 0.105, -0.16, 0.4, 0.34],
    ];
    frontLocks.forEach(([x, y, z, length, rz]) => {
      const lock = this.createHairLock(palette, 0.048, length);
      lock.position.set(x, y, z);
      lock.rotation.set(0.08, 0, rz);
      hair.add(lock);
      this.rememberBaseRotation(lock);
      hairStrands.push(lock);
    });

    for (let i = 0; i < 14; i += 1) {
      const side = i < 7 ? -1 : 1;
      const local = i % 7;
      const strand = new THREE.Group();
      strand.position.set(side * (0.18 + local * 0.025), -0.08 - local * 0.012, 0.07 + local * 0.015);
      strand.rotation.set(0.14 + local * 0.018, side * (0.12 + local * 0.025), side * (0.16 + local * 0.035));
      hair.add(strand);
      this.rememberBaseRotation(strand);
      hairStrands.push(strand);

      this.addMesh(
        strand,
        new THREE.CapsuleGeometry(0.032 + local * 0.002, 0.72 + local * 0.075, 10, 16),
        local % 2 === 0 ? palette.hair : palette.hairShade,
        [0, -0.36 - local * 0.035, 0],
        [0, 0, 0],
        [0.78, 1, 0.58]
      );
    }

    const braidRoot = new THREE.Group();
    braidRoot.position.set(0.25, 0.02, 0.105);
    braidRoot.rotation.set(0.12, 0.2, -0.22);
    hair.add(braidRoot);
    this.rememberBaseRotation(braidRoot);
    hairStrands.push(braidRoot);
    for (let i = 0; i < 6; i += 1) {
      const bead = new THREE.Group();
      bead.position.set(Math.sin(i * 1.2) * 0.018, -i * 0.08, 0);
      braidRoot.add(bead);
      this.rememberBaseRotation(bead);
      braidSegments.push(bead);
      this.addMesh(bead, new THREE.SphereGeometry(0.055, 18, 10), palette.hairShade, [0, 0, 0], [0, 0, 0], [1.12, 0.78, 0.9]);
    }

    const ribbonLeft = this.addMesh(hair, this.createClothPanelGeometry(0.03, 0.085, 0.25), palette.accent, [0.36, -0.04, 0.08], [0.1, -0.18, -0.86], [1, 1, 1]);
    const ribbonRight = ribbonLeft.clone();
    ribbonRight.material = palette.accent;
    ribbonRight.position.set(0.36, -0.08, 0.08);
    ribbonRight.rotation.set(0.1, -0.18, -2.18);
    hair.add(ribbonRight);
    this.addStar(hair, new THREE.Vector3(0.22, 0.12, -0.19), 0.052, palette.gold);
  }

  private addPlayerCape(chest: THREE.Group, capePanels: THREE.Group[], palette: CharacterPalette): THREE.Group {
    const cape = new THREE.Group();
    cape.position.set(0, 0.3, 0.23);
    cape.rotation.x = -0.08;
    chest.add(cape);

    const panels: Array<[number, number, number, number, number]> = [
      [0, 0, 0, 0.72, 0],
      [-0.22, -0.04, 0.03, 0.62, -0.12],
      [0.22, -0.04, 0.03, 0.62, 0.12],
    ];
    for (const [x, y, z, height, rz] of panels) {
      const panel = new THREE.Group();
      panel.position.set(x, y, z);
      panel.rotation.set(-0.08, 0, rz);
      cape.add(panel);
      this.rememberBaseRotation(panel);
      capePanels.push(panel);
      this.addMesh(panel, this.createClothPanelGeometry(0.14, 0.2, height), palette.outfitDark, [0, -0.04, 0], [0, 0, 0], [1, 1, 1], true, 1.015);
      this.addMesh(panel, new THREE.BoxGeometry(0.03, height * 0.88, 0.018), palette.gold, [0.18 * Math.sign(x || 1), -height * 0.42, -0.006], [0, 0, 0], [1, 1, 1], false);
    }

    this.addMesh(cape, new THREE.BoxGeometry(0.58, 0.035, 0.055), palette.gold, [0, 0.015, -0.01], [0, 0, 0], [1, 1, 1], false);
    return cape;
  }

  private addLyraSkirt(body: THREE.Group, skirtPanels: THREE.Group[], palette: CharacterPalette): THREE.Group {
    const skirt = new THREE.Group();
    skirt.position.set(0, 0.83, -0.005);
    body.add(skirt);

    this.addMesh(skirt, new THREE.ConeGeometry(0.42, 0.5, 36, 1, true), palette.clothLight, [0, -0.22, 0], [0, 0, 0], [1.0, 1, 0.86]);
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      const panel = new THREE.Group();
      panel.position.set(Math.sin(angle) * 0.19, -0.03, Math.cos(angle) * 0.19);
      panel.rotation.set(0.16, angle, i % 2 === 0 ? 0.03 : -0.03);
      skirt.add(panel);
      this.rememberBaseRotation(panel);
      skirtPanels.push(panel);
      this.addMesh(
        panel,
        this.createClothPanelGeometry(0.04, 0.08, 0.42),
        i % 2 === 0 ? palette.clothLight : palette.outfit,
        [0, -0.08, 0],
        [0, 0, 0],
        [1, 1, 1],
        i % 3 === 0
      );
      if (i % 3 === 0) {
        this.addMesh(panel, new THREE.BoxGeometry(0.016, 0.34, 0.012), palette.gold, [0.055, -0.24, -0.003], [0, 0, 0], [1, 1, 1], false);
      }
    }
    return skirt;
  }

  private addPlayerWand(hand: THREE.Group, palette: CharacterPalette): THREE.Group {
    const wand = new THREE.Group();
    wand.position.set(0.015, -0.02, -0.04);
    wand.rotation.set(0.08, 0.12, 0.18);
    hand.add(wand);

    this.addMesh(wand, new THREE.CylinderGeometry(0.012, 0.018, 0.58, 12), palette.dark, [0, -0.25, -0.02], [0.2, 0, 0], [1, 1, 1]);
    this.addMesh(wand, new THREE.SphereGeometry(0.032, 16, 10), palette.gold, [0, -0.54, -0.08], [0, 0, 0], [1, 1, 1], false);
    this.addStar(wand, new THREE.Vector3(0.0, -0.58, -0.08), 0.04, palette.gold);
    return wand;
  }

  private addLyraBook(chest: THREE.Group, palette: CharacterPalette): THREE.Group {
    const book = new THREE.Group();
    book.position.set(0, -0.05, -0.355);
    book.rotation.set(-0.1, 0, 0);
    chest.add(book);

    const coverMaterial = this.createToonMaterial(0x37212c, 0.48, 0.08);
    const pageMaterial = this.createToonMaterial(0xf0ddb5, 0.68, 0.0);
    this.addMesh(book, new THREE.BoxGeometry(0.48, 0.5, 0.085), coverMaterial, [0, 0, 0], [0, 0, 0], [1, 1, 1]);
    this.addMesh(book, new THREE.BoxGeometry(0.42, 0.42, 0.025), pageMaterial, [0.01, 0, -0.058], [0, 0, 0], [1, 1, 1], false);
    this.addMesh(book, new THREE.BoxGeometry(0.04, 0.48, 0.1), palette.gold, [-0.225, 0, 0.01], [0, 0, 0], [1, 1, 1], false);
    this.addMesh(book, new THREE.BoxGeometry(0.28, 0.018, 0.09), palette.gold, [0.065, 0.18, 0.045], [0, 0, 0], [1, 1, 1], false);
    this.addMesh(book, new THREE.BoxGeometry(0.28, 0.018, 0.09), palette.gold, [0.065, -0.18, 0.045], [0, 0, 0], [1, 1, 1], false);
    this.addStar(book, new THREE.Vector3(0.04, 0, 0.055), 0.078, palette.gold);
    return book;
  }

  private addTie(parent: THREE.Group, palette: CharacterPalette, height: number, width: number): void {
    this.addMesh(parent, new THREE.ConeGeometry(width * 0.45, height, 4), palette.accent, [0, 0.2, -0.32], [0, 0, Math.PI / 4], [0.84, 1.1, 0.28]);
    this.addMesh(parent, new THREE.SphereGeometry(width * 0.25, 14, 8), palette.accent, [0, 0.33, -0.323], [0, 0, 0], [1, 0.78, 0.3], false);
  }

  private addBow(parent: THREE.Group, palette: CharacterPalette): void {
    this.addMesh(parent, this.createClothPanelGeometry(0.025, 0.1, 0.18), palette.accent, [-0.09, 0.27, -0.326], [0, 0, 1.32], [1, 1, 1]);
    this.addMesh(parent, this.createClothPanelGeometry(0.025, 0.1, 0.18), palette.accent, [0.09, 0.27, -0.326], [0, 0, -1.32], [1, 1, 1]);
    this.addMesh(parent, new THREE.SphereGeometry(0.035, 16, 8), palette.gold, [0, 0.27, -0.334], [0, 0, 0], [1, 0.85, 0.5], false);
  }

  private addChain(parent: THREE.Group, material: THREE.Material): void {
    for (let i = 0; i < 9; i += 1) {
      const bead = this.addMesh(parent, new THREE.TorusGeometry(0.019, 0.0035, 5, 10), material, [0.17 + i * 0.023, 0.08 - i * 0.026, -0.321], [Math.PI / 2, 0, i * 0.2], [1, 1, 1], false);
      bead.castShadow = false;
    }
  }

  private addStar(parent: THREE.Object3D, position: THREE.Vector3, radius: number, material: THREE.Material): void {
    const star = this.addMesh(parent, new THREE.OctahedronGeometry(radius, 0), material, [position.x, position.y, position.z], [0, 0, Math.PI / 4], [1, 1, 0.28], false);
    star.castShadow = true;
  }

  private createHairLock(palette: CharacterPalette, radius: number, length: number): THREE.Group {
    const group = new THREE.Group();
    this.addMesh(group, new THREE.ConeGeometry(radius, length, 18), palette.hair, [0, -length / 2, 0], [0, 0, Math.PI], [1, 1, 0.48]);
    this.addMesh(group, new THREE.ConeGeometry(radius * 0.48, length * 0.92, 14), palette.hairShade, [radius * 0.28, -length / 2 + 0.012, -radius * 0.08], [0, 0, Math.PI + 0.04], [1, 1, 0.28], false);
    return group;
  }

  private createClothPanelGeometry(topHalfWidth: number, bottomHalfWidth: number, height: number): THREE.ShapeGeometry {
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

  private addMesh<T extends THREE.BufferGeometry>(
    parent: THREE.Object3D,
    geometry: T,
    material: THREE.Material,
    position: Vec3,
    rotation: Vec3 = [0, 0, 0],
    scale: Vec3 = [1, 1, 1],
    outline = true,
    outlineScale = 1.018
  ): THREE.Mesh<T, THREE.Material> {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    parent.add(mesh);

    if (outline) {
      const outlineMaterial = this.findOutlineMaterial(material);
      if (outlineMaterial) {
        const outlineMesh = new THREE.Mesh(geometry, outlineMaterial);
        outlineMesh.position.copy(mesh.position);
        outlineMesh.rotation.copy(mesh.rotation);
        outlineMesh.scale.set(scale[0] * outlineScale, scale[1] * outlineScale, scale[2] * outlineScale);
        outlineMesh.renderOrder = -1;
        parent.add(outlineMesh);
      }
    }

    return mesh;
  }

  private findOutlineMaterial(material: THREE.Material): THREE.MeshBasicMaterial | undefined {
    const outline = (material.userData.outlineMaterial ?? undefined) as THREE.MeshBasicMaterial | undefined;
    return outline;
  }

  private rememberBaseRotation(group: THREE.Group): void {
    group.userData.baseRotation = group.rotation.clone();
  }

  private createPalette(kind: CharacterKind): CharacterPalette {
    const outline = new THREE.MeshBasicMaterial({ color: kind === 'player' ? 0x15131b : 0x21152e, side: THREE.BackSide });
    const withOutline = (material: THREE.MeshToonMaterial) => {
      material.userData.outlineMaterial = outline;
      return material;
    };

    if (kind === 'player') {
      return {
        skin: withOutline(this.createToonMaterial(0xf0c3a5, 0.45, 0.02)),
        skinWarm: withOutline(this.createToonMaterial(0xe5a98d, 0.48, 0.01)),
        blush: this.createToonMaterial(0xef8f96, 0.5, 0.0, 0.48),
        hair: withOutline(this.createToonMaterial(0x2d2325, 0.34, 0.03)),
        hairShade: withOutline(this.createToonMaterial(0x171216, 0.42, 0.04)),
        outfit: withOutline(this.createToonMaterial(0x263b86, 0.4, 0.05)),
        outfitDark: withOutline(this.createToonMaterial(0x162154, 0.45, 0.07)),
        clothLight: withOutline(this.createToonMaterial(0xf0edf6, 0.5, 0.0)),
        gold: withOutline(this.createToonMaterial(0xd9b260, 0.24, 0.45)),
        dark: withOutline(this.createToonMaterial(0x17131c, 0.42, 0.03)),
        eye: this.createToonMaterial(0x7186c9, 0.18, 0.02),
        pupil: this.createToonMaterial(0x171625, 0.2, 0.0),
        accent: withOutline(this.createToonMaterial(0x8d2834, 0.44, 0.02)),
        white: this.createToonMaterial(0xf7f3ff, 0.36, 0.0),
        outline,
      };
    }

    return {
      skin: withOutline(this.createToonMaterial(0xf7c9bd, 0.42, 0.02)),
      skinWarm: withOutline(this.createToonMaterial(0xebaaa1, 0.48, 0.01)),
      blush: this.createToonMaterial(0xf09aa7, 0.5, 0.0, 0.52),
      hair: withOutline(this.createToonMaterial(0xded9ff, 0.28, 0.02)),
      hairShade: withOutline(this.createToonMaterial(0xa99cdf, 0.36, 0.03)),
      outfit: withOutline(this.createToonMaterial(0x7652bd, 0.42, 0.04)),
      outfitDark: withOutline(this.createToonMaterial(0x4b2d78, 0.48, 0.06)),
      clothLight: withOutline(this.createToonMaterial(0xf3edf8, 0.5, 0.0)),
      gold: withOutline(this.createToonMaterial(0xd9b260, 0.24, 0.45)),
      dark: withOutline(this.createToonMaterial(0x1e1630, 0.48, 0.03)),
      eye: this.createToonMaterial(0x8461e2, 0.16, 0.02),
      pupil: this.createToonMaterial(0x221236, 0.2, 0.0),
      accent: withOutline(this.createToonMaterial(0xa568df, 0.42, 0.02)),
      white: this.createToonMaterial(0xf9f2ff, 0.36, 0.0),
      outline,
    };
  }

  private createToonMaterial(color: number, roughness: number, metalness: number, opacity = 1): THREE.MeshToonMaterial {
    void roughness;
    void metalness;
    return new THREE.MeshToonMaterial({
      color,
      gradientMap: CharacterRig3D.getToonGradient(),
      transparent: opacity < 1,
      opacity,
      side: THREE.FrontSide,
    });
  }

  private static getToonGradient(): THREE.DataTexture {
    if (!CharacterRig3D.toonGradient) {
      const data = new Uint8Array([
        54, 54, 54, 255,
        112, 112, 112, 255,
        174, 174, 174, 255,
        222, 222, 222, 255,
        255, 255, 255, 255,
      ]);
      const texture = new THREE.DataTexture(data, 5, 1, THREE.RGBAFormat);
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      CharacterRig3D.toonGradient = texture;
    }
    return CharacterRig3D.toonGradient;
  }
}
