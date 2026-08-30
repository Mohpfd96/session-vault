import type { DomainGroupId, SessionId } from './ids.ts';
import type {
  SessionKind,
  SessionState,
  SessionStrictness,
  TemporaryCleanupPolicy,
} from './enums.ts';

export type SessionSettings = {
  readonly inheritToChildTabs: boolean;
  readonly tabGroupIntegration: boolean;
  readonly cloneSessionStorageOnDuplicate: boolean;
  readonly temporaryCleanup: TemporaryCleanupPolicy;
  readonly gracePeriodMs?: number;
};

export type SessionProfile = {
  readonly id: SessionId;
  readonly name: string;
  readonly color: string;
  readonly icon: string;
  readonly kind: SessionKind;
  readonly state: SessionState;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastUsedAt: string;
  readonly pinned: boolean;
  readonly archived: boolean;
  readonly locked: boolean;
  readonly tags: readonly string[];
  readonly notes: string;
  readonly strictness: SessionStrictness;
  readonly domainGroupIds: readonly DomainGroupId[];
  readonly settings: SessionSettings;
};

export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  inheritToChildTabs: true,
  tabGroupIntegration: false,
  cloneSessionStorageOnDuplicate: false,
  temporaryCleanup: 'last-tab',
};

export const SESSION_BADGE_LETTERS: Readonly<Record<SessionKind, string>> = {
  persistent: 'S',
  temporary: 'T',
};

export function sessionBadgeText(session: SessionProfile): string {
  const trimmed = session.name.replace(/^[🔴🟠🟡🟢🔵🟣🟤⚫⚪]\s*/u, '').trim();
  if (trimmed.length === 0) {
    return session.kind === 'temporary' ? 'T' : 'S';
  }
  const parts = trimmed.split(/\s+/u).filter((part) => part.length > 0);
  if (parts.length >= 2) {
    const first = parts[0]?.[0];
    const second = parts[1]?.[0];
    if (first !== undefined && second !== undefined) {
      return `${first}${second}`.toUpperCase();
    }
  }
  return trimmed.slice(0, 2).toUpperCase();
}
