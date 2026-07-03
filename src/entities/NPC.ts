// src/entities/NPC.ts
// NPC 实体：显示精灵，管理交互提示气泡，提供距离检测接口。

import Phaser from 'phaser';
import type { NPCData } from '../types';

const INTERACTION_RANGE = 120;

export class NPC {
  public data: NPCData;
  public sprite: Phaser.Physics.Arcade.Sprite;
  public shadow: Phaser.GameObjects.Image;
  private promptIcon: Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.Text;
  private interacting = false;

  constructor(scene: Phaser.Scene, data: NPCData) {
    this.data = data;

    // NPC 纹理 key（优先使用 3D 日式 chibi 资产，失败时回退到运行时占位图）
    const texKey = data.id === 'lyra' && scene.textures.exists('sprite_lyra_3d')
      ? 'sprite_lyra_3d'
      : 'placeholder_npc_' + data.id;
    this.shadow = scene.add.image(data.x, data.y + 10, 'placeholder_shadow')
      .setAlpha(0.5)
      .setDepth(data.y - 2);

    this.sprite = scene.physics.add.staticSprite(data.x, data.y, texKey);
    this.sprite.setOrigin(0.5, 0.9);
    if (texKey === 'sprite_lyra_3d') {
      this.sprite.setDisplaySize(88, 142);
      this.sprite.setSize(this.sprite.frame.width * 0.34, this.sprite.frame.height * 0.13);
      this.sprite.body!.setSize(this.sprite.frame.width * 0.34, this.sprite.frame.height * 0.13);
      this.sprite.setOffset(this.sprite.frame.width * 0.33, this.sprite.frame.height * 0.80);
    } else {
      this.sprite.setSize(22, 18);
      this.sprite.body!.setSize(22, 18);
    }
    this.sprite.refreshBody();
    this.sprite.setDepth(data.y);

    // 交互提示图标（E 键）
    this.promptIcon = scene.add.image(data.x, data.y - 104, 'placeholder_prompt_e');
    this.promptIcon.setVisible(false);
    this.promptIcon.setDepth(100);

    // NPC 名字标签
    this.label = scene.add.text(data.x, data.y + 22, data.name, {
      fontSize: '16px',
      color: '#ffe066',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.label.setDepth(100);
  }

  /** 检查玩家是否在交互范围内 */
  isInInteractionRange(playerX: number, playerY: number): boolean {
    const dist = Phaser.Math.Distance.Between(
      playerX, playerY, this.sprite.x, this.sprite.y
    );
    return dist <= INTERACTION_RANGE;
  }

  /** 显示/隐藏交互提示 */
  setShowPrompt(show: boolean): void {
    this.promptIcon.setVisible(show && !this.interacting);
  }

  /** 标记交互中（隐藏提示） */
  setInteracting(v: boolean): void {
    this.interacting = v;
    if (v) this.promptIcon.setVisible(false);
  }

  /** 空闲时小浮动动画 */
  bob(time: number): void {
    const y = this.data.y + Math.sin(time * 0.003) * 2;
    this.sprite.y = y;
    this.shadow.setPosition(this.data.x, this.data.y + 10);
    this.shadow.setDepth(this.data.y - 2);
    this.sprite.setDepth(y);
    this.promptIcon.setPosition(this.data.x, y - 104);
    this.label.setPosition(this.data.x, y + 14);
    this.label.setDepth(y + 3);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
}
