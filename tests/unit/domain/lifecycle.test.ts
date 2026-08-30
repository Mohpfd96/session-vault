import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../modules/errors/index.ts';
import {
  activateSession,
  archiveSession,
  beginSessionDeletion,
  canBindTab,
  invalidSessionTransition,
  isOperationalState,
  lockSession,
  markSessionDegraded,
  markSessionReady,
  recoverSession,
  suspendSession,
  unlockSession,
} from '../../../modules/domain/lifecycle.ts';
import { createPersistentSession } from '../../../modules/domain/session-factory.ts';

const NOW = '2026-01-01T00:00:00.000Z';

describe('session lifecycle transitions', () => {
  it('moves creating → ready → active → suspended', () => {
    const created = createPersistentSession([], [], NOW);
    expect(created.state).toBe('creating');

    const ready = markSessionReady(created, NOW);
    expect(ready.state).toBe('ready');
    expect(ready.archived).toBe(false);
    expect(ready.locked).toBe(false);

    const active = activateSession(ready, NOW);
    expect(active.state).toBe('active');
    expect(active.lastUsedAt).toBe(NOW);

    const suspended = suspendSession(active, NOW);
    expect(suspended.state).toBe('suspended');
  });

  it('rejects invalid transitions', () => {
    const created = createPersistentSession([], [], NOW);
    expect(() => activateSession(created, NOW)).toThrow(DomainError);
    try {
      activateSession(created, NOW);
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      if (error instanceof DomainError) {
        expect(error.code).toBe('ValidationFailed');
      }
    }
  });

  it('archives and locks with mirrored flags', () => {
    const ready = markSessionReady(createPersistentSession([], [], NOW), NOW);
    const archived = archiveSession(ready, NOW);
    expect(archived.state).toBe('archived');
    expect(archived.archived).toBe(true);

    const locked = lockSession(ready, NOW);
    expect(locked.state).toBe('locked');
    expect(locked.locked).toBe(true);

    const unlocked = unlockSession(locked, NOW);
    expect(unlocked.state).toBe('ready');
    expect(unlocked.locked).toBe(false);
  });

  it('recovers degraded sessions to ready', () => {
    const ready = markSessionReady(createPersistentSession([], [], NOW), NOW);
    const active = activateSession(ready, NOW);
    const degraded = markSessionDegraded(active, NOW);
    const recovered = recoverSession(degraded, NOW);
    expect(recovered.state).toBe('ready');
  });

  it('beginDeletion is idempotent when already deleting', () => {
    const ready = markSessionReady(createPersistentSession([], [], NOW), NOW);
    const deleting = beginSessionDeletion(ready, NOW);
    expect(deleting.state).toBe('deleting');
    const again = beginSessionDeletion(deleting, NOW);
    expect(again).toEqual(deleting);
  });

  it('blocks transitions from deleting except idempotent beginDeletion', () => {
    const ready = markSessionReady(createPersistentSession([], [], NOW), NOW);
    const deleting = beginSessionDeletion(ready, NOW);
    expect(() => activateSession(deleting, NOW)).toThrow(DomainError);
  });

  it('exposes operational and bindable helpers', () => {
    expect(isOperationalState('active')).toBe(true);
    expect(isOperationalState('locked')).toBe(false);
    expect(canBindTab('ready')).toBe(true);
    expect(canBindTab('corrupted')).toBe(false);
  });

  it('builds descriptive invalid transition errors', () => {
    const error = invalidSessionTransition('creating', 'activate');
    expect(error.code).toBe('ValidationFailed');
    expect(error.message).toContain('activate');
  });
});
