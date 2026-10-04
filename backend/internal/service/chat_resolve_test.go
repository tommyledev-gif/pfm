package service

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

const (
	testCurrencyUSD = "USD"
	testAmountVND   = 45000
)

var testWalletEpoch = time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

func testWallet(name, currency string, isDefault bool, createdDaysAfterEpoch int) *model.Wallet {
	return &model.Wallet{
		ID: uuid.New(), Name: name, Currency: currency, IsDefault: isDefault,
		CreatedAt: testWalletEpoch.AddDate(0, 0, createdDaysAfterEpoch),
	}
}

func testExpenseCategory() *model.Category {
	return &model.Category{ID: uuid.New(), Name: "Ăn uống", Type: model.CategoryTypeExpense}
}

func testProposal(categoryID uuid.UUID, walletID *uuid.UUID) AIProposedTransaction {
	p := AIProposedTransaction{AmountVND: testAmountVND, TxType: "expense", CategoryID: categoryID.String(), OccurredAt: "2026-10-02", Confidence: 0.9}
	if walletID != nil {
		s := walletID.String()
		p.WalletID = &s
	}
	return p
}

func resolveOne(t *testing.T, wallets []*model.Wallet, p AIProposedTransaction, category *model.Category) dto.ChatActionResponse {
	t.Helper()
	actions, skipped, _ := resolveActions(wallets, []*model.Category{category}, []AIProposedTransaction{p})
	if len(actions) != 1 || skipped != 0 {
		t.Fatalf("expected 1 action and 0 skipped, got %d actions, %d skipped", len(actions), skipped)
	}
	return actions[0]
}

func assertWallet(t *testing.T, action dto.ChatActionResponse, want *model.Wallet) {
	t.Helper()
	got := action.Payload.WalletID
	if got == nil || *got != want.ID {
		t.Fatalf("expected wallet %q (%s), got %v", want.Name, want.ID, got)
	}
}

func assertAmountUnconverted(t *testing.T, action dto.ChatActionResponse) {
	t.Helper()
	if want := int64(testAmountVND) * common.VNDToCentsFactor; action.Payload.Amount != want {
		t.Fatalf("expected amount %d xu, got %d", want, action.Payload.Amount)
	}
}

// S-AIIMG-36: naming a USD Wallet never attaches the proposal to it — the
// default VND Wallet is used instead.
func TestResolveActions_NamedUSDWallet_FallsBackToDefaultVND(t *testing.T) {
	cash := testWallet("Tiền mặt", common.WalletDefaultCurrency, true, 1)
	usd := testWallet("Ví USD", testCurrencyUSD, false, 0)
	category := testExpenseCategory()

	action := resolveOne(t, []*model.Wallet{cash, usd}, testProposal(category.ID, &usd.ID), category)
	assertWallet(t, action, cash)
	assertAmountUnconverted(t, action)
}

// S-AIIMG-37: default Wallet is USD → the earliest-created VND Wallet, even
// when a newer VND Wallet comes first in the slice.
func TestResolveActions_DefaultUSD_FallsBackToEarliestVND(t *testing.T) {
	usdDefault := testWallet("USD", testCurrencyUSD, true, 0)
	newerVND := testWallet("Tiền mặt", common.WalletDefaultCurrency, false, 5)
	olderVND := testWallet("MB", common.WalletDefaultCurrency, false, 2)
	category := testExpenseCategory()

	action := resolveOne(t, []*model.Wallet{usdDefault, newerVND, olderVND}, testProposal(category.ID, nil), category)
	assertWallet(t, action, olderVND)
	assertAmountUnconverted(t, action)
}

// S-AIIMG-38: only USD Wallets → the proposal is kept without a Wallet, its
// amount unchanged, and it serializes as wallet_id: null.
func TestResolveActions_NoVNDWallet_KeptWithoutWallet(t *testing.T) {
	usdDefault := testWallet("USD", testCurrencyUSD, true, 0)
	usdOther := testWallet("USD 2", testCurrencyUSD, false, 1)
	category := testExpenseCategory()

	action := resolveOne(t, []*model.Wallet{usdDefault, usdOther}, testProposal(category.ID, nil), category)
	if action.Payload.WalletID != nil {
		t.Fatalf("expected no wallet, got %s", action.Payload.WalletID)
	}
	assertAmountUnconverted(t, action)

	body, err := json.Marshal(action.Payload)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if !strings.Contains(string(body), `"wallet_id":null`) {
		t.Fatalf("expected wallet_id null in JSON, got %s", body)
	}
}

// S-AIIMG-45: all-VND Wallets behave exactly as before — a named VND Wallet
// is kept, and no name falls back to the default.
func TestResolveActions_AllVND_Unchanged(t *testing.T) {
	cash := testWallet("Tiền mặt", common.WalletDefaultCurrency, true, 0)
	mb := testWallet("MB", common.WalletDefaultCurrency, false, 1)
	category := testExpenseCategory()
	wallets := []*model.Wallet{cash, mb}

	assertWallet(t, resolveOne(t, wallets, testProposal(category.ID, &mb.ID), category), mb)
	action := resolveOne(t, wallets, testProposal(category.ID, nil), category)
	assertWallet(t, action, cash)
	assertAmountUnconverted(t, action)
}

// No default and none named keeps today's "which Wallet?" outcome — the
// VND rule never turns that into a wallet-less proposal.
func TestResolveActions_NoDefaultNoneNamed_StillDropped(t *testing.T) {
	vnd := testWallet("MB", common.WalletDefaultCurrency, false, 0)
	category := testExpenseCategory()

	actions, skipped, sawWalletDrop := resolveActions([]*model.Wallet{vnd}, []*model.Category{category}, []AIProposedTransaction{testProposal(category.ID, nil)})
	if len(actions) != 0 || skipped != 1 || !sawWalletDrop {
		t.Fatalf("expected the item dropped as no-wallet, got %d actions, %d skipped, sawWalletDrop=%v", len(actions), skipped, sawWalletDrop)
	}
}

// An amount whose xu value would exceed MaxTransactionAmountCents is skipped,
// never overflowed or proposed.
func TestResolveActions_AmountAboveMax_Skipped(t *testing.T) {
	cash := testWallet("Tiền mặt", common.WalletDefaultCurrency, true, 0)
	category := testExpenseCategory()
	p := testProposal(category.ID, nil)
	p.AmountVND = common.MaxTransactionAmountCents/common.VNDToCentsFactor + 1

	actions, skipped, _ := resolveActions([]*model.Wallet{cash}, []*model.Category{category}, []AIProposedTransaction{p})
	if len(actions) != 0 || skipped != 1 {
		t.Fatalf("expected the item skipped, got %d actions, %d skipped", len(actions), skipped)
	}
}

// S-AIIMG-36 end to end through ChatService.Chat: the typed flow never
// proposes onto the USD Wallet the AI named.
func TestChatService_Chat_NamedUSDWallet_UsesDefaultVND(t *testing.T) {
	userID := uuid.New()
	cash := testWallet("Tiền mặt", common.WalletDefaultCurrency, true, 0)
	usd := testWallet("Ví USD", testCurrencyUSD, false, 1)
	cash.UserID, usd.UserID = userID, userID
	category := testExpenseCategory()
	category.UserID = &userID

	ai := &fakeAIServiceClient{response: &AIExtractResponse{
		Intent:       "create_transaction",
		Transactions: []AIProposedTransaction{testProposal(category.ID, &usd.ID)},
	}}
	svc, _, walletRepo, categoryRepo := newTestChatService(t, ai)
	walletRepo.wallets[cash.ID] = cash
	walletRepo.wallets[usd.ID] = usd
	categoryRepo.categories[category.ID] = category

	resp, err := svc.Chat(context.Background(), userID, dto.ChatRequest{Message: "ăn trưa 45k ví USD"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Actions) != 1 {
		t.Fatalf("expected 1 action, got %d", len(resp.Actions))
	}
	assertWallet(t, resp.Actions[0], cash)
	assertAmountUnconverted(t, resp.Actions[0])
}
