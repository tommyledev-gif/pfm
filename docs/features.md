# PFM – Feature Specification

> Last updated: 2026-07-30  
> Scope: Phase 0 — 3 immediate features before any financial functionality

---

## Context & Design Note

The original SRS (US-01: Register a User) used a self-registration flow. This project replaces it with an **invite-only flow** — an admin invites users by email, users activate their account via a secure token link. This is more appropriate for a controlled personal finance app where data isolation between accounts is critical.

**Invite flow rationale:**
- No open registration → no spam accounts, no unauthorized data access
- Admin has full control over who accesses the system
- Activation step forces a real email address to be verified before access is granted

---

## Feature-01: User Management (Phase 0)

**Goal:** Allow an admin to onboard new users in a controlled, secure way. Users cannot self-register.

**Actors:**
- **Admin** — existing active user with `role = admin`
- **Visitor** — a person who received an invite email but has not yet activated

---

### US-01: Invite a User [MVP]

**As an Admin,**  
I want to invite a new user by email  
so that they can activate their account and access the system.

**API:** `POST /admin/users/invite`

**Preconditions:**
- Caller is authenticated with `role = admin`

**Main Flow:**

1. Admin enters an email address and optional role (default: `member`)
2. System validates email format
3. System checks email is not already registered
4. System creates a user record: `status = pending`
5. System generates a **cryptographically secure** invite token (`crypto/rand`, 32 bytes, hex-encoded)
6. System sets `invite_expires_at = NOW() + 72h`
7. System sends an activation email containing: `https://app.pfm.local/activate?token=<TOKEN>`
8. System returns `201` with `user_id`, `email`, `status`, `invite_expires_at`

**Scenarios:**

| Scenario | Input | Expected |
|----------|-------|----------|
| Happy path | Valid email not yet registered | 201; user created (pending); email sent |
| Invalid email format | `"not-an-email"` | 400 `INVALID_INPUT` |
| Email already registered (active) | Email exists with status=active | 409 `EMAIL_ALREADY_EXISTS` |
| Email already registered (pending) | Email exists with status=pending | 409 `EMAIL_ALREADY_EXISTS` (do NOT silently re-send — force admin to check) |
| Caller not admin | role=member calling this endpoint | 403 `FORBIDDEN` |
| Rate limit | > 20 invites/hour from same admin | 429 |

**Edge Cases:**
- Invite token must **not** be a UUID — UUIDs are not cryptographically random enough for security tokens
- Token stored in DB as-is (not hashed); if security requirement escalates, hash with SHA-256 at rest
- `invite_expires_at` is checked at activation time, not at invite time
- System must **not** expose whether an email exists or not through error timing differences (constant-time email check)

**Security Rules:**
- Rate limit: 20 invites/hour/admin (Fiber rate limiter middleware)
- Email sent via background task (non-blocking)
- Never log the raw invite token

---

### US-02: Activate Account [MVP]

**As a Visitor (invited user),**  
I want to activate my account by setting a password via the link I received  
so that I can log in and use the PFM application.

**API:** `POST /auth/activate`

**Preconditions:**
- Visitor received an invite email and has the token
- Token has not been used or expired

**Main Flow:**

1. Visitor opens activation link in mobile app (deep link: `pfm://activate?token=<TOKEN>`)
2. App shows Activate Account screen with fields: full name (optional), password, confirm password
3. Visitor fills in fields and submits
4. System looks up user by `invite_token`
5. System checks `status = pending` AND `invite_expires_at > NOW()`
6. System validates password strength and confirmation match
7. System hashes password with `bcrypt` (cost = 12)
8. System updates user: `status = active`, `password_hash = <hash>`, `activated_at = NOW()`, `invite_token = NULL`, `invite_expires_at = NULL`
9. System returns JWT access + refresh token pair + user object
10. App stores tokens in `flutter_secure_storage` and navigates to home screen

**Scenarios:**

| Scenario | Input | Expected |
|----------|-------|----------|
| Happy path | Valid token + strong password | 200; tokens returned; user status=active |
| Token not found | Random/invalid token | 404 |
| Token expired | Token older than 72h | 410 `TOKEN_EXPIRED` |
| Token already used | Token where `invite_token IS NULL` | 404 (token already cleared) |
| Password too short | < 8 chars | 400 `WEAK_PASSWORD` |
| Password mismatch | confirm ≠ password | 400 `PASSWORD_MISMATCH` |
| Concurrent activation | Two requests with same token simultaneously | Only first succeeds; second gets 404 (DB unique constraint clears token atomically) |

**Edge Cases:**
- Concurrent activation: use `UPDATE users SET invite_token = NULL WHERE invite_token = $token AND status = 'pending'` — if `rowsAffected = 0`, token was already consumed → 410
- No brute-force risk on this endpoint because tokens are 32-byte random (2^256 search space)
- Deep link must work even if app is not installed (fallback: web browser form for MVP)
- Do NOT auto-login before activation is confirmed at DB level

**Security Rules:**
- bcrypt cost = 12 (not lower)
- Activation is idempotent at the token level — same token cannot activate twice
- Clear `invite_token` in the same DB statement that sets `status = active` (atomic)

---

### US-03: List Users [MVP]

**As an Admin,**  
I want to see a list of all users with their status  
so that I can track who has activated their account and who hasn't.

**API:** `GET /admin/users`

**Preconditions:**
- Caller is authenticated with `role = admin`

**Main Flow:**

1. Admin opens User Management screen
2. App calls `GET /admin/users` with optional filters
3. System returns paginated list of users
4. Admin can filter by `status` (pending/active/disabled) and `role`

**Query parameters:**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `status` | string | — | pending \| active \| disabled |
| `role` | string | — | admin \| member |
| `cursor` | string | — | From `next_cursor` of previous response |
| `limit` | int | 20 | Max 100 |

**Scenarios:**

| Scenario | Input | Expected |
|----------|-------|----------|
| Happy path | No filters | 200; all users paginated |
| Filter by pending | `?status=pending` | 200; only pending users |
| Filter by role | `?role=admin` | 200; only admins |
| Empty result | All users filtered out | 200; `data: []`, `next_cursor: null` |
| Caller not admin | role=member | 403 |
| Invalid status filter | `?status=unknown` | 400 |

**Response shape:**
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

**Pagination — cursor-based (not offset):**
- Cursor encodes: `{id, created_at}` of the last item, base64 encoded
- Query: `WHERE created_at < $cursor_ts OR (created_at = $cursor_ts AND id < $cursor_id) ORDER BY created_at DESC, id DESC LIMIT $limit`
- `total` is an approximate count (`COUNT(*)` with filter) — acceptable for admin list

**Edge Cases:**
- Admin can see all users including other admins (but cannot see their own password hash — never returned in API)
- Soft-deleted users (`deleted_at IS NOT NULL`) are excluded by default
- `invite_token` and `invite_expires_at` are **never** returned in the API response

---

## Feature-02: System Security (Phase 0)

Included here because it is tightly coupled with the user management flow.

---

### US-04: Login [MVP]

**API:** `POST /auth/login`

**Main Flow:**
1. User submits email + password
2. System fetches user by email
3. System checks `status = active`
4. System verifies password with `bcrypt.CompareHashAndPassword`
5. System generates: access token (JWT, 15 min) + refresh token (JWT, 7 days)
6. Returns token pair

**Scenarios:**

| Scenario | Expected |
|----------|----------|
| Correct credentials, active user | 200 token pair |
| Wrong password | 401 `INVALID_CREDENTIALS` |
| Email not found | 401 `INVALID_CREDENTIALS` (same error — don't leak existence) |
| Status = pending (not yet activated) | 401 `ACCOUNT_NOT_ACTIVATED` |
| Status = disabled | 401 `ACCOUNT_DISABLED` |
| > 10 failed attempts / 15 min | 429 |

**Security:**
- Same error message for wrong-password and email-not-found (constant-time comparison)
- Rate limit: 10 attempts / 15 min / IP (Fiber rate limiter)
- Never log raw passwords

---

### US-05: Logout [MVP]

**API:** `POST /auth/logout`

Revoke the refresh token. Access tokens are short-lived (15 min) — they expire naturally. No access token revocation in MVP (acceptable for a personal app).

For MVP, refresh token revocation is tracked in a simple `revoked_tokens` table or Redis set (add Redis only if needed — can also use a DB table for MVP).

---

## Flutter Deep Link Setup (Activation Link)

go_router config for activation deep link:

```dart
GoRoute(
  path: '/activate',
  name: 'activate',
  builder: (context, state) {
    final token = state.uri.queryParameters['token'] ?? '';
    return ActivateAccountPage(token: token);
  },
),
```

App must declare deep link scheme in:
- `AndroidManifest.xml` → `intent-filter` for `pfm://activate`
- `Info.plist` → `CFBundleURLSchemes` → `pfm`

---

## DB Migration for Phase 0

**File:** `db/migrations/001_init.sql`

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

CREATE TABLE users (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email             TEXT NOT NULL UNIQUE,
    full_name         TEXT,
    password_hash     TEXT,
    status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'active', 'disabled')),
    role              TEXT NOT NULL DEFAULT 'member'
                      CHECK (role IN ('admin', 'member')),
    invited_by        UUID REFERENCES users(id),
    invite_token      TEXT UNIQUE,
    invite_expires_at TIMESTAMPTZ,
    activated_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_users_email        ON users(email);
CREATE INDEX idx_users_invite_token ON users(invite_token)
    WHERE invite_token IS NOT NULL;
CREATE INDEX idx_users_status       ON users(status)
    WHERE deleted_at IS NULL;
```

**File:** `db/migrations/002_seed_admin.sql`

```sql
-- Seed first admin user (password must be changed immediately)
-- Run manually; never in automated migration on production
INSERT INTO users (email, password_hash, status, role)
VALUES (
    'admin@pfm.local',
    '$2a$12$<bcrypt_hash_of_temp_password>',  -- replace with real hash
    'active',
    'admin'
);
```

---

## sqlc Queries for Phase 0

**File:** `db/queries/users.sql`

```sql
-- name: CreatePendingUser :one
INSERT INTO users (email, role, invited_by, invite_token, invite_expires_at)
VALUES ($1, $2, $3, $4, NOW() + INTERVAL '72 hours')
RETURNING *;

-- name: GetUserByInviteToken :one
SELECT * FROM users
WHERE invite_token = $1
  AND status = 'pending'
  AND deleted_at IS NULL
LIMIT 1;

-- name: ActivateUser :one
UPDATE users
SET
    full_name         = $2,
    password_hash     = $3,
    status            = 'active',
    invite_token      = NULL,
    invite_expires_at = NULL,
    activated_at      = NOW(),
    updated_at        = NOW()
WHERE invite_token = $1
  AND status = 'pending'
  AND invite_expires_at > NOW()
RETURNING *;

-- name: GetUserByEmail :one
SELECT * FROM users
WHERE email = $1
  AND deleted_at IS NULL
LIMIT 1;

-- name: GetUserByID :one
SELECT * FROM users
WHERE id = $1
  AND deleted_at IS NULL
LIMIT 1;

-- name: ListUsers :many
SELECT * FROM users
WHERE deleted_at IS NULL
  AND ($1::text = '' OR status = $1)
  AND ($2::text = '' OR role = $2)
ORDER BY created_at DESC, id DESC
LIMIT $3;

-- name: CountUsers :one
SELECT COUNT(*) FROM users
WHERE deleted_at IS NULL
  AND ($1::text = '' OR status = $1)
  AND ($2::text = '' OR role = $2);
```

---

## Test Cases to Cover (Phase 0)

| # | Test | Type |
|---|------|------|
| 1 | Invite valid email → user created with status=pending | Unit (service) |
| 2 | Invite existing email → 409 | Unit |
| 3 | Invite with non-admin caller → 403 | Unit |
| 4 | Activate with valid token → status=active, tokens returned | Integration |
| 5 | Activate with expired token → 410 | Integration |
| 6 | Activate with already-used token → 404 | Integration |
| 7 | Concurrent activation with same token → only 1 succeeds | Integration (race) |
| 8 | Activate with password < 8 chars → 400 | Unit |
| 9 | Login active user correct password → 200 | Integration |
| 10 | Login with wrong password → 401, same error as email-not-found | Integration |
| 11 | Login pending user → 401 `ACCOUNT_NOT_ACTIVATED` | Integration |
| 12 | List users as admin, filter by status=pending → correct subset | Integration |
| 13 | List users as member → 403 | Unit |
| 14 | Brute-force login > 10 attempts → 429 | Integration |