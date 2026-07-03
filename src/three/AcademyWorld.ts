import * as THREE from 'three';
import type { AcademyWorldObjects, Obstacle } from './WorldTypes';

type CharacterKind = 'player' | 'lyra';

interface AnimatedObject {
  object: THREE.Object3D;
  baseY: number;
  amplitude: number;
  speed: number;
  phase: number;
}

export class AcademyWorld {
  private readonly obstacles: Obstacle[] = [];
  private readonly animatedObjects: AnimatedObject[] = [];
  private player!: THREE.Object3D;
  private lyra!: THREE.Object3D;

  constructor(private readonly scene: THREE.Scene) {}

  build(): AcademyWorldObjects {
    this.scene.background = new THREE.Color(0xd6d0dc);
    this.scene.fog = new THREE.Fog(0xd8d0dc, 18, 34);

    this.addLights();
    this.addAcademyArchitecture();
    this.addCharacters();

    return {
      player: this.player,
      lyra: this.lyra,
      obstacles: this.obstacles,
    };
  }

  update(elapsedTime: number): void {
    for (const item of this.animatedObjects) {
      item.object.position.y = item.baseY + Math.sin(elapsedTime * item.speed + item.phase) * item.amplitude;
      item.object.rotation.y += 0.006;
    }

    this.lyra.position.y = Math.sin(elapsedTime * 2.2) * 0.025;
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xfff4df, 0x78678a, 1.85));

    const sun = new THREE.DirectionalLight(0xffdfb0, 3.4);
    sun.position.set(-4.8, 8.5, 5.8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 28;
    sun.shadow.camera.left = -11;
    sun.shadow.camera.right = 11;
    sun.shadow.camera.top = 11;
    sun.shadow.camera.bottom = -11;
    this.scene.add(sun);

    this.addPointLight(-5.7, 2.8, -4.8, 0xffc877, 2.0, 5.4);
    this.addPointLight(5.7, 2.8, -4.8, 0xffc877, 2.0, 5.4);
    this.addPointLight(6.5, 1.8, -0.4, 0x9bc5ff, 1.6, 4.4);
    this.addPointLight(-4.2, 2.8, 3.2, 0xffd990, 1.25, 4.2);
  }

  private addAcademyArchitecture(): void {
    this.addFloor();
    this.addWalls();
    this.addWallPanels();
    this.addWindows();
    this.addArchedDoor();
    this.addColumnsAndBeams();
    this.addLibrary();
    this.addStudyArea();
    this.addRugsAndFloorDetails();

    this.obstacles.push(
      { minX: -8.9, maxX: 8.9, minZ: -6.45, maxZ: -5.95 },
      { minX: -9.05, maxX: -8.45, minZ: -6.35, maxZ: 6.2 },
      { minX: 8.45, maxX: 9.05, minZ: -6.35, maxZ: 6.2 },
      { minX: 3.35, maxX: 8.2, minZ: -6.15, maxZ: -3.75 },
      { minX: 7.2, maxX: 8.35, minZ: -3.85, maxZ: 0.8 },
      { minX: 3.6, maxX: 6.95, minZ: -0.82, maxZ: 0.62 },
      { minX: -6.8, maxX: -6.1, minZ: -4.95, maxZ: -4.1 },
      { minX: 5.8, maxX: 6.5, minZ: 3.15, maxZ: 3.95 },
      { minX: -7.8, maxX: -6.9, minZ: 2.65, maxZ: 3.55 }
    );
  }

  private addFloor(): void {
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(18, 0.16, 13.2),
      new THREE.MeshStandardMaterial({
        color: 0xc9c0ce,
        roughness: 0.3,
        metalness: 0.05,
        map: this.makeMarbleTexture(),
      })
    );
    floor.position.set(0, -0.08, 0);
    floor.receiveShadow = true;
    this.scene.add(floor);

    const grooveMat = new THREE.MeshStandardMaterial({ color: 0x6f6078, roughness: 0.55, metalness: 0.05 });
    for (let x = -8.1; x <= 8.1; x += 1.35) {
      this.addBox(new THREE.Vector3(x, 0.018, 0), new THREE.Vector3(0.022, 0.022, 12.8), grooveMat, false, true);
    }
    for (let z = -5.95; z <= 5.95; z += 1.2) {
      this.addBox(new THREE.Vector3(0, 0.022, z), new THREE.Vector3(17.6, 0.022, 0.022), grooveMat, false, true);
    }

    const borderMat = new THREE.MeshStandardMaterial({ color: 0xc7a060, roughness: 0.24, metalness: 0.48 });
    const borders: Array<[number, number, number, number]> = [
      [0, -6.14, 17.3, 0.08],
      [0, 6.14, 17.3, 0.08],
      [-8.65, 0, 0.08, 12.3],
      [8.65, 0, 0.08, 12.3],
      [4.95, -2.8, 6.15, 0.06],
      [1.86, -1.15, 0.06, 3.35],
      [8.0, -1.15, 0.06, 3.35],
    ];
    for (const [x, z, width, depth] of borders) {
      this.addBox(new THREE.Vector3(x, 0.055, z), new THREE.Vector3(width, 0.05, depth), borderMat, true, true);
    }
  }

  private addWalls(): void {
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xb8adbd,
      roughness: 0.58,
      metalness: 0.03,
      map: this.makePlasterTexture(),
    });
    const lowerMat = new THREE.MeshStandardMaterial({ color: 0x7b6680, roughness: 0.5, metalness: 0.08 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xbf985d, roughness: 0.25, metalness: 0.45 });

    this.addBox(new THREE.Vector3(0, 2.25, -6.62), new THREE.Vector3(18.3, 4.5, 0.45), wallMat, false, true);
    this.addBox(new THREE.Vector3(-9.12, 2.15, 0), new THREE.Vector3(0.45, 4.3, 13.2), wallMat, false, true);
    this.addBox(new THREE.Vector3(9.12, 2.15, 0), new THREE.Vector3(0.45, 4.3, 13.2), wallMat, false, true);

    this.addBox(new THREE.Vector3(0, 0.58, -6.35), new THREE.Vector3(18, 0.88, 0.28), lowerMat, true, true);
    this.addBox(new THREE.Vector3(-8.86, 0.58, 0), new THREE.Vector3(0.28, 0.88, 12.9), lowerMat, true, true);
    this.addBox(new THREE.Vector3(8.86, 0.58, 0), new THREE.Vector3(0.28, 0.88, 12.9), lowerMat, true, true);

    this.addBox(new THREE.Vector3(0, 1.08, -6.08), new THREE.Vector3(17.8, 0.12, 0.12), trimMat, true, true);
    this.addBox(new THREE.Vector3(0, 4.38, -6.08), new THREE.Vector3(17.6, 0.18, 0.14), trimMat, true, true);
    this.addBox(new THREE.Vector3(-8.58, 1.08, 0), new THREE.Vector3(0.12, 0.12, 12.6), trimMat, true, true);
    this.addBox(new THREE.Vector3(8.58, 1.08, 0), new THREE.Vector3(0.12, 0.12, 12.6), trimMat, true, true);
  }

  private addWallPanels(): void {
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x9f91aa, roughness: 0.56, metalness: 0.04 });
    const insetMat = new THREE.MeshStandardMaterial({ color: 0x77647f, roughness: 0.62, metalness: 0.04 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xc7a060, roughness: 0.24, metalness: 0.48 });

    for (const x of [-7.1, -4.7, -2.35, 2.35, 4.7, 7.1]) {
      this.addFramedPanel(new THREE.Vector3(x, 2.65, -6.35), 1.28, 2.05, 'back', panelMat, insetMat, trimMat);
    }
    for (const z of [-4.85, -2.45, 0, 2.45, 4.85]) {
      this.addFramedPanel(new THREE.Vector3(-8.68, 2.54, z), 1.22, 1.9, 'left', panelMat, insetMat, trimMat);
      this.addFramedPanel(new THREE.Vector3(8.68, 2.54, z), 1.22, 1.9, 'right', panelMat, insetMat, trimMat);
    }
  }

  private addWindows(): void {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xc7a060, roughness: 0.24, metalness: 0.45 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xbfe7ff,
      emissive: 0x5c8eda,
      emissiveIntensity: 0.18,
      transparent: true,
      opacity: 0.58,
      roughness: 0.12,
      metalness: 0.02,
    });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8f8298, roughness: 0.52, metalness: 0.08 });

    for (const x of [-5.65, 5.65]) {
      this.addBox(new THREE.Vector3(x, 2.88, -6.02), new THREE.Vector3(1.65, 2.5, 0.08), glassMat, false, false);
      this.addBox(new THREE.Vector3(x, 1.56, -5.92), new THREE.Vector3(1.95, 0.18, 0.32), stoneMat, true, true);
      this.addBox(new THREE.Vector3(x, 4.16, -5.94), new THREE.Vector3(1.86, 0.12, 0.16), frameMat, true, true);
      this.addBox(new THREE.Vector3(x, 2.88, -5.92), new THREE.Vector3(0.08, 2.58, 0.16), frameMat, true, true);
      this.addBox(new THREE.Vector3(x - 0.84, 2.88, -5.92), new THREE.Vector3(0.08, 2.56, 0.16), frameMat, true, true);
      this.addBox(new THREE.Vector3(x + 0.84, 2.88, -5.92), new THREE.Vector3(0.08, 2.56, 0.16), frameMat, true, true);
      this.addBox(new THREE.Vector3(x, 2.88, -5.9), new THREE.Vector3(1.78, 0.08, 0.16), frameMat, true, true);
      this.addWindowLightPatch(x - 0.55, -2.4);
    }
  }

  private addArchedDoor(): void {
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x5d3a59, roughness: 0.45, metalness: 0.12 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xc7a060, roughness: 0.24, metalness: 0.48 });

    this.addBox(new THREE.Vector3(0, 1.65, -5.93), new THREE.Vector3(1.55, 3.08, 0.12), doorMat, true, true);
    this.addBox(new THREE.Vector3(-0.86, 1.7, -5.84), new THREE.Vector3(0.12, 3.32, 0.18), trimMat, true, true);
    this.addBox(new THREE.Vector3(0.86, 1.7, -5.84), new THREE.Vector3(0.12, 3.32, 0.18), trimMat, true, true);
    this.addBox(new THREE.Vector3(0, 3.36, -5.84), new THREE.Vector3(1.85, 0.12, 0.18), trimMat, true, true);

    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.055, 12, 28, Math.PI), trimMat);
    arch.position.set(0, 3.34, -5.84);
    arch.rotation.z = Math.PI;
    arch.castShadow = true;
    this.scene.add(arch);
  }

  private addColumnsAndBeams(): void {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x806f88, roughness: 0.42, metalness: 0.12 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xc7a060, roughness: 0.24, metalness: 0.48 });

    for (const [x, z] of [
      [-7.2, -4.85],
      [-3.4, -1.4],
      [3.4, -1.4],
      [7.2, -4.85],
      [-7.2, 3.15],
      [7.2, 3.15],
    ] as Array<[number, number]>) {
      this.addColumn(x, z, stoneMat, trimMat);
    }

    this.addBox(new THREE.Vector3(0, 4.72, -5.0), new THREE.Vector3(16.2, 0.22, 0.32), trimMat, true, true);
    this.addBox(new THREE.Vector3(-7.4, 4.55, 0.0), new THREE.Vector3(0.24, 0.2, 11.6), trimMat, true, true);
    this.addBox(new THREE.Vector3(7.4, 4.55, 0.0), new THREE.Vector3(0.24, 0.2, 11.6), trimMat, true, true);
    this.addBox(new THREE.Vector3(0, 4.95, 0.4), new THREE.Vector3(14.8, 0.16, 0.18), trimMat, true, true);
  }

  private addLibrary(): void {
    for (const x of [3.7, 5.05, 6.4, 7.75]) {
      this.addBookshelf(new THREE.Vector3(x, 0, -6.0), 0);
    }
    for (const z of [-4.55, -3.25, -1.95, -0.65]) {
      this.addBookshelf(new THREE.Vector3(8.35, 0, z), Math.PI / 2);
    }

    this.addLibraryLadder();
    this.addBookStack(3.6, -1.05, 4);
    this.addBookStack(7.2, 0.72, 5);
    this.addBookStack(6.58, -2.05, 3);
  }

  private addStudyArea(): void {
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x5b3324,
      roughness: 0.42,
      metalness: 0.1,
      map: this.makeWoodTexture(),
    });
    const pageMat = new THREE.MeshStandardMaterial({ color: 0xf0dfbd, roughness: 0.65, metalness: 0.02 });
    const purpleMat = new THREE.MeshStandardMaterial({ color: 0x623660, roughness: 0.66, metalness: 0.02 });

    this.addBox(new THREE.Vector3(5.2, 0.68, -0.12), new THREE.Vector3(2.5, 0.2, 1.24), woodMat, true, true);
    this.addBox(new THREE.Vector3(5.2, 0.82, -0.12), new THREE.Vector3(2.18, 0.035, 0.36), purpleMat, false, true);
    for (const x of [4.22, 6.18]) {
      for (const z of [-0.62, 0.38]) {
        this.addBox(new THREE.Vector3(x, 0.34, z), new THREE.Vector3(0.15, 0.68, 0.15), woodMat, true, true);
      }
    }

    this.addBox(new THREE.Vector3(4.95, 0.83, -0.16), new THREE.Vector3(0.44, 0.04, 0.36), pageMat, true, true).rotation.y = 0.14;
    this.addBox(new THREE.Vector3(5.36, 0.83, -0.1), new THREE.Vector3(0.44, 0.04, 0.36), pageMat, true, true).rotation.y = -0.16;

    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 24, 16),
      new THREE.MeshStandardMaterial({
        color: 0x9fdcff,
        emissive: 0x5f8fff,
        emissiveIntensity: 1.1,
        transparent: true,
        opacity: 0.8,
      })
    );
    orb.position.set(5.92, 1.08, -0.05);
    this.scene.add(orb);
    this.addPointLight(5.92, 1.1, -0.05, 0x8fc7ff, 1.35, 2.6);
    this.animatedObjects.push({ object: orb, baseY: 1.08, amplitude: 0.08, speed: 2.1, phase: 0.2 });
  }

  private addRugsAndFloorDetails(): void {
    const rugMat = new THREE.MeshStandardMaterial({
      color: 0x6b2f73,
      roughness: 0.78,
      metalness: 0.02,
      map: this.makeCarpetTexture(),
    });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xe0bc72, roughness: 0.32, metalness: 0.38 });

    this.addFlatPlane(new THREE.Vector3(4.6, 0.072, 2.3), new THREE.Vector2(3.4, 2.4), rugMat);
    this.addBox(new THREE.Vector3(4.6, 0.092, 1.1), new THREE.Vector3(3.35, 0.025, 0.045), trimMat, false, true);
    this.addBox(new THREE.Vector3(4.6, 0.092, 3.5), new THREE.Vector3(3.35, 0.025, 0.045), trimMat, false, true);
    this.addBox(new THREE.Vector3(2.92, 0.092, 2.3), new THREE.Vector3(0.045, 0.025, 2.35), trimMat, false, true);
    this.addBox(new THREE.Vector3(6.28, 0.092, 2.3), new THREE.Vector3(0.045, 0.025, 2.35), trimMat, false, true);

    for (const [x, z] of [
      [-4.9, 2.1],
      [-1.8, 2.1],
      [1.2, 2.1],
      [4.2, 2.1],
    ] as Array<[number, number]>) {
      const inlay = this.addBox(new THREE.Vector3(x, 0.095, z), new THREE.Vector3(0.42, 0.025, 0.42), trimMat, false, true);
      inlay.rotation.y = Math.PI / 4;
    }
  }

  private addCharacters(): void {
    this.player = this.createCharacter('player');
    this.player.position.set(-5.1, 0, 2.5);
    this.player.rotation.y = Math.PI * 0.78;
    this.scene.add(this.player);

    this.lyra = this.createCharacter('lyra');
    this.lyra.position.set(5.35, 0, -1.35);
    this.lyra.rotation.y = -Math.PI * 0.18;
    this.scene.add(this.lyra);
  }

  private createCharacter(kind: CharacterKind): THREE.Group {
    const group = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: kind === 'player' ? 0xf0c7aa : 0xf7c9bd, roughness: 0.48 });
    const black = new THREE.MeshStandardMaterial({ color: 0x171522, roughness: 0.45, metalness: 0.03 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf3edf7, roughness: 0.42, metalness: 0.02 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd6b45d, roughness: 0.28, metalness: 0.42 });
    const playerBlue = new THREE.MeshStandardMaterial({ color: 0x26365f, roughness: 0.5, metalness: 0.06 });
    const lyraPurple = new THREE.MeshStandardMaterial({ color: 0x7b4cc5, roughness: 0.48, metalness: 0.05 });
    const hairMat = new THREE.MeshStandardMaterial({
      color: kind === 'player' ? 0x382820 : 0xded7ff,
      roughness: 0.5,
      metalness: 0.03,
    });

    const outfit = kind === 'player' ? playerBlue : lyraPurple;
    const heightOffset = kind === 'player' ? 0 : 0.04;

    this.addCharacterLeg(group, -0.14, outfit, black);
    this.addCharacterLeg(group, 0.14, outfit, black);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.42, 8, 16), outfit);
    torso.position.set(0, 0.86 + heightOffset, 0);
    torso.scale.set(kind === 'lyra' ? 1.08 : 1, kind === 'lyra' ? 1.03 : 1, kind === 'lyra' ? 0.92 : 1);
    torso.castShadow = true;
    torso.receiveShadow = true;
    group.add(torso);

    const chestPanel = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.36, 0.035), white);
    chestPanel.position.set(0, 0.93 + heightOffset, -0.25);
    chestPanel.castShadow = true;
    group.add(chestPanel);

    if (kind === 'lyra') {
      const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.58, 28), lyraPurple);
      skirt.position.set(0, 0.48, 0);
      skirt.castShadow = true;
      skirt.receiveShadow = true;
      group.add(skirt);

      for (const x of [-0.32, 0.32]) {
        const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.025), gold);
        ribbon.position.set(x, 1.12, -0.28);
        ribbon.rotation.z = x < 0 ? 0.55 : -0.55;
        ribbon.castShadow = true;
        group.add(ribbon);
      }
    } else {
      const cape = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.78, 0.06), playerBlue);
      cape.position.set(0, 0.78, 0.24);
      cape.rotation.x = -0.14;
      cape.castShadow = true;
      group.add(cape);
    }

    this.addCharacterArm(group, -0.38, outfit, skin);
    this.addCharacterArm(group, 0.38, outfit, skin);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 16), skin);
    neck.position.set(0, 1.28 + heightOffset, 0);
    neck.castShadow = true;
    group.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 18), skin);
    head.position.set(0, 1.55 + heightOffset, 0);
    head.scale.set(0.92, 1.04, 0.88);
    head.castShadow = true;
    group.add(head);

    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.29, 24, 18), hairMat);
    hair.position.set(0, 1.66 + heightOffset, 0.04);
    hair.scale.set(1, 0.82, 0.94);
    hair.castShadow = true;
    group.add(hair);

    const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), hairMat);
    fringe.position.set(0, 1.6 + heightOffset, -0.22);
    fringe.rotation.x = 0.22;
    fringe.castShadow = true;
    group.add(fringe);

    if (kind === 'lyra') {
      for (const x of [-0.25, 0.25]) {
        const lock = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.52, 8, 12), hairMat);
        lock.position.set(x, 1.3, 0.11);
        lock.rotation.z = x < 0 ? 0.16 : -0.16;
        lock.castShadow = true;
        group.add(lock);
      }
    } else {
      for (const x of [-0.16, 0.02, 0.18]) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 12), hairMat);
        spike.position.set(x, 1.84, 0.02);
        spike.rotation.z = -x * 1.5;
        spike.castShadow = true;
        group.add(spike);
      }
    }

    for (const x of [-0.085, 0.085]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 10, 8),
        new THREE.MeshStandardMaterial({ color: kind === 'player' ? 0x2c2a33 : 0x6b4cff, roughness: 0.2 })
      );
      eye.position.set(x, 1.57 + heightOffset, -0.235);
      group.add(eye);
    }

    const nameRing = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.012, 8, 36), gold);
    nameRing.position.set(0, 0.03, 0);
    nameRing.rotation.x = Math.PI / 2;
    group.add(nameRing);

    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    return group;
  }

  private addCharacterLeg(parent: THREE.Group, x: number, pantsMat: THREE.Material, shoeMat: THREE.Material): void {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.48, 8, 12), pantsMat);
    leg.position.set(x, 0.38, 0);
    leg.castShadow = true;
    parent.add(leg);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.28), shoeMat);
    shoe.position.set(x, 0.08, -0.04);
    shoe.castShadow = true;
    parent.add(shoe);
  }

  private addCharacterArm(parent: THREE.Group, x: number, sleeveMat: THREE.Material, handMat: THREE.Material): void {
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.44, 8, 12), sleeveMat);
    sleeve.position.set(x, 0.93, -0.02);
    sleeve.rotation.z = x < 0 ? -0.24 : 0.24;
    sleeve.castShadow = true;
    parent.add(sleeve);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), handMat);
    hand.position.set(x * 1.08, 0.68, -0.04);
    hand.castShadow = true;
    parent.add(hand);
  }

  private addBookshelf(position: THREE.Vector3, rotationY: number): void {
    const shelf = new THREE.Group();
    const width = 1.18;
    const height = 2.95;
    const depth = 0.58;
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x5a3629,
      roughness: 0.45,
      metalness: 0.08,
      map: this.makeWoodTexture(),
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2b1c1c, roughness: 0.58, metalness: 0.05 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd0ac68, roughness: 0.25, metalness: 0.5 });

    this.addBoxToGroup(shelf, new THREE.Vector3(0, height / 2, -depth / 2), new THREE.Vector3(width, height, 0.08), darkMat);
    this.addBoxToGroup(shelf, new THREE.Vector3(-width / 2 - 0.07, height / 2, 0), new THREE.Vector3(0.14, height, depth), woodMat);
    this.addBoxToGroup(shelf, new THREE.Vector3(width / 2 + 0.07, height / 2, 0), new THREE.Vector3(0.14, height, depth), woodMat);
    this.addBoxToGroup(shelf, new THREE.Vector3(0, 0.08, 0), new THREE.Vector3(width + 0.32, 0.16, depth + 0.08), woodMat);
    this.addBoxToGroup(shelf, new THREE.Vector3(0, height + 0.04, 0), new THREE.Vector3(width + 0.32, 0.16, depth + 0.08), woodMat);

    const shelfLevels = [0.34, 0.85, 1.36, 1.87, 2.38];
    for (const level of shelfLevels) {
      this.addBoxToGroup(shelf, new THREE.Vector3(0, level, 0), new THREE.Vector3(width + 0.2, 0.07, depth + 0.06), woodMat);
      this.addBoxToGroup(shelf, new THREE.Vector3(0, level + 0.06, depth / 2 + 0.03), new THREE.Vector3(width + 0.22, 0.03, 0.045), goldMat);
    }

    const colors = [0x7356d9, 0xf1c45f, 0x57b9d8, 0xd85f9e, 0x88bd64, 0xb24d43, 0xded4ba];
    for (let row = 0; row < shelfLevels.length; row += 1) {
      let cursor = -width / 2 + 0.08;
      for (let i = 0; i < 11; i += 1) {
        const bookWidth = 0.065 + ((row + i * 2) % 5) * 0.012;
        const bookHeight = 0.29 + ((row + i) % 4) * 0.045;
        const bookDepth = 0.13 + ((row * 2 + i) % 3) * 0.024;
        const bookMat = new THREE.MeshStandardMaterial({ color: colors[(row * 3 + i) % colors.length], roughness: 0.5 });
        const book = this.addBoxToGroup(
          shelf,
          new THREE.Vector3(cursor + bookWidth / 2, shelfLevels[row] + 0.06 + bookHeight / 2, depth / 2 - 0.04),
          new THREE.Vector3(bookWidth, bookHeight, bookDepth),
          bookMat
        );
        book.rotation.z = (((row + i) % 5) - 2) * 0.018;
        if ((row + i) % 3 === 0) {
          this.addBoxToGroup(book, new THREE.Vector3(0, -bookHeight * 0.2, bookDepth / 2 + 0.007), new THREE.Vector3(bookWidth * 0.9, 0.018, 0.012), goldMat);
          this.addBoxToGroup(book, new THREE.Vector3(0, bookHeight * 0.18, bookDepth / 2 + 0.007), new THREE.Vector3(bookWidth * 0.9, 0.018, 0.012), goldMat);
        }
        cursor += bookWidth + 0.03;
      }
    }

    shelf.position.copy(position);
    shelf.rotation.y = rotationY;
    this.scene.add(shelf);
  }

  private addLibraryLadder(): void {
    const ladder = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6d432b, roughness: 0.44, metalness: 0.08, map: this.makeWoodTexture() });
    for (const x of [-0.28, 0.28]) {
      const rail = this.addBoxToGroup(ladder, new THREE.Vector3(x, 0.95, 0), new THREE.Vector3(0.055, 1.85, 0.06), woodMat);
      rail.rotation.z = x < 0 ? 0.17 : 0.05;
    }
    for (let i = 0; i < 6; i += 1) {
      this.addBoxToGroup(ladder, new THREE.Vector3(0, 0.28 + i * 0.27, 0.03), new THREE.Vector3(0.62, 0.045, 0.055), woodMat);
    }
    ladder.position.set(7.65, 0.04, -4.45);
    ladder.rotation.y = 0.18;
    this.scene.add(ladder);
  }

  private addBookStack(x: number, z: number, count: number): void {
    const colors = [0x7d4fd6, 0xd16d85, 0xf0c56c, 0x4c9fb8, 0x6f9e59];
    for (let i = 0; i < count; i += 1) {
      const book = this.addBox(
        new THREE.Vector3(x + i * 0.012, 0.09 + i * 0.074, z),
        new THREE.Vector3(0.42 - i * 0.018, 0.07, 0.3 - i * 0.012),
        new THREE.MeshStandardMaterial({ color: colors[(i + count) % colors.length], roughness: 0.52, metalness: 0.04 }),
        true,
        true
      );
      book.rotation.y = ((i % 3) - 1) * 0.12;
    }
  }

  private addColumn(x: number, z: number, stoneMat: THREE.Material, trimMat: THREE.Material): void {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.2, 28), stoneMat);
    base.position.set(x, 0.1, z);
    base.castShadow = true;
    base.receiveShadow = true;
    this.scene.add(base);

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 2.35, 28), stoneMat);
    pillar.position.set(x, 1.28, z);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    this.scene.add(pillar);

    for (const y of [0.36, 2.2]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.09, 28), trimMat);
      ring.position.set(x, y, z);
      ring.castShadow = true;
      ring.receiveShadow = true;
      this.scene.add(ring);
    }

    const lamp = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16, 1),
      new THREE.MeshStandardMaterial({ color: 0xffd674, emissive: 0xffb847, emissiveIntensity: 1.65 })
    );
    lamp.position.set(x, 2.58, z);
    this.scene.add(lamp);
    this.addPointLight(x, 2.55, z, 0xffc96d, 1.08, 3.0);
  }

  private addFramedPanel(
    center: THREE.Vector3,
    width: number,
    height: number,
    side: 'back' | 'left' | 'right',
    panelMat: THREE.Material,
    insetMat: THREE.Material,
    trimMat: THREE.Material
  ): void {
    if (side === 'back') {
      this.addBox(center, new THREE.Vector3(width, height, 0.06), panelMat, true, true);
      this.addBox(center.clone().add(new THREE.Vector3(0, 0, 0.04)), new THREE.Vector3(width - 0.18, height - 0.22, 0.06), insetMat, false, true);
      this.addBox(center.clone().add(new THREE.Vector3(0, height / 2, 0.07)), new THREE.Vector3(width + 0.16, 0.045, 0.08), trimMat, true, true);
      this.addBox(center.clone().add(new THREE.Vector3(0, -height / 2, 0.07)), new THREE.Vector3(width + 0.16, 0.045, 0.08), trimMat, true, true);
      this.addBox(center.clone().add(new THREE.Vector3(-width / 2, 0, 0.07)), new THREE.Vector3(0.045, height + 0.16, 0.08), trimMat, true, true);
      this.addBox(center.clone().add(new THREE.Vector3(width / 2, 0, 0.07)), new THREE.Vector3(0.045, height + 0.16, 0.08), trimMat, true, true);
      return;
    }

    const xOffset = side === 'left' ? 0.05 : -0.05;
    this.addBox(center, new THREE.Vector3(0.06, height, width), panelMat, true, true);
    this.addBox(center.clone().add(new THREE.Vector3(xOffset, 0, 0)), new THREE.Vector3(0.06, height - 0.22, width - 0.18), insetMat, false, true);
    this.addBox(center.clone().add(new THREE.Vector3(xOffset, height / 2, 0)), new THREE.Vector3(0.08, 0.045, width + 0.16), trimMat, true, true);
    this.addBox(center.clone().add(new THREE.Vector3(xOffset, -height / 2, 0)), new THREE.Vector3(0.08, 0.045, width + 0.16), trimMat, true, true);
    this.addBox(center.clone().add(new THREE.Vector3(xOffset, 0, -width / 2)), new THREE.Vector3(0.08, height + 0.16, 0.045), trimMat, true, true);
    this.addBox(center.clone().add(new THREE.Vector3(xOffset, 0, width / 2)), new THREE.Vector3(0.08, height + 0.16, 0.045), trimMat, true, true);
  }

  private addWindowLightPatch(x: number, z: number): void {
    const lightPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 5.4),
      new THREE.MeshBasicMaterial({ color: 0xf1f7ff, transparent: true, opacity: 0.13, depthWrite: false })
    );
    lightPlane.position.set(x, 0.085, z);
    lightPlane.rotation.x = -Math.PI / 2;
    lightPlane.rotation.z = -0.38;
    this.scene.add(lightPlane);
  }

  private addBox(position: THREE.Vector3, scale: THREE.Vector3, material: THREE.Material, castShadow: boolean, receiveShadow: boolean): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(scale.x, scale.y, scale.z), material);
    mesh.position.copy(position);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    this.scene.add(mesh);
    return mesh;
  }

  private addBoxToGroup(parent: THREE.Object3D, position: THREE.Vector3, scale: THREE.Vector3, material: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(scale.x, scale.y, scale.z), material);
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private addFlatPlane(position: THREE.Vector3, size: THREE.Vector2, material: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.y), material);
    mesh.position.copy(position);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  private addPointLight(x: number, y: number, z: number, color: number, intensity: number, distance: number): void {
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(x, y, z);
    this.scene.add(light);
  }

  private makeMarbleTexture(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#d8d0dc');
    gradient.addColorStop(0.48, '#afa0b9');
    gradient.addColorStop(1, '#f0e8f3');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= size; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(64,48,82,0.18)';
    for (let i = 0; i < 42; i += 1) {
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

  private makePlasterTexture(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#c8bdc9');
    gradient.addColorStop(0.52, '#a99dae');
    gradient.addColorStop(1, '#d7ccd8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 140; i += 1) {
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

  private makeWoodTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

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

  private makeCarpetTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.fillStyle = '#6c2f71';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(255,220,139,0.32)';
    ctx.lineWidth = 5;
    ctx.strokeRect(16, 16, size - 32, size - 32);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let x = 12; x < size; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 42, size);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.15, 0.8);
    texture.anisotropy = 8;
    return texture;
  }
}
