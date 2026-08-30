import { describe, expect, it } from 'vitest';
import { asDomainGroupId, asSessionId, asTabId } from '../../../modules/domain/ids.ts';
import type { TabBinding } from '../../../modules/domain/tab-binding.ts';
import { UNASSIGNED_SESSION_ID } from '../../../modules/tabs/constants.ts';
import { isToolbarIconFilled, shouldSyncToolbarIconOnTabUpdate } from '../../../modules/tabs/action-icon.ts';

function binding(overrides: Partial<TabBinding> = {}): TabBinding {
  return {
    tabId: asTabId(1),
    sessionId: asSessionId('ses_work'),
    domainGroupId: asDomainGroupId('dg_site'),
    assignmentState: 'bound',
    createdAt: 1,
    lastVerifiedAt: 1,
    ...overrides,
  };
}

describe('isToolbarIconFilled', () => {
  it('is filled when the tab is bound to a real session', () => {
    expect(isToolbarIconFilled(binding())).toBe(true);
  });

  it('is idle when the tab has no binding', () => {
    expect(isToolbarIconFilled(undefined)).toBe(false);
  });

  it('is filled when isolation is degraded but the tab still belongs to a session', () => {
    expect(isToolbarIconFilled(binding({ assignmentState: 'degraded' }))).toBe(true);
  });

  it('is idle for fail-closed unassigned tabs', () => {
    expect(
      isToolbarIconFilled(
        binding({
          sessionId: UNASSIGNED_SESSION_ID,
          assignmentState: 'unassigned',
        }),
      ),
    ).toBe(false);
  });
});

describe('shouldSyncToolbarIconOnTabUpdate', () => {
  it('syncs after a navigation commits a new url', () => {
    expect(shouldSyncToolbarIconOnTabUpdate({ url: 'https://example.com/' })).toBe(true);
  });

  it('syncs when the tab finishes loading', () => {
    expect(shouldSyncToolbarIconOnTabUpdate({ status: 'complete' })).toBe(true);
  });

  it('syncs when the tab starts loading so Chrome cannot leave a stale outline', () => {
    expect(shouldSyncToolbarIconOnTabUpdate({ status: 'loading' })).toBe(true);
  });

  it('ignores unrelated favicon noise', () => {
    expect(shouldSyncToolbarIconOnTabUpdate({})).toBe(false);
  });
});
