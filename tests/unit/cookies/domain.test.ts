import { describe, expect, it } from 'vitest';
import {
  domainMatches,
  isPublicSuffix,
  validateSetCookieDomain,
} from '../../../modules/cookies/domain.ts';
import { parseSetCookie } from '../../../modules/cookies/parse-set-cookie.ts';

describe('cookie domain', () => {
  it('creates host-only cookies when Domain attribute is absent', () => {
    const url = new URL('https://app.example.com/');
    const parsed = parseSetCookie('a=1', url, 1_000);
    expect(parsed?.kind).toBe('set');
    if (parsed?.kind === 'set') {
      expect(parsed.hostOnly).toBe(true);
      expect(parsed.domain).toBe('app.example.com');
    }
  });

  it('accepts Domain suffix of request host', () => {
    const url = new URL('https://app.example.com/');
    const parsed = parseSetCookie('a=1; Domain=example.com', url, 1_000);
    expect(parsed?.kind).toBe('set');
    if (parsed?.kind === 'set') {
      expect(parsed.hostOnly).toBe(false);
      expect(parsed.domain).toBe('example.com');
    }
  });

  it('rejects public suffix domains', () => {
    expect(isPublicSuffix('co.uk')).toBe(true);
    const url = new URL('https://shop.example.co.uk/');
    const parsed = parseSetCookie('a=1; Domain=co.uk', url, 1_000);
    expect(parsed).toBeNull();
    expect(validateSetCookieDomain('co.uk', url.hostname)).toBeNull();
  });

  it('matches host-only and domain cookies', () => {
    expect(domainMatches('app.example.com', true, 'app.example.com')).toBe(true);
    expect(domainMatches('app.example.com', true, 'other.example.com')).toBe(false);
    expect(domainMatches('example.com', false, 'app.example.com')).toBe(true);
    expect(domainMatches('example.com', false, 'notexample.com')).toBe(false);
  });
});
