import { browser } from 'wxt/browser';
import { hostPatternsForOrigin } from '../../domains/match-patterns.ts';

const ALL_URLS = '*://*/*' as const;

export async function containsOriginPermission(origin: string): Promise<boolean> {
  const origins = [...hostPatternsForOrigin(origin)];
  if (origins.length === 0) {
    return false;
  }
  if (await browser.permissions.contains({ origins: [ALL_URLS] })) {
    return true;
  }
  for (const pattern of origins) {
    if (await browser.permissions.contains({ origins: [pattern] })) {
      return true;
    }
  }
  return false;
}

/**
 * Must be the first awaited extension API in a click handler. Awaiting
 * permissions.contains first drops Chrome's user gesture, so the prompt
 * never appears and request() resolves false.
 */
export async function requestOriginPermission(origin: string): Promise<boolean> {
  const origins = [...hostPatternsForOrigin(origin)];
  if (origins.length === 0) {
    return false;
  }
  try {
    return await browser.permissions.request({ origins });
  } catch {
    return false;
  }
}
