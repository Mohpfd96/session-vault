# Testing Strategy

Isolation is proven by tests, not by comments. Unit tests cover pure engines. Playwright + unpacked Chrome covers DNR and real Chromium behavior.

## Tooling

- **Vitest** — unit tests (`tests/unit/**/*.test.ts`), jsdom where DOM APIs matter.
- **Playwright** — extension E2E (`tests/e2e/**/*.spec.ts`) loading `.output/chrome-mv3`.
- **test-site** — local Node/static lab (not packaged into the store build).

## Unit (mandatory)

### Cookie engine

Parse `Set-Cookie`; Max-Age / Expires; domain + host-only; path; Secure; HttpOnly; SameSite; deletion (`Max-Age=0`); overwrite order; Cookie-header serialization (stable sort: path length then name).

### Domain engine

tldts registrable domains; public suffixes (`co.uk`); subdomains; exclusions; URL patterns; refuse naive splits.

### DNR compiler

Priorities 1000/900/800/700; `tabIds`; path filters; native cookie removal; fail-closed strip; budget projection; no silent native fallback.

### Session engine

Create / delete / temporary cleanup / clone / lifecycle transitions; deleting is strip → unbind → delete jar → delete metadata.

### Persistence

Schema v1; migrate up; interrupted upgrade; unknown future version.

### Security

Message Zod rejects; redaction of cookie values / Authorization / tokens; AES-GCM round trip; wrong password; malformed import.

## E2E (Chromium — not optional for isolation)

Lab origin serves Alice/Bob cookie and storage endpoints.

**Primary invariant:** Tab A Session A (Alice) and Tab B Session B (Bob), same origin, both open.

Repeat: navigate, reload, redirect, `Set-Cookie`, `document.cookie`, `localStorage`, IndexedDB, Cache Storage, child tabs.

Assert A never observes B and B never observes A.

Also:

- HttpOnly auth cookie
- Multiple `Set-Cookie`
- Redirect + `Set-Cookie`
- Cookie delete
- Secure
- Path `/` vs `/dashboard`
- Parent-domain cookies + subdomains
- Session inheritance
- Domain groups / OAuth-style second host
- Temporary session cleanup
- Same session, two tabs **do** share
- Service worker restart
- Rapid tabs / rapid switch
- DNR capacity fail-closed
- Prefix probing
- Untrusted page cannot request another session via messaging

Do not treat mocked DNR as a substitute for the Alice/Bob test.

Phase 2 is incomplete until that test passes. Phase 1 lands compiler/session unit tests and E2E harness scaffolding.

## Page runtime tests

The MAIN-world script is framework-free. Test via the lab page + content injection, plus isolated unit tests of cookie/storage helpers extracted into `modules/` (not only the IIFE).

## Performance budgets (track, not gate in Phase 1)

- Popup first paint targeted < 100ms after script
- Cookie mutation → DNR update coalesced (≥ 16ms debounce, per-tab)
- 100 tabs / many sessions: budget manager must degrade rather than hang

## CI

GitHub Actions: `pnpm compile`, `pnpm lint`, `pnpm test:unit`, `pnpm build`. E2E on `ubuntu-latest` with Playwright Chromium when the suite exists.

## Redaction

Tests must not print cookie values. Fixtures use placeholders like `alice-secret` inside assertions, not logs.

## See also

- [cookie-engine.md](./cookie-engine.md) — parser, jar, header compiler details
- [release-checklist.md](./release-checklist.md) — pre-ship verification
