import { DEFAULT_EQUIPMENT, DEFAULT_OWNED_ITEM_IDS, ITEM_DEFINITIONS } from '../data/itemsAndWeapons';
import { CharacterStatsSystem } from './CharacterStatsSystem';
import type {
  CharacterAttributes,
  DerivedCombatStats,
  EquipmentSlots,
  InventoryState,
  ItemDefinition,
  ItemSlot,
  SkillCategory,
} from '../types';

const ITEMS_BY_ID = new Map(ITEM_DEFINITIONS.map((item) => [item.id, item]));

export class InventorySystem {
  static readonly items = ITEM_DEFINITIONS;

  static createDefaultInventory(): InventoryState {
    return {
      ownedItemIds: [...DEFAULT_OWNED_ITEM_IDS],
      equipped: { ...DEFAULT_EQUIPMENT } as EquipmentSlots,
    };
  }

  static normalizeInventory(input?: Partial<InventoryState>): InventoryState {
    const owned = new Set(input?.ownedItemIds?.filter((id) => ITEMS_BY_ID.has(id)) ?? DEFAULT_OWNED_ITEM_IDS);
    for (const id of Object.values(DEFAULT_EQUIPMENT)) owned.add(id);

    const equipped: EquipmentSlots = { ...DEFAULT_EQUIPMENT };
    const inputEquipped = input?.equipped as Partial<EquipmentSlots> | undefined;
    for (const slot of Object.keys(equipped) as ItemSlot[]) {
      const candidate = inputEquipped?.[slot];
      const item = candidate ? ITEMS_BY_ID.get(candidate) : undefined;
      equipped[slot] = item && item.slot === slot && owned.has(item.id) ? item.id : DEFAULT_EQUIPMENT[slot];
    }

    return {
      ownedItemIds: [...owned],
      equipped,
    };
  }

  static getItem(id: string): ItemDefinition | undefined {
    return ITEMS_BY_ID.get(id);
  }

  static getOwnedItems(inventory: InventoryState): ItemDefinition[] {
    return inventory.ownedItemIds
      .map((id) => ITEMS_BY_ID.get(id))
      .filter((item): item is ItemDefinition => Boolean(item));
  }

  static getEquippedItems(inventory: InventoryState): ItemDefinition[] {
    return (Object.keys(inventory.equipped) as ItemSlot[])
      .map((slot) => ITEMS_BY_ID.get(inventory.equipped[slot]))
      .filter((item): item is ItemDefinition => Boolean(item));
  }

  static getEquippedAttributeBonuses(inventory: InventoryState): Partial<CharacterAttributes> {
    return CharacterStatsSystem.sumAttributeBonuses(
      InventorySystem.getEquippedItems(inventory).map((item) => item.attributeBonuses)
    );
  }

  static getEquippedDerivedBonuses(inventory: InventoryState): Partial<DerivedCombatStats> {
    return CharacterStatsSystem.sumDerivedBonuses(
      InventorySystem.getEquippedItems(inventory).map((item) => item.derivedBonuses)
    );
  }

  static getSkillBonus(inventory: InventoryState, category: SkillCategory): number {
    return InventorySystem.getEquippedItems(inventory).reduce(
      (sum, item) => sum + (item.skillBonuses?.[category] ?? 0),
      0
    );
  }

  static cycleEquipment(inventory: InventoryState, slot: ItemSlot): InventoryState {
    const normalized = InventorySystem.normalizeInventory(inventory);
    const options = InventorySystem.getOwnedItems(normalized).filter((item) => item.slot === slot);
    if (options.length <= 1) return normalized;
    const currentIndex = Math.max(0, options.findIndex((item) => item.id === normalized.equipped[slot]));
    const next = options[(currentIndex + 1) % options.length];
    return {
      ...normalized,
      equipped: {
        ...normalized.equipped,
        [slot]: next.id,
      },
    };
  }
}
