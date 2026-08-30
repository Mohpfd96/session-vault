# Privacy

Session Vault is local-first. No telemetry, no cloud accounts, no remote fonts.

See also: [threat-model.md](./threat-model.md), [import-export.md](./import-export.md), [data-schema.md](./data-schema.md), [permissions.md](./permissions.md).

## Data stays on device

| Data                          | Location                                              |
| ----------------------------- | ----------------------------------------------------- |
| Session metadata              | `chrome.storage.local`                                |
| Tab bindings                  | `chrome.storage.session` (cleared on browser restart) |
| Cookie jars                   | Extension IndexedDB                                   |
| DNR session rules             | Chrome session rules (ephemeral)                      |

Nothing is uploaded unless the user later exports a backup file from their own machine. There is no account, no sync service, and no analytics endpoint.

## Logging and diagnostics

- Structured logger redacts keys matching cookie/token/password/authorization patterns.
- Production builds avoid verbose logging (`debug` / `info` are development-only).
- Cookie values must not appear in the UI by default when a cookie inspector ships.
- Tests must not print real cookie values in CI output.
- There is no diagnostics timeline yet. When it exists, it must mask secret values and be disableable.

## Export

- Plain JSON backups will use the `sessionvault-backup` envelope (see [data-schema.md](./data-schema.md)). **Not shipped.**
- Encrypted `.sessionvault` files use PBKDF2 + AES-GCM; passphrase is **never** stored. Primitives exist; product UI does not.
- Diagnostic exports (when shipped) strip cookie values, `Authorization` headers, and storage payloads.

## Permissions

Host access should be requested when the user enables isolation for a site. This build currently also ships install-time `<all_urls>`. See [permissions.md](./permissions.md).

## Non-goals

No fingerprint spoofing, anti-detect, or credential harvesting beyond what the user explicitly imports.
