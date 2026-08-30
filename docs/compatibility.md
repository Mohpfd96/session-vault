# Compatibility

Session Vault reports how completely isolation can be enforced for an origin. Levels are factual, never vague.

**Status: specified, not shipped.** `IsolationProvider.getCompatibility()` currently returns `{ level: 'full', reasons: [] }` for every origin. The side panel hard-codes a FULL-looking line. That is a product defect relative to this document: the UI must not present an unmeasured FULL score. Until a scanner exists, treat compatibility as **unknown**, not FULL.

See also: [isolation-model.md](./isolation-model.md), [service-worker-limitations.md](./service-worker-limitations.md).

## Levels

| Level           | Meaning                                                                             |
| --------------- | ----------------------------------------------------------------------------------- |
| **FULL**        | No Service Worker / SharedWorker detected; virtual cookie + storage surfaces active |
| **LIMITED**     | Documented gap (SW, SharedWorker, DNR budget degraded, etc.)                        |
| **UNSUPPORTED** | Cannot offer isolation safely (e.g. host permission unavailable)                    |

## Common LIMITED reasons

- Active or registering **Service Worker**
- **SharedWorker** construction detected
- **DNR rule budget** exhausted → fail-closed strip only
- Host permission revoked while domain still marked managed

Example of an acceptable UI string: “Service Worker controlling this origin”. Unacceptable: “may not work”.

## What we never claim

- HTTP cache isolation
- TLS client certificates / FedCM / enterprise SSO
- Fingerprint or IP isolation
- Complete SharedWorker message isolation without proven wrapping
- Perfect Service Worker isolation

## Scanner (not implemented)

A future `modules/compatibility` package should aggregate signals from navigation, page runtime heartbeats, and worker detection.

## test-site

Local lab at `test-site/` exposes cookies, storage, broadcast, and redirects for manual checks and future E2E. Start with:

```bash
node test-site/server.mjs
```

Default origin: `http://127.0.0.1:4173`. The lab is not packaged into the extension.
