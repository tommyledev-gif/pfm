package dto

// ExportTransactionsQuery is the query-string binding for
// GET /transactions/export (specs/transaction-export-import/spec.md US-01).
//
// From/To are required here, unlike ListTransactionsQuery's own optional
// pair (S-TXI-05): an unbounded export has no natural page cap to fall back
// on. Both stay plain strings and are parsed in TransactionExportService,
// matching ListTransactionsQuery's convention — Fiber's query binder has no
// pointer-to-time.Time support, and the parse belongs in the service anyway.
type ExportTransactionsQuery struct {
	From     string `query:"from" validate:"required,datetime=2006-01-02"`
	To       string `query:"to" validate:"required,datetime=2006-01-02"`
	WalletID string `query:"wallet_id" validate:"omitempty,uuid4"`
}
