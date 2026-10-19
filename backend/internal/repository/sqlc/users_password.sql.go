package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
)

const changeUserPassword = `-- name: ChangeUserPassword :execrows
UPDATE users
SET password_hash      = $2,
    tokens_valid_after = $3,
    updated_at         = NOW()
WHERE id = $1
  AND status = 'active'
  AND deleted_at IS NULL
`

// ChangeUserPassword stores a new password hash and, in the same statement,
// moves the user's sign-out point so every credential issued before it is
// refused. 0 rows = unknown, soft-deleted or no longer active user.
func (q *Queries) ChangeUserPassword(ctx context.Context, id uuid.UUID, passwordHash string, tokensValidAfter time.Time) (int64, error) {
	result, err := q.db.Exec(ctx, changeUserPassword, id, passwordHash, tokensValidAfter)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}
