package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// respondBudgetWizard saves the assistant's tappable-card reply and returns
// a ChatResponse carrying action_type: "budget_wizard"
// (specs/ai-budget-wizard/spec.md US-02 Main Flow steps 3-4) — the client
// renders this as a tappable card instead of a plain bubble, and instead of
// the usual Transaction confirmation cards. Kept in its own file, alongside
// chat_service.go's own Feature-12 logic, per plan.md's file-size concern.
func (s *ChatService) respondBudgetWizard(ctx context.Context, userID, conversationID uuid.UUID) (*dto.ChatResponse, error) {
	message := "Lập ngân sách theo thu nhập. Nhấn để bắt đầu."
	intent := model.ChatIntentBudgetWizard
	if _, err := s.repo.CreateChatMessage(ctx, repository.CreateChatMessageParams{
		UserID: userID, ConversationID: conversationID, Role: model.ChatRoleAssistant, Content: message, Intent: &intent,
	}); err != nil {
		return nil, fmt.Errorf("service.respondBudgetWizard: %w", err)
	}
	actionType := string(model.ChatIntentBudgetWizard)
	return &dto.ChatResponse{
		Message:        message,
		Intent:         string(model.ChatIntentBudgetWizard),
		Actions:        []dto.ChatActionResponse{},
		ConversationID: conversationID,
		ActionType:     &actionType,
	}, nil
}
