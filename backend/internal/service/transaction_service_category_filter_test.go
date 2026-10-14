package service

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// category_ids is checked in one query now, and must still fail exactly as
// the old per-id check did: the first id that is missing gets 404, the first
// that belongs to someone else gets 403, and system Categories always pass.
func TestListTransactions_CategoryIDsVisibility(t *testing.T) {
	ctx := context.Background()
	svc, _, _, categoryRepo := newTestTransactionService(t)
	userID, otherID := uuid.New(), uuid.New()
	own := seedTestCategory(categoryRepo, userID, "Ăn uống", model.CategoryTypeExpense)
	foreign := seedTestCategory(categoryRepo, otherID, "Của người khác", model.CategoryTypeExpense)
	system := &model.Category{ID: uuid.New(), Name: "Chuyển khoản", Type: model.CategoryTypeExpense}
	categoryRepo.categories[system.ID] = system

	list := func(ids ...uuid.UUID) error {
		parts := make([]string, len(ids))
		for i, id := range ids {
			parts[i] = id.String()
		}
		_, err := svc.ListTransactions(ctx, userID, dto.ListTransactionsQuery{CategoryIDs: strings.Join(parts, ", ")})
		return err
	}

	if err := list(own.ID, system.ID); err != nil {
		t.Fatalf("own + system categories: %v", err)
	}
	assertAppErrCode(t, list(own.ID, uuid.New()), common.ErrCodeCategoryNotFound)
	assertAppErrCode(t, list(own.ID, foreign.ID), common.ErrCodeCategoryAccessDenied)
	// The first failing id decides, as before.
	assertAppErrCode(t, list(foreign.ID, uuid.New()), common.ErrCodeCategoryAccessDenied)
}
