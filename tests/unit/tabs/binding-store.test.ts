import { describe, expect, it } from 'vitest';
import { asDomainGroupId, asSessionId, asTabId } from '../../../modules/domain/ids.ts';
import {
  createMemoryTabBindingStore,
  dropStaleBindings,
} from '../../../modules/tabs/binding-store.ts';

describe('dropStaleBindings', () => {
  it('removes bindings whose tab ids are no longer open', () => {
    const bindings = [
      {
        tabId: asTabId(1),
        sessionId: asSessionId('ses_a'),
        domainGroupId: asDomainGroupId('dg_a'),
        assignmentState: 'bound' as const,
        createdAt: 1,
        lastVerifiedAt: 1,
      },
      {
        tabId: asTabId(2),
        sessionId: asSessionId('ses_b'),
        domainGroupId: asDomainGroupId('dg_b'),
        assignmentState: 'bound' as const,
        createdAt: 1,
        lastVerifiedAt: 1,
      },
    ];

    const open = new Set<number>([2]);
    const result = dropStaleBindings(bindings, open);
    expect(result).toHaveLength(1);
    expect(result[0]?.tabId).toBe(2);
  });
});

describe('createMemoryTabBindingStore', () => {
  it('stores and retrieves bindings', async () => {
    const store = createMemoryTabBindingStore();
    const binding = {
      tabId: asTabId(9),
      sessionId: asSessionId('ses_9'),
      domainGroupId: asDomainGroupId('dg_9'),
      assignmentState: 'bound' as const,
      createdAt: 10,
      lastVerifiedAt: 10,
    };
    await store.set(binding);
    expect(await store.get(9)).toEqual(binding);
    await store.delete(9);
    expect(await store.get(9)).toBeUndefined();
  });
});
