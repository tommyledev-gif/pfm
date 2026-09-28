package dto

import (
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
)

// TransactionResponse is the explicit field whitelist for any endpoint that
// returns a Transaction — same convention as WalletResponse/BudgetResponse.
// WalletName/CategoryName are denormalized for direct display (spec.md
// Response Shape); CategoryName resolves even for a since-soft-deleted
// Category (spec.md Business invariants, S-TRX-30). WalletBalance is
// `omitempty`/nil on GET (US-02/US-03) — it is only ever populated by
// NewTransactionResponseWithBalance, for the mutating endpoints (US-01/US-04)
// whose spec.md main flow explicitly returns the Wallet's new balance
// alongside the Transaction.
type TransactionResponse struct {
	ID            uuid.UUID `json:"id"`
	WalletID      uuid.UUID `json:"wallet_id"`
	WalletName    string    `json:"wallet_name"`
	CategoryID    uuid.UUID `json:"category_id"`
	CategoryName  string    `json:"category_name"`
	Amount        int64     `json:"amount"`
	Type          string    `json:"type"`
	Note          *string   `json:"note"`
	OccurredAt    time.Time `json:"occurred_at"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	WalletBalance *int64    `json:"wallet_balance,omitempty"`
	// ToWalletID / ToWalletName are the destination of a transfer; null for
	// income and expense.
	ToWalletID   *uuid.UUID `json:"to_wallet_id"`
	ToWalletName *string    `json:"to_wallet_name"`
}

func NewTransactionResponse(t *model.Transaction) TransactionResponse {
	return TransactionResponse{
		ID:           t.ID,
		WalletID:     t.WalletID,
		WalletName:   t.WalletName,
		CategoryID:   t.CategoryID,
		CategoryName: t.CategoryName,
		Amount:       t.Amount,
		Type:         string(t.Type),
		Note:         t.Note,
		OccurredAt:   t.OccurredAt,
		CreatedAt:    t.CreatedAt,
		UpdatedAt:    t.UpdatedAt,
		ToWalletID:   t.ToWalletID,
		ToWalletName: t.ToWalletName,
	}
}

// NewTransactionResponseWithBalance attaches the Wallet's new balance —
// walletBalance nil means the balance wasn't touched by this call (e.g. an
// US-04 update that changed only note/category/date), so the field is
// omitted from the JSON response entirely rather than sent as a stale value.
func NewTransactionResponseWithBalance(t *model.Transaction, walletBalance *int64) TransactionResponse {
	r := NewTransactionResponse(t)
	r.WalletBalance = walletBalance
	return r
}

// ListTransactionsResponse's NextCursor mirrors dto.PaginationResponse's
// NextCursor (F-01) in shape, but is not that same type.
//
// Total is how many rows match the request's filters in full, and is present
// on the first page only — null on any cursor-fetched page, since the figure
// can't change as the client pages through the same filters. It was
// deliberately absent originally (spec.md Response Shape defines only
// `data`/`next_cursor`, and a COUNT over a growing table looked unnecessary),
// but the Transactions screen's header badge has no other way to say how many
// transactions a filter actually matched: counting the rows it received only
// ever reported the page size.
type ListTransactionsResponse struct {
	Data       []TransactionResponse `json:"data"`
	NextCursor *string               `json:"next_cursor"`
	Total      *int64                `json:"total"`
}

func NewListTransactionsResponse(transactions []*model.Transaction, nextCursor *string, total *int64) ListTransactionsResponse {
	items := make([]TransactionResponse, 0, len(transactions))
	for _, t := range transactions {
		items = append(items, NewTransactionResponse(t))
	}
	return ListTransactionsResponse{Data: items, NextCursor: nextCursor, Total: total}
}
