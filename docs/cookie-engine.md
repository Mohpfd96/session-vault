# Cookie Engine

Pure TypeScript implementation of browser-ish cookie behavior for Session Vault virtual jars. No Chrome APIs.

See also: [architecture.md](./architecture.md), [data-schema.md](./data-schema.md), [storage-virtualization.md](./storage-virtualization.md).

## Modules

| Module                | Responsibility                                      |
| --------------------- | --------------------------------------------------- |
| `parse-set-cookie.ts` | Parse `Set-Cookie` response headers                 |
| `domain.ts`           | Host-only vs domain cookies; PSL checks via `tldts` |
| `path.ts`             | Default path, normalization, request-path matching  |
| `matcher.ts`          | Expiry, Secure, domain, path filtering for requests |
| `header.ts`           | `Cookie` header and `document.cookie` serialization |
| `jar.ts`              | Overwrite, deletion, apply parsed headers           |

## `parseSetCookie(header, requestUrl, now)`

Returns `ParsedSetCookie | null`.

- **Multiple headers:** caller maps `parseSetCookie` once per header.
- **Max-Age overrides Expires** when both are present.
- **Deletion:** `Max-Age <= 0` or `Expires` in the past → `{ kind: 'delete', ... }`.
- **Reject (null):** malformed header, invalid `Domain`, public suffix domain, `Secure` on non-HTTPS request URL.
- **Host-only:** absent `Domain` attribute ⇒ cookie domain is request host, `hostOnly: true`.
- **Path:** explicit `Path` normalized; otherwise RFC 6265 default directory of request URL (`/` for site root).
- **SameSite:** stored as metadata (`strict` \| `lax` \| `none` \| `unspecified`). Cross-site enforcement is a documented network/runtime limitation unless tested end-to-end.

## Jar identity and overwrite

Cookie key: `(sessionId, name, domain, path, partitionKey?)`.

Last write wins. Deletion removes the matching key.

## `cookieHeader(cookies, url, now)`

Builds the request `Cookie` header for DNR `SET`:

1. Filter: not expired, domain/path match, `Secure` only on `https:`.
2. Sort: **path length descending**, then **name ascending** (deterministic).
3. Format: `name=value; name2=value2`.

Returns `null` when no cookies apply.

## `documentCookieString(cookies, url, now)`

Same matching and sort as `cookieHeader`, but **excludes HttpOnly** cookies (page-visible subset).

## Public suffix policy

`Domain` must not be a public suffix (`co.uk`, `com`, etc.). Validated with **tldts** — naive string splits are forbidden.

## Testing

Unit tests in `tests/unit/cookies/` cover parser, path, domain, Secure, HttpOnly, deletion, overwrite, and header ordering.
