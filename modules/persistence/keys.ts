export const STORAGE_KEYS = {
  schema: 'sv.schema',
  settings: 'sv.settings',
  sessions: 'sv.sessions',
  domainGroups: 'sv.domainGroups',
  routing: 'sv.routing',
  migrationLock: 'sv.migrationLock',
  bindings: 'sv.bindings',
  runtime: 'sv.runtime',
} as const;

export const IDB_NAME = 'sessionvault';
export const IDB_VERSION = 1;

export const IDB_STORES = {
  cookies: 'cookies',
  webStorage: 'webStorage',
  events: 'events',
  snapshots: 'snapshots',
  kv: 'kv',
} as const;
