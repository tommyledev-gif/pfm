package service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/repository"
)

// visibleCategories reads every id in one query but still fails on the first
// bad id in request order: missing before foreign is 404, foreign before
// missing is 403 (specs/security-hardening-2026-10 US-12).
func TestAnalytics_CategoryCheckKeepsRequestOrder(t *testing.T) {
	f := newAnalyticsFixture(t)
	foreign, err := f.categories.CreateCategory(context.Background(), repository.CreateCategoryParams{UserID: uuid.New(), Name: "Của người khác", Type: "expense"})
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	missing := uuid.New()

	req := thisCycleSum()
	req.CategoryIDs = []uuid.UUID{missing, foreign.ID}
	if _, err := f.svc.Answer(context.Background(), f.userID, req); !errors.Is(err, common.ErrCategoryNotFound) {
		t.Fatalf("missing first: got %v", err)
	}
	req = thisCycleSum()
	req.CategoryIDs = []uuid.UUID{foreign.ID, missing}
	if _, err := f.svc.Answer(context.Background(), f.userID, req); !errors.Is(err, common.ErrCategoryAccessDenied) {
		t.Fatalf("foreign first: got %v", err)
	}
}
