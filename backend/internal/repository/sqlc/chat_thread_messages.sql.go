package sqlc

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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

// QueueUpsertChatThreadMessages queues one UpsertChatThreadMessage per arg on
// b, so a whole thread sync goes to Postgres as one batch (hand-written, not
// sqlc output: sqlc's :batchexec would need its generator, see db.go).
func QueueUpsertChatThreadMessages(b *pgx.Batch, args []UpsertChatThreadMessageParams) {
	for _, arg := range args {
		b.Queue(upsertChatThreadMessage, arg.UserID, arg.ClientMessageID, arg.Payload)
	}
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

const listChatThreadMessagesPage = `-- name: ListChatThreadMessagesPage :many
SELECT t.id, t.user_id, t.client_message_id, t.payload, t.created_at, t.updated_at FROM chat_thread_messages t
WHERE t.user_id = $1
  AND (
    $3::text IS NULL
    OR (t.created_at, t.id) < (
      SELECT c.created_at, c.id FROM chat_thread_messages c
      WHERE c.user_id = $1 AND c.client_message_id = $3
    )
  )
ORDER BY t.created_at DESC, t.id DESC
LIMIT $2
`

type ListChatThreadMessagesPageParams struct {
	UserID                uuid.UUID
	Limit                 int32
	BeforeClientMessageID *string
}

func (q *Queries) ListChatThreadMessagesPage(ctx context.Context, arg ListChatThreadMessagesPageParams) ([]ChatThreadMessage, error) {
	rows, err := q.db.Query(ctx, listChatThreadMessagesPage, arg.UserID, arg.Limit, arg.BeforeClientMessageID)
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
