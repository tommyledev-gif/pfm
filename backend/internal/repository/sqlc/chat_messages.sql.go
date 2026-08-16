package sqlc

import (
	"context"

	"github.com/google/uuid"
)

const createChatMessage = `-- name: CreateChatMessage :one
INSERT INTO chat_messages (user_id, conversation_id, role, content, intent)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, user_id, conversation_id, role, content, intent, transaction_ids, created_at
`

type CreateChatMessageParams struct {
	UserID         uuid.UUID
	ConversationID uuid.UUID
	Role           string
	Content        string
	Intent         *string
}

// CreateChatMessage leaves transaction_ids NULL at insert time for both roles
// in this cut — linking a confirmed Transaction back to its originating
// message is explicitly deferred (specs/ai-chat-assistant/spec.md Open
// Question #8).
func (q *Queries) CreateChatMessage(ctx context.Context, arg CreateChatMessageParams) (ChatMessage, error) {
	row := q.db.QueryRow(ctx, createChatMessage,
		arg.UserID, arg.ConversationID, arg.Role, arg.Content, arg.Intent,
	)
	var i ChatMessage
	err := row.Scan(
		&i.ID, &i.UserID, &i.ConversationID, &i.Role, &i.Content, &i.Intent,
		&i.TransactionIDs, &i.CreatedAt,
	)
	return i, err
}
