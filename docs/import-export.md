# Import and Export

Versioned, validated backup formats for Session Vault data.

**Status: crypto primitives shipped; product import/export not shipped.** `modules/security/encryption.ts` encrypts and decrypts envelopes. There is no backup assembler, file picker, preview UI, or collision-policy apply path.

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

Imports must always pass through Zod at trust boundaries. No function revival. No `eval`. Never deserialize executable content.

## Encrypted `.sessionvault` file

Implemented in `modules/security/encryption.ts` and covered by unit tests (round-trip, wrong passphrase, tampered ciphertext):

| Field  | Value                                              |
| ------ | -------------------------------------------------- |
| KDF    | PBKDF2, SHA-256, **310000** iterations             |
| Cipher | AES-GCM 256-bit                                    |
| Auth   | GCM tag — wrong passphrase or tamper fails decrypt |

Passphrase is never persisted. Never log keys, salt+passphrase combinations, or plaintext cookie values.

## Collision policies

On import preview the user chooses:

- **merge** — never silently overwrite existing session IDs
- **replace** — target scope replaced atomically
- **duplicate** — clone with new IDs

These policies are specified, not implemented in UI.

## Size and safety limits

- Reject oversize blobs before write.
- Malformed or future `schemaVersion` → `StorageCorrupted` / upgrade required.
- Encrypted imports validated as an envelope **before** decryption, then payload Zod-parsed after decrypt.

## What exports omit by default

Cookie values, storage values, and authorization material are redacted in diagnostic exports. Full secret export requires explicit user confirmation. Neither path is in the product yet.
