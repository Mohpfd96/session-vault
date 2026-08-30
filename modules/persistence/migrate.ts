import { z } from 'zod';
import { SCHEMA_VERSION } from '../domain/schemas.ts';
import { migrationFailed, storageCorrupted } from '../errors/index.ts';
import { logger } from '../logging/index.ts';
import type { ChromeStorageLocalPort } from './ports/chrome-storage-local.ts';
import type { ChromeStorageSessionPort } from './ports/chrome-storage-session.ts';
import type { IndexedDbPort } from './ports/indexed-db.ts';
import { STORAGE_KEYS } from './keys.ts';
import {
  clearMigrationLock,
  readMigrationLock,
  readSchemaMeta,
  writeMigrationLock,
  writeSchemaMeta,
  type MigrationLock,
} from './schema-meta.ts';
import { DEFAULT_EXTENSION_SETTINGS, writeSettings } from './settings.ts';

const domainGroupIndexSchema = z.object({
  groups: z.array(z.unknown()),
});

const routingIndexSchema = z.object({
  rules: z.array(z.unknown()),
});

const sessionIndexSchema = z.object({
  sessions: z.array(z.unknown()),
});

const bindingsIndexSchema = z.object({
  bindings: z.array(z.unknown()),
});

const runtimeStateSchema = z.object({
  recoveredAt: z.string().optional(),
});

export type MigrationContext = {
  readonly local: ChromeStorageLocalPort;
  readonly session: ChromeStorageSessionPort;
  readonly idb: IndexedDbPort;
};

function isSupportedResumeStep(step: string | undefined): boolean {
  return step === 'init-local' || step === 'init-session';
}

async function ensureEmptyLocalCollections(local: ChromeStorageLocalPort): Promise<void> {
  const sessions = await local.get<unknown>(STORAGE_KEYS.sessions);
  if (sessions === undefined) {
    await local.set(STORAGE_KEYS.sessions, sessionIndexSchema.parse({ sessions: [] }));
  }

  const domainGroups = await local.get<unknown>(STORAGE_KEYS.domainGroups);
  if (domainGroups === undefined) {
    await local.set(
      STORAGE_KEYS.domainGroups,
      domainGroupIndexSchema.parse({ groups: [] }),
    );
  }

  const routing = await local.get<unknown>(STORAGE_KEYS.routing);
  if (routing === undefined) {
    await local.set(STORAGE_KEYS.routing, routingIndexSchema.parse({ rules: [] }));
  }

  const settings = await local.get<unknown>(STORAGE_KEYS.settings);
  if (settings === undefined) {
    await writeSettings(local, { ...DEFAULT_EXTENSION_SETTINGS });
  }
}

async function ensureEmptySessionCollections(
  session: ChromeStorageSessionPort,
): Promise<void> {
  const bindings = await session.get<unknown>(STORAGE_KEYS.bindings);
  if (bindings === undefined) {
    await session.set(STORAGE_KEYS.bindings, bindingsIndexSchema.parse({ bindings: [] }));
  }

  const runtime = await session.get<unknown>(STORAGE_KEYS.runtime);
  if (runtime === undefined) {
    await session.set(STORAGE_KEYS.runtime, runtimeStateSchema.parse({}));
  }
}

async function migrateV0ToV1(context: MigrationContext, now: string): Promise<void> {
  const existingMeta = await readSchemaMeta(context.local);
  if (existingMeta?.schemaVersion === SCHEMA_VERSION) {
    await clearMigrationLock(context.local);
    return;
  }

  await writeMigrationLock(context.local, {
    fromVersion: 0,
    toVersion: 1,
    startedAt: now,
    step: 'init-local',
  });

  await ensureEmptyLocalCollections(context.local);

  await writeMigrationLock(context.local, {
    fromVersion: 0,
    toVersion: 1,
    startedAt: now,
    step: 'init-session',
  });

  await ensureEmptySessionCollections(context.session);

  await writeSchemaMeta(context.local, {
    schemaVersion: SCHEMA_VERSION,
    migratedAt: now,
  });

  await clearMigrationLock(context.local);
}

function assertResumableLock(
  lock: MigrationLock,
  fromVersion: number,
  toVersion: number,
): void {
  if (lock.fromVersion !== fromVersion || lock.toVersion !== toVersion) {
    throw migrationFailed(
      'An interrupted migration from a different version is in progress.',
    );
  }
}

async function resumeInterruptedMigration(
  context: MigrationContext,
  lock: MigrationLock,
  now: string,
): Promise<void> {
  logger.warn('Resuming interrupted migration', {
    fromVersion: lock.fromVersion,
    toVersion: lock.toVersion,
    step: lock.step ?? 'unknown',
  });

  assertResumableLock(lock, lock.fromVersion, lock.toVersion);

  if (!isSupportedResumeStep(lock.step)) {
    throw migrationFailed(
      'Interrupted migration is in an unknown step; refusing to write partial session data.',
    );
  }

  if (lock.toVersion === 1) {
    await migrateV0ToV1(context, now);
    return;
  }

  throw migrationFailed(
    `Cannot resume migration to unsupported version ${lock.toVersion}.`,
  );
}

export async function runMigrations(
  fromVersion: number,
  toVersion: number,
  context: MigrationContext,
): Promise<void> {
  if (toVersion > SCHEMA_VERSION) {
    throw storageCorrupted(
      `Extension cannot migrate to schema version ${toVersion}; running version is ${SCHEMA_VERSION}.`,
    );
  }

  if (fromVersion === toVersion) {
    return;
  }

  if (fromVersion > toVersion) {
    throw storageCorrupted(
      `Stored schema version ${fromVersion} is newer than the running extension (${SCHEMA_VERSION}).`,
    );
  }

  const existingLock = await readMigrationLock(context.local);
  const now = new Date().toISOString();

  if (existingLock !== undefined) {
    await resumeInterruptedMigration(context, existingLock, now);
    if (fromVersion >= toVersion) {
      return;
    }
  }

  let current = fromVersion;
  while (current < toVersion) {
    const next = current + 1;
    if (next === 1) {
      await migrateV0ToV1(context, now);
    } else {
      throw migrationFailed(`No migration path from version ${current} to ${next}.`);
    }
    current = next;
  }
}

export async function initializePersistence(context: MigrationContext): Promise<void> {
  const meta = await readSchemaMeta(context.local);
  const fromVersion = meta?.schemaVersion ?? 0;
  await runMigrations(fromVersion, SCHEMA_VERSION, context);
}
