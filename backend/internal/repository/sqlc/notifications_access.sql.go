package sqlc

import (
	"context"

	"github.com/google/uuid"
)

const createAccessRequestNotification = `-- name: CreateAccessRequestNotification :exec
INSERT INTO notifications (user_id, type, title, body, related_user_id)
VALUES ($1, 'access_request', $2, $3, $4)`

// CreateAccessRequestNotification tells an admin (userID) that requesterID
// asked for an account. Hand-authored (see db/queries/notifications.sql).
func (q *Queries) CreateAccessRequestNotification(ctx context.Context, userID uuid.UUID, title, body string, requesterID uuid.UUID) error {
	_, err := q.db.Exec(ctx, createAccessRequestNotification, userID, title, body, requesterID)
	return err
}
