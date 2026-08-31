import type { DomainGroup } from '../domain/domain-group.ts';
import type { DomainEntry } from '../domain/enums.ts';
import { isIpHost, registrableDomain } from '../cookies/domain.ts';

export function hostPatternsForOrigin(origin: string): readonly string[] {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return [];
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return [];
  }

  const host = parsed.hostname;
  const hostLit = chromeHostLiteral(host);
  const patterns = new Set<string>([`${parsed.protocol}//${hostLit}/*`]);

  if (isIpHost(host)) {
    return [...patterns];
  }

  const registrable = registrableDomain(host) ?? host;
  patterns.add(`${parsed.protocol}//${registrable}/*`);
  patterns.add(`${parsed.protocol}//*.${registrable}/*`);
  return [...patterns];
}

function chromeHostLiteral(host: string): string {
  if (isIpHost(host) && host.includes(':')) {
    return `[${host}]`;
  }
  return host;
}

export function chromeHostMatchPattern(host: string): string {
  if (isIpHost(host) && host.includes(':')) {
    return `*://[${host}]/*`;
  }
  return `*://${host}/*`;
}

export function matchPatternsForEntry(entry: DomainEntry): readonly string[] {
  switch (entry.type) {
    case 'exact-host':
      return [chromeHostMatchPattern(entry.host)];
    case 'registrable-domain': {
      if (isIpHost(entry.domain) || !entry.includeSubdomains) {
        return [chromeHostMatchPattern(entry.domain)];
      }
      return [chromeHostMatchPattern(entry.domain), `*://*.${entry.domain}/*`];
    }
    case 'url-pattern':
      return [entry.pattern];
    default: {
      const exhaustive: never = entry;
      return exhaustive;
    }
  }
}

export function matchPatternsForGroups(
  groups: readonly DomainGroup[],
): readonly string[] {
  const patterns = new Set<string>();
  for (const group of groups) {
    if (group.mode !== 'managed') {
      continue;
    }
    for (const entry of group.domains) {
      for (const pattern of matchPatternsForEntry(entry)) {
        patterns.add(pattern);
      }
    }
  }
  return [...patterns];
}
