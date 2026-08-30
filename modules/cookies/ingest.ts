import type { CookieSource } from '../domain/enums.ts';
import type { SessionId } from '../domain/ids.ts';
import { applyParsedSetCookie, type CookieJar } from './jar.ts';
import { parseSetCookie } from './parse-set-cookie.ts';

export type HttpHeader = {
  readonly name?: string | undefined;
  readonly value?: string | undefined;
};

export function collectSetCookieHeaders(
  headers: readonly HttpHeader[] | undefined,
): readonly string[] {
  if (headers === undefined) {
    return [];
  }
  const lines: string[] = [];
  for (const header of headers) {
    if (header.name === undefined || header.value === undefined) {
      continue;
    }
    if (header.name.toLowerCase() === 'set-cookie') {
      lines.push(header.value);
    }
  }
  return lines;
}

export function ingestSetCookieLines(
  jar: CookieJar,
  lines: readonly string[],
  input: {
    readonly sessionId: SessionId;
    readonly requestUrl: URL;
    readonly now: number;
    readonly source: CookieSource;
  },
): CookieJar {
  let next = jar;
  for (const line of lines) {
    const parsed = parseSetCookie(line, input.requestUrl, input.now);
    if (parsed === null) {
      continue;
    }
    next = applyParsedSetCookie(next, parsed, {
      sessionId: input.sessionId,
      source: input.source,
      now: input.now,
    });
  }
  return next;
}
