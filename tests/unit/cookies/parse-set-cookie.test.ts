import { describe, expect, it } from 'vitest';
import { asSessionId } from '../../../modules/domain/ids.ts';
import { parseSetCookie } from '../../../modules/cookies/parse-set-cookie.ts';
import {
  applyParsedSetCookie,
  createCookieJar,
  parseAndApplySetCookie,
} from '../../../modules/cookies/jar.ts';

const sessionId = asSessionId('sess_test');

describe('parseSetCookie', () => {
  it('parses a basic Set-Cookie header', () => {
    const url = new URL('https://example.com/app');
    const parsed = parseSetCookie(
      'session=alice-secret; Path=/; Secure; HttpOnly',
      url,
      1_000,
    );

    expect(parsed).toEqual({
      kind: 'set',
      name: 'session',
      value: 'alice-secret',
      domain: 'example.com',
      path: '/',
      hostOnly: true,
      secure: true,
      httpOnly: true,
      sameSite: 'unspecified',
      sessionOnly: true,
    });
  });

  it('uses Max-Age over Expires', () => {
    const url = new URL('https://example.com/');
    const parsed = parseSetCookie(
      'a=1; Max-Age=3600; Expires=Wed, 01 Jan 1990 00:00:00 GMT',
      url,
      1_000,
    );

    expect(parsed?.kind).toBe('set');
    if (parsed?.kind === 'set') {
      expect(parsed.sessionOnly).toBe(false);
      expect(parsed.expiresAt).toBe(1_000 + 3_600_000);
    }
  });

  it('rejects Secure cookies on http', () => {
    const url = new URL('http://example.com/');
    const parsed = parseSetCookie('secure=1; Secure', url, 1_000);
    expect(parsed).toBeNull();
  });

  it('defaults path to request directory', () => {
    const url = new URL('https://example.com/app/page');
    const parsed = parseSetCookie('a=1', url, 1_000);
    expect(parsed?.kind).toBe('set');
    if (parsed?.kind === 'set') {
      expect(parsed.path).toBe('/app');
    }
  });

  it('parses SameSite attribute', () => {
    const url = new URL('https://example.com/');
    const parsed = parseSetCookie('a=1; SameSite=Lax', url, 1_000);
    expect(parsed?.kind).toBe('set');
    if (parsed?.kind === 'set') {
      expect(parsed.sameSite).toBe('lax');
    }
  });

  it('treats Max-Age=0 as deletion', () => {
    const url = new URL('https://example.com/');
    const parsed = parseSetCookie('a=1; Max-Age=0', url, 1_000);
    expect(parsed).toEqual({
      kind: 'delete',
      name: 'a',
      domain: 'example.com',
      path: '/',
      hostOnly: true,
    });
  });

  it('treats past Expires as deletion', () => {
    const url = new URL('https://example.com/');
    const parsed = parseSetCookie(
      'a=1; Expires=Wed, 01 Jan 1990 00:00:00 GMT',
      url,
      1_700_000_000_000,
    );
    expect(parsed?.kind).toBe('delete');
  });
});

describe('cookie jar overwrite', () => {
  it('overwrites by sessionId+name+domain+path+partition', () => {
    const url = new URL('https://example.com/');
    let jar = createCookieJar();
    const first = parseSetCookie('token=alice-secret; Path=/', url, 1_000);
    expect(first?.kind).toBe('set');
    if (first?.kind !== 'set') {
      return;
    }
    jar = applyParsedSetCookie(jar, first, {
      sessionId,
      source: 'http',
      now: 1_000,
    });

    const second = parseSetCookie('token=bob-secret; Path=/', url, 2_000);
    expect(second?.kind).toBe('set');
    if (second?.kind !== 'set') {
      return;
    }
    jar = applyParsedSetCookie(jar, second, {
      sessionId,
      source: 'http',
      now: 2_000,
    });

    expect([...jar.values()]).toHaveLength(1);
    expect([...jar.values()][0]?.value).toBe('bob-secret');
  });

  it('removes cookies on deletion header', () => {
    const url = new URL('https://example.com/');
    const { jar } = parseAndApplySetCookie(
      createCookieJar(),
      'token=alice-secret; Path=/',
      url,
      { sessionId, source: 'http', now: 1_000 },
    );
    const cleared = parseAndApplySetCookie(jar, 'token=; Max-Age=0; Path=/', url, {
      sessionId,
      source: 'http',
      now: 2_000,
    });
    expect(cleared.jar.size).toBe(0);
  });
});
