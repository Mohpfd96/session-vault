import type { ChromeStorageLocalPort } from '../ports/chrome-storage-local.ts';

export function createMemoryStorageLocalPort(
  initial: Record<string, unknown> = {},
): ChromeStorageLocalPort {
  const data = new Map<string, unknown>(Object.entries(initial));

  return {
    async get<T>(key: string): Promise<T | undefined> {
      const value = data.get(key);
      if (value === undefined) {
        return undefined;
      }
      return structuredClone(value) as T;
    },

    async set<T>(key: string, value: T): Promise<void> {
      data.set(key, structuredClone(value));
    },

    async remove(key: string): Promise<void> {
      data.delete(key);
    },

    async getMany<T extends Record<string, unknown>>(
      keys: readonly string[],
    ): Promise<Partial<T>> {
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        const value = data.get(key);
        if (value !== undefined) {
          result[key] = structuredClone(value);
        }
      }
      return result as Partial<T>;
    },
  };
}
