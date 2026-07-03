// src/types/index.ts — 全局类型定义

/** 好感度等级 */
export type AffectionLevel = 'cold' | 'neutral' | 'warm' | 'close';

/** NPC 数据定义 */
export interface NPCData {
  id: string;
  name: string;
  title: string;
  x: number;
  y: number;
  color: number;
  radius: number;
  area: string;
  description: string;
}

/** 对话选项 */
export interface DialogueChoice {
  id: string;
  text: string;
  affectionChange: number;
  /** 选择后的回复文本 */
  response: string;
  /** 回复后脚本回调名（可选，由 DialogueSystem 解释） */
  callback?: string;
}

/** 单页对话 */
export interface DialoguePage {
  speaker: string;
  text: string;
  choices?: DialogueChoice[];
  /** 如果没有 choices，按空格/Enter 翻到下一页 */
  nextPage?: string;
}

/** 一段完整对话 */
export interface DialogueTree {
  id: string;
  trigger: 'proximity' | 'event' | 'repeat';
  /** 触发条件：affection 最小值 */
  minAffection?: number;
  /** 触发条件：affection 最大值（用于限定低好感段） */
  maxAffection?: number;
  /** 需要此前已完成的事件 ID */
  requiredEvent?: string;
  /** 完成后标记的事件 ID */
  completesEvent?: string;
  pages: DialoguePage[];
}

/** 存档数据 */
export interface SaveData {
  affection: number;
  completedEvents: string[];
  currentDialogueId: string | null;
  lastInteractTimestamp: number;
}

/** 好感度等级映射 */
export function getAffectionLevel(affection: number): AffectionLevel {
  if (affection < 0) return 'cold';
  if (affection < 2) return 'neutral';
  if (affection < 5) return 'warm';
  return 'close';
}
