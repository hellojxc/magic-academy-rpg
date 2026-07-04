// src/systems/SaveSystem.ts
// 使用 localStorage 保存/读取游戏状态。

import type { SaveData } from '../types';

const SAVE_KEY = 'magic_academy_save';

const DEFAULT_SAVE: SaveData = {
  affection: 0,
  npcAffection: {},
  completedEvents: [],
  currentDialogueId: null,
  lastInteractTimestamp: 0,
};

export class SaveSystem {
  /** 读取存档，不存在则返回默认值 */
  static load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { ...DEFAULT_SAVE };
      const parsed = JSON.parse(raw) as SaveData;
      // 合并默认值，防止旧版存档缺字段
      return {
        ...DEFAULT_SAVE,
        ...parsed,
        npcAffection: parsed.npcAffection ?? {},
        completedEvents: parsed.completedEvents ?? [],
      };
    } catch {
      return { ...DEFAULT_SAVE };
    }
  }

  /** 保存 */
  static save(data: SaveData): void {
    try {
      data.lastInteractTimestamp = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[SaveSystem] 保存失败:', e);
    }
  }

  /** 清除存档（调试用） */
  static clear(): void {
    localStorage.removeItem(SAVE_KEY);
  }

  /** 读取指定 NPC 的好感度，兼容旧版 Lyra 全局存档。 */
  static getAffection(save: SaveData, npcId = 'lyra'): number {
    return save.npcAffection?.[npcId] ?? (npcId === 'lyra' ? save.affection : 0);
  }

  /** 更新好感度并保存 */
  static updateAffection(save: SaveData, delta: number, npcId = 'lyra'): number {
    const next = Math.max(-10, Math.min(100, SaveSystem.getAffection(save, npcId) + delta));
    if (!save.npcAffection) save.npcAffection = {};
    save.npcAffection[npcId] = next;
    if (npcId === 'lyra') save.affection = next;
    SaveSystem.save(save);
    return next;
  }

  /** 标记完成事件 */
  static markEventComplete(save: SaveData, eventId: string): void {
    if (!save.completedEvents.includes(eventId)) {
      save.completedEvents.push(eventId);
      SaveSystem.save(save);
    }
  }

  /** 检查事件是否已完成 */
  static hasEvent(save: SaveData, eventId: string): boolean {
    return save.completedEvents.includes(eventId);
  }
}
