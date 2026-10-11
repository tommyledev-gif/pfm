-- name: CreatePendingUser :one
INSERT INTO users (email, role, invited_by, invite_token, invite_expires_at, invite_sent_at)
VALUES ($1, $2, $3, $4, NOW() + INTERVAL '72 hours', NOW())
RETURNING *;

-- name: GetUserByInviteToken :one
SELECT * FROM users
WHERE invite_token = $1
  AND status = 'pending'
  AND deleted_at IS NULL
LIMIT 1;

-- name: ActivateUser :one
-- Conditional UPDATE is the optimistic-concurrency check itself: if two requests
-- race for the same token, only one matches "status = 'pending'" and updates a
-- row. The other affects zero rows (returns no rows -> pgx.ErrNoRows).
UPDATE users
SET
    full_name         = $2,
    password_hash     = $3,
    username          = $4,
    status            = 'active',
    invite_token      = NULL,
    invite_expires_at = NULL,
    activated_at      = NOW(),
    updated_at        = NOW()
WHERE invite_token = $1
  AND status = 'pending'
  AND invite_expires_at > NOW()
RETURNING *;

-- name: ResendInvite :one
-- Rotates the token (the previous email's link stops working) and restarts
-- the 72h expiry, so an already-expired invite can be revived too. The
-- invite_resend_count = $3 condition is the optimistic-concurrency check:
-- UserService passes the count it based its cooldown decision on, so of two
-- concurrent resends only one matches and the other gets pgx.ErrNoRows.
UPDATE users
SET
    invite_token        = $2,
    invite_expires_at   = NOW() + INTERVAL '72 hours',
    invite_sent_at      = NOW(),
    invite_resend_count = invite_resend_count + 1,
    updated_at          = NOW()
WHERE id = $1
  AND status = 'pending'
  AND deleted_at IS NULL
  AND invite_resend_count = $3
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

-- name: CountUserByEmailAnyStatus :one
-- Used by the invite duplicate-check: spec.md requires checking "any status"
-- for the 409 decision, distinct from GetUserByEmail (which is soft-delete aware
-- and used at login). Deliberately does NOT filter deleted_at, matching spec.md's
-- literal wording; a soft-deleted user's email is intentionally excluded here
-- because it lives behind the partial unique index (see migration 001_init.sql).
SELECT COUNT(*) FROM users
WHERE email = $1
  AND deleted_at IS NULL;

-- name: ListUsers :many
SELECT * FROM users
WHERE deleted_at IS NULL
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'))
  AND (sqlc.narg('role')::text IS NULL OR role = sqlc.narg('role'))
  AND (
    sqlc.narg('cursor_created_at')::timestamptz IS NULL
    OR created_at < sqlc.narg('cursor_created_at')
    OR (created_at = sqlc.narg('cursor_created_at') AND id < sqlc.narg('cursor_id'))
  )
ORDER BY created_at DESC, id DESC
LIMIT $1;

-- name: CountUsers :one
SELECT COUNT(*) FROM users
WHERE deleted_at IS NULL
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'))
  AND (sqlc.narg('role')::text IS NULL OR role = sqlc.narg('role'));

-- name: SeedAdminUser :one
-- Idempotent + self-healing bootstrap for cmd/seed: ON CONFLICT targets the
-- partial unique index from 001_init.sql (email unique only among
-- non-deleted rows). Creates the admin row on first run, and re-syncs
-- password_hash on every later run — a plain DO NOTHING would leave a wrong
-- first-run password (e.g. a typo'd SEED_ADMIN_PASSWORD secret) stuck
-- forever even after the secret is corrected and redeployed. The
-- "WHERE users.role = 'admin'" guard means this can never silently
-- overwrite an unrelated user who happens to share the seed email — that
-- case matches zero rows (same as DO NOTHING), which RETURNING surfaces as
-- pgx.ErrNoRows, and cmd/seed treats as "skip, not ours to touch". Never
-- used by the invite/activate flow.
INSERT INTO users (email, full_name, password_hash, status, role)
VALUES ($1, $2, $3, 'active', 'admin')
ON CONFLICT (email) WHERE deleted_at IS NULL
DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    full_name     = EXCLUDED.full_name,
    updated_at    = NOW()
WHERE users.role = 'admin'
RETURNING *;

-- name: SetUserTokensValidAfter :execrows
-- Sign out everywhere (mig 025). 0 rows = unknown or soft-deleted user.
UPDATE users
SET tokens_valid_after = $2,
    updated_at         = NOW()
WHERE id = $1
  AND deleted_at IS NULL;

-- name: UpdateUserFullName :one
-- Profile (mobile Account). Hand-authored in sqlc/users_profile.sql.go; returns
-- only the columns a profile response needs, never password_hash.
UPDATE users
SET full_name  = $2,
    updated_at = NOW()
WHERE id = $1
  AND deleted_at IS NULL
RETURNING id, email, full_name, status, role, activated_at, created_at, updated_at, tokens_valid_after, avatar_url;

-- name: SetUserAvatarURL :one
-- NULL clears the avatar. Same column list as UpdateUserFullName.
UPDATE users
SET avatar_url = $2,
    updated_at = NOW()
WHERE id = $1
  AND deleted_at IS NULL
RETURNING id, email, full_name, status, role, activated_at, created_at, updated_at, tokens_valid_after, avatar_url;

-- name: GetUserByUsername :one
-- Login by tên đăng nhập (mig 030). Hand-authored in sqlc/users_access.sql.go,
-- as are the access-request queries below (mig 031).
SELECT * FROM users
WHERE username = $1
  AND deleted_at IS NULL
LIMIT 1;

-- name: CreateAccessRequest :one
-- Someone without an account asks admin $2 for one. A unique violation means
-- the email already has a live account (any status).
INSERT INTO users (email, role, status, invited_by, approval_token)
VALUES ($1, 'member', 'requested', $2, $3)
RETURNING *;

-- name: GetUserByApprovalToken :one
SELECT * FROM users
WHERE approval_token = $1
  AND status = 'requested'
  AND deleted_at IS NULL
LIMIT 1;

-- name: ApproveAccessRequest :one
-- requested -> pending with a fresh invite: from here it is an invited user.
-- The status condition makes a second approval (email link and app at once)
-- match no row, so only one invite email goes out.
UPDATE users
SET
    status              = 'pending',
    approval_token      = NULL,
    invite_token        = $2,
    invite_expires_at   = NOW() + INTERVAL '72 hours',
    invite_sent_at      = NOW(),
    invite_resend_count = 0,
    updated_at          = NOW()
WHERE id = $1
  AND status = 'requested'
  AND deleted_at IS NULL
RETURNING *;
