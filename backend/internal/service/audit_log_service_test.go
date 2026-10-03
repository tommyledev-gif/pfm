package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// fakeAuditLogRepo serves a fixed set of entries, filtered the way the real
// ListAuditLogsByUser query filters them (user_id always, transaction_id when
// given). Pagination is not exercised here.
type fakeAuditLogRepo struct {
	logs []*model.AuditLog
}

func (f *fakeAuditLogRepo) matching(userID uuid.UUID, transactionID *uuid.UUID) []*model.AuditLog {
	out := []*model.AuditLog{}
	for _, l := range f.logs {
		if l.UserID != userID {
			continue
		}
		if transactionID != nil && l.TransactionID != *transactionID {
			continue
		}
		out = append(out, l)
	}
	return out
}

func (f *fakeAuditLogRepo) ListAuditLogsByUser(_ context.Context, userID uuid.UUID, filter repository.ListAuditLogsFilter) ([]*model.AuditLog, error) {
	return f.matching(userID, filter.TransactionID), nil
}

func (f *fakeAuditLogRepo) CountAuditLogs(_ context.Context, userID uuid.UUID, transactionID *uuid.UUID) (int64, error) {
	return int64(len(f.matching(userID, transactionID))), nil
}

// failingOwnerRepo simulates a database failure on the ownership lookup.
type failingOwnerRepo struct {
	*fakeTransactionRepo
}

var errOwnerLookupDown = errors.New("connection refused")

func (f *failingOwnerRepo) GetTransactionOwnerIncludingDeleted(context.Context, uuid.UUID) (uuid.UUID, error) {
	return uuid.Nil, errOwnerLookupDown
}

const auditTestLimit = 20

type auditFixture struct {
	owner    uuid.UUID
	txID     uuid.UUID
	txRepo   *fakeTransactionRepo
	logsRepo *fakeAuditLogRepo
}

// newAuditFixture seeds one Transaction owned by `owner` with a create and a
// delete entry; `deleted` controls whether the Transaction is soft-deleted.
func newAuditFixture(deleted bool) auditFixture {
	owner := uuid.New()
	txID := uuid.New()
	txRepo := newFakeTransactionRepo()
	now := time.Now().UTC()
	tx := &model.Transaction{ID: txID, UserID: owner, Amount: 200000, Type: model.TransactionTypeExpense}
	if deleted {
		tx.DeletedAt = &now
	}
	txRepo.transactions[txID] = tx

	logsRepo := &fakeAuditLogRepo{logs: []*model.AuditLog{
		{ID: uuid.New(), TransactionID: txID, UserID: owner, Action: model.AuditActionDelete, CreatedAt: now},
		{ID: uuid.New(), TransactionID: txID, UserID: owner, Action: model.AuditActionCreate, CreatedAt: now.Add(-time.Hour)},
	}}
	return auditFixture{owner: owner, txID: txID, txRepo: txRepo, logsRepo: logsRepo}
}

func assertAppError(t *testing.T, err error, want *common.AppError) {
	t.Helper()
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != want.Code {
		t.Fatalf("want %s, got %v", want.Code, err)
	}
}

// S-MUX-68 — the defect: an owner's removed Transaction used to 404.
func TestListAuditLogs_OwnRemovedTransactionReturnsHistory(t *testing.T) {
	f := newAuditFixture(true)
	svc := NewAuditLogService(f.logsRepo, f.txRepo, zap.NewNop())

	logs, _, total, err := svc.ListAuditLogs(context.Background(), f.owner, f.txID.String(), "", auditTestLimit)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(logs) != 2 || total != 2 {
		t.Fatalf("want 2 entries, got %d (total %d)", len(logs), total)
	}
	if logs[0].Action != model.AuditActionDelete {
		t.Fatalf("want delete entry first, got %s", logs[0].Action)
	}
}

// S-MUX-73 — live Transactions behave exactly as before.
func TestListAuditLogs_OwnLiveTransactionReturnsHistory(t *testing.T) {
	f := newAuditFixture(false)
	svc := NewAuditLogService(f.logsRepo, f.txRepo, zap.NewNop())

	if _, _, _, err := svc.ListAuditLogs(context.Background(), f.owner, f.txID.String(), "", auditTestLimit); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// S-MUX-70 — removal must not weaken isolation.
func TestListAuditLogs_OtherUsersRemovedTransactionIsForbidden(t *testing.T) {
	f := newAuditFixture(true)
	svc := NewAuditLogService(f.logsRepo, f.txRepo, zap.NewNop())

	_, _, _, err := svc.ListAuditLogs(context.Background(), uuid.New(), f.txID.String(), "", auditTestLimit)
	assertAppError(t, err, common.ErrTransactionAccessDenied)
}

// S-MUX-71
func TestListAuditLogs_UnknownTransactionIsNotFound(t *testing.T) {
	f := newAuditFixture(false)
	svc := NewAuditLogService(f.logsRepo, f.txRepo, zap.NewNop())

	_, _, _, err := svc.ListAuditLogs(context.Background(), f.owner, uuid.New().String(), "", auditTestLimit)
	assertAppError(t, err, common.ErrTransactionNotFound)
}

// S-MUX-72
func TestListAuditLogs_MalformedTransactionIDIsInvalidInput(t *testing.T) {
	f := newAuditFixture(false)
	svc := NewAuditLogService(f.logsRepo, f.txRepo, zap.NewNop())

	_, _, _, err := svc.ListAuditLogs(context.Background(), f.owner, "not-a-uuid", "", auditTestLimit)
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeInvalidInput {
		t.Fatalf("want INVALID_INPUT, got %v", err)
	}
}

// S-MUX-74 — a database failure is a 500, no longer disguised as 404.
func TestListAuditLogs_OwnerLookupFailureIsNotMaskedAsNotFound(t *testing.T) {
	f := newAuditFixture(false)
	svc := NewAuditLogService(f.logsRepo, &failingOwnerRepo{f.txRepo}, zap.NewNop())

	_, _, _, err := svc.ListAuditLogs(context.Background(), f.owner, f.txID.String(), "", auditTestLimit)
	if !errors.Is(err, errOwnerLookupDown) {
		t.Fatalf("want wrapped repository error, got %v", err)
	}
	var appErr *common.AppError
	if errors.As(err, &appErr) {
		t.Fatalf("repository failure must not map to an AppError, got %s", appErr.Code)
	}
}
