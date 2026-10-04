package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/xuri/excelize/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
)

// Import preview duplicate reasons. A derived key can resolve to a Transaction
// that still exists or to one the User has since deleted
// (specs/mobile-offline-support BR-OFF-B03); each gets its own reason.
const (
	importReasonAlreadyImported     = "đã được nhập trước đó"
	importReasonImportedThenDeleted = "Đã nhập trước đó (đã bị xoá)"
)

// TransactionImportService owns the two halves of the import flow
// (specs/transaction-export-import/spec.md US-02, US-03): PreviewImport
// parses and validates a workbook without writing anything, and CommitImport
// replays the rows that preview approved.
//
// ⚠️ The single most load-bearing constraint in this feature: CommitImport
// never writes a Transaction itself. Every row goes through
// TransactionService.CreateTransaction verbatim (spec.md Context #4), so an
// imported row can't diverge from a manually-created one on the balance
// floor, the category type-match, the atomic wallet mutation, or the audit
// log. There is deliberately no repository write method on this service.
type TransactionImportService struct {
	transactionService *TransactionService
	repo               TransactionRepo
	walletRepo         WalletRepo
	categoryRepo       CategoryRepo
	tokens             *TokenService
	logger             *zap.Logger
}

func NewTransactionImportService(
	transactionService *TransactionService,
	repo TransactionRepo,
	walletRepo WalletRepo,
	categoryRepo CategoryRepo,
	tokens *TokenService,
	logger *zap.Logger,
) *TransactionImportService {
	return &TransactionImportService{
		transactionService: transactionService,
		repo:               repo,
		walletRepo:         walletRepo,
		categoryRepo:       categoryRepo,
		tokens:             tokens,
		logger:             logger,
	}
}

// PreviewImport is a dry run in the literal sense — the only database access
// is read-only (the caller's wallets/categories, and one existence check per
// candidate row's derived idempotency key).
func (s *TransactionImportService) PreviewImport(ctx context.Context, userID uuid.UUID, file []byte) (*dto.ImportPreviewResponse, error) {
	rows, err := readWorksheetRows(file)
	if err != nil {
		return nil, err
	}
	header, dataRows := rows[0], rows[1:]
	columns, err := indexColumns(header)
	if err != nil {
		return nil, err
	}

	wallets, err := s.walletRepo.ListWalletsByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.PreviewImport: %w", err)
	}
	categories, err := s.categoryRepo.ListCategoriesForUser(ctx, userID, nil)
	if err != nil {
		return nil, fmt.Errorf("service.PreviewImport: %w", err)
	}
	lookups := buildImportLookups(wallets, categories)

	result := &dto.ImportPreviewResponse{
		Valid:      []dto.ImportRow{},
		Duplicates: []dto.ImportRowIssue{},
		Errors:     []dto.ImportRowIssue{},
	}

	for i, raw := range dataRows {
		rowNumber := i + 2 // 1-based, and row 1 is the header
		if isBlankRow(raw) {
			continue
		}

		row, reason := resolveRow(rowNumber, cellsFor(raw, columns), lookups)
		if reason != "" {
			result.Errors = append(result.Errors, dto.ImportRowIssue{Row: rowNumber, Reason: reason})
			continue
		}
		row.IdempotencyKey = deriveIdempotencyKey(userID, row)

		// A UX nicety, not the enforcement mechanism (plan.md Finding #2):
		// telling the user upfront which rows are already imported. What
		// actually guarantees a duplicate can't be written is
		// CreateTransaction's own replay path at commit time, which catches
		// anything that raced in between.
		found, deleted, err := s.isAlreadyImported(ctx, userID, row.IdempotencyKey)
		if err != nil {
			return nil, err
		}
		if found {
			reason := importReasonAlreadyImported
			if deleted {
				reason = importReasonImportedThenDeleted
			}
			result.Duplicates = append(result.Duplicates, dto.ImportRowIssue{Row: rowNumber, Reason: reason})
			continue
		}
		result.Valid = append(result.Valid, row)
	}

	token, err := s.tokens.IssueImportToken(userID, result.Valid)
	if err != nil {
		return nil, fmt.Errorf("service.PreviewImport: %w", err)
	}
	result.ImportToken = token
	return result, nil
}

// CommitImport writes the rows carried by a previously-issued import_token.
//
// Rows are processed independently rather than under one transaction spanning
// the file (spec.md Edge Cases US-03 #1) — the response reports per-row
// outcomes, which only makes sense if partial success is a real, reportable
// state.
func (s *TransactionImportService) CommitImport(ctx context.Context, userID uuid.UUID, req dto.ImportCommitRequest) (*dto.ImportCommitResponse, error) {
	claims, err := s.tokens.ParseImportToken(req.ImportToken)
	if err != nil {
		// Expired, tampered, or minted for another purpose — all the same
		// 401 to the client (plan.md Finding #9: no dedicated
		// IMPORT_TOKEN_EXPIRED code).
		return nil, common.ErrUnauthenticated
	}
	if claims.UserID != userID.String() {
		return nil, common.ErrForbidden
	}

	result := &dto.ImportCommitResponse{Failures: []dto.ImportRowIssue{}}
	for _, row := range claims.Rows {
		occurredAt := row.OccurredAt
		idempotencyKey := row.IdempotencyKey
		createReq := dto.CreateTransactionRequest{
			WalletID:       row.WalletID,
			CategoryID:     row.CategoryID,
			Amount:         row.Amount,
			Type:           row.Type,
			OccurredAt:     &occurredAt,
			Note:           row.Note,
			IdempotencyKey: &idempotencyKey,
		}

		_, _, wasReplay, err := s.transactionService.CreateTransaction(ctx, userID, createReq)
		switch {
		case err != nil:
			// A fresh key that still failed — a balance-floor rejection from
			// a race since preview (S-TXI-23), or a wallet/category deleted
			// in between. Its own bucket, never folded into skipped
			// (plan.md Finding #10).
			result.Failed++
			result.Failures = append(result.Failures, dto.ImportRowIssue{Row: row.Row, Reason: commitFailureReason(err)})
		case wasReplay:
			result.Skipped++
		default:
			result.Imported++
		}
	}
	return result, nil
}

// isAlreadyImported reports whether this derived key has already produced a
// Transaction for this user (found) and whether that Transaction has since
// been soft-deleted (deleted) — the lookup matches deleted rows on purpose.
func (s *TransactionImportService) isAlreadyImported(ctx context.Context, userID, key uuid.UUID) (found, deleted bool, err error) {
	existing, err := s.repo.GetTransactionByIdempotencyKey(ctx, userID, key)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, false, nil
		}
		return false, false, fmt.Errorf("service.isAlreadyImported: %w", err)
	}
	return true, existing.DeletedAt != nil, nil
}

// commitFailureReason surfaces a domain error's own user-facing message
// (every common.AppError already carries a Vietnamese one) and hides anything
// else behind a generic string — an unexpected internal error's text is not
// something to hand back row by row.
func commitFailureReason(err error) string {
	var appErr *common.AppError
	if errors.As(err, &appErr) {
		return appErr.Message
	}
	return "không thể tạo giao dịch cho dòng này"
}

// readWorksheetRows opens the uploaded bytes as a workbook and returns the
// first sheet's rows, header included.
//
// excelize's own parse failure IS the content validation (spec.md Edge Cases
// US-02 #3): a renamed .csv or any other non-OOXML payload fails to open as a
// zip+XML package here, before a single row is looked at. There is
// deliberately no separate magic-byte check reimplemented by hand.
func readWorksheetRows(file []byte) ([][]string, error) {
	workbook, err := excelize.OpenReader(bytes.NewReader(file))
	if err != nil {
		return nil, common.NewInvalidInputError("tệp không phải là tệp .xlsx hợp lệ")
	}
	defer workbook.Close() //nolint:errcheck // read-only, in-memory

	sheets := workbook.GetSheetList()
	if len(sheets) == 0 {
		return nil, common.NewInvalidInputError("tệp không có trang tính nào")
	}
	rows, err := workbook.GetRows(sheets[0])
	if err != nil {
		return nil, common.NewInvalidInputError("không đọc được trang tính đầu tiên")
	}
	if len(rows) == 0 {
		return nil, common.NewInvalidInputError("tệp không có dòng tiêu đề")
	}
	return rows, nil
}

// indexColumns maps each required/optional column name to its position in the
// header row. Matching is by name, not position, so a user who reorders
// columns or drops an optional one still imports.
func indexColumns(header []string) (map[string]int, error) {
	columns := make(map[string]int, len(header))
	for i, name := range header {
		columns[strings.ToLower(strings.TrimSpace(name))] = i
	}
	var missing []string
	for _, required := range common.TransactionImportRequiredColumns {
		if _, ok := columns[strings.ToLower(required)]; !ok {
			missing = append(missing, required)
		}
	}
	if len(missing) > 0 {
		return nil, common.NewInvalidInputError(fmt.Sprintf("thiếu cột bắt buộc: %s", strings.Join(missing, ", ")))
	}
	return columns, nil
}

// cellsFor projects one raw row onto its header names. A row shorter than the
// header (trailing empty cells, which excelize truncates) yields empty
// strings rather than panicking on the index.
func cellsFor(raw []string, columns map[string]int) map[string]string {
	cells := make(map[string]string, len(columns))
	for name, index := range columns {
		if index < len(raw) {
			cells[name] = raw[index]
		} else {
			cells[name] = ""
		}
	}
	return cells
}

// isBlankRow skips the trailing empty rows spreadsheets routinely carry —
// reporting them as validation errors would bury the real ones.
func isBlankRow(raw []string) bool {
	for _, cell := range raw {
		if strings.TrimSpace(cell) != "" {
			return false
		}
	}
	return true
}
