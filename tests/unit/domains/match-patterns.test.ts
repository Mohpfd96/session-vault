import { describe, expect, it } from 'vitest';
import { asDomainGroupId } from '../../../modules/domain/ids.ts';
import type { DomainGroup } from '../../../modules/domain/domain-group.ts';
import {
  hostPatternsForOrigin,
  matchPatternsForEntry,
  matchPatternsForGroups,
} from '../../../modules/domains/match-patterns.ts';

describe('matchPatternsForEntry', () => {
  it('uses a host-only pattern for IP addresses', () => {
    expect(
      matchPatternsForEntry({
        type: 'registrable-domain',
        domain: '192.168.1.1',
        includeSubdomains: true,
      }),
    ).toEqual(['*://192.168.1.1/*']);
  });

  it('does not emit a subdomain wildcard for exact IP hosts', () => {
    expect(matchPatternsForEntry({ type: 'exact-host', host: '192.168.1.1' })).toEqual([
      '*://192.168.1.1/*',
    ]);
  });

  it('brackets IPv6 hosts so Chrome match patterns stay valid', () => {
    expect(matchPatternsForEntry({ type: 'exact-host', host: '::1' })).toEqual([
      '*://[::1]/*',
    ]);
  });

  it('keeps subdomain wildcards for normal domains', () => {
    expect(
      matchPatternsForEntry({
        type: 'registrable-domain',
        domain: 'example.com',
        includeSubdomains: true,
      }),
    ).toEqual(['*://example.com/*', '*://*.example.com/*']);
  });
});

describe('matchPatternsForGroups', () => {
  it('does not register invalid IP subdomain patterns that would fail all scripts', () => {
    const group: DomainGroup = {
      id: asDomainGroupId('dg_router'),
      name: '192.168.1.1',
      domains: [
        {
          type: 'registrable-domain',
          domain: '192.168.1.1',
          includeSubdomains: true,
        },
      ],
      includeSubdomains: true,
      exclusions: [],
      mode: 'managed',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    expect(matchPatternsForGroups([group])).toEqual(['*://192.168.1.1/*']);
  });
});

describe('hostPatternsForOrigin', () => {
  it('requests the registrable domain and subdomains so auth hosts are covered', () => {
    expect(hostPatternsForOrigin('https://mail.google.com')).toEqual([
      '*://google.com/*',
      '*://*.google.com/*',
    ]);
  });

  it('uses a host-only pattern for IP origins', () => {
    expect(hostPatternsForOrigin('http://127.0.0.1:4173')).toEqual(['*://127.0.0.1/*']);
  });

  it('ignores non-http origins', () => {
    expect(hostPatternsForOrigin('chrome://extensions')).toEqual([]);
  });
});
