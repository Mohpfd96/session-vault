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

After any permission change, upload a **new zip** first, then fill Privacy practices. Otherwise the dashboard still asks for APIs that are no longer in the package.

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

## Account Settings (required before any item can publish)

These two errors are **account** settings, not the item’s Privacy tab:

1. Open [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click the **account / gear** (not the item) → **Settings** (or **Account**)
3. Enter a **publisher contact email** you can open
4. Click **Verify** / **Send verification**
5. Open the email from Google and click the confirmation link
6. Refresh the item page — the contact-email errors should disappear

Use an inbox you check. Unverified email blocks publish even when the listing is complete.

## Privacy practices (dashboard)

Open the item → **Privacy practices**. Paste the blocks below. Click **Save draft** when every field is filled.

### Single purpose

```
Isolate website logins by giving each Chrome tab its own cookie jar, so personal, work, and client accounts on the same site do not share cookies.
```

### Remote code

Select **No**. If the dashboard still requires a justification, paste:

```
Session Vault does not use remote code. All JavaScript is packaged in the extension zip. Isolation scripts (document.cookie virtualization and tab title markers) are injected from files and functions shipped with the extension. The extension does not fetch, eval, or execute code from the network, a CDN, or a remote config.
```

### Privacy policy URL

```
https://mohpfd96.github.io/session-vault/privacy.html
```

### Data usage / certification

The extension **does handle user data locally** (cookies and session metadata on this device). Disclose that. Then certify compliance.

Check / answer:

- **Does this item collect or use user data?** Yes — stored only in this Chrome profile (`chrome.storage` and extension IndexedDB). Not uploaded to Session Vault servers (there are none).
- **Personally identifiable information:** No
- **Health information:** No
- **Financial and payment information:** No
- **Authentication information:** Yes — website cookies imported into per-session jars so isolated logins work. Used only for that isolation. Never sold or sent off the device.
- **Personal communications:** No
- **Location:** No
- **Web history:** No — the extension does not keep a list of visited pages, titles, or visit times. It reads the current tab URL only to attach a cookie jar. Managed-site hostnames are sites the user chose to isolate, not a browsing history.
- **User activity (clicks, keystrokes):** No — no click, scroll, or keystroke logging. `webRequest` is used only to ingest `Set-Cookie` into the jar.
- **Website content:** No — page text, images, and HTML are not stored.

If Chrome asks how authentication information is used:

```
Website cookies are imported into a per-session jar on this device so isolated logins work. They are not transmitted off the device or used for any other purpose.
```

Certify (check all three):

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

Click the **certify that your data usage complies with Developer Program Policies** checkbox. Publish stays blocked until that box is checked.

### Permission justifications

Paste each block into the matching field. After the unused-permission zip is uploaded, Chrome should **not** ask for `alarms`, `tabGroups`, `browsingData`, or `unlimitedStorage` — those APIs were not used and were removed from the manifest.

**Host permission use**

```
Host access is optional. The packaged manifest does not grant access to websites at install. optional_host_permissions lists *://*/* only as the ceiling Chrome allows chrome.permissions.request to use. When the user isolates a site from the popup or side panel, Chrome prompts for that site’s registrable domain and subdomains (for example *://google.com/* and *://*.google.com/*) so login redirects such as accounts.google.com stay in the same session. The user can deny the prompt; isolation then does not start for that site.
```

**activeTab**

```
Used when the user opens the Session Vault toolbar popup. The popup has no sender.tab of its own; activeTab gives temporary access to the tab they invoked the icon on so the current site URL can be shown and isolation can start for that tab after they confirm. It does not grant standing access to every website.
```

**cookies**

```
When the user first isolates a site, Session Vault imports that site’s existing Chrome cookies once into a Default session jar so the current login is not lost. After that, bound tabs use the extension’s per-session jar instead of Chrome’s shared cookie store. Cookies stay on this device and are never uploaded.
```

**declarativeNetRequestWithHostAccess**

```
For tabs bound to a session, Session Vault installs session-scoped declarativeNetRequest rules that set the Cookie request header from that session’s jar and strip native Set-Cookie so two logins on the same origin cannot mix. The WithHostAccess variant is used so DNR does not apply until the user grants access to that site.
```

**scripting**

```
Injects the packaged isolation content script and page runtime on tabs the user has bound to a session, so document.cookie is virtualized to that session’s jar. Also injects a short tab-title marker so the user can see which session a tab belongs to. Scripts are shipped in the extension package and run only on sites the user granted (or the tab they invoked the extension on).
```

**webRequest**

```
Observes Set-Cookie response headers (extraHeaders) on managed tabs so HttpOnly cookies can be absorbed into the session jar. This listener is non-blocking; declarativeNetRequest enforces isolation. webRequest is required because DNR cannot read Set-Cookie values.
```

**webNavigation**

```
Listens for committed navigations so a child tab (window.open or target=_blank) inherits the parent tab’s session when the destination is in the same domain group, and so isolation scripts re-apply after in-tab navigations. Used only to keep session binding correct, not to record browsing history for any other purpose.
```

**tabs**

```
The popup and side panel have no sender.tab. tabs is required to identify the focused website tab, read its URL in order to create or switch a session, open a new tab for a session after isolation rules are installed, and keep the toolbar icon in sync when the user changes tabs.
```

**storage**

```
Stores session names, colors, domain groups, settings, and tab-to-session bindings on this device (chrome.storage.local and chrome.storage.session). Cookie jars use extension IndexedDB. Nothing is synced to a Session Vault server.
```

**sidePanel**

```
Opens the session manager side panel, where the user lists, creates, and switches isolated sessions beside the current page. This is the main management UI for Session Vault.
```

**contextMenus**

```
Adds an “Open side panel” item on the Session Vault toolbar icon so the user can open the session manager without covering the page. The menu is registered for the action (toolbar icon) context only. It does not add menus on websites or read page content.
```

## Screenshots

Chrome requires at least one PNG: **1280×800** or **640×400**. Listing assets live in `assets/screenshots/` (not packed into the zip).

Regenerate from the GitHub Pages theme:

```bash
pnpm store:assets
```

That writes three 1280×800 screenshots, the 440×280 small tile, and the 1400×560 marquee tile. Upload screenshots and promo tiles in the dashboard as separate fields.

Do not show real account cookies or inbox content.

## Submit

1. Upload the latest zip (permissions in this package: `tabs`, `activeTab`, `storage`, `scripting`, `declarativeNetRequestWithHostAccess`, `webRequest`, `webNavigation`, `contextMenus`, `sidePanel`, `cookies`, plus optional host access)
2. Fill Store listing
3. Fill Privacy practices using the blocks above, including the certification checkbox
4. Verify the publisher contact email under Account → Settings
5. Click **Save draft**, confirm the error list is empty
6. Visibility: **Unlisted** for the first review, then Public after it is accepted
7. **Submit for review**

Updates: bump `version` in `package.json`, `pnpm zip`, upload a new package on the same item. The version must increase.
