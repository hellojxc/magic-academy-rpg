import type { SaveData } from '../types';

export class GameHud {
  private readonly root: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'game-hud';
    parent.append(this.root);
  }

  update(save: SaveData): void {
    const level = save.affection < 0
      ? '冷淡'
      : save.affection < 2
        ? '普通'
        : save.affection < 5
          ? '温暖'
          : '亲密';
    this.root.innerHTML = `
      <div>Lyra 好感: <strong>${save.affection}</strong> ${level}</div>
      <div>事件: ${save.completedEvents.length}/2</div>
      <div class="hud-help">WASD 移动 · 靠近 Lyra 按 E</div>
    `;
  }

  destroy(): void {
    this.root.remove();
  }
}
