import { useCallback, useEffect, useMemo, useState } from 'react';
import { sendUiMessage } from '@/app/messaging.ts';
import {
  EMPTY_SIDE_PANEL_SNAPSHOT,
  type SessionListItem,
  type SidePanelSnapshot,
} from '@/app/types.ts';
import type { UiRequest } from '@/modules/messaging/protocol.ts';
import {
  groupSessionsByDomain,
  type SiteSessionGroup,
} from '@/modules/sessions/site-filter.ts';

export type ManagerSiteId = 'all' | 'unassigned' | string;
export type ManagerView = 'sessions' | 'settings';

export function useManagerController(): {
  readonly snapshot: SidePanelSnapshot;
  readonly loading: boolean;
  readonly error: string | null;
  readonly search: string;
  readonly setSearch: (value: string) => void;
  readonly selectedSiteId: ManagerSiteId;
  readonly setSelectedSiteId: (id: ManagerSiteId) => void;
  readonly view: ManagerView;
  readonly setView: (view: ManagerView) => void;
  readonly sites: readonly SiteSessionGroup[];
  readonly unassigned: readonly SessionListItem[];
  readonly visibleSessions: readonly SessionListItem[];
  readonly selectedSiteName: string;
  readonly totalCount: number;
  readonly refresh: () => Promise<void>;
  readonly openSession: (sessionId: string) => Promise<string | null>;
  readonly deleteSession: (sessionId: string) => Promise<string | null>;
  readonly renameSession: (sessionId: string, name: string) => Promise<string | null>;
} {
  const [snapshot, setSnapshot] = useState<SidePanelSnapshot>(EMPTY_SIDE_PANEL_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState<ManagerSiteId>('all');
  const [view, setView] = useState<ManagerView>('sessions');

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await sendUiMessage<SidePanelSnapshot>({
      type: 'ui.getSidePanelSnapshot',
    });
    if (result.ok) {
      setSnapshot(result.data);
      setError(null);
    } else {
      setSnapshot(EMPTY_SIDE_PANEL_SNAPSHOT);
      setError(result.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAction = useCallback(
    async (request: UiRequest): Promise<string | null> => {
      const result = await sendUiMessage<unknown>(request);
      if (!result.ok) {
        return result.message;
      }
      await refresh();
      return null;
    },
    [refresh],
  );

  const grouped = useMemo(
    () => groupSessionsByDomain(snapshot.sessions, snapshot.domains),
    [snapshot.sessions, snapshot.domains],
  );

  const query = search.trim().toLowerCase();

  const filteredSites = useMemo(() => {
    if (query.length === 0) {
      return grouped.sites;
    }
    return grouped.sites
      .map((site) => ({
        group: site.group,
        sessions: site.sessions.filter(
          (item) =>
            item.session.name.toLowerCase().includes(query) ||
            site.group.name.toLowerCase().includes(query),
        ),
      }))
      .filter((site) => site.sessions.length > 0);
  }, [grouped.sites, query]);

  const filteredUnassigned = useMemo(() => {
    if (query.length === 0) {
      return grouped.unassigned;
    }
    return grouped.unassigned.filter((item) =>
      item.session.name.toLowerCase().includes(query),
    );
  }, [grouped.unassigned, query]);

  const visibleSessions = useMemo(() => {
    if (selectedSiteId === 'all') {
      return [...filteredSites.flatMap((site) => site.sessions), ...filteredUnassigned];
    }
    if (selectedSiteId === 'unassigned') {
      return filteredUnassigned;
    }
    const site = filteredSites.find((entry) => entry.group.id === selectedSiteId);
    return site?.sessions ?? [];
  }, [filteredSites, filteredUnassigned, selectedSiteId]);

  const selectedSiteName = useMemo(() => {
    if (selectedSiteId === 'all') {
      return 'All sites';
    }
    if (selectedSiteId === 'unassigned') {
      return 'Unassigned';
    }
    return (
      grouped.sites.find((site) => site.group.id === selectedSiteId)?.group.name ??
      'Site'
    );
  }, [grouped.sites, selectedSiteId]);

  return {
    snapshot,
    loading,
    error,
    search,
    setSearch,
    selectedSiteId,
    setSelectedSiteId,
    view,
    setView,
    sites: filteredSites,
    unassigned: filteredUnassigned,
    visibleSessions,
    selectedSiteName,
    totalCount: snapshot.sessions.length,
    refresh,
    openSession: (sessionId) => runAction({ type: 'ui.openSession', sessionId }),
    deleteSession: (sessionId) => runAction({ type: 'ui.deleteSession', sessionId }),
    renameSession: (sessionId, name) =>
      runAction({ type: 'ui.renameSession', sessionId, name }),
  };
}
