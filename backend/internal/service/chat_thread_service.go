package service

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/repository"
)

// ChatThreadService owns the client-rendered chat UI cache — restoring a
// device's full thread (transaction action cards, confirmed state, edit
// history, budget-wizard card state) after local AsyncStorage is cleared
// (logout, reinstall, new device). Distinct from ChatService/chat_messages,
// which only logs raw text to build AI Service conversation context and is
// never read back by the client.
type ChatThreadService struct {
	repo ChatThreadRepo
}

func NewChatThreadService(repo ChatThreadRepo) *ChatThreadService {
	return &ChatThreadService{repo: repo}
}

// Sync upserts every message in the caller's current thread — a debounced
// bulk resend of the whole thread rather than a diff, since a chat thread is
// small enough that resending it is cheap and it sidesteps ever tracking a
// separate "dirty since last sync" set client-side.
func (s *ChatThreadService) Sync(ctx context.Context, userID uuid.UUID, messages []dto.ChatThreadMessageSync) error {
	for _, m := range messages {
		if err := s.repo.UpsertMessage(ctx, repository.UpsertChatThreadMessageParams{
			UserID:          userID,
			ClientMessageID: m.ClientMessageID,
			Payload:         string(m.Payload),
		}); err != nil {
			return fmt.Errorf("service.ChatThreadSync: %w", err)
		}
	}
	return nil
}

// GetThread returns the caller's thread oldest first. Without a limit it is
// the whole thread (app builds from before paging send none). With one, it is
// the latest `limit` messages — or the `limit` just older than q.Before — so a
// restore on a fresh device reads one screenful, not years of history.
func (s *ChatThreadService) GetThread(ctx context.Context, userID uuid.UUID, q dto.GetChatThreadQuery) (*dto.GetChatThreadResponse, error) {
	if q.Limit == 0 {
		rows, err := s.repo.ListByUser(ctx, userID)
		if err != nil {
			return nil, fmt.Errorf("service.ChatThreadGet: %w", err)
		}
		return &dto.GetChatThreadResponse{Messages: toThreadMessages(rows)}, nil
	}

	var before *string
	if q.Before != "" {
		before = &q.Before
	}
	// One extra row says whether anything older is left, without a COUNT.
	rows, err := s.repo.ListPageByUser(ctx, userID, before, q.Limit+1)
	if err != nil {
		return nil, fmt.Errorf("service.ChatThreadGetPage: %w", err)
	}
	hasMore := len(rows) > q.Limit
	if hasMore {
		rows = rows[:q.Limit]
	}
	// The page comes newest first; the client wants oldest first.
	for i, j := 0, len(rows)-1; i < j; i, j = i+1, j-1 {
		rows[i], rows[j] = rows[j], rows[i]
	}
	return &dto.GetChatThreadResponse{Messages: toThreadMessages(rows), HasMore: hasMore}, nil
}

func toThreadMessages(rows []repository.ChatThreadRow) []dto.ChatThreadMessageResponse {
	messages := make([]dto.ChatThreadMessageResponse, 0, len(rows))
	for _, row := range rows {
		messages = append(messages, dto.ChatThreadMessageResponse{
			ClientMessageID: row.ClientMessageID,
			Payload:         json.RawMessage(row.Payload),
		})
	}
	return messages
}
