export const ACTIVE_NPC_IDS = ['lyra', 'mature_senpai'] as const;

export type ActiveNpcId = (typeof ACTIVE_NPC_IDS)[number];

const activeNpcIdSet: ReadonlySet<string> = new Set(ACTIVE_NPC_IDS);

export function isActiveNpcId(id: string): id is ActiveNpcId {
  return activeNpcIdSet.has(id);
}
