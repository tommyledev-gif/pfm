package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// ErrIntentionKeyTaken is a create that lost the race for its idempotency key:
// another request kept the same card first.
var ErrIntentionKeyTaken = errors.New("repository: spending intention key already used")

// pgUniqueViolation is Postgres's SQLSTATE for a unique index conflict.
const pgUniqueViolation = "23505"

// SpendingIntentionRepository wraps the spending_intentions queries. Data
// access only: the rules about what may be kept live in the service.
type SpendingIntentionRepository struct {
	q *sqlc.Queries
}

func NewSpendingIntentionRepository(q *sqlc.Queries) *SpendingIntentionRepository {
	return &SpendingIntentionRepository{q: q}
}

// SpendingIntentionParams is the editable set, already validated and with
// every amount resolved by the service.
type SpendingIntentionParams struct {
	Title             string
	Kind              string
	CategoryID        *uuid.UUID
	Currency          string
	TotalAmount       *int64
	MonthlyAmount     *int64
	InstallmentMonths *int
	TargetMonth       time.Time
	Note              *string
}

func (r *SpendingIntentionRepository) Create(ctx context.Context, userID uuid.UUID, p SpendingIntentionParams, key *string) (*model.SpendingIntention, error) {
	row, err := r.q.CreateSpendingIntention(ctx, sqlc.CreateSpendingIntentionParams{
		UserID: userID, Title: p.Title, Kind: p.Kind, CategoryID: p.CategoryID, Currency: p.Currency,
		TotalAmount: p.TotalAmount, MonthlyAmount: p.MonthlyAmount, InstallmentMonths: monthsToInt32(p.InstallmentMonths),
		TargetMonth: p.TargetMonth, Note: p.Note, IdempotencyKey: key,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
			return nil, ErrIntentionKeyTaken
		}
		return nil, fmt.Errorf("repository.CreateSpendingIntention: %w", err)
	}
	return intentionFromRow(row), nil
}

// GetByID returns the User's own, not deleted intention; pgx.ErrNoRows when
// there is none (another User's id included).
func (r *SpendingIntentionRepository) GetByID(ctx context.Context, userID, id uuid.UUID) (*model.SpendingIntention, error) {
	row, err := r.q.GetSpendingIntentionByID(ctx, id, userID)
	if err != nil {
		return nil, fmt.Errorf("repository.GetSpendingIntentionByID: %w", err)
	}
	return intentionFromRow(row), nil
}

// GetByKey finds the intention a card was kept as, deleted ones included.
func (r *SpendingIntentionRepository) GetByKey(ctx context.Context, userID uuid.UUID, key string) (*model.SpendingIntention, error) {
	row, err := r.q.GetSpendingIntentionByKey(ctx, userID, key)
	if err != nil {
		return nil, fmt.Errorf("repository.GetSpendingIntentionByKey: %w", err)
	}
	return intentionFromRow(row), nil
}

func (r *SpendingIntentionRepository) List(ctx context.Context, userID uuid.UUID) ([]*model.SpendingIntention, error) {
	rows, err := r.q.ListSpendingIntentionsByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("repository.ListSpendingIntentionsByUser: %w", err)
	}
	out := make([]*model.SpendingIntention, 0, len(rows))
	for _, row := range rows {
		out = append(out, intentionFromRow(row))
	}
	return out, nil
}

func (r *SpendingIntentionRepository) Count(ctx context.Context, userID uuid.UUID) (int64, error) {
	n, err := r.q.CountSpendingIntentionsByUser(ctx, userID)
	if err != nil {
		return 0, fmt.Errorf("repository.CountSpendingIntentionsByUser: %w", err)
	}
	return n, nil
}

func (r *SpendingIntentionRepository) Update(ctx context.Context, userID, id uuid.UUID, p SpendingIntentionParams) (*model.SpendingIntention, error) {
	row, err := r.q.UpdateSpendingIntention(ctx, sqlc.UpdateSpendingIntentionParams{
		ID: id, UserID: userID, Title: p.Title, Kind: p.Kind, CategoryID: p.CategoryID, Currency: p.Currency,
		TotalAmount: p.TotalAmount, MonthlyAmount: p.MonthlyAmount, InstallmentMonths: monthsToInt32(p.InstallmentMonths),
		TargetMonth: p.TargetMonth, Note: p.Note,
	})
	if err != nil {
		return nil, fmt.Errorf("repository.UpdateSpendingIntention: %w", err)
	}
	return intentionFromRow(row), nil
}

// Delete soft-deletes the User's own intention; false when there was none.
func (r *SpendingIntentionRepository) Delete(ctx context.Context, userID, id uuid.UUID) (bool, error) {
	n, err := r.q.SoftDeleteSpendingIntention(ctx, id, userID)
	if err != nil {
		return false, fmt.Errorf("repository.SoftDeleteSpendingIntention: %w", err)
	}
	return n > 0, nil
}

func monthsToInt32(months *int) *int32 {
	if months == nil {
		return nil
	}
	v := int32(*months)
	return &v
}

func intentionFromRow(row sqlc.SpendingIntention) *model.SpendingIntention {
	var months *int
	if row.InstallmentMonths != nil {
		v := int(*row.InstallmentMonths)
		months = &v
	}
	return &model.SpendingIntention{
		ID: row.ID, UserID: row.UserID, Title: row.Title, Kind: row.Kind, CategoryID: row.CategoryID,
		Currency: row.Currency, TotalAmount: row.TotalAmount, MonthlyAmount: row.MonthlyAmount, InstallmentMonths: months,
		TargetMonth: row.TargetMonth, Note: row.Note, IdempotencyKey: row.IdempotencyKey,
		CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt, DeletedAt: row.DeletedAt,
	}
}
