package service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

func newTestNotificationService(t *testing.T) (*NotificationService, *fakeNotificationRepo, *fakeBudgetRepo) {
	t.Helper()
	notificationRepo := newFakeNotificationRepo()
	budgetRepo := newFakeBudgetRepo()
	return NewNotificationService(notificationRepo, budgetRepo, newTestCycleResolver(), zap.NewNop()), notificationRepo, budgetRepo
}

// seedActiveBudget inserts a Budget with a single currency limit directly
// into the fake, bypassing BudgetService.CreateBudget — this package's tests
// are for NotificationService, not Budget's own creation flow.
func seedActiveBudget(repo *fakeBudgetRepo, userID, categoryID uuid.UUID, categoryName, currency string, amountLimit int64) *model.Budget {
	b := &model.Budget{
		ID:           uuid.New(),
		UserID:       userID,
		CategoryID:   categoryID,
		CategoryName: categoryName,
		Period:       common.BudgetPeriodMonthly,
		Limits:       []model.BudgetLimit{{Currency: currency, AmountLimit: amountLimit}},
	}
	repo.budgets[b.ID] = b
	return b
}

// S-NOT-01: a Budget whose spend crosses its limit gets exactly one
// Notification.
func TestNotificationService_EvaluateBudgets_CreatesNotificationWhenExceeded(t *testing.T) {
	svc, notificationRepo, budgetRepo := newTestNotificationService(t)
	userID, categoryID := uuid.New(), uuid.New()
	budget := seedActiveBudget(budgetRepo, userID, categoryID, "Food", "VND", 2000000)
	budgetRepo.seedSpend(categoryID, "VND", 2200000)

	svc.EvaluateBudgets(context.Background())

	got, err := notificationRepo.ListNotificationsByUser(context.Background(), userID, repository.ListNotificationsFilter{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 notification, got %d", len(got))
	}
	if got[0].RelatedBudgetID == nil || *got[0].RelatedBudgetID != budget.ID {
		t.Fatalf("expected notification to reference the exceeded budget")
	}
}

// S-NOT-02: running the job twice for an already-notified crossing must not
// create a duplicate.
func TestNotificationService_EvaluateBudgets_NoDuplicateOnSecondRun(t *testing.T) {
	svc, notificationRepo, budgetRepo := newTestNotificationService(t)
	userID, categoryID := uuid.New(), uuid.New()
	seedActiveBudget(budgetRepo, userID, categoryID, "Food", "VND", 2000000)
	budgetRepo.seedSpend(categoryID, "VND", 2200000)

	svc.EvaluateBudgets(context.Background())
	svc.EvaluateBudgets(context.Background())

	got, _ := notificationRepo.ListNotificationsByUser(context.Background(), userID, repository.ListNotificationsFilter{})
	if len(got) != 1 {
		t.Fatalf("expected exactly 1 notification after 2 runs, got %d", len(got))
	}
}

// S-NOT-03: a multi-currency Budget only notifies for the currency that
// actually crossed its limit.
func TestNotificationService_EvaluateBudgets_MultiCurrencyIndependence(t *testing.T) {
	svc, notificationRepo, budgetRepo := newTestNotificationService(t)
	userID, categoryID := uuid.New(), uuid.New()
	b := &model.Budget{
		ID:         uuid.New(),
		UserID:     userID,
		CategoryID: categoryID,
		Limits: []model.BudgetLimit{
			{Currency: "VND", AmountLimit: 5000000},
			{Currency: "USD", AmountLimit: 100000},
		},
	}
	budgetRepo.budgets[b.ID] = b
	budgetRepo.seedSpend(categoryID, "VND", 5500000) // exceeded
	budgetRepo.seedSpend(categoryID, "USD", 50000)   // within

	svc.EvaluateBudgets(context.Background())

	got, _ := notificationRepo.ListNotificationsByUser(context.Background(), userID, repository.ListNotificationsFilter{})
	if len(got) != 1 {
		t.Fatalf("expected 1 notification (VND only), got %d", len(got))
	}
	if got[0].Currency == nil || *got[0].Currency != "VND" {
		t.Fatalf("expected the VND crossing, got %v", got[0].Currency)
	}
}

// S-NOT-04: no Budgets at all is a no-op, not an error.
func TestNotificationService_EvaluateBudgets_NoBudgetsIsNoOp(t *testing.T) {
	svc, _, _ := newTestNotificationService(t)
	svc.EvaluateBudgets(context.Background()) // must not panic or error
}

// A Budget within its limit never generates a Notification.
func TestNotificationService_EvaluateBudgets_WithinLimitIsNoOp(t *testing.T) {
	svc, notificationRepo, budgetRepo := newTestNotificationService(t)
	userID, categoryID := uuid.New(), uuid.New()
	seedActiveBudget(budgetRepo, userID, categoryID, "Food", "VND", 2000000)
	budgetRepo.seedSpend(categoryID, "VND", 1000000)

	svc.EvaluateBudgets(context.Background())

	got, _ := notificationRepo.ListNotificationsByUser(context.Background(), userID, repository.ListNotificationsFilter{})
	if len(got) != 0 {
		t.Fatalf("expected no notifications, got %d", len(got))
	}
}

// S-NOT-11: ListNotifications is strictly scoped to the caller.
func TestNotificationService_ListNotifications_ScopedToCaller(t *testing.T) {
	svc, notificationRepo, _ := newTestNotificationService(t)
	userA, userB := uuid.New(), uuid.New()
	notificationRepo.seedNotification(&model.Notification{ID: uuid.New(), UserID: userA, Title: "A"})
	notificationRepo.seedNotification(&model.Notification{ID: uuid.New(), UserID: userB, Title: "B"})

	got, _, _, err := svc.ListNotifications(context.Background(), userA, "", "", 20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 || got[0].UserID != userA {
		t.Fatalf("expected only caller's notification, got %+v", got)
	}
}

// S-NOT-09: is_read filter.
func TestNotificationService_ListNotifications_FilterByIsRead(t *testing.T) {
	svc, notificationRepo, _ := newTestNotificationService(t)
	userID := uuid.New()
	notificationRepo.seedNotification(&model.Notification{ID: uuid.New(), UserID: userID, Title: "unread", IsRead: false})
	notificationRepo.seedNotification(&model.Notification{ID: uuid.New(), UserID: userID, Title: "read", IsRead: true})

	got, _, _, err := svc.ListNotifications(context.Background(), userID, "false", "", 20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 || got[0].Title != "unread" {
		t.Fatalf("expected only the unread notification, got %+v", got)
	}
}

// S-NOT-14: viewing a non-existent Notification is a 404.
func TestNotificationService_GetNotification_NotFound(t *testing.T) {
	svc, _, _ := newTestNotificationService(t)
	_, err := svc.GetNotification(context.Background(), uuid.New(), uuid.New())
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeNotificationNotFound {
		t.Fatalf("expected NOTIFICATION_NOT_FOUND, got %v", err)
	}
}

// S-NOT-15: viewing another user's Notification is a 403.
func TestNotificationService_GetNotification_AccessDenied(t *testing.T) {
	svc, notificationRepo, _ := newTestNotificationService(t)
	owner := uuid.New()
	n := &model.Notification{ID: uuid.New(), UserID: owner}
	notificationRepo.seedNotification(n)

	_, err := svc.GetNotification(context.Background(), uuid.New(), n.ID)
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeNotificationAccessDenied {
		t.Fatalf("expected NOTIFICATION_ACCESS_DENIED, got %v", err)
	}
}

// S-NOT-18: marking an already-read Notification as read again is an
// idempotent no-op, not an error.
func TestNotificationService_MarkRead_Idempotent(t *testing.T) {
	svc, notificationRepo, _ := newTestNotificationService(t)
	userID := uuid.New()
	n := &model.Notification{ID: uuid.New(), UserID: userID, IsRead: true}
	notificationRepo.seedNotification(n)

	updated, err := svc.MarkRead(context.Background(), userID, n.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !updated.IsRead {
		t.Fatalf("expected is_read to remain true")
	}
}

// S-NOT-20: marking another user's Notification as read is a 403.
func TestNotificationService_MarkRead_AccessDenied(t *testing.T) {
	svc, notificationRepo, _ := newTestNotificationService(t)
	owner := uuid.New()
	n := &model.Notification{ID: uuid.New(), UserID: owner}
	notificationRepo.seedNotification(n)

	_, err := svc.MarkRead(context.Background(), uuid.New(), n.ID)
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeNotificationAccessDenied {
		t.Fatalf("expected NOTIFICATION_ACCESS_DENIED, got %v", err)
	}
}
