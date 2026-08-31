import type { DnrResourceType, DnrSessionRule } from '../adapters/chrome/dnr-types.ts';
import { dnrUrlFilterForSite } from '../dnr/compiler.ts';

export const DNR_PRIORITIES = {
  FAIL_CLOSED_STRIP: 1000,
  VIRTUAL_COOKIE_PATH: 900,
  VIRTUAL_COOKIE_ROOT: 800,
  NATIVE_SET_COOKIE_STRIP: 700,
  RESERVED: 100,
} as const;

export const FAIL_CLOSED_RESOURCE_TYPES: readonly DnrResourceType[] = [
  'main_frame',
  'sub_frame',
  'xmlhttprequest',
  'websocket',
  'other',
];

export type FailClosedRuleIds = {
  readonly failClosedStripId: number;
  readonly nativeSetCookieStripId: number;
};

export function compileFailClosedRules(
  tabId: number,
  ruleIds: FailClosedRuleIds,
  host?: string,
): readonly DnrSessionRule[] {
  const condition = {
    tabIds: [tabId],
    resourceTypes: [...FAIL_CLOSED_RESOURCE_TYPES],
    ...(host !== undefined ? { urlFilter: dnrUrlFilterForSite(host) } : {}),
  };

  return [
    {
      id: ruleIds.failClosedStripId,
      priority: DNR_PRIORITIES.FAIL_CLOSED_STRIP,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'Cookie', operation: 'remove' }],
      },
      condition,
    },
    {
      id: ruleIds.nativeSetCookieStripId,
      priority: DNR_PRIORITIES.NATIVE_SET_COOKIE_STRIP,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [{ header: 'Set-Cookie', operation: 'remove' }],
      },
      condition,
    },
  ];
}

export function collectRuleIdsFromRules(
  rules: readonly DnrSessionRule[],
): readonly number[] {
  return rules.map((rule) => rule.id);
}
