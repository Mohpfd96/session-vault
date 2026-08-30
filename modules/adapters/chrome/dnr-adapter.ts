import { browser } from 'wxt/browser';
import type { DnrLimits, DnrSessionRule, SessionRuleUpdate } from './dnr-types.ts';

export type { DnrLimits, DnrSessionRule, SessionRuleUpdate } from './dnr-types.ts';

export function getDnrLimits(): DnrLimits {
  const dnr = browser.declarativeNetRequest;
  return {
    maxSessionRules: dnr.MAX_NUMBER_OF_SESSION_RULES,
    maxUnsafeSessionRules: dnr.MAX_NUMBER_OF_UNSAFE_SESSION_RULES,
  };
}

export async function updateSessionRules(update: SessionRuleUpdate): Promise<void> {
  const payload: {
    removeRuleIds?: number[];
    addRules?: Parameters<
      typeof browser.declarativeNetRequest.updateSessionRules
    >[0]['addRules'];
  } = {};

  if (update.removeRuleIds !== undefined && update.removeRuleIds.length > 0) {
    payload.removeRuleIds = [...update.removeRuleIds];
  }
  if (update.addRules !== undefined && update.addRules.length > 0) {
    payload.addRules = update.addRules as NonNullable<(typeof payload)['addRules']>;
  }
  if (payload.removeRuleIds === undefined && payload.addRules === undefined) {
    return;
  }

  await browser.declarativeNetRequest.updateSessionRules(payload);
}

export async function getSessionRules(): Promise<readonly DnrSessionRule[]> {
  const rules = await browser.declarativeNetRequest.getSessionRules();
  return rules as DnrSessionRule[];
}
