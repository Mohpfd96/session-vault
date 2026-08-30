import { updateSessionRules } from '../adapters/chrome/dnr-adapter.ts';
import type { DnrSessionRule } from '../adapters/chrome/dnr-types.ts';
import { getTab } from '../adapters/chrome/tabs-adapter.ts';
import type { AssignmentState } from '../domain/enums.ts';
import type { Origin, SessionId, TabId } from '../domain/ids.ts';
import type { VirtualCookie } from '../domain/virtual-cookie.ts';
import { compileTabRules, type DnrRule } from '../dnr/index.ts';
import type { RuleIdAllocator } from '../dnr/types.ts';
import { DomainError, ruleCapacityExceeded } from '../errors/index.ts';
import { logger } from '../logging/index.ts';
import { hostFromUrl } from '../domains/matcher.ts';
import type {
  BindTabInput,
  CompatibilityReport,
  IsolationProvider,
  IsolationResult,
  RuleRebuildScope,
  SafeNavigateInput,
} from './provider.ts';
import {
  allTrackedRuleIds,
  DNR_RULE_MAP_KEY,
  MAX_RULE_ID,
  MIN_RULE_ID,
  removeTabFromRuleMap,
  ruleIdsForTab,
  setTabRuleIds,
  type DnrRuleMap,
  type RuleIdAllocatorStore,
} from './rule-id-allocator.ts';
import { compileFailClosedRules } from './rule-compiler.ts';
import { createBlankTab, updateTabUrl } from '../adapters/chrome/tabs-adapter.ts';

export type IsolationCookieSource = {
  readonly getCookiesForSession: (
    sessionId: SessionId,
  ) => Promise<readonly VirtualCookie[]>;
};

export type VirtualExtensionProviderDeps = {
  readonly ruleStore: RuleIdAllocatorStore;
  readonly cookies: IsolationCookieSource;
};

function toSessionRules(rules: readonly DnrRule[]): DnrSessionRule[] {
  return rules.map((rule) => {
    const action = rule.action;
    const requestHeaders =
      action.type === 'modifyHeaders' && action.requestHeaders !== undefined
        ? action.requestHeaders.map((header) => ({
            header: header.header,
            operation: header.operation,
            ...(header.value !== undefined ? { value: header.value } : {}),
          }))
        : undefined;
    const responseHeaders =
      action.type === 'modifyHeaders' && action.responseHeaders !== undefined
        ? action.responseHeaders.map((header) => ({
            header: header.header,
            operation: header.operation,
            ...(header.value !== undefined ? { value: header.value } : {}),
          }))
        : undefined;

    return {
      id: rule.id,
      priority: rule.priority,
      action: {
        type: 'modifyHeaders',
        ...(requestHeaders !== undefined ? { requestHeaders } : {}),
        ...(responseHeaders !== undefined ? { responseHeaders } : {}),
      },
      condition: {
        tabIds: [...(rule.condition.tabIds ?? [])],
        resourceTypes: [...(rule.condition.resourceTypes ?? ['other'])].filter(
          (type): type is DnrSessionRule['condition']['resourceTypes'][number] =>
            type === 'main_frame' ||
            type === 'sub_frame' ||
            type === 'xmlhttprequest' ||
            type === 'websocket' ||
            type === 'other',
        ),
        ...(rule.condition.requestDomains !== undefined
          ? { requestDomains: [...rule.condition.requestDomains] }
          : {}),
        ...(rule.condition.urlFilter !== undefined
          ? { urlFilter: rule.condition.urlFilter }
          : {}),
      },
    };
  });
}

function createFreeIdAllocator(used: Set<number>): {
  allocator: RuleIdAllocator;
} {
  let cursor = MIN_RULE_ID;
  const allocator = {
    nextId(): number {
      while (cursor <= MAX_RULE_ID && used.has(cursor)) {
        cursor += 1;
      }
      if (cursor > MAX_RULE_ID) {
        throw ruleCapacityExceeded();
      }
      const id = cursor;
      used.add(id);
      cursor += 1;
      return id;
    },
  };
  return { allocator };
}

async function removeRulesForTab(
  store: RuleIdAllocatorStore,
  tabId: TabId,
): Promise<DnrRuleMap> {
  const map = await store.getMap();
  const existing = ruleIdsForTab(map, tabId);
  if (existing.length > 0) {
    await updateSessionRules({ removeRuleIds: existing });
  }
  const nextMap = removeTabFromRuleMap(map, tabId);
  await store.setMap(nextMap);
  return nextMap;
}

function failClosedAssignment(state: AssignmentState): boolean {
  return (
    state === 'unassigned' ||
    state === 'degraded' ||
    state === 'locked' ||
    state === 'pending'
  );
}

async function installRules(
  store: RuleIdAllocatorStore,
  tabId: TabId,
  assignmentState: AssignmentState,
  host: string | undefined,
  cookies: readonly VirtualCookie[],
): Promise<IsolationResult> {
  await removeRulesForTab(store, tabId);
  const map = await store.getMap();
  const used = new Set(allTrackedRuleIds(map));

  try {
    let rules: DnrSessionRule[];
    let nextState = assignmentState;

    if (host === undefined || failClosedAssignment(assignmentState)) {
      const { allocator } = createFreeIdAllocator(used);
      const compiled = compileFailClosedRules(tabId, {
        failClosedStripId: allocator.nextId(),
        nativeSetCookieStripId: allocator.nextId(),
      });
      rules = [...compiled];
    } else {
      const { allocator } = createFreeIdAllocator(used);
      const compiled = compileTabRules(
        {
          tabId,
          host,
          cookies,
          mode: assignmentState === 'bound' ? 'healthy' : 'fail-closed',
          now: Date.now(),
        },
        allocator,
      );
      if (compiled.mode === 'degraded') {
        nextState = 'degraded';
      }
      rules = toSessionRules(compiled.rules);
    }

    await updateSessionRules({ addRules: rules });
    await store.setMap(
      setTabRuleIds(
        map,
        tabId,
        rules.map((rule) => rule.id),
      ),
    );
    return {
      assignmentState: nextState,
      ruleIds: rules.map((rule) => rule.id),
    };
  } catch (error) {
    logger.error('Failed to install DNR rules; installing fail-closed strip', {
      tabId,
      error: error instanceof Error ? error.message : 'unknown',
    });
    const { allocator } = createFreeIdAllocator(used);
    const compiled = compileFailClosedRules(tabId, {
      failClosedStripId: allocator.nextId(),
      nativeSetCookieStripId: allocator.nextId(),
    });
    try {
      await updateSessionRules({ addRules: [...compiled] });
      await store.setMap(
        setTabRuleIds(
          map,
          tabId,
          compiled.map((rule) => rule.id),
        ),
      );
      return {
        assignmentState: 'degraded',
        ruleIds: compiled.map((rule) => rule.id),
      };
    } catch {
      logger.error('Failed to install fail-closed DNR rules after install error', {
        tabId,
      });
      throw error;
    }
  }
}

async function resolveHost(tabId: TabId, url?: string): Promise<string | undefined> {
  if (url !== undefined) {
    return hostFromUrl(url);
  }
  const tab = await getTab(tabId);
  if (tab?.url === undefined) {
    return undefined;
  }
  return hostFromUrl(tab.url);
}

export function createVirtualExtensionIsolationProvider(
  deps: VirtualExtensionProviderDeps,
): IsolationProvider {
  const { ruleStore, cookies } = deps;

  return {
    kind: 'virtual-extension',

    async bindTab(input: BindTabInput): Promise<IsolationResult> {
      const assignmentState: AssignmentState = input.assignmentState ?? 'bound';
      const host = await resolveHost(input.tabId, input.url);
      const jar =
        assignmentState === 'bound'
          ? await cookies.getCookiesForSession(input.sessionId)
          : [];
      try {
        return await installRules(ruleStore, input.tabId, assignmentState, host, jar);
      } catch (error) {
        if (error instanceof DomainError && error.code === 'RuleCapacityExceeded') {
          return installRules(ruleStore, input.tabId, 'degraded', host, []);
        }
        throw error;
      }
    },

    async unbindTab(tabId: TabId): Promise<void> {
      await removeRulesForTab(ruleStore, tabId);
    },

    async navigateSafely(input: SafeNavigateInput): Promise<TabId> {
      const tabId = await createBlankTab();
      const host = hostFromUrl(input.url);
      const jar = await cookies.getCookiesForSession(input.sessionId);
      await installRules(ruleStore, tabId, 'bound', host, jar);
      await updateTabUrl(tabId, input.url);
      return tabId;
    },

    async rebuildRules(scope: RuleRebuildScope): Promise<readonly IsolationResult[]> {
      const results: IsolationResult[] = [];
      for (const tabId of scope.tabIds) {
        const host = await resolveHost(tabId);
        results.push(await installRules(ruleStore, tabId, 'bound', host, []));
      }
      return results;
    },

    async getCompatibility(_origin: Origin): Promise<CompatibilityReport> {
      return { level: 'full', reasons: [] };
    },

    async installFailClosedStrip(tabId: TabId): Promise<IsolationResult> {
      return installRules(ruleStore, tabId, 'unassigned', undefined, []);
    },
  };
}

export async function cleanupUnknownSessionRules(
  store: RuleIdAllocatorStore,
): Promise<void> {
  const map = await store.getMap();
  const tracked = new Set(allTrackedRuleIds(map));
  const { getSessionRules } = await import('../adapters/chrome/dnr-adapter.ts');
  const installed = await getSessionRules();
  const unknown = installed.map((rule) => rule.id).filter((id) => !tracked.has(id));

  if (unknown.length > 0) {
    await updateSessionRules({ removeRuleIds: unknown });
    logger.info('Removed unknown session DNR rules', { count: unknown.length });
  }
}

export { DNR_RULE_MAP_KEY };
