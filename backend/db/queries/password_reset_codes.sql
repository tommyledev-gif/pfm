-- Forgot password codes (specs/forgot-password, migration 036). Source of
-- truth for the hand-written internal/repository/sqlc/password_reset_codes.sql.go.

-- name: LockActiveUserForPasswordReset :one
SELECT id FROM users
WHERE id = $1
  AND status = 'active'
  AND deleted_at IS NULL
FOR UPDATE;

-- name: CountPasswordResetCodesSince :one
SELECT COUNT(*) FROM password_reset_codes
WHERE user_id = $1
  AND created_at > $2;

-- name: RevokeLivePasswordResetCodes :exec
UPDATE password_reset_codes
SET revoked_at = NOW()
WHERE user_id = $1
  AND used_at IS NULL
  AND revoked_at IS NULL;

-- name: CreatePasswordResetCode :exec
INSERT INTO password_reset_codes (user_id, code_hash, expires_at)
VALUES ($1, $2, $3);

-- name: GetLivePasswordResetCode :one
SELECT id, user_id, code_hash, attempts, created_at, expires_at, used_at, revoked_at
FROM password_reset_codes
WHERE user_id = $1
  AND used_at IS NULL
  AND revoked_at IS NULL
  AND expires_at > NOW()
ORDER BY created_at DESC
LIMIT 1;

-- name: SpendPasswordResetTry :exec
UPDATE password_reset_codes
SET attempts   = attempts + 1,
    revoked_at = CASE WHEN attempts + 1 >= $2 THEN NOW() ELSE revoked_at END
WHERE id = $1
  AND used_at IS NULL
  AND revoked_at IS NULL;

-- name: UsePasswordResetCode :execrows
UPDATE password_reset_codes
SET used_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND used_at IS NULL
  AND revoked_at IS NULL
  AND expires_at > NOW()
  AND attempts < $3;

-- name: DeleteOldPasswordResetCodes :execrows
DELETE FROM password_reset_codes
WHERE created_at < $1;
