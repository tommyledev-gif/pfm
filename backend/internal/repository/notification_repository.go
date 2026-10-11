package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// NotificationRepository wraps the sqlc-generated notification queries and
// returns domain models, never sqlc's raw row structs. No business rules
// live here — dedup semantics (via the DB partial unique index), title/body
// rendering, and the 403-vs-404 split are all decided by NotificationService.
type NotificationRepository struct {
	q *sqlc.Queries
}

func NewNotificationRepository(q *sqlc.Queries) *NotificationRepository {
	return &NotificationRepository{q: q}
}

type CreateBudgetExceededNotificationParams struct {
	UserID          uuid.UUID
	Title           string
	Body            string
	RelatedBudgetID uuid.UUID
	Currency        string
	PeriodStart     time.Time
}

// CreateBudgetExceededNotification inserts a new budget_exceeded
// Notification, or is a no-op if one already exists for this exact
// (related_budget_id, currency, period_start) — the ON CONFLICT DO NOTHING
// backing this is the dedup invariant (spec.md S-NOT-02/S-NOT-06, plan.md
// Finding #4), so a false `created` return is a successful no-op for the
// caller, never an error.
func (r *NotificationRepository) CreateBudgetExceededNotification(ctx context.Context, arg CreateBudgetExceededNotificationParams) (created bool, err error) {
	_, err = r.q.CreateBudgetExceededNotification(ctx, sqlc.CreateBudgetExceededNotificationParams{
		UserID:          arg.UserID,
		Type:            string(model.NotificationTypeBudgetExceeded),
		Title:           arg.Title,
		Body:            arg.Body,
		RelatedBudgetID: arg.RelatedBudgetID,
		Currency:        arg.Currency,
		PeriodStart:     arg.PeriodStart,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, fmt.Errorf("repository.CreateBudgetExceededNotification: %w", err)
	}
	return true, nil
}

type ListNotificationsFilter struct {
	IsRead          *bool
	CursorCreatedAt *time.Time
	CursorID        *uuid.UUID
	Limit           int32
}

// ListNotificationsByUser returns userID's Notifications, most recent first,
// cursor-paginated on (created_at, id) — same convention as F-01's
// ListUsers.
func (r *NotificationRepository) ListNotificationsByUser(ctx context.Context, userID uuid.UUID, filter ListNotificationsFilter) ([]*model.Notification, error) {
	rows, err := r.q.ListNotificationsByUser(ctx, sqlc.ListNotificationsByUserParams{
		UserID:          userID,
		Limit:           filter.Limit,
		IsRead:          filter.IsRead,
		CursorCreatedAt: filter.CursorCreatedAt,
		CursorID:        filter.CursorID,
	})
	if err != nil {
		return nil, fmt.Errorf("repository.ListNotificationsByUser: %w", err)
	}

	notifications := make([]*model.Notification, 0, len(rows))
	for _, row := range rows {
		notifications = append(notifications, toNotificationModel(row))
	}
	return notifications, nil
}

// CountNotifications backs the list response's approximate `total` (same
// convention as F-01's CountUsers).
func (r *NotificationRepository) CountNotifications(ctx context.Context, userID uuid.UUID, isRead *bool) (int64, error) {
	count, err := r.q.CountNotifications(ctx, sqlc.CountNotificationsParams{UserID: userID, IsRead: isRead})
	if err != nil {
		return 0, fmt.Errorf("repository.CountNotifications: %w", err)
	}
	return count, nil
}

// GetNotificationByID returns pgx.ErrNoRows (unwrap with errors.Is) when no
// row matches — it is NOT scoped by user_id (see db/queries/notifications.sql);
// the service layer decides 403 vs. 404.
func (r *NotificationRepository) GetNotificationByID(ctx context.Context, id uuid.UUID) (*model.Notification, error) {
	row, err := r.q.GetNotificationByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return toNotificationModel(row), nil
}

// MarkNotificationRead is scoped by id + user_id, same visibility guarantee
// as WalletRepository/BudgetRepository's owned-resource queries. Returns
// pgx.ErrNoRows if id/user_id don't match a row — callers that already
// confirmed ownership (mirroring WalletService.SetDefaultWallet's pattern)
// won't see that in practice.
func (r *NotificationRepository) MarkNotificationRead(ctx context.Context, id, userID uuid.UUID) (*model.Notification, error) {
	row, err := r.q.MarkNotificationRead(ctx, sqlc.MarkNotificationReadParams{ID: id, UserID: userID})
	if err != nil {
		return nil, err
	}
	return toNotificationModel(row), nil
}

func toNotificationModel(row sqlc.Notification) *model.Notification {
	return &model.Notification{
		ID:              row.ID,
		UserID:          row.UserID,
		Type:            model.NotificationType(row.Type),
		Title:           row.Title,
		Body:            row.Body,
		IsRead:          row.IsRead,
		RelatedBudgetID: row.RelatedBudgetID,
		Currency:        row.Currency,
		PeriodStart:     row.PeriodStart,
		CreatedAt:       row.CreatedAt,
		RelatedUserID:   row.RelatedUserID,
	}
}

// CreateAccessRequestNotification tells admin adminID that requesterID asked
// for an account (mig 031). No dedup: one request row makes one notification.
func (r *NotificationRepository) CreateAccessRequestNotification(ctx context.Context, adminID uuid.UUID, title, body string, requesterID uuid.UUID) error {
	if err := r.q.CreateAccessRequestNotification(ctx, adminID, title, body, requesterID); err != nil {
		return fmt.Errorf("repository.CreateAccessRequestNotification: %w", err)
	}
	return nil
}
