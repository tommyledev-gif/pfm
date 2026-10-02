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

// ListRecentMessagesByConversation returns up to `limit` messages, most
// recent first — callers wanting chronological order (e.g. ChatService
// building AI Service conversation history) must reverse the slice
// themselves, same convention as leaving pagination/ordering decisions to
// the caller elsewhere in this codebase. Only userID's own messages are ever
// returned, whatever conversationID the caller passes.
func (r *ChatRepository) ListRecentMessagesByConversation(ctx context.Context, userID, conversationID uuid.UUID, limit int32) ([]*model.ChatMessage, error) {
	rows, err := r.q.ListRecentChatMessagesByConversation(ctx, sqlc.ListRecentChatMessagesByConversationParams{
		ConversationID: conversationID,
		UserID:         userID,
		Limit:          limit,
	})
	if err != nil {
		return nil, fmt.Errorf("repository.ListRecentMessagesByConversation: %w", err)
	}
	messages := make([]*model.ChatMessage, 0, len(rows))
	for _, row := range rows {
		messages = append(messages, toChatMessageModel(row))
	}
	return messages, nil
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
