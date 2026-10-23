package sqlc

import (
	"context"
	"time"
)

const deleteExpiredSessions = `-- name: DeleteExpiredSessions :execrows
DELETE FROM sessions
WHERE absolute_expires_at < $1
   OR (revoked_at IS NOT NULL AND revoked_at < $1)
`

func (q *Queries) DeleteExpiredSessions(ctx context.Context, cutoff time.Time) (int64, error) {
	result, err := q.db.Exec(ctx, deleteExpiredSessions, cutoff)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

const deleteExpiredRevokedTokens = `-- name: DeleteExpiredRevokedTokens :execrows
DELETE FROM revoked_tokens
WHERE expires_at < $1
`

func (q *Queries) DeleteExpiredRevokedTokens(ctx context.Context, cutoff time.Time) (int64, error) {
	result, err := q.db.Exec(ctx, deleteExpiredRevokedTokens, cutoff)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

const getMigrationAppliedAt = `-- name: GetMigrationAppliedAt :one
SELECT applied_at FROM schema_migrations
WHERE filename = $1
`

// GetMigrationAppliedAt reads cmd/migrate's ledger. pgx.ErrNoRows when the
// migration was never recorded; a "relation does not exist" error when the
// ledger itself is missing.
func (q *Queries) GetMigrationAppliedAt(ctx context.Context, filename string) (time.Time, error) {
	row := q.db.QueryRow(ctx, getMigrationAppliedAt, filename)
	var appliedAt time.Time
	err := row.Scan(&appliedAt)
	return appliedAt, err
}

const releaseTokenJTI = `-- name: ReleaseTokenJTI :execrows
DELETE FROM revoked_tokens
WHERE token_jti = $1
`

// ReleaseTokenJTI undoes ClaimTokenJTI for a token whose redemption failed
// after the claim, so the client may present it again.
func (q *Queries) ReleaseTokenJTI(ctx context.Context, tokenJTI string) (int64, error) {
	result, err := q.db.Exec(ctx, releaseTokenJTI, tokenJTI)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}
