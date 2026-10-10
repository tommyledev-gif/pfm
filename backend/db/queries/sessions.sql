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

-- name: CreateSession :exec
INSERT INTO sessions (id, user_id, refresh_jti, expires_at, absolute_expires_at)
VALUES ($1, $2, $3, $4, $5);

-- name: GetSession :one
SELECT id, user_id, refresh_jti, prev_refresh_jti, rotated_at, created_at,
       last_used_at, expires_at, absolute_expires_at, revoked_at, revoked_reason
FROM sessions
WHERE id = $1;

-- name: RotateSessionRefresh :execrows
-- Compare-and-swap on the current refresh jti: of two refreshes presenting
-- the same token only one matches. 0 rows = lost the race, or revoked.
UPDATE sessions
SET prev_refresh_jti = refresh_jti,
    refresh_jti      = $3,
    rotated_at       = NOW(),
    last_used_at     = NOW(),
    expires_at       = $4
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
