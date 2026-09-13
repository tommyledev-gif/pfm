package dto

import (
	"github.com/google/uuid"
)

// ImportRow is one fully-resolved, validated spreadsheet row — the shape
// Preview returns in `valid` AND the shape carried verbatim inside the signed
// import_token through to Commit (specs/transaction-export-import/spec.md
// Context #6). One type, not two: the client renders exactly the rows Commit
// will attempt, so a divergence between "what preview showed" and "what
// commit wrote" is impossible by construction.
//
// ⚠️ Amount is integer cents, already converted from the file's major-unit
// `Amount` column. That conversion happens exactly once, at Preview time
// (common.MajorUnitsToCents), and never again anywhere downstream.
type ImportRow struct {
	// Row is the 1-based worksheet row number, so an error message can name
	// the row the user actually sees in Excel (spec.md S-TXI-14).
	Row            int       `json:"row"`
	WalletID       uuid.UUID `json:"wallet_id"`
	CategoryID     uuid.UUID `json:"category_id"`
	Amount         int64     `json:"amount"`
	Type           string    `json:"type"`
	OccurredAt     string    `json:"occurred_at"`
	Note           *string   `json:"note"`
	IdempotencyKey uuid.UUID `json:"idempotency_key"`
}

// ImportRowIssue is one row that will not be imported, with the reason shown
// to the user verbatim. Used for both the `duplicates` and `errors` buckets —
// they differ in meaning (an intentional skip vs. a data problem), not in
// shape.
type ImportRowIssue struct {
	Row    int    `json:"row"`
	Reason string `json:"reason"`
}

// ImportPreviewResponse is the body of POST /transactions/import/preview
// (spec.md US-02 Response Shape). Nothing here is persisted server-side —
// ImportToken is the entire state this endpoint produces.
type ImportPreviewResponse struct {
	Valid       []ImportRow      `json:"valid"`
	Duplicates  []ImportRowIssue `json:"duplicates"`
	Errors      []ImportRowIssue `json:"errors"`
	ImportToken string           `json:"import_token"`
}

// ImportCommitRequest is the body of POST /transactions/import/commit. No
// file is re-uploaded — the token carries the rows.
type ImportCommitRequest struct {
	ImportToken string `json:"import_token" validate:"required,jwt"`
}

// ImportCommitResponse reports what actually happened, per row bucket
// (spec.md US-03 step 5 / plan.md Finding #10):
//
//   - Imported — CreateTransaction wrote a new Transaction.
//   - Skipped  — CreateTransaction reported a replay: this row's deterministic
//     idempotency_key already existed, so it was an intentional no-op (a
//     double-commit, or a re-import of a file already imported).
//   - Failed   — anything else, e.g. a balance-floor rejection from a race
//     since Preview (S-TXI-23), or a wallet/category deleted in between.
//     Never silently folded into Skipped.
type ImportCommitResponse struct {
	Imported int              `json:"imported"`
	Skipped  int              `json:"skipped"`
	Failed   int              `json:"failed"`
	Failures []ImportRowIssue `json:"failures"`
}
