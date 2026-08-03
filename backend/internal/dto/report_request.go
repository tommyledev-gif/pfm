package dto

// ReportSummaryQuery is the query-string binding for GET /reports/summary
// (spec.md US-01 through US-05 — Context decision #1: one endpoint, query
// params vary by User Story). Every filter is a plain string (mirroring
// dto.ListTransactionsQuery's convention), parsed and validated in
// ReportService.GetSummary — Fiber's query binder doesn't natively support
// pointer-to-uuid.UUID/pointer-to-time.Time.
type ReportSummaryQuery struct {
	From       string `query:"from"`
	To         string `query:"to"`
	WalletID   string `query:"wallet_id" validate:"omitempty,uuid4"`
	CategoryID string `query:"category_id" validate:"omitempty,uuid4"`
	Type       string `query:"type" validate:"omitempty,oneof=income expense"`
}
