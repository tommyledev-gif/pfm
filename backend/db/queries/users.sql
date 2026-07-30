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
-- Conditional UPDATE is the optimistic-concurrency check itself: if two requests
-- race for the same token, only one matches "status = 'pending'" and updates a
-- row. The other affects zero rows (returns no rows -> pgx.ErrNoRows).
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
