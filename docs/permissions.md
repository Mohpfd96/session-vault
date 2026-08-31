# Permissions

Session Vault requests the minimum capabilities needed to isolate site sessions. Host access is **optional** and requested when the user enables isolation for a site.

`wxt.config.ts` declares `optional_host_permissions: ['*://*/*']` so Chrome can prompt per site. The packaged extension does **not** request `<all_urls>` at install. A dummy `host_permissions` entry (`https://sessionvault.invalid/*`) exists only so the isolation content script can be declared; it does not grant access to real websites. Creating a session from the popup or side panel calls `requestOriginPermission`, which asks for the site’s registrable domain and subdomains (so login redirects keep working). The background worker only checks that the grant exists; it never opens a permission prompt (those need a user gesture).

## Required (this build)

| Permission                            | Why                                                                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tabs`                                | Read the current website tab from the popup/side panel (those UIs have no `sender.tab`).                                                                                 |
| `activeTab`                           | Extra access to the tab that opened the popup so the current site can be shown immediately.                                                                              |
| `storage`                             | Settings, session metadata, domain groups, schema.                                                                                                                       |
| `scripting`                           | Inject the MAIN-world runtime and register content scripts for managed hosts.                                                                                            |
| `declarativeNetRequestWithHostAccess` | Enforce per-tab `Cookie` headers and strip native `Set-Cookie`. Chosen over `declarativeNetRequest` so install does not show a DNR warning until host access is granted. |
| `webRequest`                          | Observe `Set-Cookie` (`extraHeaders`). Non-blocking; DNR enforces.                                                                                                       |
| `webNavigation`                       | Session inheritance, redirects, safe `about:blank` navigation.                                                                                                           |
| `contextMenus`                        | Toolbar “Open side panel” today. Link/tab session menus are not shipped.                                                                                                 |
| `sidePanel`                           | Main management UI.                                                                                                                                                      |
| `cookies`                             | One-time native cookie import into a Default session when a domain is first managed.                                                                                     |

## Optional (this build)

None. Cookie jars use extension IndexedDB under Chrome’s default quota.

Reserved for later (not declared, so Chrome Web Store will not ask for a justification): `alarms` (temporary-session grace sweeps), `unlimitedStorage` (large jars), `tabGroups` (presentation only), `browsingData` (CLEAN origin wipe).

## Host access

| Mode                          | Status                               |
| ----------------------------- | ------------------------------------ |
| Install-time `*://*/*`        | Not declared                         |
| Dummy `sessionvault.invalid`  | Content-script placeholder only      |
| Per-origin request on enable  | Current store model                  |
| Registrable domain + `*.`     | Requested so auth hosts stay covered |
| User opt-in “allow all sites” | Not shipped                          |

`optional_host_permissions` lists `*://*/*` only as the **ceiling** Chrome allows the extension to request. The prompt the user sees is the specific site (for example `*://google.com/*` and `*://*.google.com/*`), not every website.

## Not requested

Remote code, identity, history, `nativeMessaging` (reserved for a future companion app, not V1).

No telemetry APIs. No remote script URLs.
