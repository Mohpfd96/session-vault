import { z } from 'zod';
import { schemaMetaSchema, type SchemaMeta } from '../domain/schemas.ts';
import { storageCorrupted } from '../errors/index.ts';
import { logger } from '../logging/index.ts';
import type { ChromeStorageLocalPort } from './ports/chrome-storage-local.ts';
import { STORAGE_KEYS } from './keys.ts';

export async function readSchemaMeta(
  port: ChromeStorageLocalPort,
): Promise<SchemaMeta | undefined> {
  const raw = await port.get<unknown>(STORAGE_KEYS.schema);
  if (raw === undefined) {
    return undefined;
  }

  const parsed = schemaMetaSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn('Schema meta failed validation', {
      issues: parsed.error.issues.length,
    });
    throw storageCorrupted('Stored schema metadata is invalid.');
  }

  return parsed.data;
}

export async function writeSchemaMeta(
  port: ChromeStorageLocalPort,
  meta: SchemaMeta,
): Promise<void> {
  const validated = schemaMetaSchema.parse(meta);
  await port.set(STORAGE_KEYS.schema, validated);
}

export const migrationLockSchema = z.object({
  fromVersion: z.number().int().nonnegative(),
  toVersion: z.number().int().positive(),
  startedAt: z.string().min(1),
  step: z.string().min(1).optional(),
});

export type MigrationLock = z.infer<typeof migrationLockSchema>;

export async function readMigrationLock(
  port: ChromeStorageLocalPort,
): Promise<MigrationLock | undefined> {
  const raw = await port.get<unknown>(STORAGE_KEYS.migrationLock);
  if (raw === undefined) {
    return undefined;
  }

  const parsed = migrationLockSchema.safeParse(raw);
  if (!parsed.success) {
    throw storageCorrupted('Stored migration lock is invalid.');
  }

  return parsed.data;
}

export async function writeMigrationLock(
  port: ChromeStorageLocalPort,
  lock: MigrationLock,
): Promise<void> {
  const validated = migrationLockSchema.parse(lock);
  await port.set(STORAGE_KEYS.migrationLock, validated);
}

export async function clearMigrationLock(port: ChromeStorageLocalPort): Promise<void> {
  await port.remove(STORAGE_KEYS.migrationLock);
}
