// src/types/index.ts — 全局类型定义

/** 好感度等级 */
export type AffectionLevel = 'cold' | 'neutral' | 'warm' | 'close';

/** NPC 数据定义 */
export interface NPCData {
  id: string;
  name: string;
  gender?: string;
  personality?: string;
  title: string;
  x: number;
  y: number;
  color: number | string;
  radius: number;
  area: string;
  description: string;
  worldX?: number;
  worldZ?: number;
  rotationY?: number;
  arc?: string;
  role?: string;
  order?: number;
}

/** 角色基础属性。数值以 1-99 为主，系统会在计算时做边界保护。 */
export type AttributeId =
  | 'vitality'
  | 'focus'
  | 'strength'
  | 'agility'
  | 'intellect'
  | 'willpower'
  | 'perception'
  | 'charisma'
  | 'endurance'
  | 'arcana'
  | 'spirit'
  | 'luck';

export type CharacterAttributes = Record<AttributeId, number>;

export interface AttributeDefinition {
  id: AttributeId;
  label: string;
  shortLabel: string;
  description: string;
}

export interface DerivedCombatStats {
  maxHealth: number;
  maxMana: number;
  maxStamina: number;
  meleePower: number;
  rangedPower: number;
  spellPower: number;
  armor: number;
  ward: number;
  evasion: number;
  critChance: number;
  critDamage: number;
  haste: number;
}

export type AttackSkillRange = 'melee' | 'ranged';
export type SkillCategory = AttackSkillRange | 'defense';
export type DamageType = 'physical' | 'arcane' | 'fire' | 'frost' | 'storm' | 'radiant' | 'shadow';

export interface SkillScaling {
  attribute: AttributeId;
  ratio: number;
}

export interface CombatSkillDefinition {
  id: string;
  category: SkillCategory;
  label: string;
  school: string;
  damageType: DamageType;
  description: string;
  basePower: number;
  cost: { stamina?: number; mana?: number };
  cooldown: number;
  scaling: SkillScaling[];
  effects: string[];
  requiredAttributes?: Partial<CharacterAttributes>;
}

export interface SkillLoadout {
  melee: string;
  ranged: string;
  defense: string;
}

export type ItemSlot =
  | 'mainHand'
  | 'offHand'
  | 'armor'
  | 'boots'
  | 'gloves'
  | 'trinket'
  | 'consumable'
  | 'relic';

export type ItemKind = 'weapon' | 'armor' | 'accessory' | 'consumable' | 'relic';

export type WeaponRange = 'melee' | 'ranged' | 'hybrid' | 'none';

export type ItemModelArchetype =
  | 'sword'
  | 'dagger'
  | 'staff'
  | 'wand'
  | 'bow'
  | 'crossbow'
  | 'spear'
  | 'shield'
  | 'tome'
  | 'orb'
  | 'armor'
  | 'robe'
  | 'ring'
  | 'amulet'
  | 'potion'
  | 'bomb'
  | 'boots'
  | 'gloves'
  | 'relic';

export interface ItemModelSpec {
  archetype: ItemModelArchetype;
  primaryColor: number;
  secondaryColor: number;
  emissiveColor?: number;
  scale: number;
}

export interface ItemDefinition {
  id: string;
  label: string;
  kind: ItemKind;
  slot: ItemSlot;
  range: WeaponRange;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  description: string;
  attributeBonuses: Partial<CharacterAttributes>;
  derivedBonuses?: Partial<DerivedCombatStats>;
  skillBonuses?: Partial<Record<SkillCategory, number>>;
  model: ItemModelSpec;
}

export interface EquipmentSlots {
  mainHand: string;
  offHand: string;
  armor: string;
  boots: string;
  gloves: string;
  trinket: string;
  consumable: string;
  relic: string;
}

export interface InventoryState {
  ownedItemIds: string[];
  equipped: EquipmentSlots;
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
  npcAffection: Record<string, number>;
  completedEvents: string[];
  currentDialogueId: string | null;
  lastInteractTimestamp: number;
  attributes: CharacterAttributes;
  skillLoadout: SkillLoadout;
  inventory: InventoryState;
}

/** 好感度等级映射 */
export function getAffectionLevel(affection: number): AffectionLevel {
  if (affection < 0) return 'cold';
  if (affection < 2) return 'neutral';
  if (affection < 5) return 'warm';
  return 'close';
}
