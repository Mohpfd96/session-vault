import type { DomainGroup } from '../domain/domain-group.ts';
import type { SessionProfile } from '../domain/session-profile.ts';
import { isIpHost } from '../cookies/domain.ts';
import { matchesDomainGroup } from '../domains/matcher.ts';
import type { SessionListItem } from '../messaging/snapshots.ts';

export function filterSessionsForSite(
  sessions: readonly SessionProfile[],
  groups: readonly DomainGroup[],
  host: string | undefined,
  href: string | undefined,
): SessionProfile[] {
  if (host === undefined || href === undefined) {
    return [];
  }

  const matchingIds = new Set(
    groups
      .filter((group) => matchesDomainGroup(host, href, group))
      .map((group) => group.id),
  );

  if (matchingIds.size === 0) {
    return [];
  }

  return sessions.filter((session) =>
    session.domainGroupIds.some((id) => matchingIds.has(id)),
  );
}

export type SiteSessionGroup = {
  readonly group: DomainGroup;
  readonly sessions: readonly SessionListItem[];
};

export function groupSessionsByDomain(
  items: readonly SessionListItem[],
  groups: readonly DomainGroup[],
): {
  readonly sites: readonly SiteSessionGroup[];
  readonly unassigned: readonly SessionListItem[];
} {
  const byGroup = new Map<string, SessionListItem[]>();
  const unassigned: SessionListItem[] = [];
  const seenInGroup = new Map<string, Set<string>>();

  for (const item of items) {
    if (item.session.domainGroupIds.length === 0) {
      unassigned.push(item);
      continue;
    }

    for (const id of item.session.domainGroupIds) {
      const list = byGroup.get(id) ?? [];
      const seen = seenInGroup.get(id) ?? new Set<string>();
      if (!seen.has(item.session.id)) {
        list.push(item);
        seen.add(item.session.id);
        byGroup.set(id, list);
        seenInGroup.set(id, seen);
      }
    }
  }

  const sites = groups
    .map((group) => ({
      group,
      sessions: byGroup.get(group.id) ?? [],
    }))
    .filter((site) => site.sessions.length > 0)
    .sort((left, right) => left.group.name.localeCompare(right.group.name));

  return { sites, unassigned };
}

function homeUrlForHost(host: string): string {
  if (isIpHost(host)) {
    const literal = host.includes(':') ? `[${host}]` : host;
    return `http://${literal}/`;
  }
  return `https://${host}/`;
}

export function homeUrlForDomainGroup(group: DomainGroup): string | undefined {
  const entry = group.domains[0];
  if (entry === undefined) {
    return undefined;
  }
  switch (entry.type) {
    case 'exact-host':
      return homeUrlForHost(entry.host);
    case 'registrable-domain':
      return homeUrlForHost(entry.domain);
    case 'url-pattern': {
      const cleaned = entry.pattern.replaceAll('*', '').replace(/\/+$/u, '');
      try {
        const url = new URL(cleaned.includes('://') ? cleaned : `https://${cleaned}`);
        return `${url.origin}/`;
      } catch {
        return undefined;
      }
    }
    default: {
      const exhaustive: never = entry;
      return exhaustive;
    }
  }
}
