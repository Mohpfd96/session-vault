import { DNR_PRIORITIES } from './priorities.ts';
import type { DnrRule } from './types.ts';

export const MAX_UNSAFE_SESSION_RULES = 5000;

export type RuleBudgetProjection = {
  readonly totalRules: number;
  readonly perTab: ReadonlyMap<number, number>;
};

export type RuleBudgetStatus =
  | { readonly ok: true; readonly projection: RuleBudgetProjection }
  | {
      readonly ok: false;
      readonly projection: RuleBudgetProjection;
      readonly reason: 'capacity-exceeded';
    };

export type TabRuleCostInput = {
  readonly tabId: number;
  readonly cookiePaths: readonly string[];
  readonly healthy: boolean;
};

function uniqueNonRootPaths(paths: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const path of paths) {
    if (path === '/') {
      continue;
    }
    if (!seen.has(path)) {
      seen.add(path);
      result.push(path);
    }
  }
  return result;
}

export function projectTabRuleCost(input: TabRuleCostInput): number {
  if (!input.healthy) {
    return 1;
  }

  const nonRootPaths = uniqueNonRootPaths(input.cookiePaths);
  const allRoot =
    input.cookiePaths.length === 0 || input.cookiePaths.every((path) => path === '/');

  let count = 1;
  if (allRoot) {
    count += 1;
  } else {
    count += 1 + nonRootPaths.length;
  }
  count += 1;
  return count;
}

export function projectRuleBudget(
  tabs: readonly TabRuleCostInput[],
): RuleBudgetProjection {
  const perTab = new Map<number, number>();
  let totalRules = 0;

  for (const tab of tabs) {
    const cost = projectTabRuleCost(tab);
    perTab.set(tab.tabId, cost);
    totalRules += cost;
  }

  return { totalRules, perTab };
}

export function evaluateRuleBudget(projection: RuleBudgetProjection): RuleBudgetStatus {
  if (projection.totalRules > MAX_UNSAFE_SESSION_RULES) {
    return {
      ok: false,
      projection,
      reason: 'capacity-exceeded',
    };
  }
  return { ok: true, projection };
}

export function isFailClosedOnlyRules(rules: readonly DnrRule[]): boolean {
  if (rules.length === 0) {
    return true;
  }
  return rules.every(
    (rule) =>
      rule.priority === DNR_PRIORITIES.FAIL_CLOSED_STRIP &&
      rule.action.type === 'modifyHeaders' &&
      rule.action.requestHeaders?.some(
        (header) =>
          header.header.toLowerCase() === 'cookie' && header.operation === 'remove',
      ) === true,
  );
}

export function usesNativeCookieFallback(_rules: readonly DnrRule[]): boolean {
  return false;
}
