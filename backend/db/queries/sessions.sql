-- Source of truth for internal/repository/sqlc/sessions.sql.go (hand-authored
-- in the package's plain-pointer style, see sqlc/db.go).

-- name: LockUserForSession :one
-- Serialises session creation per user: two simultaneous logins of one user
-- queue here, so the limit below is never raced past. NO KEY UPDATE, not
-- UPDATE: it still conflicts with itself, but it does not conflict with the
-- FOR KEY SHARE lock every foreign-key insert into users takes, so a login
-- never stalls that user's concurrent wallet or transaction writes.
SELECT id FROM users
WHERE id = $1
  AND deleted_at IS NULL
FOR NO KEY UPDATE;

-- name: RevokeSessionsBeyondLimit :execrows
-- Keeps the $2 most recently used live sessions of the user and revokes the
-- rest. Called with limit-1 right before inserting the new session.
UPDATE sessions
SET revoked_at     = NOW(),
    revoked_reason = 'session_limit'
WHERE id IN (
    SELECT s.id
    FROM sessions s
    WHERE s.user_id = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > NOW()
      AND s.absolute_expires_at > NOW()
    ORDER BY s.last_used_at DESC, s.created_at DESC, s.id
    OFFSET $2
);

-- name: RevokeSessionsOnDevice :execrows
-- One live session per (user, device): a new sign-in on a device first ends
-- that user's previous session there. Called inside CreateSession's
-- transaction, before the limit below.
UPDATE sessions
SET revoked_at     = NOW(),
    revoked_reason = 'replaced'
WHERE user_id = $1
  AND device_id = $2
  AND revoked_at IS NULL;

-- name: RevokeUnboundSessions :execrows
-- Sessions that never learned a device and have not been renewed since $2
-- (when device-bound sessions went live, mig 033): any app build since then
-- names its device on every renewal (RotateSessionRefresh), so these are
-- tokens nobody holds any more (an old build's sign-in or switch whose
-- session was dropped, not ended), or a web sign-in left idle since. A
-- sign-in on a device clears them, so the device list stops showing
-- "Thiết bị không rõ tên" rows the user cannot place, and they no longer
-- count toward the session limit below.
UPDATE sessions
SET revoked_at     = NOW(),
    revoked_reason = 'unbound_stale'
WHERE user_id = $1
  AND device_id IS NULL
  AND revoked_at IS NULL
  AND last_used_at < $2;

-- name: CreateSession :exec
INSERT INTO sessions (id, user_id, refresh_jti, expires_at, absolute_expires_at, device_id, device_name)
VALUES ($1, $2, $3, $4, $5, $6, $7);

-- name: GetSession :one
SELECT id, user_id, refresh_jti, prev_refresh_jti, rotated_at, created_at,
       last_used_at, expires_at, absolute_expires_at, revoked_at, revoked_reason,
       device_id, device_name
FROM sessions
WHERE id = $1;

-- name: RotateSessionRefresh :execrows
-- Compare-and-swap on the current refresh jti: of two refreshes presenting
-- the same token only one matches. 0 rows = lost the race, or revoked.
-- A session from before mig 033 learns its device here ($5/$6, NULL when the
-- client sent none); a known device is never overwritten.
UPDATE sessions
SET prev_refresh_jti = refresh_jti,
    refresh_jti      = $3,
    rotated_at       = NOW(),
    last_used_at     = NOW(),
    expires_at       = $4,
    device_id        = COALESCE(device_id, $5),
    device_name      = COALESCE(device_name, $6)
WHERE id = $1
  AND refresh_jti = $2
  AND revoked_at IS NULL;

-- name: RevokeSession :execrows
UPDATE sessions
SET revoked_at     = NOW(),
    revoked_reason = $3
WHERE id = $1
  AND user_id = $2
  AND revoked_at IS NULL;

-- name: ListLiveSessionsForUser :many
-- The Security screen's "Thiết bị đang đăng nhập": what still works.
SELECT id, device_name, created_at, last_used_at
FROM sessions
WHERE user_id = $1
  AND revoked_at IS NULL
  AND expires_at > NOW()
  AND absolute_expires_at > NOW()
ORDER BY last_used_at DESC, created_at DESC, id;

-- name: RevokeAllSessionsForUser :execrows
UPDATE sessions
SET revoked_at     = NOW(),
    revoked_reason = $2
WHERE user_id = $1
  AND revoked_at IS NULL;

-- name: GetSessionAuthState :one
-- Everything JWTAuth needs in one indexed lookup. The user_id match means a
-- token cannot borrow another user's session id.
SELECT s.revoked_at, s.expires_at, s.absolute_expires_at,
       u.status, u.role, u.tokens_valid_after
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.id = $1
  AND s.user_id = $2
  AND u.deleted_at IS NULL;

-- name: DeleteExpiredSessions :execrows
-- Retention: a session past its hard stop, or revoked, for longer than the
-- cutoff has no use left (a token presenting it gets the same 401 either way).
DELETE FROM sessions
WHERE absolute_expires_at < $1
   OR (revoked_at IS NOT NULL AND revoked_at < $1);

-- name: DeleteExpiredRevokedTokens :execrows
-- The deny-list only matters until the token's own expiry.
DELETE FROM revoked_tokens
WHERE expires_at < $1;

-- name: GetMigrationAppliedAt :one
-- cmd/migrate's ledger. main.go uses when migration 028 was applied to work
-- out when pre-session refresh tokens stop being accepted.
SELECT applied_at FROM schema_migrations
WHERE filename = $1;

-- name: ReleaseTokenJTI :execrows
-- Undoes ClaimTokenJTI when the redemption failed after the claim (a switch
-- token whose session could not be created), so the client can retry.
DELETE FROM revoked_tokens
WHERE token_jti = $1;
