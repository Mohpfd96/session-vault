import type { IdbKey, IdbStoreName, IndexedDbPort } from '../ports/indexed-db.ts';

type StoreData = Map<string, unknown>;

export function createMemoryIndexedDbPort(
  initial: Partial<Record<IdbStoreName, StoreData>> = {},
): IndexedDbPort {
  const stores = new Map<IdbStoreName, StoreData>();

  for (const [storeName, entries] of Object.entries(initial) as Array<
    [IdbStoreName, StoreData]
  >) {
    stores.set(storeName, new Map(entries));
  }

  function getStore(store: IdbStoreName): StoreData {
    let existing = stores.get(store);
    if (existing === undefined) {
      existing = new Map();
      stores.set(store, existing);
    }
    return existing;
  }

  function serializeKey(key: IdbKey): string {
    if (Array.isArray(key)) {
      return JSON.stringify(key);
    }
    return String(key);
  }

  return {
    async get<T>(store: IdbStoreName, key: IdbKey): Promise<T | undefined> {
      const value = getStore(store).get(serializeKey(key));
      if (value === undefined) {
        return undefined;
      }
      return structuredClone(value) as T;
    },

    async put<T>(store: IdbStoreName, value: T, key?: IdbKey): Promise<IdbKey> {
      const resolvedKey = key ?? crypto.randomUUID();
      getStore(store).set(serializeKey(resolvedKey), structuredClone(value));
      return resolvedKey;
    },

    async delete(store: IdbStoreName, key: IdbKey): Promise<void> {
      getStore(store).delete(serializeKey(key));
    },

    async getAll<T>(store: IdbStoreName): Promise<T[]> {
      return [...getStore(store).values()].map((value) => structuredClone(value) as T);
    },

    async clear(store: IdbStoreName): Promise<void> {
      getStore(store).clear();
    },
  };
}
