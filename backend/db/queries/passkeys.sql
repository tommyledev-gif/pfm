-- Passkeys (032_passkeys.sql). Documentation for the hand-written
-- internal/repository/sqlc/passkeys.sql.go — keep the two in step.

-- name: CreatePasskey :one
INSERT INTO passkeys (user_id, credential_id, credential, name)
VALUES ($1, $2, $3, $4)
RETURNING id, user_id, credential_id, credential, name, created_at, last_used_at;

-- name: ListPasskeysByUser :many
SELECT id, user_id, credential_id, credential, name, created_at, last_used_at
FROM passkeys
WHERE user_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- name: GetPasskeyByCredentialID :one
SELECT p.id, p.user_id, p.credential_id, p.credential, p.name, p.created_at, p.last_used_at
FROM passkeys p
JOIN users u ON u.id = p.user_id
WHERE p.credential_id = $1
  AND p.deleted_at IS NULL
  AND u.deleted_at IS NULL;

-- name: CountPasskeysByUser :one
SELECT COUNT(*) FROM passkeys WHERE user_id = $1 AND deleted_at IS NULL;

-- name: TouchPasskey :exec
UPDATE passkeys
SET credential = $3, last_used_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL;

-- name: SoftDeletePasskey :execrows
UPDATE passkeys
SET deleted_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL;

-- name: CreatePasskeyChallenge :one
INSERT INTO passkey_challenges (user_id, purpose, session, expires_at)
VALUES ($1, $2, $3, $4)
RETURNING id;

-- name: ConsumePasskeyChallenge :one
DELETE FROM passkey_challenges
WHERE id = $1
  AND purpose = $2
  AND expires_at > NOW()
RETURNING user_id, session;

-- name: DeleteExpiredPasskeyChallenges :execrows
DELETE FROM passkey_challenges WHERE expires_at <= NOW();
