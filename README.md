# Session Vault

Manage multiple isolated website sessions in Chrome — personal, work, client, and temporary — without leaking logins between tabs.

This is **not** a separate Chrome profile. Isolation is a virtual layer (cookies, JS storage, BroadcastChannel, locks) with explicit compatibility warnings for Service Workers, SharedWorker, and the HTTP cache.

## Develop

```bash
pnpm install
pnpm dev
pnpm test:unit
pnpm compile
pnpm lint
```

Requires Chrome 120+.

See `docs/architecture.md`.
