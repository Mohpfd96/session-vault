import type { VirtualCookie } from '../domain/virtual-cookie.ts';
import { domainMatches } from './domain.ts';
import { pathMatches } from './path.ts';

export function isCookieExpired(cookie: VirtualCookie, now: number): boolean {
  if (cookie.sessionOnly || cookie.expiresAt === undefined) {
    return false;
  }
  return cookie.expiresAt <= now;
}

export function cookieMatchesRequest(
  cookie: VirtualCookie,
  requestUrl: URL,
  now: number,
  options?: { includeHttpOnly?: boolean },
): boolean {
  if (isCookieExpired(cookie, now)) {
    return false;
  }

  if (cookie.secure && requestUrl.protocol !== 'https:') {
    return false;
  }

  if (!domainMatches(cookie.domain, cookie.hostOnly, requestUrl.hostname)) {
    return false;
  }

  if (!pathMatches(cookie.path, requestUrl.pathname)) {
    return false;
  }

  if (options?.includeHttpOnly === false && cookie.httpOnly) {
    return false;
  }

  return true;
}

export function cookiesForRequest(
  cookies: readonly VirtualCookie[],
  requestUrl: URL,
  now: number,
  options?: { includeHttpOnly?: boolean },
): VirtualCookie[] {
  return cookies.filter((cookie) =>
    cookieMatchesRequest(cookie, requestUrl, now, options),
  );
}
