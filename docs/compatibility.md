# Compatibility

Session Vault reports how completely isolation can be enforced for an origin. Levels are factual, never vague.

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

## What we never claim

- HTTP cache isolation
- TLS client certificates / FedCM / enterprise SSO
- Fingerprint or IP isolation
- Complete SharedWorker message isolation without proven wrapping

## Scanner integration

`modules/compatibility` (Phase 3+) aggregates signals from navigation, page runtime heartbeats, and worker detection. UI shows specific strings (“Service Worker controlling this origin”), not “may not work.”

## test-site

Local lab at `test-site/` exercises cookies, storage, broadcast, and redirects for manual and future E2E checks. Start with:

```bash
node test-site/server.mjs
```

Default origin: `http://127.0.0.1:4173`.
