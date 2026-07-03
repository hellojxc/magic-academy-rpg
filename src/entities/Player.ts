// src/entities/Player.ts
// 玩家角色：支持 WASD + 方向键移动，带碰撞边界限制。

import Phaser from 'phaser';

const PLAYER_SPEED = 240;

export class Player {
  public sprite: Phaser.Physics.Arcade.Sprite;
  public shadow: Phaser.GameObjects.Image;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW: Phaser.Input.Keyboard.Key;
  private keyA: Phaser.Input.Keyboard.Key;
  private keyS: Phaser.Input.Keyboard.Key;
  private keyD: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene, x: number, y: number, bounds: Phaser.Geom.Rectangle) {
    this.shadow = scene.add.image(x, y + 24, 'placeholder_shadow')
      .setAlpha(0.55)
      .setDepth(y - 2);

    const texture = scene.textures.exists('sprite_player_3d')
      ? 'sprite_player_3d'
      : 'placeholder_player';

    this.sprite = scene.physics.add.sprite(x, y, texture);
    this.sprite.setOrigin(0.5, 0.88);
    if (texture === 'sprite_player_3d') {
      this.sprite.setDisplaySize(82, 130);
      this.sprite.setSize(this.sprite.frame.width * 0.34, this.sprite.frame.height * 0.13);
      this.sprite.setOffset(this.sprite.frame.width * 0.33, this.sprite.frame.height * 0.80);
    } else {
      this.sprite.setSize(18, 18);
      this.sprite.setOffset(15, 43);
    }
    this.sprite.setDepth(y);
    this.sprite.setCollideWorldBounds(true);

    const idleScaleY = this.sprite.scaleY;
    scene.tweens.add({
      targets: this.sprite,
      scaleY: idleScaleY * 1.035,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 设定世界边界 + 碰撞
    scene.physics.world.setBounds(
      bounds.x, bounds.y, bounds.width, bounds.height
    );
    this.sprite.setCollideWorldBounds(true);

    // 输入
    const kb = scene.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  }

  update(): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    let vx = 0;
    let vy = 0;

    // 水平
    if (this.cursors.left.isDown || this.keyA.isDown) vx = -PLAYER_SPEED;
    else if (this.cursors.right.isDown || this.keyD.isDown) vx = PLAYER_SPEED;

    // 垂直
    if (this.cursors.up.isDown || this.keyW.isDown) vy = -PLAYER_SPEED;
    else if (this.cursors.down.isDown || this.keyS.isDown) vy = PLAYER_SPEED;

    // 对角线归一化
    if (vx !== 0 && vy !== 0) {
      vx *= 0.7071;
      vy *= 0.7071;
    }

    body.setVelocity(vx, vy);

    // 简单朝向翻转
    if (vx < 0) this.sprite.setFlipX(true);
    else if (vx > 0) this.sprite.setFlipX(false);

    this.shadow.setPosition(this.sprite.x, this.sprite.y + 10);
    this.shadow.setDepth(this.sprite.y - 2);
    this.sprite.setDepth(this.sprite.y);
  }

  getDistanceTo(target: { x: number; y: number }): number {
    return Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y, target.x, target.y
    );
  }
}
