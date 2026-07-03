import * as THREE from 'three';

export type CharacterKind = 'player' | 'lyra';

interface RigParts {
  body: THREE.Group;
  chest: THREE.Group;
  head: THREE.Group;
  hair: THREE.Group;
  leftUpperArm: THREE.Group;
  leftForearm: THREE.Group;
  rightUpperArm: THREE.Group;
  rightForearm: THREE.Group;
  leftThigh: THREE.Group;
  leftShin: THREE.Group;
  rightThigh: THREE.Group;
  rightShin: THREE.Group;
  cape?: THREE.Group;
  skirt?: THREE.Group;
  book?: THREE.Group;
  wand?: THREE.Group;
}

interface CharacterPalette {
  skin: THREE.MeshStandardMaterial;
  hair: THREE.MeshStandardMaterial;
  outfit: THREE.MeshStandardMaterial;
  secondary: THREE.MeshStandardMaterial;
  clothLight: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  eye: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
}

export class CharacterRig3D {
  readonly root = new THREE.Group();
  private readonly parts: RigParts;
  private moving = false;
  private movementBlend = 0;

  constructor(private readonly kind: CharacterKind) {
    const palette = this.createPalette(kind);
    this.parts = this.buildRig(palette);
    this.root.userData.characterKind = kind;
  }

  setMoving(moving: boolean): void {
    this.moving = moving;
  }

  update(elapsedTime: number): void {
    this.movementBlend = THREE.MathUtils.lerp(this.movementBlend, this.moving ? 1 : 0, 0.12);
    const walk = Math.sin(elapsedTime * 8.6);
    const counterWalk = Math.sin(elapsedTime * 8.6 + Math.PI);
    const idle = Math.sin(elapsedTime * 2.4);
    const softIdle = Math.sin(elapsedTime * 1.45);

    this.root.position.y = Math.sin(elapsedTime * 3.1) * 0.012 * (1 - this.movementBlend)
      + Math.abs(walk) * 0.032 * this.movementBlend;

    this.parts.body.rotation.z = idle * 0.018 * (1 - this.movementBlend);
    this.parts.chest.rotation.x = -0.03 + Math.abs(walk) * 0.035 * this.movementBlend;
    this.parts.chest.rotation.z = walk * 0.035 * this.movementBlend;
    this.parts.head.rotation.x = idle * 0.018;
    this.parts.head.rotation.y = softIdle * (this.kind === 'lyra' ? 0.045 : 0.03);

    this.parts.leftThigh.rotation.x = walk * 0.55 * this.movementBlend;
    this.parts.rightThigh.rotation.x = counterWalk * 0.55 * this.movementBlend;
    this.parts.leftShin.rotation.x = Math.max(0, counterWalk) * 0.42 * this.movementBlend;
    this.parts.rightShin.rotation.x = Math.max(0, walk) * 0.42 * this.movementBlend;

    this.parts.leftUpperArm.rotation.x = counterWalk * 0.42 * this.movementBlend + idle * 0.025;
    this.parts.rightUpperArm.rotation.x = walk * 0.42 * this.movementBlend - idle * 0.025;
    this.parts.leftForearm.rotation.x = -0.22 - Math.max(0, walk) * 0.18 * this.movementBlend;
    this.parts.rightForearm.rotation.x = -0.22 - Math.max(0, counterWalk) * 0.18 * this.movementBlend;

    if (this.kind === 'lyra') {
      this.parts.leftUpperArm.rotation.z = -0.55 + idle * 0.025;
      this.parts.rightUpperArm.rotation.z = 0.55 - idle * 0.025;
      this.parts.leftForearm.rotation.x = -0.85 + idle * 0.018;
      this.parts.rightForearm.rotation.x = -0.85 - idle * 0.018;
      if (this.parts.book) this.parts.book.rotation.z = idle * 0.018;
    }

    this.parts.hair.rotation.x = softIdle * 0.025 - this.movementBlend * 0.05;
    this.parts.hair.rotation.z = Math.sin(elapsedTime * 2.1) * 0.02;
    if (this.parts.cape) {
      this.parts.cape.rotation.x = -0.14 - Math.abs(walk) * 0.12 * this.movementBlend + idle * 0.02;
      this.parts.cape.rotation.z = walk * 0.035 * this.movementBlend;
    }
    if (this.parts.skirt) this.parts.skirt.rotation.z = walk * 0.04 * this.movementBlend + idle * 0.015;
    if (this.parts.wand) this.parts.wand.rotation.z = 0.18 + idle * 0.03;
  }

  private buildRig(palette: CharacterPalette): RigParts {
    const body = new THREE.Group();
    const chest = new THREE.Group();
    const head = new THREE.Group();
    const hair = new THREE.Group();
    const leftUpperArm = new THREE.Group();
    const leftForearm = new THREE.Group();
    const rightUpperArm = new THREE.Group();
    const rightForearm = new THREE.Group();
    const leftThigh = new THREE.Group();
    const leftShin = new THREE.Group();
    const rightThigh = new THREE.Group();
    const rightShin = new THREE.Group();

    this.root.add(body);
    body.add(chest, leftThigh, rightThigh);
    chest.position.set(0, 0.82, 0);
    leftThigh.position.set(-0.14, 0.58, 0);
    rightThigh.position.set(0.14, 0.58, 0);

    this.addLimb(leftThigh, leftShin, 0.28, 0.3, palette.outfit, palette.dark, -0.03);
    this.addLimb(rightThigh, rightShin, 0.28, 0.3, palette.outfit, palette.dark, -0.03);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.5, 10, 18), palette.outfit);
    torso.position.set(0, 0.06, 0);
    torso.scale.set(this.kind === 'lyra' ? 1.02 : 1, this.kind === 'lyra' ? 1.06 : 1, 0.86);
    chest.add(torso);

    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.45, 0.035), palette.clothLight);
    shirt.position.set(0, 0.09, -0.255);
    chest.add(shirt);

    this.addUniformDetails(chest, palette);
    this.addShouldersAndArms(chest, leftUpperArm, leftForearm, rightUpperArm, rightForearm, palette);

    head.position.set(0, 0.76, 0);
    chest.add(head);
    this.addHead(head, hair, palette);

    let cape: THREE.Group | undefined;
    let skirt: THREE.Group | undefined;
    let book: THREE.Group | undefined;
    let wand: THREE.Group | undefined;
    if (this.kind === 'player') {
      cape = this.addPlayerCape(chest, palette);
      wand = this.addPlayerWand(rightForearm, palette);
    } else {
      skirt = this.addLyraSkirt(body, palette);
      book = this.addLyraBook(chest, palette);
    }

    const groundRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.012, 8, 40), palette.gold);
    groundRing.position.set(0, 0.035, 0);
    groundRing.rotation.x = Math.PI / 2;
    this.root.add(groundRing);

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
      rightUpperArm,
      rightForearm,
      leftThigh,
      leftShin,
      rightThigh,
      rightShin,
      cape,
      skirt,
      book,
      wand,
    };
  }

  private createPalette(kind: CharacterKind): CharacterPalette {
    return {
      skin: new THREE.MeshStandardMaterial({ color: kind === 'player' ? 0xf0c2a2 : 0xf7c9bd, roughness: 0.44 }),
      hair: new THREE.MeshStandardMaterial({
        color: kind === 'player' ? 0x2b211f : 0xded8ff,
        roughness: kind === 'player' ? 0.42 : 0.34,
        metalness: 0.02,
      }),
      outfit: new THREE.MeshStandardMaterial({
        color: kind === 'player' ? 0x263a78 : 0x7450bd,
        roughness: 0.45,
        metalness: 0.04,
      }),
      secondary: new THREE.MeshStandardMaterial({
        color: kind === 'player' ? 0x17234d : 0x4f2f80,
        roughness: 0.52,
        metalness: 0.04,
      }),
      clothLight: new THREE.MeshStandardMaterial({ color: kind === 'player' ? 0xf2edf5 : 0xf4edf8, roughness: 0.5 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xd8b566, roughness: 0.24, metalness: 0.5 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x17131c, roughness: 0.42, metalness: 0.04 }),
      eye: new THREE.MeshStandardMaterial({ color: kind === 'player' ? 0x6d7fb2 : 0x7655d8, roughness: 0.16, metalness: 0.02 }),
      accent: new THREE.MeshStandardMaterial({ color: kind === 'player' ? 0x8f2831 : 0x9a62df, roughness: 0.46 }),
    };
  }

  private addLimb(
    upper: THREE.Group,
    lower: THREE.Group,
    upperLength: number,
    lowerLength: number,
    upperMat: THREE.Material,
    lowerMat: THREE.Material,
    footZ: number
  ): void {
    const upperMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, upperLength, 8, 12), upperMat);
    upperMesh.position.set(0, -upperLength / 2, 0);
    upper.add(upperMesh);

    lower.position.set(0, -upperLength, 0);
    upper.add(lower);
    const lowerMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, lowerLength, 8, 12), upperMat);
    lowerMesh.position.set(0, -lowerLength / 2, 0);
    lower.add(lowerMesh);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.075, 0.28), lowerMat);
    shoe.position.set(0, -lowerLength - 0.04, footZ);
    lower.add(shoe);
  }

  private addShouldersAndArms(
    chest: THREE.Group,
    leftUpperArm: THREE.Group,
    leftForearm: THREE.Group,
    rightUpperArm: THREE.Group,
    rightForearm: THREE.Group,
    palette: CharacterPalette
  ): void {
    const shoulderY = 0.34;
    leftUpperArm.position.set(-0.34, shoulderY, -0.01);
    rightUpperArm.position.set(0.34, shoulderY, -0.01);
    leftUpperArm.rotation.z = this.kind === 'lyra' ? -0.55 : -0.18;
    rightUpperArm.rotation.z = this.kind === 'lyra' ? 0.55 : 0.18;
    chest.add(leftUpperArm, rightUpperArm);

    this.addArm(leftUpperArm, leftForearm, -1, palette);
    this.addArm(rightUpperArm, rightForearm, 1, palette);

    const leftPad = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 10), palette.secondary);
    leftPad.position.set(-0.31, shoulderY, -0.01);
    leftPad.scale.set(1.2, 0.55, 0.9);
    chest.add(leftPad);

    const rightPad = leftPad.clone();
    rightPad.material = palette.secondary;
    rightPad.position.x = 0.31;
    chest.add(rightPad);
  }

  private addArm(upperArm: THREE.Group, forearm: THREE.Group, side: -1 | 1, palette: CharacterPalette): void {
    const upperLength = 0.36;
    const lowerLength = 0.32;
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, upperLength, 8, 12), palette.outfit);
    sleeve.position.set(0, -upperLength / 2, 0);
    upperArm.add(sleeve);

    forearm.position.set(side * 0.02, -upperLength, 0);
    forearm.rotation.z = side * 0.1;
    upperArm.add(forearm);

    const cuff = new THREE.Mesh(new THREE.CapsuleGeometry(0.057, lowerLength, 8, 12), palette.clothLight);
    cuff.position.set(0, -lowerLength / 2, 0);
    forearm.add(cuff);

    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.007, 8, 18), palette.gold);
    trim.position.set(0, -0.08, 0);
    trim.rotation.x = Math.PI / 2;
    forearm.add(trim);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 10), palette.skin);
    hand.position.set(0, -lowerLength - 0.035, -0.015);
    hand.scale.set(1, 0.82, 0.92);
    forearm.add(hand);
  }

  private addUniformDetails(chest: THREE.Group, palette: CharacterPalette): void {
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.43, 0.038), palette.secondary);
    vest.position.set(0, 0.04, -0.282);
    chest.add(vest);

    const leftLap = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.48, 0.026), palette.gold);
    leftLap.position.set(-0.14, 0.04, -0.305);
    leftLap.rotation.z = -0.28;
    chest.add(leftLap);

    const rightLap = leftLap.clone();
    rightLap.position.x = 0.14;
    rightLap.rotation.z = 0.28;
    chest.add(rightLap);

    const tie = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.26, 4), palette.accent);
    tie.position.set(0, 0.23, -0.32);
    tie.rotation.z = Math.PI / 4;
    tie.scale.set(0.85, this.kind === 'player' ? 1.2 : 0.75, 0.35);
    chest.add(tie);

    if (this.kind === 'player') {
      this.addStar(chest, new THREE.Vector3(-0.22, 0.24, -0.31), 0.07, palette.gold);
      this.addStar(chest, new THREE.Vector3(0.2, 0.09, -0.31), 0.052, palette.gold);
      this.addChain(chest, palette.gold);
    } else {
      this.addStar(chest, new THREE.Vector3(0, 0.26, -0.33), 0.07, palette.gold);
      this.addStar(chest, new THREE.Vector3(0.23, -0.14, -0.31), 0.052, palette.gold);
    }
  }

  private addHead(head: THREE.Group, hair: THREE.Group, palette: CharacterPalette): void {
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.255, 28, 18), palette.skin);
    face.scale.set(0.92, 1.05, 0.86);
    head.add(face);

    hair.position.set(0, 0.06, 0.03);
    head.add(hair);

    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.29, 28, 18), palette.hair);
    hairCap.position.set(0, 0.08, 0.035);
    hairCap.scale.set(1.02, 0.78, 0.94);
    hair.add(hairCap);

    if (this.kind === 'player') {
      this.addPlayerHair(hair, palette);
    } else {
      this.addLyraHair(hair, palette);
    }

    for (const x of [-0.085, 0.085]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 8), palette.eye);
      eye.position.set(x, 0.0, -0.222);
      eye.scale.set(1, 1.25, 0.28);
      head.add(eye);

      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.01), palette.hair);
      brow.position.set(x, 0.07, -0.23);
      brow.rotation.z = x < 0 ? -0.12 : 0.12;
      head.add(brow);
    }

    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.01, 0.008), palette.accent);
    mouth.position.set(0, -0.105, -0.225);
    mouth.scale.y = 0.45;
    head.add(mouth);
  }

  private addPlayerHair(hair: THREE.Group, palette: CharacterPalette): void {
    const spikes: Array<[number, number, number, number]> = [
      [-0.18, 0.21, -0.03, -0.45],
      [-0.06, 0.25, -0.08, -0.15],
      [0.09, 0.23, -0.05, 0.18],
      [0.22, 0.16, 0.02, 0.52],
      [-0.25, 0.08, 0.02, -0.7],
    ];
    for (const [x, y, z, rz] of spikes) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.28, 12), palette.hair);
      spike.position.set(x, y, z);
      spike.rotation.z = rz;
      spike.rotation.x = -0.18;
      hair.add(spike);
    }

    const fringe = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.34, 12), palette.hair);
    fringe.position.set(-0.04, 0.08, -0.23);
    fringe.rotation.x = 1.0;
    fringe.rotation.z = -0.15;
    hair.add(fringe);
  }

  private addLyraHair(hair: THREE.Group, palette: CharacterPalette): void {
    for (const x of [-0.25, 0.25]) {
      const sideLock = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.68, 8, 14), palette.hair);
      sideLock.position.set(x, -0.28, 0.08);
      sideLock.rotation.z = x < 0 ? 0.16 : -0.16;
      hair.add(sideLock);
    }

    for (let i = 0; i < 7; i += 1) {
      const angle = -0.75 + i * 0.25;
      const strand = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.78 + (i % 2) * 0.16, 6, 10), palette.hair);
      strand.position.set(Math.sin(angle) * 0.34, -0.34, Math.cos(angle) * 0.18 + 0.12);
      strand.rotation.z = -Math.sin(angle) * 0.35;
      strand.rotation.x = 0.18;
      hair.add(strand);
    }

    const braid = new THREE.Group();
    braid.position.set(0.28, -0.05, 0.12);
    braid.rotation.z = -0.2;
    hair.add(braid);
    for (let i = 0; i < 5; i += 1) {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8), palette.hair);
      bead.position.set(0, -i * 0.105, 0);
      bead.scale.set(1.15, 0.86, 0.9);
      braid.add(bead);
    }

    const bowLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.025), palette.accent);
    bowLeft.position.set(0.38, -0.03, 0.08);
    bowLeft.rotation.z = 0.5;
    hair.add(bowLeft);
    const bowRight = bowLeft.clone();
    bowRight.rotation.z = -0.5;
    bowRight.position.y = -0.08;
    hair.add(bowRight);

    this.addStar(hair, new THREE.Vector3(0.24, 0.13, -0.18), 0.058, palette.gold);
  }

  private addPlayerCape(chest: THREE.Group, palette: CharacterPalette): THREE.Group {
    const cape = new THREE.Group();
    cape.position.set(0, 0.24, 0.24);
    chest.add(cape);

    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.9, 0.055), palette.secondary);
    cloth.position.set(0, -0.28, 0);
    cloth.rotation.x = -0.08;
    cape.add(cloth);

    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.035, 0.065), palette.gold);
    trim.position.set(0, 0.17, -0.005);
    cape.add(trim);

    this.addStar(cape, new THREE.Vector3(-0.24, -0.05, -0.04), 0.048, palette.gold);
    return cape;
  }

  private addLyraSkirt(body: THREE.Group, palette: CharacterPalette): THREE.Group {
    const skirt = new THREE.Group();
    skirt.position.set(0, 0.58, 0);
    body.add(skirt);

    const skirtMesh = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.58, 32), palette.clothLight);
    skirtMesh.position.set(0, -0.25, 0);
    skirt.add(skirtMesh);

    for (let i = 0; i < 8; i += 1) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.48, 0.018), i % 2 === 0 ? palette.outfit : palette.secondary);
      const angle = (i / 8) * Math.PI * 2;
      panel.position.set(Math.sin(angle) * 0.32, -0.27, Math.cos(angle) * 0.32);
      panel.rotation.y = angle;
      skirt.add(panel);
    }
    return skirt;
  }

  private addPlayerWand(forearm: THREE.Group, palette: CharacterPalette): THREE.Group {
    const wand = new THREE.Group();
    wand.position.set(0.02, -0.28, -0.08);
    wand.rotation.z = 0.18;
    forearm.add(wand);

    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.62, 10), palette.dark);
    rod.position.set(0, -0.18, -0.02);
    rod.rotation.x = 0.18;
    wand.add(rod);

    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), palette.gold);
    tip.position.set(0, -0.48, -0.08);
    wand.add(tip);
    return wand;
  }

  private addLyraBook(chest: THREE.Group, palette: CharacterPalette): THREE.Group {
    const book = new THREE.Group();
    book.position.set(0, -0.02, -0.36);
    book.rotation.x = -0.08;
    chest.add(book);

    const cover = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.5, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x3b2630, roughness: 0.55, metalness: 0.05 })
    );
    book.add(cover);

    const pages = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.42, 0.028),
      new THREE.MeshStandardMaterial({ color: 0xeeddb8, roughness: 0.7 })
    );
    pages.position.set(0, 0, -0.055);
    book.add(pages);

    this.addStar(book, new THREE.Vector3(0, 0, 0.052), 0.08, palette.gold);
    return book;
  }

  private addChain(parent: THREE.Group, material: THREE.Material): void {
    for (let i = 0; i < 7; i += 1) {
      const bead = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.004, 5, 10), material);
      bead.position.set(0.18 + i * 0.025, 0.1 - i * 0.03, -0.32);
      bead.rotation.x = Math.PI / 2;
      parent.add(bead);
    }
  }

  private addStar(parent: THREE.Object3D, position: THREE.Vector3, radius: number, material: THREE.Material): void {
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(radius, 0), material);
    star.position.copy(position);
    star.scale.set(1, 1, 0.32);
    parent.add(star);
  }
}
