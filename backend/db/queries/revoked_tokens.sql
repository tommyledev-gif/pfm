-- name: RevokeToken :exec
INSERT INTO revoked_tokens (token_jti, user_id, expires_at)
VALUES ($1, $2, $3)
ON CONFLICT (token_jti) DO NOTHING;

-- name: IsTokenRevoked :one
SELECT EXISTS (
    SELECT 1 FROM revoked_tokens WHERE token_jti = $1
) AS revoked;
