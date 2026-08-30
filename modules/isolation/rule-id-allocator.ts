export const DNR_RULE_MAP_KEY = 'sv.dnrRuleMap' as const;

export const MIN_RULE_ID = 1;
export const MAX_RULE_ID = 5000;

export type DnrRuleMap = Readonly<Record<string, readonly number[]>>;

export type RuleIdAllocatorStore = {
  getMap(): Promise<DnrRuleMap>;
  setMap(map: DnrRuleMap): Promise<void>;
};

export function tabKey(tabId: number): string {
  return String(tabId);
}

export function collectUsedIds(map: DnrRuleMap): Set<number> {
  const used = new Set<number>();
  for (const ids of Object.values(map)) {
    for (const id of ids) {
      used.add(id);
    }
  }
  return used;
}

export function removeTabFromRuleMap(map: DnrRuleMap, tabId: number): DnrRuleMap {
  const key = tabKey(tabId);
  if (map[key] === undefined) {
    return map;
  }
  const next = { ...map };
  delete next[key];
  return next;
}

export function ruleIdsForTab(map: DnrRuleMap, tabId: number): readonly number[] {
  return map[tabKey(tabId)] ?? [];
}

export function allTrackedRuleIds(map: DnrRuleMap): readonly number[] {
  const ids: number[] = [];
  for (const entry of Object.values(map)) {
    ids.push(...entry);
  }
  return ids;
}

export function setTabRuleIds(
  map: DnrRuleMap,
  tabId: number,
  ids: readonly number[],
): DnrRuleMap {
  return { ...map, [tabKey(tabId)]: ids };
}
