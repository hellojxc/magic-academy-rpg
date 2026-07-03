import * as THREE from 'three';
import type { AcademyWorldObjects, Obstacle } from './WorldTypes';

export class AcademyWorld {
  private readonly obstacles: Obstacle[] = [];
  private player!: THREE.Sprite;
  private lyra!: THREE.Sprite;

  constructor(private readonly scene: THREE.Scene) {}

  build(): AcademyWorldObjects {
    this.scene.background = new THREE.Color(0x110b1d);
    this.scene.fog = new THREE.Fog(0x171024, 10, 27);

    this.addLights();
    this.addAcademyArchitecture();
    this.addCharacters();
    this.addParticles();

    return {
      player: this.player,
      lyra: this.lyra,
      obstacles: this.obstacles,
    };
  }

  update(elapsedTime: number): void {
    this.lyra.position.y = 0.86 + Math.sin(elapsedTime * 2.2) * 0.035;
    this.lyra.scale.y = 1.72 + Math.sin(elapsedTime * 2.2) * 0.025;
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x211124, 1.8));

    const sun = new THREE.DirectionalLight(0xffe2b0, 3.2);
    sun.position.set(-5.5, 8, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 24;
    sun.shadow.camera.left = -9;
    sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 9;
    sun.shadow.camera.bottom = -9;
    this.scene.add(sun);

    this.addPointLight(-4.8, 2.2, -3.4, 0xffd46e, 2.4, 5.2);
    this.addPointLight(4.8, 2.2, -3.4, 0xffd46e, 2.2, 5.2);
    this.addPointLight(4.8, 1.5, 0.0, 0xbda5ff, 2.0, 4.5);
  }

  private addAcademyArchitecture(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 10, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0xb9a7c4,
        roughness: 0.32,
        metalness: 0.08,
        map: this.makeMarbleTexture(),
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.addBackWall();
    this.addWindows();
    this.addColumns();
    this.addLibrary();
    this.addCarpet();
    this.addFloorTrim();

    this.obstacles.push(
      { minX: -7.8, maxX: 7.8, minZ: -5.0, maxZ: -4.55 },
      { minX: 4.2, maxX: 7.4, minZ: -4.4, maxZ: -2.55 },
      { minX: 3.95, maxX: 6.8, minZ: -0.92, maxZ: 0.45 },
      { minX: -5.3, maxX: -4.55, minZ: -3.95, maxZ: -2.65 },
      { minX: 4.2, maxX: 4.85, minZ: -3.95, maxZ: -2.65 },
      { minX: -3.15, maxX: -2.45, minZ: -0.1, maxZ: 1.0 },
      { minX: -7.9, maxX: -7.1, minZ: 1.8, maxZ: 4.8 },
      { minX: 7.1, maxX: 7.9, minZ: 1.0, maxZ: 4.8 }
    );
  }

  private addBackWall(): void {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2d2444, roughness: 0.58, metalness: 0.05 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(17, 5.2, 0.3), wallMat);
    wall.position.set(0, 2.6, -5.1);
    wall.receiveShadow = true;
    this.scene.add(wall);

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 3.5, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x35224f, roughness: 0.45, metalness: 0.2, emissive: 0x120627 })
    );
    door.position.set(0, 1.72, -4.91);
    this.scene.add(door);

    this.addGoldTrim(new THREE.Vector3(0, 3.6, -4.85), new THREE.Vector3(1.9, 0.09, 0.08));
    this.addGoldTrim(new THREE.Vector3(0, 0.02, -4.85), new THREE.Vector3(16.6, 0.08, 0.08));
  }

  private addWindows(): void {
    for (const x of [-4.8, 4.8]) {
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.35, 2.8),
        new THREE.MeshBasicMaterial({ color: 0xaed9ff, transparent: true, opacity: 0.66 })
      );
      glow.position.set(x, 2.65, -4.88);
      this.scene.add(glow);

      const frameMat = new THREE.MeshStandardMaterial({ color: 0xc69c5c, roughness: 0.28, metalness: 0.45 });
      for (const offset of [-0.72, 0.72]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.07, 3.0, 0.08), frameMat);
        side.position.set(x + offset, 2.65, -4.8);
        this.scene.add(side);
      }
      const cross = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.06, 0.08), frameMat);
      cross.position.set(x, 2.65, -4.79);
      this.scene.add(cross);

      const lightPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 5.6),
        new THREE.MeshBasicMaterial({ color: 0xdceeff, transparent: true, opacity: 0.12, depthWrite: false })
      );
      lightPlane.position.set(x - 0.6, 0.04, -1.8);
      lightPlane.rotation.x = -Math.PI / 2;
      lightPlane.rotation.z = -0.36;
      this.scene.add(lightPlane);
    }
  }

  private addColumns(): void {
    const spots: Array<[number, number]> = [
      [-6.4, -3.4],
      [-2.8, -0.2],
      [4.6, -3.4],
      [6.4, 2.7],
    ];

    for (const [x, z] of spots) {
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.33, 0.43, 0.18, 24),
        new THREE.MeshStandardMaterial({ color: 0x4b3b5e, roughness: 0.44, metalness: 0.12 })
      );
      base.position.set(x, 0.09, z);
      base.castShadow = true;
      base.receiveShadow = true;
      this.scene.add(base);

      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 1.55, 24),
        new THREE.MeshStandardMaterial({ color: 0x64567d, roughness: 0.38, metalness: 0.18 })
      );
      pillar.position.set(x, 0.88, z);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.scene.add(pillar);

      const lamp = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.16, 1),
        new THREE.MeshStandardMaterial({ color: 0xffd674, emissive: 0xffb847, emissiveIntensity: 1.8 })
      );
      lamp.position.set(x, 1.85, z);
      this.scene.add(lamp);
      this.addPointLight(x, 1.8, z, 0xffc96d, 1.2, 2.8);
    }
  }

  private addLibrary(): void {
    this.addBookshelf(5.35, -4.42);
    this.addBookshelf(6.65, -4.42);

    const tableMat = new THREE.MeshStandardMaterial({ color: 0x5b3324, roughness: 0.42, metalness: 0.12 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 1.1), tableMat);
    top.position.set(5.2, 0.58, -0.3);
    top.castShadow = true;
    top.receiveShadow = true;
    this.scene.add(top);

    for (const x of [4.35, 6.05]) {
      for (const z of [-0.72, 0.12]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.58, 0.14), tableMat);
        leg.position.set(x, 0.29, z);
        leg.castShadow = true;
        this.scene.add(leg);
      }
    }

    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.08, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x56315c, roughness: 0.5, metalness: 0.08 })
    );
    book.position.set(4.95, 0.71, -0.28);
    book.rotation.y = 0.22;
    book.castShadow = true;
    this.scene.add(book);
  }

  private addBookshelf(x: number, z: number): void {
    const shelf = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a2b29, roughness: 0.52, metalness: 0.08 });
    const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.7, 0.38), wood);
    caseMesh.position.set(0, 1.35, 0);
    caseMesh.castShadow = true;
    caseMesh.receiveShadow = true;
    shelf.add(caseMesh);

    const bookColors = [0x7c4dff, 0xffcf6b, 0x6fd8ff, 0xe16aa8, 0xb5ef7a];
    for (let row = 0; row < 5; row += 1) {
      for (let i = 0; i < 7; i += 1) {
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(0.09, 0.34 + ((row + i) % 3) * 0.05, 0.08),
          new THREE.MeshStandardMaterial({ color: bookColors[(row + i) % bookColors.length], roughness: 0.5 })
        );
        book.position.set(-0.38 + i * 0.13, 0.36 + row * 0.45, 0.24);
        shelf.add(book);
      }
    }

    shelf.position.set(x, 0, z);
    this.scene.add(shelf);
  }

  private addCarpet(): void {
    const carpet = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x5d2a75, roughness: 0.72, metalness: 0.02 })
    );
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(4.6, 0.012, 1.9);
    carpet.receiveShadow = true;
    this.scene.add(carpet);

    const star = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd76d })
    );
    star.rotation.x = -Math.PI / 2;
    star.rotation.z = Math.PI / 6;
    star.position.set(4.6, 0.025, 1.9);
    this.scene.add(star);
  }

  private addFloorTrim(): void {
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xc7a060, roughness: 0.28, metalness: 0.4 });
    const strips: Array<[number, number, number, number]> = [
      [0, 0.02, 8.8, 0.04],
      [0, 2.35, 10.8, 0.045],
      [-5.7, 0.65, 0.045, 6.2],
      [7.0, 0.55, 0.045, 7.8],
    ];
    for (const [x, z, w, d] of strips) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, d), trimMat);
      strip.position.set(x, 0.035, z);
      strip.receiveShadow = true;
      this.scene.add(strip);
    }
  }

  private addCharacters(): void {
    const loader = new THREE.TextureLoader();
    const playerTexture = loader.load('/assets/sprites/player-chibi-3d.png');
    const lyraTexture = loader.load('/assets/sprites/lyra-chibi-3d.png');
    playerTexture.colorSpace = THREE.SRGBColorSpace;
    lyraTexture.colorSpace = THREE.SRGBColorSpace;

    this.player = this.createCharacterSprite(playerTexture, 0.95, 1.5);
    this.player.position.set(-5.2, 0.75, 2.3);
    this.scene.add(this.player);

    this.lyra = this.createCharacterSprite(lyraTexture, 1.05, 1.72);
    this.lyra.position.set(5.3, 0.86, -1.25);
    this.scene.add(this.lyra);
  }

  private createCharacterSprite(texture: THREE.Texture, width: number, height: number): THREE.Sprite {
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      alphaTest: 0.08,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(width, height, 1);
    return sprite;
  }

  private addParticles(): void {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    for (let i = 0; i < 90; i += 1) {
      positions.push(
        THREE.MathUtils.randFloatSpread(13),
        THREE.MathUtils.randFloat(0.9, 4.6),
        THREE.MathUtils.randFloat(-4.6, 3.8)
      );
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: 0xffe2a8, size: 0.035, transparent: true, opacity: 0.72 })
    );
    this.scene.add(particles);
  }

  private addGoldTrim(position: THREE.Vector3, scale: THREE.Vector3): void {
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(scale.x, scale.y, scale.z),
      new THREE.MeshStandardMaterial({ color: 0xc8a05d, roughness: 0.24, metalness: 0.55 })
    );
    trim.position.copy(position);
    trim.castShadow = true;
    this.scene.add(trim);
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
    gradient.addColorStop(0, '#cfc4db');
    gradient.addColorStop(0.5, '#998aad');
    gradient.addColorStop(1, '#e7dff0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(255,255,255,0.34)';
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
    ctx.strokeStyle = 'rgba(70,50,90,0.18)';
    for (let i = 0; i < 36; i += 1) {
      const y = Math.random() * size;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        size * 0.3,
        y + Math.random() * 90 - 45,
        size * 0.6,
        y + Math.random() * 90 - 45,
        size,
        y + Math.random() * 90 - 45
      );
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3.5, 2.2);
    texture.anisotropy = 8;
    return texture;
  }
}
