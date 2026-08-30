import type {
  CompatibilityInfo,
  IsolationChipStatus,
  PopupSnapshot,
  SessionListItem,
  SidePanelSnapshot,
} from '@/modules/messaging/snapshots.ts';

export type {
  CompatibilityInfo,
  IsolationChipStatus,
  PopupSnapshot,
  SessionListItem,
  SidePanelSnapshot,
};

export type SidePanelView = 'sessions' | 'session-detail' | 'domain-detail';

export type SessionSortOption = 'pinned' | 'name' | 'lastUsed' | 'tabs';

export type SessionFilterState = {
  readonly pinned: boolean;
  readonly active: boolean;
  readonly archived: boolean;
  readonly temporary: boolean;
  readonly tag: string;
};

export const DEFAULT_SESSION_FILTERS: SessionFilterState = {
  pinned: false,
  active: false,
  archived: false,
  temporary: false,
  tag: '',
};

export const EMPTY_POPUP_SNAPSHOT: PopupSnapshot = {
  hostname: 'No website tab',
  siteLabel: 'No website tab',
  origin: '',
  favIconUrl: null,
  isolationStatus: 'off',
  isolationEnabled: false,
  currentSessionId: null,
  currentDomainGroupId: null,
  canIsolate: false,
  sessions: [],
  compatibility: {
    level: 'unsupported',
    reason: 'Not scanned yet',
  },
};

export const EMPTY_SIDE_PANEL_SNAPSHOT: SidePanelSnapshot = {
  hostname: 'No website tab',
  origin: '',
  isolationStatus: 'off',
  isolationEnabled: false,
  currentSessionId: null,
  currentDomainGroupId: null,
  canIsolate: false,
  sessions: [],
  domains: [],
  activeSessionIds: [],
};
