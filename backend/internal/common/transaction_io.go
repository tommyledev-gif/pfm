package common

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
)

// Transaction Export/Import (.xlsx) — specs/transaction-export-import/.
//
// Lives in its own file rather than in constants.go: that file is already at
// 273 lines and this feature's constants plus the money-unit helper pair
// would push it past CLAUDE.md's 300-line cap.
const (
	// TransactionImportMaxUploadBytes is the upload ceiling for an imported
	// workbook (spec.md S-TXI-16). Checked against the multipart header's own
	// Size before the file is ever opened, exactly like
	// CategoryIconMaxUploadBytes.
	TransactionImportMaxUploadBytes = 5 * 1024 * 1024 // 5 MiB

	// TransactionImportTokenTTL is how long an import_token minted by Preview
	// stays valid (spec.md Context #6). Short on purpose: the token embeds a
	// snapshot of resolved wallet/category IDs, and committing a stale
	// snapshot after the user has reorganised their wallets is worse than
	// making them preview again.
	TransactionImportTokenTTL = 5 * time.Minute

	// TransactionImportTokenPurpose is the `purpose` claim Commit re-validates
	// before trusting a token's embedded rows (spec.md Context #6). An
	// import_token is never an access token; this claim is what makes that
	// structural rather than a matter of convention.
	TransactionImportTokenPurpose = "transaction_import"

	// TransactionExportMaxRows caps a single synchronous export. The spec
	// deliberately has no async/job-queue export (Open Questions #3), so this
	// is the only thing standing between a pathological account and an
	// unbounded in-memory workbook build. Sized well above the "50k
	// transactions is more than enough for 20 users" note in the spec.
	TransactionExportMaxRows = 100_000

	// TransactionExportSheetName is the single worksheet every exported
	// workbook carries. Import reads the *first* sheet whatever it is named,
	// so this only ever affects what the user sees in Excel.
	TransactionExportSheetName = "Transactions"

	// TransactionExportContentType is the OOXML spreadsheet media type
	// (spec.md US-01 step 5).
	TransactionExportContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

	// TransactionExportCreatedAtLayout formats the read-only `Created At`
	// column (spec.md US-01 Column Schema) — UTC, seconds precision. Distinct
	// from DateOnlyLayout, which formats the `Date` column.
	TransactionExportCreatedAtLayout = "2006-01-02 15:04:05"
)

// TransactionExportColumns is the exact column order of an exported workbook
// (spec.md US-01 Column Schema). Import resolves columns by matching these
// header names case-insensitively rather than by position, so a user who
// reorders or omits an optional column in their own spreadsheet still
// imports cleanly.
var TransactionExportColumns = []string{
	"Date", "Type", "Amount", "Currency", "Category", "Wallet", "Note", "Created At",
}

// TransactionImportRequiredColumns are the headers a file must carry to be
// parseable at all. `Currency` and `Note` are optional (a file without them
// is valid); `Created At` is always ignored on import (spec.md Context #3).
var TransactionImportRequiredColumns = []string{"Date", "Type", "Amount", "Category", "Wallet"}

// TransactionExportTypeLabels maps the stored enum to the display string the
// `Type` column carries (spec.md Context #2) — "Expense"/"Income", not the
// lowercase enum. Import accepts either, case-insensitively.
var TransactionExportTypeLabels = map[string]string{
	"expense":  "Expense",
	"income":   "Income",
	"transfer": "Transfer",
}

// CentsToMajorUnits converts stored integer cents into the major-unit number
// written to the `Amount` column (spec.md Context #1) — the one place in this
// feature where money crosses that boundary in the export direction.
//
// ⚠️ Must stay an exact inverse of MajorUnitsToCents: a round-trip
// export → import has to land on the identical cent value, or every
// re-import silently drifts. The pair is deliberately here, together, rather
// than one ad-hoc conversion in each service.
func CentsToMajorUnits(amountCents int64) float64 {
	return float64(amountCents) / 100
}

// MajorUnitsToCents is CentsToMajorUnits' inverse, parsing whatever the
// `Amount` cell held. Accepts a plain decimal number; a spreadsheet that
// stores the cell as text may carry thousands separators or a trailing
// currency symbol, so those are stripped before parsing rather than rejected
// — a "1.234.567 ₫" cell is a formatting artifact, not a data error.
//
// Returns an error for anything that isn't a number, including an empty cell.
// Range/sign checks are the caller's business rule, not this function's.
func MajorUnitsToCents(raw string) (int64, error) {
	cleaned := normalizeAmountText(raw)
	if cleaned == "" {
		return 0, fmt.Errorf("common.MajorUnitsToCents: empty amount")
	}
	value, err := strconv.ParseFloat(cleaned, 64)
	if err != nil {
		return 0, fmt.Errorf("common.MajorUnitsToCents: %w", err)
	}
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return 0, fmt.Errorf("common.MajorUnitsToCents: amount is not a finite number")
	}
	return int64(math.Round(value * 100)), nil
}

// stripGrouping removes both separators outright.
var stripGrouping = strings.NewReplacer(".", "", ",", "")

// normalizeAmountText strips grouping separators and non-numeric decoration
// from a spreadsheet cell so ParseFloat can read it.
//
// Separator handling is ambiguous by construction — "1.234" is one thousand
// two hundred thirty-four in vi-VN and one-point-two-three-four in en-US.
// Resolved with the standard heuristic:
//
//   - Both "." and "," present → whichever appears LAST is the decimal
//     separator, the other is grouping. Reads "1.234,56" (vi-VN) and
//     "1,234.56" (en-US) identically correctly.
//   - One kind, appearing more than once → all grouping ("1.234.567").
//   - One kind, appearing once → grouping if exactly three digits follow it
//     ("80,000" → 80000), decimal otherwise ("80.5" → 80.5).
//
// The one deliberately-accepted misreading is a genuine "1,500" meaning one
// and a half: for the currencies this app carries (VND has no minor unit in
// practice, USD has two digits) a three-digit tail is overwhelmingly
// grouping.
func normalizeAmountText(raw string) string {
	var kept strings.Builder
	for _, r := range strings.TrimSpace(raw) {
		if (r >= '0' && r <= '9') || r == '.' || r == ',' || r == '-' || r == '+' {
			kept.WriteRune(r)
		}
	}
	s := kept.String()

	dots := strings.Count(s, ".")
	commas := strings.Count(s, ",")
	if dots == 0 && commas == 0 {
		return s
	}

	var decimalAt int
	switch {
	case dots > 0 && commas > 0:
		decimalAt = max(strings.LastIndex(s, "."), strings.LastIndex(s, ","))
	case dots+commas > 1:
		return stripGrouping.Replace(s)
	default:
		only := max(strings.LastIndex(s, "."), strings.LastIndex(s, ","))
		if len(s)-only-1 == 3 {
			return stripGrouping.Replace(s)
		}
		decimalAt = only
	}
	return stripGrouping.Replace(s[:decimalAt]) + "." + s[decimalAt+1:]
}
