# Feature Spec: F-01 User Management (Phase 0)

> Source: `docs/features.md` (Feature-01)
> Status: Phase 0 — blocks all financial features
> Related: [F-02 System Security](../security/spec.md) (login/logout consume users created here)

## Context

PFM is an invite-only personal finance app — there is no public self-registration. An **Admin** (`role = admin`) is the only actor who can bring new users into the system. A newly invited person exists as a `pending` user record until they **activate** their account via a one-time secure link, at which point they set their password and become `active`. Admins also need visibility into the roster (who's pending vs. active) to manage onboarding.

This replaces the original SRS self-register flow (US-01) specifically because personal financial data isolation between accounts is a hard requirement — open registration would allow unauthorized account creation and increase attack surface for cross-user data leakage.

Actors:
- **Admin** — existing `status = active`, `role = admin` user
- **Visitor** — a person who received an invite email but has not yet activated

## Preconditions (feature-level)

- At least one seed admin exists in the DB (`002_seed_admin.sql`) — there is no "first admin" bootstrap flow in this spec.
- Email delivery mechanism is configured (SMTP or transactional email provider) — **see Open Questions**, not specified in this spec.
- `users` table exists per `db/migrations/001_init.sql`.

---

## US-01: Invite a User [MVP]

**As an** Admin,
**I want** to invite a new user by email,
**so that** they can activate their own account and access the system without me creating a password for them.

**API:** `POST /admin/users/invite`

### Preconditions
- Caller holds a valid access JWT with `role = admin`.
- Request body: `{ email: string, role?: "admin" | "member" }` (role defaults to `member`).

### Main Flow
1. Admin submits an email address and optional role.
2. System validates email format and, if provided, that role is one of the allowed enum values (handler-level shape validation).
3. System checks whether the email already exists in `users` (any status) — business rule, service-level.
4. System creates a `users` row with `status = pending`, `invited_by = <admin_id>`.
5. System generates a cryptographically secure invite token: `crypto/rand`, 32 bytes, hex-encoded (**not** UUID — insufficient entropy guarantees for a security token).
6. System sets `invite_expires_at = NOW() + 72h`.
7. System dispatches an activation email (background task, non-blocking) containing `https://app.pfm.local/activate?token=<TOKEN>`.
8. System returns `201` with `{ user_id, email, status, invite_expires_at }`.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-USR-01 | Caller is an authenticated admin; email `homer@example.com` is not registered | Admin calls `POST /admin/users/invite` with that email | `201`; user row created with `status=pending`; invite email queued | Happy path |
| S-USR-02 | Email string is `"not-an-email"` | Admin calls invite with that value | `400 INVALID_INPUT` | Client mistake — handler-level validation |
| S-USR-03 | `role` field is `"superuser"` (not a valid enum value) | Admin calls invite with that role | `400 INVALID_INPUT` | Client mistake — handler-level validation, same layer as S-USR-02 |
| S-USR-04 | Email already exists with `status=active` | Admin calls invite with that email | `409 EMAIL_ALREADY_EXISTS` | Business rule — service-level |
| S-USR-05 | Email already exists with `status=pending` | Admin calls invite with that email | `409 EMAIL_ALREADY_EXISTS` | Do **not** silently re-send; forces admin to explicitly resend (see Open Questions — no resend endpoint exists yet) |
| S-USR-06 | Caller JWT has `role=member` | Caller calls `POST /admin/users/invite` | `403 FORBIDDEN` | Authorization, not authentication, failure |
| S-USR-07 | Same admin has sent 20 invites in the past rolling hour | Admin sends a 21st invite | `429 RATE_LIMITED` | Fiber rate-limit middleware, keyed by admin user ID |
| S-USR-08 | Email service (SMTP/provider) is unreachable | Admin calls invite; user row is created successfully but the background email dispatch fails | `201` still returned (email is fire-and-forget); failure logged server-side | ⚠️ Assumption: user creation is **not** rolled back if email fails — see Open Questions on retry/alerting |

### Edge Cases
1. **Token type**: invite token must never be a UUID — UUIDs are not guaranteed cryptographically random; use `crypto/rand`.
2. **Token storage**: stored as plaintext in `invite_token` column (unique, indexed). If security posture escalates post-MVP, hash at rest (SHA-256) — explicitly deferred, not required for Phase 0.
3. **Expiry check timing**: `invite_expires_at` is evaluated at activation time, never at invite-send time (an already-expired invite is still returned `201` if created before expiry — expiry only matters at consumption).
4. **Enumeration protection**: the invite endpoint must not leak whether an email exists via response-time differences — comparison/lookup should run in constant time regardless of match.

### Definition of Done
- `POST /admin/users/invite` implemented with handler validation (email format, role enum) and service-level business rules (duplicate check, admin-only).
- Invite token generated via `crypto/rand` (Go `crypto/rand`, not `math/rand`, not `uuid.New()`).
- Rate limiter middleware applied (20/hour/admin).
- Raw invite token never appears in logs (Zap logger — redact or omit field).
- Unit tests for scenarios S-USR-02 through S-USR-07 pass. Integration tests for S-USR-01 and S-USR-08 pass.

### Idempotency
Not idempotent by design — repeated calls with the same email while `status=pending` return `409`, not a fresh token. There is no idempotency key on this endpoint (acceptable: admin-only, low-frequency, side-effect-visible failure mode already handled by the 409).

---

## US-02: Activate Account [MVP]

**As a** Visitor (invited user),
**I want** to activate my account by setting a password via the link I received,
**so that** I can log in and use the PFM application.

**API:** `POST /auth/activate`

### Preconditions
- Visitor possesses a valid, unexpired, unconsumed invite token.
- Request body: `{ token: string, full_name?: string, password: string, password_confirm: string }`.

### Main Flow
1. Visitor opens the activation deep link in the mobile app (`pfm://activate?token=<TOKEN>`), or a web fallback form for MVP if the app is not installed.
2. App shows an Activate Account screen (full name optional, password, confirm password).
3. Visitor submits the form.
4. System looks up the user by `invite_token`.
5. System checks `status = pending` AND `invite_expires_at > NOW()`.
6. System validates that `token`, `password`, and `password_confirm` are all present, that password meets the strength policy (min 8 chars), and that `password == password_confirm` (handler-level shape validation).
7. System hashes the password with bcrypt, cost factor 12.
8. System atomically updates the user row: `status = active`, `password_hash = <hash>`, `activated_at = NOW()`, `invite_token = NULL`, `invite_expires_at = NULL` — single `UPDATE ... WHERE invite_token = $token AND status = 'pending'` statement.
9. System issues a JWT access token (15 min) + refresh token (7 days; since 2026-10-19 a session that lasts 60 days unused and at most 180 days — see [mobile-account-switch](../mobile-account-switch/spec.md)) and returns them with the user object.
10. App stores tokens in `flutter_secure_storage` and navigates to the home screen.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-USR-09 | Token exists, `status=pending`, not expired; password meets policy and matches confirmation | Visitor submits activation form | `200`; `status→active`; access+refresh tokens returned | Happy path |
| S-USR-10 | Token does not match any user | Visitor submits with a random/garbage token | `404 NOT_FOUND` | Validation error (client mistake) |
| S-USR-11 | Token matches a user but `invite_expires_at < NOW()` | Visitor submits with an expired token | `410 TOKEN_EXPIRED` | ⚠️ No self-service recovery — visitor must ask admin to re-invite (see Open Questions) |
| S-USR-12 | Token matches a user but `invite_token IS NULL` (already consumed) | Visitor resubmits an already-used token | `404 NOT_FOUND` | Same code as "not found" — do not distinguish, to avoid leaking activation state |
| S-USR-13 | Password is 7 characters | Visitor submits | `400 WEAK_PASSWORD` | Validation error |
| S-USR-14 | `password` field is omitted entirely from the request body | Visitor submits a form with no password set | `400 INVALID_INPUT` | Required-field validation, distinct from S-USR-13 (present-but-too-weak) |
| S-USR-15 | `password != password_confirm` | Visitor submits | `400 PASSWORD_MISMATCH` | Validation error |
| S-USR-16 | Two requests carrying the identical valid token arrive concurrently | Both hit the service near-simultaneously | Exactly one receives `200`; the other receives `404 NOT_FOUND` (its `UPDATE` affected 0 rows) | ⚠️ Data-integrity critical — see Edge Cases |

### Edge Cases
1. **Concurrency**: the activation `UPDATE` must be the sole source of truth for "did this succeed" — check `rowsAffected`; if `0`, token was already consumed by a racing request → return `404`. Do not do a separate `SELECT` then `UPDATE` (TOCTOU race).
2. **Brute force is out of scope**: 32-byte random tokens (2^256 space) make guessing infeasible — no rate limiting is required specifically on this endpoint for that reason (still subject to general API rate limiting if configured).
3. **Deep link without app installed**: MVP fallback is a web browser form; native app deep-linking behavior (Android intent-filter, iOS `CFBundleURLSchemes`) is a mobile UI concern, tracked separately from this backend spec.
4. **No auto-login pre-confirmation**: the client must not consider the user logged in until the `200` response with tokens is received — never optimistically navigate to home on form submit alone.

### Definition of Done
- `POST /auth/activate` implemented; single atomic `UPDATE` used for state transition (matches `ActivateUser` sqlc query).
- bcrypt cost = 12 enforced (not configurable lower).
- Concurrent-activation race test (S-USR-16) passes.
- Unit tests for scenarios S-USR-10 through S-USR-15 pass. Integration test for S-USR-09 passes.
- Raw password and invite token never logged.

### Idempotency
Idempotent **at the token level** by construction: the token is single-use (cleared atomically on success), so replay of the same request after success returns `404`, never a duplicate activation.

---

## US-03: List Users [MVP]

**As an** Admin,
**I want** to see a list of all users with their status,
**so that** I can track who has activated their account and who hasn't.

**API:** `GET /admin/users`

### Preconditions
- Caller holds a valid access JWT with `role = admin`.

### Main Flow
1. Admin opens the User Management screen.
2. App calls `GET /admin/users` with optional query filters.
3. System returns a cursor-paginated list of users matching the filters.
4. Admin can filter by `status` (`pending`/`active`/`disabled`) and `role` (`admin`/`member`).

### Query Parameters

| Param | Type | Default | Notes |
|---|---|---|---|
| `status` | string | — | `pending` \| `active` \| `disabled` |
| `role` | string | — | `admin` \| `member` |
| `cursor` | string | — | Opaque, from `pagination.next_cursor` of the previous response |
| `limit` | int | 20 | Max 100 |

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-USR-17 | No filters applied | Admin calls `GET /admin/users` | `200`; all non-deleted users, paginated | Happy path |
| S-USR-18 | `?status=pending` | Admin calls with the filter | `200`; only `status=pending` rows | |
| S-USR-19 | `?role=admin` | Admin calls with the filter | `200`; only `role=admin` rows | |
| S-USR-20 | Filters match zero rows | Admin calls with a combination that excludes everyone | `200`; `data: []`, `next_cursor: null` | Not a 404 — empty list is a valid result |
| S-USR-21 | Caller JWT has `role=member` | Caller calls `GET /admin/users` | `403 FORBIDDEN` | |
| S-USR-22 | `?status=unknown` | Admin calls with an invalid enum value | `400 INVALID_INPUT` | Handler-level validation |

### Response Shape
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "homer@example.com",
      "full_name": "Homer Truong",
      "status": "active",
      "role": "member",
      "activated_at": "2026-07-30T10:00:00Z",
      "created_at": "2026-07-29T09:00:00Z"
    }
  ],
  "pagination": {
    "next_cursor": "eyJpZCI6...",
    "total": 42
  }
}
```

### Edge Cases
1. **Cursor construction**: cursor encodes `{id, created_at}` of the last item, base64-encoded; query is `WHERE created_at < $cursor_ts OR (created_at = $cursor_ts AND id < $cursor_id) ORDER BY created_at DESC, id DESC LIMIT $limit`.
2. **`total` is approximate**: a plain `COUNT(*)` with the same filter — acceptable staleness for an admin-facing list (not used for financial reconciliation).
3. **Field redaction**: `password_hash`, `invite_token`, `invite_expires_at` must never appear in this response, for any user including the caller's own admin row.
4. **Soft-deleted exclusion**: rows with `deleted_at IS NOT NULL` are excluded unconditionally — no filter parameter exposes them in this endpoint.

### Definition of Done
- `GET /admin/users` implemented with cursor pagination matching `ListUsers`/`CountUsers` sqlc queries.
- Response DTO explicitly whitelists fields (no struct-level "return everything" serialization) so token/hash fields cannot leak by omission-of-exclusion.
- Unit tests for scenarios S-USR-18 through S-USR-22 pass. Integration test for S-USR-17 passes.
- Unit test asserts `invite_token` and `password_hash` are absent from serialized response even when populated in the DB row.

### Idempotency
N/A — read-only (`GET`), naturally idempotent.

---

## Out of Scope (Feature F-01)

- Self-registration (explicitly replaced by invite-only flow).
- Resending an invite to a `pending` user (current behavior is a hard `409`; no resend/reset endpoint exists in this spec).
- Revoking/cancelling a pending invite before expiry.
- Disabling/re-enabling a user (`status = disabled` is a valid enum value and is checked at login, but no API to set it is defined here).
- Editing a user's own or another user's profile (`full_name`, `email`, `role` changes post-activation).
- Bulk invite (CSV/batch import).
- "First admin" bootstrap flow — handled by manual SQL seed (`002_seed_admin.sql`), not an API.
- Password reset / forgot password for already-active users (belongs to F-02, not covered there either — see Open Questions in that spec).

## Open Questions

1. **Invite resend recovery path**: if an admin needs to resend because the visitor lost the email or the token expired, there's currently no endpoint — must the admin wait, or should a `POST /admin/users/{id}/resend-invite` be added? *(Product/tech input needed before Phase 0 sign-off.)*
2. **Email delivery provider**: SMTP vs. a transactional API (SendGrid/SES/etc.) is unspecified — affects the background-task implementation in `ai-service`/backend and failure-handling/retry behavior for S-USR-08.
3. **Disabling a user**: schema supports `status=disabled` and login rejects it, but no API creates that state. Is this in Phase 0 scope or deferred?
4. **Email failure alerting**: if invite-email dispatch fails after the user row is already created (S-USR-08), should there be a retry queue, an admin-visible "email failed" flag, or is silent server-log-only failure acceptable for MVP?
5. **Full name enforcement**: `full_name` is optional at activation (US-02 step 2) — should it become mandatory before first login, or is a null/empty name acceptable indefinitely?
