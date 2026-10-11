package model

import (
	"time"

	"github.com/google/uuid"
)

type TransactionType string

const (
	TransactionTypeIncome  TransactionType = "income"
	TransactionTypeExpense TransactionType = "expense"
	// TransactionTypeTransfer moves money between two of the caller's own
	// Wallets: WalletID is the source, ToWalletID the destination
	// (022_transaction_transfer.sql). It is neither income nor expense and is
	// kept out of every income/expense aggregate.
	TransactionTypeTransfer TransactionType = "transfer"
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
	// ToWalletID / ToWalletName are set only for a transfer — the Wallet the
	// money arrived in. nil for income and expense.
	ToWalletID   *uuid.UUID
	ToWalletName *string
	// Location is where the Transaction was recorded (026_transactions_
	// location.sql) — nil when it was created without a map pin. Allowed on
	// any type.
	Location *TransactionLocation
	// Items/Adjustments are loaded only on single-Transaction reads and
	// writes; list rows carry ItemCount alone (specs/transaction-line-items
	// plan F4). Not columns of transactions.
	Items       []TransactionItem
	Adjustments []TransactionAdjustment
	ItemCount   int
}

// TransactionLocation is a map pin plus its optional descriptions. A pin is
// set at creation or never; afterwards it can be moved (Latitude/Longitude
// together with PlaceName, the reverse-geocoded name of the new position) and
// its Note edited, but not removed. Coordinates are float64 on purpose:
// they are a measurement, not money, so CLAUDE.md's no-float rule does not
// apply.
type TransactionLocation struct {
	Latitude  float64
	Longitude float64
	PlaceName *string
	Note      *string
}

// SignedEffect returns this Transaction's effect on its Wallet's balance:
// +Amount for income, -Amount for expense (spec.md Context #2) — and
// -Amount for a transfer, on its SOURCE Wallet. A transfer's destination
// always moves by the exact opposite (-SignedEffect()). Used by
// TransactionService to compute the signed delta on Update and the reversal
// on Delete — never re-derived from scratch.
func (t *Transaction) SignedEffect() int64 {
	if t.Type == TransactionTypeIncome {
		return t.Amount
	}
	return -t.Amount
}
