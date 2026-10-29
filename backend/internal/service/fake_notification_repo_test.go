package service

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// fakeNotificationRepo is an in-memory stand-in for NotificationRepo, used
// instead of a real Postgres per Go Test Conventions — same approach as
// fakeBudgetRepo/fakeWalletRepo. dedup mirrors
// idx_notifications_budget_exceeded_dedup (specs/notification-handling/plan.md
// Finding #4) — the same (budget, currency, period) triple can never insert
// twice, matching the real partial unique index's behavior.
type fakeNotificationRepo struct {
	mu            sync.Mutex
	notifications map[uuid.UUID]*model.Notification
	dedup         map[dedupKey]bool
}

type dedupKey struct {
	budgetID    uuid.UUID
	currency    string
	periodStart time.Time
}

func newFakeNotificationRepo() *fakeNotificationRepo {
	return &fakeNotificationRepo{
		notifications: make(map[uuid.UUID]*model.Notification),
		dedup:         make(map[dedupKey]bool),
	}
}

func (f *fakeNotificationRepo) CreateBudgetExceededNotification(_ context.Context, arg repository.CreateBudgetExceededNotificationParams) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	key := dedupKey{budgetID: arg.RelatedBudgetID, currency: arg.Currency, periodStart: arg.PeriodStart}
	if f.dedup[key] {
		return false, nil
	}
	f.dedup[key] = true

	budgetID, currency, periodStart := arg.RelatedBudgetID, arg.Currency, arg.PeriodStart
	n := &model.Notification{
		ID:              uuid.New(),
		UserID:          arg.UserID,
		Type:            model.NotificationTypeBudgetExceeded,
		Title:           arg.Title,
		Body:            arg.Body,
		RelatedBudgetID: &budgetID,
		Currency:        &currency,
		PeriodStart:     &periodStart,
		CreatedAt:       time.Now().UTC(),
	}
	f.notifications[n.ID] = n
	return true, nil
}

func (f *fakeNotificationRepo) ListNotificationsByUser(_ context.Context, userID uuid.UUID, filter repository.ListNotificationsFilter) ([]*model.Notification, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	var out []*model.Notification
	for _, n := range f.notifications {
		if n.UserID != userID {
			continue
		}
		if filter.IsRead != nil && n.IsRead != *filter.IsRead {
			continue
		}
		cp := *n
		out = append(out, &cp)
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].CreatedAt.Equal(out[j].CreatedAt) {
			return out[i].CreatedAt.After(out[j].CreatedAt)
		}
		return out[i].ID.String() > out[j].ID.String()
	})
	if filter.Limit > 0 && int(filter.Limit) < len(out) {
		out = out[:filter.Limit]
	}
	return out, nil
}

func (f *fakeNotificationRepo) CountNotifications(_ context.Context, userID uuid.UUID, isRead *bool) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	var count int64
	for _, n := range f.notifications {
		if n.UserID != userID {
			continue
		}
		if isRead != nil && n.IsRead != *isRead {
			continue
		}
		count++
	}
	return count, nil
}

// GetNotificationByID is deliberately NOT scoped by user_id, matching the
// real query — the service layer decides 403 vs. 404.
func (f *fakeNotificationRepo) GetNotificationByID(_ context.Context, id uuid.UUID) (*model.Notification, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	n, ok := f.notifications[id]
	if !ok {
		return nil, pgx.ErrNoRows
	}
	cp := *n
	return &cp, nil
}

func (f *fakeNotificationRepo) MarkNotificationRead(_ context.Context, id, userID uuid.UUID) (*model.Notification, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	n, ok := f.notifications[id]
	if !ok || n.UserID != userID {
		return nil, pgx.ErrNoRows
	}
	n.IsRead = true
	cp := *n
	return &cp, nil
}

// MarkNotificationsRead mirrors the real query: scoped by user_id, only
// unread rows count, nil ids means every unread row of the User.
func (f *fakeNotificationRepo) MarkNotificationsRead(_ context.Context, userID uuid.UUID, ids []uuid.UUID) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	wanted := make(map[uuid.UUID]bool, len(ids))
	for _, id := range ids {
		wanted[id] = true
	}
	var updated int64
	for _, n := range f.notifications {
		if n.UserID != userID || n.IsRead || (ids != nil && !wanted[n.ID]) {
			continue
		}
		n.IsRead = true
		updated++
	}
	return updated, nil
}

// seedNotification is a test helper for US-01/US-02/US-03 tests that need an
// existing Notification without going through EvaluateBudgets first.
func (f *fakeNotificationRepo) seedNotification(n *model.Notification) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.notifications[n.ID] = n
}
