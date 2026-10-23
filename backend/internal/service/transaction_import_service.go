package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
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
// is read-only: the caller's wallets/categories, and one existence check for
// every candidate row's derived idempotency key at once (one query, not one
// per row: 10,000 rows took ~5 s that way).
func (s *TransactionImportService) PreviewImport(ctx context.Context, userID uuid.UUID, file []byte) (*dto.ImportPreviewResponse, error) {
	header, dataRows, err := readWorksheetRows(file, defaultImportReadLimits)
	if err != nil {
		return nil, err
	}
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

	candidates := make([]dto.ImportRow, 0, len(dataRows))
	keys := make([]uuid.UUID, 0, len(dataRows))
	// How many times each content key has appeared so far in this file.
	seen := make(map[uuid.UUID]int, len(dataRows))
	for _, raw := range dataRows {
		row, reason := resolveRow(raw.number, cellsFor(raw.cells, columns), lookups)
		if reason != "" {
			result.Errors = append(result.Errors, dto.ImportRowIssue{Row: raw.number, Reason: reason})
			continue
		}
		contentKey := deriveIdempotencyKey(userID, row)
		row.IdempotencyKey = occurrenceKey(contentKey, seen[contentKey])
		seen[contentKey]++
		candidates = append(candidates, row)
		keys = append(keys, row.IdempotencyKey)
	}

	// A UX nicety, not the enforcement mechanism (plan.md Finding #2):
	// telling the user upfront which rows are already imported. What
	// actually guarantees a duplicate can't be written is
	// CreateTransaction's own replay path at commit time, which catches
	// anything that raced in between.
	imported, err := s.repo.ImportedKeyStates(ctx, userID, keys)
	if err != nil {
		return nil, fmt.Errorf("service.PreviewImport: %w", err)
	}
	for _, row := range candidates {
		deleted, found := imported[row.IdempotencyKey]
		if !found {
			result.Valid = append(result.Valid, row)
			continue
		}
		reason := importReasonAlreadyImported
		if deleted {
			reason = importReasonImportedThenDeleted
		}
		result.Duplicates = append(result.Duplicates, dto.ImportRowIssue{Row: row.Row, Reason: reason})
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
