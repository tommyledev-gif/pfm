package sqlc

import (
	"context"

	"github.com/google/uuid"
)

const markNotificationsRead = `-- name: MarkNotificationsRead :execrows
UPDATE notifications
SET is_read = TRUE
WHERE user_id = $1
  AND is_read = FALSE
  AND ($2::uuid[] IS NULL OR id = ANY($2::uuid[]))`

// MarkNotificationsRead marks userID's unread notifications in ids as read,
// or all of them when ids is nil (encoded as NULL). Returns how many rows
// changed. Hand-authored (see db/queries/notifications.sql).
func (q *Queries) MarkNotificationsRead(ctx context.Context, userID uuid.UUID, ids []uuid.UUID) (int64, error) {
	result, err := q.db.Exec(ctx, markNotificationsRead, userID, ids)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}
