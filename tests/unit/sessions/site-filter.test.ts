import { asDomainGroupId, asSessionId } from '../../../modules/domain/ids.ts';
import type { DomainGroup } from '../../../modules/domain/domain-group.ts';
import type { SessionProfile } from '../../../modules/domain/session-profile.ts';
import { DEFAULT_SESSION_SETTINGS } from '../../../modules/domain/session-profile.ts';
import {
  filterSessionsForSite,
  groupSessionsByDomain,
  homeUrlForDomainGroup,
} from '../../../modules/sessions/site-filter.ts';
import { describe, expect, it } from 'vitest';

function group(id: string, domain: string): DomainGroup {
  return {
    id: asDomainGroupId(id),
    name: domain,
    domains: [{ type: 'registrable-domain', domain, includeSubdomains: true }],
    includeSubdomains: true,
    exclusions: [],
    mode: 'managed',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function session(
  id: string,
  name: string,
  domainGroupIds: readonly string[],
): SessionProfile {
  return {
    id: asSessionId(id),
    name,
    color: '#5B8DEF',
    icon: '🔵',
    kind: 'persistent',
    state: 'ready',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastUsedAt: '2026-01-01T00:00:00.000Z',
    pinned: false,
    archived: false,
    locked: false,
    tags: [],
    notes: '',
    strictness: 'compatibility',
    domainGroupIds: domainGroupIds.map(asDomainGroupId),
    settings: { ...DEFAULT_SESSION_SETTINGS },
  };
}

describe('filterSessionsForSite', () => {
  const google = group('dg_google', 'google.com');
  const github = group('dg_github', 'github.com');
  const work = session('ses_work', 'Work', ['dg_google']);
  const personal = session('ses_personal', 'Personal', ['dg_google']);
  const code = session('ses_code', 'Code', ['dg_github']);
  const orphan = session('ses_orphan', 'Orphan', []);

  it('returns only sessions for the current registrable site', () => {
    const result = filterSessionsForSite(
      [work, personal, code, orphan],
      [google, github],
      'www.google.com',
      'https://www.google.com/',
    );
    expect(result.map((entry) => entry.name)).toEqual(['Work', 'Personal']);
  });

  it('returns an empty list when the site has no sessions', () => {
    const result = filterSessionsForSite(
      [code],
      [google, github],
      'www.google.com',
      'https://www.google.com/',
    );
    expect(result).toEqual([]);
  });

  it('returns an empty list without a host', () => {
    expect(filterSessionsForSite([work], [google], undefined, undefined)).toEqual([]);
  });
});

describe('groupSessionsByDomain', () => {
  it('groups sessions by site and keeps unassigned separate', () => {
    const google = group('dg_google', 'google.com');
    const items = [
      { session: session('ses_work', 'Work', ['dg_google']), tabCount: 1 },
      { session: session('ses_orphan', 'Orphan', []), tabCount: 0 },
    ];
    const grouped = groupSessionsByDomain(items, [google]);
    expect(grouped.sites).toHaveLength(1);
    expect(grouped.sites[0]?.group.name).toBe('google.com');
    expect(grouped.unassigned).toHaveLength(1);
  });
});

describe('homeUrlForDomainGroup', () => {
  it('builds an https home URL from the registrable domain', () => {
    expect(homeUrlForDomainGroup(group('dg_google', 'google.com'))).toBe(
      'https://google.com/',
    );
  });

  it('uses http for IP hosts so local routers open', () => {
    const router: DomainGroup = {
      ...group('dg_router', '192.168.1.1'),
      domains: [{ type: 'exact-host', host: '192.168.1.1' }],
    };
    expect(homeUrlForDomainGroup(router)).toBe('http://192.168.1.1/');
  });
});
