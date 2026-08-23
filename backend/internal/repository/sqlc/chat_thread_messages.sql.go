package sqlc

import (
	"context"

	"github.com/google/uuid"
)

const upsertChatThreadMessage = `-- name: UpsertChatThreadMessage :one
INSERT INTO chat_thread_messages (user_id, client_message_id, payload)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, client_message_id)
DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
RETURNING id, user_id, client_message_id, payload, created_at, updated_at
`

type UpsertChatThreadMessageParams struct {
	UserID          uuid.UUID
	ClientMessageID string
	Payload         string
}

func (q *Queries) UpsertChatThreadMessage(ctx context.Context, arg UpsertChatThreadMessageParams) (ChatThreadMessage, error) {
	row := q.db.QueryRow(ctx, upsertChatThreadMessage, arg.UserID, arg.ClientMessageID, arg.Payload)
	var i ChatThreadMessage
	err := row.Scan(&i.ID, &i.UserID, &i.ClientMessageID, &i.Payload, &i.CreatedAt, &i.UpdatedAt)
	return i, err
}

const listChatThreadMessagesByUser = `-- name: ListChatThreadMessagesByUser :many
SELECT id, user_id, client_message_id, payload, created_at, updated_at FROM chat_thread_messages
WHERE user_id = $1
ORDER BY created_at ASC
`

func (q *Queries) ListChatThreadMessagesByUser(ctx context.Context, userID uuid.UUID) ([]ChatThreadMessage, error) {
	rows, err := q.db.Query(ctx, listChatThreadMessagesByUser, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ChatThreadMessage
	for rows.Next() {
		var i ChatThreadMessage
		if err := rows.Scan(&i.ID, &i.UserID, &i.ClientMessageID, &i.Payload, &i.CreatedAt, &i.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}
