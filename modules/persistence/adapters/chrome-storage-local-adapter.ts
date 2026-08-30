import { browser } from 'wxt/browser';
import type { ChromeStorageLocalPort } from '../ports/chrome-storage-local.ts';

export function createChromeStorageLocalPort(): ChromeStorageLocalPort {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      const result = await browser.storage.local.get(key);
      const value = result[key];
      if (value === undefined) {
        return undefined;
      }
      return value as T;
    },

    async set<T>(key: string, value: T): Promise<void> {
      await browser.storage.local.set({ [key]: value });
    },

    async remove(key: string): Promise<void> {
      await browser.storage.local.remove(key);
    },

    async getMany<T extends Record<string, unknown>>(
      keys: readonly string[],
    ): Promise<Partial<T>> {
      const result = await browser.storage.local.get([...keys]);
      return result as Partial<T>;
    },
  };
}
