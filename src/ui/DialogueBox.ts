// src/ui/DialogueBox.ts
// 对话框 UI 组件：显示角色名、文本、选项列表，支持打字机效果。

import Phaser from 'phaser';
import type { DialogueChoice } from '../types';

interface DialogueBoxCallbacks {
  onSelectChoice: (index: number) => void;
  onAdvance: () => void;
}

export class DialogueBox {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private portraitImage: Phaser.GameObjects.Image;
  private nameText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private choicesContainer: Phaser.GameObjects.Container;
  private choiceTexts: Phaser.GameObjects.Text[] = [];
  private selectedIndex = 0;
  private callbacks: DialogueBoxCallbacks;

  // 打字机
  private fullText = '';
  private displayedChars = 0;
  private typeTimer: Phaser.Time.TimerEvent | null = null;
  private isTyping = false;
  private hasChoices = false;

  // 布局常量
  private readonly BOX_W = 760;
  private readonly BOX_H = 248;
  private readonly BOX_X: number;
  private readonly BOX_Y: number;

  constructor(scene: Phaser.Scene, callbacks: DialogueBoxCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;

    const { width, height } = scene.scale;
    this.BOX_X = (width - this.BOX_W) / 2;
    this.BOX_Y = height - this.BOX_H - 20;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(200);
    this.container.setScrollFactor(0);
    this.container.setVisible(false);

    // 背景面板
    const bg = scene.add.graphics();
    bg.fillStyle(0x0f0e1a, 0.92);
    bg.fillRoundedRect(this.BOX_X, this.BOX_Y, this.BOX_W, this.BOX_H, 12);
    // 金色边框
    bg.lineStyle(2, 0xffe066, 0.8);
    bg.strokeRoundedRect(this.BOX_X, this.BOX_Y, this.BOX_W, this.BOX_H, 12);
    // 内侧高光，让 UI 更像恋爱游戏的角色窗口。
    bg.lineStyle(1, 0xffffff, 0.18);
    bg.strokeRoundedRect(this.BOX_X + 4, this.BOX_Y + 4, this.BOX_W - 8, this.BOX_H - 8, 10);
    // 顶部装饰条
    bg.fillStyle(0xffe066, 0.3);
    bg.fillRect(this.BOX_X + 10, this.BOX_Y + 4, this.BOX_W - 20, 2);
    this.container.add(bg);

    // 角色立绘框
    const portraitFrame = scene.add.graphics();
    portraitFrame.fillStyle(0x211633, 0.92);
    portraitFrame.fillRoundedRect(this.BOX_X + 18, this.BOX_Y + 14, 164, 220, 14);
    portraitFrame.lineStyle(2, 0xffd66b, 0.7);
    portraitFrame.strokeRoundedRect(this.BOX_X + 18, this.BOX_Y + 14, 164, 220, 14);
    portraitFrame.fillStyle(0x8fb8ff, 0.12);
    portraitFrame.fillEllipse(this.BOX_X + 100, this.BOX_Y + 124, 138, 194);
    this.container.add(portraitFrame);

    this.portraitImage = scene.add.image(
      this.BOX_X + 100,
      this.BOX_Y + 124,
      this.scene.textures.exists('portrait_lyra_3d') ? 'portrait_lyra_3d' : 'placeholder_portrait_lyra'
    ).setDisplaySize(144, 216);
    this.container.add(this.portraitImage);

    // 角色名标签
    this.nameText = scene.add.text(this.BOX_X + 206, this.BOX_Y + 20, '', {
      fontSize: '18px',
      color: '#ffe066',
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 3,
    });
    this.container.add(this.nameText);

    // 对话正文
    this.bodyText = scene.add.text(
      this.BOX_X + 206,
      this.BOX_Y + 56,
      '',
      {
        fontSize: '16px',
        color: '#e8e0f0',
        wordWrap: { width: this.BOX_W - 236 },
        lineSpacing: 6,
      }
    );
    this.container.add(this.bodyText);

    // 选项容器
    this.choicesContainer = scene.add.container(0, 0);
    this.choicesContainer.setDepth(210);
    this.choicesContainer.setScrollFactor(0);
    this.container.add(this.choicesContainer);

    // 按键监听
    scene.input.keyboard?.on('keydown-UP', () => this.moveSelection(-1));
    scene.input.keyboard?.on('keydown-DOWN', () => this.moveSelection(1));
    scene.input.keyboard?.on('keydown-W', () => this.moveSelection(-1));
    scene.input.keyboard?.on('keydown-S', () => this.moveSelection(1));
    scene.input.keyboard?.on('keydown-SPACE', () => this.handleConfirm());
    scene.input.keyboard?.on('keydown-ENTER', () => this.handleConfirm());
    // 数字键 1/2/3 快选
    scene.input.keyboard?.on('keydown-ONE', () => this.selectByNumber(0));
    scene.input.keyboard?.on('keydown-TWO', () => this.selectByNumber(1));
    scene.input.keyboard?.on('keydown-THREE', () => this.selectByNumber(2));
  }

  /** 显示一页对话 */
  show(speaker: string, text: string, choices?: DialogueChoice[]): void {
    this.container.setVisible(true);
    this.nameText.setText(speaker);
    this.updatePortrait(speaker);
    this.fullText = text;
    this.displayedChars = 0;
    this.bodyText.setText('');
    this.hasChoices = !!(choices && choices.length > 0);

    // 清除旧选项
    this.clearChoices();
    this.choiceTexts = [];
    this.selectedIndex = 0;

    // 开始打字机
    this.startTypewriter();

    // 如果有选项，等打字结束后显示
    if (choices && choices.length > 0) {
      // 预存 choices，打字完毕后渲染
      this.pendingChoices = choices;
    } else {
      this.pendingChoices = null;
    }
  }

  private pendingChoices: DialogueChoice[] | null = null;

  /** 显示选项回复（选择后的 NPC 回复） */
  showResponse(speaker: string, text: string): void {
    this.show(speaker, text, undefined);
  }

  /** 隐藏对话框 */
  hide(): void {
    this.container.setVisible(false);
    this.clearChoices();
    this.stopTypewriter();
  }

  isVisible(): boolean {
    return this.container.visible;
  }

  // ---- 内部方法 ----

  private startTypewriter(): void {
    this.stopTypewriter();
    this.isTyping = true;

    this.typeTimer = this.scene.time.addEvent({
      delay: 25,
      loop: true,
      callback: () => {
        if (this.displayedChars < this.fullText.length) {
          this.displayedChars++;
          this.bodyText.setText(this.fullText.substring(0, this.displayedChars));
        } else {
          this.onTypingComplete();
        }
      },
    });
  }

  private stopTypewriter(): void {
    if (this.typeTimer) {
      this.typeTimer.remove();
      this.typeTimer = null;
    }
    this.isTyping = false;
  }

  private onTypingComplete(): void {
    this.stopTypewriter();

    // 显示选项
    if (this.pendingChoices) {
      this.renderChoices(this.pendingChoices);
      this.pendingChoices = null;
    }
  }

  /** 跳过打字机效果（立刻显示全文） */
  private skipTyping(): void {
    this.stopTypewriter();
    this.bodyText.setText(this.fullText);
    this.displayedChars = this.fullText.length;
    this.onTypingComplete();
  }

  private renderChoices(choices: DialogueChoice[]): void {
    const startY = this.BOX_Y + this.BOX_H - 20 - choices.length * 24;

    choices.forEach((choice, i) => {
      const prefix = `[${i + 1}] `;
      const txt = this.scene.add.text(
        this.BOX_X + 216,
        startY + i * 24,
        prefix + choice.text,
        {
          fontSize: '14px',
          color: '#c8b8e0',
          wordWrap: { width: this.BOX_W - 252 },
        }
      );

      this.choicesContainer.add(txt);
      this.choiceTexts.push(txt);
    });

    this.updateSelectionHighlight();
  }

  private clearChoices(): void {
    this.choicesContainer.removeAll(true);
    this.choiceTexts = [];
  }

  private updatePortrait(speaker: string): void {
    const normalized = speaker.toLowerCase();
    const isLyra = normalized.includes('lyra');
    const texture = isLyra
      ? (this.scene.textures.exists('portrait_lyra_3d') ? 'portrait_lyra_3d' : 'placeholder_portrait_lyra')
      : (this.scene.textures.exists('portrait_player_3d') ? 'portrait_player_3d' : 'placeholder_portrait_player');

    this.portraitImage.setTexture(texture);
    this.portraitImage.setDisplaySize(144, 216);
    this.portraitImage.setAlpha(0.92);

    this.scene.tweens.killTweensOf(this.portraitImage);
    this.scene.tweens.add({
      targets: this.portraitImage,
      alpha: 1,
      duration: 180,
      ease: 'Sine.easeOut',
    });
  }

  private moveSelection(dir: number): void {
    if (!this.hasChoices || this.choiceTexts.length === 0) return;
    if (this.isTyping) {
      this.skipTyping();
      return;
    }

    this.selectedIndex = Phaser.Math.Clamp(
      this.selectedIndex + dir,
      0,
      this.choiceTexts.length - 1
    );
    this.updateSelectionHighlight();
  }

  private selectByNumber(index: number): void {
    if (!this.hasChoices || this.isTyping) return;
    if (index >= 0 && index < this.choiceTexts.length) {
      this.selectedIndex = index;
      this.updateSelectionHighlight();
      this.callbacks.onSelectChoice(index);
    }
  }

  private updateSelectionHighlight(): void {
    this.choiceTexts.forEach((txt, i) => {
      if (i === this.selectedIndex) {
        txt.setColor('#ffe066');
        txt.setStyle({ fontStyle: 'bold' });
        txt.setText(txt.text.replace(/^(\[\d\] )/, '▶ $1'));
      } else {
        txt.setColor('#c8b8e0');
        txt.setStyle({ fontStyle: 'normal' });
        txt.setText(txt.text.replace(/^▶ (\[\d\] )/, '$1'));
      }
    });
  }

  private handleConfirm(): void {
    // 如果正在打字，先跳过
    if (this.isTyping) {
      this.skipTyping();
      return;
    }

    // 有选项 → 选择
    if (this.hasChoices && this.choiceTexts.length > 0) {
      this.callbacks.onSelectChoice(this.selectedIndex);
      return;
    }

    // 无选项 → 推进
    this.callbacks.onAdvance();
  }
}
