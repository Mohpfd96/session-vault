# Data Schema

All persisted records are versioned. Imported data is validated with Zod. Never deserialize functions.

Current schema version: **1**.

Stores listed as “reserved” exist in the schema and IndexedDB upgrade path so later versions do not require a user data wipe. They are not written by the current product UI.

## Storage placement

| Record                      | Store                    | Key                | Written today |
| --------------------------- | ------------------------ | ------------------ | ------------- |
| `SchemaMeta`                | `chrome.storage.local`   | `sv.schema`        | yes           |
| `ExtensionSettings`         | `chrome.storage.local`   | `sv.settings`      | yes           |
| `SessionProfile` list/index | `chrome.storage.local`   | `sv.sessions`      | yes           |
| `DomainGroup`               | `chrome.storage.local`   | `sv.domainGroups`  | yes           |
| `RoutingRule`               | `chrome.storage.local`   | `sv.routing`       | empty index   |
| `TabBinding`                | `chrome.storage.session` | `sv.bindings`      | yes           |
| Runtime recovery            | `chrome.storage.session` | `sv.runtime`       | yes           |
| Virtual cookies             | IndexedDB `sessionvault` | store `cookies`    | yes           |
| Virtual web storage         | IndexedDB                | store `webStorage` | reserved      |
| Diagnostics events          | IndexedDB                | store `events`     | reserved      |
| Snapshots                   | IndexedDB                | store `snapshots`  | reserved      |

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

`inheritToChildTabs` is enforced. `tabGroupIntegration`, `cloneSessionStorageOnDuplicate`, and non-`last-tab` cleanup policies are stored but not implemented.

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

Today the product creates one managed group per registrable domain when isolation is enabled. Custom multi-host families (for example Google Workspace) are schema-ready and have no editor yet.

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

The routing index is initialized empty. No matcher or UI exists yet.

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

Specified. Product import/export is not shipped.

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

Primitives are implemented in `modules/security/encryption.ts`. There is no file picker or side-panel export yet.

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

Interrupted upgrades resume via `sv.migrationLock`. Tests cover init, resume, and unknown future versions.

## Import collision policies

`merge` | `replace` | `duplicate` — chosen in the import preview UI (not shipped). Never implicit overwrite of existing session IDs on `merge`.
