-- name: CreateBudgetExceededNotification :one
-- ON CONFLICT DO NOTHING backs the dedup invariant (spec.md S-NOT-06,
-- plan.md Finding #4) — a conflict on idx_notifications_budget_exceeded_dedup
-- means this exact (budget, currency, period) crossing was already notified,
-- which is a successful no-op for the job, never an error. sqlc's :one maps
-- this to QueryRow, so zero rows returned surfaces as pgx.ErrNoRows — the
-- repository layer treats that as "already existed", not a failure.
INSERT INTO notifications (user_id, type, title, body, related_budget_id, currency, period_start)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (related_budget_id, currency, period_start) WHERE type = 'budget_exceeded'
    DO NOTHING
RETURNING *;

-- name: ListNotificationsByUser :many
-- Cursor pagination on (created_at DESC, id DESC), same convention as F-01's
-- ListUsers. is_read is an optional sqlc.narg filter (S-NOT-09).
SELECT * FROM notifications
WHERE user_id = $1
  AND (sqlc.narg('is_read')::bool IS NULL OR is_read = sqlc.narg('is_read'))
  AND (
    sqlc.narg('cursor_created_at')::timestamptz IS NULL
    OR created_at < sqlc.narg('cursor_created_at')
    OR (created_at = sqlc.narg('cursor_created_at') AND id < sqlc.narg('cursor_id'))
  )
ORDER BY created_at DESC, id DESC
LIMIT $2;

-- name: CountNotifications :one
SELECT COUNT(*) FROM notifications
WHERE user_id = $1
  AND (sqlc.narg('is_read')::bool IS NULL OR is_read = sqlc.narg('is_read'));

-- name: GetNotificationByID :one
-- Deliberately NOT scoped by user_id, same precedent as GetWalletByID/
-- GetBudgetByID — the service layer decides 403 vs. 404 (spec.md S-NOT-14/
-- S-NOT-15).
SELECT * FROM notifications
WHERE id = $1
LIMIT 1;

-- name: MarkNotificationRead :one
-- is_read only ever moves false -> true (spec.md Context decision #5);
-- idempotent by construction — a second call on an already-true row still
-- matches WHERE and returns the same row (S-NOT-18).
UPDATE notifications
SET is_read = TRUE
WHERE id = $1
  AND user_id = $2
RETURNING *;

-- name: MarkNotificationsRead :execrows
-- Batch form of MarkNotificationRead: the rows the app has shown on screen
-- (ids), or every unread row of the User when ids is NULL ("read all").
-- Scoped by user_id, so another User's id in the list is skipped, not an
-- error. Hand-authored in sqlc/notifications_read.sql.go.
UPDATE notifications
SET is_read = TRUE
WHERE user_id = $1
  AND is_read = FALSE
  AND (sqlc.narg('ids')::uuid[] IS NULL OR id = ANY(sqlc.narg('ids')::uuid[]));

-- name: CreateAccessRequestNotification :exec
-- Tells an admin that someone asked for an account (mig 031); related_user_id
-- is the requester, so the app can approve straight from the notification.
-- Hand-authored in sqlc/notifications_access.sql.go.
INSERT INTO notifications (user_id, type, title, body, related_user_id)
VALUES ($1, 'access_request', $2, $3, $4);
