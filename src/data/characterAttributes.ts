import type { AttributeDefinition, CharacterAttributes } from '../types';

export const ATTRIBUTE_DEFINITIONS: readonly AttributeDefinition[] = [
  { id: 'vitality', label: '生命力', shortLabel: '生命', description: '提升生命上限与受治疗效率。' },
  { id: 'focus', label: '专注', shortLabel: '专注', description: '提升法力上限、施法稳定性与冷却效率。' },
  { id: 'strength', label: '力量', shortLabel: '力量', description: '提升近战伤害与重武器破防能力。' },
  { id: 'agility', label: '敏捷', shortLabel: '敏捷', description: '提升闪避、速度与连击技能收益。' },
  { id: 'intellect', label: '智识', shortLabel: '智识', description: '提升法术强度与远程符文操控。' },
  { id: 'willpower', label: '意志', shortLabel: '意志', description: '提升防御结界、抗性与控制抵抗。' },
  { id: 'perception', label: '感知', shortLabel: '感知', description: '提升远程命中、暴击与弱点识别。' },
  { id: 'charisma', label: '魅力', shortLabel: '魅力', description: '提升支援法术、同伴协作与社交收益。' },
  { id: 'endurance', label: '耐力', shortLabel: '耐力', description: '提升体力上限、护甲与持续作战能力。' },
  { id: 'arcana', label: '奥术', shortLabel: '奥术', description: '提升元素魔法、附魔武器与爆发伤害。' },
  { id: 'spirit', label: '灵性', shortLabel: '灵性', description: '提升治疗、护盾与召唤类能力。' },
  { id: 'luck', label: '幸运', shortLabel: '幸运', description: '提升暴击、掉落品质与异常触发率。' },
] as const;

export const DEFAULT_PLAYER_ATTRIBUTES: CharacterAttributes = {
  vitality: 14,
  focus: 13,
  strength: 12,
  agility: 14,
  intellect: 15,
  willpower: 13,
  perception: 14,
  charisma: 11,
  endurance: 13,
  arcana: 16,
  spirit: 12,
  luck: 10,
};

export function createDefaultAttributes(): CharacterAttributes {
  return { ...DEFAULT_PLAYER_ATTRIBUTES };
}
