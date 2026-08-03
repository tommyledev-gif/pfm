package dto

import (
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
)

// ReportRangeResponse echoes the resolved report window back to the client —
// always the actual from/to used (after defaulting, spec.md Domain Concept
// table), never the raw/possibly-omitted query params.
type ReportRangeResponse struct {
	From time.Time `json:"from"`
	To   time.Time `json:"to"`
}

// ReportTotalResponse is one currency's income/expense/net for the window
// (spec.md US-01 Response Shape). A currency with zero matching Transactions
// simply has no entry in the parent response's Totals slice.
type ReportTotalResponse struct {
	Currency     string `json:"currency"`
	TotalIncome  int64  `json:"total_income"`
	TotalExpense int64  `json:"total_expense"`
	Net          int64  `json:"net"`
}

func newReportTotalResponse(t model.ReportTotal) ReportTotalResponse {
	return ReportTotalResponse{
		Currency:     t.Currency,
		TotalIncome:  t.TotalIncome,
		TotalExpense: t.TotalExpense,
		Net:          t.Net,
	}
}

// ReportCategoryResponse is one (category, type, currency) breakdown row
// (spec.md US-01 Response Shape), ordered amount DESC by the caller
// (ReportRepository.SumByCategory).
type ReportCategoryResponse struct {
	CategoryID   uuid.UUID `json:"category_id"`
	CategoryName string    `json:"category_name"`
	Type         string    `json:"type"`
	Currency     string    `json:"currency"`
	Amount       int64     `json:"amount"`
}

func newReportCategoryResponse(e model.ReportCategoryEntry) ReportCategoryResponse {
	return ReportCategoryResponse{
		CategoryID:   e.CategoryID,
		CategoryName: e.CategoryName,
		Type:         e.Type,
		Currency:     e.Currency,
		Amount:       e.Amount,
	}
}

// ReportSummaryResponse is the body of GET /reports/summary's `data` field —
// covers spec.md US-01 through US-05 (Context decision #1), varying only by
// which query params the caller supplied.
type ReportSummaryResponse struct {
	Range      ReportRangeResponse      `json:"range"`
	Totals     []ReportTotalResponse    `json:"totals"`
	ByCategory []ReportCategoryResponse `json:"by_category"`
}

func NewReportSummaryResponse(from, to time.Time, totals []model.ReportTotal, byCategory []model.ReportCategoryEntry) ReportSummaryResponse {
	totalResponses := make([]ReportTotalResponse, 0, len(totals))
	for _, t := range totals {
		totalResponses = append(totalResponses, newReportTotalResponse(t))
	}
	categoryResponses := make([]ReportCategoryResponse, 0, len(byCategory))
	for _, e := range byCategory {
		categoryResponses = append(categoryResponses, newReportCategoryResponse(e))
	}
	return ReportSummaryResponse{
		Range:      ReportRangeResponse{From: from, To: to},
		Totals:     totalResponses,
		ByCategory: categoryResponses,
	}
}
