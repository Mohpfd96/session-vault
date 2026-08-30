import { describe, expect, it } from 'vitest';
import { asTabId } from '../../../modules/domain/ids.ts';
import { asCookieId, asSessionId } from '../../../modules/domain/ids.ts';
import type { VirtualCookie } from '../../../modules/domain/virtual-cookie.ts';
import {
  compileSessionRules,
  compileTabRules,
  DNR_PRIORITIES,
  createSequentialAllocator,
  evaluateRuleBudget,
  isFailClosedOnlyRules,
  projectRuleBudget,
  usesNativeCookieFallback,
} from '../../../modules/dnr/index.ts';

const sessionId = asSessionId('sess_test');

function virtualCookie(path: string): VirtualCookie {
  return {
    id: asCookieId('cookie_test'),
    sessionId,
    name: 'token',
    value: 'alice-secret',
    domain: 'example.com',
    path,
    hostOnly: true,
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    sessionOnly: true,
    creationTime: 1,
    lastUpdatedTime: 1,
    source: 'http',
  };
}

describe('DNR compiler', () => {
  it('emits root SET and Set-Cookie strip for Path=/ cookies', () => {
    const allocator = createSequentialAllocator(100);
    const compiled = compileTabRules(
      {
        tabId: asTabId(1),
        host: 'example.com',
        cookies: [virtualCookie('/')],
        mode: 'healthy',
        now: 1_000,
      },
      allocator,
    );

    expect(compiled.rules).toHaveLength(3);
    const priorities = compiled.rules.map((rule) => rule.priority).sort((a, b) => b - a);
    expect(priorities).toEqual([
      DNR_PRIORITIES.VIRTUAL_COOKIE_ROOT,
      DNR_PRIORITIES.VIRTUAL_COOKIE_SITE,
      DNR_PRIORITIES.NATIVE_SET_COOKIE_STRIP,
    ]);
    expect(compiled.rules.every((rule) => rule.condition.tabIds?.includes(1))).toBe(true);
    const strip = compiled.rules.find(
      (rule) => rule.priority === DNR_PRIORITIES.NATIVE_SET_COOKIE_STRIP,
    );
    expect(strip?.condition.requestDomains).toBeUndefined();
    const siteRule = compiled.rules.find(
      (rule) => rule.priority === DNR_PRIORITIES.VIRTUAL_COOKIE_SITE,
    );
    expect(siteRule?.condition.urlFilter).toBe('||example.com^');
  });

  it('adds path-specific SET rules with full Cookie headers', () => {
    const allocator = createSequentialAllocator(1);
    const compiled = compileTabRules(
      {
        tabId: asTabId(2),
        host: 'example.com',
        cookies: [virtualCookie('/'), virtualCookie('/dashboard')],
        mode: 'healthy',
        now: 1_000,
      },
      allocator,
    );

    const setRules = compiled.rules.filter(
      (rule) =>
        rule.action.type === 'modifyHeaders' &&
        rule.action.requestHeaders?.some((header) => header.operation === 'set'),
    );
    expect(setRules.length).toBeGreaterThanOrEqual(2);
    expect(
      setRules.some((rule) => rule.priority === DNR_PRIORITIES.VIRTUAL_COOKIE_PATH),
    ).toBe(true);
  });

  it('uses fail-closed strip only for degraded tabs', () => {
    const allocator = createSequentialAllocator(1);
    const compiled = compileTabRules(
      {
        tabId: asTabId(3),
        host: 'example.com',
        cookies: [virtualCookie('/')],
        mode: 'degraded',
        now: 1_000,
      },
      allocator,
    );

    expect(compiled.rules).toHaveLength(1);
    expect(compiled.rules[0]?.priority).toBe(DNR_PRIORITIES.FAIL_CLOSED_STRIP);
    expect(isFailClosedOnlyRules(compiled.rules)).toBe(true);
    expect(usesNativeCookieFallback(compiled.rules)).toBe(false);
  });

  it('uses deterministic rule ids from allocator', () => {
    const allocator = createSequentialAllocator(42);
    const first = compileTabRules(
      {
        tabId: asTabId(4),
        host: 'example.com',
        cookies: [virtualCookie('/')],
        mode: 'healthy',
        now: 1_000,
      },
      allocator,
    );
    expect(first.rules.map((rule) => rule.id)).toEqual([42, 43, 44]);
  });

  it('always SET Cookie even when the jar is empty so native cookies cannot leak', () => {
    const allocator = createSequentialAllocator(1);
    const compiled = compileTabRules(
      {
        tabId: asTabId(9),
        host: 'example.com',
        cookies: [],
        mode: 'healthy',
        now: 1_000,
      },
      allocator,
    );

    const setRules = compiled.rules.filter(
      (rule) =>
        rule.action.type === 'modifyHeaders' &&
        rule.action.requestHeaders?.some((header) => header.operation === 'set'),
    );
    expect(setRules).toHaveLength(2);
    expect(
      setRules.every((rule) =>
        rule.action.type === 'modifyHeaders'
          ? rule.action.requestHeaders?.[0]?.value === ''
          : false,
      ),
    ).toBe(true);
  });

  it('matches IP hosts with urlFilter because Chrome rejects IP requestDomains', () => {
    const allocator = createSequentialAllocator(1);
    const compiled = compileTabRules(
      {
        tabId: asTabId(10),
        host: '192.168.1.1',
        cookies: [],
        mode: 'healthy',
        now: 1_000,
      },
      allocator,
    );

    expect(
      compiled.rules.some((rule) => rule.priority === DNR_PRIORITIES.VIRTUAL_COOKIE_SITE),
    ).toBe(false);
    expect(compiled.rules).toHaveLength(2);

    const setRule = compiled.rules.find(
      (rule) => rule.priority === DNR_PRIORITIES.VIRTUAL_COOKIE_ROOT,
    );
    expect(setRule?.condition.requestDomains).toBeUndefined();
    expect(setRule?.condition.urlFilter).toBe('||192.168.1.1^');
  });
});

describe('RuleBudgetManager', () => {
  it('marks compilation degraded when over 5000 rules', () => {
    const tabs = Array.from({ length: 2_501 }, (_, index) => ({
      tabId: index + 1,
      host: 'example.com',
      cookies: [virtualCookie('/'), virtualCookie('/dashboard')],
      mode: 'healthy' as const,
      now: 1_000,
    }));

    const projection = projectRuleBudget(
      tabs.map((tab) => ({
        tabId: tab.tabId,
        cookiePaths: tab.cookies.map((cookie) => cookie.path),
        healthy: true,
      })),
    );
    expect(projection.totalRules).toBeGreaterThan(5_000);
    expect(evaluateRuleBudget(projection).ok).toBe(false);

    const result = compileSessionRules({
      tabs: tabs.map((tab) => ({
        tabId: asTabId(tab.tabId),
        host: tab.host,
        cookies: tab.cookies,
        mode: tab.mode,
        now: tab.now,
      })),
      allocator: createSequentialAllocator(1),
    });

    expect(result.budget.ok).toBe(false);
    expect(result.tabs.every((tab) => tab.mode === 'degraded')).toBe(true);
    expect(isFailClosedOnlyRules(result.rules)).toBe(true);
    expect(usesNativeCookieFallback(result.rules)).toBe(false);
  });
});
