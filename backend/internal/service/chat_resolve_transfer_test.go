package service

import (
	"testing"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

func testTransferProposal(source, destination *uuid.UUID) AIProposedTransaction {
	p := AIProposedTransaction{AmountVND: testAmountVND, TxType: "transfer", OccurredAt: "2026-10-02", Confidence: 0.9}
	if source != nil {
		s := source.String()
		p.WalletID = &s
	}
	if destination != nil {
		d := destination.String()
		p.ToWalletID = &d
	}
	return p
}

func resolveTransfer(t *testing.T, wallets []*model.Wallet, p AIProposedTransaction) (actions int, skipped int, payloadTo *uuid.UUID, payloadFrom *uuid.UUID, categoryID uuid.UUID) {
	t.Helper()
	got, skippedCount, _ := resolveActions(wallets, []*model.Category{testExpenseCategory()}, []AIProposedTransaction{p})
	if len(got) == 0 {
		return 0, skippedCount, nil, nil, uuid.Nil
	}
	return len(got), skippedCount, got[0].Payload.ToWalletID, got[0].Payload.WalletID, got[0].Payload.CategoryID
}

func TestResolveActions_Transfer_BothWalletsNamed(t *testing.T) {
	bank := testWallet("VCB", common.WalletDefaultCurrency, true, 0)
	momo := testWallet("MoMo", common.WalletDefaultCurrency, false, 1)

	actions, skipped, to, from, categoryID := resolveTransfer(t, []*model.Wallet{bank, momo}, testTransferProposal(&bank.ID, &momo.ID))
	if actions != 1 || skipped != 0 {
		t.Fatalf("expected 1 action and 0 skipped, got %d, %d", actions, skipped)
	}
	if from == nil || *from != bank.ID {
		t.Fatalf("expected source %s, got %v", bank.ID, from)
	}
	if to == nil || *to != momo.ID {
		t.Fatalf("expected destination %s, got %v", momo.ID, to)
	}
	if categoryID != uuid.Nil {
		t.Fatalf("a transfer carries no category, got %s", categoryID)
	}
}

// No source named: the default Wallet, like income/expense.
func TestResolveActions_Transfer_SourceDefaultsToDefaultWallet(t *testing.T) {
	cash := testWallet("Tiền mặt", common.WalletDefaultCurrency, true, 0)
	momo := testWallet("MoMo", common.WalletDefaultCurrency, false, 1)

	_, _, to, from, _ := resolveTransfer(t, []*model.Wallet{cash, momo}, testTransferProposal(nil, &momo.ID))
	if from == nil || *from != cash.ID {
		t.Fatalf("expected default source %s, got %v", cash.ID, from)
	}
	if to == nil || *to != momo.ID {
		t.Fatalf("expected destination %s, got %v", momo.ID, to)
	}
}

// A destination that is missing, the source itself, unknown or not VND is
// left for the User to pick — the proposal itself is kept.
func TestResolveActions_Transfer_UnusableDestinationLeftNil(t *testing.T) {
	bank := testWallet("VCB", common.WalletDefaultCurrency, true, 0)
	usd := testWallet("Ví USD", testCurrencyUSD, false, 1)
	unknown := uuid.New()

	cases := map[string]AIProposedTransaction{
		"missing":     testTransferProposal(&bank.ID, nil),
		"same wallet": testTransferProposal(&bank.ID, &bank.ID),
		"unknown":     testTransferProposal(&bank.ID, &unknown),
		"other ccy":   testTransferProposal(&bank.ID, &usd.ID),
	}
	for name, p := range cases {
		t.Run(name, func(t *testing.T) {
			actions, skipped, to, _, _ := resolveTransfer(t, []*model.Wallet{bank, usd}, p)
			if actions != 1 || skipped != 0 {
				t.Fatalf("expected the proposal kept, got %d actions, %d skipped", actions, skipped)
			}
			if to != nil {
				t.Fatalf("expected no destination, got %s", *to)
			}
		})
	}
}

func TestResolveActions_Transfer_InvalidAmountSkipped(t *testing.T) {
	bank := testWallet("VCB", common.WalletDefaultCurrency, true, 0)
	momo := testWallet("MoMo", common.WalletDefaultCurrency, false, 1)
	p := testTransferProposal(&bank.ID, &momo.ID)
	p.AmountVND = 0

	actions, skipped, _, _, _ := resolveTransfer(t, []*model.Wallet{bank, momo}, p)
	if actions != 0 || skipped != 1 {
		t.Fatalf("expected the proposal skipped, got %d actions, %d skipped", actions, skipped)
	}
}
