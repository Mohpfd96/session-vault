import { useCallback, useEffect, useMemo, useState } from 'react';
import { requestHostAccess } from '@/app/host-permission.ts';
import { sendUiMessage } from '@/app/messaging.ts';
import { filterAndSortSessions, findSessionItem } from '@/app/session-list-utils.ts';
import {
  DEFAULT_SESSION_FILTERS,
  EMPTY_SIDE_PANEL_SNAPSHOT,
  type SessionFilterState,
  type SessionListItem,
  type SessionSortOption,
  type SidePanelSnapshot,
  type SidePanelView,
} from '../types.ts';
import type { DomainGroup } from '@/modules/domain/domain-group.ts';
import type { SessionId } from '@/modules/domain/ids.ts';
import type { UiRequest } from '@/modules/messaging/protocol.ts';

type SidePanelState = {
  readonly snapshot: SidePanelSnapshot;
  readonly loading: boolean;
  readonly error: string | null;
};

async function ensureHostAccess(origin: string): Promise<string | null> {
  if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
    return 'Open a website tab (for example google.com), then create a session.';
  }
  const granted = await requestHostAccess(origin);
  if (!granted) {
    return 'Allow Session Vault to access this site when Chrome prompts, then retry.';
  }
  return null;
}

export function useSidePanelController(): SidePanelState & {
  readonly view: SidePanelView;
  readonly selectedSessionId: SessionId | null;
  readonly selectedDomainId: string | null;
  readonly search: string;
  readonly filters: SessionFilterState;
  readonly sort: SessionSortOption;
  readonly sessions: readonly SessionListItem[];
  readonly selectedSession: SessionListItem | undefined;
  readonly selectedDomain: DomainGroup | undefined;
  readonly setSearch: (value: string) => void;
  readonly setFilters: (filters: SessionFilterState) => void;
  readonly setSort: (sort: SessionSortOption) => void;
  readonly openSessions: () => void;
  readonly openSessionDetail: (sessionId: SessionId) => void;
  readonly openDomainDetail: (domainId: string) => void;
  readonly refresh: () => Promise<void>;
  readonly switchSession: (sessionId: string) => Promise<string | null>;
  readonly openInSession: (sessionId: string) => Promise<string | null>;
  readonly createSession: (name: string) => Promise<string | null>;
  readonly createTemporarySession: () => Promise<string | null>;
  readonly deleteSession: (sessionId: string) => Promise<string | null>;
  readonly renameSession: (sessionId: string, name: string) => Promise<string | null>;
} {
  const [snapshot, setSnapshot] = useState<SidePanelSnapshot>(EMPTY_SIDE_PANEL_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<SidePanelView>('sessions');
  const [selectedSessionId, setSelectedSessionId] = useState<SessionId | null>(null);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<SessionFilterState>(DEFAULT_SESSION_FILTERS);
  const [sort, setSort] = useState<SessionSortOption>('pinned');

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

  const sessions = useMemo(
    () => filterAndSortSessions(snapshot.sessions, search, filters, sort),
    [snapshot.sessions, search, filters, sort],
  );

  const selectedSession = useMemo(() => {
    if (selectedSessionId === null) {
      return undefined;
    }
    return findSessionItem(snapshot.sessions, selectedSessionId);
  }, [selectedSessionId, snapshot.sessions]);

  const selectedDomain = useMemo(() => {
    if (selectedDomainId === null) {
      return undefined;
    }
    return snapshot.domains.find((domain) => domain.id === selectedDomainId);
  }, [selectedDomainId, snapshot.domains]);

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

  const withSiteAccess = useCallback(
    async (action: () => Promise<string | null>): Promise<string | null> => {
      const accessError = await ensureHostAccess(snapshot.origin);
      if (accessError !== null) {
        return accessError;
      }
      return action();
    },
    [snapshot.origin],
  );

  return {
    snapshot,
    loading,
    error,
    view,
    selectedSessionId,
    selectedDomainId,
    search,
    filters,
    sort,
    sessions,
    selectedSession,
    selectedDomain,
    setSearch,
    setFilters,
    setSort,
    openSessions: () => {
      setView('sessions');
      setSelectedDomainId(null);
    },
    openSessionDetail: (sessionId) => {
      setSelectedSessionId(sessionId);
      setSelectedDomainId(null);
      setView('sessions');
    },
    openDomainDetail: (domainId) => {
      setSelectedDomainId(domainId);
      setView('domain-detail');
    },
    refresh,
    switchSession: (sessionId) => runAction({ type: 'ui.switchTabSession', sessionId }),
    openInSession: (sessionId) =>
      runAction({ type: 'ui.duplicateIntoSession', sessionId }),
    createSession: (name) =>
      withSiteAccess(() =>
        runAction({
          type: 'ui.createSession',
          name,
          attachToActiveTab: true,
        }),
      ),
    createTemporarySession: () =>
      withSiteAccess(() => runAction({ type: 'ui.createTemporarySession' })),
    deleteSession: (sessionId) => runAction({ type: 'ui.deleteSession', sessionId }),
    renameSession: (sessionId, name) =>
      runAction({ type: 'ui.renameSession', sessionId, name }),
  };
}
