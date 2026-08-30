import type { SessionId } from './ids.ts';
import type { SessionKind, SessionState } from './enums.ts';
import { beginSessionDeletion } from './lifecycle.ts';
import type { SessionProfile } from './session-profile.ts';

export type SessionSortKey = 'pinned' | 'active' | 'name' | 'lastUsed';

function compareByName(a: SessionProfile, b: SessionProfile): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

export function findSessionById(
  sessions: readonly SessionProfile[],
  sessionId: SessionId,
): SessionProfile | undefined {
  return sessions.find((session) => session.id === sessionId);
}

export function listSessionsByKind(
  sessions: readonly SessionProfile[],
  kind: SessionKind,
): SessionProfile[] {
  return sessions.filter((session) => session.kind === kind);
}

export function listSessionsByState(
  sessions: readonly SessionProfile[],
  state: SessionState,
): SessionProfile[] {
  return sessions.filter((session) => session.state === state);
}

export function listOperationalSessions(
  sessions: readonly SessionProfile[],
): SessionProfile[] {
  return sessions.filter(
    (session) =>
      session.state === 'ready' ||
      session.state === 'active' ||
      session.state === 'suspended',
  );
}

export function listVisibleSessions(
  sessions: readonly SessionProfile[],
): SessionProfile[] {
  return sessions.filter((session) => session.state !== 'deleting');
}

export function sortSessionsForDisplay(
  sessions: readonly SessionProfile[],
): SessionProfile[] {
  return [...sessions].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }
    const leftActive = left.state === 'active' ? 0 : 1;
    const rightActive = right.state === 'active' ? 0 : 1;
    if (leftActive !== rightActive) {
      return leftActive - rightActive;
    }
    const lastUsed = right.lastUsedAt.localeCompare(left.lastUsedAt);
    if (lastUsed !== 0) {
      return lastUsed;
    }
    return compareByName(left, right);
  });
}

export function collectSessionNames(sessions: readonly SessionProfile[]): string[] {
  return sessions.map((session) => session.name);
}

export type TemporaryCleanupResult = {
  readonly sessions: SessionProfile[];
  readonly deletedSessionId?: SessionId;
  readonly changed: boolean;
};

export function shouldDisposeTemporarySession(
  session: SessionProfile | undefined,
  remainingBoundTabs: number,
): boolean {
  if (session === undefined || session.kind !== 'temporary') {
    return false;
  }
  if (remainingBoundTabs > 0) {
    return false;
  }
  return session.settings.temporaryCleanup !== 'grace-period';
}

export function nextCycledId<T>(
  items: readonly T[],
  current: T | null,
  delta: number,
): T | undefined {
  if (items.length === 0) {
    return undefined;
  }
  if (current === null) {
    return items[0];
  }
  const index = items.indexOf(current);
  if (index < 0) {
    return items[0];
  }
  const length = items.length;
  const nextIndex = (((index + delta) % length) + length) % length;
  return items[nextIndex];
}

export function cleanupTemporarySessionMetadata(
  sessions: readonly SessionProfile[],
  sessionId: SessionId,
  now: string,
): TemporaryCleanupResult {
  const existing = findSessionById(sessions, sessionId);
  if (existing === undefined) {
    return { sessions: [...sessions], changed: false };
  }

  if (existing.kind !== 'temporary') {
    return { sessions: [...sessions], changed: false };
  }

  if (existing.state === 'deleting') {
    const without = sessions.filter((session) => session.id !== sessionId);
    const removed = without.length !== sessions.length;
    return {
      sessions: without,
      deletedSessionId: sessionId,
      changed: removed,
    };
  }

  const marked = beginSessionDeletion(existing, now);
  const intermediate = sessions.map((session) =>
    session.id === sessionId ? marked : session,
  );
  const without = intermediate.filter((session) => session.id !== sessionId);

  return {
    sessions: without,
    deletedSessionId: sessionId,
    changed: true,
  };
}

export function upsertSessionInList(
  sessions: readonly SessionProfile[],
  profile: SessionProfile,
): SessionProfile[] {
  const index = sessions.findIndex((session) => session.id === profile.id);
  if (index === -1) {
    return [...sessions, profile];
  }
  const next = [...sessions];
  next[index] = profile;
  return next;
}

export function removeSessionFromList(
  sessions: readonly SessionProfile[],
  sessionId: SessionId,
): SessionProfile[] {
  return sessions.filter((session) => session.id !== sessionId);
}
