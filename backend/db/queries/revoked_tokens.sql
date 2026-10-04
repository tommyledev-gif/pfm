-- name: RevokeToken :exec
INSERT INTO revoked_tokens (token_jti, user_id, expires_at)
VALUES ($1, $2, $3)
ON CONFLICT (token_jti) DO NOTHING;

-- name: IsTokenRevoked :one
SELECT EXISTS (
    SELECT 1 FROM revoked_tokens WHERE token_jti = $1
) AS revoked;

-- name: ClaimTokenJTI :execrows
-- Single-use claim of a switch token (specs/mobile-account-switch plan.md
-- Finding #5): same insert as RevokeToken, but the affected-row count tells
-- the caller whether it won; 0 rows = the jti was already used/revoked.
INSERT INTO revoked_tokens (token_jti, user_id, expires_at)
VALUES ($1, $2, $3)
ON CONFLICT (token_jti) DO NOTHING;
