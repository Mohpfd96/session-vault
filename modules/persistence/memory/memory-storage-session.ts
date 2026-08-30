import type { ChromeStorageSessionPort } from '../ports/chrome-storage-session.ts';

export function createMemoryStorageSessionPort(
  initial: Record<string, unknown> = {},
): ChromeStorageSessionPort {
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
  };
}
