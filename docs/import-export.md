# Import and Export

Versioned, validated backup formats for SessionVault data.

See also: [data-schema.md](./data-schema.md), [recovery.md](./recovery.md), [privacy.md](./privacy.md).

## Unencrypted JSON envelope

```ts
{
  format: 'sessionvault-backup';
  schemaVersion: 1;
  exportedAt: string; // ISO-8601
  kind: 'full' | 'sessions' | 'session' | 'domain' | 'cookies' | 'settings';
  payload: unknown; // Zod-validated per kind
}
```

Imports always pass through Zod at trust boundaries. No function revival.

## Encrypted `.sessionvault` file

Implemented in `modules/security/encryption.ts`:

| Field  | Value                                              |
| ------ | -------------------------------------------------- |
| KDF    | PBKDF2, SHA-256, **310000** iterations             |
| Cipher | AES-GCM 256-bit                                    |
| Auth   | GCM tag — wrong passphrase or tamper fails decrypt |

Passphrase is never persisted.

## Collision policies

On import preview the user chooses:

- **merge** — never silently overwrite existing session IDs
- **replace** — target scope replaced atomically
- **duplicate** — clone with new IDs

## Size and safety limits

- Reject oversize blobs before write.
- Malformed or future `schemaVersion` → `StorageCorrupted` / upgrade required.
- Encrypted imports validated before decryption envelope parsing.

## What exports omit by default

Cookie values, storage values, and authorization material are redacted in diagnostic exports. Full secret export requires explicit user confirmation (UI Phase 5+).
