import type { DomainGroup } from '../domain/domain-group.ts';
import type { IsolationLevel } from '../domain/enums.ts';
import type { SessionId } from '../domain/ids.ts';
import type { SessionProfile } from '../domain/session-profile.ts';

export type IsolationChipStatus = 'off' | 'isolated' | 'degraded' | 'unassigned';

export type SessionListItem = {
  readonly session: SessionProfile;
  readonly tabCount: number;
};

export type CompatibilityInfo = {
  readonly level: IsolationLevel;
  readonly reason: string;
};

export type PopupSnapshot = {
  readonly hostname: string;
  readonly siteLabel: string;
  readonly origin: string;
  readonly favIconUrl: string | null;
  readonly isolationStatus: IsolationChipStatus;
  readonly isolationEnabled: boolean;
  readonly currentSessionId: SessionId | null;
  readonly currentDomainGroupId: string | null;
  readonly canIsolate: boolean;
  readonly sessions: readonly SessionListItem[];
  readonly compatibility: CompatibilityInfo;
};

export type SidePanelSnapshot = {
  readonly hostname: string;
  readonly origin: string;
  readonly isolationStatus: IsolationChipStatus;
  readonly isolationEnabled: boolean;
  readonly currentSessionId: SessionId | null;
  readonly currentDomainGroupId: string | null;
  readonly canIsolate: boolean;
  readonly sessions: readonly SessionListItem[];
  readonly domains: readonly DomainGroup[];
  readonly activeSessionIds: readonly SessionId[];
};

export function toSessionListItems(
  sessions: readonly SessionProfile[],
  tabCounts: Readonly<Record<string, number>>,
): SessionListItem[] {
  return sessions.map((session) => ({
    session,
    tabCount: tabCounts[session.id] ?? 0,
  }));
}

export function compatibilityInfo(
  level: IsolationLevel,
  reasons: readonly string[],
): CompatibilityInfo {
  if (reasons.length === 0) {
    return {
      level,
      reason:
        level === 'full'
          ? 'No Service Worker or SharedWorker detected.'
          : 'Compatibility has not been scanned yet.',
    };
  }
  const first = reasons[0];
  return { level, reason: first ?? 'Compatibility warning.' };
}
