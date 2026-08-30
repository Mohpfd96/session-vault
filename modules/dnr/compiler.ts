import type { VirtualCookie } from '../domain/virtual-cookie.ts';
import type { TabId } from '../domain/ids.ts';
import { isIpHost, registrableDomain } from '../cookies/domain.ts';
import { cookieHeader } from '../cookies/header.ts';
import { DNR_PRIORITIES } from './priorities.ts';
import {
  evaluateRuleBudget,
  projectRuleBudget,
  type RuleBudgetStatus,
  type TabRuleCostInput,
} from './rule-budget-manager.ts';
import type { DnrRule, ModifyHeaderInfo, RuleIdAllocator } from './types.ts';

export type TabCompilationMode = 'healthy' | 'fail-closed' | 'degraded';

export type TabCompilationInput = {
  readonly tabId: TabId;
  readonly host: string;
  readonly cookies: readonly VirtualCookie[];
  readonly mode: TabCompilationMode;
  readonly now: number;
};

export type CompiledTabRules = {
  readonly tabId: TabId;
  readonly rules: readonly DnrRule[];
  readonly mode: TabCompilationMode;
};

export type CompileSessionRulesInput = {
  readonly tabs: readonly TabCompilationInput[];
  readonly allocator: RuleIdAllocator;
};

export type CompileSessionRulesResult = {
  readonly rules: readonly DnrRule[];
  readonly budget: RuleBudgetStatus;
  readonly tabs: readonly CompiledTabRules[];
};

const DEFAULT_RESOURCE_TYPES = [
  'main_frame',
  'sub_frame',
  'xmlhttprequest',
  'websocket',
  'other',
] as const;

function stripCookieRule(tabId: number, allocator: RuleIdAllocator): DnrRule {
  const requestHeaders: ModifyHeaderInfo[] = [{ header: 'Cookie', operation: 'remove' }];
  return {
    id: allocator.nextId(),
    priority: DNR_PRIORITIES.FAIL_CLOSED_STRIP,
    condition: {
      tabIds: [tabId],
      resourceTypes: [...DEFAULT_RESOURCE_TYPES],
    },
    action: {
      type: 'modifyHeaders',
      requestHeaders,
    },
  };
}

function stripSetCookieRule(tabId: number, allocator: RuleIdAllocator): DnrRule {
  const responseHeaders: ModifyHeaderInfo[] = [
    { header: 'Set-Cookie', operation: 'remove' },
  ];
  return {
    id: allocator.nextId(),
    priority: DNR_PRIORITIES.NATIVE_SET_COOKIE_STRIP,
    condition: {
      tabIds: [tabId],
      resourceTypes: [...DEFAULT_RESOURCE_TYPES],
    },
    action: {
      type: 'modifyHeaders',
      responseHeaders,
    },
  };
}

function dnrHostLiteral(host: string): string {
  return host.includes(':') ? `[${host}]` : host;
}

function cookieMatchCondition(
  tabId: number,
  host: string,
  pathPrefix: string | undefined,
): DnrRule['condition'] {
  const resourceTypes = [...DEFAULT_RESOURCE_TYPES];
  if (isIpHost(host)) {
    const literal = dnrHostLiteral(host);
    const urlFilter =
      pathPrefix === undefined || pathPrefix === '/'
        ? `||${literal}^`
        : `||${literal}${pathPrefix}*`;
    return {
      tabIds: [tabId],
      urlFilter,
      resourceTypes,
    };
  }
  if (pathPrefix === undefined) {
    return {
      tabIds: [tabId],
      requestDomains: [host],
      resourceTypes,
    };
  }
  return {
    tabIds: [tabId],
    urlFilter: `||${host}${pathPrefix}*`,
    resourceTypes,
  };
}

function setCookieRule(
  tabId: number,
  host: string,
  cookieValue: string,
  priority: number,
  pathPrefix: string | undefined,
  allocator: RuleIdAllocator,
): DnrRule {
  const requestHeaders: ModifyHeaderInfo[] = [
    { header: 'Cookie', operation: 'set', value: cookieValue },
  ];

  return {
    id: allocator.nextId(),
    priority,
    condition: cookieMatchCondition(tabId, host, pathPrefix),
    action: {
      type: 'modifyHeaders',
      requestHeaders,
    },
  };
}

function setSiteCookieRule(
  tabId: number,
  siteDomain: string,
  cookieValue: string,
  allocator: RuleIdAllocator,
): DnrRule {
  const requestHeaders: ModifyHeaderInfo[] = [
    { header: 'Cookie', operation: 'set', value: cookieValue },
  ];
  return {
    id: allocator.nextId(),
    priority: DNR_PRIORITIES.VIRTUAL_COOKIE_SITE,
    condition: {
      tabIds: [tabId],
      urlFilter: `||${siteDomain}^`,
      resourceTypes: [...DEFAULT_RESOURCE_TYPES],
    },
    action: {
      type: 'modifyHeaders',
      requestHeaders,
    },
  };
}

function siteDomainForHost(host: string): string | undefined {
  if (isIpHost(host)) {
    return undefined;
  }
  return registrableDomain(host) ?? host;
}

function uniqueCookiePaths(cookies: readonly VirtualCookie[]): string[] {
  const paths = new Set<string>();
  for (const cookie of cookies) {
    paths.add(cookie.path);
  }
  return [...paths].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

function syntheticUrl(host: string, path: string, secure: boolean): URL {
  const protocol = secure ? 'https:' : 'http:';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(`${protocol}//${host}${normalizedPath}`);
}

function headerForPathPrefix(
  cookies: readonly VirtualCookie[],
  host: string,
  pathPrefix: string,
  now: number,
): string | null {
  const secure = cookies.some((cookie) => cookie.secure);
  const url = syntheticUrl(host, pathPrefix === '/' ? '/' : pathPrefix, secure);
  return cookieHeader(cookies, url, now);
}

function compileHealthyTabRules(
  input: TabCompilationInput,
  allocator: RuleIdAllocator,
): DnrRule[] {
  const tabId = input.tabId as number;
  const rules: DnrRule[] = [stripSetCookieRule(tabId, allocator)];

  const paths = uniqueCookiePaths(input.cookies);
  const allRoot = paths.length === 0 || paths.every((path) => path === '/');

  if (allRoot) {
    const header = headerForPathPrefix(input.cookies, input.host, '/', input.now) ?? '';
    rules.push(
      setCookieRule(
        tabId,
        input.host,
        header,
        DNR_PRIORITIES.VIRTUAL_COOKIE_ROOT,
        undefined,
        allocator,
      ),
    );
  } else {
    for (const path of paths) {
      const header =
        headerForPathPrefix(input.cookies, input.host, path, input.now) ?? '';
      const priority =
        path === '/'
          ? DNR_PRIORITIES.VIRTUAL_COOKIE_ROOT
          : DNR_PRIORITIES.VIRTUAL_COOKIE_PATH;
      rules.push(
        setCookieRule(
          tabId,
          input.host,
          header,
          priority,
          path === '/' ? undefined : path,
          allocator,
        ),
      );
    }
  }

  const siteDomain = siteDomainForHost(input.host);
  if (siteDomain !== undefined) {
    const siteHeader =
      headerForPathPrefix(input.cookies, siteDomain, '/', input.now) ?? '';
    rules.push(setSiteCookieRule(tabId, siteDomain, siteHeader, allocator));
  }

  return rules;
}

function compileFailClosedTabRules(
  input: TabCompilationInput,
  allocator: RuleIdAllocator,
): DnrRule[] {
  return [stripCookieRule(input.tabId as number, allocator)];
}

export function compileTabRules(
  input: TabCompilationInput,
  allocator: RuleIdAllocator,
): CompiledTabRules {
  const mode =
    input.mode === 'healthy'
      ? 'healthy'
      : input.mode === 'degraded'
        ? 'degraded'
        : 'fail-closed';

  const rules =
    mode === 'healthy'
      ? compileHealthyTabRules(input, allocator)
      : compileFailClosedTabRules(input, allocator);

  return { tabId: input.tabId, rules, mode };
}

export function compileSessionRules(
  input: CompileSessionRulesInput,
): CompileSessionRulesResult {
  const costInputs: TabRuleCostInput[] = input.tabs.map((tab) => ({
    tabId: tab.tabId as number,
    cookiePaths: uniqueCookiePaths(tab.cookies),
    healthy: tab.mode === 'healthy',
  }));
  const projection = projectRuleBudget(costInputs);
  const budget = evaluateRuleBudget(projection);

  const compiledTabs: CompiledTabRules[] = [];
  const rules: DnrRule[] = [];

  for (const tab of input.tabs) {
    const effectiveMode: TabCompilationMode =
      budget.ok || tab.mode !== 'healthy' ? tab.mode : 'degraded';

    const compiled = compileTabRules({ ...tab, mode: effectiveMode }, input.allocator);
    compiledTabs.push(compiled);
    rules.push(...compiled.rules);
  }

  return {
    rules,
    budget: budget.ok ? budget : { ok: false, projection, reason: 'capacity-exceeded' },
    tabs: compiledTabs,
  };
}
