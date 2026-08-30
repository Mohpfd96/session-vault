import { browser } from 'wxt/browser';

const ALL_URLS = '*://*/*' as const;

export function originPatternForSite(origin: string): string {
  return `${origin}/*`;
}

async function hasBroadHostAccess(): Promise<boolean> {
  return browser.permissions.contains({ origins: [ALL_URLS] });
}

export async function containsOriginPermission(origin: string): Promise<boolean> {
  if (await hasBroadHostAccess()) {
    return true;
  }
  return browser.permissions.contains({
    origins: [originPatternForSite(origin)],
  });
}

export async function requestOriginPermission(origin: string): Promise<boolean> {
  if (await containsOriginPermission(origin)) {
    return true;
  }
  return browser.permissions.request({
    origins: [originPatternForSite(origin)],
  });
}
