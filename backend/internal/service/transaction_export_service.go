package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/xuri/excelize/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// TransactionExportService builds the .xlsx workbook behind
// GET /transactions/export (specs/transaction-export-import/spec.md US-01).
//
// Adds no repository and no SQL of its own: it reads through F-06's existing
// TransactionRepo.ListTransactionsByUser and F-03's WalletRepo, exactly as
// they are (plan.md §2). That reuse is what keeps the export's notion of
// "the caller's transactions in this range" identical to the list screen's —
// including the non-obvious rule that a soft-deleted Wallet/Category still
// contributes its historical name (spec.md Edge Cases US-01 #2), which the
// existing JOIN already gets right.
type TransactionExportService struct {
	repo       TransactionRepo
	walletRepo WalletRepo
	logger     *zap.Logger
}

func NewTransactionExportService(repo TransactionRepo, walletRepo WalletRepo, logger *zap.Logger) *TransactionExportService {
	return &TransactionExportService{repo: repo, walletRepo: walletRepo, logger: logger}
}

// BuildExportWorkbook returns the encoded .xlsx bytes and the filename the
// handler should advertise in Content-Disposition.
func (s *TransactionExportService) BuildExportWorkbook(ctx context.Context, userID uuid.UUID, q dto.ExportTransactionsQuery) ([]byte, string, error) {
	from, to, err := parseExportRange(q)
	if err != nil {
		return nil, "", err
	}

	filter := repository.ListTransactionsFilter{
		From: &from,
		To:   &to,
		// The whole range in one page. ListTransactionsByUser is
		// cursor-paginated for the list screen's benefit; an export has no
		// cursor to hand back, so the limit is the export's own ceiling
		// (spec.md Edge Cases US-01 #1 — synchronous, single response).
		Limit: common.TransactionExportMaxRows,
	}
	if q.WalletID != "" {
		walletID, parseErr := uuid.Parse(q.WalletID)
		if parseErr != nil {
			return nil, "", common.NewInvalidInputError("wallet_id must be a valid UUID")
		}
		if err := s.assertWalletOwned(ctx, userID, walletID); err != nil {
			return nil, "", err
		}
		filter.WalletID = &walletID
	}

	transactions, err := s.repo.ListTransactionsByUser(ctx, userID, filter)
	if err != nil {
		return nil, "", fmt.Errorf("service.BuildExportWorkbook: %w", err)
	}

	currencyByWallet, err := s.walletCurrencies(ctx, userID)
	if err != nil {
		return nil, "", err
	}

	// The underlying query is occurred_at DESC (newest first, what the list
	// screen wants). A spreadsheet reads top-to-bottom chronologically
	// (spec.md US-01 step 3), so reverse here rather than adding a second
	// SQL query that differs only in ORDER BY.
	sort.SliceStable(transactions, func(a, b int) bool {
		if !transactions[a].OccurredAt.Equal(transactions[b].OccurredAt) {
			return transactions[a].OccurredAt.Before(transactions[b].OccurredAt)
		}
		return transactions[a].CreatedAt.Before(transactions[b].CreatedAt)
	})

	ids := make([]uuid.UUID, 0, len(transactions))
	for _, t := range transactions {
		ids = append(ids, t.ID)
	}
	linesByTransaction, err := s.repo.ListActiveLinesByTransactionIDs(ctx, userID, ids)
	if err != nil {
		return nil, "", fmt.Errorf("service.BuildExportWorkbook: %w", err)
	}

	data, err := writeWorkbook(transactions, currencyByWallet, linesByTransaction)
	if err != nil {
		return nil, "", err
	}
	return data, fmt.Sprintf("transactions_%s_%s.xlsx", q.From, q.To), nil
}

// assertWalletOwned is the 403 guard for an explicitly-scoped export
// (S-TXI-03). Mirrors TransactionService.getOwnedWallet rather than sharing
// it — the two services hold their own WalletRepo handle, same precedent as
// every other service's small ownership helper.
func (s *TransactionExportService) assertWalletOwned(ctx context.Context, userID, walletID uuid.UUID) error {
	wallet, err := s.walletRepo.GetWalletByID(ctx, walletID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return common.ErrWalletNotFound
		}
		return fmt.Errorf("service.assertWalletOwned: %w", err)
	}
	if wallet.UserID != userID {
		return common.ErrWalletAccessDenied
	}
	return nil
}

// walletCurrencies maps every one of the caller's Wallets to its currency.
// model.Transaction carries the wallet's *name* (from the list query's JOIN)
// but not its currency, and the export's Currency column needs the latter —
// one extra list call, not an N+1 per row.
func (s *TransactionExportService) walletCurrencies(ctx context.Context, userID uuid.UUID) (map[uuid.UUID]string, error) {
	wallets, err := s.walletRepo.ListWalletsByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.walletCurrencies: %w", err)
	}
	currencies := make(map[uuid.UUID]string, len(wallets))
	for _, wallet := range wallets {
		currencies[wallet.ID] = wallet.Currency
	}
	return currencies, nil
}

// parseExportRange validates the required from/to pair (S-TXI-05, S-TXI-06).
// Both are AppLocation calendar days (date_window.go), `to` widened to the
// end of its day so a single-day export (from == to) actually contains that
// day's transactions — occurred_at is a timestamptz and the column is a plain
// date.
func parseExportRange(q dto.ExportTransactionsQuery) (time.Time, time.Time, error) {
	from, err := time.ParseInLocation(common.DateOnlyLayout, q.From, common.AppLocation)
	if err != nil {
		return time.Time{}, time.Time{}, common.NewInvalidInputError("from must be a valid date (YYYY-MM-DD)")
	}
	to, err := time.ParseInLocation(common.DateOnlyLayout, q.To, common.AppLocation)
	if err != nil {
		return time.Time{}, time.Time{}, common.NewInvalidInputError("to must be a valid date (YYYY-MM-DD)")
	}
	if to.Before(from) {
		return time.Time{}, time.Time{}, common.NewInvalidInputError("from must not be after to")
	}
	return from.UTC(), endOfDay(to), nil
}

// writeWorkbook renders the rows into the Transactions sheet, columns exactly
// in common.TransactionExportColumns order, then the Items sheet.
func writeWorkbook(transactions []*model.Transaction, currencyByWallet map[uuid.UUID]string, linesByTransaction map[uuid.UUID]repository.TransactionLines) ([]byte, error) {
	file := excelize.NewFile()
	defer file.Close() //nolint:errcheck // in-memory only, nothing to flush

	sheet := common.TransactionExportSheetName
	index, err := file.NewSheet(sheet)
	if err != nil {
		return nil, fmt.Errorf("service.writeWorkbook: %w", err)
	}
	file.SetActiveSheet(index)
	// NewFile seeds a "Sheet1" that would otherwise ship as an empty second
	// tab next to the real one.
	if err := file.DeleteSheet("Sheet1"); err != nil {
		return nil, fmt.Errorf("service.writeWorkbook: %w", err)
	}

	header := make([]interface{}, len(common.TransactionExportColumns))
	for i, name := range common.TransactionExportColumns {
		header[i] = name
	}
	if err := file.SetSheetRow(sheet, "A1", &header); err != nil {
		return nil, fmt.Errorf("service.writeWorkbook: %w", err)
	}

	for i, transaction := range transactions {
		note := ""
		if transaction.Note != nil {
			note = *transaction.Note
		}
		row := []interface{}{
			transaction.OccurredAt.UTC().Format(common.DateOnlyLayout),
			common.TransactionExportTypeLabels[string(transaction.Type)],
			// ⚠️ Major units, not stored cents (spec.md Context #1) — the one
			// place in this feature money crosses that boundary outbound.
			common.CentsToMajorUnits(transaction.Amount),
			currencyByWallet[transaction.WalletID],
			transaction.CategoryName,
			transaction.WalletName,
			note,
			transaction.CreatedAt.UTC().Format(common.TransactionExportCreatedAtLayout),
		}
		cell := fmt.Sprintf("A%d", i+2) // +2: 1-based rows, and row 1 is the header
		if err := file.SetSheetRow(sheet, cell, &row); err != nil {
			return nil, fmt.Errorf("service.writeWorkbook: %w", err)
		}
	}

	if err := writeItemsSheet(file, transactions, linesByTransaction); err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	if err := file.Write(&buf); err != nil {
		return nil, fmt.Errorf("service.writeWorkbook: %w", err)
	}
	return buf.Bytes(), nil
}
