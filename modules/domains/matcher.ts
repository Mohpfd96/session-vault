import { getDomain, parse } from 'tldts';
import type { DomainEntry } from '../domain/enums.ts';
import type { DomainGroup } from '../domain/domain-group.ts';
import { asDomainGroupId } from '../domain/ids.ts';

export function normalizeHost(host: string): string {
  return host.trim().toLowerCase();
}

export function registrableDomain(host: string): string {
  const normalized = normalizeHost(host);
  return getDomain(normalized) ?? normalized;
}

export function hostFromUrl(url: string): string | undefined {
  try {
    const host = normalizeHost(new URL(url).hostname);
    return host.length === 0 ? undefined : host;
  } catch {
    return undefined;
  }
}

function matchExactHost(
  host: string,
  entry: DomainEntry & { type: 'exact-host' },
): boolean {
  return host === normalizeHost(entry.host);
}

function matchRegistrableDomain(
  host: string,
  entry: DomainEntry & { type: 'registrable-domain' },
): boolean {
  const domain = normalizeHost(entry.domain);
  if (entry.includeSubdomains) {
    return host === domain || host.endsWith(`.${domain}`);
  }
  return registrableDomain(host) === domain && host === domain;
}

function matchUrlPattern(
  host: string,
  href: string,
  entry: DomainEntry & { type: 'url-pattern' },
): boolean {
  const pattern = entry.pattern;
  if (pattern.includes('*')) {
    const regexSource = `^${pattern.replaceAll('.', '\\.').replaceAll('*', '.*')}$`;
    const regex = new RegExp(regexSource, 'u');
    return regex.test(href) || regex.test(host);
  }

  try {
    const url = new URL(pattern.includes('://') ? pattern : `https://${pattern}`);
    return normalizeHost(url.hostname) === host;
  } catch {
    return false;
  }
}

export function matchesDomainEntry(
  host: string,
  href: string,
  entry: DomainEntry,
): boolean {
  const normalized = normalizeHost(host);
  switch (entry.type) {
    case 'exact-host':
      return matchExactHost(normalized, entry);
    case 'registrable-domain':
      return matchRegistrableDomain(normalized, entry);
    case 'url-pattern':
      return matchUrlPattern(normalized, href, entry);
    default: {
      const exhaustive: never = entry;
      return exhaustive;
    }
  }
}

export function isExcluded(
  host: string,
  href: string,
  exclusions: readonly DomainEntry[],
): boolean {
  return exclusions.some((entry) => matchesDomainEntry(host, href, entry));
}

export function matchesDomainGroup(
  host: string,
  href: string,
  group: DomainGroup,
): boolean {
  if (isExcluded(host, href, group.exclusions)) {
    return false;
  }

  for (const entry of group.domains) {
    if (matchesDomainEntry(host, href, entry)) {
      return true;
    }
  }

  if (group.includeSubdomains) {
    const groupHosts = group.domains
      .filter(
        (entry): entry is DomainEntry & { type: 'registrable-domain' } =>
          entry.type === 'registrable-domain',
      )
      .map((entry) => normalizeHost(entry.domain));

    for (const domain of groupHosts) {
      const normalized = normalizeHost(host);
      if (normalized === domain || normalized.endsWith(`.${domain}`)) {
        return true;
      }
    }
  }

  return false;
}

export function findManagedDomainGroup(
  host: string,
  href: string,
  groups: readonly DomainGroup[],
): DomainGroup | undefined {
  const normalized = normalizeHost(host);
  if (normalized.length === 0) {
    return undefined;
  }

  for (const group of groups) {
    if (group.mode !== 'managed') {
      continue;
    }
    if (matchesDomainGroup(normalized, href, group)) {
      return group;
    }
  }
  return undefined;
}

export function parseHostMetadata(host: string): {
  readonly hostname: string;
  readonly domain: string | null;
  readonly isIp: boolean;
} {
  const parsed = parse(host);
  return {
    hostname: normalizeHost(host),
    domain: parsed.domain,
    isIp: parsed.isIp ?? false,
  };
}

export function toDomainGroup(raw: {
  readonly id: string;
  readonly name: string;
  readonly domains: readonly DomainEntry[];
  readonly includeSubdomains: boolean;
  readonly exclusions: readonly DomainEntry[];
  readonly mode: 'managed' | 'unmanaged';
  readonly createdAt: string;
  readonly updatedAt: string;
}): DomainGroup {
  return {
    ...raw,
    id: asDomainGroupId(raw.id),
  };
}
