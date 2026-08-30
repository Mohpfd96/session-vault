# Threat Model

Scope: a single Chrome profile with Session Vault installed. Attacker goals: read or apply another session’s credentials, or cause fail-open native cookie use.

Likelihood / impact: **L** low, **M** medium, **H** high, **C** critical.

## T1 — Accidental cross-session cookie leakage

|            |                                                                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Likelihood | M                                                                                                                                                   |
| Impact     | C                                                                                                                                                   |
| Scenario   | Two tabs on the same origin; DNR missing, stale, or path-wrong; native jar still authoritative.                                                     |
| Mitigation | Fail-closed strip when binding/rules uncertain. `SET` virtual Cookie; `REMOVE` native `Set-Cookie`. Path-aware compiler. Never swap the shared jar. |
| Tests      | Alice/Bob E2E: navigate, reload, redirect, Path cookies, HttpOnly.                                                                                  |

## T2 — Malicious site requesting another session’s secrets

|            |                                                                                                                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Likelihood | M                                                                                                                                                                                                         |
| Impact     | C                                                                                                                                                                                                         |
| Scenario   | Page JS sends `sessionId` of Session B, or enumerates `__sv_` prefixes.                                                                                                                                   |
| Mitigation | Session identity comes only from extension-held `TabBinding`. Page cannot choose session. Storage prefixes are not exposed. Prefix-guessing still hits namespaced stores of the **current** session only. |
| Tests      | Message validation unit tests; E2E page cannot read other session storage.                                                                                                                                |

## T3 — Malformed page-to-extension messages

|            |                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| Likelihood | H                                                                                                                  |
| Impact     | H                                                                                                                  |
| Scenario   | Forged `runtime.sendMessage` / window messages with extra fields or wrong types.                                   |
| Mitigation | Discriminated protocol. Zod at every trust boundary. Sender tab + origin checked. Sensitive RPCs background-owned. |
| Tests      | Fuzz invalid payloads; assert reject.                                                                              |

## T4 — Hostile imported backup

|            |                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| Likelihood | M                                                                                                            |
| Impact     | H                                                                                                            |
| Scenario   | JSON with prototype pollution, huge blobs, executable strings, schema confusion.                             |
| Mitigation | Zod versioned schemas. No `eval`. No function revival. Size limits. Preview + collision policy before write. |
| Tests      | Malformed import fixtures; encrypted envelope with garbage ciphertext.                                       |

## T5 — Extension worker crash / suspension

|            |                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Likelihood | H                                                                                                                                                                              |
| Impact     | C if fail-open                                                                                                                                                                 |
| Scenario   | SW dies; in-memory rules gone; next request uses native cookies.                                                                                                               |
| Mitigation | DNR session rules are the enforcement layer and must be rebuilt on init **before** serving managed navigations. Uncertain tabs stripped. Bindings in `chrome.storage.session`. |
| Tests      | Kill service worker; reload both Alice/Bob tabs; no leak.                                                                                                                      |

## T6 — Partial database migration

|            |                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Likelihood | L                                                                                                                                                             |
| Impact     | H                                                                                                                                                             |
| Scenario   | Upgrade writes new schema then crashes.                                                                                                                       |
| Mitigation | Version field. Transactional migrations. Interrupted upgrade resumes or rolls back to last good version. Backup before destructive migrations when practical. |
| Tests      | Migration fixtures including mid-upgrade crash simulation.                                                                                                    |

## T7 — DNR rule exhaustion

|            |                                                                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Likelihood | M (many tabs × path cookies)                                                                                                                                                      |
| Impact     | C if native fallback                                                                                                                                                              |
| Scenario   | >5000 session/`modifyHeaders` rules.                                                                                                                                              |
| Mitigation | `RuleBudgetManager` projects cost. On overflow: mark degraded, strip cookies, user warning: “Isolation paused because the browser rule limit was reached.” Never native fallback. |
| Tests      | Unit budget; E2E capacity failure path.                                                                                                                                           |

## T8 — User revokes host permission

|            |                                                                                      |
| ---------- | ------------------------------------------------------------------------------------ |
| Likelihood | M                                                                                    |
| Impact     | H                                                                                    |
| Scenario   | Isolation still “looks on” but DNR/scripting cannot run.                             |
| Mitigation | Permission adapter. On revoke: unmanage or fail-closed, UI error `PermissionDenied`. |
| Tests      | Optional E2E permission removal.                                                     |

## T9 — Stale tab binding

|            |                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Likelihood | H                                                                                                                                  |
| Impact     | C                                                                                                                                  |
| Scenario   | Tab ID reused after close, or binding not cleared.                                                                                 |
| Mitigation | Bindings verified against `tabs.get`. Closed tabs drop bindings. Tab IDs are session-local, never persisted as long-term identity. |
| Tests      | Rapid open/close; ID reuse reconciliation.                                                                                         |

## T10 — Browser restart

|            |                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| Likelihood | H                                                                                                           |
| Impact     | C if URL-guessing                                                                                           |
| Scenario   | Session rules gone; tab IDs new; extension attaches Work cookies to a Personal tab because the URL matches. |
| Mitigation | No credentialed guess. Restored managed tabs unassigned + stripped until user chooses.                      |
| Tests      | Restart-like: clear session storage + rebuild; assert strip then rebind.                                    |

## T11 — Session deletion race

|            |                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------- |
| Likelihood | M                                                                                            |
| Impact     | H                                                                                            |
| Scenario   | Tab still bound while jar deleted; next rebuild uses empty/wrong jar or native.              |
| Mitigation | Lifecycle `deleting`: strip rules first, unbind tabs, delete jar, then metadata. Idempotent. |
| Tests      | Delete while requests in flight.                                                             |

## T12 — Rapid concurrent cookie mutations

|            |                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------- |
| Likelihood | H                                                                                                 |
| Impact     | M–C                                                                                               |
| Scenario   | Many `Set-Cookie` + `document.cookie` writes; torn DNR headers.                                   |
| Mitigation | Per-session jar mutex. Debounced per-tab rebuild. Coalesce. Last-write wins per cookie-key rules. |
| Tests      | Concurrent mutation unit + E2E.                                                                   |

## T13 — Page guessing internal storage prefixes

|            |                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| Likelihood | M                                                                                                                 |
| Impact     | M (same-origin other session)                                                                                     |
| Scenario   | `indexedDB.open('__sv_B__app')` from Session A.                                                                   |
| Mitigation | Runtime wraps IDB and rejects / redirects internal prefixes. Background never answers cross-session storage APIs. |
| Tests      | Prefix probe in E2E lab.                                                                                          |

## T14 — XSS in extension UI

|            |                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Likelihood | L                                                                                                                             |
| Impact     | H                                                                                                                             |
| Scenario   | Session name / cookie value rendered as HTML.                                                                                 |
| Mitigation | React text escaping. No `dangerouslySetInnerHTML` for untrusted data. Cookie values masked. Treat import fields as untrusted. |
| Tests      | Names containing HTML/script in UI tests.                                                                                     |

## T15 — Secret exposure via logs / diagnostics / export

|            |                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Likelihood | M                                                                                                                                                      |
| Impact     | H                                                                                                                                                      |
| Scenario   | Cookie values in `console.log`, timeline, bug reports.                                                                                                 |
| Mitigation | Redaction utilities. Production logs quiet. Diagnostics mask values. Export strips cookie values, Authorization, tokens, storage values. No telemetry. |
| Tests      | Redaction unit tests; diagnostic export fixtures.                                                                                                      |

## Residual risk (accepted, disclosed)

Service Workers, SharedWorker, HTTP cache, fingerprint, IP, password manager, and native profile settings remain shared. Compatibility UI must name the actual feature.
