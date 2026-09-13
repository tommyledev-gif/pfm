package service

import (
	"crypto/sha256"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// importIdempotencyNamespace is the fixed UUIDv5 namespace every imported
// row's deterministic idempotency_key is derived under
// (specs/transaction-export-import/spec.md Context #5, plan.md Finding #3).
//
// ⚠️ Never change this value. It is what makes re-importing a file a no-op
// instead of a duplicate: a different namespace re-derives different keys for
// rows already in the database, and every previously-imported row would be
// created a second time.
var importIdempotencyNamespace = uuid.MustParse("6f1a1c9e-5b7d-4a8e-9c21-0d3e7b6a4f52")

// deriveIdempotencyKey produces the content-addressed key for one resolved
// row. Deterministic across processes and restarts: the same file, imported
// by the same user, always yields the same keys, and
// transactions.idempotency_key's unique index does the rest.
//
// The field separator is "|" and every field is rendered in a canonical form
// (the wallet/category as their resolved UUIDs, not their spreadsheet names;
// the amount as cents; the date as YYYY-MM-DD) so two spreadsheets that
// differ only in formatting still collapse to one key.
func deriveIdempotencyKey(userID uuid.UUID, row dto.ImportRow) uuid.UUID {
	note := ""
	if row.Note != nil {
		note = *row.Note
	}
	payload := fmt.Sprintf("%s|%s|%s|%d|%s|%s|%s",
		userID, row.WalletID, row.CategoryID, row.Amount, row.Type, row.OccurredAt, note)
	sum := sha256.Sum256([]byte(payload))
	return uuid.NewSHA1(importIdempotencyNamespace, sum[:])
}

// importLookups holds the caller's own wallets and visible categories,
// indexed for name resolution. Built once per Preview, never per row.
type importLookups struct {
	// walletsByName is name → every matching wallet ID, deliberately a slice
	// and not a single ID: F-03 puts no uniqueness constraint on wallet
	// names, so two wallets really can share one (S-TXI-11). A key with more
	// than one entry is an error for every row referencing it — never "pick
	// the first", which would risk money landing in the wrong account.
	walletsByName map[string][]uuid.UUID
	currencyByID  map[uuid.UUID]string
	// categoriesByNameType is (name, type) → category ID. Unlike wallets this
	// is genuinely unique per user+type (F-04's own constraint), so a single
	// ID is correct here.
	categoriesByNameType map[categoryKey]uuid.UUID
}

type categoryKey struct {
	name         string
	categoryType string
}

func buildImportLookups(wallets []*model.Wallet, categories []*model.Category) importLookups {
	lookups := importLookups{
		walletsByName:        make(map[string][]uuid.UUID, len(wallets)),
		currencyByID:         make(map[uuid.UUID]string, len(wallets)),
		categoriesByNameType: make(map[categoryKey]uuid.UUID, len(categories)),
	}
	for _, wallet := range wallets {
		key := normalizeName(wallet.Name)
		lookups.walletsByName[key] = append(lookups.walletsByName[key], wallet.ID)
		lookups.currencyByID[wallet.ID] = wallet.Currency
	}
	for _, category := range categories {
		key := categoryKey{name: normalizeName(category.Name), categoryType: string(category.Type)}
		lookups.categoriesByNameType[key] = category.ID
	}
	return lookups
}

// normalizeName is the matching form for a spreadsheet name cell: trimmed and
// case-folded. Deliberately not more aggressive than that — collapsing
// accents or punctuation would start silently matching things the user
// didn't write, which is the opposite of what an import needs.
func normalizeName(name string) string {
	return strings.ToLower(strings.TrimSpace(name))
}

// resolveRow turns one raw worksheet row into a fully-resolved ImportRow, or
// returns the human-readable reason it can't be imported.
//
// Every check runs against this row alone — nothing here can fail the file
// (spec.md Edge Cases US-02 #1). `cells` is indexed by the header names
// found in the file, so a reordered or partial column set still resolves.
func resolveRow(rowNumber int, cells map[string]string, lookups importLookups) (dto.ImportRow, string) {
	occurredAt, err := time.Parse(common.DateOnlyLayout, strings.TrimSpace(cells["date"]))
	if err != nil {
		return dto.ImportRow{}, fmt.Sprintf("ngày %q không hợp lệ (cần YYYY-MM-DD)", cells["date"])
	}

	transactionType, ok := parseTransactionType(cells["type"])
	if !ok {
		return dto.ImportRow{}, fmt.Sprintf("loại %q không hợp lệ (chỉ nhận Expense hoặc Income)", cells["type"])
	}

	amount, err := common.MajorUnitsToCents(cells["amount"])
	if err != nil {
		return dto.ImportRow{}, fmt.Sprintf("số tiền %q không phải là số hợp lệ", cells["amount"])
	}
	if amount <= 0 {
		return dto.ImportRow{}, "số tiền phải lớn hơn 0"
	}

	walletName := strings.TrimSpace(cells["wallet"])
	walletIDs := lookups.walletsByName[normalizeName(walletName)]
	switch len(walletIDs) {
	case 0:
		return dto.ImportRow{}, fmt.Sprintf("không tìm thấy ví %q", walletName)
	case 1:
	default:
		return dto.ImportRow{}, fmt.Sprintf("có %d ví cùng tên %q — không xác định được ví nào", len(walletIDs), walletName)
	}
	walletID := walletIDs[0]

	categoryName := strings.TrimSpace(cells["category"])
	categoryID, found := lookups.categoriesByNameType[categoryKey{
		name:         normalizeName(categoryName),
		categoryType: transactionType,
	}]
	if !found {
		// Never auto-created (spec.md Context #7) — this is enforced by the
		// simple absence of any create call, not by a flag.
		return dto.ImportRow{}, fmt.Sprintf("không tìm thấy danh mục %q cho loại %s", categoryName, transactionType)
	}

	// A Currency column that disagrees with the resolved wallet is a data
	// problem to surface, never something to silently correct (spec.md Edge
	// Cases US-02 #4). An absent/empty column is fine — it's optional.
	if declared := strings.ToUpper(strings.TrimSpace(cells["currency"])); declared != "" {
		if actual := lookups.currencyByID[walletID]; declared != actual {
			return dto.ImportRow{}, fmt.Sprintf("tiền tệ %q không khớp với ví %q (%s)", declared, walletName, actual)
		}
	}

	var note *string
	if raw := strings.TrimSpace(cells["note"]); raw != "" {
		if len([]rune(raw)) > common.TransactionNoteMaxLength {
			return dto.ImportRow{}, fmt.Sprintf("ghi chú vượt quá %d ký tự", common.TransactionNoteMaxLength)
		}
		note = &raw
	}

	return dto.ImportRow{
		Row:        rowNumber,
		WalletID:   walletID,
		CategoryID: categoryID,
		Amount:     amount,
		Type:       transactionType,
		OccurredAt: occurredAt.Format(common.DateOnlyLayout),
		Note:       note,
	}, ""
}

// parseTransactionType accepts the display label the export writes
// ("Expense"/"Income") in any casing, as well as the raw enum
// (spec.md Context #2).
func parseTransactionType(raw string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case string(model.TransactionTypeExpense):
		return string(model.TransactionTypeExpense), true
	case string(model.TransactionTypeIncome):
		return string(model.TransactionTypeIncome), true
	default:
		return "", false
	}
}
