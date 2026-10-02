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

const listRecentChatMessagesByConversation = `-- name: ListRecentChatMessagesByConversation :many
SELECT id, user_id, conversation_id, role, content, intent, transaction_ids, created_at FROM chat_messages
WHERE conversation_id = $1
  AND user_id = $2
ORDER BY created_at DESC
LIMIT $3
`

type ListRecentChatMessagesByConversationParams struct {
	ConversationID uuid.UUID
	UserID         uuid.UUID
	Limit          int32
}

// Most-recent-first, capped at $3 — ChatService reverses this back to
// chronological order before handing it to the AI Service as conversation
// history, so a follow-up message (e.g. "20k" after "mua cà phê") can be
// disambiguated using what was already said instead of being judged in
// isolation.
// ⚠️ Scoped by user_id on purpose. conversation_id is NOT server-only: the
// request DTO accepts it (dto.ChatRequest.ConversationID) and ChatService
// uses it as given, so without this filter anyone holding another User's
// conversation_id would get that User's messages fed into their own model
// context — and read back to them by the model.
func (q *Queries) ListRecentChatMessagesByConversation(ctx context.Context, arg ListRecentChatMessagesByConversationParams) ([]ChatMessage, error) {
	rows, err := q.db.Query(ctx, listRecentChatMessagesByConversation, arg.ConversationID, arg.UserID, arg.Limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ChatMessage
	for rows.Next() {
		var i ChatMessage
		if err := rows.Scan(
			&i.ID, &i.UserID, &i.ConversationID, &i.Role, &i.Content, &i.Intent,
			&i.TransactionIDs, &i.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}
