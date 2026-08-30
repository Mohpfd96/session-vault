export { STORAGE_KEYS, IDB_NAME, IDB_VERSION, IDB_STORES } from './keys.ts';

export type { ChromeStorageLocalPort } from './ports/chrome-storage-local.ts';
export type { ChromeStorageSessionPort } from './ports/chrome-storage-session.ts';
export type { IndexedDbPort, IdbStoreName, IdbKey } from './ports/indexed-db.ts';

export { createChromeStorageLocalPort } from './adapters/chrome-storage-local-adapter.ts';
export { createChromeStorageSessionPort } from './adapters/chrome-storage-session-adapter.ts';
export { createIndexedDbPort } from './adapters/indexed-db-adapter.ts';

export { createMemoryStorageLocalPort } from './memory/memory-storage-local.ts';
export { createMemoryStorageSessionPort } from './memory/memory-storage-session.ts';
export { createMemoryIndexedDbPort } from './memory/memory-indexed-db.ts';

export {
  appearanceSchema,
  extensionSettingsSchema,
  DEFAULT_EXTENSION_SETTINGS,
  readSettings,
  writeSettings,
  type ExtensionSettings,
} from './settings.ts';

export {
  readSchemaMeta,
  writeSchemaMeta,
  readMigrationLock,
  writeMigrationLock,
  clearMigrationLock,
  migrationLockSchema,
  type MigrationLock,
} from './schema-meta.ts';

export {
  listSessions,
  getSession,
  upsertSession,
  deleteSession,
  validateSessionProfile,
  type SessionIndex,
} from './sessions.ts';

export {
  runMigrations,
  initializePersistence,
  type MigrationContext,
} from './migrate.ts';

export {
  listCookies,
  listCookiesForSession,
  putCookie,
  deleteCookie,
  replaceSessionCookies,
} from './cookies.ts';

export { saveDomainGroups } from './domain-groups.ts';
