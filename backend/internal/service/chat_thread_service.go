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

func (s *ChatThreadService) GetThread(ctx context.Context, userID uuid.UUID) (*dto.GetChatThreadResponse, error) {
	rows, err := s.repo.ListByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.ChatThreadGet: %w", err)
	}
	messages := make([]dto.ChatThreadMessageResponse, 0, len(rows))
	for _, row := range rows {
		messages = append(messages, dto.ChatThreadMessageResponse{
			ClientMessageID: row.ClientMessageID,
			Payload:         json.RawMessage(row.Payload),
		})
	}
	return &dto.GetChatThreadResponse{Messages: messages}, nil
}
