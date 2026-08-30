import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../modules/errors/index.ts';
import {
  createMemoryIndexedDbPort,
  createMemoryStorageLocalPort,
  createMemoryStorageSessionPort,
  initializePersistence,
  listSessions,
  readSettings,
  upsertSession,
  validateSessionProfile,
} from '../../../modules/persistence/index.ts';
import { createPersistentSession } from '../../../modules/domain/session-factory.ts';
import { markSessionReady } from '../../../modules/domain/lifecycle.ts';
import { STORAGE_KEYS } from '../../../modules/persistence/keys.ts';
import { SCHEMA_VERSION } from '../../../modules/domain/schemas.ts';

const NOW = '2026-01-01T00:00:00.000Z';

function createContext() {
  return {
    local: createMemoryStorageLocalPort(),
    session: createMemoryStorageSessionPort(),
    idb: createMemoryIndexedDbPort(),
  };
}

describe('persistence', () => {
  it('runs v1 migration and initializes empty collections', async () => {
    const context = createContext();
    await initializePersistence(context);

    const settings = await readSettings(context.local);
    expect(settings.appearance).toBe('system');

    const sessions = await listSessions(context.local);
    expect(sessions).toEqual([]);

    const schema = await context.local.get<{ schemaVersion: number }>(
      STORAGE_KEYS.schema,
    );
    expect(schema?.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('roundtrips sessions through in-memory local storage', async () => {
    const context = createContext();
    await initializePersistence(context);

    const profile = markSessionReady(createPersistentSession([], [], NOW), NOW);
    await upsertSession(context.local, profile);

    const sessions = await listSessions(context.local);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.id).toBe(profile.id);
    expect(sessions[0]?.name).toBe(profile.name);
  });

  it('rejects corrupted session JSON on read', async () => {
    const context = createContext();
    await context.local.set(STORAGE_KEYS.sessions, {
      sessions: [{ id: 'bad', name: '' }],
    });

    await expect(listSessions(context.local)).rejects.toThrow(DomainError);
  });

  it('rejects invalid profiles via validateSessionProfile', () => {
    expect(() => validateSessionProfile({ not: 'a session' })).toThrow(DomainError);
    try {
      validateSessionProfile({ not: 'a session' });
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      if (error instanceof DomainError) {
        expect(error.code).toBe('StorageCorrupted');
      }
    }
  });

  it('roundtrips indexeddb values through the memory port', async () => {
    const idb = createMemoryIndexedDbPort();
    await idb.put('kv', { key: 'hello', value: 'world' }, 'hello');
    const value = await idb.get<{ key: string; value: string }>('kv', 'hello');
    expect(value?.value).toBe('world');
  });
});
