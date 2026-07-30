package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
)

const revokeToken = `-- name: RevokeToken :exec
INSERT INTO revoked_tokens (token_jti, user_id, expires_at)
VALUES ($1, $2, $3)
ON CONFLICT (token_jti) DO NOTHING
`

type RevokeTokenParams struct {
	TokenJTI  string
	UserID    *uuid.UUID
	ExpiresAt time.Time
}

func (q *Queries) RevokeToken(ctx context.Context, arg RevokeTokenParams) error {
	_, err := q.db.Exec(ctx, revokeToken, arg.TokenJTI, arg.UserID, arg.ExpiresAt)
	return err
}

const isTokenRevoked = `-- name: IsTokenRevoked :one
SELECT EXISTS (
    SELECT 1 FROM revoked_tokens WHERE token_jti = $1
) AS revoked
`

func (q *Queries) IsTokenRevoked(ctx context.Context, tokenJTI string) (bool, error) {
	row := q.db.QueryRow(ctx, isTokenRevoked, tokenJTI)
	var revoked bool
	err := row.Scan(&revoked)
	return revoked, err
}
