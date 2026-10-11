package sqlc

import (
	"context"

	"github.com/google/uuid"
)

// The profile queries return only what a profile response needs — never
// password_hash or the invite fields.
const profileColumns = `id, email, full_name, status, role, activated_at, created_at, updated_at, tokens_valid_after, avatar_url, username`

const updateUserFullName = `-- name: UpdateUserFullName :one
UPDATE users
SET full_name  = $2,
    updated_at = NOW()
WHERE id = $1
  AND deleted_at IS NULL
RETURNING ` + profileColumns

// UpdateUserFullName returns pgx.ErrNoRows for an unknown or soft-deleted user.
func (q *Queries) UpdateUserFullName(ctx context.Context, id uuid.UUID, fullName string) (User, error) {
	return scanProfile(q.db.QueryRow(ctx, updateUserFullName, id, fullName))
}

const setUserAvatarURL = `-- name: SetUserAvatarURL :one
UPDATE users
SET avatar_url = $2,
    updated_at = NOW()
WHERE id = $1
  AND deleted_at IS NULL
RETURNING ` + profileColumns

// SetUserAvatarURL stores avatarURL (nil clears it). Returns pgx.ErrNoRows for
// an unknown or soft-deleted user.
func (q *Queries) SetUserAvatarURL(ctx context.Context, id uuid.UUID, avatarURL *string) (User, error) {
	return scanProfile(q.db.QueryRow(ctx, setUserAvatarURL, id, avatarURL))
}

type rowScanner interface{ Scan(dest ...any) error }

func scanProfile(row rowScanner) (User, error) {
	var i User
	err := row.Scan(
		&i.ID, &i.Email, &i.FullName, &i.Status, &i.Role, &i.ActivatedAt,
		&i.CreatedAt, &i.UpdatedAt, &i.TokensValidAfter, &i.AvatarURL, &i.Username,
	)
	return i, err
}
