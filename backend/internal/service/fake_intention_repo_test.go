package service

import (
	"context"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// fakeIntentionRepo is SpendingIntentionRepo in memory, with the same
// visibility rules as the SQL: own rows only, deleted ones hidden except to
// the key lookup.
type fakeIntentionRepo struct {
	rows []*model.SpendingIntention
	// clock stamps created_at so ordering is deterministic.
	tick int
}

func (f *fakeIntentionRepo) Create(_ context.Context, userID uuid.UUID, p repository.SpendingIntentionParams, key *string) (*model.SpendingIntention, error) {
	if key != nil {
		for _, r := range f.rows {
			if r.UserID == userID && r.IdempotencyKey != nil && *r.IdempotencyKey == *key {
				return nil, repository.ErrIntentionKeyTaken
			}
		}
	}
	f.tick++
	row := &model.SpendingIntention{
		ID: uuid.New(), UserID: userID, Title: p.Title, Kind: p.Kind, CategoryID: p.CategoryID, Currency: p.Currency,
		TotalAmount: p.TotalAmount, MonthlyAmount: p.MonthlyAmount, InstallmentMonths: p.InstallmentMonths,
		TargetMonth: p.TargetMonth, Note: p.Note, IdempotencyKey: key,
		CreatedAt: time.Date(2026, 1, 1, 0, 0, f.tick, 0, time.UTC), UpdatedAt: time.Date(2026, 1, 1, 0, 0, f.tick, 0, time.UTC),
	}
	f.rows = append(f.rows, row)
	return row, nil
}

func (f *fakeIntentionRepo) GetByID(_ context.Context, userID, id uuid.UUID) (*model.SpendingIntention, error) {
	for _, r := range f.rows {
		if r.ID == id && r.UserID == userID && r.DeletedAt == nil {
			return r, nil
		}
	}
	return nil, pgx.ErrNoRows
}

func (f *fakeIntentionRepo) GetByKey(_ context.Context, userID uuid.UUID, key string) (*model.SpendingIntention, error) {
	for _, r := range f.rows {
		if r.UserID == userID && r.IdempotencyKey != nil && *r.IdempotencyKey == key {
			return r, nil
		}
	}
	return nil, pgx.ErrNoRows
}

func (f *fakeIntentionRepo) List(_ context.Context, userID uuid.UUID) ([]*model.SpendingIntention, error) {
	var out []*model.SpendingIntention
	for _, r := range f.rows {
		if r.UserID == userID && r.DeletedAt == nil {
			out = append(out, r)
		}
	}
	sort.SliceStable(out, func(a, b int) bool {
		if !out[a].TargetMonth.Equal(out[b].TargetMonth) {
			return out[a].TargetMonth.Before(out[b].TargetMonth)
		}
		return out[a].CreatedAt.Before(out[b].CreatedAt)
	})
	return out, nil
}

func (f *fakeIntentionRepo) Count(ctx context.Context, userID uuid.UUID) (int64, error) {
	rows, _ := f.List(ctx, userID)
	return int64(len(rows)), nil
}

func (f *fakeIntentionRepo) Update(_ context.Context, userID, id uuid.UUID, p repository.SpendingIntentionParams) (*model.SpendingIntention, error) {
	for _, r := range f.rows {
		if r.ID == id && r.UserID == userID && r.DeletedAt == nil {
			r.Title, r.Kind, r.CategoryID, r.Currency = p.Title, p.Kind, p.CategoryID, p.Currency
			r.TotalAmount, r.MonthlyAmount, r.InstallmentMonths, r.TargetMonth, r.Note = p.TotalAmount, p.MonthlyAmount, p.InstallmentMonths, p.TargetMonth, p.Note
			return r, nil
		}
	}
	return nil, pgx.ErrNoRows
}

func (f *fakeIntentionRepo) Delete(_ context.Context, userID, id uuid.UUID) (bool, error) {
	for _, r := range f.rows {
		if r.ID == id && r.UserID == userID && r.DeletedAt == nil {
			now := time.Now()
			r.DeletedAt = &now
			return true, nil
		}
	}
	return false, nil
}

// stubBudgets is BudgetStatusReader with the Budgets a test hands it.
type stubBudgets struct{ list []*model.Budget }

func (s stubBudgets) ListBudgets(context.Context, uuid.UUID) ([]*model.Budget, error) {
	return s.list, nil
}
