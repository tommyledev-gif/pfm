package sqlc

import (
	"context"

	"github.com/google/uuid"
)

const refreshPendingInvite = `-- name: RefreshPendingInvite :execrows
UPDATE users
SET
    invite_token      = $2,
    invite_expires_at = NOW() + INTERVAL '72 hours',
    invite_sent_at    = NOW(),
    updated_at        = NOW()
WHERE id = $1
  AND status = 'pending'
  AND deleted_at IS NULL`

// RefreshPendingInvite gives a never-activated account a fresh invite token
// and expiry. Returns the rows changed: 0 when the account is no longer
// pending. Hand-authored (see db/queries/users.sql).
func (q *Queries) RefreshPendingInvite(ctx context.Context, id uuid.UUID, inviteToken string) (int64, error) {
	result, err := q.db.Exec(ctx, refreshPendingInvite, id, inviteToken)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}
