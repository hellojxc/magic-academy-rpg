import { ATTRIBUTE_DEFINITIONS, DEFAULT_PLAYER_ATTRIBUTES } from '../data/characterAttributes';
import type { CharacterAttributes, DerivedCombatStats } from '../types';

const ATTRIBUTE_MIN = 1;
const ATTRIBUTE_MAX = 99;

export class CharacterStatsSystem {
  static readonly attributes = ATTRIBUTE_DEFINITIONS;

  static normalizeAttributes(input?: Partial<CharacterAttributes>): CharacterAttributes {
    const normalized = { ...DEFAULT_PLAYER_ATTRIBUTES };
    for (const def of ATTRIBUTE_DEFINITIONS) {
      const value = input?.[def.id] ?? normalized[def.id];
      normalized[def.id] = CharacterStatsSystem.clampAttribute(value);
    }
    return normalized;
  }

  static addAttributes(
    base: CharacterAttributes,
    bonus: Partial<CharacterAttributes>
  ): CharacterAttributes {
    const result = { ...base };
    for (const def of ATTRIBUTE_DEFINITIONS) {
      result[def.id] = CharacterStatsSystem.clampAttribute(result[def.id] + (bonus[def.id] ?? 0));
    }
    return result;
  }

  static deriveCombatStats(
    attributes: CharacterAttributes,
    derivedBonuses: Partial<DerivedCombatStats> = {}
  ): DerivedCombatStats {
    const stats: DerivedCombatStats = {
      maxHealth: Math.round(90 + attributes.vitality * 8 + attributes.endurance * 3),
      maxMana: Math.round(55 + attributes.focus * 6 + attributes.intellect * 2 + attributes.arcana * 2),
      maxStamina: Math.round(70 + attributes.endurance * 5 + attributes.agility * 2 + attributes.strength * 2),
      meleePower: Math.round(10 + attributes.strength * 2.3 + attributes.agility * 0.9 + attributes.arcana * 0.5),
      rangedPower: Math.round(10 + attributes.perception * 2.1 + attributes.intellect * 1.1 + attributes.agility * 0.5),
      spellPower: Math.round(12 + attributes.arcana * 2.0 + attributes.intellect * 1.5 + attributes.focus * 0.7),
      armor: Math.round(6 + attributes.endurance * 1.4 + attributes.vitality * 0.6),
      ward: Math.round(5 + attributes.willpower * 1.6 + attributes.spirit * 1.0 + attributes.focus * 0.4),
      evasion: Number((3 + attributes.agility * 0.42 + attributes.luck * 0.16).toFixed(1)),
      critChance: Number((5 + attributes.perception * 0.34 + attributes.luck * 0.38).toFixed(1)),
      critDamage: Math.round(140 + attributes.strength * 0.8 + attributes.luck * 1.2),
      haste: Number((1 + attributes.agility * 0.22 + attributes.focus * 0.12).toFixed(1)),
    };

    for (const key of Object.keys(derivedBonuses) as Array<keyof DerivedCombatStats>) {
      stats[key] = Number((stats[key] + (derivedBonuses[key] ?? 0)).toFixed(1));
    }

    return stats;
  }

  static sumAttributeBonuses(bonuses: Array<Partial<CharacterAttributes>>): Partial<CharacterAttributes> {
    const total: Partial<CharacterAttributes> = {};
    for (const bonus of bonuses) {
      for (const def of ATTRIBUTE_DEFINITIONS) {
        total[def.id] = (total[def.id] ?? 0) + (bonus[def.id] ?? 0);
      }
    }
    return total;
  }

  static sumDerivedBonuses(bonuses: Array<Partial<DerivedCombatStats> | undefined>): Partial<DerivedCombatStats> {
    const total: Partial<DerivedCombatStats> = {};
    for (const bonus of bonuses) {
      if (!bonus) continue;
      for (const key of Object.keys(bonus) as Array<keyof DerivedCombatStats>) {
        total[key] = (total[key] ?? 0) + (bonus[key] ?? 0);
      }
    }
    return total;
  }

  private static clampAttribute(value: number): number {
    if (!Number.isFinite(value)) return ATTRIBUTE_MIN;
    return Math.max(ATTRIBUTE_MIN, Math.min(ATTRIBUTE_MAX, Math.round(value)));
  }
}
