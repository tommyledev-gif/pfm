package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
)

const createBudgetExceededNotification = `-- name: CreateBudgetExceededNotification :one
INSERT INTO notifications (user_id, type, title, body, related_budget_id, currency, period_start)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (related_budget_id, currency, period_start) WHERE type = 'budget_exceeded'
    DO NOTHING
RETURNING id, user_id, type, title, body, is_read, related_budget_id, currency, period_start, created_at, related_user_id
`

type CreateBudgetExceededNotificationParams struct {
	UserID          uuid.UUID
	Type            string
	Title           string
	Body            string
	RelatedBudgetID uuid.UUID
	Currency        string
	PeriodStart     time.Time
}

// CreateBudgetExceededNotification returns pgx.ErrNoRows (via QueryRow.Scan)
// when ON CONFLICT DO NOTHING matched an existing row instead of inserting —
// that is the dedup working as intended (spec.md S-NOT-02/S-NOT-06), not a
// failure; the repository layer treats it as "already existed", never an
// error surfaced further up.
func (q *Queries) CreateBudgetExceededNotification(ctx context.Context, arg CreateBudgetExceededNotificationParams) (Notification, error) {
	row := q.db.QueryRow(ctx, createBudgetExceededNotification,
		arg.UserID, arg.Type, arg.Title, arg.Body, arg.RelatedBudgetID, arg.Currency, arg.PeriodStart,
	)
	var i Notification
	err := row.Scan(&i.ID, &i.UserID, &i.Type, &i.Title, &i.Body, &i.IsRead, &i.RelatedBudgetID, &i.Currency, &i.PeriodStart, &i.CreatedAt, &i.RelatedUserID)
	return i, err
}

const listNotificationsByUser = `-- name: ListNotificationsByUser :many
SELECT id, user_id, type, title, body, is_read, related_budget_id, currency, period_start, created_at, related_user_id FROM notifications
WHERE user_id = $1
  AND ($3::bool IS NULL OR is_read = $3)
  AND (
    $4::timestamptz IS NULL
    OR created_at < $4
    OR (created_at = $4 AND id < $5)
  )
ORDER BY created_at DESC, id DESC
LIMIT $2
`

type ListNotificationsByUserParams struct {
	UserID          uuid.UUID
	Limit           int32
	IsRead          *bool
	CursorCreatedAt *time.Time
	CursorID        *uuid.UUID
}

func (q *Queries) ListNotificationsByUser(ctx context.Context, arg ListNotificationsByUserParams) ([]Notification, error) {
	rows, err := q.db.Query(ctx, listNotificationsByUser, arg.UserID, arg.Limit, arg.IsRead, arg.CursorCreatedAt, arg.CursorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []Notification
	for rows.Next() {
		var i Notification
		if err := rows.Scan(&i.ID, &i.UserID, &i.Type, &i.Title, &i.Body, &i.IsRead, &i.RelatedBudgetID, &i.Currency, &i.PeriodStart, &i.CreatedAt, &i.RelatedUserID); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const countNotifications = `-- name: CountNotifications :one
SELECT COUNT(*) FROM notifications
WHERE user_id = $1
  AND ($2::bool IS NULL OR is_read = $2)
`

type CountNotificationsParams struct {
	UserID uuid.UUID
	IsRead *bool
}

func (q *Queries) CountNotifications(ctx context.Context, arg CountNotificationsParams) (int64, error) {
	row := q.db.QueryRow(ctx, countNotifications, arg.UserID, arg.IsRead)
	var count int64
	err := row.Scan(&count)
	return count, err
}

const getNotificationByID = `-- name: GetNotificationByID :one
SELECT id, user_id, type, title, body, is_read, related_budget_id, currency, period_start, created_at, related_user_id FROM notifications
WHERE id = $1
LIMIT 1
`

// GetNotificationByID is deliberately NOT scoped by user_id, same precedent
// as GetWalletByID/GetBudgetByID — the service layer decides 403 vs. 404
// (spec.md S-NOT-14/S-NOT-15).
func (q *Queries) GetNotificationByID(ctx context.Context, id uuid.UUID) (Notification, error) {
	row := q.db.QueryRow(ctx, getNotificationByID, id)
	var i Notification
	err := row.Scan(&i.ID, &i.UserID, &i.Type, &i.Title, &i.Body, &i.IsRead, &i.RelatedBudgetID, &i.Currency, &i.PeriodStart, &i.CreatedAt, &i.RelatedUserID)
	return i, err
}

const markNotificationRead = `-- name: MarkNotificationRead :one
UPDATE notifications
SET is_read = TRUE
WHERE id = $1
  AND user_id = $2
RETURNING id, user_id, type, title, body, is_read, related_budget_id, currency, period_start, created_at, related_user_id
`

type MarkNotificationReadParams struct {
	ID     uuid.UUID
	UserID uuid.UUID
}

// MarkNotificationRead is idempotent by construction (spec.md S-NOT-18) — a
// second call on an already-read row still matches WHERE and returns the
// same row.
func (q *Queries) MarkNotificationRead(ctx context.Context, arg MarkNotificationReadParams) (Notification, error) {
	row := q.db.QueryRow(ctx, markNotificationRead, arg.ID, arg.UserID)
	var i Notification
	err := row.Scan(&i.ID, &i.UserID, &i.Type, &i.Title, &i.Body, &i.IsRead, &i.RelatedBudgetID, &i.Currency, &i.PeriodStart, &i.CreatedAt, &i.RelatedUserID)
	return i, err
}
