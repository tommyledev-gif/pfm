package service

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// fakeChatRepo is an in-memory stand-in for ChatRepo, used instead of a real
// Postgres per Go Test Conventions — same approach as every other fake in
// this package.
type fakeChatRepo struct {
	mu       sync.Mutex
	messages []*model.ChatMessage
}

func newFakeChatRepo() *fakeChatRepo {
	return &fakeChatRepo{}
}

func (f *fakeChatRepo) CreateChatMessage(_ context.Context, arg repository.CreateChatMessageParams) (*model.ChatMessage, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	msg := &model.ChatMessage{
		ID:             uuid.New(),
		UserID:         arg.UserID,
		ConversationID: arg.ConversationID,
		Role:           arg.Role,
		Content:        arg.Content,
		Intent:         arg.Intent,
		CreatedAt:      time.Now().UTC(),
	}
	f.messages = append(f.messages, msg)
	cp := *msg
	return &cp, nil
}

func (f *fakeChatRepo) ListRecentMessagesByConversation(_ context.Context, conversationID uuid.UUID, limit int32) ([]*model.ChatMessage, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	// Newest-first, capped at limit — mirrors the real repository's ORDER BY
	// created_at DESC LIMIT contract exactly, since ChatService.buildHistory
	// depends on that ordering to reverse it back to chronological.
	matching := make([]*model.ChatMessage, 0, len(f.messages))
	for i := len(f.messages) - 1; i >= 0; i-- {
		if f.messages[i].ConversationID == conversationID {
			matching = append(matching, f.messages[i])
		}
	}
	if int32(len(matching)) > limit {
		matching = matching[:limit]
	}
	return matching, nil
}

func (f *fakeChatRepo) messageCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.messages)
}

func (f *fakeChatRepo) lastMessage() *model.ChatMessage {
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.messages) == 0 {
		return nil
	}
	return f.messages[len(f.messages)-1]
}
