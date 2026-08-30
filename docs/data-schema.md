# Data Schema

All persisted records are versioned. Imported data is validated with Zod. Never deserialize functions.

Current schema version: **1**.

## Storage placement

| Record                      | Store                    | Key                |
| --------------------------- | ------------------------ | ------------------ |
| `SchemaMeta`                | `chrome.storage.local`   | `sv.schema`        |
| `ExtensionSettings`         | `chrome.storage.local`   | `sv.settings`      |
| `SessionProfile` list/index | `chrome.storage.local`   | `sv.sessions`      |
| `DomainGroup`               | `chrome.storage.local`   | `sv.domainGroups`  |
| `RoutingRule`               | `chrome.storage.local`   | `sv.routing`       |
| `TabBinding`                | `chrome.storage.session` | `sv.bindings`      |
| Runtime recovery            | `chrome.storage.session` | `sv.runtime`       |
| Virtual cookies             | IndexedDB `sessionvault` | store `cookies`    |
| Virtual web storage         | IndexedDB                | store `webStorage` |
| Diagnostics events          | IndexedDB                | store `events`     |
| Snapshots                   | IndexedDB                | store `snapshots`  |

## SchemaMeta

```ts
{
  schemaVersion: 1;
  migratedAt: string; // ISO-8601
  lastBackupAt?: string;
}
```

## Branded IDs

`SessionId`, `DomainGroupId`, `TabId`, `CookieId`, `RoutingRuleId` are branded strings/numbers. `TabId` is Chrome’s tab id and is **browser-session-local**.

## SessionProfile

```ts
{
  id: SessionId;
  name: string;
  color: string;          // CSS color token, e.g. "#5B8DEF"
  icon: string;           // emoji or icon key
  kind: 'persistent' | 'temporary';
  state: SessionState;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string;
  pinned: boolean;
  archived: boolean;      // mirrored by state === 'archived'
  locked: boolean;        // mirrored by state === 'locked'
  tags: string[];
  notes: string;
  strictness: 'compatibility' | 'strict';
  domainGroupIds: DomainGroupId[];
  settings: SessionSettings;
}

type SessionState =
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
```

`archived` / `locked` booleans are denormalized for filters; **lifecycle authority is `state`**. Transitions are explicit functions, not flag piles.

### SessionSettings

```ts
{
  inheritToChildTabs: boolean;
  tabGroupIntegration: boolean;
  cloneSessionStorageOnDuplicate: boolean;
  temporaryCleanup: 'last-tab' | 'browser-session' | 'grace-period';
  gracePeriodMs?: number;
}
```

## DomainGroup

```ts
{
  id: DomainGroupId;
  name: string;
  domains: DomainEntry[];
  includeSubdomains: boolean; // default for entries that omit it
  exclusions: DomainEntry[];
  mode: 'managed' | 'unmanaged';
  createdAt: string;
  updatedAt: string;
}

type DomainEntry =
  | { type: 'exact-host'; host: string }
  | { type: 'registrable-domain'; domain: string; includeSubdomains: boolean }
  | { type: 'url-pattern'; pattern: string }; // extension match pattern subset
```

Hosts are parsed with **tldts** (Public Suffix List). Naive suffix string splits are forbidden.

## VirtualCookie

```ts
{
  id: CookieId;
  sessionId: SessionId;
  name: string;
  value: string;
  domain: string;
  path: string;
  hostOnly: boolean;
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'strict' | 'lax' | 'none' | 'unspecified';
  expiresAt?: number;     // unix ms; absent ⇒ session cookie
  sessionOnly: boolean;
  creationTime: number;
  lastUpdatedTime: number;
  partitionKey?: string;
  source: 'http' | 'document' | 'import' | 'migration';
}
```

Cookie identity for overwrite: `(sessionId, name, domain, path, partitionKey?)`.

## TabBinding

```ts
{
  tabId: TabId;
  sessionId: SessionId;
  domainGroupId: DomainGroupId;
  assignmentState: 'bound' | 'pending' | 'unassigned' | 'locked' | 'degraded';
  createdAt: number;
  lastVerifiedAt: number;
}
```

After restart, all bindings are gone with `chrome.storage.session`. They are **not** reconstructed from URL alone.

## RoutingRule

```ts
{
  id: RoutingRuleId;
  pattern: DomainEntry;
  action:
    | { type: 'use-session'; sessionId: SessionId }
    | { type: 'ask' }
    | { type: 'temporary' }
    | { type: 'do-not-isolate' };
  priority: number; // higher wins; conflicts at equal priority are errors
  enabled: boolean;
}
```

## IndexedDB database `sessionvault`

Version 1 object stores:

| Store        | Key                              | Index                          |
| ------------ | -------------------------------- | ------------------------------ |
| `cookies`    | `id`                             | `bySession`, `bySessionDomain` |
| `webStorage` | `[sessionId, origin, kind, key]` | `bySessionOrigin`              |
| `events`     | autoincrement                    | `byTime`, `bySession`          |
| `snapshots`  | `id`                             | `bySession`                    |
| `kv`         | `key`                            | —                              |

`kind` for webStorage: `local` | `idb-meta` | `cache`. Values never logged.

## Backup envelope (unencrypted JSON)

```ts
{
  format: 'sessionvault-backup';
  schemaVersion: 1;
  exportedAt: string;
  kind: 'full' | 'sessions' | 'session' | 'domain' | 'cookies' | 'settings';
  payload: unknown; // still Zod-parsed per kind
}
```

## Encrypted backup (`.sessionvault`)

```ts
{
  format: 'sessionvault-encrypted';
  formatVersion: 1;
  kdf: 'PBKDF2';
  kdfHash: 'SHA-256';
  iterations: 310000;
  saltB64: string;
  algo: 'AES-GCM';
  ivB64: string;
  ciphertextB64: string;
}
```

Passphrase is never persisted. AES-GCM provides authentication (wrong password / bit-flip fails decrypt).

## Migration rules

- Bump `schemaVersion` only with a migration module `migrateV{n}ToV{n+1}`.
- Migrations must be idempotent.
- If `schemaVersion` is newer than the running extension: refuse to write; show `StorageCorrupted` / upgrade required.
- If older: run chain, then write `SchemaMeta`.
- Dangerous migrations copy `snapshots` first when size allows.

## Import collision policies

`merge` | `replace` | `duplicate` — chosen in the import preview UI. Never implicit overwrite of existing session IDs on `merge`.
