# Testing Strategy

Isolation is proven by tests, not by comments. Unit tests cover pure engines. Playwright + unpacked Chrome must cover DNR and real Chromium behavior before V1.

## Tooling

- **Vitest** — unit tests (`tests/unit/**/*.test.ts`), jsdom where DOM APIs matter. Run in CI.
- **Playwright** — extension E2E (`tests/e2e/**/*.spec.ts`) loading `.output/chrome-mv3`. **Not in CI.** Current suite is a load smoke test that skips when the build output is missing.
- **test-site** — local Node lab (`node test-site/server.mjs`, default `http://127.0.0.1:4173`). Not packaged into the store build.

## What CI runs

GitHub Actions (`pnpm compile`, `pnpm lint`, `pnpm format:check`, `pnpm test:unit`, `pnpm build`) on `ubuntu-latest`.

Playwright is **not** a CI gate yet.

## Unit (mandatory, and currently covered)

### Cookie engine

Parse `Set-Cookie`; Max-Age / Expires; domain + host-only; path; Secure; HttpOnly; SameSite; deletion (`Max-Age=0`); overwrite order; Cookie-header serialization (stable sort: path length then name); native cookie mapping; ingest of multiple headers.

### Domain engine

tldts registrable domains; public suffixes (`co.uk`); subdomains; exclusions; URL / match patterns.

### DNR compiler

Priorities 1000/900/800/700; `tabIds`; path filters; native cookie removal; fail-closed strip; budget projection; no silent native fallback.

### Session engine

Create / delete / temporary last-tab cleanup / lifecycle transitions.

### Persistence

Schema v1; migrate up; interrupted upgrade; unknown future version.

### Security

Message Zod rejects (including forged `sessionId` and origin mismatch); redaction of cookie values / Authorization / tokens; AES-GCM round trip; wrong password; tampered ciphertext.

## E2E (Chromium — required for V1, not landed)

Lab origin serves Alice/Bob cookie and storage endpoints.

**Primary invariant:** Tab A Session A (Alice) and Tab B Session B (Bob), same origin, both open.

Repeat: navigate, reload, redirect, `Set-Cookie`, `document.cookie`, `localStorage`, IndexedDB, Cache Storage, child tabs.

Assert A never observes B and B never observes A.

Also required before claiming cookie isolation complete:

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

Phase 2 cookie isolation is **not** complete until that test passes.

## Page runtime tests

The MAIN-world script is framework-free. Cookie helpers are unit-tested in `modules/cookies`. Full `document.cookie` behavior still needs the lab page + unpacked extension.

## Performance budgets (track; not a CI gate)

- Popup first paint targeted < 100ms after script
- Cookie mutation → DNR update coalesced (≥ 16ms debounce, per-tab)
- 100 tabs / many sessions: budget manager must degrade rather than hang

These have not been profiled in this repository.

## Redaction

Tests must not print cookie values. Fixtures use placeholders like `alice-secret` inside assertions, not logs.

## See also

- [cookie-engine.md](./cookie-engine.md) — parser, jar, header compiler details
- [release-checklist.md](./release-checklist.md) — pre-ship verification
- [README status](../README.md#status) — phase checklist
