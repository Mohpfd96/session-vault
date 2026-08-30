# Service Worker Limitations

Chrome applies **Declarative Net Request (DNR) only to network fetches**, not to responses synthesized inside a controlling Service Worker.

This is a hard platform limit. Session Vault cannot “fix” it with header rewriting. The product must detect and disclose it, never hide it.

See also: [isolation-model.md](./isolation-model.md), [compatibility.md](./compatibility.md), [architecture.md](./architecture.md).

## Impact on isolation

| Path                                         | DNR sees request `Cookie`? | Native `Set-Cookie` stripped? |
| -------------------------------------------- | -------------------------- | ----------------------------- |
| Document navigation / XHR / fetch to network | Yes (when rules installed) | Yes (response headers)        |
| `fetch` handler returning cached `Response`  | **No**                     | **No**                        |
| Cache Storage hit served from SW `onfetch`   | **No**                     | **No**                        |

A site with an active Service Worker may therefore serve authenticated content from a **profile-global** cache or in-SW logic even when tab cookie headers are virtualized.

## User-visible modes

Specified. Only COMPATIBILITY is stored as the default `strictness`. STRICT wrapping and CLEAN origin wipe are not implemented. The UI does not currently scan for a controlling worker.

1. **COMPATIBILITY** (default) — existing SW allowed; UI must warn isolation may be incomplete.
2. **STRICT** — block new `navigator.serviceWorker.register` where the page runtime can wrap it.
3. **CLEAN** — unregister origin SW / clear origin caches. **Requires explicit confirmation** — affects the entire origin, all sessions.

Session Vault never silently unregisters a Service Worker.

## Testing guidance

Lab scenarios in `test-site/` and Chromium E2E should include:

- SW install + controlled fetch
- Cache Storage hit bypassing DNR
- Extension restart with SW still controlling

Those cases are not automated yet.

## Residual risk

Service Worker scope is **origin-wide**. Session Vault documents this as accepted residual risk in [threat-model.md](./threat-model.md).
