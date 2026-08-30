import { sortSessionsForDisplay } from '@/modules/domain/session-queries.ts';
import type { SessionFilterState, SessionListItem, SessionSortOption } from './types.ts';

function matchesSearch(item: SessionListItem, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) {
    return true;
  }
  const { session } = item;
  if (session.name.toLowerCase().includes(normalized)) {
    return true;
  }
  if (session.tags.some((tag) => tag.toLowerCase().includes(normalized))) {
    return true;
  }
  if (session.kind.toLowerCase().includes(normalized)) {
    return true;
  }
  return session.icon.includes(normalized);
}

function matchesFilters(item: SessionListItem, filters: SessionFilterState): boolean {
  const { session } = item;
  const anyFilter =
    filters.pinned ||
    filters.active ||
    filters.archived ||
    filters.temporary ||
    filters.tag.trim().length > 0;
  if (!anyFilter) {
    return true;
  }
  let matched = false;
  if (filters.pinned && session.pinned) {
    matched = true;
  }
  if (filters.active && session.state === 'active') {
    matched = true;
  }
  if (filters.archived && (session.archived || session.state === 'archived')) {
    matched = true;
  }
  if (filters.temporary && session.kind === 'temporary') {
    matched = true;
  }
  const tagQuery = filters.tag.trim().toLowerCase();
  if (
    tagQuery.length > 0 &&
    session.tags.some((tag) => tag.toLowerCase().includes(tagQuery))
  ) {
    matched = true;
  }
  return matched;
}

function compareSessions(
  left: SessionListItem,
  right: SessionListItem,
  sort: SessionSortOption,
): number {
  switch (sort) {
    case 'name':
      return left.session.name.localeCompare(right.session.name, undefined, {
        sensitivity: 'base',
      });
    case 'lastUsed':
      return right.session.lastUsedAt.localeCompare(left.session.lastUsedAt);
    case 'tabs':
      return right.tabCount - left.tabCount;
    case 'pinned':
    default: {
      const sorted = sortSessionsForDisplay([left.session, right.session]);
      if (sorted[0]?.id === left.session.id) {
        return -1;
      }
      return 1;
    }
  }
}

export function filterAndSortSessions(
  items: readonly SessionListItem[],
  query: string,
  filters: SessionFilterState,
  sort: SessionSortOption,
): SessionListItem[] {
  const filtered = items.filter(
    (item) => matchesSearch(item, query) && matchesFilters(item, filters),
  );
  return [...filtered].sort((left, right) => compareSessions(left, right, sort));
}

export { toSessionListItems } from '@/modules/messaging/snapshots.ts';

export function findSessionItem(
  items: readonly SessionListItem[],
  sessionId: string,
): SessionListItem | undefined {
  return items.find((item) => item.session.id === sessionId);
}
