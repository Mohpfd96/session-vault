# Chrome Web Store listing

Paste-ready copy and the upload checklist for Session Vault. Public privacy policy:

**https://mohpfd96.github.io/session-vault/privacy.html**

Homepage: **https://mohpfd96.github.io/session-vault/**

## Package

```bash
pnpm install
pnpm zip
```

Upload `.output/session-vault-*-chrome.zip` (manifest at the zip root). Do not upload the unpacked folder.

Store icon file in the repo: `public/icon-128.png` (also used as the 128px extension icon).

## Store listing

**Name:** Session Vault

**Summary (≤132 characters):**

Keep personal, work, and client logins apart in different Chrome tabs — isolated cookies, no second profile.

**Category:** Productivity

**Language:** English

**Detailed description:**

Session Vault isolates website logins inside your current Chrome profile.

Open the same site in two tabs, give each tab its own session, and keep those accounts from sharing cookies. Personal, work, and client logins can stay open side by side without a second browser profile.

How it works:

• Each session has its own cookie jar on this device
• For a bound tab, Session Vault rewrites the Cookie header and absorbs Set-Cookie so Chrome’s shared jar does not mix accounts
• document.cookie is virtualized for page JavaScript on managed sites
• If isolation cannot be proven, the tab stays logged out instead of showing the wrong account

Privacy:

• No cloud account and no product analytics
• Session data stays in this browser (chrome.storage and extension IndexedDB)
• Host access is requested when you isolate a site — not for every website at install

Session Vault is not a tab session saver, not a password manager, and not an anti-detect or fingerprint tool.

Limitations (honest): existing Service Workers, SharedWorker, and the browser HTTP cache are not isolated.

Source: https://github.com/Mohpfd96/session-vault
License: GPLv3 (open source). Closed-source / proprietary use needs a commercial license — contact https://github.com/Mohpfd96

**Single purpose (Privacy practices):** Isolate website logins by giving each tab its own cookie jar.

## Privacy practices (dashboard)

- Remote code: No
- User data: Stored locally only; not sold; not used for advertising
- Privacy policy URL: https://mohpfd96.github.io/session-vault/privacy.html

## Permission justifications

Use these in the dashboard when Chrome asks why each API is needed.

| Permission                            | Justification                                                                                                                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host access (optional)                | Requested when the user isolates a site. Covers that site’s registrable domain and subdomains so login redirects (for example accounts.google.com ↔ mail.google.com) stay in the same session. Not granted at install. |
| `cookies`                             | One-time import of the site’s existing cookies into the first session for that domain, then isolation uses the extension jar — not Chrome’s shared cookie store — for bound tabs.                                      |
| `declarativeNetRequestWithHostAccess` | Set per-tab Cookie request headers and strip native Set-Cookie so two sessions on the same origin do not mix.                                                                                                          |
| `scripting`                           | Inject the page script that virtualizes document.cookie on managed tabs.                                                                                                                                               |
| `webRequest`                          | Observe Set-Cookie (extraHeaders) so the jar can absorb cookies DNR cannot read. Non-blocking.                                                                                                                         |
| `webNavigation`                       | Bind child tabs / redirects to the parent session when the destination is in the same domain group.                                                                                                                    |
| `tabs`                                | Popup and side panel have no sender.tab; they need the current website URL to create a session.                                                                                                                        |
| `storage`                             | Session names, domain groups, and settings on this device.                                                                                                                                                             |
| `sidePanel`                           | Session manager UI.                                                                                                                                                                                                    |
| `contextMenus`                        | “Open side panel” from the toolbar icon.                                                                                                                                                                               |
| `alarms`                              | Cleanup sweeps for temporary sessions.                                                                                                                                                                                 |
| `unlimitedStorage` (optional)         | Cookie jars can exceed Chrome’s default quota. Requested with the first site grant; not required to install.                                                                                                           |

## Screenshots

Chrome requires at least one PNG: **1280×800** or **640×400**. Listing assets live in `assets/screenshots/` (not packed into the zip).

Regenerate from the GitHub Pages theme:

```bash
pnpm store:assets
```

That writes three 1280×800 screenshots, the 440×280 small tile, and the 1400×560 marquee tile. Upload screenshots and promo tiles in the dashboard as separate fields.

Do not show real account cookies or inbox content.

## Submit

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) → **New item** → upload the zip
2. Fill Store listing, Privacy, Distribution
3. Visibility: **Unlisted** for the first review, then Public after it is accepted
4. **Submit for review**

Updates: bump `version` in `package.json`, `pnpm zip`, upload a new package on the same item. The version must increase.
