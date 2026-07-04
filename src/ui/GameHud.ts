import type { SaveData } from '../types';
import { SaveSystem } from '../systems/SaveSystem';
import { CharacterStatsSystem } from '../systems/CharacterStatsSystem';
import { CombatSkillSystem } from '../systems/CombatSkillSystem';
import { InventorySystem } from '../systems/InventorySystem';

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
    const attributes = CombatSkillSystem.getEffectiveAttributes(save);
    const derived = CombatSkillSystem.getDerivedStats(save);
    const previews = {
      melee: CombatSkillSystem.previewSkill(save, 'melee'),
      ranged: CombatSkillSystem.previewSkill(save, 'ranged'),
      defense: CombatSkillSystem.previewSkill(save, 'defense'),
    };
    const equipped = InventorySystem.getEquippedItems(save.inventory);
    const coverage = CombatSkillSystem.getCoverage();
    const relationCount = Object.keys(save.npcAffection ?? {}).length;

    const attributeRows = CharacterStatsSystem.attributes.map((def) => `
      <span class="hud-stat"><b>${def.shortLabel}</b>${attributes[def.id]}</span>
    `).join('');
    const equippedNames = equipped.slice(0, 4).map((item) => item.label).join(' · ');

    this.root.innerHTML = `
      <div class="hud-topline">${npcName} 好感: <strong>${affection}</strong> ${level} · 已结识 ${relationCount}/31 · 事件 ${save.completedEvents.length}</div>
      <div class="hud-derived">
        <span>生命 <strong>${derived.maxHealth}</strong></span>
        <span>法力 <strong>${derived.maxMana}</strong></span>
        <span>体力 <strong>${derived.maxStamina}</strong></span>
      </div>
      <div class="hud-stat-grid">${attributeRows}</div>
      <div class="hud-skill-grid">
        <div><b>近战</b><strong>${previews.melee.skill.label}</strong><span>${previews.melee.value} ${previews.melee.label}</span></div>
        <div><b>远程</b><strong>${previews.ranged.skill.label}</strong><span>${previews.ranged.value} ${previews.ranged.label}</span></div>
        <div><b>防御</b><strong>${previews.defense.skill.label}</strong><span>${previews.defense.value} ${previews.defense.label}</span></div>
      </div>
      <div class="hud-loadout">装备 ${equipped.length}/${save.inventory.ownedItemIds.length}: ${equippedNames}</div>
      <div class="hud-help">WASD 移动 · 鼠标拖拽视角 · 滚轮缩放 · 靠近任意 NPC 按 E · Z/X/C 切换技能 · V 切换主武器 · 已接入 ${coverage.attributes} 属性 / ${coverage.melee}+${coverage.ranged} 攻击技能 / ${coverage.defense} 防御技能 / ${coverage.items} 道具武器</div>
    `;
  }

  destroy(): void {
    this.root.remove();
  }
}
