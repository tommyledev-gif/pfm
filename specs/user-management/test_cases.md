# Test Cases: F-01 User Management (Phase 0)

> Source: [spec.md](./spec.md), [plan.md](./plan.md)
> Covers: US-01 (Invite a User), US-02 (Activate Account), US-03 (List Users)

## Scenario Coverage Matrix

> Maps every scenario ID from `spec.md` to the TC(s) that exercise it — added per `/qc-checklist` review (CM01: every AC/scenario must have at least one TC reference). Rows with no `S-USR-*` ID are plan.md-derived rules (business rules / edge cases) that don't map to a numbered spec scenario but are still covered.

| Spec Scenario | TC(s) |
|---|---|
| S-USR-01 (invite happy path) | TC-USR-01 |
| S-USR-02 (invalid email) | TC-USR-04 |
| S-USR-03 (invalid role) | TC-USR-05 |
| S-USR-04 (duplicate email, active) | TC-USR-02 |
| S-USR-05 (duplicate email, pending) | TC-USR-03 |
| S-USR-06 (caller not admin) | TC-USR-09 |
| S-USR-07 (rate limit) | TC-USR-10, TC-USR-11 |
| S-USR-08 (email dispatch fails) | TC-USR-12 |
| S-USR-09 (activate happy path) | TC-USR-18 |
| S-USR-10 (token not found) | TC-USR-19 |
| S-USR-11 (token expired) | TC-USR-21 |
| S-USR-12 (token already consumed) | TC-USR-20 |
| S-USR-13 (password too short) | TC-USR-22 |
| S-USR-14 (password field missing) | TC-USR-23 |
| S-USR-15 (password mismatch) | TC-USR-25 |
| S-USR-16 (concurrent activation) | TC-USR-26 |
| S-USR-17 (list happy path) | TC-USR-33 |
| S-USR-18 (filter status) | TC-USR-34 |
| S-USR-19 (filter role) | TC-USR-35 |
| S-USR-20 (empty result) | TC-USR-36 |
| S-USR-21 (caller not admin, list) | TC-USR-37 |
| S-USR-22 (invalid filter enum) | TC-USR-39 |
| *(plan.md)* crypto/rand token generation | TC-USR-13 |
| *(plan.md)* invite token TTL = 72h | TC-USR-14 |
| *(plan.md)* concurrent invite of same email | TC-USR-15 |
| *(plan.md)* soft-deleted email re-invite | TC-USR-16 |
| *(plan.md)* invite token never logged | TC-USR-17 |
| *(plan.md)* token missing entirely (activate) | TC-USR-24 |
| *(plan.md)* bcrypt cost = 12 | TC-USR-27 |
| *(plan.md)* token pair scoping (activate) | TC-USR-28 |
| *(plan.md)* password/token never logged (activate) | TC-USR-29 |
| *(plan.md)* `full_name` optional | TC-USR-30 |
| *(plan.md)* cursor pagination correctness | TC-USR-41 |
| *(plan.md)* `limit` over documented max | TC-USR-42 (gap, see Coverage Analysis) |
| *(plan.md)* soft-deleted exclusion (list) | TC-USR-43 |
| *(plan.md)* sensitive-field whitelisting (list) | TC-USR-44 |
| *(qc-checklist CM07)* JWT present-but-invalid-signature | TC-USR-47, TC-USR-48 |
| *(qc-checklist CM08/E07)* UI hides admin-only entry points from `member` | TC-USR-49, TC-USR-50 |

Every `S-USR-*` scenario in `spec.md` has at least one TC — no scenario is missed.

---

## US-01: Invite a User

**ID:** TC-USR-01
**Type:** e2e
**Layer:** handler
**Title:** Admin invites a new, unregistered email — happy path
**Preconditions:** Authenticated as an admin (`role=admin`, `status=active`); `homer@example.com` has no row in `users`
**Steps:**
1. `POST /admin/users/invite` with `{ "email": "homer@example.com" }` (no `role` — should default)
2. Query `users` table for `email='homer@example.com'`
**Expected:** `201`; response body `{ user_id, email: "homer@example.com", status: "pending", invite_expires_at }`; DB row has `status='pending'`, `role='member'`, `invite_token` is a 64-char hex string (32 bytes), `invite_expires_at` ≈ `NOW()+72h` (±5s tolerance)
**Priority:** P1

**ID:** TC-USR-02
**Type:** unit
**Layer:** service
**Title:** Invite rejected when email already exists with `status=active`
**Preconditions:** A user row exists with `email='homer@example.com'`, `status='active'`
**Steps:** Call `UserService.InviteUser(adminID, "homer@example.com", "member")`
**Expected:** Returns `EmailAlreadyExists` error; no new row inserted; no email dispatched
**Priority:** P1

**ID:** TC-USR-03
**Type:** unit
**Layer:** service
**Title:** Invite rejected when email already exists with `status=pending`
**Preconditions:** A user row exists with `email='homer@example.com'`, `status='pending'`
**Steps:** Call `UserService.InviteUser(adminID, "homer@example.com", "member")`
**Expected:** Returns `EmailAlreadyExists` error — **no fresh token generated, no email re-sent** (spec explicitly forbids silent resend)
**Priority:** P1

**ID:** TC-USR-04
**Type:** unit
**Layer:** handler
**Title:** Invite rejected for malformed email
**Preconditions:** None
**Steps:** `POST /admin/users/invite` with `{ "email": "not-an-email" }`
**Expected:** `400`, `error_code=INVALID_INPUT`; no DB row created
**Priority:** P1

**ID:** TC-USR-05
**Type:** unit
**Layer:** handler
**Title:** Invite rejected for invalid `role` enum value
**Preconditions:** None
**Steps:** `POST /admin/users/invite` with `{ "email": "homer@example.com", "role": "superuser" }`
**Expected:** `400`, `error_code=INVALID_INPUT`; no DB row created
**Priority:** P1

**ID:** TC-USR-06
**Type:** unit
**Layer:** handler
**Title:** Invite rejected when `email` field is missing entirely
**Preconditions:** None
**Steps:** `POST /admin/users/invite` with `{}`
**Expected:** `400`, `error_code=INVALID_INPUT`
**Priority:** P2

**ID:** TC-USR-07
**Type:** integration
**Layer:** handler
**Title:** Invite rejected when caller has no JWT
**Preconditions:** None
**Steps:** `POST /admin/users/invite` with a valid body, no `Authorization` header
**Expected:** `401`
**Priority:** P1

**ID:** TC-USR-08
**Type:** integration
**Layer:** handler
**Title:** Invite rejected for expired JWT
**Preconditions:** A JWT signed with `exp` in the past
**Steps:** `POST /admin/users/invite` with `Authorization: Bearer <expired>`
**Expected:** `401`
**Priority:** P1

**ID:** TC-USR-09
**Type:** integration
**Layer:** handler
**Title:** Invite rejected when caller role is `member`
**Preconditions:** Authenticated as `role=member`
**Steps:** `POST /admin/users/invite` with a valid body
**Expected:** `403`, `error_code=FORBIDDEN`; no DB row created
**Priority:** P1

**ID:** TC-USR-10
**Type:** integration
**Layer:** handler
**Title:** 21st invite from the same admin in the rolling hour is rate-limited
**Preconditions:** The same admin has successfully sent 20 invites within the past 60 minutes
**Steps:** Send a 21st `POST /admin/users/invite` with a new unique email
**Expected:** `429`, `error_code=RATE_LIMITED`; no DB row created for the 21st request
**Priority:** P1

**ID:** TC-USR-11
**Type:** integration
**Layer:** handler
**Title:** Rate limit is scoped per admin, not global
**Preconditions:** Admin A has sent 20 invites this hour; Admin B has sent 0
**Steps:** Admin B sends `POST /admin/users/invite`
**Expected:** `201` — Admin B is unaffected by Admin A's rate-limit consumption
**Priority:** P2

**ID:** TC-USR-12
**Type:** unit
**Layer:** service
**Title:** Invite creation succeeds even when the email dispatch fails
**Preconditions:** `EmailSender` mock configured to return an error/timeout
**Steps:** Call `UserService.InviteUser(...)` with the failing sender injected
**Expected:** User row is still created with `status='pending'`; method returns success (`201` at the handler level); the send failure is logged, not returned to the caller
**Priority:** P1

**ID:** TC-USR-13
**Type:** unit
**Layer:** service
**Title:** Invite token is generated via `crypto/rand`, not a UUID
**Preconditions:** None
**Steps:** Generate 1,000 invite tokens via the token-generation helper; inspect format
**Expected:** Every token is a 64-character lowercase hex string (32 random bytes); none match UUID v4 format (`8-4-4-4-12` with version/variant nibbles); no collisions across the 1,000 samples
**Priority:** P1

**ID:** TC-USR-14
**Type:** integration
**Layer:** repository
**Title:** `invite_expires_at` is set to approximately `NOW() + 72h`
**Preconditions:** None
**Steps:** Call `CreatePendingUser`; read back `invite_expires_at`
**Expected:** `invite_expires_at - created_at` is between 71h59m and 72h01m
**Priority:** P2

**ID:** TC-USR-15
**Type:** integration
**Layer:** repository, race
**Title:** Two admins concurrently invite the exact same new email — only one succeeds
**Preconditions:** `email='race@example.com'` has no existing row; two goroutines fire `InviteUser` for it at the same instant
**Steps:** Run both calls concurrently (e.g. via a `sync.WaitGroup` releasing both at once); inspect results and final DB state
**Expected:** Exactly one call returns `201`; the other returns `409 EMAIL_ALREADY_EXISTS` (either via the service's pre-check losing the race and then hitting the DB's `UNIQUE(email)` constraint, or via the constraint violation being mapped to `409`); exactly one row exists for that email afterward
**Priority:** P1 — never skip this per QC race-condition rules

**ID:** TC-USR-16
**Type:** integration
**Layer:** repository
**Title:** ⚠️ Soft-deleted user permanently blocks re-invite of the same email
**Preconditions:** A user row exists with `email='ghost@example.com'`, `deleted_at IS NOT NULL`
**Steps:** `POST /admin/users/invite` with `{ "email": "ghost@example.com" }`
**Expected (as currently designed):** Fails — either the service's duplicate check (which per `spec.md` checks "any status", not filtered by `deleted_at`) returns `409`, or if the check were changed to filter `deleted_at IS NULL`, the plain `UNIQUE(email)` constraint on `users.email` (per `docs/features.md`'s schema, no partial index excluding soft-deleted rows) would still throw a constraint violation.
**This is a design gap, not a passing assertion** — see Coverage Analysis below. This test should be written to *document* current behavior and re-run once the schema/service decision is made explicit.
**Priority:** P1 (data-integrity/usability gap)

**ID:** TC-USR-17
**Type:** unit
**Layer:** service
**Title:** Invite token never appears in application logs
**Preconditions:** Log capture/spy attached to the Zap logger
**Steps:** Call `InviteUser` successfully; inspect all captured log entries
**Expected:** No log entry contains the raw `invite_token` value in any field
**Priority:** P1 (security)

---

## US-02: Activate Account

**ID:** TC-USR-18
**Type:** e2e
**Layer:** handler
**Title:** Activation succeeds with a valid, unexpired, unused token
**Preconditions:** A user row with `status='pending'`, `invite_token='abc123...'`, `invite_expires_at` in the future
**Steps:** `POST /auth/activate` with `{ token, full_name: "Homer", password: "correcthorse1", password_confirm: "correcthorse1" }`
**Expected:** `200`; response contains `user` (with `status='active'`), `access_token`, `refresh_token`; DB row now has `status='active'`, `password_hash` set (bcrypt), `activated_at` set, `invite_token=NULL`, `invite_expires_at=NULL`
**Priority:** P1

**ID:** TC-USR-19
**Type:** integration
**Layer:** service
**Title:** Activation rejected for a token that matches no user
**Preconditions:** None
**Steps:** `POST /auth/activate` with a random 64-char hex token
**Expected:** `404`
**Priority:** P1

**ID:** TC-USR-20
**Type:** integration
**Layer:** service
**Title:** Activation rejected for an already-consumed token
**Preconditions:** A user row already activated, so `invite_token IS NULL`; the client still has the original (now-stale) token value cached
**Steps:** `POST /auth/activate` with the stale token value
**Expected:** `404` (not a distinct "already used" code — matches spec's intent to not leak activation state)
**Priority:** P1

**ID:** TC-USR-21
**Type:** integration
**Layer:** service
**Title:** Activation rejected for an expired token
**Preconditions:** A user row with `status='pending'`, `invite_expires_at` in the past
**Steps:** `POST /auth/activate` with that token
**Expected:** `410`, `error_code=TOKEN_EXPIRED`
**Priority:** P1

**ID:** TC-USR-22
**Type:** unit
**Layer:** handler
**Title:** Activation rejected for a password under 8 characters
**Preconditions:** A valid pending invite
**Steps:** `POST /auth/activate` with `password: "short1"` (6 chars), matching confirm
**Expected:** `400`, `error_code=WEAK_PASSWORD`
**Priority:** P1

**ID:** TC-USR-23
**Type:** unit
**Layer:** handler
**Title:** Activation rejected when `password` field is omitted entirely
**Preconditions:** A valid pending invite
**Steps:** `POST /auth/activate` with `{ token, full_name }` — no `password` or `password_confirm` keys
**Expected:** `400`, `error_code=INVALID_INPUT` (distinct code from the too-short case above)
**Priority:** P1

**ID:** TC-USR-24
**Type:** unit
**Layer:** handler
**Title:** Activation rejected when `token` field is omitted
**Preconditions:** None
**Steps:** `POST /auth/activate` with `{ password: "correcthorse1", password_confirm: "correcthorse1" }`
**Expected:** `400`, `error_code=INVALID_INPUT`
**Priority:** P2

**ID:** TC-USR-25
**Type:** unit
**Layer:** service
**Title:** Activation rejected when password and confirmation don't match
**Preconditions:** A valid pending invite
**Steps:** `POST /auth/activate` with `password: "correcthorse1"`, `password_confirm: "correcthorse2"`
**Expected:** `400`, `error_code=PASSWORD_MISMATCH`
**Priority:** P1

**ID:** TC-USR-26
**Type:** integration
**Layer:** repository, race
**Title:** ⚠️ Two concurrent activation requests with the identical token — exactly one succeeds
**Preconditions:** A single user row with `status='pending'`, valid unexpired `invite_token`
**Steps:** Fire two `POST /auth/activate` requests with the identical token and identical valid passwords at the same instant (released together via a barrier); inspect both responses and final DB state
**Expected:** Exactly one request receives `200` with tokens; the other receives `404` (its `UPDATE` affected 0 rows because the first request's `UPDATE` already flipped `status` to `active`); exactly one activation is recorded (`activated_at` set once, not twice); no partial/duplicate state
**Priority:** P1 — never skip this per QC race-condition rules (this is *the* named race condition in the QC agent's own project context)

**ID:** TC-USR-27
**Type:** unit
**Layer:** service
**Title:** Password is hashed with bcrypt cost factor 12
**Preconditions:** None
**Steps:** Call the activation path with password `"correcthorse1"`; inspect the stored `password_hash`
**Expected:** `bcrypt.Cost(hash)` returns `12`; `bcrypt.CompareHashAndPassword(hash, "correcthorse1")` succeeds
**Priority:** P1

**ID:** TC-USR-28
**Type:** integration
**Layer:** service
**Title:** Successful activation issues correctly-scoped tokens
**Preconditions:** A valid pending invite
**Steps:** Activate; decode the returned `access_token` and `refresh_token` JWTs
**Expected:** `access_token.exp - iat ≈ 15 minutes`; `refresh_token.exp - iat ≈ 7 days`; both tokens' `sub` claim equals the newly-activated user's ID
**Priority:** P1

**ID:** TC-USR-29
**Type:** unit
**Layer:** service
**Title:** Raw password and invite token never appear in logs during activation, including on failure
**Preconditions:** Log capture attached
**Steps:** Trigger both a successful activation and a `PASSWORD_MISMATCH` failure; inspect all log entries from both runs
**Expected:** No log entry contains the raw password or the raw invite token in any field
**Priority:** P1 (security)

**ID:** TC-USR-30
**Type:** integration
**Layer:** service
**Title:** `full_name` is optional — activation succeeds without it
**Preconditions:** A valid pending invite
**Steps:** `POST /auth/activate` omitting `full_name`
**Expected:** `200`; DB row has `full_name IS NULL`
**Priority:** P2

**ID:** TC-USR-31
**Type:** e2e
**Layer:** flutter
**Title:** Activation screen shows an inline error for a weak password without navigating away
**Preconditions:** App on the Activate Account screen with a valid token pre-filled from a deep link
**Steps:** Enter a 6-character password, tap Submit
**Expected:** The `400 WEAK_PASSWORD` response renders as an inline field error (`Key('text-activate-error')`); the screen does not navigate to home
**Priority:** P2

**ID:** TC-USR-32
**Type:** unit
**Layer:** flutter
**Title:** Activation provider does not persist tokens to secure storage before the server responds
**Preconditions:** `ProviderContainer` with a mocked `AuthRepository.activate()` that never resolves (simulated slow network) and a mocked `flutter_secure_storage`
**Steps:** Trigger the activate action; assert on the secure-storage mock before the future resolves
**Expected:** The mocked secure storage's write method has **not** been called yet — tokens are only persisted after a `200` is actually received (per spec's "no auto-login pre-confirmation" edge case)
**Priority:** P2

---

## US-03: List Users

**ID:** TC-USR-33
**Type:** e2e
**Layer:** handler
**Title:** List users with no filters — happy path
**Preconditions:** Authenticated as admin; at least 3 users exist with mixed statuses/roles
**Steps:** `GET /admin/users`
**Expected:** `200`; `data` contains all non-deleted users; `pagination.total` matches the actual count
**Priority:** P1

**ID:** TC-USR-34
**Type:** integration
**Layer:** repository
**Title:** Filter by `status=pending` returns only pending users
**Preconditions:** Users exist with `status` in `{pending, active, disabled}`
**Steps:** `GET /admin/users?status=pending`
**Expected:** `200`; every row in `data` has `status='pending'`
**Priority:** P1

**ID:** TC-USR-35
**Type:** integration
**Layer:** repository
**Title:** Filter by `role=admin` returns only admins
**Preconditions:** Users exist with both roles
**Steps:** `GET /admin/users?role=admin`
**Expected:** `200`; every row in `data` has `role='admin'`
**Priority:** P1

**ID:** TC-USR-36
**Type:** integration
**Layer:** handler
**Title:** Filters that match zero users return an empty list, not an error
**Preconditions:** No `disabled` users exist
**Steps:** `GET /admin/users?status=disabled`
**Expected:** `200`; `data: []`; `pagination.next_cursor: null`
**Priority:** P2

**ID:** TC-USR-37
**Type:** integration
**Layer:** handler
**Title:** List rejected when caller role is `member`
**Preconditions:** Authenticated as `role=member`
**Steps:** `GET /admin/users`
**Expected:** `403`, `error_code=FORBIDDEN`
**Priority:** P1

**ID:** TC-USR-38
**Type:** integration
**Layer:** handler
**Title:** List rejected when caller has no JWT
**Preconditions:** None
**Steps:** `GET /admin/users` with no `Authorization` header
**Expected:** `401`
**Priority:** P1

**ID:** TC-USR-39
**Type:** unit
**Layer:** handler
**Title:** List rejected for an invalid `status` filter value
**Preconditions:** None
**Steps:** `GET /admin/users?status=unknown`
**Expected:** `400`, `error_code=INVALID_INPUT`
**Priority:** P1

**ID:** TC-USR-40
**Type:** unit
**Layer:** handler
**Title:** List rejected for an invalid `role` filter value
**Preconditions:** None
**Steps:** `GET /admin/users?role=superuser`
**Expected:** `400`, `error_code=INVALID_INPUT`
**Priority:** P2

**ID:** TC-USR-41
**Type:** integration
**Layer:** repository
**Title:** Cursor pagination returns the next page correctly and terminates
**Preconditions:** 25 users exist, no filters applied
**Steps:** `GET /admin/users?limit=20`, then `GET /admin/users?limit=20&cursor=<next_cursor from step 1>`
**Expected:** First page returns 20 rows and a non-null `next_cursor`; second page returns the remaining 5 rows with `next_cursor: null`; no row appears on both pages; combined pages equal the full 25-user set ordered by `created_at DESC, id DESC`
**Priority:** P1

**ID:** TC-USR-42
**Type:** unit
**Layer:** handler
**Title:** `limit` beyond the documented maximum
**Preconditions:** None
**Steps:** `GET /admin/users?limit=500`
**Expected:** **Undefined by spec.md/plan.md** — spec only states "Max 100" without saying whether an over-limit value is clamped to 100 or rejected with `400`. Write this test once that's decided; until then it's a documented gap, not a passing assertion.
**Priority:** P3 (spec gap)

**ID:** TC-USR-43
**Type:** integration
**Layer:** repository
**Title:** Soft-deleted users never appear in the list, with or without filters
**Preconditions:** A user exists with `deleted_at IS NOT NULL`
**Steps:** `GET /admin/users` (no filters); `GET /admin/users?status=<that user's pre-delete status>`
**Expected:** The soft-deleted user appears in neither response
**Priority:** P1

**ID:** TC-USR-44
**Type:** unit
**Layer:** service
**Title:** Response never serializes `password_hash`, `invite_token`, or `invite_expires_at`
**Preconditions:** A user row with all three fields populated (a pending invite)
**Steps:** Call `ListUsers`; inspect the serialized JSON response
**Expected:** None of `password_hash`, `invite_token`, `invite_expires_at` appear anywhere in the response body, for any row — including the caller's own admin row
**Priority:** P1 (security)

**ID:** TC-USR-45
**Type:** unit
**Layer:** flutter
**Title:** User list screen renders the empty-state widget when `data` is `[]`
**Preconditions:** Mocked repository returns an empty list
**Steps:** Build `UserListPage` via `ProviderContainer` override; pump the widget
**Expected:** `Key('text-users-empty')` is present; `Key('list-users')`'s item builder renders zero items
**Priority:** P2

**ID:** TC-USR-46
**Type:** unit
**Layer:** flutter
**Title:** User list screen renders the loading state before data arrives
**Preconditions:** Mocked repository future that has not yet resolved
**Steps:** Pump the widget immediately after triggering the fetch, before resolving the future
**Expected:** `Key('loading-users-list')` is present; `Key('list-users')` is not yet rendered
**Priority:** P3

---

## Cross-Cutting Additions (from `/qc-checklist` review)

> These four cases surfaced from applying the checklist's genuinely stack-agnostic principles (CM07: all 4 token states; CM08/E07: UI must hide, not just block). Placed here rather than renumbered into their originating story's block, to avoid a full renumber of TC-USR-09 through TC-USR-46.

**ID:** TC-USR-47
**Type:** integration
**Layer:** handler
**Title:** Invite rejected for a structurally valid but tampered/invalid-signature JWT
**Preconditions:** A JWT with a well-formed header/payload but a signature that doesn't verify against the server's signing key (e.g. signed with a different key, or a single byte flipped in the signature)
**Steps:** `POST /admin/users/invite` with `Authorization: Bearer <tampered>`
**Expected:** `401` — distinct code path from TC-USR-08 (expired) and TC-USR-07 (absent); confirms `JWTAuth()` verifies the signature, not just parses the token structure and expiry
**Priority:** P1 (security) — belongs to US-01

**ID:** TC-USR-48
**Type:** integration
**Layer:** handler
**Title:** List Users rejected for a structurally valid but tampered/invalid-signature JWT
**Preconditions:** Same tampered JWT as TC-USR-47
**Steps:** `GET /admin/users` with `Authorization: Bearer <tampered>`
**Expected:** `401`
**Priority:** P1 (security) — belongs to US-03

**ID:** TC-USR-49
**Type:** unit
**Layer:** flutter
**Title:** A `member`-role user does not see the Invite User entry point anywhere in the app
**Preconditions:** `ProviderContainer` overridden with an auth state where the current user's `role='member'`
**Steps:** Pump the app's main navigation/home widget tree for a `member` session
**Expected:** No widget with `Key('btn-invite-submit')` or an equivalent "Invite User" navigation entry is present in the tree — the feature is absent from the UI, not merely disabled/greyed out, and not just blocked at the API layer (TC-USR-09 already covers the API block; this covers the UI-hiding requirement separately, per defense-in-depth)
**Priority:** P2 — belongs to US-01

**ID:** TC-USR-50
**Type:** unit
**Layer:** flutter
**Title:** A `member`-role user does not see the User Management (list) entry point anywhere in the app
**Preconditions:** Same as TC-USR-49
**Steps:** Pump the app's main navigation/home widget tree for a `member` session
**Expected:** No navigation entry point to `UserListPage` is present in the tree for a `member` session (API-level block already covered by TC-USR-37)
**Priority:** P2 — belongs to US-03

---

## Coverage Analysis

| Area | Status | Note |
|------|--------|------|
| Happy path, all 3 stories | ✅ Covered | TC-USR-01, 18, 33 |
| Every documented validation rule | ✅ Covered | One test per rule, not combined (TC-USR-04/05/06/22/23/24/25/39/40) |
| Auth: unauthenticated → 401 | ✅ Covered | TC-USR-07/08, 38 |
| Auth: wrong role → 403 | ✅ Covered | TC-USR-09, 37 |
| Not found → 404 | ✅ Covered | TC-USR-19, 20 |
| Ownership violation → 403 | N/A | No per-user-owned resource in this feature (admin-gate is the only authz boundary) |
| Duplicate/conflict → 409 | ✅ Covered | TC-USR-02, 03 |
| Rate limit → 429 | ✅ Covered | TC-USR-10, 11 |
| Concurrent/race condition | ✅ Covered | TC-USR-15 (invite), **TC-USR-26 (activation — the QC agent's explicitly named "never skip" race)** |
| DB transaction rollback (multi-table) | N/A | No operation in this feature touches more than one table |
| Boundary values | ⚠️ Partial | Email/full_name max-length boundaries are **untestable as written** — neither `spec.md` nor `plan.md` defines a max length. `limit` over-max behavior (TC-USR-42) is similarly undefined. Flagging rather than guessing a number. |
| **Design gap found during test authoring** | ⚠️ **New finding** | TC-USR-16: a soft-deleted user's email permanently blocks re-invite, because `users.email` has a plain `UNIQUE` constraint (per `docs/features.md`'s schema) with no partial index excluding `deleted_at IS NOT NULL` rows. Recommend raising with BA/dev before Phase 0 sign-off — either accept this as permanent (unlikely to be intended) or move to a partial unique index `WHERE deleted_at IS NULL`. |
| Login/Logout Flutter flow | Not applicable to this file | Out of scope for F-01 — see [security/test_cases.md](../security/test_cases.md) |
| JWT token states (valid/invalid/expired/absent) | ✅ Covered | Valid (TC-USR-01/33 happy paths), absent (TC-USR-07/38), expired (TC-USR-08), invalid signature (**TC-USR-47/48**, added per `/qc-checklist`) |
| UI hides admin-only actions from `member` (not just API-blocks them) | ✅ Covered | **TC-USR-49/50, added per `/qc-checklist`** |

### `/qc-checklist` review notes

`.claude/commands/qc-checklist.md` is written for a different project's stack — Playwright/TypeScript E2E specs, a seeded `ADMIN/HR/FA/PM/DM` role table, Vietnamese UI error copy, a `constitution.md` file, and a `testing/[feature]/test_[id].spec.ts` convention. None of that exists in PFM. Applied as follows:

- **GP03** (`constitution.md` must exist) technically fails — this repo has `CLAUDE.md` instead, which serves the same role (codebase conventions checked into the repo). Treated as satisfied by substitution rather than stopping the review, since the file's *purpose* (a project-conventions source of truth) is met.
- **Seeded Data / UI Error Messages sections**: N/A — PFM has no `HR/FA/PM/DM` roles (only `admin`/`member`) and no Vietnamese UI copy anywhere in `spec.md`/`plan.md`; fabricating either would contradict the actual spec, which the checklist's own document-priority rule (`spec.md` > `plan.md` > ... ) says wins.
- **IT02** (validation errors → `[400, 422]`): PFM's `spec.md` establishes `400 INVALID_INPUT` as the sole validation-error convention throughout; `422` is never used anywhere in this project. Kept `400` per `spec.md` priority, did not add `422`.
- **Playwright Code section**: N/A — this repo has no Playwright, no `testing/` directory; PFM's actual test conventions are Go (`testify`/`httptest`/`testcontainers-go`) and Flutter (`flutter_test`/`ProviderContainer`), per the `/qc` agent's own Go/Flutter Test Conventions.
- **File structure** (`Coverage Matrix` / `Integration Test Cases` / `E2E Test Cases` as three separate top-level sections): not adopted — this file stays organized by user story with a `Type`/`Layer` field per test case, per the `/qc` agent's own Test Case Format. A `Scenario Coverage Matrix` section was added above to satisfy the traceability *principle* (CM01) without the Playwright-oriented section split.
