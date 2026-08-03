package model

import "github.com/google/uuid"

// ReportTypeAmount is one raw (type, currency) aggregate row — a flat,
// uncomputed mapping of ReportRepository.SumTotals' query result, same
// convention as GetTransactionByID's row->model mapping. ReportService pivots
// this into ReportTotal (income/expense/net per currency); the pivot and the
// Net derivation are a business computation and belong in the Service layer,
// mirroring BudgetService.computeStatus owning Spent/Remaining/Status instead
// of BudgetRepository.
type ReportTypeAmount struct {
	Type     string
	Currency string
	Amount   int64
}

// ReportTotal is one currency's income/expense/net total for a report window
// (specs/financial-reporting/spec.md US-01) — computed live at request time
// by ReportService, never persisted. Zero framework imports, same convention
// as model.Wallet/model.Budget. Currencies with zero matching Transactions in
// the window simply have no entry (spec.md Edge Cases US-01 #4) — there is no
// "zero" ReportTotal.
type ReportTotal struct {
	Currency     string
	TotalIncome  int64
	TotalExpense int64
	Net          int64
}

// ReportCategoryEntry is one (category, type, currency) combination's summed
// amount for a report window (spec.md US-01). CategoryName resolves even when
// the Category has since been soft-deleted (spec.md S-RPT-10), mirroring
// model.Transaction's CategoryName precedent.
type ReportCategoryEntry struct {
	CategoryID   uuid.UUID
	CategoryName string
	Type         string
	Currency     string
	Amount       int64
}
