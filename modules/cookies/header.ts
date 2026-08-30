import type { VirtualCookie } from '../domain/virtual-cookie.ts';
import type { CookieIdentity } from '../domain/virtual-cookie.ts';
import { cookiesForRequest } from './matcher.ts';

function compareCookiesForHeader(a: VirtualCookie, b: VirtualCookie): number {
  const pathLengthDiff = b.path.length - a.path.length;
  if (pathLengthDiff !== 0) {
    return pathLengthDiff;
  }
  return a.name.localeCompare(b.name);
}

function encodeCookiePair(cookie: VirtualCookie): string {
  return `${cookie.name}=${cookie.value}`;
}

export function cookieHeader(
  cookies: readonly VirtualCookie[],
  requestUrl: URL,
  now: number,
): string | null {
  const matching = cookiesForRequest(cookies, requestUrl, now, { includeHttpOnly: true });
  if (matching.length === 0) {
    return null;
  }

  const sorted = [...matching].sort(compareCookiesForHeader);
  return sorted.map(encodeCookiePair).join('; ');
}

export function documentCookieString(
  cookies: readonly VirtualCookie[],
  requestUrl: URL,
  now: number,
): string {
  const matching = cookiesForRequest(cookies, requestUrl, now, {
    includeHttpOnly: false,
  });
  if (matching.length === 0) {
    return '';
  }

  const sorted = [...matching].sort(compareCookiesForHeader);
  return sorted.map(encodeCookiePair).join('; ');
}

export function cookieIdentityKey(identity: CookieIdentity): string {
  const partition = identity.partitionKey ?? '';
  return `${identity.sessionId}\0${identity.name}\0${identity.domain}\0${identity.path}\0${partition}`;
}
