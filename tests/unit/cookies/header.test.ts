import { describe, expect, it } from 'vitest';
import { asCookieId, asSessionId } from '../../../modules/domain/ids.ts';
import type { VirtualCookie } from '../../../modules/domain/virtual-cookie.ts';
import { cookieHeader, documentCookieString } from '../../../modules/cookies/header.ts';

const sessionId = asSessionId('sess_test');

function cookie(
  overrides: Partial<VirtualCookie> & Pick<VirtualCookie, 'name' | 'value'>,
): VirtualCookie {
  return {
    id: asCookieId('cookie_test'),
    sessionId,
    domain: 'example.com',
    path: '/',
    hostOnly: true,
    secure: false,
    httpOnly: false,
    sameSite: 'unspecified',
    sessionOnly: true,
    creationTime: 1,
    lastUpdatedTime: 1,
    source: 'http',
    ...overrides,
  };
}

describe('cookieHeader', () => {
  it('sorts by path length desc then name asc', () => {
    const cookies = [
      cookie({ name: 'b', value: '2', path: '/' }),
      cookie({ name: 'a', value: '1', path: '/dashboard' }),
      cookie({ name: 'c', value: '3', path: '/dashboard' }),
    ];
    const header = cookieHeader(cookies, new URL('https://example.com/dashboard'), 1_000);
    expect(header).toBe('a=1; c=3; b=2');
  });

  it('omits Secure cookies on http requests', () => {
    const cookies = [cookie({ name: 'secure', value: 'x', secure: true })];
    expect(cookieHeader(cookies, new URL('http://example.com/'), 1_000)).toBeNull();
    expect(cookieHeader(cookies, new URL('https://example.com/'), 1_000)).toBe(
      'secure=x',
    );
  });

  it('excludes expired cookies', () => {
    const cookies = [
      cookie({
        name: 'expired',
        value: 'x',
        sessionOnly: false,
        expiresAt: 500,
      }),
    ];
    expect(cookieHeader(cookies, new URL('https://example.com/'), 1_000)).toBeNull();
  });
});

describe('documentCookieString', () => {
  it('excludes HttpOnly cookies', () => {
    const cookies = [
      cookie({ name: 'visible', value: '1' }),
      cookie({ name: 'hidden', value: '2', httpOnly: true }),
    ];
    expect(documentCookieString(cookies, new URL('https://example.com/'), 1_000)).toBe(
      'visible=1',
    );
  });
});
