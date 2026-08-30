# Privacy

Session Vault is local-first. No telemetry, no cloud accounts, no remote fonts in V1.

See also: [threat-model.md](./threat-model.md), [import-export.md](./import-export.md), [data-schema.md](./data-schema.md).

## Data stays on device

| Data                          | Location                                              |
| ----------------------------- | ----------------------------------------------------- |
| Session metadata              | `chrome.storage.local`                                |
| Tab bindings                  | `chrome.storage.session` (cleared on browser restart) |
| Cookie jars & virtual storage | Extension IndexedDB                                   |
| DNR session rules             | Chrome session rules (ephemeral)                      |

## Logging and diagnostics

- Structured logger redacts keys matching cookie/token/password/authorization patterns.
- Production builds avoid verbose logging.
- Diagnostics timeline masks secret values.
- Tests must not print real cookie values in CI output.

## Export

- Plain JSON backups use the `sessionvault-backup` envelope (see [data-schema.md](./data-schema.md)).
- Encrypted `.sessionvault` files use PBKDF2 + AES-GCM; passphrase is **never** stored.
- Export preview strips cookie values, `Authorization` headers, and storage payloads unless user explicitly exports a secrets-bearing backup (future UI guardrail).

## Permissions

Host access is requested when the user enables isolation for a site, not at install. See `permissions.md`.

## Non-goals

No fingerprint spoofing, anti-detect, or credential harvesting beyond what the user explicitly imports.
