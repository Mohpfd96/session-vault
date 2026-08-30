import { describe, expect, it } from 'vitest';
import { asSessionId } from '../../../modules/domain/ids.ts';
import { mapNativeCookie } from '../../../modules/cookies/native-import.ts';

describe('mapNativeCookie', () => {
  it('maps Chrome cookie fields without leaking into public suffixes incorrectly', () => {
    const sessionId = asSessionId('ses_test');
    const cookie = mapNativeCookie(
      {
        name: 'user_session',
        value: 'alice-secret',
        domain: '.example.com',
        path: '/dashboard',
        hostOnly: false,
        httpOnly: true,
        secure: true,
        session: false,
        expirationDate: 1_700_000_000,
        sameSite: 'lax',
      },
      sessionId,
      1_000,
    );

    expect(cookie.domain).toBe('example.com');
    expect(cookie.hostOnly).toBe(false);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe('lax');
    expect(cookie.expiresAt).toBe(1_700_000_000_000);
    expect(cookie.sessionId).toBe(sessionId);
    expect(cookie.source).toBe('migration');
  });
});
