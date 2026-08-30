import { describe, expect, it } from 'vitest';
import { asSessionId } from '../../../modules/domain/ids.ts';
import {
  collectSetCookieHeaders,
  createCookieJar,
  ingestSetCookieLines,
} from '../../../modules/cookies/index.ts';

describe('collectSetCookieHeaders', () => {
  it('collects Set-Cookie values case-insensitively', () => {
    expect(
      collectSetCookieHeaders([
        { name: 'Content-Type', value: 'text/html' },
        { name: 'Set-Cookie', value: 'a=1; Path=/' },
        { name: 'set-cookie', value: 'b=2; Path=/' },
      ]),
    ).toEqual(['a=1; Path=/', 'b=2; Path=/']);
  });
});

describe('ingestSetCookieLines', () => {
  it('adds http cookies into an existing jar without dropping others', () => {
    const sessionId = asSessionId('ses_a');
    const jar = ingestSetCookieLines(createCookieJar(), ['first=one; Path=/'], {
      sessionId,
      requestUrl: new URL('https://example.com/login'),
      now: 1_000,
      source: 'http',
    });
    const next = ingestSetCookieLines(jar, ['second=two; Path=/'], {
      sessionId,
      requestUrl: new URL('https://example.com/login'),
      now: 1_000,
      source: 'http',
    });
    const names = [...next.values()].map((cookie) => cookie.name).sort();
    expect(names).toEqual(['first', 'second']);
  });
});
