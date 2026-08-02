package model

import (
	"time"

	"github.com/google/uuid"
)

// BudgetStatus values — "exceeded" when spent > amount_limit, else "within"
// (specs/budget-management/spec.md US-02 step 5). Applies both per currency
// entry and to a Budget's overall status.
type BudgetStatus string

const (
	BudgetStatusWithin   BudgetStatus = "within"
	BudgetStatusExceeded BudgetStatus = "exceeded"
)

// BudgetLimit is one currency's spending ceiling on a Budget, plus its
// computed spend/remaining/status. AmountLimit is stored (BIGINT integer
// cents); Spent/Remaining/Status are always computed at read time by
// BudgetService (never persisted) — see spec.md US-02 Edge Cases #1.
//
// Spent is currently always 0 (BudgetService.computeStatus is a stub —
// specs/budget-management/plan.md Finding #1 / BUD-T17): the `transactions`
// table F-06 would aggregate from does not exist yet.
type BudgetLimit struct {
	Currency    string
	AmountLimit int64
	Spent       int64
	Remaining   int64
	Status      BudgetStatus
}

// Budget is the domain representation of the budgets table (plus its
// budget_limits child rows). Zero framework imports, same convention as
// model.Wallet/model.Category. CategoryName is denormalized for direct
// response display (spec.md US-02 Edge Cases #5) — not a stored column on
// budgets itself.
type Budget struct {
	ID            uuid.UUID
	UserID        uuid.UUID
	CategoryID    uuid.UUID
	CategoryName  string
	Period        string
	StartDate     time.Time
	Limits        []BudgetLimit
	OverallStatus BudgetStatus
	CreatedAt     time.Time
	UpdatedAt     time.Time
	DeletedAt     *time.Time
}
