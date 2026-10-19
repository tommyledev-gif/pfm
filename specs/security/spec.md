# Feature Spec: F-02 System Security (Phase 0)

> Source: `docs/features.md` (Feature-02)
> Status: Phase 0 — blocks all financial features
> Related: [F-01 User Management](../user-management/spec.md) (login authenticates users created there; account activation in US-02 of that spec also issues the same token pair described here)
>
> **Status 2026-10-19** — this is the original Phase-0 spec, kept as written. Parts of it have since been superseded:
> - **Refresh endpoint** (Out of Scope / Open Question 1 below) — exists: `POST /auth/refresh`, see [mobile-session-refresh](../mobile-session-refresh/spec.md).
> - **Revocation storage and logout scope** (US-05, Open Questions 3 and 5) — every sign-in is a row in `sessions` (migration 028); logout ends that one session, "sign out everywhere" ends all of them, and `JWTAuth` checks the session on every request, so access tokens stop at their next request. `revoked_tokens` remains for pre-session and deprecated switch tokens.
> - **Token lifetimes** — refresh tokens no longer live 7 days: a session lasts 60 days without use (sliding) and at most 180 days, bound to one device ([mobile-account-switch](../mobile-account-switch/spec.md), 2026-10-19). Access tokens are still 15 minutes.
> - **Session/device management and password change** — in scope since 2026-10-19: [mobile-account-switch](../mobile-account-switch/spec.md) US-08/US-09 (sign out everywhere), US-10 (signed-in devices, sign out one device), US-11 (change password). Password reset remains out of scope.
> - **Client** — the app is React Native (`mobile/`), not Flutter; tokens are kept in `expo-secure-store`.

## Context

Every authenticated request into the Go backend requires a JWT access token. This feature defines how a user with an already-`active` account (created via the F-01 invite/activate flow) obtains that token pair (login), and how a session is terminated (logout). Tightly coupled with F-01 because activation (US-02) already issues the same token pair as login — login is the *re-entry* path for a returning user rather than the *first-entry* path.

Actors:
- **User** — any `active` user, `role` = `admin` or `member`

## Preconditions (feature-level)

- User already exists with `status = active` (created via F-01 invite + activate, or the manually seeded admin).
- JWT signing secret(s) are configured server-side (`golang-jwt` v5).

---

## US-04: Login [MVP]

**As a** User with an active account,
**I want** to log in with my email and password,
**so that** I can obtain access/refresh tokens and use the app.

**API:** `POST /auth/login`

### Preconditions
- Request body: `{ email: string, password: string }`.

### Main Flow
1. User submits email + password.
2. System validates that both fields are present and non-empty (handler-level shape validation).
3. System fetches the user row by email (`deleted_at IS NULL`).
4. System checks `status = active`.
5. System verifies the password with `bcrypt.CompareHashAndPassword`.
6. System generates an access token (JWT, 15 min expiry) and a refresh token (JWT, 7 day expiry).
7. System returns the token pair.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-SEC-01 | User exists, `status=active`, password matches | User calls `POST /auth/login` | `200`; access + refresh token pair returned | Happy path |
| S-SEC-02 | `email` or `password` field is missing/empty in the request body | User calls login with an incomplete body | `400 INVALID_INPUT` | Client mistake — handler-level validation, checked before any DB lookup |
| S-SEC-03 | User exists, `status=active`, password does not match | User calls login | `401 INVALID_CREDENTIALS` | Same error/shape as S-SEC-04 — do not distinguish |
| S-SEC-04 | No user row for the given email | User calls login | `401 INVALID_CREDENTIALS` | Same error/shape as S-SEC-03 — prevents account enumeration |
| S-SEC-05 | User exists, `status=pending` (never activated) | User calls login | `401 ACCOUNT_NOT_ACTIVATED` | Distinct code — this is *not* enumeration risk (email was already disclosed to the invitee themselves) |
| S-SEC-06 | User exists, `status=disabled` | User calls login | `401 ACCOUNT_DISABLED` | See F-01 Open Questions — no API sets this state yet, but login must still guard it |
| S-SEC-07 | Same IP has failed login 10+ times in the past rolling 15 minutes | User attempts another login from that IP | `429 RATE_LIMITED` | Fiber rate-limit middleware, keyed by IP; counts failed attempts only (assumption — see Open Questions) |

### Edge Cases
1. **Enumeration protection**: wrong-password and email-not-found must return an identical error code, message, and (as close as practical) response latency — avoid an early-return short-circuit that makes "email not found" measurably faster than "password mismatch" (constant-time-ish comparison).
2. **Case sensitivity of email**: not yet decided whether email lookup is case-sensitive or case-insensitive, and it must be consistent with how F-01's invite duplicate-check treats email. Unresolved — **see Open Questions #2**.
3. **Soft-deleted account**: `deleted_at IS NOT NULL` must be treated identically to "email not found" (`401 INVALID_CREDENTIALS`), never a distinct error — a deleted account should not be distinguishable from a nonexistent one.
4. **bcrypt timing**: `bcrypt.CompareHashAndPassword` is itself slow (by design) — do not add additional artificial delay; rely on bcrypt's inherent cost plus rate limiting for brute-force resistance.

### Definition of Done
- `POST /auth/login` implemented; wrong-password and email-not-found paths return byte-identical response bodies.
- Rate limiter middleware applied (10 attempts / 15 min / IP).
- No raw password appears in logs (Zap logger) under any code path, including validation failures.
- Unit tests for scenarios S-SEC-02 through S-SEC-07 pass. Integration test for S-SEC-01 passes.

### Idempotency
Not applicable in the write sense — login has no persisted side effect on the `users` row itself (no "last login" timestamp is specified here — see Open Questions). Repeated identical calls simply issue fresh, independent token pairs.

---

## US-05: Logout [MVP]

**As a** logged-in User,
**I want** to log out,
**so that** my refresh token can no longer be used to mint new access tokens.

**API:** `POST /auth/logout`

### Preconditions
- Caller supplies the refresh token to be revoked (request body or header — **see Open Questions**, not fully specified in source doc).

### Main Flow
1. User triggers logout from the app.
2. System records the refresh token (or its JTI) as revoked — in a `revoked_tokens` table or equivalent store.
3. System returns success.
4. Client discards locally stored tokens (`flutter_secure_storage`) regardless of server response.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-SEC-08 | Valid, non-expired refresh token supplied | User calls `POST /auth/logout` | `200`; token recorded as revoked | Happy path |
| S-SEC-09 | Refresh token already revoked (double logout) | User calls logout again with the same token | `200` (idempotent — already-revoked is not an error) | ⚠️ Assumption — see Idempotency below |
| S-SEC-10 | Malformed or missing refresh token in request | User calls logout without a valid token | `400 INVALID_INPUT` | Client mistake |
| S-SEC-11 | Refresh token already expired (past 7 days) | User calls logout with it | `200` (no-op — an expired token cannot mint new access tokens anyway, so explicit revocation is redundant but harmless) | Assumption — see Open Questions |

### Edge Cases
1. **Access tokens are not revoked**: per source spec, access tokens (15 min) are not individually revocable in MVP — they simply expire naturally. A user who logs out is still technically "valid" on any access token issued before logout, for up to 15 minutes. This is an accepted MVP tradeoff for a personal app, not a defect.
2. **No cross-device semantics defined**: logging out on one device — does it revoke only that device's refresh token, or all refresh tokens for the user? Source doc implies "the" refresh token (singular), suggesting single-session-at-a-time or per-token revocation, not per-user. **Flagged as ambiguous — see Open Questions.**
3. **Storage mechanism**: source doc explicitly says "simple `revoked_tokens` table or Redis set (add Redis only if needed)" — this spec assumes a Postgres table for Phase 0 to avoid adding infra, consistent with "Docker Compose, Postgres 16" stack; Redis is an explicit future option, not required now. **Explicit assumption.**

### Definition of Done
- `POST /auth/logout` implemented; revoked refresh tokens are checked at token-refresh time (wherever `POST /auth/refresh` or equivalent validates a refresh token) — this spec does not define the refresh endpoint itself (see Open Questions).
- Revocation check added to any middleware/service path that accepts a refresh token.
- Unit tests for scenarios S-SEC-09 through S-SEC-11 pass. Integration test for S-SEC-08 passes.

### Idempotency
Explicitly idempotent by this spec's assumption: calling logout multiple times with the same (possibly already-revoked or already-expired) token always returns `200` — revocation is a set-membership operation, not a state-transition that can fail on retry.

---

## Out of Scope (Feature F-02)

- **Token refresh endpoint** (`POST /auth/refresh` or similar) — the source doc describes issuing an access+refresh pair at login/activation, but never how the access token is renewed after 15 minutes without re-entering a password. This is a significant gap for a mobile app with a 7-day refresh window — flagged below as an Open Question, not silently assumed. *(Resolved later: [mobile-session-refresh](../mobile-session-refresh/spec.md).)*
- Password reset / forgot password flow for already-active users. *(Still out of scope 2026-10-19; tracked as production-readiness P0.)*
- Multi-factor authentication.
- ~~Session/device management UI (viewing or revoking active sessions from a list).~~ *(In scope since 2026-10-19: [mobile-account-switch](../mobile-account-switch/spec.md) US-10.)*
- Changing the password of an active account — not covered by this Phase-0 spec. *(Added 2026-10-19: [mobile-account-switch](../mobile-account-switch/spec.md) US-11.)*
- Account lockout after repeated failures (only rate limiting is in scope; a hard lockout requiring admin unlock is not).
- ~~Access token revocation (explicitly deferred per source doc — "acceptable for a personal app").~~ *(Done with sessions, migration 028: `JWTAuth` checks the session on every request.)*

## Open Questions

1. **Refresh endpoint missing**: how does a client obtain a new access token before the 15-minute expiry without forcing the user to log in again? This must be resolved before Phase 0 is truly complete, since a 15-minute access token with no refresh path makes the 7-day refresh token pointless. *(Blocking — recommend adding `POST /auth/refresh` to this spec before implementation.)*
2. **Case sensitivity of email matching**: should `email` lookups (both login and invite-duplicate-check in F-01) normalize to lowercase before comparison/storage? Currently unspecified in both source docs — this must be decided before implementation, since login (this spec) and invite (F-01) have to agree on the same rule or a user could be locked out by a case mismatch between how they were invited and how they type their email at login.
3. **Logout scope**: does logout revoke only the presented refresh token, or all refresh tokens issued to that user (all-device logout)? Affects the `revoked_tokens` schema (needs `user_id` if all-device revocation is ever required).
4. **"Last login" tracking**: is a `last_login_at` timestamp needed on `users` for admin visibility (ties into F-01's US-03 list view)? Not in the current schema.
5. **Revoked token storage**: confirm Postgres table (this spec's assumption) vs. Redis for Phase 0 — affects `infra/docker-compose.yml` and whether a TTL-based cleanup job is needed for expired revoked-token rows.
