package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Hand-written like the rest of this package (see db.go); the SQL is also in
// db/queries/password_reset_codes.sql.

const lockActiveUserForPasswordReset = `-- name: LockActiveUserForPasswordReset :one
SELECT id FROM users
WHERE id = $1
  AND status = 'active'
  AND deleted_at IS NULL
FOR UPDATE
`

// LockActiveUserForPasswordReset serialises code creation per user, so two
// requests at once cannot both pass the cooldown check.
func (q *Queries) LockActiveUserForPasswordReset(ctx context.Context, userID uuid.UUID) (uuid.UUID, error) {
	var id uuid.UUID
	err := q.db.QueryRow(ctx, lockActiveUserForPasswordReset, userID).Scan(&id)
	return id, err
}

const countPasswordResetCodesSince = `-- name: CountPasswordResetCodesSince :one
SELECT COUNT(*) FROM password_reset_codes
WHERE user_id = $1
  AND created_at > $2
`

func (q *Queries) CountPasswordResetCodesSince(ctx context.Context, userID uuid.UUID, since time.Time) (int64, error) {
	var n int64
	err := q.db.QueryRow(ctx, countPasswordResetCodesSince, userID, since).Scan(&n)
	return n, err
}

const revokeLivePasswordResetCodes = `-- name: RevokeLivePasswordResetCodes :exec
UPDATE password_reset_codes
SET revoked_at = NOW()
WHERE user_id = $1
  AND used_at IS NULL
  AND revoked_at IS NULL
`

func (q *Queries) RevokeLivePasswordResetCodes(ctx context.Context, userID uuid.UUID) error {
	_, err := q.db.Exec(ctx, revokeLivePasswordResetCodes, userID)
	return err
}

const createPasswordResetCode = `-- name: CreatePasswordResetCode :exec
INSERT INTO password_reset_codes (user_id, code_hash, expires_at)
VALUES ($1, $2, $3)
`

func (q *Queries) CreatePasswordResetCode(ctx context.Context, userID uuid.UUID, codeHash string, expiresAt time.Time) error {
	_, err := q.db.Exec(ctx, createPasswordResetCode, userID, codeHash, expiresAt)
	return err
}

const getLivePasswordResetCode = `-- name: GetLivePasswordResetCode :one
SELECT id, user_id, code_hash, attempts, created_at, expires_at, used_at, revoked_at
FROM password_reset_codes
WHERE user_id = $1
  AND used_at IS NULL
  AND revoked_at IS NULL
  AND expires_at > NOW()
ORDER BY created_at DESC
LIMIT 1
`

type PasswordResetCode struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	CodeHash  string
	Attempts  int32
	CreatedAt time.Time
	ExpiresAt time.Time
	UsedAt    *time.Time
	RevokedAt *time.Time
}

func (q *Queries) GetLivePasswordResetCode(ctx context.Context, userID uuid.UUID) (PasswordResetCode, error) {
	var i PasswordResetCode
	err := q.db.QueryRow(ctx, getLivePasswordResetCode, userID).Scan(
		&i.ID, &i.UserID, &i.CodeHash, &i.Attempts, &i.CreatedAt, &i.ExpiresAt, &i.UsedAt, &i.RevokedAt,
	)
	return i, err
}

const spendPasswordResetTry = `-- name: SpendPasswordResetTry :exec
UPDATE password_reset_codes
SET attempts   = attempts + 1,
    revoked_at = CASE WHEN attempts + 1 >= $2 THEN NOW() ELSE revoked_at END
WHERE id = $1
  AND used_at IS NULL
  AND revoked_at IS NULL
`

// SpendPasswordResetTry counts one wrong try and ends the code at maxTries.
func (q *Queries) SpendPasswordResetTry(ctx context.Context, id uuid.UUID, maxTries int32) error {
	_, err := q.db.Exec(ctx, spendPasswordResetTry, id, maxTries)
	return err
}

const usePasswordResetCode = `-- name: UsePasswordResetCode :execrows
UPDATE password_reset_codes
SET used_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND used_at IS NULL
  AND revoked_at IS NULL
  AND expires_at > NOW()
  AND attempts < $3
`

// UsePasswordResetCode marks a live code used; 0 rows = no longer live (used
// by a concurrent confirm, expired, revoked). This WHERE clause is the race
// arbiter for single use.
func (q *Queries) UsePasswordResetCode(ctx context.Context, id, userID uuid.UUID, maxTries int32) (int64, error) {
	tag, err := q.db.Exec(ctx, usePasswordResetCode, id, userID, maxTries)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

const deleteOldPasswordResetCodes = `-- name: DeleteOldPasswordResetCodes :execrows
DELETE FROM password_reset_codes
WHERE created_at < $1
`

func (q *Queries) DeleteOldPasswordResetCodes(ctx context.Context, cutoff time.Time) (int64, error) {
	tag, err := q.db.Exec(ctx, deleteOldPasswordResetCodes, cutoff)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}
