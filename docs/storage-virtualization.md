# Storage Virtualization

Session Vault will namespace page-visible storage per `(sessionId, origin)` while keeping the same origin in the address bar.

**Status: specified, not shipped.** Cookie virtualization is live; see [cookie-engine.md](./cookie-engine.md). The page runtime does not wrap `localStorage`, IndexedDB, Cache Storage, `BroadcastChannel`, or Web Locks. The background router rejects `content.storageOp`. Until this lands, two sessions on the same origin share native page storage.

See also: [isolation-model.md](./isolation-model.md), [service-worker-limitations.md](./service-worker-limitations.md).

## Target surfaces (V1)

| API                               | Strategy                                              |
| --------------------------------- | ----------------------------------------------------- |
| `document.cookie`                 | MAIN-world getter/setter backed by virtual jar (live) |
| `localStorage`                    | Keys stored under session namespace in extension IDB  |
| `indexedDB.open/delete/databases` | Database name prefix; app sees logical names          |
| `caches.*`                        | Cache name prefix                                     |
| `BroadcastChannel`                | Channel name prefix                                   |
| `navigator.locks`                 | Lock name prefix (best-effort, feature-detected)      |

Internal names (for example `__sv_<sessionId>__app`) must never be exposed to application JavaScript.

## Not virtualized (by design)

- **`sessionStorage`** — remains per-tab browser semantics.
- **HTTP cache** — profile-global; not Cache Storage.
- **Service Worker / SharedWorker** — see [compatibility.md](./compatibility.md).

## Trust boundary

The MAIN-world runtime is injected but **untrusted**:

- Session identity comes only from extension `TabBinding`, never from page-supplied `sessionId`.
- HttpOnly values never cross into `document.cookie`.
- Cross-session reads are rejected at the messaging layer.
- Guessing an internal IndexedDB or cache prefix from Session A must not open Session B’s data. Probes should be rejected or redirected to the **current** session’s namespace only.

## Persistence

Virtual web storage records will live in IndexedDB store `webStorage` keyed by `[sessionId, origin, kind, key]`. The store exists in schema v1 and is unused. Values are never logged. See [data-schema.md](./data-schema.md).

## Clone / duplicate behavior

Duplicating a page into another session does **not** copy `sessionStorage` unless the user opts in. Moving a tab keeps `sessionStorage` with the tab. See [isolation-model.md](./isolation-model.md).
