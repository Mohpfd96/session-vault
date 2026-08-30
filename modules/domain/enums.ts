export type SessionKind = 'persistent' | 'temporary';

export type SessionState =
  | 'creating'
  | 'ready'
  | 'active'
  | 'suspended'
  | 'archived'
  | 'deleting'
  | 'degraded'
  | 'locked'
  | 'corrupted'
  | 'migrating';

export type SessionStrictness = 'compatibility' | 'strict';

export type TemporaryCleanupPolicy = 'last-tab' | 'browser-session' | 'grace-period';

export type IsolationLevel = 'full' | 'limited' | 'unsupported';

export type AssignmentState = 'bound' | 'pending' | 'unassigned' | 'locked' | 'degraded';

export type CookieSameSite = 'strict' | 'lax' | 'none' | 'unspecified';

export type CookieSource = 'http' | 'document' | 'import' | 'migration';

export type DomainEntry =
  | { readonly type: 'exact-host'; readonly host: string }
  | {
      readonly type: 'registrable-domain';
      readonly domain: string;
      readonly includeSubdomains: boolean;
    }
  | { readonly type: 'url-pattern'; readonly pattern: string };
