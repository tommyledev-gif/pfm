package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// NotificationService owns F-10's business rules — the budget-crossing
// evaluation job, list/view/mark-read for the User-facing endpoints, and the
// 403-vs-404 split. Depends directly on BudgetRepo/CategoryRepo for
// read-only composition, the same shape of dependency ReportService/
// TransactionService already have on other features' repositories
// (specs/notification-handling/plan.md Finding #6).
type NotificationService struct {
	repo       NotificationRepo
	budgetRepo BudgetRepo
	logger     *zap.Logger
}

func NewNotificationService(repo NotificationRepo, budgetRepo BudgetRepo, logger *zap.Logger) *NotificationService {
	return &NotificationService{repo: repo, budgetRepo: budgetRepo, logger: logger}
}

// EvaluateBudgets implements US-00 — the scheduled background job
// (specs/notification-handling/plan.md Finding #2), invoked on a ticker from
// cmd/server/main.go, never from an HTTP request. Re-evaluates every active
// Budget's live spend against its per-currency limits and creates at most
// one budget_exceeded Notification per (budget, currency, period) — dedup is
// enforced at the DB layer (Finding #4), so this can run any number of
// times, even concurrently, without ever double-notifying.
func (s *NotificationService) EvaluateBudgets(ctx context.Context) {
	userIDs, err := s.budgetRepo.ListDistinctUserIDsWithActiveBudgets(ctx)
	if err != nil {
		s.logger.Error("notification job: failed to list users with active budgets", zap.Error(err))
		return
	}

	periodStart := currentPeriodStart()
	for _, userID := range userIDs {
		if err := s.evaluateBudgetsForUser(ctx, userID, periodStart); err != nil {
			// One user's failure must not stop the rest of the run — there is
			// no HTTP caller to fail this back to (spec.md US-00).
			s.logger.Error("notification job: failed to evaluate user's budgets",
				zap.String("user_id", userID.String()), zap.Error(err))
		}
	}
}

func (s *NotificationService) evaluateBudgetsForUser(ctx context.Context, userID uuid.UUID, periodStart time.Time) error {
	budgets, err := s.budgetRepo.ListBudgetsByUser(ctx, userID)
	if err != nil {
		return fmt.Errorf("service.evaluateBudgetsForUser: %w", err)
	}
	spentByCategory, err := s.budgetRepo.SpentByUserCurrentPeriod(ctx, userID)
	if err != nil {
		return fmt.Errorf("service.evaluateBudgetsForUser: %w", err)
	}

	for _, budget := range budgets {
		spentByCurrency := spentByCategory[budget.CategoryID]
		for _, limit := range budget.Limits {
			spent := spentByCurrency[limit.Currency]
			if spent <= limit.AmountLimit {
				continue
			}
			if err := s.notifyBudgetExceeded(ctx, budget, limit.Currency, limit.AmountLimit, spent, periodStart); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *NotificationService) notifyBudgetExceeded(ctx context.Context, budget *model.Budget, currency string, amountLimit, spent int64, periodStart time.Time) error {
	title, body := buildBudgetExceededNotification(budget.CategoryName, currency, amountLimit, spent)

	created, err := s.repo.CreateBudgetExceededNotification(ctx, repository.CreateBudgetExceededNotificationParams{
		UserID:          budget.UserID,
		Title:           title,
		Body:            body,
		RelatedBudgetID: budget.ID,
		Currency:        currency,
		PeriodStart:     periodStart,
	})
	if err != nil {
		return fmt.Errorf("service.notifyBudgetExceeded: %w", err)
	}
	if created {
		s.logger.Info("notification created: budget exceeded",
			zap.String("user_id", budget.UserID.String()),
			zap.String("budget_id", budget.ID.String()),
			zap.String("currency", currency))
	}
	// created == false means this exact crossing was already notified this
	// period (spec.md S-NOT-02) — a successful no-op, not an error.
	return nil
}

// buildBudgetExceededNotification renders the fully static title/body once,
// at creation time — never re-derived at read time (spec.md Context
// decision #3).
func buildBudgetExceededNotification(categoryName, currency string, amountLimit, spent int64) (title, body string) {
	title = fmt.Sprintf("Budget exceeded: %s", categoryName)
	body = fmt.Sprintf("You've spent %s against a %s monthly limit for %s.",
		common.FormatCents(spent, currency), common.FormatCents(amountLimit, currency), categoryName)
	return title, body
}

// currentPeriodStart is the first day of the calendar month containing "now"
// (UTC) — mirrors Budget's own period-window convention
// (specs/budget-management/spec.md Context decision #3), computed once per
// job run in Go rather than per-query in SQL, since every user in one run
// shares the same period.
func currentPeriodStart() time.Time {
	now := time.Now().UTC()
	return time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
}

// ListNotifications implements US-01 — strictly scoped to the caller
// (CLAUDE.md user isolation rule). Returns plain values rather than a DTO,
// same convention as UserService.ListUsers.
func (s *NotificationService) ListNotifications(ctx context.Context, userID uuid.UUID, isReadStr, cursor string, limit int) ([]*model.Notification, *string, int64, error) {
	var isRead *bool
	if isReadStr != "" {
		b := isReadStr == "true"
		isRead = &b
	}

	var cursorID *uuid.UUID
	var cursorCreatedAt *time.Time
	if cursor != "" {
		id, createdAt, err := decodeCursor(cursor)
		if err != nil {
			return nil, nil, 0, common.NewInvalidInputError("cursor is invalid")
		}
		cursorID = &id
		cursorCreatedAt = &createdAt
	}

	// Fetch one extra row to know whether a next page exists, without a
	// separate COUNT-based lookahead query (same convention as UserService).
	notifications, err := s.repo.ListNotificationsByUser(ctx, userID, repository.ListNotificationsFilter{
		IsRead:          isRead,
		CursorCreatedAt: cursorCreatedAt,
		CursorID:        cursorID,
		Limit:           int32(limit + 1),
	})
	if err != nil {
		return nil, nil, 0, fmt.Errorf("service.ListNotifications: %w", err)
	}

	hasMore := len(notifications) > limit
	if hasMore {
		notifications = notifications[:limit]
	}

	var nextCursor *string
	if hasMore && len(notifications) > 0 {
		last := notifications[len(notifications)-1]
		c, err := encodeCursor(last.ID, last.CreatedAt)
		if err != nil {
			return nil, nil, 0, fmt.Errorf("service.ListNotifications: %w", err)
		}
		nextCursor = &c
	}

	total, err := s.repo.CountNotifications(ctx, userID, isRead)
	if err != nil {
		return nil, nil, 0, fmt.Errorf("service.ListNotifications: %w", err)
	}

	return notifications, nextCursor, total, nil
}

// GetNotification implements US-02 — distinguishes "belongs to someone else"
// (403) from "doesn't exist" (404), per spec.md S-NOT-14/S-NOT-15. Never
// marks the Notification as read as a side effect (spec.md US-02 Edge Case #1).
func (s *NotificationService) GetNotification(ctx context.Context, userID, notificationID uuid.UUID) (*model.Notification, error) {
	return s.getOwnedNotification(ctx, userID, notificationID)
}

// getOwnedNotification fetches a Notification by ID and enforces ownership —
// shared by GetNotification and MarkRead so the 403-vs-404 split is decided
// in exactly one place.
func (s *NotificationService) getOwnedNotification(ctx context.Context, userID, notificationID uuid.UUID) (*model.Notification, error) {
	notification, err := s.repo.GetNotificationByID(ctx, notificationID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, common.ErrNotificationNotFound
		}
		return nil, fmt.Errorf("service.getOwnedNotification: %w", err)
	}
	if notification.UserID != userID {
		return nil, common.ErrNotificationAccessDenied
	}
	return notification, nil
}

// MarkRead implements US-03 — idempotent by construction (spec.md S-NOT-18):
// setting is_read=true on an already-read Notification is a safe no-op.
func (s *NotificationService) MarkRead(ctx context.Context, userID, notificationID uuid.UUID) (*model.Notification, error) {
	if _, err := s.getOwnedNotification(ctx, userID, notificationID); err != nil {
		return nil, err
	}

	updated, err := s.repo.MarkNotificationRead(ctx, notificationID, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Lost a race to a concurrent state change between the ownership
			// check above and this write — same precedent as WalletService/
			// BudgetService's owned-resource writes.
			return nil, common.ErrNotificationNotFound
		}
		return nil, fmt.Errorf("service.MarkRead: %w", err)
	}
	return updated, nil
}
