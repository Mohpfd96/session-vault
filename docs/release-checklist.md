# Release Checklist

Pre-ship verification for SessionVault extension builds.

See also: [testing.md](./testing.md), [threat-model.md](./threat-model.md), [privacy.md](./privacy.md).

## Build and static analysis

- [ ] `pnpm compile` — zero TypeScript errors
- [ ] `pnpm lint` — clean
- [ ] `pnpm test:unit` — all unit tests green
- [ ] `pnpm build` — MV3 artifact in `.output/chrome-mv3`

## Isolation engines

- [ ] Cookie parser tests: Max-Age, Expires, domain, path, Secure, HttpOnly, deletion, overwrite
- [ ] DNR compiler tests: priorities 1000/900/800/700, `tabIds`, fail-closed degraded path
- [ ] Rule budget projection >5000 ⇒ degraded strip-only, **no native fallback**
- [ ] Encryption roundtrip, wrong password, tamper detection

## E2E (Phase 2 gate)

- [ ] Alice/Bob same-origin dual-session test passes (not required for Phase 1 scaffold)
- [ ] E2E smoke skips cleanly when `.output/chrome-mv3` missing (CI without build)

## Security review

- [ ] No cookie values in logs or test output
- [ ] No `dangerouslySetInnerHTML` for untrusted session names
- [ ] Import paths Zod-validated
- [ ] Passphrase never persisted

## Permissions and disclosure

- [ ] Host permission requested only on user enable-isolation action
- [ ] Compatibility UI names SW / SharedWorker / HTTP cache limitations
- [ ] Privacy policy matches local-only data handling

## Manual smoke

- [ ] Popup loads, shows current site + isolation chip
- [ ] Side panel lists sessions
- [ ] Bind tab → navigate → virtual cookie header applied (devtools network)
- [ ] Unbind / degraded → cookies stripped on managed origin

## Store artifacts

- [ ] Version bumped in manifest
- [ ] Changelog entry for user-visible changes
- [ ] `.sessionvault` format version unchanged or migration documented
