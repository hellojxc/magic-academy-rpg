import type { SaveData } from '../types';
import { SaveSystem } from '../systems/SaveSystem';

interface ActiveNpcSummary {
  id: string;
  name: string;
}

export class GameHud {
  private readonly root: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'game-hud';
    parent.append(this.root);
  }

  update(save: SaveData, activeNpc?: ActiveNpcSummary): void {
    const npcId = activeNpc?.id ?? 'lyra';
    const npcName = activeNpc?.name ?? '莉娅';
    const affection = SaveSystem.getAffection(save, npcId);
    const level = affection < 0
      ? '冷淡'
      : affection < 2
        ? '普通'
        : affection < 5
          ? '温暖'
          : '亲密';
    const relationCount = Object.keys(save.npcAffection ?? {}).length;
    this.root.innerHTML = `
      <div>${npcName} 好感: <strong>${affection}</strong> ${level}</div>
      <div>已结识: ${relationCount} / 31</div>
      <div>事件: ${save.completedEvents.length}</div>
      <div class="hud-help">WASD 移动 · 鼠标拖拽视角 · 滚轮缩放 · 靠近任意 NPC 按 E · 右上角小地图</div>
    `;
  }

  destroy(): void {
    this.root.remove();
  }
}
