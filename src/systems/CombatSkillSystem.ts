import { COMBAT_SKILLS, DEFAULT_SKILL_LOADOUT, DEFENSE_SKILLS, MELEE_SKILLS, RANGED_SKILLS } from '../data/combatSkills';
import { CharacterStatsSystem } from './CharacterStatsSystem';
import { InventorySystem } from './InventorySystem';
import type {
  AttackSkillRange,
  CharacterAttributes,
  CombatSkillDefinition,
  DerivedCombatStats,
  SaveData,
  SkillCategory,
  SkillLoadout,
} from '../types';

const SKILLS_BY_ID = new Map(COMBAT_SKILLS.map((skill) => [skill.id, skill]));

export interface SkillPowerPreview {
  skill: CombatSkillDefinition;
  value: number;
  label: '伤害' | '护盾';
  critChance: number;
  cooldown: number;
  costText: string;
}

export class CombatSkillSystem {
  static readonly meleeSkills = MELEE_SKILLS;
  static readonly rangedSkills = RANGED_SKILLS;
  static readonly defenseSkills = DEFENSE_SKILLS;
  static readonly allSkills = COMBAT_SKILLS;

  static createDefaultLoadout(): SkillLoadout {
    return { ...DEFAULT_SKILL_LOADOUT };
  }

  static normalizeLoadout(input?: Partial<SkillLoadout>): SkillLoadout {
    return {
      melee: CombatSkillSystem.isSkillInCategory(input?.melee, 'melee') ? input!.melee! : DEFAULT_SKILL_LOADOUT.melee,
      ranged: CombatSkillSystem.isSkillInCategory(input?.ranged, 'ranged') ? input!.ranged! : DEFAULT_SKILL_LOADOUT.ranged,
      defense: CombatSkillSystem.isSkillInCategory(input?.defense, 'defense') ? input!.defense! : DEFAULT_SKILL_LOADOUT.defense,
    };
  }

  static getSkill(id: string): CombatSkillDefinition | undefined {
    return SKILLS_BY_ID.get(id);
  }

  static getSkillsByCategory(category: SkillCategory): readonly CombatSkillDefinition[] {
    if (category === 'melee') return MELEE_SKILLS;
    if (category === 'ranged') return RANGED_SKILLS;
    return DEFENSE_SKILLS;
  }

  static cycleSkill(loadout: SkillLoadout, category: SkillCategory): SkillLoadout {
    const normalized = CombatSkillSystem.normalizeLoadout(loadout);
    const list = CombatSkillSystem.getSkillsByCategory(category);
    const current = normalized[category];
    const currentIndex = Math.max(0, list.findIndex((skill) => skill.id === current));
    return {
      ...normalized,
      [category]: list[(currentIndex + 1) % list.length].id,
    };
  }

  static getActiveSkill(loadout: SkillLoadout, category: SkillCategory): CombatSkillDefinition {
    const normalized = CombatSkillSystem.normalizeLoadout(loadout);
    const skill = SKILLS_BY_ID.get(normalized[category]);
    if (!skill) return CombatSkillSystem.getSkillsByCategory(category)[0];
    return skill;
  }

  static getEffectiveAttributes(save: SaveData): CharacterAttributes {
    const base = CharacterStatsSystem.normalizeAttributes(save.attributes);
    const bonus = InventorySystem.getEquippedAttributeBonuses(save.inventory);
    return CharacterStatsSystem.addAttributes(base, bonus);
  }

  static getDerivedStats(save: SaveData): DerivedCombatStats {
    const effective = CombatSkillSystem.getEffectiveAttributes(save);
    const derivedBonus = InventorySystem.getEquippedDerivedBonuses(save.inventory);
    return CharacterStatsSystem.deriveCombatStats(effective, derivedBonus);
  }

  static previewSkill(save: SaveData, category: SkillCategory): SkillPowerPreview {
    const skill = CombatSkillSystem.getActiveSkill(save.skillLoadout, category);
    const attributes = CombatSkillSystem.getEffectiveAttributes(save);
    const derived = CombatSkillSystem.getDerivedStats(save);
    const scalingValue = skill.scaling.reduce((sum, rule) => sum + attributes[rule.attribute] * rule.ratio, 0);
    const itemSkillBonus = InventorySystem.getSkillBonus(save.inventory, category);

    if (category === 'defense') {
      const value = Math.round(skill.basePower + scalingValue + derived.ward * 0.8 + derived.armor * 0.25 + itemSkillBonus);
      return {
        skill,
        value,
        label: '护盾',
        critChance: derived.critChance,
        cooldown: skill.cooldown,
        costText: CombatSkillSystem.formatCost(skill),
      };
    }

    const attackBase = category === 'melee'
      ? derived.meleePower + derived.spellPower * 0.22
      : derived.rangedPower + derived.spellPower * 0.32;
    const value = Math.round(skill.basePower + attackBase + scalingValue + itemSkillBonus);
    return {
      skill,
      value,
      label: '伤害',
      critChance: derived.critChance,
      cooldown: skill.cooldown,
      costText: CombatSkillSystem.formatCost(skill),
    };
  }

  static previewAttacks(save: SaveData): Record<AttackSkillRange, SkillPowerPreview> {
    return {
      melee: CombatSkillSystem.previewSkill(save, 'melee'),
      ranged: CombatSkillSystem.previewSkill(save, 'ranged'),
    };
  }

  static getCoverage(): { attributes: number; melee: number; ranged: number; defense: number; items: number } {
    return {
      attributes: CharacterStatsSystem.attributes.length,
      melee: MELEE_SKILLS.length,
      ranged: RANGED_SKILLS.length,
      defense: DEFENSE_SKILLS.length,
      items: InventorySystem.items.length,
    };
  }

  private static isSkillInCategory(id: string | undefined, category: SkillCategory): boolean {
    if (!id) return false;
    return SKILLS_BY_ID.get(id)?.category === category;
  }

  private static formatCost(skill: CombatSkillDefinition): string {
    const parts: string[] = [];
    if (skill.cost.stamina) parts.push(`${skill.cost.stamina} 体力`);
    if (skill.cost.mana) parts.push(`${skill.cost.mana} 法力`);
    return parts.join(' / ') || '无';
  }
}
