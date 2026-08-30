import { virtualCookieSchema } from '../domain/schemas.ts';
import { asCookieId, asSessionId, type SessionId } from '../domain/ids.ts';
import type { VirtualCookie } from '../domain/virtual-cookie.ts';
import { storageCorrupted } from '../errors/index.ts';
import type { IndexedDbPort } from './ports/indexed-db.ts';
import { IDB_STORES } from './keys.ts';

function toVirtualCookie(raw: unknown): VirtualCookie {
  const parsed = virtualCookieSchema.safeParse(raw);
  if (!parsed.success) {
    throw storageCorrupted('Stored virtual cookie failed validation.');
  }
  const data = parsed.data;
  return {
    id: asCookieId(data.id),
    sessionId: asSessionId(data.sessionId),
    name: data.name,
    value: data.value,
    domain: data.domain,
    path: data.path,
    hostOnly: data.hostOnly,
    secure: data.secure,
    httpOnly: data.httpOnly,
    sameSite: data.sameSite,
    sessionOnly: data.sessionOnly,
    creationTime: data.creationTime,
    lastUpdatedTime: data.lastUpdatedTime,
    source: data.source,
    ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
    ...(data.partitionKey !== undefined ? { partitionKey: data.partitionKey } : {}),
  };
}

export async function listCookies(idb: IndexedDbPort): Promise<readonly VirtualCookie[]> {
  const rows = await idb.getAll<unknown>(IDB_STORES.cookies);
  return rows.map((row) => toVirtualCookie(row));
}

export async function listCookiesForSession(
  idb: IndexedDbPort,
  sessionId: SessionId,
): Promise<readonly VirtualCookie[]> {
  const all = await listCookies(idb);
  return all.filter((cookie) => cookie.sessionId === sessionId);
}

export async function putCookie(
  idb: IndexedDbPort,
  cookie: VirtualCookie,
): Promise<void> {
  await idb.put(IDB_STORES.cookies, cookie);
}

export async function deleteCookie(idb: IndexedDbPort, cookieId: string): Promise<void> {
  await idb.delete(IDB_STORES.cookies, cookieId);
}

export async function replaceSessionCookies(
  idb: IndexedDbPort,
  sessionId: SessionId,
  cookies: readonly VirtualCookie[],
): Promise<void> {
  const existing = await listCookiesForSession(idb, sessionId);
  for (const cookie of existing) {
    await idb.delete(IDB_STORES.cookies, cookie.id);
  }
  for (const cookie of cookies) {
    await idb.put(IDB_STORES.cookies, cookie);
  }
}
