import { describe, expect, it } from 'vitest';
import {
  defaultCookiePath,
  normalizeCookiePath,
  pathMatches,
} from '../../../modules/cookies/path.ts';

describe('cookie path', () => {
  it('defaults to / for root requests', () => {
    expect(defaultCookiePath(new URL('https://example.com/'))).toBe('/');
    expect(defaultCookiePath(new URL('https://example.com'))).toBe('/');
  });

  it('defaults to parent directory for nested paths', () => {
    expect(defaultCookiePath(new URL('https://example.com/app/page'))).toBe('/app');
    expect(defaultCookiePath(new URL('https://example.com/app/'))).toBe('/app');
  });

  it('normalizes explicit paths', () => {
    const url = new URL('https://example.com/app/page');
    expect(normalizeCookiePath('/dashboard/', url)).toBe('/dashboard');
    expect(normalizeCookiePath('relative', url)).toBe('/');
  });

  it('matches request paths per RFC-ish rules', () => {
    expect(pathMatches('/', '/anything')).toBe(true);
    expect(pathMatches('/dashboard', '/dashboard')).toBe(true);
    expect(pathMatches('/dashboard', '/dashboard/settings')).toBe(true);
    expect(pathMatches('/dashboard', '/dash')).toBe(false);
    expect(pathMatches('/dashboard', '/dashboardextra')).toBe(false);
  });
});
