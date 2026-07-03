// src/scenes/AcademyScene.ts
// 魔法学院大厅场景：地板、图书馆区域、NPC、玩家、交互系统。

import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { NPC } from '../entities/NPC';
import { DialogueBox } from '../ui/DialogueBox';
import { SaveSystem } from '../systems/SaveSystem';
import { DialogueSystem } from '../systems/DialogueSystem';
import { createAllPlaceholderTextures, createNPCTexture } from '../graphics/PlaceholderGraphics';
import npcsData from '../data/npcs.json';
import dialoguesData from '../data/dialogues.json';
import type { NPCData, DialogueTree, SaveData } from '../types';

// 场景尺寸
const SCENE_W = 1280;
const SCENE_H = 720;

export class AcademyScene extends Phaser.Scene {
  private player!: Player;
  private npcs: NPC[] = [];
  private dialogueBox!: DialogueBox;
  private saveSystem = SaveSystem;
  private dialogueSystem!: DialogueSystem;
  private save!: SaveData;
  private blockers: Phaser.GameObjects.Rectangle[] = [];

  // 区域提示文字
  private areaLabel!: Phaser.GameObjects.Text;
  private affectionLabel!: Phaser.GameObjects.Text;

  // 交互按键
  private keyE!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'AcademyScene' });
  }

  preload(): void {
    this.load.image('bg_academy_atrium_3d', '/assets/backgrounds/academy-atrium-3d.png');
    this.load.image('portrait_lyra_3d', '/assets/portraits/lyra-3d.png');
    this.load.image('portrait_player_3d', '/assets/portraits/player-3d.png');
    this.load.image('sprite_lyra_3d', '/assets/sprites/lyra-chibi-3d.png');
    this.load.image('sprite_player_3d', '/assets/sprites/player-chibi-3d.png');
  }

  create(): void {
    // 生成占位纹理
    createAllPlaceholderTextures(this);

    // 加载存档
    this.save = this.saveSystem.load();

    // 对话系统
    this.dialogueSystem = new DialogueSystem(
      dialoguesData as Record<string, DialogueTree[]>,
      this.saveSystem
    );

    // ---- 场景布置 ----
    this.drawAcademyHall();

    // 学院大厅标题
    this.add.text(SCENE_W / 2, 30, '✦ 星辉魔法学院 · 星穹中庭 ✦', {
      fontSize: '24px',
      color: '#ffe066',
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(50);

    // 区域提示
    this.areaLabel = this.add.text(SCENE_W / 2, SCENE_H - 50, '', {
      fontSize: '18px',
      color: '#a090c0',
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(50);

    // 好感度 HUD
    this.affectionLabel = this.add.text(20, 20, '', {
      fontSize: '16px',
      color: '#ff99cc',
      stroke: '#000',
      strokeThickness: 3,
    }).setDepth(100);

    // ---- 创建 NPC ----
    for (const raw of npcsData) {
      const data = raw as unknown as NPCData;
      // 字符串颜色转数字
      const colorNum = typeof data.color === 'string'
        ? parseInt(data.color as string, 16)
        : data.color as number;
      // 生成 NPC 纹理
      createNPCTexture(this, data.id, colorNum);
      const npc = new NPC(this, data);
      this.npcs.push(npc);
    }

    // ---- 创建玩家 ----
    const bounds = new Phaser.Geom.Rectangle(0, 0, SCENE_W, SCENE_H);
    this.player = new Player(this, 230, 470, bounds);
    this.createCollisionBlockers();

    // 碰撞：玩家 vs NPC
    const npcSprites = this.npcs.map(n => n.sprite);
    this.physics.add.collider(this.player.sprite, npcSprites);
    for (const blocker of this.blockers) {
      this.physics.add.collider(this.player.sprite, blocker);
    }

    // ---- 对话框 ----
    this.dialogueBox = new DialogueBox(this, {
      onSelectChoice: (index) => this.onSelectChoice(index),
      onAdvance: () => this.onAdvanceDialogue(),
    });

    // ---- 交互按键 ----
    this.keyE = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // E 键单次按下触发交互
    this.keyE.on('down', () => {
      if (this.dialogueBox.isVisible()) return; // 对话中不重复触发
      this.tryInteract();
    });

    // R 键重置存档（调试用）
    this.input.keyboard!.on('keydown-R', () => {
      if (this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT).isDown) {
        this.saveSystem.clear();
        this.save = this.saveSystem.load();
        this.updateHUD();
        this.addFloatingText(SCENE_W / 2, SCENE_H / 2, '存档已重置', '#ff6666');
      }
    });

    this.updateHUD();

    // 欢迎提示
    this.time.delayedCall(500, () => {
      this.addFloatingText(
        SCENE_W / 2, SCENE_H / 2 - 50,
        'WASD / 方向键移动 · 靠近 NPC 按 E 对话',
        '#ffe066', 3000
      );
    });
  }

  update(_time: number, delta: number): void {
    // 对话中禁止移动
    if (!this.dialogueBox.isVisible()) {
      this.player.update();
    } else {
      (this.player.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    }

    // NPC 浮动
    this.npcs.forEach(npc => npc.bob(_time));

    // 交互提示
    for (const npc of this.npcs) {
      const near = npc.isInInteractionRange(this.player.sprite.x, this.player.sprite.y);
      npc.setShowPrompt(near);
    }

    // 区域提示
    const inLibrary = this.player.sprite.x > 820 && this.player.sprite.x < 1230
      && this.player.sprite.y > 200 && this.player.sprite.y < 540;
    const inAtrium = this.player.sprite.y > 340 && !inLibrary;
    this.areaLabel.setText(inLibrary ? '📖 星辉图书馆' : inAtrium ? '学院中庭' : '');

    _time += delta; // 防止 unused
  }

  // ---- 交互逻辑 ----

  private tryInteract(): void {
    for (const npc of this.npcs) {
      if (npc.isInInteractionRange(this.player.sprite.x, this.player.sprite.y)) {
        this.startNPCDialogue(npc);
        return;
      }
    }
  }

  private startNPCDialogue(npc: NPC): void {
    npc.setInteracting(true);

    // 选对话树
    const tree = this.dialogueSystem.selectDialogue(npc.data.id, this.save);
    if (!tree) {
      this.addFloatingText(npc.x, npc.y - 40, '（Lyra 似乎暂时没什么想说的...）', '#a090c0', 2000);
      npc.setInteracting(false);
      return;
    }

    const state = this.dialogueSystem.startDialogue(tree);
    if (state.phase === 'page') {
      this.dialogueBox.show(
        state.page.speaker,
        state.page.text,
        state.page.choices
      );
    }
  }

  private onSelectChoice(index: number): void {
    const result = this.dialogueSystem.selectChoice(index, this.save);
    if (result.response) {
      // 显示回复
      this.dialogueBox.showResponse('Lyra', result.response);
      this.updateHUD();

      // 好感度变化提示
      if (result.affectionChange > 0) {
        this.addFloatingText(
          this.player.sprite.x, this.player.sprite.y - 30,
          `好感 +${result.affectionChange}`, '#ff99cc', 1500
        );
      } else if (result.affectionChange < 0) {
        this.addFloatingText(
          this.player.sprite.x, this.player.sprite.y - 30,
          `好感 ${result.affectionChange}`, '#6699ff', 1500
        );
      }
    }
  }

  private onAdvanceDialogue(): void {
    // 在 endDialogue 之前获取 tree 引用
    const tree = this.dialogueSystem.getCurrentTree();
    this.dialogueSystem.advance();
    const state = this.dialogueSystem.getState();

    if (state.phase === 'ended') {
      // 标记事件完成
      if (tree?.completesEvent) {
        this.saveSystem.markEventComplete(this.save, tree.completesEvent);
      }

      this.dialogueBox.hide();
      this.npcs.forEach(n => n.setInteracting(false));
    } else if (state.phase === 'page') {
      this.dialogueBox.show(
        state.page.speaker,
        state.page.text,
        state.page.choices
      );
    }
  }

  // ---- 辅助方法 ----

  private drawAcademyHall(): void {
    if (this.textures.exists('bg_academy_atrium_3d')) {
      this.drawHighRes3DBackground();
      return;
    }

    const bg = this.add.graphics();
    bg.setDepth(-100);

    // Deep background and rear wall.
    bg.fillStyle(0x120c1c, 1);
    bg.fillRect(0, 0, SCENE_W, SCENE_H);
    bg.fillStyle(0x241936, 1);
    bg.fillRect(0, 64, SCENE_W, 180);
    bg.fillStyle(0x2d2143, 1);
    bg.fillRect(0, 92, SCENE_W, 96);
    bg.fillStyle(0x1b1229, 1);
    bg.fillRect(0, 188, SCENE_W, 38);

    // Side walls as angled planes.
    bg.fillStyle(0x1a1227, 1);
    bg.beginPath();
    bg.moveTo(0, 178);
    bg.lineTo(156, 228);
    bg.lineTo(214, SCENE_H);
    bg.lineTo(0, SCENE_H);
    bg.closePath();
    bg.fillPath();
    bg.fillStyle(0x1f172e, 1);
    bg.beginPath();
    bg.moveTo(SCENE_W, 178);
    bg.lineTo(644, 228);
    bg.lineTo(586, SCENE_H);
    bg.lineTo(SCENE_W, SCENE_H);
    bg.closePath();
    bg.fillPath();

    // Soft magical light pool.
    bg.fillStyle(0x8665ff, 0.12);
    bg.fillEllipse(SCENE_W / 2, 378, 500, 190);
    bg.fillStyle(0xffe7a3, 0.08);
    bg.fillEllipse(SCENE_W / 2, 292, 260, 90);

    this.drawIsometricFloor();
    this.drawBackWallProps();
    this.drawLibraryArea();
    this.drawForegroundDetails();
  }

  private drawHighRes3DBackground(): void {
    this.add.image(SCENE_W / 2, SCENE_H / 2, 'bg_academy_atrium_3d')
      .setDisplaySize(SCENE_W, SCENE_H)
      .setDepth(-100);

    // Soft cinematic grading so characters sit naturally over the prerendered scene.
    const grade = this.add.graphics();
    grade.setDepth(-95);
    grade.fillStyle(0x1b1030, 0.06);
    grade.fillRect(0, 0, SCENE_W, SCENE_H);
    grade.fillStyle(0xffe0a3, 0.08);
    grade.fillEllipse(520, 430, 620, 220);
    grade.fillStyle(0x7f5bff, 0.10);
    grade.fillEllipse(1020, 360, 520, 220);

    this.add.text(1015, 188, '星辉图书馆', {
      fontSize: '18px',
      color: '#ffe066',
      stroke: '#1a1026',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(80);
  }

  private drawIsometricFloor(): void {
    const g = this.add.graphics();
    g.setDepth(-30);

    const originX = SCENE_W / 2;
    const originY = 184;
    const tileW = 92;
    const tileH = 46;
    const cols = 8;
    const rows = 8;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const sx = originX + (x - y) * (tileW / 2);
        const sy = originY + (x + y) * (tileH / 2);
        const base = (x + y) % 2 === 0 ? 0x3b3354 : 0x342b4b;
        this.fillDiamond(g, sx, sy, tileW, tileH, base, 1);
        this.strokeDiamond(g, sx, sy, tileW, tileH, 0x5e527e, 0.75);

        if ((x * 7 + y * 3) % 9 === 0) {
          g.fillStyle(0xd9cbff, 0.28);
          g.fillRect(sx - 2, sy - 3, 3, 3);
        }
      }
    }

    // Front lip of the floor to push the scene toward 2.5D.
    g.fillStyle(0x241a38, 1);
    g.beginPath();
    g.moveTo(55, 454);
    g.lineTo(400, 596);
    g.lineTo(745, 454);
    g.lineTo(745, 484);
    g.lineTo(400, 626);
    g.lineTo(55, 484);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, 0x7d6aa0, 0.65);
    g.lineBetween(55, 454, 400, 596);
    g.lineBetween(400, 596, 745, 454);
  }

  private drawBackWallProps(): void {
    this.add.image(SCENE_W / 2, 202, 'placeholder_door_arch')
      .setOrigin(0.5, 1)
      .setDepth(162);

    this.add.image(190, 178, 'placeholder_window')
      .setOrigin(0.5, 1)
      .setDepth(130);
    this.add.image(610, 178, 'placeholder_window')
      .setOrigin(0.5, 1)
      .setDepth(130);

    this.add.image(124, 272, 'placeholder_pillar')
      .setOrigin(0.5, 1)
      .setDepth(272);
    this.add.image(676, 272, 'placeholder_pillar')
      .setOrigin(0.5, 1)
      .setDepth(272);

    // Window light shafts.
    const light = this.add.graphics();
    light.setDepth(-20);
    light.fillStyle(0xbfeeff, 0.10);
    light.beginPath();
    light.moveTo(172, 182);
    light.lineTo(218, 182);
    light.lineTo(318, 472);
    light.lineTo(236, 472);
    light.closePath();
    light.fillPath();
    light.beginPath();
    light.moveTo(582, 182);
    light.lineTo(628, 182);
    light.lineTo(560, 472);
    light.lineTo(478, 472);
    light.closePath();
    light.fillPath();
  }

  private drawLibraryArea(): void {
    // Right-side library corner.
    const zone = this.add.graphics();
    zone.setDepth(-18);
    zone.fillStyle(0x4d3365, 0.24);
    zone.beginPath();
    zone.moveTo(514, 210);
    zone.lineTo(734, 282);
    zone.lineTo(590, 466);
    zone.lineTo(414, 360);
    zone.closePath();
    zone.fillPath();
    zone.lineStyle(2, 0xffdf75, 0.25);
    zone.strokePath();

    this.add.image(606, 412, 'placeholder_carpet')
      .setScale(0.82)
      .setDepth(405);

    this.add.image(538, 274, 'placeholder_bookshelf')
      .setOrigin(0.5, 1)
      .setDepth(274)
      .setScale(0.92);
    const shelfB = this.add.image(704, 326, 'placeholder_bookshelf')
      .setOrigin(0.5, 1)
      .setDepth(326)
      .setScale(0.95);
    shelfB.setFlipX(true);

    this.add.image(612, 374, 'placeholder_study_table')
      .setOrigin(0.5, 1)
      .setDepth(374);

    this.addFloatingBook(570, 208, 0);
    this.addFloatingBook(674, 232, 260);

    this.add.text(618, 164, '星辉图书馆', {
      fontSize: '16px',
      color: '#ffe066',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(180);
  }

  private drawForegroundDetails(): void {
    const g = this.add.graphics();
    g.setDepth(-19);
    g.fillStyle(0x08050d, 0.22);
    g.fillEllipse(400, 548, 620, 58);

    this.add.image(238, 424, 'placeholder_pillar')
      .setOrigin(0.5, 1)
      .setScale(0.92)
      .setDepth(424);
    this.add.image(102, 538, 'placeholder_bookshelf')
      .setOrigin(0.5, 1)
      .setScale(0.9)
      .setDepth(538);
  }

  private addFloatingBook(x: number, y: number, delay: number): void {
    const book = this.add.image(x, y, 'placeholder_floating_book')
      .setDepth(y)
      .setAngle(-8);

    this.tweens.add({
      targets: book,
      y: y - 8,
      angle: 8,
      yoyo: true,
      repeat: -1,
      duration: 1900,
      delay,
      ease: 'Sine.easeInOut',
      onUpdate: () => book.setDepth(book.y),
    });
  }

  private createCollisionBlockers(): void {
    if (SCENE_W === 1280) {
      // Prerendered 3D background collision anchors.
      this.addCollisionBlocker(640, 156, 246, 92);   // rear arch and wall
      this.addCollisionBlocker(914, 194, 96, 120);   // right window/book stand
      this.addCollisionBlocker(1120, 208, 280, 120); // book shelves
      this.addCollisionBlocker(1038, 410, 276, 118); // library desk
      this.addCollisionBlocker(840, 284, 58, 86);    // rear right lamp pillar
      this.addCollisionBlocker(442, 310, 64, 98);    // center lamp pillar
      this.addCollisionBlocker(348, 506, 72, 98);    // foreground lamp pillar
      this.addCollisionBlocker(50, 548, 98, 170);    // left foreground column
      this.addCollisionBlocker(1234, 540, 112, 220); // right plants and edge
      return;
    }

    this.addCollisionBlocker(400, 162, 170, 54);
    this.addCollisionBlocker(536, 238, 82, 28);
    this.addCollisionBlocker(706, 292, 82, 28);
    this.addCollisionBlocker(612, 360, 104, 34);
    this.addCollisionBlocker(124, 252, 34, 34);
    this.addCollisionBlocker(676, 252, 34, 34);
    this.addCollisionBlocker(238, 404, 34, 34);
    this.addCollisionBlocker(102, 520, 72, 28);
  }

  private addCollisionBlocker(x: number, y: number, w: number, h: number): void {
    const rect = this.add.rectangle(x, y, w, h, 0xffffff, 0);
    this.physics.add.existing(rect, true);
    this.blockers.push(rect);
  }

  private fillDiamond(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    alpha: number
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

  private strokeDiamond(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    alpha: number
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

  private updateHUD(): void {
    const aff = this.save.affection;
    const events = this.save.completedEvents.length;
    let level = '';
    if (aff < 0) level = '❄ 冷淡';
    else if (aff < 2) level = '◐ 普通';
    else if (aff < 5) level = '☀ 温暖';
    else level = '♥ 亲密';

    this.affectionLabel.setText(
      `Lyra 好感: ${aff}  ${level}\n事件: ${events}/2`
    );
  }

  private addFloatingText(
    x: number, y: number, text: string,
    color = '#ffffff', duration = 2000
  ): void {
    const txt = this.add.text(x, y, text, {
      fontSize: '14px',
      color,
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(300);

    this.tweens.add({
      targets: txt,
      y: y - 30,
      alpha: 0,
      duration,
      onComplete: () => txt.destroy(),
    });
  }
}
