package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// ChatService owns Feature-12 US-01's business rules — zero-Wallet
// short-circuit, the AI Service call (with recent conversation history for
// context), ownership re-validation, default-Wallet resolution,
// idempotency-key pre-generation, and confidence-aware assistant-reply
// templating. A low-confidence proposal is no longer dropped in favor of a
// generic clarifying question — it's surfaced as a guess for the user to
// confirm or correct, per product direction that the assistant should
// always attempt its best guess rather than bail out. Shape validation
// (message/conversation_id format) stays in dto/handler, never here.
// Depends on WalletRepo/CategoryRepo directly (same precedent as
// TransactionService reusing them for its own ownership checks), alongside
// its own ChatRepo and AIServiceClient.
type ChatService struct {
	repo         ChatRepo
	walletRepo   WalletRepo
	categoryRepo CategoryRepo
	aiClient     AIServiceClient
	logger       *zap.Logger
}

func NewChatService(repo ChatRepo, walletRepo WalletRepo, categoryRepo CategoryRepo, aiClient AIServiceClient, logger *zap.Logger) *ChatService {
	return &ChatService{repo: repo, walletRepo: walletRepo, categoryRepo: categoryRepo, aiClient: aiClient, logger: logger}
}

// Chat implements US-01's propose step (POST /ai/chat). Never writes to
// transactions — every surviving action is only a proposal until the client
// calls the existing POST /transactions confirm step.
func (s *ChatService) Chat(ctx context.Context, userID uuid.UUID, req dto.ChatRequest) (*dto.ChatResponse, error) {
	conversationID := uuid.New()
	if req.ConversationID != nil {
		conversationID = *req.ConversationID
	}

	// Fetched before this turn's own message is written, so it never
	// includes the message currently being processed — the AI Service gets
	// only what was actually said *before* now, to disambiguate a follow-up
	// like "20k" after "mua cà phê ở highlands".
	history, err := s.buildHistory(ctx, userID, conversationID)
	if err != nil {
		return nil, fmt.Errorf("service.Chat: %w", err)
	}

	if _, err := s.repo.CreateChatMessage(ctx, repository.CreateChatMessageParams{
		UserID: userID, ConversationID: conversationID, Role: model.ChatRoleUser, Content: req.Message,
	}); err != nil {
		return nil, fmt.Errorf("service.Chat: %w", err)
	}

	wallets, err := s.walletRepo.ListWalletsByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.Chat: %w", err)
	}
	// Zero Wallets can never produce a confirmable proposal — short-circuit
	// before spending a metered AI Service call on it (spec.md Edge Case #7,
	// plan.md Finding #9 / docs/features.md §6 budget guidance).
	if len(wallets) == 0 {
		return s.respondAmbiguous(ctx, userID, conversationID, "Bạn cần tạo một ví trước khi ghi giao dịch qua chat.")
	}

	categories, err := s.categoryRepo.ListCategoriesForUser(ctx, userID, nil)
	if err != nil {
		return nil, fmt.Errorf("service.Chat: %w", err)
	}

	extractResp, err := s.aiClient.Extract(ctx, AIExtractRequest{
		Message:    req.Message,
		History:    history,
		Wallets:    toAIWalletContexts(wallets),
		Categories: toAICategoryContexts(categories),
		Now:        time.Now().UTC(),
	})
	if err != nil {
		s.logger.Warn("ai service unavailable", zap.Error(err))
		return nil, common.ErrAIServiceUnavailable
	}

	// F-13 AI Budget Setup Wizard's chat trigger (specs/ai-budget-wizard/spec.md
	// US-02) — mutually exclusive with create_transaction for the same
	// message (Edge Cases #3), so this branch returns before any Transaction
	// resolution runs. Never includes actions[] — the wizard itself has no
	// server-side proposal to attach here; the client opens it and lazily
	// calls GET /ai/budget-wizard/prefill (US-01) once tapped.
	if extractResp.Intent == string(model.ChatIntentBudgetWizard) {
		return s.respondBudgetWizard(ctx, userID, conversationID)
	}

	actions, _, sawWalletDrop := resolveActions(wallets, categories, extractResp.Transactions)
	if len(actions) == 0 {
		message := "Chưa hiểu giao dịch này. Thử ghi kèm số tiền, ví dụ \"ăn trưa 50k\"."
		if sawWalletDrop {
			message = "Ghi vào ví nào?"
		}
		return s.respondAmbiguous(ctx, userID, conversationID, message)
	}

	message := renderConfirmMessage(actions)
	intent := model.ChatIntentCreateTransaction
	if _, err := s.repo.CreateChatMessage(ctx, repository.CreateChatMessageParams{
		UserID: userID, ConversationID: conversationID, Role: model.ChatRoleAssistant, Content: message, Intent: &intent,
	}); err != nil {
		return nil, fmt.Errorf("service.Chat: %w", err)
	}

	return &dto.ChatResponse{
		Message:        message,
		Intent:         string(model.ChatIntentCreateTransaction),
		Actions:        actions,
		ConversationID: conversationID,
	}, nil
}

// buildHistory returns the conversation's recent messages in chronological
// order (oldest first) — ListRecentMessagesByConversation itself returns
// newest-first, since that's the natural order for "give me the last N",
// but a transcript handed to the AI Service needs to read top-to-bottom like
// an actual conversation. Only userID's own messages are read: the
// conversation id comes from the request, so it is not proof of ownership.
func (s *ChatService) buildHistory(ctx context.Context, userID, conversationID uuid.UUID) ([]AIChatTurn, error) {
	recent, err := s.repo.ListRecentMessagesByConversation(ctx, userID, conversationID, common.AIChatHistoryLimit)
	if err != nil {
		return nil, err
	}
	history := make([]AIChatTurn, len(recent))
	for i, m := range recent {
		history[len(recent)-1-i] = AIChatTurn{Role: string(m.Role), Content: m.Content}
	}
	return history, nil
}

func (s *ChatService) respondAmbiguous(ctx context.Context, userID, conversationID uuid.UUID, message string) (*dto.ChatResponse, error) {
	intent := model.ChatIntentAmbiguous
	if _, err := s.repo.CreateChatMessage(ctx, repository.CreateChatMessageParams{
		UserID: userID, ConversationID: conversationID, Role: model.ChatRoleAssistant, Content: message, Intent: &intent,
	}); err != nil {
		return nil, fmt.Errorf("service.respondAmbiguous: %w", err)
	}
	return &dto.ChatResponse{
		Message:        message,
		Intent:         string(model.ChatIntentAmbiguous),
		Actions:        []dto.ChatActionResponse{},
		ConversationID: conversationID,
	}, nil
}

// renderConfirmMessage is deliberately simple and data-driven, not a second
// LLM call for phrasing (specs/ai-chat-assistant/plan.md Finding #2) — the
// per-action detail (amount, category, wallet, date) lives in the
// confirmation cards, not in this lead-in sentence. Once resolveActions no
// longer drops a low-confidence guess (it now surfaces it for the user to
// confirm or correct instead of falling back to a generic clarifying
// question), the lead-in itself frames the batch as a guess whenever any
// surfaced action is below the confidence threshold, rather than always
// reading as a confident proposal.
func renderConfirmMessage(actions []dto.ChatActionResponse) string {
	anyLowConfidence := false
	for _, a := range actions {
		if a.Confidence < common.AIChatConfidenceThreshold {
			anyLowConfidence = true
			break
		}
	}
	n := len(actions)
	if anyLowConfidence {
		if n == 1 {
			return "Kiểm tra lại giao dịch bên dưới trước khi lưu."
		}
		return fmt.Sprintf("Kiểm tra lại %d giao dịch bên dưới trước khi lưu.", n)
	}
	if n == 1 {
		return "1 giao dịch chờ xác nhận."
	}
	return fmt.Sprintf("%d giao dịch chờ xác nhận.", n)
}
