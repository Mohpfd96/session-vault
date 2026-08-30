import { asCookieId, createId } from '../domain/ids.ts';
import type { SessionId } from '../domain/ids.ts';
import type { CookieSource } from '../domain/enums.ts';
import type { VirtualCookie } from '../domain/virtual-cookie.ts';
import type { CookieIdentity } from '../domain/virtual-cookie.ts';
import { cookieIdentityKey } from './header.ts';
import { parseSetCookie } from './parse-set-cookie.ts';
import type { ParsedSetCookie } from './types.ts';

export type CookieJar = Map<string, VirtualCookie>;

export function createCookieJar(): CookieJar {
  return new Map();
}

export type ApplySetCookieInput = {
  readonly sessionId: SessionId;
  readonly source: CookieSource;
  readonly now: number;
  readonly existingId?: string;
};

export function applyParsedSetCookie(
  jar: CookieJar,
  parsed: ParsedSetCookie,
  input: ApplySetCookieInput,
): CookieJar {
  const identity: CookieIdentity = {
    sessionId: input.sessionId,
    name: parsed.name,
    domain: parsed.domain,
    path: parsed.path,
    ...(parsed.partitionKey !== undefined ? { partitionKey: parsed.partitionKey } : {}),
  };
  const key = cookieIdentityKey(identity);
  const next = new Map(jar);

  if (parsed.kind === 'delete') {
    next.delete(key);
    return next;
  }

  const existing = jar.get(key);
  const cookie: VirtualCookie = {
    id: existing?.id ?? asCookieId(input.existingId ?? createId('cookie')),
    sessionId: input.sessionId,
    name: parsed.name,
    value: parsed.value,
    domain: parsed.domain,
    path: parsed.path,
    hostOnly: parsed.hostOnly,
    secure: parsed.secure,
    httpOnly: parsed.httpOnly,
    sameSite: parsed.sameSite,
    sessionOnly: parsed.sessionOnly,
    creationTime: existing?.creationTime ?? input.now,
    lastUpdatedTime: input.now,
    source: input.source,
    ...(parsed.expiresAt !== undefined ? { expiresAt: parsed.expiresAt } : {}),
    ...(parsed.partitionKey !== undefined ? { partitionKey: parsed.partitionKey } : {}),
  };

  next.set(key, cookie);
  return next;
}

export function upsertCookie(jar: CookieJar, cookie: VirtualCookie): CookieJar {
  const key = cookieIdentityKey({
    sessionId: cookie.sessionId,
    name: cookie.name,
    domain: cookie.domain,
    path: cookie.path,
    ...(cookie.partitionKey !== undefined ? { partitionKey: cookie.partitionKey } : {}),
  });
  const next = new Map(jar);
  next.set(key, cookie);
  return next;
}

export function removeCookie(jar: CookieJar, identity: CookieIdentity): CookieJar {
  const key = cookieIdentityKey(identity);
  if (!jar.has(key)) {
    return jar;
  }
  const next = new Map(jar);
  next.delete(key);
  return next;
}

export function listCookies(jar: CookieJar): VirtualCookie[] {
  return [...jar.values()];
}

export function parseAndApplySetCookie(
  jar: CookieJar,
  header: string,
  requestUrl: URL,
  input: ApplySetCookieInput,
): { jar: CookieJar; parsed: ParsedSetCookie | null } {
  const parsed = parseSetCookie(header, requestUrl, input.now);
  if (parsed === null) {
    return { jar, parsed };
  }
  return { jar: applyParsedSetCookie(jar, parsed, input), parsed };
}
