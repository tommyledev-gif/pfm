package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// ChatRepository wraps the sqlc-generated chat_messages queries and returns
// domain models. No BeginTx — chat_messages writes are independent,
// unordered-safe inserts, never wrapped in a transaction with any other write
// (specs/ai-chat-assistant/plan.md §4 Constitution Notes).
type ChatRepository struct {
	q *sqlc.Queries
}

func NewChatRepository(q *sqlc.Queries) *ChatRepository {
	return &ChatRepository{q: q}
}

type CreateChatMessageParams struct {
	UserID         uuid.UUID
	ConversationID uuid.UUID
	Role           model.ChatRole
	Content        string
	Intent         *model.ChatIntent
}

func (r *ChatRepository) CreateChatMessage(ctx context.Context, arg CreateChatMessageParams) (*model.ChatMessage, error) {
	var intent *string
	if arg.Intent != nil {
		v := string(*arg.Intent)
		intent = &v
	}

	row, err := r.q.CreateChatMessage(ctx, sqlc.CreateChatMessageParams{
		UserID:         arg.UserID,
		ConversationID: arg.ConversationID,
		Role:           string(arg.Role),
		Content:        arg.Content,
		Intent:         intent,
	})
	if err != nil {
		return nil, fmt.Errorf("repository.CreateChatMessage: %w", err)
	}
	return toChatMessageModel(row), nil
}

func toChatMessageModel(row sqlc.ChatMessage) *model.ChatMessage {
	msg := &model.ChatMessage{
		ID:             row.ID,
		UserID:         row.UserID,
		ConversationID: row.ConversationID,
		Role:           model.ChatRole(row.Role),
		Content:        row.Content,
		TransactionIDs: row.TransactionIDs,
		CreatedAt:      row.CreatedAt,
	}
	if row.Intent != nil {
		intent := model.ChatIntent(*row.Intent)
		msg.Intent = &intent
	}
	return msg
}
