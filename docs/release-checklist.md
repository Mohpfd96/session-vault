# Release Checklist

Pre-ship verification for Session Vault. Check a box only when it is true for the build you are shipping.

Current package version: **0.1.0**. This is a development build. It is **not** Chrome Web Store ready. Cookie isolation is not claimed complete until the Alice/Bob E2E gate is green.

See also: [testing.md](./testing.md), [threat-model.md](./threat-model.md), [privacy.md](./privacy.md), [README status](../README.md#status).

## Build and static analysis

- [ ] `pnpm compile` — zero TypeScript errors
- [ ] `pnpm lint` — clean
- [ ] `pnpm format:check` — clean
- [ ] `pnpm test:unit` — all unit tests green
- [ ] `pnpm build` — MV3 artifact in `.output/chrome-mv3`

## Isolation engines

- [ ] Cookie parser tests: Max-Age, Expires, domain, path, Secure, HttpOnly, deletion, overwrite
- [ ] DNR compiler tests: priorities 1000/900/800/700, `tabIds`, fail-closed degraded path
- [ ] Rule budget projection >5000 ⇒ degraded strip-only, **no native fallback**
- [ ] Encryption roundtrip, wrong password, tamper detection

## E2E (cookie-isolation gate)

- [ ] Alice/Bob same-origin dual-session test passes in Chromium
- [ ] HttpOnly, Path, redirect + Set-Cookie, inheritance cases pass
- [ ] Service worker kill + reload does not leak sessions
- [ ] E2E runs in CI or is an explicit documented release job

## Security review

- [ ] No cookie values in logs or test output
- [ ] No `dangerouslySetInnerHTML` for untrusted session names
- [ ] Import paths Zod-validated (when import ships)
- [ ] Passphrase never persisted
- [ ] Page messages cannot supply `sessionId` as authority
- [ ] Compatibility UI does not report unmeasured FULL

## Permissions and disclosure

- [ ] Host permission requested only on user enable-isolation (no install-time `*://*/*`)
- [ ] Every permission still matches [permissions.md](./permissions.md)
- [ ] Compatibility UI names SW / SharedWorker / HTTP cache limitations
- [ ] Privacy policy matches local-only data handling
- [ ] LICENSE is MIT and referenced from the README and store listing

## Manual smoke

- [ ] Popup loads, shows current site + isolation chip
- [ ] Side panel lists sessions
- [ ] Bind tab → navigate → virtual cookie header applied (DevTools network)
- [ ] Unbind / degraded → cookies stripped on managed origin
- [ ] Two sessions on one origin stay logged in independently after reload

## Store artifacts

- [ ] Version bumped in package / manifest
- [ ] Screenshots, short and long description, single-purpose wording
- [ ] Changelog entry for user-visible changes
- [ ] `.sessionvault` format version unchanged or migration documented
- [ ] No remote code, no telemetry, no unrelated features
