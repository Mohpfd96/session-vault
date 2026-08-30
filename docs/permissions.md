# Permissions

Session Vault should request the minimum capabilities needed to isolate site sessions. Host access is **intended** to be optional and requested when the user enables isolation for a site.

**Current packaged manifest (`0.1.0`) is wider than that intent.** `wxt.config.ts` declares `host_permissions: ['*://*/*']` and `unlimitedStorage` as required. Chrome Web Store V1 must move host access to optional / on-demand before listing. The popup still calls `requestOriginPermission` when creating a session so per-origin grants remain part of the enable-isolation path.

## Required (this build)

| Permission                            | Why                                                                                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tabs`                                | Read the current website tab from the popup/side panel (those UIs have no `sender.tab`).                                                                                                    |
| `activeTab`                           | Extra access to the tab that opened the popup so the current site can be shown immediately.                                                                                                 |
| `storage`                             | Settings, session metadata, domain groups, schema.                                                                                                                                          |
| `scripting`                           | Inject the MAIN-world runtime and register content scripts for managed hosts.                                                                                                               |
| `declarativeNetRequestWithHostAccess` | Enforce per-tab `Cookie` headers and strip native `Set-Cookie`. Chosen over `declarativeNetRequest` so a future listing can avoid an install-time DNR warning until host access is granted. |
| `webRequest`                          | Observe `Set-Cookie` (`extraHeaders`). Non-blocking; DNR enforces.                                                                                                                          |
| `webNavigation`                       | Session inheritance, redirects, safe `about:blank` navigation.                                                                                                                              |
| `contextMenus`                        | Toolbar “Open side panel” today. Link/tab session menus are not shipped.                                                                                                                    |
| `sidePanel`                           | Main management UI.                                                                                                                                                                         |
| `alarms`                              | Temporary-session grace cleanup and recovery sweeps (grace cleanup not implemented yet).                                                                                                    |
| `cookies`                             | One-time native cookie import into a Default session when a domain is first managed.                                                                                                        |
| `unlimitedStorage`                    | Large cookie jars. Intended as **optional** for store listing.                                                                                                                              |

## Optional (declared)

| Permission     | Why                                                      | Used today |
| -------------- | -------------------------------------------------------- | ---------- |
| `tabGroups`    | Presentation only. Never the source of session identity. | no         |
| `browsingData` | CLEAN compatibility mode (user-confirmed origin wipe).   | no         |

## Host access

| Mode                          | Status                               |
| ----------------------------- | ------------------------------------ |
| Install-time `*://*/*`        | Current build                        |
| Per-origin request on enable  | Also implemented; target store model |
| User opt-in “allow all sites” | Not shipped                          |

## Not requested

Remote code, identity, history, `nativeMessaging` (reserved for a future companion app, not V1).

No telemetry APIs. No remote script URLs.
