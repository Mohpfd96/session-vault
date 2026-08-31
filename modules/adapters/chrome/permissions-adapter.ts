import { browser } from 'wxt/browser';
import { hostPatternsForOrigin } from '../../domains/match-patterns.ts';

const ALL_URLS = '*://*/*' as const;
const UNLIMITED_STORAGE = 'unlimitedStorage' as const;

async function hasBroadHostAccess(): Promise<boolean> {
  return browser.permissions.contains({ origins: [ALL_URLS] });
}

async function hasUnlimitedStorage(): Promise<boolean> {
  return browser.permissions.contains({ permissions: [UNLIMITED_STORAGE] });
}

export async function containsOriginPermission(origin: string): Promise<boolean> {
  if (await hasBroadHostAccess()) {
    return true;
  }
  const origins = [...hostPatternsForOrigin(origin)];
  if (origins.length === 0) {
    return false;
  }
  return browser.permissions.contains({ origins });
}

export async function requestOriginPermission(origin: string): Promise<boolean> {
  const origins = [...hostPatternsForOrigin(origin)];
  if (origins.length === 0) {
    return false;
  }

  const hasOrigins = await containsOriginPermission(origin);
  const hasStorage = await hasUnlimitedStorage();
  if (hasOrigins && hasStorage) {
    return true;
  }

  try {
    const granted = await browser.permissions.request({
      ...(hasOrigins ? {} : { origins }),
      ...(hasStorage ? {} : { permissions: [UNLIMITED_STORAGE] }),
    });
    return hasOrigins || granted;
  } catch {
    return hasOrigins;
  }
}
