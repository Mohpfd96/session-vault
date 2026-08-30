# Storage Virtualization

SessionVault namespaces page-visible storage per `(sessionId, origin)` while keeping the same origin in the address bar. This document describes the page-runtime contract; cookie virtualization is covered in [cookie-engine.md](./cookie-engine.md).

See also: [isolation-model.md](./isolation-model.md), [service-worker-limitations.md](./service-worker-limitations.md).

## Virtual surfaces (V1)

| API                               | Strategy                                             |
| --------------------------------- | ---------------------------------------------------- |
| `document.cookie`                 | MAIN-world getter/setter backed by virtual jar       |
| `localStorage`                    | Keys stored under session namespace in extension IDB |
| `indexedDB.open/delete/databases` | Database name prefix; app sees logical names         |
| `caches.*`                        | Cache name prefix                                    |
| `BroadcastChannel`                | Channel name prefix                                  |
| `navigator.locks`                 | Lock name prefix (best-effort)                       |

## Not virtualized

- **`sessionStorage`** — remains per-tab browser semantics.
- **HTTP cache** — profile-global; not Cache Storage.
- **Service Worker / SharedWorker** — see compatibility docs.

## Trust boundary

The MAIN-world runtime is injected but **untrusted**:

- Session identity comes only from extension `TabBinding`, never from page-supplied `sessionId`.
- HttpOnly values never cross into `document.cookie`.
- Cross-session reads are rejected at the messaging layer.

## Persistence

Virtual web storage records live in IndexedDB store `webStorage` keyed by `[sessionId, origin, kind, key]`. Values are never logged. See [data-schema.md](./data-schema.md).

## Clone / duplicate behavior

Duplicating a page into another session does **not** copy `sessionStorage` unless the user opts in. Moving a tab keeps `sessionStorage` with the tab. See [isolation-model.md](./isolation-model.md).
