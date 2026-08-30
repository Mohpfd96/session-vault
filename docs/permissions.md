# Permissions

SessionVault requests the minimum capabilities needed to isolate site sessions. Host access is **optional** and requested when the user enables isolation for a site.

| Permission                            | Why                                                                                                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tabs`                                | Read the current website tab from the popup/side panel (those UIs have no `sender.tab`).                                                                   |
| `activeTab`                           | Extra access to the tab that opened the popup so the current site can be shown immediately.                                                                |
| `storage`                             | Settings, session metadata, domain groups, schema.                                                                                                         |
| `scripting`                           | Inject the MAIN-world runtime and register content scripts for managed hosts.                                                                              |
| `declarativeNetRequestWithHostAccess` | Enforce per-tab `Cookie` headers and strip native `Set-Cookie`. Chosen over `declarativeNetRequest` so install does not warn until host access is granted. |
| `webRequest`                          | Observe `Set-Cookie` (`extraHeaders`). Non-blocking; DNR enforces.                                                                                         |
| `webNavigation`                       | Session inheritance, redirects, safe `about:blank` navigation.                                                                                             |
| `contextMenus`                        | Open/move/duplicate in a session.                                                                                                                          |
| `sidePanel`                           | Main management UI.                                                                                                                                        |
| `alarms`                              | Temporary-session grace cleanup; recovery sweeps.                                                                                                          |
| `cookies`                             | One-time native cookie import into a Default session when a domain is first managed.                                                                       |

## Optional

| Permission                | Why                                                             |
| ------------------------- | --------------------------------------------------------------- |
| `tabGroups`               | Presentation only. Never the source of session identity.        |
| `browsingData`            | CLEAN compatibility mode (user-confirmed origin wipe).          |
| `unlimitedStorage`        | Large cookie jars / backups.                                    |
| `*://*/*` (optional host) | Requested per site or as “allow all sites” if the user opts in. |

## Not requested

Remote code, identity, history, nativeMessaging (reserved for a future companion app, not V1).
