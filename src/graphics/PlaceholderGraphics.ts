// src/graphics/PlaceholderGraphics.ts
// Runtime-generated pixel textures for the magic academy prototype.

import Phaser from 'phaser';

const TEXTURE_PREFIX = 'placeholder_';

function fillDiamond(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  alpha = 1
): void {
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(x, y - h / 2);
  g.lineTo(x + w / 2, y);
  g.lineTo(x, y + h / 2);
  g.lineTo(x - w / 2, y);
  g.closePath();
  g.fillPath();
}

function strokeDiamond(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  alpha = 1
): void {
  g.lineStyle(1, color, alpha);
  g.beginPath();
  g.moveTo(x, y - h / 2);
  g.lineTo(x + w / 2, y);
  g.lineTo(x, y + h / 2);
  g.lineTo(x - w / 2, y);
  g.closePath();
  g.strokePath();
}

function drawStar(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number): void {
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(x, y - r);
  g.lineTo(x + r * 0.28, y - r * 0.28);
  g.lineTo(x + r, y);
  g.lineTo(x + r * 0.28, y + r * 0.28);
  g.lineTo(x, y + r);
  g.lineTo(x - r * 0.28, y + r * 0.28);
  g.lineTo(x - r, y);
  g.lineTo(x - r * 0.28, y - r * 0.28);
  g.closePath();
  g.fillPath();
}

/** A young male academy student sprite with a stronger silhouette. */
export function createPlayerTexture(scene: Phaser.Scene): void {
  const key = TEXTURE_PREFIX + 'player';
  if (scene.textures.exists(key)) return;

  const g = scene.add.graphics();
  const w = 48;
  const h = 64;

  // Coat tails.
  g.fillStyle(0x15213f, 1);
  g.fillTriangle(16, 34, 8, 60, 23, 57);
  g.fillTriangle(32, 34, 40, 60, 25, 57);

  // Body: fitted academy jacket and shirt.
  g.fillStyle(0x244f90, 1);
  g.fillRoundedRect(13, 25, 22, 29, 5);
  g.fillStyle(0x4d82d9, 1);
  g.fillRoundedRect(15, 27, 8, 25, 3);
  g.fillStyle(0xf6f1e7, 1);
  g.fillTriangle(24, 27, 18, 42, 31, 42);
  g.fillStyle(0xf4ca5f, 1);
  g.fillRect(18, 38, 13, 2);
  g.fillStyle(0xd44d72, 1);
  g.fillTriangle(24, 31, 20, 44, 28, 44);

  // Boots.
  g.fillStyle(0x171225, 1);
  g.fillRect(15, 54, 8, 5);
  g.fillRect(26, 54, 8, 5);

  // Neck and face.
  g.fillStyle(0xe8bd93, 1);
  g.fillRect(20, 20, 8, 8);
  g.fillCircle(24, 16, 9);
  g.fillStyle(0xf5d0a8, 1);
  g.fillCircle(21, 15, 2);

  // Tousled young male hair.
  g.fillStyle(0x2b1c32, 1);
  g.fillCircle(24, 11, 10);
  g.fillRect(15, 11, 18, 8);
  g.fillTriangle(16, 10, 22, 6, 21, 18);
  g.fillTriangle(23, 9, 29, 4, 28, 18);
  g.fillTriangle(30, 11, 37, 9, 32, 21);
  g.fillStyle(0x6d4268, 0.9);
  g.fillRect(19, 8, 3, 3);
  g.fillRect(27, 7, 2, 4);

  // Face details.
  g.fillStyle(0x1a1426, 1);
  g.fillRect(20, 15, 2, 2);
  g.fillRect(27, 15, 2, 2);
  g.fillStyle(0xc97992, 1);
  g.fillRect(23, 20, 4, 1);

  // Wand and spell glint.
  g.fillStyle(0x7a4a24, 1);
  g.fillRect(38, 17, 3, 32);
  g.fillStyle(0x9ad7ff, 1);
  g.fillCircle(39, 15, 4);
  drawStar(g, 39, 15, 6, 0xc7f3ff);

  // Satchel.
  g.fillStyle(0x6b3f2b, 1);
  g.fillRoundedRect(9, 34, 9, 12, 2);
  g.lineStyle(1, 0xd7a15c, 1);
  g.strokeRoundedRect(9, 34, 9, 12, 2);

  g.generateTexture(key, w, h);
  g.destroy();
}

/** Lyra-style NPC texture, tinted by data color but with a defined academy look. */
export function createNPCTexture(scene: Phaser.Scene, key: string, color: number): void {
  const texKey = TEXTURE_PREFIX + 'npc_' + key;
  if (scene.textures.exists(texKey)) return;

  const g = scene.add.graphics();
  const w = 54;
  const h = 74;
  const tint = Phaser.Display.Color.IntegerToRGB(color);
  const hair = Phaser.Display.Color.GetColor(
    Math.min(255, tint.r + 70),
    Math.min(255, tint.g + 92),
    Math.min(255, tint.b + 120)
  );
  const deep = Phaser.Display.Color.GetColor(
    Math.max(0, tint.r - 42),
    Math.max(0, tint.g - 42),
    Math.max(0, tint.b - 30)
  );

  // Hair behind body.
  g.fillStyle(hair, 1);
  g.fillRoundedRect(13, 10, 28, 42, 13);
  g.fillStyle(0xbfdcff, 0.7);
  g.fillRect(18, 14, 3, 38);
  g.fillRect(34, 16, 2, 32);

  // Dress and academy cloak.
  g.fillStyle(deep, 1);
  g.fillTriangle(27, 25, 9, 68, 45, 68);
  g.fillStyle(color, 1);
  g.fillRoundedRect(17, 27, 20, 27, 5);
  g.fillStyle(0xf8f1ff, 1);
  g.fillTriangle(27, 28, 20, 42, 34, 42);
  g.fillStyle(0xffe28a, 1);
  g.fillRect(21, 45, 13, 3);

  // Sleeves and hands.
  g.fillStyle(deep, 1);
  g.fillRoundedRect(9, 31, 10, 18, 4);
  g.fillRoundedRect(35, 31, 10, 18, 4);
  g.fillStyle(0xe8bd93, 1);
  g.fillCircle(14, 50, 3);
  g.fillCircle(40, 50, 3);

  // Book.
  g.fillStyle(0x273056, 1);
  g.fillRoundedRect(30, 44, 14, 16, 2);
  g.fillStyle(0xffe28a, 1);
  g.fillRect(36, 45, 1, 14);
  g.lineStyle(1, 0x91cfff, 1);
  g.strokeRoundedRect(30, 44, 14, 16, 2);

  // Face and front hair.
  g.fillStyle(0xf2c69f, 1);
  g.fillCircle(27, 20, 10);
  g.fillStyle(hair, 1);
  g.fillCircle(27, 13, 10);
  g.fillRect(17, 13, 20, 7);
  g.fillTriangle(19, 15, 24, 15, 20, 28);
  g.fillTriangle(31, 15, 38, 16, 35, 30);

  // Hair ornament and face.
  drawStar(g, 38, 12, 4, 0xffe28a);
  g.fillStyle(0x20203a, 1);
  g.fillRect(23, 20, 2, 2);
  g.fillRect(30, 20, 2, 2);
  g.fillStyle(0xc96d8b, 1);
  g.fillRect(25, 25, 5, 1);
  g.fillStyle(0xff9ab6, 0.75);
  g.fillCircle(20, 24, 2);
  g.fillCircle(34, 24, 2);

  // Small magic glints.
  drawStar(g, 10, 16, 2, 0xc7f3ff);
  drawStar(g, 45, 28, 2, 0xffef8a);

  g.generateTexture(texKey, w, h);
  g.destroy();
}

export function createPlayerPortraitTexture(scene: Phaser.Scene): void {
  const key = TEXTURE_PREFIX + 'portrait_player';
  if (scene.textures.exists(key)) return;

  const g = scene.add.graphics();
  const w = 160;
  const h = 196;

  // Back glow and shoulders.
  g.fillStyle(0x233d76, 0.35);
  g.fillEllipse(82, 104, 124, 170);
  g.fillStyle(0x142040, 1);
  g.fillRoundedRect(34, 120, 92, 74, 18);
  g.fillStyle(0x275aa0, 1);
  g.fillRoundedRect(43, 112, 74, 80, 16);
  g.fillStyle(0x4f8ee8, 1);
  g.fillRoundedRect(45, 116, 22, 70, 10);
  g.fillStyle(0xf5f0e7, 1);
  g.fillTriangle(80, 116, 52, 174, 108, 174);
  g.fillStyle(0xd95072, 1);
  g.fillTriangle(80, 126, 66, 176, 94, 176);
  g.fillStyle(0xf2cf70, 1);
  g.fillRect(49, 154, 62, 4);

  // Neck and face.
  g.fillStyle(0xd99b79, 1);
  g.fillRoundedRect(66, 96, 29, 32, 9);
  g.fillStyle(0xf0bd92, 1);
  g.fillEllipse(80, 70, 62, 78);
  g.fillStyle(0xffd2aa, 0.9);
  g.fillEllipse(66, 63, 18, 28);

  // Hair mass and loose locks.
  g.fillStyle(0x2b1b31, 1);
  g.fillEllipse(79, 44, 73, 48);
  g.fillRoundedRect(43, 39, 72, 34, 17);
  g.fillTriangle(42, 53, 62, 38, 55, 94);
  g.fillTriangle(63, 38, 83, 28, 73, 83);
  g.fillTriangle(88, 34, 116, 41, 101, 96);
  g.fillStyle(0x6f426a, 0.95);
  g.fillTriangle(55, 42, 70, 35, 63, 72);
  g.fillTriangle(84, 35, 99, 38, 92, 77);

  // Eyes, brows, nose, mouth.
  g.fillStyle(0x191223, 1);
  g.fillRoundedRect(58, 69, 13, 4, 2);
  g.fillRoundedRect(90, 69, 13, 4, 2);
  g.fillStyle(0x3e2d62, 1);
  g.fillEllipse(65, 78, 9, 13);
  g.fillEllipse(96, 78, 9, 13);
  g.fillStyle(0x95d8ff, 1);
  g.fillCircle(62, 74, 2);
  g.fillCircle(93, 74, 2);
  g.lineStyle(2, 0xb77a67, 0.75);
  g.lineBetween(80, 78, 76, 92);
  g.fillStyle(0xb85d73, 1);
  g.fillRoundedRect(72, 101, 17, 4, 2);
  g.fillStyle(0xe8899b, 0.45);
  g.fillEllipse(50, 92, 15, 8);
  g.fillEllipse(111, 92, 15, 8);

  // Wand and small spell light.
  g.fillStyle(0x7b4a28, 1);
  g.fillRoundedRect(121, 92, 6, 82, 3);
  g.fillStyle(0xbfeeff, 1);
  g.fillCircle(124, 88, 8);
  drawStar(g, 124, 88, 14, 0xd8f7ff);
  drawStar(g, 136, 69, 5, 0xffef8a);

  g.generateTexture(key, w, h);
  g.destroy();
}

export function createLyraPortraitTexture(scene: Phaser.Scene): void {
  const key = TEXTURE_PREFIX + 'portrait_lyra';
  if (scene.textures.exists(key)) return;

  const g = scene.add.graphics();
  const w = 170;
  const h = 206;

  // Soft magical aura.
  g.fillStyle(0x8fb8ff, 0.20);
  g.fillEllipse(86, 105, 132, 184);
  g.fillStyle(0xf3d9ff, 0.18);
  g.fillEllipse(94, 92, 102, 150);

  // Long hair behind body.
  g.fillStyle(0x9fc9ff, 1);
  g.fillRoundedRect(34, 18, 108, 164, 42);
  g.fillStyle(0x6e81d8, 1);
  g.fillRoundedRect(40, 28, 94, 154, 36);
  g.fillStyle(0xd5f0ff, 0.75);
  g.fillRect(55, 32, 5, 138);
  g.fillRect(116, 42, 4, 118);
  g.fillStyle(0xffc9ee, 0.5);
  g.fillRect(70, 30, 3, 132);

  // Shoulders, dress, book.
  g.fillStyle(0x3d2376, 1);
  g.fillRoundedRect(35, 126, 101, 76, 22);
  g.fillStyle(0x7453d6, 1);
  g.fillRoundedRect(50, 118, 72, 84, 18);
  g.fillStyle(0xfff6fa, 1);
  g.fillTriangle(86, 118, 59, 178, 112, 178);
  g.fillStyle(0xffd96f, 1);
  g.fillRect(58, 158, 55, 4);
  g.fillStyle(0x26345c, 1);
  g.fillRoundedRect(101, 139, 40, 50, 5);
  g.fillStyle(0x9fdcff, 1);
  g.fillRect(120, 143, 2, 42);
  g.lineStyle(2, 0xffe28a, 0.85);
  g.strokeRoundedRect(101, 139, 40, 50, 5);

  // Neck and face.
  g.fillStyle(0xe6aa8a, 1);
  g.fillRoundedRect(73, 96, 28, 31, 10);
  g.fillStyle(0xf4c8a4, 1);
  g.fillEllipse(86, 69, 61, 76);
  g.fillStyle(0xffd8b9, 0.9);
  g.fillEllipse(70, 61, 15, 24);

  // Front hair and bangs.
  g.fillStyle(0xbadfff, 1);
  g.fillEllipse(84, 36, 75, 48);
  g.fillRoundedRect(48, 36, 74, 26, 16);
  g.fillTriangle(51, 45, 76, 35, 61, 103);
  g.fillTriangle(76, 36, 98, 31, 84, 93);
  g.fillTriangle(102, 39, 132, 45, 111, 109);
  g.fillStyle(0xf0fbff, 0.88);
  g.fillTriangle(62, 38, 78, 34, 67, 86);
  g.fillTriangle(93, 34, 109, 39, 101, 87);

  // Star hair ornament.
  drawStar(g, 124, 38, 11, 0xffe28a);
  g.fillStyle(0xfff2aa, 1);
  g.fillCircle(124, 38, 3);

  // Expressive eyes.
  g.fillStyle(0x281a42, 1);
  g.fillRoundedRect(61, 70, 15, 5, 3);
  g.fillRoundedRect(95, 70, 15, 5, 3);
  g.fillStyle(0x6044b8, 1);
  g.fillEllipse(69, 82, 12, 18);
  g.fillEllipse(101, 82, 12, 18);
  g.fillStyle(0xbfeeff, 1);
  g.fillCircle(65, 76, 3);
  g.fillCircle(97, 76, 3);
  g.fillStyle(0xfff7ff, 1);
  g.fillCircle(72, 86, 2);
  g.fillCircle(104, 86, 2);

  // Face details.
  g.lineStyle(2, 0xb77a67, 0.55);
  g.lineBetween(86, 82, 82, 96);
  g.fillStyle(0xc96786, 1);
  g.fillRoundedRect(77, 107, 20, 4, 2);
  g.fillStyle(0xff9ab6, 0.45);
  g.fillEllipse(55, 96, 17, 9);
  g.fillEllipse(118, 96, 17, 9);

  // Magic motes.
  drawStar(g, 34, 76, 5, 0xffef8a);
  drawStar(g, 142, 88, 4, 0xd8f7ff);
  drawStar(g, 43, 132, 4, 0xffb7e7);

  g.generateTexture(key, w, h);
  g.destroy();
}

export function createCharacterShadowTexture(scene: Phaser.Scene): void {
  const key = TEXTURE_PREFIX + 'shadow';
  if (scene.textures.exists(key)) return;

  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.34);
  g.fillEllipse(30, 11, 56, 18);
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(30, 11, 38, 11);
  g.generateTexture(key, 60, 24);
  g.destroy();
}

/** Prompt marker for interaction. */
export function createInteractionPromptTexture(scene: Phaser.Scene): void {
  const key = TEXTURE_PREFIX + 'prompt_e';
  if (scene.textures.exists(key)) return;

  const g = scene.add.graphics();
  g.fillStyle(0x160f24, 0.9);
  g.fillCircle(14, 14, 13);
  g.lineStyle(2, 0xffdf75, 1);
  g.strokeCircle(14, 14, 12);
  g.fillStyle(0xffdf75, 1);
  g.fillRoundedRect(9, 7, 10, 14, 2);
  g.fillStyle(0x160f24, 1);
  g.fillRect(12, 10, 6, 2);
  g.fillRect(12, 13, 5, 2);
  g.fillRect(12, 16, 6, 2);
  g.generateTexture(key, 28, 28);
  g.destroy();
}

/** Kept for compatibility; the scene now draws the main isometric floor directly. */
export function createFloorTexture(scene: Phaser.Scene): void {
  const key = TEXTURE_PREFIX + 'floor';
  if (scene.textures.exists(key)) return;

  const g = scene.add.graphics();
  fillDiamond(g, 32, 20, 64, 32, 0x40395d, 1);
  strokeDiamond(g, 32, 20, 64, 32, 0x5b527e, 0.8);
  g.fillStyle(0xc7b7ff, 0.3);
  g.fillRect(28, 12, 2, 2);
  g.generateTexture(key, 64, 40);
  g.destroy();
}

export function createCarpetTexture(scene: Phaser.Scene): void {
  const key = TEXTURE_PREFIX + 'carpet';
  if (scene.textures.exists(key)) return;

  const g = scene.add.graphics();
  const w = 260;
  const h = 130;
  fillDiamond(g, w / 2, h / 2, w, h, 0x5a286a, 1);
  strokeDiamond(g, w / 2, h / 2, w - 18, h - 10, 0xf3ce78, 0.9);
  strokeDiamond(g, w / 2, h / 2, w - 46, h - 26, 0xd891df, 0.55);
  drawStar(g, w / 2, h / 2, 12, 0xffe28a);
  drawStar(g, w / 2 - 48, h / 2, 5, 0xffe28a);
  drawStar(g, w / 2 + 48, h / 2, 5, 0xffe28a);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function createBookshelfTexture(scene: Phaser.Scene): void {
  const key = TEXTURE_PREFIX + 'bookshelf';
  if (scene.textures.exists(key)) return;

  const g = scene.add.graphics();
  const w = 96;
  const h = 136;
  g.fillStyle(0x1a1122, 0.45);
  g.fillEllipse(48, 128, 82, 14);
  g.fillStyle(0x4b2c52, 1);
  g.fillRoundedRect(8, 12, 74, 112, 4);
  g.fillStyle(0x2a1732, 1);
  g.fillRect(74, 20, 12, 102);
  g.fillStyle(0x6d4a78, 1);
  g.fillRect(12, 18, 60, 5);
  g.fillRect(12, 51, 60, 5);
  g.fillRect(12, 84, 60, 5);
  g.fillRect(12, 117, 60, 5);

  const colors = [0x7c4dff, 0xffd76b, 0xff7fb0, 0x71d8ff, 0xc0ff8a, 0xe28cff];
  for (let shelf = 0; shelf < 3; shelf++) {
    for (let i = 0; i < 8; i++) {
      const bh = 18 + ((shelf + i) % 3) * 4;
      const x = 15 + i * 7;
      const y = 29 + shelf * 33 + (23 - bh);
      g.fillStyle(colors[(shelf + i) % colors.length], 1);
      g.fillRect(x, y, 5, bh);
      g.fillStyle(0xffffff, 0.18);
      g.fillRect(x + 1, y + 2, 1, bh - 4);
    }
  }

  g.lineStyle(2, 0xb98b54, 1);
  g.strokeRoundedRect(8, 12, 74, 112, 4);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function createStudyTableTexture(scene: Phaser.Scene): void {
  const key = TEXTURE_PREFIX + 'study_table';
  if (scene.textures.exists(key)) return;

  const g = scene.add.graphics();
  const w = 142;
  const h = 92;
  g.fillStyle(0x000000, 0.24);
  g.fillEllipse(70, 78, 112, 18);
  fillDiamond(g, 70, 44, 124, 48, 0x7b4b38, 1);
  strokeDiamond(g, 70, 44, 124, 48, 0xc08a5a, 1);
  g.fillStyle(0x4b2e2d, 1);
  g.fillRect(30, 47, 8, 30);
  g.fillRect(105, 47, 8, 30);
  g.fillStyle(0xffe28a, 1);
  g.fillCircle(72, 38, 5);
  g.lineStyle(1, 0xffe28a, 0.8);
  g.strokeCircle(72, 38, 13);
  g.fillStyle(0x26345c, 1);
  g.fillRoundedRect(47, 35, 24, 18, 2);
  g.fillStyle(0x91cfff, 1);
  g.fillRect(59, 36, 1, 16);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function createWindowTexture(scene: Phaser.Scene): void {
  const key = TEXTURE_PREFIX + 'window';
  if (scene.textures.exists(key)) return;

  const g = scene.add.graphics();
  const w = 72;
  const h = 116;
  g.fillStyle(0x1b1730, 1);
  g.fillRoundedRect(8, 6, 56, 98, 18);
  g.fillStyle(0x84d9ff, 0.75);
  g.fillRoundedRect(14, 12, 44, 84, 14);
  g.fillStyle(0xdff8ff, 0.55);
  g.fillTriangle(17, 15, 56, 15, 17, 83);
  g.lineStyle(3, 0xd9b66f, 1);
  g.strokeRoundedRect(8, 6, 56, 98, 18);
  g.lineBetween(36, 10, 36, 100);
  g.lineBetween(12, 52, 60, 52);
  g.fillStyle(0xdff8ff, 0.22);
  g.fillEllipse(36, 111, 60, 10);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function createPillarTexture(scene: Phaser.Scene): void {
  const key = TEXTURE_PREFIX + 'pillar';
  if (scene.textures.exists(key)) return;

  const g = scene.add.graphics();
  const w = 56;
  const h = 156;
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(28, 147, 48, 12);
  g.fillStyle(0x3f365f, 1);
  g.fillRoundedRect(15, 20, 26, 120, 8);
  g.fillStyle(0x625789, 1);
  g.fillRoundedRect(18, 22, 9, 116, 5);
  g.fillStyle(0x2b2445, 1);
  g.fillRoundedRect(30, 23, 8, 114, 5);
  g.fillStyle(0xcaa768, 1);
  g.fillRoundedRect(8, 12, 40, 16, 3);
  g.fillRoundedRect(7, 132, 42, 14, 3);
  drawStar(g, 28, 42, 4, 0xffe28a);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function createFloatingBookTexture(scene: Phaser.Scene): void {
  const key = TEXTURE_PREFIX + 'floating_book';
  if (scene.textures.exists(key)) return;

  const g = scene.add.graphics();
  const w = 54;
  const h = 38;
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(27, 31, 36, 8);
  g.fillStyle(0xf5e6c8, 1);
  g.fillRoundedRect(9, 10, 16, 15, 2);
  g.fillRoundedRect(27, 10, 16, 15, 2);
  g.fillStyle(0x6b3f8f, 1);
  g.fillRect(24, 9, 4, 18);
  g.lineStyle(1, 0xb79a6d, 1);
  g.lineBetween(13, 14, 22, 14);
  g.lineBetween(13, 18, 22, 18);
  g.lineBetween(31, 14, 40, 14);
  g.lineBetween(31, 18, 40, 18);
  drawStar(g, 45, 8, 3, 0xffe28a);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function createDoorArchTexture(scene: Phaser.Scene): void {
  const key = TEXTURE_PREFIX + 'door_arch';
  if (scene.textures.exists(key)) return;

  const g = scene.add.graphics();
  const w = 118;
  const h = 166;
  g.fillStyle(0x120d1e, 1);
  g.fillRoundedRect(16, 24, 86, 128, 36);
  g.fillStyle(0x312647, 1);
  g.fillRoundedRect(27, 38, 64, 106, 28);
  g.lineStyle(4, 0xcaa768, 1);
  g.strokeRoundedRect(16, 24, 86, 128, 36);
  g.fillStyle(0x86d9ff, 0.24);
  g.fillEllipse(59, 102, 44, 88);
  drawStar(g, 59, 72, 7, 0xffe28a);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function createAllPlaceholderTextures(scene: Phaser.Scene): void {
  createPlayerTexture(scene);
  createPlayerPortraitTexture(scene);
  createLyraPortraitTexture(scene);
  createInteractionPromptTexture(scene);
  createFloorTexture(scene);
  createCarpetTexture(scene);
  createCharacterShadowTexture(scene);
  createBookshelfTexture(scene);
  createStudyTableTexture(scene);
  createWindowTexture(scene);
  createPillarTexture(scene);
  createFloatingBookTexture(scene);
  createDoorArchTexture(scene);
}
