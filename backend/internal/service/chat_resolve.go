package service

import (
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// dropReason tracks why a proposed transaction never made it into actions[] —
// used only to pick a more specific ambiguous message (spec.md S-AI-06 vs
// S-AI-07), never surfaced to the client as structured data.
type dropReason int

const (
	dropReasonNone dropReason = iota
	dropReasonNoWallet
	// dropReasonNoVNDWallet does NOT drop the item: the caller owns no VND
	// Wallet, so the proposal is kept with a nil WalletID and the client makes
	// the User pick one before saving (ai-chat-image-capture spec BR-13, AC-31).
	dropReasonNoVNDWallet
	dropReasonOther
)

// proposalCurrency is the only currency an AI proposal may target: the AI
// reads every amount as VND and never converts (ai-chat-image-capture BR-13).
const proposalCurrency = common.WalletDefaultCurrency

// actionTypeCreateTransaction is the ChatActionResponse.Type of every proposal.
const actionTypeCreateTransaction = "create_transaction"

// resolveActions filters+resolves the AI Service's raw proposals into
// confirmable actions: type/category structural validity, category/wallet
// ownership re-validation (spec.md Resolved design decision #4), VND-Wallet
// resolution, and per-item idempotency-key generation. Deliberately does NOT
// gate on Confidence — a below-threshold guess still becomes a confirmable
// action (renderConfirmMessage frames it as a guess). A structurally invalid
// item is omitted and counted in skipped — never a distinct error.
//
// Takes no context and issues no repository calls: the caller's own
// Wallets/Categories are already loaded, and membership in those slices IS
// the ownership check, so re-querying per item would be an avoidable N+1.
func resolveActions(wallets []*model.Wallet, categories []*model.Category, proposed []AIProposedTransaction) (actions []dto.ChatActionResponse, skipped int, sawWalletDrop bool) {
	walletByID := indexWalletsByID(wallets)
	categoryByID := indexCategoriesByID(categories)

	actions = make([]dto.ChatActionResponse, 0, len(proposed))

	for _, p := range proposed {
		if p.TxType != string(model.TransactionTypeIncome) && p.TxType != string(model.TransactionTypeExpense) {
			skipped++
			continue
		}
		categoryID, err := uuid.Parse(p.CategoryID)
		if err != nil {
			skipped++
			continue
		}
		// The category's Type must match the proposed type, exactly like
		// TransactionService's own check (S-TRX-14) — caught here so the client
		// never renders a card guaranteed to fail with CATEGORY_TYPE_MISMATCH.
		category, ok := categoryByID[categoryID]
		if !ok || string(category.Type) != p.TxType {
			skipped++
			continue
		}
		// Bound checked before multiplying so an absurd AI reading can never
		// overflow int64 or exceed what POST /transactions accepts.
		if p.AmountVND <= 0 || p.AmountVND > common.MaxTransactionAmountCents/common.VNDToCentsFactor {
			skipped++
			continue
		}

		walletID, reason := resolveWallet(wallets, walletByID, p.WalletID)
		if walletID == nil && reason != dropReasonNoVNDWallet {
			sawWalletDrop = sawWalletDrop || reason == dropReasonNoWallet
			skipped++
			continue
		}

		occurredAt, err := parseFlexibleTimestamp(p.OccurredAt)
		if err != nil {
			occurredAt = time.Now().UTC()
		}

		actions = append(actions, dto.ChatActionResponse{
			Type: actionTypeCreateTransaction,
			Payload: dto.TransactionActionPayload{
				WalletID:   walletID,
				CategoryID: categoryID,
				// The AI Service returns whole VND (50000 for "50k"); amounts are
				// BIGINT xu everywhere else. Never converted to another currency —
				// resolveWallet only ever picks a VND Wallet.
				Amount:     p.AmountVND * common.VNDToCentsFactor,
				Type:       p.TxType,
				Note:       p.Note,
				OccurredAt: occurredAt,
			},
			IdempotencyKey: uuid.New(),
			Confidence:     p.Confidence,
		})
	}
	return actions, skipped, sawWalletDrop
}

// resolveWallet returns the caller-owned VND Wallet an item should use.
// Step 1 (unchanged): the AI's explicit wallet_id if it names one of the
// caller's Wallets, else the default Wallet, else nil (dropReasonNoWallet).
// Step 2 (BR-13): if that Wallet is not VND, use the default Wallet when it
// is VND, else the earliest-created VND Wallet, else nil with
// dropReasonNoVNDWallet (item kept wallet-less).
func resolveWallet(wallets []*model.Wallet, walletByID map[uuid.UUID]*model.Wallet, walletIDStr *string) (*uuid.UUID, dropReason) {
	chosen, reason := resolveNamedOrDefaultWallet(wallets, walletByID, walletIDStr)
	if chosen == nil {
		return nil, reason
	}
	if chosen.Currency != proposalCurrency {
		chosen = fallbackVNDWallet(wallets)
		if chosen == nil {
			return nil, dropReasonNoVNDWallet
		}
	}
	id := chosen.ID
	return &id, dropReasonNone
}

func resolveNamedOrDefaultWallet(wallets []*model.Wallet, walletByID map[uuid.UUID]*model.Wallet, walletIDStr *string) (*model.Wallet, dropReason) {
	if walletIDStr != nil {
		walletID, err := uuid.Parse(*walletIDStr)
		if err != nil {
			return nil, dropReasonOther
		}
		w, ok := walletByID[walletID]
		if !ok {
			return nil, dropReasonOther
		}
		return w, dropReasonNone
	}
	for _, w := range wallets {
		if w.IsDefault {
			return w, dropReasonNone
		}
	}
	return nil, dropReasonNoWallet
}

// fallbackVNDWallet picks the default Wallet when it is VND, else the
// earliest-created VND Wallet (ties keep slice order), else nil.
func fallbackVNDWallet(wallets []*model.Wallet) *model.Wallet {
	var earliest *model.Wallet
	for _, w := range wallets {
		if w.Currency != proposalCurrency {
			continue
		}
		if w.IsDefault {
			return w
		}
		if earliest == nil || w.CreatedAt.Before(earliest.CreatedAt) {
			earliest = w
		}
	}
	return earliest
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
