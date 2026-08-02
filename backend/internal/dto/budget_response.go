package dto

import (
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// LimitEntryResponse is one currency's limit plus its computed spend status
// (spec.md Response Shape, US-02). Spent/Remaining are currently always 0/
// full-limit — see model.BudgetLimit's doc comment (Finding #1 / BUD-T17).
type LimitEntryResponse struct {
	Currency    string `json:"currency"`
	AmountLimit int64  `json:"amount_limit"`
	Spent       int64  `json:"spent"`
	Remaining   int64  `json:"remaining"`
	Status      string `json:"status"`
}

// BudgetResponse is the explicit field whitelist for any endpoint that
// returns a Budget — same convention as WalletResponse/CategoryResponse.
// StartDate is formatted as a plain date ("YYYY-MM-DD"), matching the
// domain's DATE column (no time-of-day component, spec.md Domain Fields).
type BudgetResponse struct {
	ID           uuid.UUID            `json:"id"`
	CategoryID   uuid.UUID            `json:"category_id"`
	CategoryName string               `json:"category_name"`
	Period       string               `json:"period"`
	StartDate    string               `json:"start_date"`
	Limits       []LimitEntryResponse `json:"limits"`
	Status       string               `json:"status"`
	CreatedAt    time.Time            `json:"created_at"`
	UpdatedAt    time.Time            `json:"updated_at"`
}

func NewBudgetResponse(b *model.Budget) BudgetResponse {
	limits := make([]LimitEntryResponse, 0, len(b.Limits))
	for _, l := range b.Limits {
		limits = append(limits, LimitEntryResponse{
			Currency:    l.Currency,
			AmountLimit: l.AmountLimit,
			Spent:       l.Spent,
			Remaining:   l.Remaining,
			Status:      string(l.Status),
		})
	}
	return BudgetResponse{
		ID:           b.ID,
		CategoryID:   b.CategoryID,
		CategoryName: b.CategoryName,
		Period:       b.Period,
		StartDate:    b.StartDate.Format(common.DateOnlyLayout),
		Limits:       limits,
		Status:       string(b.OverallStatus),
		CreatedAt:    b.CreatedAt,
		UpdatedAt:    b.UpdatedAt,
	}
}

type ListBudgetsResponse struct {
	Data []BudgetResponse `json:"data"`
}

func NewListBudgetsResponse(budgets []*model.Budget) ListBudgetsResponse {
	items := make([]BudgetResponse, 0, len(budgets))
	for _, b := range budgets {
		items = append(items, NewBudgetResponse(b))
	}
	return ListBudgetsResponse{Data: items}
}
