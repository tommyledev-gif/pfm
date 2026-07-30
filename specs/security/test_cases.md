# Test Cases: F-02 System Security (Phase 0)

> Source: [spec.md](./spec.md), [plan.md](./plan.md)
> Covers: US-04 (Login), US-05 (Logout)
> Scope note: `plan.md` covers Go backend only (no Flutter UI is defined in `spec.md` for Login/Logout — see that plan's Pre-flight Finding #3). No Flutter test cases appear below for that reason; adding them would be testing UI that has no spec AC to trace to.

## Scenario Coverage Matrix

> Maps every scenario ID from `spec.md` to the TC(s) that exercise it — added per `/qc-checklist` review (CM01). Rows with no `S-SEC-*` ID are plan.md-derived rules covered beyond the spec's own numbered scenarios.

| Spec Scenario | TC(s) |
|---|---|
| S-SEC-01 (login happy path) | TC-SEC-01 |
| S-SEC-02 (missing email/password) | TC-SEC-02, TC-SEC-03 |
| S-SEC-03 (wrong password) | TC-SEC-04 |
| S-SEC-04 (email not found) | TC-SEC-05 |
| S-SEC-05 (status=pending) | TC-SEC-07 |
| S-SEC-06 (status=disabled) | TC-SEC-08 |
| S-SEC-07 (rate limit) | TC-SEC-10, TC-SEC-11 |
| S-SEC-08 (logout happy path) | TC-SEC-17 |
| S-SEC-09 (double logout) | TC-SEC-18 |
| S-SEC-10 (malformed/missing refresh token) | TC-SEC-20, TC-SEC-21 |
| S-SEC-11 (expired refresh token) | TC-SEC-19 |
| *(plan.md)* enumeration protection, byte-identical bodies | TC-SEC-06 |
| *(plan.md)* soft-deleted account fails identically to not-found | TC-SEC-09 |
| *(plan.md)* access/refresh token expiry scoping | TC-SEC-12, TC-SEC-13 |
| *(plan.md)* password never logged | TC-SEC-14 |
| *(plan.md)* login has zero persisted side effects | TC-SEC-15 |
| *(plan.md)* concurrent double-logout race | TC-SEC-22 |
| *(plan.md)* `token_jti` stored, not raw token | TC-SEC-23 |
| *(plan.md)* logout doesn't require JWT auth | TC-SEC-24 |
| *(plan.md)* `IsTokenRevoked` read-your-write consistency | TC-SEC-25 |
| *(spec.md Open Question #2)* email case sensitivity | TC-SEC-16 (blocked, not yet resolvable) |

Every `S-SEC-*` scenario in `spec.md` has at least one TC — no scenario is missed. Unlike F-01, no JWT-state or UI-hiding gaps apply here: Login/Logout aren't JWT-gated (Login issues the token, Logout only needs the refresh-token payload) and no Flutter UI is in scope for this feature (see Coverage Analysis below), so those two `/qc-checklist`-derived categories have nothing to add in this file.

---

## US-04: Login

**ID:** TC-SEC-01
**Type:** e2e
**Layer:** handler
**Title:** Login succeeds with correct email and password for an active account
**Preconditions:** A user row with `status='active'`, known password hashed with bcrypt
**Steps:** `POST /auth/login` with `{ email, password }`
**Expected:** `200`; response contains `access_token`, `refresh_token`
**Priority:** P1

**ID:** TC-SEC-02
**Type:** unit
**Layer:** handler
**Title:** Login rejected when `email` field is missing
**Preconditions:** None
**Steps:** `POST /auth/login` with `{ "password": "correcthorse1" }`
**Expected:** `400`, `error_code=INVALID_INPUT`; no DB lookup performed
**Priority:** P1

**ID:** TC-SEC-03
**Type:** unit
**Layer:** handler
**Title:** Login rejected when `password` field is missing
**Preconditions:** None
**Steps:** `POST /auth/login` with `{ "email": "homer@example.com" }`
**Expected:** `400`, `error_code=INVALID_INPUT`; no DB lookup performed
**Priority:** P1

**ID:** TC-SEC-04
**Type:** integration
**Layer:** service
**Title:** Login rejected for a wrong password on an existing active account
**Preconditions:** A user row with `status='active'`, known password hash
**Steps:** `POST /auth/login` with the correct email and an incorrect password
**Expected:** `401`, `error_code=INVALID_CREDENTIALS`
**Priority:** P1

**ID:** TC-SEC-05
**Type:** integration
**Layer:** service
**Title:** Login rejected for an email with no matching account
**Preconditions:** `nobody@example.com` has no row in `users`
**Steps:** `POST /auth/login` with `{ email: "nobody@example.com", password: "anything1" }`
**Expected:** `401`, `error_code=INVALID_CREDENTIALS`
**Priority:** P1

**ID:** TC-SEC-06
**Type:** integration
**Layer:** service
**Title:** ⚠️ Wrong-password and email-not-found return byte-identical response bodies
**Preconditions:** One active user with a known password; one email that doesn't exist at all
**Steps:** Call login with (a) correct email + wrong password, and (b) nonexistent email + any password; capture both full response bodies (status, headers relevant to content, JSON body)
**Expected:** The two response bodies are byte-for-byte identical (same `error_code`, same `message` string) — this is the core anti-enumeration guarantee from `spec.md` Edge Case #1
**Priority:** P1 (security) — a test that only checks the status code is insufficient here; assert the full body

**ID:** TC-SEC-07
**Type:** integration
**Layer:** service
**Title:** Login rejected with a distinct code for a not-yet-activated account
**Preconditions:** A user row with `status='pending'`
**Steps:** `POST /auth/login` with that account's email and any password
**Expected:** `401`, `error_code=ACCOUNT_NOT_ACTIVATED` (deliberately distinct from `INVALID_CREDENTIALS` — not an enumeration risk since the invitee already knows their own email)
**Priority:** P1

**ID:** TC-SEC-08
**Type:** integration
**Layer:** service
**Title:** Login rejected with a distinct code for a disabled account
**Preconditions:** A user row with `status='disabled'`
**Steps:** `POST /auth/login` with that account's email and its correct password
**Expected:** `401`, `error_code=ACCOUNT_DISABLED`
**Priority:** P1

**ID:** TC-SEC-09
**Type:** integration
**Layer:** repository
**Title:** Soft-deleted account fails login identically to a nonexistent account
**Preconditions:** A user row with `deleted_at IS NOT NULL`
**Steps:** `POST /auth/login` with that account's email and its (pre-deletion) correct password; compare the response body against TC-SEC-05's
**Expected:** `401`, `error_code=INVALID_CREDENTIALS` — response body identical to the nonexistent-email case, not a distinct "account deleted" error
**Priority:** P1 (security)

**ID:** TC-SEC-10
**Type:** integration
**Layer:** handler
**Title:** 11th failed login attempt from the same IP within 15 minutes is rate-limited
**Preconditions:** 10 failed login attempts already recorded from IP `203.0.113.5` within the last 15 minutes
**Steps:** Send an 11th login attempt (any credentials) from `203.0.113.5`
**Expected:** `429`, `error_code=RATE_LIMITED`
**Priority:** P1

**ID:** TC-SEC-11
**Type:** integration
**Layer:** handler
**Title:** Login rate limit is scoped per IP, not global
**Preconditions:** IP `203.0.113.5` has 10 failed attempts in the current window; IP `198.51.100.9` has 0
**Steps:** Send a login attempt from `198.51.100.9`
**Expected:** Request is evaluated normally (not `429`) — confirms the limiter key is the request IP, not a shared/global counter
**Priority:** P2

**ID:** TC-SEC-12
**Type:** unit
**Layer:** service
**Title:** Issued access token expires in exactly 15 minutes
**Preconditions:** A successful login
**Steps:** Decode the returned `access_token`; compute `exp - iat`
**Expected:** `exp - iat == 900` seconds (15 minutes)
**Priority:** P1

**ID:** TC-SEC-13
**Type:** unit
**Layer:** service
**Title:** Issued refresh token expires in exactly 7 days
**Preconditions:** A successful login
**Steps:** Decode the returned `refresh_token`; compute `exp - iat`
**Expected:** `exp - iat == 604800` seconds (7 days)
**Priority:** P1

**ID:** TC-SEC-14
**Type:** unit
**Layer:** service
**Title:** Raw password never appears in logs, including on a failed login
**Preconditions:** Log capture attached to Zap
**Steps:** Attempt login with a wrong password; inspect all captured log entries
**Expected:** No log entry contains the raw submitted password in any field
**Priority:** P1 (security)

**ID:** TC-SEC-15
**Type:** integration
**Layer:** repository
**Title:** Successful login writes nothing to the `users` row
**Preconditions:** An active user; snapshot the full row before login
**Steps:** `POST /auth/login` with correct credentials; re-read the same row
**Expected:** Row is byte-for-byte identical to the pre-login snapshot (no `last_login_at` or any other column changed) — confirms `plan.md`'s "Login has zero persisted side effects" claim
**Priority:** P2

**ID:** TC-SEC-16
**Type:** blocked
**Layer:** service
**Title:** ⚠️ Email case-sensitivity behavior at login is undefined — cannot be written yet
**Preconditions:** A user invited/activated as `Homer@Example.com`
**Steps:** Attempt login with `homer@example.com` (different case)
**Expected:** **Unresolved** — `spec.md` Open Question #2 explicitly leaves this undecided, and flags it as a cross-feature risk (a user could be locked out by a case mismatch between how they were invited and how they type their email at login). This test cannot be written meaningfully until that's decided. Listed here so it isn't silently forgotten once the decision lands.
**Priority:** P1 (blocked on spec decision, not to be skipped once unblocked)

---

## US-05: Logout

**ID:** TC-SEC-17
**Type:** e2e
**Layer:** handler
**Title:** Logout with a valid, unrevoked refresh token — happy path
**Preconditions:** A valid refresh token issued by a prior login/activation, not yet revoked
**Steps:** `POST /auth/logout` with `{ "refresh_token": "<token>" }`
**Expected:** `200`; a row now exists in `revoked_tokens` with `token_jti` equal to that token's `jti` claim
**Priority:** P1

**ID:** TC-SEC-18
**Type:** integration
**Layer:** repository
**Title:** Double logout with the same token is idempotent
**Preconditions:** A refresh token already revoked (from a prior logout call)
**Steps:** `POST /auth/logout` again with the identical token
**Expected:** `200` (not an error); exactly one row for that `token_jti` exists in `revoked_tokens` (no duplicate-key error surfaced, no second row inserted)
**Priority:** P1

**ID:** TC-SEC-19
**Type:** integration
**Layer:** service
**Title:** Logout with an already-expired refresh token is a no-op success
**Preconditions:** A refresh token whose `exp` claim is in the past
**Steps:** `POST /auth/logout` with that expired token
**Expected:** `200` — treated as a harmless no-op per `spec.md` S-SEC-11, not an error
**Priority:** P2

**ID:** TC-SEC-20
**Type:** unit
**Layer:** handler
**Title:** Logout rejected when `refresh_token` field is missing
**Preconditions:** None
**Steps:** `POST /auth/logout` with `{}`
**Expected:** `400`, `error_code=INVALID_INPUT`
**Priority:** P1

**ID:** TC-SEC-21
**Type:** unit
**Layer:** handler
**Title:** Logout rejected for a malformed (non-JWT) refresh token
**Preconditions:** None
**Steps:** `POST /auth/logout` with `{ "refresh_token": "not-a-jwt" }`
**Expected:** `400`, `error_code=INVALID_INPUT`
**Priority:** P1

**ID:** TC-SEC-22
**Type:** integration
**Layer:** repository, race
**Title:** Concurrent double-logout with the identical token — both succeed, exactly one row persisted
**Preconditions:** A single valid, unrevoked refresh token
**Steps:** Fire two `POST /auth/logout` requests with the identical token at the same instant (released together via a barrier)
**Expected:** Both requests return `200`; exactly one row exists in `revoked_tokens` for that `token_jti` afterward — proves the `INSERT ... ON CONFLICT DO NOTHING` is actually conflict-safe under real concurrency, not just sequential double-calls
**Priority:** P1

**ID:** TC-SEC-23
**Type:** unit
**Layer:** repository
**Title:** `revoked_tokens.token_jti` stores the JWT ID claim, never the raw bearer token
**Preconditions:** A valid refresh token
**Steps:** Log out with it; inspect the inserted row
**Expected:** `token_jti` equals the token's `jti` claim value; the full raw JWT string does not appear in any column of the row
**Priority:** P1 (security)

**ID:** TC-SEC-24
**Type:** integration
**Layer:** handler
**Title:** Logout does not require a valid access token / JWT auth
**Preconditions:** A valid refresh token; no `Authorization` header at all, or an expired/garbage one
**Steps:** `POST /auth/logout` with `{ "refresh_token": "<token>" }` and no `Authorization` header
**Expected:** `200` — confirms `plan.md`'s statement that Logout sits outside the `JWTAuth()` middleware group (it only needs the refresh token payload)
**Priority:** P2

**ID:** TC-SEC-25
**Type:** unit
**Layer:** repository
**Title:** `IsTokenRevoked` reflects a revocation immediately after `Revoke` commits
**Preconditions:** A valid refresh token, not yet revoked
**Steps:** Call `RevokedTokenRepository.Revoke(jti, expiresAt)`, then immediately call `RevokedTokenRepository.IsRevoked(jti)`
**Expected:** `IsRevoked` returns `true` — read-your-write consistency, exercised here even though no production caller exists yet (see Coverage Analysis: `POST /auth/refresh` is out of scope, so this method has no current consumer, but it must work correctly for whenever that endpoint lands)
**Priority:** P2

---

## Coverage Analysis

| Area | Status | Note |
|------|--------|------|
| Happy path, both stories | ✅ Covered | TC-SEC-01, 17 |
| Every documented validation rule | ✅ Covered | TC-SEC-02, 03, 20, 21 |
| Auth: unauthenticated → 401 | N/A for Login (public) | Login *is* the unauthenticated entry point. Logout deliberately does **not** require auth either (TC-SEC-24) — there is no "unauthenticated → 401" case in this feature's own endpoints. The `401` produced when a *different* feature's protected route rejects a bad JWT is covered in `user-management/test_cases.md` (TC-USR-07/08/38), since `JWTAuth()` is exercised there against real protected routes. |
| Auth: wrong role → 403 | N/A | Neither Login nor Logout is role-gated |
| Not found → 404 | N/A | Neither endpoint has a "resource not found" path in `spec.md` (wrong credentials map to `401`, not `404`) |
| Ownership violation → 403 | N/A | No per-user-owned resource in this feature |
| Duplicate/conflict → 409 | N/A | No unique-constraint-backed create operation in this feature |
| Rate limit → 429 | ✅ Covered | TC-SEC-10, 11 |
| Concurrent/race condition | ✅ Covered | TC-SEC-22 (double-logout race) |
| DB transaction rollback (multi-table) | N/A | No operation in this feature touches more than one table |
| Boundary values | N/A | No numeric/string amount fields in this feature to boundary-test |
| **Blocked test** | ⚠️ Flagged | TC-SEC-16 (email case-sensitivity) cannot be written until `spec.md` Open Question #2 is resolved — listed explicitly rather than silently omitted |
| **Untestable end-to-end** | ⚠️ Flagged | TC-SEC-25 exercises `IsTokenRevoked` in isolation because `POST /auth/refresh` (the endpoint that would actually call it in production) doesn't exist yet — see `plan.md`'s Pre-flight Finding #2 (blocking gap). A true end-to-end "revoked token is rejected on reuse" test belongs in a future `test_cases.md` update once that endpoint is planned. |
| Flutter (Login/Logout UI) | Out of scope | `spec.md` defines no UI flow for this feature — see `plan.md` Pre-flight Finding #3. No Flutter test cases are fabricated here for the same reason no Flutter plan section exists. |
| JWT token states (valid/invalid/expired/absent) | N/A | Neither Login nor Logout sits behind `JWTAuth()` — Login issues the token pair, Logout only validates the refresh-token payload (TC-SEC-24 confirms no access-token check applies). The refresh/access token *is* tested through its own 4 states within each story (valid, malformed/TC-SEC-21, expired/TC-SEC-19, absent/TC-SEC-20) |
| UI hides restricted actions from unauthorized roles | N/A | Login/Logout have no role gate at all (any `active` user may call either) and no Flutter UI is in scope for this feature |

### `/qc-checklist` review notes

Same stack mismatch as noted in `user-management/test_cases.md` — this checklist assumes Playwright/TypeScript, seeded `HR/FA/PM/DM` roles, Vietnamese UI copy, and a `constitution.md` file, none of which apply to PFM. Resolved the same way: `CLAUDE.md` treated as the constitution-equivalent, `400 INVALID_INPUT` kept per `spec.md` (not `422`), Playwright/seeded-data/Vietnamese sections marked N/A, and file structure kept as one-section-per-user-story rather than split into Coverage Matrix/Integration/E2E — with a `Scenario Coverage Matrix` added above to satisfy the traceability principle without the Playwright-oriented section split. See `user-management/test_cases.md`'s review notes for the full reasoning; not repeated here to avoid duplication.
