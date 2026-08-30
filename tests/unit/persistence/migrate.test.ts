import { describe, expect, it } from 'vitest';
import { DomainError, migrationFailed } from '../../../modules/errors/index.ts';
import {
  createMemoryIndexedDbPort,
  createMemoryStorageLocalPort,
  createMemoryStorageSessionPort,
  runMigrations,
  writeMigrationLock,
} from '../../../modules/persistence/index.ts';
import { STORAGE_KEYS } from '../../../modules/persistence/keys.ts';

function createContext() {
  return {
    local: createMemoryStorageLocalPort(),
    session: createMemoryStorageSessionPort(),
    idb: createMemoryIndexedDbPort(),
  };
}

describe('migrations', () => {
  it('migrates from 0 to 1 idempotently', async () => {
    const context = createContext();
    await runMigrations(0, 1, context);
    await runMigrations(1, 1, context);

    const schema = await context.local.get<{ schemaVersion: number }>(
      STORAGE_KEYS.schema,
    );
    expect(schema?.schemaVersion).toBe(1);
    expect(await context.local.get(STORAGE_KEYS.migrationLock)).toBeUndefined();
  });

  it('resumes an interrupted v1 migration', async () => {
    const context = createContext();
    await writeMigrationLock(context.local, {
      fromVersion: 0,
      toVersion: 1,
      startedAt: '2026-01-01T00:00:00.000Z',
      step: 'init-local',
    });

    await runMigrations(0, 1, context);
    const schema = await context.local.get<{ schemaVersion: number }>(
      STORAGE_KEYS.schema,
    );
    expect(schema?.schemaVersion).toBe(1);
  });

  it('fails closed on unknown interrupted migration step', async () => {
    const context = createContext();
    await writeMigrationLock(context.local, {
      fromVersion: 0,
      toVersion: 1,
      startedAt: '2026-01-01T00:00:00.000Z',
      step: 'write-sessions',
    });

    await expect(runMigrations(0, 1, context)).rejects.toThrow(DomainError);
    try {
      await runMigrations(0, 1, context);
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      if (error instanceof DomainError) {
        expect(error.code).toBe('MigrationFailed');
      }
    }
  });

  it('refuses migrating to a future schema version', async () => {
    const context = createContext();
    await expect(runMigrations(1, 99, context)).rejects.toEqual(
      expect.objectContaining({ code: 'StorageCorrupted' }),
    );
  });

  it('surfaces migrationFailed helper for callers', () => {
    const error = migrationFailed('test');
    expect(error.code).toBe('MigrationFailed');
  });
});
