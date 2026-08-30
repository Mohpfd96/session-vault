import type { DomainGroup } from './domain-group.ts';
import type { SessionProfile } from './session-profile.ts';
import type { TabBinding } from './tab-binding.ts';
import type { VirtualCookie } from './virtual-cookie.ts';

export type { DomainGroup } from './domain-group.ts';
export type { SessionProfile, SessionSettings } from './session-profile.ts';
export { DEFAULT_SESSION_SETTINGS, sessionBadgeText } from './session-profile.ts';
export type { TabBinding } from './tab-binding.ts';
export type { VirtualCookie, CookieIdentity } from './virtual-cookie.ts';
export type {
  SessionId,
  DomainGroupId,
  CookieId,
  RoutingRuleId,
  TabId,
  Origin,
} from './ids.ts';
export {
  asSessionId,
  asDomainGroupId,
  asCookieId,
  asRoutingRuleId,
  asTabId,
  asOrigin,
  createId,
} from './ids.ts';
export type {
  SessionKind,
  SessionState,
  SessionStrictness,
  TemporaryCleanupPolicy,
  IsolationLevel,
  AssignmentState,
  CookieSameSite,
  CookieSource,
  DomainEntry,
} from './enums.ts';

export type SessionSnapshot = {
  readonly profile: SessionProfile;
  readonly cookies: readonly VirtualCookie[];
};

export type BoundTabView = {
  readonly binding: TabBinding;
  readonly session: SessionProfile;
  readonly domainGroup: DomainGroup;
};
