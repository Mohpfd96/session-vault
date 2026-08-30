# Isolation Model

Session Vault provides **strong practical application-session isolation** inside a single Chrome profile. It is **not** a separate browser profile.

This document is the isolation contract. The [README status](../README.md#status) table is the source of truth for what the current build enforces.

## Current build (`0.1.0`)

When a tab is bound to a session on a managed domain group, the following are isolated **between sessions** (and shared **within** a session):

| Surface                        | Mechanism                          | Status in 0.1.0                                  |
| ------------------------------ | ---------------------------------- | ------------------------------------------------ |
| HTTP `Cookie` request header   | DNR `SET` from virtual jar         | Enforced when rules are installed before request |
| Native `Set-Cookie` absorption | DNR `REMOVE` response `Set-Cookie` | Enforced for network responses DNR can see       |
| `document.cookie`              | MAIN-world getter/setter           | Enforced; HttpOnly excluded                      |
| `localStorage`                 | per `(sessionId, origin)` namespace| **Not virtualized**                              |
| IndexedDB                      | database-name prefix               | **Not virtualized**                              |
| Cache Storage                  | cache-name prefix                  | **Not virtualized**                              |
| `BroadcastChannel`             | channel-name prefix                | **Not virtualized**                              |
| Web Locks                      | lock-name prefix                   | **Not virtualized**                              |
| `sessionStorage`               | **not** namespaced                 | Standard per-tab semantics (intentional)         |

Same-session tabs intentionally share the cookie jar. The boundary is **between sessions**, not between every tab.

Cookie isolation is implemented in the extension. It is **not** accepted as complete until the Chromium Alice/Bob E2E test passes. See [testing.md](./testing.md).

## Target V1 (virtual provider)

V1 additionally namespaces `localStorage`, IndexedDB, Cache Storage, `BroadcastChannel`, and Web Locks per `(sessionId, origin)` while keeping the same origin in the address bar. Until that ships, two sessions on the same origin **share native page storage**.

## Fail-closed policy

Any of the following causes request cookies to be **stripped**, not replaced with native cookies:

- Tab has no proven binding
- Binding exists but session is `degraded`, `corrupted`, `locked`, or `migrating`
- Host permission was revoked
- DNR rule budget is exhausted
- Recovery after restart cannot prove the tab’s session
- Page-runtime handshake fails
- Cookie header compilation fails

Logged-out is acceptable. Cross-session login is not.

## What is not isolated

These are **profile-global** or otherwise outside the virtual layer. The UI must never imply they are isolated.

| Surface                    | Why                                                                    |
| -------------------------- | ---------------------------------------------------------------------- |
| Existing Service Workers   | DNR does not apply to SW-generated responses. SW scope is origin-wide. |
| SharedWorker               | Shared across tabs of the same origin regardless of session.           |
| Browser HTTP cache         | Not Cache Storage. Chrome’s HTTP cache is per-profile.                 |
| Browser-managed auth       | TLS client certs, Chrome password manager, FedCM, some enterprise SSO. |
| History / sync / bookmarks | Per-profile.                                                           |
| DNS / TLS session / HSTS   | Per-profile.                                                           |
| Browser fingerprint        | Canvas, WebGL, fonts, UA — not in scope.                               |
| IP address                 | Network-level.                                                         |
| Chrome settings            | Zoom, permissions grants, notification permission, etc.                |
| True per-tab proxy         | Not available to extensions as a first-class primitive.                |

## Service Worker policy

Modes (user-visible, never silent). The field `strictness` is stored on sessions; the page runtime does **not** yet enforce STRICT or CLEAN.

- **COMPATIBILITY** (default) — allow existing SW; warn that isolation may be incomplete.
- **STRICT** — block new `navigator.serviceWorker.register` where the page runtime can wrap it; conservative isolation.
- **CLEAN** — unregister origin SW / clear origin caches. **Requires explicit confirmation** because it affects the whole origin, including other sessions.

Never silently unregister a site’s Service Worker. Never claim SW isolation is complete.

The current UI does not scan for Service Workers and must not report `FULL` as a measured result. See [compatibility.md](./compatibility.md).

## SharedWorker policy

Detect construction where possible. If a SharedWorker is used, compatibility is at most **LIMITED**. Do not pretend messages are session-scoped unless wrapping can be proven; if it cannot, surface the limitation. Detection is not implemented.

## Native cookie jar

After a domain is managed:

1. Optional **Default** session imports current native cookies.
2. Isolation rules are installed.
3. Native `Set-Cookie` is stripped on isolated tabs so the native jar does not accumulate mixed sessions.
4. Native cookies must not become the source of truth for isolated tabs.

Migration should be transactional. Failure restores a safe (fail-closed) state. Partial migration is a defect.

## Tab inheritance

When Session Vault creates a tab:

1. Create `about:blank`
2. Bind session + install DNR
3. Navigate to the destination

This avoids first-request leakage. Child tabs inherit the opener’s session by default (`openerTabId` / navigation APIs) when `inheritToChildTabs` is true. URL-only guessing after restart is **disabled**.

## `sessionStorage` and tab clone policy

`sessionStorage` stays tab-scoped (browser default).

Clone policies:

- **Duplicate page into session** (new tab, possibly new session): do **not** copy `sessionStorage` unless the user opts into “copy tab session storage”.
- **Move tab to session**: `sessionStorage` stays with the tab (same browsing context).
- Same-session `target=_blank`: browser may clone `sessionStorage` per spec; we do not fight that within a session.

## Compatibility levels

- **FULL** — no SW/SharedWorker detected; virtual cookie + storage surfaces in force.
- **LIMITED** — SW, SharedWorker, or other documented gaps present.
- **UNSUPPORTED** — isolation cannot be offered safely (for example, permission missing and cannot be requested).

Reasons must be specific (“Service Worker controlling this origin”), never “may not work”. Until the scanner ships, the product must not present a measured FULL score.

## Browser restart

Persistent `SessionProfile` data survives. Chrome tab IDs do not.

Restored tabs on managed domains start **unassigned** with cookies stripped until the user picks a session. Optional safe heuristics must be incapable of attaching Session A credentials to a tab that might belong to Session B.
