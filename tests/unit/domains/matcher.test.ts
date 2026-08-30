import { describe, expect, it } from 'vitest';
import { asDomainGroupId } from '../../../modules/domain/ids.ts';
import type { DomainGroup } from '../../../modules/domain/domain-group.ts';
import {
  findManagedDomainGroup,
  hostFromUrl,
  matchesDomainEntry,
  registrableDomain,
} from '../../../modules/domains/matcher.ts';

const exampleGroup: DomainGroup = {
  id: asDomainGroupId('dg_example'),
  name: 'Example',
  domains: [
    {
      type: 'registrable-domain',
      domain: 'example.com',
      includeSubdomains: true,
    },
  ],
  includeSubdomains: false,
  exclusions: [
    {
      type: 'exact-host',
      host: 'blocked.example.com',
    },
  ],
  mode: 'managed',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const bbcGroup: DomainGroup = {
  id: asDomainGroupId('dg_bbc'),
  name: 'BBC',
  domains: [
    {
      type: 'registrable-domain',
      domain: 'bbc.co.uk',
      includeSubdomains: true,
    },
  ],
  includeSubdomains: false,
  exclusions: [],
  mode: 'managed',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('hostFromUrl', () => {
  it('returns undefined for about:blank instead of an empty host', () => {
    expect(hostFromUrl('about:blank')).toBeUndefined();
  });
});

describe('registrableDomain', () => {
  it('resolves public suffixes for bbc.co.uk', () => {
    expect(registrableDomain('www.bbc.co.uk')).toBe('bbc.co.uk');
    expect(registrableDomain('example.com')).toBe('example.com');
  });
});

describe('matchesDomainEntry', () => {
  it('matches subdomains when includeSubdomains is true', () => {
    expect(
      matchesDomainEntry('app.example.com', 'https://app.example.com/', {
        type: 'registrable-domain',
        domain: 'example.com',
        includeSubdomains: true,
      }),
    ).toBe(true);
  });

  it('does not match unrelated hosts', () => {
    expect(
      matchesDomainEntry('notexample.com', 'https://notexample.com/', {
        type: 'registrable-domain',
        domain: 'example.com',
        includeSubdomains: true,
      }),
    ).toBe(false);
  });
});

describe('findManagedDomainGroup', () => {
  it('matches bbc.co.uk registrable domain', () => {
    expect(
      findManagedDomainGroup('news.bbc.co.uk', 'https://news.bbc.co.uk/', [bbcGroup])?.id,
    ).toBe(bbcGroup.id);
  });

  it('honors exclusions', () => {
    expect(
      findManagedDomainGroup('blocked.example.com', 'https://blocked.example.com/', [
        exampleGroup,
      ]),
    ).toBeUndefined();
  });

  it('returns undefined for unmanaged hosts', () => {
    expect(
      findManagedDomainGroup('google.com', 'https://google.com/', [exampleGroup]),
    ).toBeUndefined();
  });
});
