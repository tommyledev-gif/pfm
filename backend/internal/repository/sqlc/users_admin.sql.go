package sqlc

import (
	"context"

	"github.com/google/uuid"
)

// Hand-authored (see db/queries/users.sql): the account deletion tool on the
// mobile Security screen. Both queries return userColumns.

const searchUsers = `-- name: SearchUsers :many
SELECT ` + userColumns + ` FROM users
WHERE deleted_at IS NULL
  AND (email ILIKE '%' || $1::text || '%' ESCAPE '\' OR username ILIKE '%' || $1::text || '%' ESCAPE '\')
ORDER BY email
LIMIT $2`

// SearchUsers expects pattern already lowercased with LIKE's wildcards
// escaped; it is matched as a plain substring.
func (q *Queries) SearchUsers(ctx context.Context, pattern string, limit int32) ([]User, error) {
	rows, err := q.db.Query(ctx, searchUsers, pattern, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []User
	for rows.Next() {
		i, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const softDeleteUser = `-- name: SoftDeleteUser :one
UPDATE users
SET
    deleted_at     = NOW(),
    invite_token   = NULL,
    approval_token = NULL,
    updated_at     = NOW()
WHERE id = $1
  AND deleted_at IS NULL
RETURNING ` + userColumns

// SoftDeleteUser returns pgx.ErrNoRows when the account is unknown or was
// already deleted.
func (q *Queries) SoftDeleteUser(ctx context.Context, id uuid.UUID) (User, error) {
	return scanUser(q.db.QueryRow(ctx, softDeleteUser, id))
}
