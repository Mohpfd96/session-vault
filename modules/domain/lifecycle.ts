import { DomainError } from '../errors/domain-error.ts';
import type { SessionState } from './enums.ts';
import type { SessionProfile } from './session-profile.ts';

export type SessionTransition =
  | 'markReady'
  | 'activate'
  | 'suspend'
  | 'archive'
  | 'unarchive'
  | 'lock'
  | 'unlock'
  | 'markDegraded'
  | 'recover'
  | 'startMigration'
  | 'completeMigration'
  | 'beginDeletion'
  | 'markCorrupted';

const TRANSITION_TARGETS: Readonly<Record<SessionTransition, readonly SessionState[]>> = {
  markReady: ['creating'],
  activate: ['ready', 'suspended', 'degraded'],
  suspend: ['active'],
  archive: ['ready', 'active', 'suspended'],
  unarchive: ['archived'],
  lock: ['ready', 'active', 'suspended'],
  unlock: ['locked'],
  markDegraded: ['ready', 'active', 'suspended', 'migrating'],
  recover: ['degraded'],
  startMigration: ['ready', 'active', 'suspended'],
  completeMigration: ['migrating'],
  beginDeletion: [
    'creating',
    'ready',
    'active',
    'suspended',
    'archived',
    'degraded',
    'locked',
    'corrupted',
    'migrating',
  ],
  markCorrupted: [
    'creating',
    'ready',
    'active',
    'suspended',
    'archived',
    'degraded',
    'locked',
    'migrating',
  ],
};

const TRANSITION_RESULT_STATES: Readonly<Record<SessionTransition, SessionState>> = {
  markReady: 'ready',
  activate: 'active',
  suspend: 'suspended',
  archive: 'archived',
  unarchive: 'ready',
  lock: 'locked',
  unlock: 'ready',
  markDegraded: 'degraded',
  recover: 'ready',
  startMigration: 'migrating',
  completeMigration: 'ready',
  beginDeletion: 'deleting',
  markCorrupted: 'corrupted',
};

export function invalidSessionTransition(
  from: SessionState,
  transition: SessionTransition,
): DomainError {
  return new DomainError(
    'ValidationFailed',
    `Invalid session transition "${transition}" from state "${from}".`,
    true,
    'Refresh the session list. If the problem persists, restore from a backup.',
  );
}

function assertTransition(session: SessionProfile, transition: SessionTransition): void {
  const allowedSources = TRANSITION_TARGETS[transition];
  if (!allowedSources.includes(session.state)) {
    throw invalidSessionTransition(session.state, transition);
  }
}

function withState(
  session: SessionProfile,
  state: SessionState,
  now: string,
): SessionProfile {
  return {
    ...session,
    state,
    archived: state === 'archived',
    locked: state === 'locked',
    updatedAt: now,
  };
}

function applyTransition(
  session: SessionProfile,
  transition: SessionTransition,
  now: string,
): SessionProfile {
  if (session.state === 'deleting' && transition !== 'beginDeletion') {
    throw invalidSessionTransition(session.state, transition);
  }

  if (transition === 'beginDeletion' && session.state === 'deleting') {
    return session;
  }

  assertTransition(session, transition);
  return withState(session, TRANSITION_RESULT_STATES[transition], now);
}

export function markSessionReady(session: SessionProfile, now: string): SessionProfile {
  return applyTransition(session, 'markReady', now);
}

export function activateSession(session: SessionProfile, now: string): SessionProfile {
  const next = applyTransition(session, 'activate', now);
  return { ...next, lastUsedAt: now };
}

export function suspendSession(session: SessionProfile, now: string): SessionProfile {
  return applyTransition(session, 'suspend', now);
}

export function archiveSession(session: SessionProfile, now: string): SessionProfile {
  return applyTransition(session, 'archive', now);
}

export function unarchiveSession(session: SessionProfile, now: string): SessionProfile {
  return applyTransition(session, 'unarchive', now);
}

export function lockSession(session: SessionProfile, now: string): SessionProfile {
  return applyTransition(session, 'lock', now);
}

export function unlockSession(session: SessionProfile, now: string): SessionProfile {
  return applyTransition(session, 'unlock', now);
}

export function markSessionDegraded(
  session: SessionProfile,
  now: string,
): SessionProfile {
  return applyTransition(session, 'markDegraded', now);
}

export function recoverSession(session: SessionProfile, now: string): SessionProfile {
  return applyTransition(session, 'recover', now);
}

export function startSessionMigration(
  session: SessionProfile,
  now: string,
): SessionProfile {
  return applyTransition(session, 'startMigration', now);
}

export function completeSessionMigration(
  session: SessionProfile,
  now: string,
): SessionProfile {
  return applyTransition(session, 'completeMigration', now);
}

export function beginSessionDeletion(
  session: SessionProfile,
  now: string,
): SessionProfile {
  return applyTransition(session, 'beginDeletion', now);
}

export function markSessionCorrupted(
  session: SessionProfile,
  now: string,
): SessionProfile {
  return applyTransition(session, 'markCorrupted', now);
}

export function isOperationalState(state: SessionState): boolean {
  switch (state) {
    case 'ready':
    case 'active':
    case 'suspended':
      return true;
    case 'creating':
    case 'archived':
    case 'deleting':
    case 'degraded':
    case 'locked':
    case 'corrupted':
    case 'migrating':
      return false;
    default: {
      const exhaustive: never = state;
      throw new DomainError(
        'StorageCorrupted',
        `Unknown session state "${String(exhaustive)}".`,
        true,
        'Restore from a backup if available.',
      );
    }
  }
}

export function canBindTab(state: SessionState): boolean {
  switch (state) {
    case 'ready':
    case 'active':
    case 'suspended':
      return true;
    case 'creating':
    case 'archived':
    case 'deleting':
    case 'degraded':
    case 'locked':
    case 'corrupted':
    case 'migrating':
      return false;
    default: {
      const exhaustive: never = state;
      throw new DomainError(
        'StorageCorrupted',
        `Unknown session state "${String(exhaustive)}".`,
        true,
        'Restore from a backup if available.',
      );
    }
  }
}
