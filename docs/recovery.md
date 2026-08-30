# Recovery

Procedures when Chrome restarts, the service worker dies, or isolation state is uncertain.

See also: [architecture.md](./architecture.md), [isolation-model.md](./isolation-model.md), [threat-model.md](./threat-model.md).

Background init in `entrypoints/background/index.ts` implements this path: load schema, restore bindings, reconcile open tabs, drop unknown DNR session rules, clean unused temporary sessions. Init is fail-closed on error. Chromium proofs of worker kill and browser restart are not automated yet.

## Service worker restart

MV3 workers are ephemeral. On every background init:

1. Load schema + settings from `chrome.storage.local`.
2. Restore tab bindings from `chrome.storage.session`.
3. Drop bindings for closed tabs (`tabs.get` verification).
4. Recompile DNR session rules **before** serving managed navigations.
5. Init must be idempotent (no duplicate rules).

In-memory maps are never authoritative.

## Browser restart

`chrome.storage.session` is empty after restart. Persistent session profiles and IDB jars survive; **tab IDs are new**.

Policy:

- Restored tabs on managed domains start **unassigned**.
- DNR emits **fail-closed strip** (`REMOVE` request `Cookie`) until the user picks a session.
- URL-only session guessing is **disabled**.

## Degraded / corrupted session

States `degraded`, `corrupted`, `locked`, `migrating` trigger fail-closed strip. UI should explain remediation (retry rebuild, restore backup, re-bind tab). Backup restore is not shipped.

## DNR budget exhaustion

When projected session rules exceed `MAX_UNSAFE_SESSION_RULES` (5000):

- Mark affected tabs **degraded**.
- Compile **fail-closed strip only**.
- Never fall back to native cookies.
- User-visible copy: “Isolation paused because the browser rule limit was reached.”

Unit tests cover budget projection. There is no E2E capacity-failure test.

## Migration failure

If schema migration aborts:

- Do not write partial metadata.
- Prefer rollback to last good `schemaVersion`.
- Copy snapshots before destructive migrations when size allows.

Interrupted upgrades resume via `sv.migrationLock`.

## User playbook

1. Reload the extension if the isolation chip shows uncertain or degraded.
2. Re-assign a session on each restored tab after a Chrome restart.
3. If corruption persists, wait for encrypted backup import (not shipped) or delete the affected session.
4. For rule-limit warnings, close unused isolated tabs or reduce path-specific cookies.
