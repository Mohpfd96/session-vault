import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { IDB_NAME, IDB_STORES, IDB_VERSION } from '../keys.ts';
import type { IdbKey, IdbStoreName, IndexedDbPort } from '../ports/indexed-db.ts';

interface SessionVaultDb extends DBSchema {
  cookies: {
    key: string;
    value: unknown;
    indexes: {
      bySession: string;
      bySessionDomain: [string, string];
    };
  };
  webStorage: {
    key: [string, string, string, string];
    value: unknown;
    indexes: {
      bySessionOrigin: [string, string];
    };
  };
  events: {
    key: number;
    value: unknown;
    indexes: {
      byTime: number;
      bySession: string;
    };
  };
  snapshots: {
    key: string;
    value: unknown;
    indexes: {
      bySession: string;
    };
  };
  kv: {
    key: string;
    value: unknown;
  };
}

let dbPromise: Promise<IDBPDatabase<SessionVaultDb>> | undefined;

function getDatabase(): Promise<IDBPDatabase<SessionVaultDb>> {
  if (dbPromise === undefined) {
    dbPromise = openDB<SessionVaultDb>(IDB_NAME, IDB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(IDB_STORES.cookies)) {
          const cookies = database.createObjectStore(IDB_STORES.cookies, {
            keyPath: 'id',
          });
          cookies.createIndex('bySession', 'sessionId', { unique: false });
          cookies.createIndex('bySessionDomain', ['sessionId', 'domain'], {
            unique: false,
          });
        }

        if (!database.objectStoreNames.contains(IDB_STORES.webStorage)) {
          const webStorage = database.createObjectStore(IDB_STORES.webStorage, {
            keyPath: ['sessionId', 'origin', 'kind', 'key'],
          });
          webStorage.createIndex('bySessionOrigin', ['sessionId', 'origin'], {
            unique: false,
          });
        }

        if (!database.objectStoreNames.contains(IDB_STORES.events)) {
          const events = database.createObjectStore(IDB_STORES.events, {
            autoIncrement: true,
          });
          events.createIndex('byTime', 'timestamp', { unique: false });
          events.createIndex('bySession', 'sessionId', { unique: false });
        }

        if (!database.objectStoreNames.contains(IDB_STORES.snapshots)) {
          const snapshots = database.createObjectStore(IDB_STORES.snapshots, {
            keyPath: 'id',
          });
          snapshots.createIndex('bySession', 'sessionId', { unique: false });
        }

        if (!database.objectStoreNames.contains(IDB_STORES.kv)) {
          database.createObjectStore(IDB_STORES.kv, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export function createIndexedDbPort(): IndexedDbPort {
  return {
    async get<T>(store: IdbStoreName, key: IdbKey): Promise<T | undefined> {
      const database = await getDatabase();
      const value = await database.get(store, key);
      if (value === undefined) {
        return undefined;
      }
      return value as T;
    },

    async put<T>(store: IdbStoreName, value: T, key?: IdbKey): Promise<IdbKey> {
      const database = await getDatabase();
      if (key === undefined) {
        return database.add(store, value);
      }
      await database.put(store, value, key);
      return key;
    },

    async delete(store: IdbStoreName, key: IdbKey): Promise<void> {
      const database = await getDatabase();
      await database.delete(store, key);
    },

    async getAll<T>(store: IdbStoreName): Promise<T[]> {
      const database = await getDatabase();
      const values = await database.getAll(store);
      return values as T[];
    },

    async clear(store: IdbStoreName): Promise<void> {
      const database = await getDatabase();
      await database.clear(store);
    },
  };
}
