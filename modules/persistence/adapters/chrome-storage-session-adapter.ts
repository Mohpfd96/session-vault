import { browser } from 'wxt/browser';
import type { ChromeStorageSessionPort } from '../ports/chrome-storage-session.ts';

export function createChromeStorageSessionPort(): ChromeStorageSessionPort {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      const result = await browser.storage.session.get(key);
      const value = result[key];
      if (value === undefined) {
        return undefined;
      }
      return value as T;
    },

    async set<T>(key: string, value: T): Promise<void> {
      await browser.storage.session.set({ [key]: value });
    },

    async remove(key: string): Promise<void> {
      await browser.storage.session.remove(key);
    },
  };
}
