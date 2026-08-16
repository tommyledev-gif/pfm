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
// short-circuit, the AI Service call, ownership re-validation, the
// confidence gate, default-Wallet resolution, idempotency-key
// pre-generation, and assistant-reply templating. Shape validation
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

// dropReason tracks why a proposed transaction never made it into actions[] —
// used only to pick a more specific ambiguous message (spec.md S-AI-06 vs
// S-AI-07), never surfaced to the client as structured data.
type dropReason int

const (
	dropReasonNone dropReason = iota
	dropReasonNoWallet
	dropReasonOther
)

// Chat implements US-01's propose step (POST /ai/chat). Never writes to
// transactions — every surviving action is only a proposal until the client
// calls the existing POST /transactions confirm step.
func (s *ChatService) Chat(ctx context.Context, userID uuid.UUID, req dto.ChatRequest) (*dto.ChatResponse, error) {
	conversationID := uuid.New()
	if req.ConversationID != nil {
		conversationID = *req.ConversationID
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
		Wallets:    toAIWalletContexts(wallets),
		Categories: toAICategoryContexts(categories),
		Now:        time.Now().UTC(),
	})
	if err != nil {
		s.logger.Warn("ai service unavailable", zap.Error(err))
		return nil, common.ErrAIServiceUnavailable
	}

	actions, sawWalletDrop := s.resolveActions(userID, wallets, categories, extractResp.Transactions)
	if len(actions) == 0 {
		message := "Chi hay thu? Danh mục gì?"
		if sawWalletDrop {
			message = "Vui lòng cho biết bạn muốn dùng ví nào."
		}
		return s.respondAmbiguous(ctx, userID, conversationID, message)
	}

	message := renderConfirmMessage(len(actions))
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

// resolveActions filters+resolves the AI Service's raw proposals into
// confirmable actions: confidence gate, category/wallet ownership
// re-validation (spec.md Resolved design decision #4), default-Wallet
// resolution, and per-item idempotency-key generation. A failed item is
// simply omitted — never a distinct error (spec.md S-AI-08/S-AI-09).
//
// Deliberately takes no context.Context and issues no repository calls — the
// caller's own Wallets/Categories are already fully loaded in memory
// (ListWalletsByUser/ListCategoriesForUser in Chat), and membership in those
// slices already IS the ownership/visibility check, so re-querying per item
// would be an avoidable N+1 (one query per proposed transaction) for no
// additional correctness.
func (s *ChatService) resolveActions(userID uuid.UUID, wallets []*model.Wallet, categories []*model.Category, proposed []AIProposedTransaction) ([]dto.ChatActionResponse, bool) {
	walletByID := indexWalletsByID(wallets)
	categoryByID := indexCategoriesByID(categories)

	actions := make([]dto.ChatActionResponse, 0, len(proposed))
	sawWalletDrop := false

	for _, p := range proposed {
		if p.Confidence < common.AIChatConfidenceThreshold {
			continue
		}
		if p.TxType != string(model.TransactionTypeIncome) && p.TxType != string(model.TransactionTypeExpense) {
			continue
		}
		categoryID, err := uuid.Parse(p.CategoryID)
		if err != nil {
			continue
		}
		// The category must not just be visible to the caller — its Type
		// must match the proposed Transaction's type, exactly like
		// TransactionService's own category-type-match check
		// (transaction-management/spec.md S-TRX-14). Caught here too, not
		// only at confirm time, so the client never renders a card that is
		// guaranteed to fail with 422 CATEGORY_TYPE_MISMATCH on confirm
		// (found via live testing against the real Groq API).
		category, ok := categoryByID[categoryID]
		if !ok || string(category.Type) != p.TxType {
			continue
		}
		if p.AmountVND <= 0 {
			continue
		}

		walletID, reason := resolveWallet(wallets, walletByID, p.WalletID)
		if walletID == nil {
			sawWalletDrop = sawWalletDrop || reason == dropReasonNoWallet
			continue
		}

		occurredAt, err := parseFlexibleTimestamp(p.OccurredAt)
		if err != nil {
			occurredAt = time.Now().UTC()
		}

		actions = append(actions, dto.ChatActionResponse{
			Type: "create_transaction",
			Payload: dto.TransactionActionPayload{
				WalletID:   *walletID,
				CategoryID: categoryID,
				// The AI Service returns a plain VND integer (e.g. 50000 for
				// "50k") — this app's amount fields are BIGINT integer cents
				// everywhere else (CLAUDE.md: "Money trong API: integer
				// cents"; the manual create-transaction form's toCents()
				// helper does this same conversion at its own client
				// boundary). Found via live testing: omitting this made
				// every AI-proposed amount display 100x too small.
				Amount:     p.AmountVND * common.VNDToCentsFactor,
				Type:       p.TxType,
				Note:       p.Note,
				OccurredAt: occurredAt,
			},
			IdempotencyKey: uuid.New(),
			Confidence:     p.Confidence,
		})
	}
	return actions, sawWalletDrop
}

// resolveWallet returns the caller-owned Wallet ID an item should use — the
// AI's explicit wallet_id if it names one of the caller's already-loaded
// Wallets, else the caller's default Wallet, else nil (dropReasonNoWallet) if
// neither exists (spec.md Main Flow step 7, S-AI-05/S-AI-06). walletByID is
// built from the same caller-owned slice ListWalletsByUser already returned —
// membership in it already is the ownership check.
func resolveWallet(wallets []*model.Wallet, walletByID map[uuid.UUID]*model.Wallet, walletIDStr *string) (*uuid.UUID, dropReason) {
	if walletIDStr != nil {
		walletID, err := uuid.Parse(*walletIDStr)
		if err != nil {
			return nil, dropReasonOther
		}
		if _, ok := walletByID[walletID]; !ok {
			return nil, dropReasonOther
		}
		return &walletID, dropReasonNone
	}
	for _, w := range wallets {
		if w.IsDefault {
			id := w.ID
			return &id, dropReasonNone
		}
	}
	return nil, dropReasonNoWallet
}

func indexWalletsByID(wallets []*model.Wallet) map[uuid.UUID]*model.Wallet {
	out := make(map[uuid.UUID]*model.Wallet, len(wallets))
	for _, w := range wallets {
		out[w.ID] = w
	}
	return out
}

func indexCategoriesByID(categories []*model.Category) map[uuid.UUID]*model.Category {
	out := make(map[uuid.UUID]*model.Category, len(categories))
	for _, c := range categories {
		out[c.ID] = c
	}
	return out
}

func toAIWalletContexts(wallets []*model.Wallet) []AIWalletContext {
	out := make([]AIWalletContext, 0, len(wallets))
	for _, w := range wallets {
		out = append(out, AIWalletContext{ID: w.ID, Name: w.Name, IsDefault: w.IsDefault, Currency: w.Currency})
	}
	return out
}

func toAICategoryContexts(categories []*model.Category) []AICategoryContext {
	out := make([]AICategoryContext, 0, len(categories))
	for _, c := range categories {
		out = append(out, AICategoryContext{ID: c.ID, Name: c.Name, Type: string(c.Type)})
	}
	return out
}

// renderConfirmMessage is deliberately simple and data-driven, not a second
// LLM call for phrasing (specs/ai-chat-assistant/plan.md Finding #2) — the
// per-action detail (amount, category, wallet, date) lives in the
// confirmation cards, not in this lead-in sentence.
func renderConfirmMessage(n int) string {
	if n == 1 {
		return "Đã đề xuất 1 giao dịch, vui lòng xác nhận."
	}
	return fmt.Sprintf("Đã đề xuất %d giao dịch, vui lòng xác nhận.", n)
}
