import { asCookieId, asSessionId, createId, type SessionId } from '../domain/ids.ts';
import type { CookieSameSite } from '../domain/enums.ts';
import type { VirtualCookie } from '../domain/virtual-cookie.ts';

export type NativeCookieInput = {
  readonly name: string;
  readonly value: string;
  readonly domain: string;
  readonly path: string;
  readonly hostOnly?: boolean;
  readonly httpOnly?: boolean;
  readonly secure?: boolean;
  readonly session?: boolean;
  readonly expirationDate?: number;
  readonly sameSite?: 'unspecified' | 'no_restriction' | 'lax' | 'strict';
  readonly partitionKey?: { readonly topLevelSite?: string };
};

function mapSameSite(sameSite: NativeCookieInput['sameSite']): CookieSameSite {
  switch (sameSite) {
    case 'lax':
      return 'lax';
    case 'strict':
      return 'strict';
    case 'no_restriction':
      return 'none';
    case 'unspecified':
    case undefined:
      return 'unspecified';
    default: {
      const exhaustive: never = sameSite;
      return exhaustive;
    }
  }
}

export function mapNativeCookie(
  cookie: NativeCookieInput,
  sessionId: SessionId,
  now: number,
): VirtualCookie {
  const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
  const sessionOnly = cookie.session === true || cookie.expirationDate === undefined;
  const mapped: VirtualCookie = {
    id: asCookieId(createId('cookie')),
    sessionId: asSessionId(sessionId),
    name: cookie.name,
    value: cookie.value,
    domain,
    path: cookie.path.length > 0 ? cookie.path : '/',
    hostOnly: cookie.hostOnly === true,
    secure: cookie.secure === true,
    httpOnly: cookie.httpOnly === true,
    sameSite: mapSameSite(cookie.sameSite),
    sessionOnly,
    creationTime: now,
    lastUpdatedTime: now,
    source: 'migration',
    ...(cookie.expirationDate !== undefined
      ? { expiresAt: Math.trunc(cookie.expirationDate * 1000) }
      : {}),
    ...(cookie.partitionKey?.topLevelSite !== undefined
      ? { partitionKey: cookie.partitionKey.topLevelSite }
      : {}),
  };
  return mapped;
}
