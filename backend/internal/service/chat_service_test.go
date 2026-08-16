package service

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

func newTestChatService(t *testing.T, ai *fakeAIServiceClient) (*ChatService, *fakeChatRepo, *fakeWalletRepo, *fakeCategoryRepo) {
	t.Helper()
	chatRepo := newFakeChatRepo()
	walletRepo := newFakeWalletRepo()
	categoryRepo := newFakeCategoryRepo()
	return NewChatService(chatRepo, walletRepo, categoryRepo, ai, zap.NewNop()), chatRepo, walletRepo, categoryRepo
}

// S-AI-17: a caller with zero non-deleted Wallets gets an ambiguous response
// without ever calling the AI Service (plan.md Finding #9 — cost-saving
// short-circuit).
func TestChatService_Chat_ZeroWallets_ShortCircuits(t *testing.T) {
	ai := &fakeAIServiceClient{}
	svc, chatRepo, _, _ := newTestChatService(t, ai)
	userID := uuid.New()

	resp, err := svc.Chat(context.Background(), userID, dto.ChatRequest{Message: "an trua 50k"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Intent != string(model.ChatIntentAmbiguous) {
		t.Fatalf("expected ambiguous intent, got %s", resp.Intent)
	}
	if len(resp.Actions) != 0 {
		t.Fatalf("expected zero actions, got %d", len(resp.Actions))
	}
	if ai.calls != 0 {
		t.Fatalf("expected zero AI Service calls, got %d", ai.calls)
	}
	if chatRepo.messageCount() != 2 {
		t.Fatalf("expected 2 persisted messages (user + assistant), got %d", chatRepo.messageCount())
	}
}

// S-AI-10: an AI Service failure surfaces as ErrAIServiceUnavailable, never a
// raw error, and the user's message is still persisted.
func TestChatService_Chat_AIServiceUnavailable(t *testing.T) {
	ai := &fakeAIServiceClient{err: errFakeAIServiceUnavailable}
	svc, chatRepo, walletRepo, _ := newTestChatService(t, ai)
	userID := uuid.New()
	walletID := uuid.New()
	walletRepo.wallets[walletID] = &model.Wallet{ID: walletID, UserID: userID, Name: "Cash", IsDefault: true, Currency: "VND"}

	_, err := svc.Chat(context.Background(), userID, dto.ChatRequest{Message: "an trua 50k"})
	assertAppErrCode(t, err, "AI_SERVICE_UNAVAILABLE")
	if chatRepo.messageCount() != 1 {
		t.Fatalf("expected only the user message persisted, got %d", chatRepo.messageCount())
	}
}

// Happy path: a single high-confidence proposal, resolved against the
// caller's default Wallet, produces one confirmable action with its own
// idempotency key.
func TestChatService_Chat_HappyPath_ResolvesDefaultWallet(t *testing.T) {
	userID := uuid.New()
	walletID := uuid.New()
	categoryID := uuid.New()

	ai := &fakeAIServiceClient{response: &AIExtractResponse{
		Intent: "create_transaction",
		Transactions: []AIProposedTransaction{
			{AmountVND: 50000, TxType: "expense", CategoryID: categoryID.String(), OccurredAt: "2026-08-16", Confidence: 0.95},
		},
	}}
	svc, _, walletRepo, categoryRepo := newTestChatService(t, ai)
	walletRepo.wallets[walletID] = &model.Wallet{ID: walletID, UserID: userID, Name: "Cash", IsDefault: true, Currency: "VND"}
	categoryRepo.categories[categoryID] = &model.Category{ID: categoryID, UserID: &userID, Name: "Food", Type: model.CategoryTypeExpense}

	resp, err := svc.Chat(context.Background(), userID, dto.ChatRequest{Message: "an trua 50k"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Intent != string(model.ChatIntentCreateTransaction) {
		t.Fatalf("expected create_transaction intent, got %s", resp.Intent)
	}
	if len(resp.Actions) != 1 {
		t.Fatalf("expected 1 action, got %d", len(resp.Actions))
	}
	action := resp.Actions[0]
	if action.Payload.WalletID != walletID {
		t.Fatalf("expected default wallet %s resolved, got %s", walletID, action.Payload.WalletID)
	}
	// The AI Service's amount_vnd (50000, a plain "50k VND" reading) must be
	// converted to this app's BIGINT-cents storage convention (5000000) —
	// found missing via live user testing, every AI-proposed amount
	// displayed 100x too small (e.g. "500 ₫" instead of "50,000 ₫").
	if action.Payload.Amount != 5000000 {
		t.Fatalf("expected amount converted to cents (5000000), got %d", action.Payload.Amount)
	}
	if action.IdempotencyKey == uuid.Nil {
		t.Fatalf("expected a non-nil idempotency key")
	}
}

// S-AI-08: an item below the confidence threshold is dropped, never surfaced
// for confirmation.
func TestChatService_Chat_LowConfidence_Dropped(t *testing.T) {
	userID := uuid.New()
	walletID := uuid.New()
	categoryID := uuid.New()

	ai := &fakeAIServiceClient{response: &AIExtractResponse{
		Intent: "create_transaction",
		Transactions: []AIProposedTransaction{
			{AmountVND: 50000, TxType: "expense", CategoryID: categoryID.String(), OccurredAt: "2026-08-16", Confidence: 0.4},
		},
	}}
	svc, _, walletRepo, categoryRepo := newTestChatService(t, ai)
	walletRepo.wallets[walletID] = &model.Wallet{ID: walletID, UserID: userID, Name: "Cash", IsDefault: true, Currency: "VND"}
	categoryRepo.categories[categoryID] = &model.Category{ID: categoryID, UserID: &userID, Name: "Food", Type: model.CategoryTypeExpense}

	resp, err := svc.Chat(context.Background(), userID, dto.ChatRequest{Message: "50k?"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Intent != string(model.ChatIntentAmbiguous) || len(resp.Actions) != 0 {
		t.Fatalf("expected ambiguous with zero actions, got intent=%s actions=%d", resp.Intent, len(resp.Actions))
	}
}

// S-AI-09: a category_id the AI Service returns that does not belong to the
// caller is dropped, never surfaced.
func TestChatService_Chat_HallucinatedCategory_Dropped(t *testing.T) {
	userID := uuid.New()
	otherUserID := uuid.New()
	walletID := uuid.New()
	categoryID := uuid.New() // owned by a different user

	ai := &fakeAIServiceClient{response: &AIExtractResponse{
		Intent: "create_transaction",
		Transactions: []AIProposedTransaction{
			{AmountVND: 50000, TxType: "expense", CategoryID: categoryID.String(), OccurredAt: "2026-08-16", Confidence: 0.95},
		},
	}}
	svc, _, walletRepo, categoryRepo := newTestChatService(t, ai)
	walletRepo.wallets[walletID] = &model.Wallet{ID: walletID, UserID: userID, Name: "Cash", IsDefault: true, Currency: "VND"}
	categoryRepo.categories[categoryID] = &model.Category{ID: categoryID, UserID: &otherUserID, Name: "Food", Type: model.CategoryTypeExpense}

	resp, err := svc.Chat(context.Background(), userID, dto.ChatRequest{Message: "an trua 50k"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Intent != string(model.ChatIntentAmbiguous) || len(resp.Actions) != 0 {
		t.Fatalf("expected ambiguous with zero actions for a hallucinated category, got intent=%s actions=%d", resp.Intent, len(resp.Actions))
	}
}

// Found via live testing against the real Groq API: the AI can propose a
// Category that exists and is visible to the caller, but whose Type doesn't
// match the proposed transaction type (e.g. an "expense" transaction pointed
// at an income Category). Must be dropped at propose time, exactly like
// transaction-management/spec.md S-TRX-14's confirm-time rule — never
// surfaced as a card guaranteed to fail with 422 CATEGORY_TYPE_MISMATCH.
func TestChatService_Chat_CategoryTypeMismatch_Dropped(t *testing.T) {
	userID := uuid.New()
	walletID := uuid.New()
	incomeCategoryID := uuid.New()

	ai := &fakeAIServiceClient{response: &AIExtractResponse{
		Intent: "create_transaction",
		Transactions: []AIProposedTransaction{
			{AmountVND: 50000, TxType: "expense", CategoryID: incomeCategoryID.String(), OccurredAt: "2026-08-16", Confidence: 0.95},
		},
	}}
	svc, _, walletRepo, categoryRepo := newTestChatService(t, ai)
	walletRepo.wallets[walletID] = &model.Wallet{ID: walletID, UserID: userID, Name: "Cash", IsDefault: true, Currency: "VND"}
	categoryRepo.categories[incomeCategoryID] = &model.Category{ID: incomeCategoryID, UserID: &userID, Name: "Bonus", Type: model.CategoryTypeIncome}

	resp, err := svc.Chat(context.Background(), userID, dto.ChatRequest{Message: "an trua 50k"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Intent != string(model.ChatIntentAmbiguous) || len(resp.Actions) != 0 {
		t.Fatalf("expected ambiguous with zero actions for a type-mismatched category, got intent=%s actions=%d", resp.Intent, len(resp.Actions))
	}
}

// S-AI-06: the caller has Wallets but none marked default, and the message
// names none — dropped for a wallet-specific reason, distinct message.
func TestChatService_Chat_NoDefaultWallet_Ambiguous(t *testing.T) {
	userID := uuid.New()
	walletID := uuid.New()
	categoryID := uuid.New()

	ai := &fakeAIServiceClient{response: &AIExtractResponse{
		Intent: "create_transaction",
		Transactions: []AIProposedTransaction{
			{AmountVND: 50000, TxType: "expense", CategoryID: categoryID.String(), OccurredAt: "2026-08-16", Confidence: 0.95},
		},
	}}
	svc, _, walletRepo, categoryRepo := newTestChatService(t, ai)
	walletRepo.wallets[walletID] = &model.Wallet{ID: walletID, UserID: userID, Name: "Cash", IsDefault: false, Currency: "VND"}
	categoryRepo.categories[categoryID] = &model.Category{ID: categoryID, UserID: &userID, Name: "Food", Type: model.CategoryTypeExpense}

	resp, err := svc.Chat(context.Background(), userID, dto.ChatRequest{Message: "an trua 50k"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Intent != string(model.ChatIntentAmbiguous) {
		t.Fatalf("expected ambiguous intent, got %s", resp.Intent)
	}
	if resp.Message != "Vui lòng cho biết bạn muốn dùng ví nào." {
		t.Fatalf("expected the wallet-specific ambiguous message, got %q", resp.Message)
	}
}
