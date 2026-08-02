package model

import (
	"time"

	"github.com/google/uuid"
)

type TransactionType string

const (
	TransactionTypeIncome  TransactionType = "income"
	TransactionTypeExpense TransactionType = "expense"
)

// Transaction is the domain representation of the transactions table. Zero
// framework imports, same convention as model.Wallet/model.Category/
// model.Budget. WalletName/CategoryName are denormalized for direct response
// display (spec.md Response Shape) — not stored columns on transactions
// itself. CategoryName resolves even when the Category has since been
// soft-deleted (spec.md Business invariants, S-TRX-30) — the repository join
// backing it is never filtered on the category's deleted_at.
type Transaction struct {
	ID           uuid.UUID
	UserID       uuid.UUID
	WalletID     uuid.UUID
	WalletName   string
	CategoryID   uuid.UUID
	CategoryName string
	Amount       int64
	Type         TransactionType
	Note         *string
	OccurredAt   time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
	DeletedAt    *time.Time
}

// SignedEffect returns this Transaction's effect on its Wallet's balance:
// +Amount for income, -Amount for expense (spec.md Context #2). Used by
// TransactionService to compute the signed delta on Update and the reversal
// on Delete — never re-derived from scratch.
func (t *Transaction) SignedEffect() int64 {
	if t.Type == TransactionTypeIncome {
		return t.Amount
	}
	return -t.Amount
}
