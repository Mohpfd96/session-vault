# Session Vault Architecture

Session Vault is a Chrome Manifest V3 extension that provides **practical application-session isolation**: multiple simultaneous logins to the same site in different tabs.

Chrome does not expose Firefox-style per-tab cookie stores. Session Vault therefore does **not** swap Chrome’s shared cookie jar. It implements a **virtual session isolation layer** and fails closed when isolation cannot be proven.

This is **not** equivalent to separate Chrome profiles. See [isolation-model.md](./isolation-model.md) and [threat-model.md](./threat-model.md).

## Product invariant

> Never allow credentials or site state from Session A to leak into Session B.

If isolation state is uncertain, the page must receive **no** authentication cookies rather than another session’s cookies. Cross-session leakage is a severity-0 defect.

## Architectural decision: virtual isolation

| Approach                                                                     | Verdict                                                                          |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Continuously swap `chrome.cookies` for the active tab                        | Rejected. Race-prone, leaks on fast tab switches, cannot serve two tabs at once. |
| Native Chrome profiles via a companion app                                   | Future optional provider. Not required for V1.                                   |
| Virtual jars + DNR request `Cookie` rewrite + page-world storage namespacing | **V1 provider.**                                                                 |

The V1 provider (`VirtualExtensionIsolationProvider`) owns:

- per-session HTTP cookie jars (IndexedDB)
- DNR session rules that `SET` the request `Cookie` header for bound tabs
- DNR session rules that `REMOVE` response `Set-Cookie` on managed tabs so the native jar is not the source of truth
- MAIN-world virtualization of `document.cookie`, `localStorage`, IndexedDB, Cache Storage, `BroadcastChannel`, and Web Locks
- tab ↔ session bindings recovered from `chrome.storage.session`

A future `NativeBrowserProfileIsolationProvider` may replace network and storage isolation with real Chromium profiles without changing the domain model or UI.

## Chrome API facts this design depends on

Verified against Chrome MV3 documentation (Chrome 120+):

- `declarativeNetRequest.updateSessionRules` — session-scoped rules; cleared on browser shutdown and extension update. Limit: `MAX_NUMBER_OF_SESSION_RULES` = 5000. `modifyHeaders` rules also count toward `MAX_NUMBER_OF_UNSAFE_SESSION_RULES` = 5000.
- `HeaderOperation.SET` replaces an existing header. `SET` on request `Cookie` is the enforcement mechanism.
- `HeaderOperation.REMOVE` on request `Cookie` is the fail-closed mechanism.
- `HeaderOperation.REMOVE` on response `Set-Cookie` prevents native jar pollution for managed tabs.
- Rule `condition.tabIds` scopes rules to specific tabs.
- `urlFilter` / `requestDomains` provide host and path matching. Path-aware Cookie headers are compiled as separate rules when cookies use non-`/` paths.
- If a rule **removes** a header, lower-priority rules cannot modify it. Fail-closed `REMOVE Cookie` must outrank `SET Cookie`.
- `webRequest.onHeadersReceived` with `extraHeaders` can **observe** `Set-Cookie` (non-blocking in MV3). It cannot rewrite headers. DNR remains the enforcement layer.
- DNR does **not** apply to Service Worker–generated responses (`onfetch` / Cache Storage hits). This is a documented compatibility boundary.
- MV3 service workers can be killed at any time. `chrome.storage.session` and IndexedDB are the recovery sources. In-memory maps are never authoritative.

## Layer map

```mermaid
flowchart TB
  UI["UI application\n(popup / side panel)"]
  MSG["Typed messaging protocol"]
  COORD["Tab / session coordinator"]
  DOM["Session domain model"]
  DG["Domain-group resolver"]
  COOKIE["Virtual cookie engine"]
  DNR["DNR rule compiler + RuleBudgetManager"]
  NET["Network observer\n(Set-Cookie capture)"]
  STORE["Persistence\n(local / session / IDB)"]
  PAGE["Page MAIN-world runtime"]
  COMP["Compatibility scanner"]
  DIAG["Diagnostics engine"]
  SEC["Security / encryption"]
  PROVIDER["IsolationProvider"]

  UI --> MSG
  MSG --> COORD
  COORD --> DOM
  COORD --> DG
  COORD --> PROVIDER
  PROVIDER --> COOKIE
  PROVIDER --> DNR
  PROVIDER --> NET
  COOKIE --> STORE
  DNR --> STORE
  COORD --> STORE
  PAGE --> MSG
  COMP --> COORD
  DIAG --> STORE
  SEC --> STORE
```

Chrome APIs live behind adapters in `modules/adapters/chrome`. Core cookie, domain, and session logic is pure TypeScript and unit-tested without Chrome.

### Layer responsibilities

1. **Session domain model** — profiles, lifecycle states, cloning, temporary cleanup. No Chrome calls.
2. **Virtual cookie engine** — RFC-aware `Set-Cookie` parse, matching, overwrite, Cookie-header generation.
3. **DNR rule compiler** — deterministic, path-aware, budgeted compilation of session rules.
4. **Network observer** — captures `Set-Cookie` for the bound session only; triggers targeted rule rebuilds.
5. **Tab/session coordinator** — bindings, inheritance, restart reconciliation, fail-closed defaults.
6. **Domain-group resolver** — Public Suffix List via `tldts`; exact / registrable / subdomain / pattern matching.
7. **Page-storage virtualization runtime** — tiny framework-free MAIN-world script.
8. **Persistence** — `chrome.storage.local` (metadata), `chrome.storage.session` (bindings), IndexedDB (jars).
9. **Messaging protocol** — discriminated unions, Zod at trust boundaries.
10. **Compatibility scanner** — Service Worker / SharedWorker / Cache Storage detection.
11. **Diagnostics engine** — inspector + redacted timeline.
12. **Security/encryption** — WebCrypto AES-GCM backups, redaction.
13. **UI application** — React + shadcn; talks only to messaging facades.

## Isolation provider abstraction

```ts
interface IsolationProvider {
  readonly kind: 'virtual-extension' | 'native-profile';
  bindTab(input: BindTabInput): Promise<IsolationResult>;
  unbindTab(tabId: TabId): Promise<void>;
  navigateSafely(input: SafeNavigateInput): Promise<TabId>;
  rebuildRules(scope: RuleRebuildScope): Promise<IsolationResult>;
  getCompatibility(origin: Origin): Promise<CompatibilityReport>;
}
```

UI and domain code depend on this interface. They must not import DNR types.

## DNR rule priorities

Higher number wins in Chrome.

| Priority | Name                      | Action                                                                                                               |
| -------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1000     | `FAIL_CLOSED_STRIP`       | `REMOVE` request `Cookie` when the tab is unbound, degraded, corrupted, or recovery is uncertain on a managed domain |
| 900      | `VIRTUAL_COOKIE_PATH`     | `SET` request `Cookie` for a specific path prefix (most specific first)                                              |
| 800      | `VIRTUAL_COOKIE_ROOT`     | `SET` request `Cookie` for the default `Path=/` case                                                                 |
| 700      | `NATIVE_SET_COOKIE_STRIP` | `REMOVE` response `Set-Cookie` on managed isolated tabs                                                              |
| 100      | `RESERVED`                | Future allow/deny                                                                                                    |

Compiler rules:

- One healthy bound tab with only `Path=/` cookies → one `SET` rule + one `Set-Cookie` strip.
- Mixed paths → additional `VIRTUAL_COOKIE_PATH` rules. Each `SET` value is the **full** Cookie header valid for that path, not a delta.
- Degraded / unknown → `FAIL_CLOSED_STRIP` only. Never fall back to native cookies.
- Rebuilds are scoped to affected tab IDs. Never rewrite the entire session ruleset for one cookie mutation unless the budget manager requires a compact rebuild.

## Network path

```mermaid
sequenceDiagram
  participant Tab
  participant DNR
  participant Observer
  participant Jar
  participant Site

  Tab->>DNR: request
  DNR->>DNR: resolve tabId → binding → session
  alt bound and healthy
    DNR->>Site: Cookie: virtual session header
  else unbound / degraded / unknown
    DNR->>Site: Cookie header removed
  end
  Site-->>Observer: Set-Cookie (observed, extraHeaders)
  Observer->>Jar: mutate only bound session
  DNR-->>Tab: Set-Cookie stripped from native jar
  Jar->>DNR: rebuild rules for this tab only
```

## Page runtime trust boundary

The MAIN-world script is untrusted from the extension’s perspective even though we inject it.

- It never receives other sessions’ data.
- It never accepts a `sessionId` from page JavaScript as authority.
- Background resolves session exclusively from `TabBinding` in `chrome.storage.session`.
- All page → content → background payloads are Zod-validated.
- HttpOnly cookies are never returned by `document.cookie`.

## Persistence split

| Store                    | Contents                                                           | Survives SW kill  | Survives browser restart |
| ------------------------ | ------------------------------------------------------------------ | ----------------- | ------------------------ |
| `chrome.storage.local`   | settings, session metadata, domain groups, routing, schema version | yes               | yes                      |
| `chrome.storage.session` | tab bindings, DNR rule id map, ephemeral recovery flags            | yes               | **no**                   |
| Extension IndexedDB      | cookie jars, virtual storage, snapshots, diagnostics index         | yes               | yes                      |
| DNR session rules        | active isolation enforcement                                       | no (must rebuild) | **no**                   |

On every background init:

1. Load schema + settings.
2. Restore session bindings.
3. Query open tabs; drop bindings whose tab IDs no longer exist.
4. After browser restart, tab IDs are not identity. Unproven tabs on managed domains are **unassigned** and fail-closed until the user chooses a session.
5. Recompile DNR for remaining proven bindings.
6. Init is idempotent: repeated init must not duplicate rules.

## Directory architecture

```
.
├── docs/                          # product + security documentation
├── entrypoints/
│   ├── background/index.ts        # MV3 service worker
│   ├── popup/                     # toolbar popup (React)
│   ├── sidepanel/                 # main management UI (React)
│   ├── options/                   # privacy / permissions page
│   ├── isolation.content.ts       # ISOLATED-world bridge
│   └── page-runtime.ts            # MAIN-world runtime (no React)
├── modules/
│   ├── domain/                    # SessionProfile, DomainGroup, lifecycle
│   ├── cookies/                   # parser, matcher, jar, header compiler
│   ├── dnr/                       # compiler, priorities, RuleBudgetManager
│   ├── network/                   # Set-Cookie observer
│   ├── tabs/                      # TabBinding, inheritance, reconciliation
│   ├── domains/                   # PSL-aware matching, managed domains
│   ├── persistence/               # local / session / idb / migrations
│   ├── messaging/                 # protocol + validation
│   ├── compatibility/             # SW / SharedWorker / scoring
│   ├── diagnostics/               # inspector, timeline, redacted export
│   ├── security/                  # encryption, redaction, backup envelope
│   ├── adapters/chrome/           # thin Chrome API wrappers
│   ├── isolation/                 # IsolationProvider implementations
│   ├── routing/                   # automatic URL → session rules
│   ├── logging/                   # structured, redacting logger
│   └── errors/                    # typed domain errors
├── app/                           # UI use-cases (no Chrome APIs)
│   ├── popup/
│   └── sidepanel/
├── components/                    # React view components
│   └── ui/                        # shadcn primitives
├── lib/                           # cn(), theme tokens
├── tests/
│   ├── unit/
│   └── e2e/
├── test-site/                     # local isolation lab (not shipped)
└── .github/workflows/
```

## UI surfaces (Session Buddy–inspired)

Session Buddy is a tab _collection_ manager. Session Vault is a _login isolation_ manager. We borrow the UX grammar, not the product:

- Instant search over sessions, domains, and tags.
- Pinned items first, then active, then the rest.
- Compact color + icon + name + count rows.
- One-click primary actions; details live in the side panel.
- Keyboard-first lists.
- Light / dark / system. No remote fonts.

Popup: current site, isolation chip, current session, switch/open, new persistent/temporary, duplicate, move, compatibility, open side panel.

Side panel: Sessions list + Session detail + Domain detail. Diagnostics stay behind Advanced.

## Permissions (minimum V1)

Required: `storage`, `scripting`, `declarativeNetRequestWithHostAccess`, `webRequest`, `webNavigation`, `contextMenus`, `sidePanel`, `alarms`, `cookies`.

Optional: `tabGroups`, `browsingData`, `unlimitedStorage`, broad host access.

Host access is requested **when the user enables isolation for a site**, not at install. See [permissions.md](./permissions.md) (Phase 1+).

## Explicit non-goals

No fingerprint spoofing, proxies, CAPTCHA bypass, password manager, cloud accounts, or anti-detect behavior.

## Phase map

Phase 1 (this milestone): foundation, domain, persistence, messaging, popup + side panel skeletons, fail-closed provider stub.

Phase 2: cookie isolation + Alice/Bob E2E. Cookie isolation is **not** claimed complete until that test passes.

Phases 3–8: storage virtualization, navigation UX, lifecycle, backups, compatibility, polish.
