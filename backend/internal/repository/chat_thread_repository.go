package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// ChatThreadRepository wraps the sqlc-generated chat_thread_messages
// queries — the client-rendered chat UI cache (action payloads, confirmed
// state, edit history, budget-wizard card state). Kept entirely separate
// from ChatRepository's chat_messages, which only logs raw role/content to
// build AI Service conversation context and is never read back by a client.
type ChatThreadRepository struct {
	q *sqlc.Queries
}

func NewChatThreadRepository(q *sqlc.Queries) *ChatThreadRepository {
	return &ChatThreadRepository{q: q}
}

type UpsertChatThreadMessageParams struct {
	UserID          uuid.UUID
	ClientMessageID string
	Payload         string
}

func (r *ChatThreadRepository) UpsertMessage(ctx context.Context, arg UpsertChatThreadMessageParams) error {
	if _, err := r.q.UpsertChatThreadMessage(ctx, sqlc.UpsertChatThreadMessageParams{
		UserID:          arg.UserID,
		ClientMessageID: arg.ClientMessageID,
		Payload:         arg.Payload,
	}); err != nil {
		return fmt.Errorf("repository.UpsertChatThreadMessage: %w", err)
	}
	return nil
}

type ChatThreadRow struct {
	ClientMessageID string
	Payload         string
}

func (r *ChatThreadRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]ChatThreadRow, error) {
	rows, err := r.q.ListChatThreadMessagesByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("repository.ListChatThreadMessagesByUser: %w", err)
	}
	out := make([]ChatThreadRow, 0, len(rows))
	for _, row := range rows {
		out = append(out, ChatThreadRow{ClientMessageID: row.ClientMessageID, Payload: row.Payload})
	}
	return out, nil
}
