package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// ChatThreadRepository wraps the sqlc-generated chat_thread_messages
// queries — the client-rendered chat UI cache (action payloads, confirmed
// state, edit history, budget-wizard card state). Kept entirely separate
// from ChatRepository's chat_messages, which only logs raw role/content to
// build AI Service conversation context and is never read back by a client.
type ChatThreadRepository struct {
	q    *sqlc.Queries
	pool BatchSender
}

// BatchSender is the part of *pgxpool.Pool that sends a pgx batch.
type BatchSender interface {
	SendBatch(ctx context.Context, b *pgx.Batch) pgx.BatchResults
}

func NewChatThreadRepository(q *sqlc.Queries, pool BatchSender) *ChatThreadRepository {
	return &ChatThreadRepository{q: q, pool: pool}
}

// ChatThreadUpsert is one message of a thread sync, keyed by the client's own
// message id.
type ChatThreadUpsert struct {
	ClientMessageID string
	Payload         string
}

// UpsertMessages writes every message of one sync as a single pgx batch
// (specs/security-hardening-2026-10 US-09): one round trip instead of one per
// message, and atomic. pgx sends a batch with one Sync, so Postgres runs it as
// one implicit transaction: a failure on any message writes none of them,
// where the old one-statement-per-message loop left a half-synced thread.
func (r *ChatThreadRepository) UpsertMessages(ctx context.Context, userID uuid.UUID, messages []ChatThreadUpsert) error {
	if len(messages) == 0 {
		return nil
	}
	args := make([]sqlc.UpsertChatThreadMessageParams, len(messages))
	for i, m := range messages {
		args[i] = sqlc.UpsertChatThreadMessageParams{UserID: userID, ClientMessageID: m.ClientMessageID, Payload: m.Payload}
	}
	batch := &pgx.Batch{}
	sqlc.QueueUpsertChatThreadMessages(batch, args)

	results := r.pool.SendBatch(ctx, batch)
	for range args {
		if _, err := results.Exec(); err != nil {
			_ = results.Close() // the Exec error is the one to report; Close only frees the connection
			return fmt.Errorf("repository.UpsertChatThreadMessages: %w", err)
		}
	}
	if err := results.Close(); err != nil {
		return fmt.Errorf("repository.UpsertChatThreadMessages: %w", err)
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

// ListPageByUser returns up to `limit` messages, newest first — the latest
// ones, or those older than the message `before` (a client message id) when
// it is set. The service turns the page back into oldest-first order.
func (r *ChatThreadRepository) ListPageByUser(ctx context.Context, userID uuid.UUID, before *string, limit int) ([]ChatThreadRow, error) {
	rows, err := r.q.ListChatThreadMessagesPage(ctx, sqlc.ListChatThreadMessagesPageParams{
		UserID:                userID,
		Limit:                 int32(limit),
		BeforeClientMessageID: before,
	})
	if err != nil {
		return nil, fmt.Errorf("repository.ListChatThreadMessagesPage: %w", err)
	}
	out := make([]ChatThreadRow, 0, len(rows))
	for _, row := range rows {
		out = append(out, ChatThreadRow{ClientMessageID: row.ClientMessageID, Payload: row.Payload})
	}
	return out, nil
}
