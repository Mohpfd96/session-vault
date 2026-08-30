import { describe, expect, it } from 'vitest';
import {
  cleanupTemporarySessionMetadata,
  nextCycledId,
  shouldDisposeTemporarySession,
  sortSessionsForDisplay,
} from '../../../modules/domain/session-queries.ts';
import { createTemporarySession } from '../../../modules/domain/session-factory.ts';
import { activateSession, markSessionReady } from '../../../modules/domain/lifecycle.ts';
import { asSessionId } from '../../../modules/domain/ids.ts';

const NOW = '2026-01-01T00:00:00.000Z';

describe('session queries and temporary cleanup', () => {
  it('sorts pinned and active sessions first', () => {
    const base = markSessionReady(createTemporarySession([], [], NOW), NOW);
    const active = activateSession(
      { ...base, id: asSessionId('ses_a'), pinned: false },
      NOW,
    );
    const pinned = {
      ...base,
      id: asSessionId('ses_b'),
      pinned: true,
      state: 'ready' as const,
    };
    const sorted = sortSessionsForDisplay([active, pinned]);
    expect(sorted[0]?.id).toBe(pinned.id);
  });

  it('deletes temporary session metadata in deleting → remove order', () => {
    const temp = markSessionReady(createTemporarySession([], [], NOW), NOW);
    const firstPass = cleanupTemporarySessionMetadata([temp], temp.id, NOW);
    expect(firstPass.changed).toBe(true);
    expect(firstPass.sessions).toHaveLength(0);

    const secondPass = cleanupTemporarySessionMetadata([], temp.id, NOW);
    expect(secondPass.changed).toBe(false);
  });

  it('ignores persistent sessions for temporary cleanup', () => {
    const persistent = markSessionReady(createTemporarySession([], [], NOW), NOW);
    const renamed = { ...persistent, kind: 'persistent' as const };
    const result = cleanupTemporarySessionMetadata([renamed], renamed.id, NOW);
    expect(result.changed).toBe(false);
    expect(result.sessions).toHaveLength(1);
  });

  it('idempotently removes sessions already marked deleting', () => {
    const temp = markSessionReady(createTemporarySession([], [], NOW), NOW);
    const deleting = { ...temp, state: 'deleting' as const };
    const result = cleanupTemporarySessionMetadata([deleting], temp.id, NOW);
    expect(result.changed).toBe(true);
    expect(result.sessions).toHaveLength(0);
  });
});

describe('shouldDisposeTemporarySession', () => {
  it('deletes a temporary session when its last tab is gone', () => {
    const temp = markSessionReady(createTemporarySession([], [], NOW), NOW);
    expect(shouldDisposeTemporarySession(temp, 0)).toBe(true);
  });

  it('keeps a temporary session while any bound tab remains', () => {
    const temp = markSessionReady(createTemporarySession([], [], NOW), NOW);
    expect(shouldDisposeTemporarySession(temp, 1)).toBe(false);
  });

  it('never deletes a persistent session when its tab closes', () => {
    const persistent = {
      ...markSessionReady(createTemporarySession([], [], NOW), NOW),
      kind: 'persistent' as const,
    };
    expect(shouldDisposeTemporarySession(persistent, 0)).toBe(false);
  });
});

describe('nextCycledId', () => {
  it('picks the first session when the tab is unassigned', () => {
    expect(nextCycledId(['a', 'b'], null, 1)).toBe('a');
  });

  it('wraps forward and backward', () => {
    expect(nextCycledId(['a', 'b', 'c'], 'c', 1)).toBe('a');
    expect(nextCycledId(['a', 'b', 'c'], 'a', -1)).toBe('c');
  });
});
