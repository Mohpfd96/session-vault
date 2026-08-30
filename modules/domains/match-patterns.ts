import type { DomainGroup } from '../domain/domain-group.ts';
import type { DomainEntry } from '../domain/enums.ts';
import { isIpHost } from '../cookies/domain.ts';

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
