import type { ChromeStorageSessionPort } from '../persistence/ports/chrome-storage-session.ts';
import {
  DNR_RULE_MAP_KEY,
  type DnrRuleMap,
  type RuleIdAllocatorStore,
} from './rule-id-allocator.ts';

export function createChromeRuleIdAllocatorStore(
  port: ChromeStorageSessionPort,
): RuleIdAllocatorStore {
  return {
    async getMap(): Promise<DnrRuleMap> {
      const raw = await port.get<DnrRuleMap>(DNR_RULE_MAP_KEY);
      return raw ?? {};
    },
    async setMap(map: DnrRuleMap): Promise<void> {
      await port.set(DNR_RULE_MAP_KEY, map);
    },
  };
}

export function createMemoryRuleIdAllocatorStore(
  initial: DnrRuleMap = {},
): RuleIdAllocatorStore {
  let map = initial;
  return {
    async getMap() {
      return map;
    },
    async setMap(next) {
      map = next;
    },
  };
}
