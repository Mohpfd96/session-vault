# Threat Model

Scope: a single Chrome profile with Session Vault installed. Attacker goals: read or apply another session’s credentials, or cause fail-open native cookie use.

Likelihood / impact: **L** low, **M** medium, **H** high, **C** critical.

This model is the security contract for V1. Mitigations marked **shipped** exist in code. Mitigations marked **specified** are required before V1 but are not implemented. Test coverage is noted per threat.

## T1 — Accidental cross-session cookie leakage

|            |                                                                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Likelihood | M                                                                                                                                                   |
| Impact     | C                                                                                                                                                   |
| Scenario   | Two tabs on the same origin; DNR missing, stale, or path-wrong; native jar still authoritative.                                                     |
| Mitigation | **Shipped:** fail-closed strip when binding/rules uncertain; `SET` virtual Cookie; `REMOVE` native `Set-Cookie`; path-aware compiler. Never swap the shared jar. |
| Tests      | Unit: parser, matcher, compiler, budget. **Missing:** Alice/Bob E2E (navigate, reload, redirect, Path, HttpOnly).                                   |

## T2 — Malicious site requesting another session’s secrets

|            |                                                                                                                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Likelihood | M                                                                                                                                                                                                         |
| Impact     | C                                                                                                                                                                                                         |
| Scenario   | Page JS sends `sessionId` of Session B, or enumerates `__sv_` prefixes.                                                                                                                                   |
| Mitigation | **Shipped:** session identity comes only from extension-held `TabBinding`; page cannot choose session. **Specified:** storage prefix wrapping (storage virtualization not shipped).                        |
| Tests      | Unit: message validation rejects forged `sessionId`. **Missing:** E2E page cannot read other session storage.                                                                                             |

## T3 — Malformed page-to-extension messages

|            |                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| Likelihood | H                                                                                                                  |
| Impact     | H                                                                                                                  |
| Scenario   | Forged `runtime.sendMessage` / window messages with extra fields or wrong types.                                   |
| Mitigation | **Shipped:** discriminated protocol; Zod at trust boundaries; sender tab + origin checked; sensitive RPCs background-owned. |
| Tests      | Unit: invalid payloads rejected.                                                                                   |

## T4 — Hostile imported backup

|            |                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| Likelihood | M                                                                                                            |
| Impact     | H                                                                                                            |
| Scenario   | JSON with prototype pollution, huge blobs, executable strings, schema confusion.                             |
| Mitigation | **Specified:** Zod versioned schemas on import; no `eval`; no function revival; size limits; preview + collision policy. Encryption envelope validation is **shipped**. Import apply path is not. |
| Tests      | Encryption garbage ciphertext. **Missing:** malformed import fixtures through the product importer.          |

## T5 — Extension worker crash / suspension

|            |                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Likelihood | H                                                                                                                                                                              |
| Impact     | C if fail-open                                                                                                                                                                 |
| Scenario   | SW dies; in-memory rules gone; next request uses native cookies.                                                                                                               |
| Mitigation | **Shipped:** DNR session rules rebuilt on init; uncertain tabs stripped; bindings in `chrome.storage.session`.                                                                 |
| Tests      | **Missing:** kill service worker; reload both Alice/Bob tabs; no leak.                                                                                                         |

## T6 — Partial database migration

|            |                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Likelihood | L                                                                                                                                                             |
| Impact     | H                                                                                                                                                             |
| Scenario   | Upgrade writes new schema then crashes.                                                                                                                       |
| Mitigation | **Shipped:** version field; migration lock; resume or refuse unknown future versions.                                                                         |
| Tests      | Unit: migration fixtures including interrupted upgrade.                                                                                                       |

## T7 — DNR rule exhaustion

|            |                                                                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Likelihood | M (many tabs × path cookies)                                                                                                                                                      |
| Impact     | C if native fallback                                                                                                                                                              |
| Scenario   | >5000 session/`modifyHeaders` rules.                                                                                                                                              |
| Mitigation | **Shipped:** `RuleBudgetManager` projects cost; overflow marks degraded and strips cookies; never native fallback.                                                                |
| Tests      | Unit budget. **Missing:** E2E capacity failure path.                                                                                                                              |

## T8 — User revokes host permission

|            |                                                                                      |
| ---------- | ------------------------------------------------------------------------------------ |
| Likelihood | M                                                                                    |
| Impact     | H                                                                                    |
| Scenario   | Isolation still “looks on” but DNR/scripting cannot run.                             |
| Mitigation | **Partial:** permission adapter and `PermissionDenied` exist. Revoke → unmanage/fail-closed path needs product wiring and tests. |
| Tests      | **Missing:** permission removal E2E.                                                 |

## T9 — Stale tab binding

|            |                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Likelihood | H                                                                                                                                  |
| Impact     | C                                                                                                                                  |
| Scenario   | Tab ID reused after close, or binding not cleared.                                                                                 |
| Mitigation | **Shipped:** bindings verified against open tabs; closed tabs drop bindings; tab IDs never persisted as long-term identity.        |
| Tests      | Unit: binding store. **Missing:** rapid open/close ID reuse in Chromium.                                                           |

## T10 — Browser restart

|            |                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| Likelihood | H                                                                                                           |
| Impact     | C if URL-guessing                                                                                           |
| Scenario   | Session rules gone; tab IDs new; extension attaches Work cookies to a Personal tab because the URL matches. |
| Mitigation | **Shipped:** no credentialed guess; restored managed tabs unassigned + stripped until the user chooses.     |
| Tests      | **Missing:** restart-like: clear session storage + rebuild; assert strip then rebind.                       |

## T11 — Session deletion race

|            |                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------- |
| Likelihood | M                                                                                            |
| Impact     | H                                                                                            |
| Scenario   | Tab still bound while jar deleted; next rebuild uses empty/wrong jar or native.              |
| Mitigation | **Shipped (best-effort):** delete unbinds tabs and drops the jar. Ordered `deleting` lifecycle strip → unbind → jar → metadata should stay the only path. |
| Tests      | **Missing:** delete while requests in flight.                                                |

## T12 — Rapid concurrent cookie mutations

|            |                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------- |
| Likelihood | H                                                                                                 |
| Impact     | M–C                                                                                               |
| Scenario   | Many `Set-Cookie` + `document.cookie` writes; torn DNR headers.                                   |
| Mitigation | **Partial:** targeted per-tab rebuild after ingest. Per-session jar mutex and debounce are specified. |
| Tests      | Unit ingest. **Missing:** concurrent mutation E2E.                                                |

## T13 — Page guessing internal storage prefixes

|            |                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| Likelihood | M                                                                                                                 |
| Impact     | M (same-origin other session)                                                                                     |
| Scenario   | `indexedDB.open('__sv_B__app')` from Session A.                                                                   |
| Mitigation | **Specified:** runtime wraps IDB and rejects / redirects internal prefixes. Storage virtualization is not shipped, so this threat is currently **unmitigated** for native storage. |
| Tests      | **Missing:** prefix probe in E2E lab.                                                                             |

## T14 — XSS in extension UI

|            |                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Likelihood | L                                                                                                                             |
| Impact     | H                                                                                                                             |
| Scenario   | Session name / cookie value rendered as HTML.                                                                                 |
| Mitigation | **Shipped:** React text escaping; no `dangerouslySetInnerHTML` for untrusted data. Cookie inspector (when shipped) must mask values. |
| Tests      | **Missing:** names containing HTML/script in UI tests.                                                                        |

## T15 — Secret exposure via logs / diagnostics / export

|            |                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Likelihood | M                                                                                                                                                      |
| Impact     | H                                                                                                                                                      |
| Scenario   | Cookie values in `console.log`, timeline, bug reports.                                                                                                 |
| Mitigation | **Shipped:** redaction utilities; production logs quiet. **Specified:** diagnostics mask; export strips secrets; no telemetry.                         |
| Tests      | Unit redaction. **Missing:** diagnostic export fixtures.                                                                                               |

## Residual risk (accepted, disclosed)

Service Workers, SharedWorker, HTTP cache, fingerprint, IP, password manager, and native profile settings remain shared. Compatibility UI must name the actual feature. Until the scanner ships, do not present these as isolated.
