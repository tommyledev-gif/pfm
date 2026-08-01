package service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
)

func newTestCategoryService(t *testing.T) (*CategoryService, *fakeCategoryRepo) {
	t.Helper()
	repo := newFakeCategoryRepo()
	return NewCategoryService(repo, zap.NewNop()), repo
}

// S-CAT-01: happy path create.
func TestCategoryService_CreateCategory_Success(t *testing.T) {
	svc, _ := newTestCategoryService(t)
	userID := uuid.New()

	category, err := svc.CreateCategory(context.Background(), userID, dto.CreateCategoryRequest{
		Name: "Groceries",
		Type: "expense",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if category.UserID == nil || *category.UserID != userID {
		t.Fatalf("expected category to be owned by the caller")
	}
}

// S-CAT-04: a case-insensitive collision against a system category is
// rejected, not just a collision against the caller's own categories.
func TestCategoryService_CreateCategory_DuplicateAgainstSystemCategory(t *testing.T) {
	svc, repo := newTestCategoryService(t)
	repo.seedSystemCategory("Food", "expense")
	userID := uuid.New()

	_, err := svc.CreateCategory(context.Background(), userID, dto.CreateCategoryRequest{
		Name: "food",
		Type: "expense",
	})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeCategoryAlreadyExists {
		t.Fatalf("expected CATEGORY_ALREADY_EXISTS, got %v", err)
	}
}

// S-CAT-05: a collision against the caller's own prior category is rejected.
func TestCategoryService_CreateCategory_DuplicateAgainstOwnCategory(t *testing.T) {
	svc, _ := newTestCategoryService(t)
	userID := uuid.New()

	_, err := svc.CreateCategory(context.Background(), userID, dto.CreateCategoryRequest{Name: "Side Hustle", Type: "income"})
	if err != nil {
		t.Fatalf("unexpected error creating first category: %v", err)
	}

	_, err = svc.CreateCategory(context.Background(), userID, dto.CreateCategoryRequest{Name: "Side Hustle", Type: "income"})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeCategoryAlreadyExists {
		t.Fatalf("expected CATEGORY_ALREADY_EXISTS, got %v", err)
	}
}

// S-CAT-06: same name, different type, is not a duplicate.
func TestCategoryService_CreateCategory_SameNameDifferentTypeAllowed(t *testing.T) {
	svc, _ := newTestCategoryService(t)
	userID := uuid.New()

	_, err := svc.CreateCategory(context.Background(), userID, dto.CreateCategoryRequest{Name: "Rent", Type: "expense"})
	if err != nil {
		t.Fatalf("unexpected error creating expense category: %v", err)
	}

	_, err = svc.CreateCategory(context.Background(), userID, dto.CreateCategoryRequest{Name: "Rent", Type: "income"})
	if err != nil {
		t.Fatalf("expected same name with different type to be allowed, got: %v", err)
	}
}

// S-CAT-16 vs S-CAT-17: ownership vs. existence must return distinct codes;
// S-CAT-14: a system category is always visible.
func TestCategoryService_GetCategory_VisibilitySplit(t *testing.T) {
	svc, repo := newTestCategoryService(t)
	ownerID := uuid.New()
	otherID := uuid.New()

	owned, err := svc.CreateCategory(context.Background(), ownerID, dto.CreateCategoryRequest{Name: "Groceries", Type: "expense"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	system := repo.seedSystemCategory("Food", "expense")

	t.Run("system category is visible to any caller", func(t *testing.T) {
		got, err := svc.GetCategory(context.Background(), otherID, system.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !got.IsSystem() {
			t.Fatalf("expected returned category to be system-defined")
		}
	})

	t.Run("category owned by someone else returns 403 CATEGORY_ACCESS_DENIED", func(t *testing.T) {
		_, err := svc.GetCategory(context.Background(), otherID, owned.ID)
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeCategoryAccessDenied {
			t.Fatalf("expected CATEGORY_ACCESS_DENIED, got %v", err)
		}
	})

	t.Run("category that does not exist returns 404 CATEGORY_NOT_FOUND", func(t *testing.T) {
		_, err := svc.GetCategory(context.Background(), ownerID, uuid.New())
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeCategoryNotFound {
			t.Fatalf("expected CATEGORY_NOT_FOUND, got %v", err)
		}
	})
}

// S-CAT-20/S-CAT-29: system categories are never writable, even by an
// authenticated caller with no other conflicting claim.
func TestCategoryService_SystemCategory_NeverWritable(t *testing.T) {
	svc, repo := newTestCategoryService(t)
	system := repo.seedSystemCategory("Food", "expense")
	callerID := uuid.New()

	t.Run("update is rejected", func(t *testing.T) {
		newName := "Snacks"
		_, err := svc.UpdateCategory(context.Background(), callerID, system.ID, dto.UpdateCategoryRequest{Name: &newName})
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeCategoryAccessDenied {
			t.Fatalf("expected CATEGORY_ACCESS_DENIED, got %v", err)
		}
	})

	t.Run("delete is rejected", func(t *testing.T) {
		_, err := svc.DeleteCategory(context.Background(), callerID, system.ID)
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeCategoryAccessDenied {
			t.Fatalf("expected CATEGORY_ACCESS_DENIED, got %v", err)
		}
	})
}

// S-CAT-25: an empty PATCH body is a client mistake, not a no-op success.
func TestCategoryService_UpdateCategory_EmptyBodyRejected(t *testing.T) {
	svc, _ := newTestCategoryService(t)
	userID := uuid.New()

	category, err := svc.CreateCategory(context.Background(), userID, dto.CreateCategoryRequest{Name: "Groceries", Type: "expense"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	_, err = svc.UpdateCategory(context.Background(), userID, category.ID, dto.UpdateCategoryRequest{})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeInvalidInput {
		t.Fatalf("expected INVALID_INPUT, got %v", err)
	}
}

// S-CAT-22: renaming into an existing (name, type) re-triggers the same
// duplicate rule as Create.
func TestCategoryService_UpdateCategory_RenameCollision(t *testing.T) {
	svc, _ := newTestCategoryService(t)
	userID := uuid.New()

	_, err := svc.CreateCategory(context.Background(), userID, dto.CreateCategoryRequest{Name: "Food", Type: "expense"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	snacks, err := svc.CreateCategory(context.Background(), userID, dto.CreateCategoryRequest{Name: "Snacks", Type: "expense"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	newName := "Food"
	_, err = svc.UpdateCategory(context.Background(), userID, snacks.ID, dto.UpdateCategoryRequest{Name: &newName})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeCategoryAlreadyExists {
		t.Fatalf("expected CATEGORY_ALREADY_EXISTS, got %v", err)
	}
}

// S-CAT-26/S-CAT-31: delete succeeds once, then the same category is a 404
// on a second call — deletion is not idempotent.
func TestCategoryService_DeleteCategory_NotIdempotent(t *testing.T) {
	svc, _ := newTestCategoryService(t)
	userID := uuid.New()

	category, err := svc.CreateCategory(context.Background(), userID, dto.CreateCategoryRequest{Name: "Groceries", Type: "expense"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if _, err := svc.DeleteCategory(context.Background(), userID, category.ID); err != nil {
		t.Fatalf("unexpected error on first delete: %v", err)
	}

	_, err = svc.DeleteCategory(context.Background(), userID, category.ID)
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeCategoryNotFound {
		t.Fatalf("expected CATEGORY_NOT_FOUND on second delete, got %v", err)
	}
}

// S-CAT-08: list scopes to system categories plus the caller's own, isolating
// other users' private categories.
func TestCategoryService_ListCategories_ScopedToCallerAndSystem(t *testing.T) {
	svc, repo := newTestCategoryService(t)
	callerID := uuid.New()
	otherID := uuid.New()

	repo.seedSystemCategory("Food", "expense")
	repo.seedSystemCategory("Salary", "income")
	if _, err := svc.CreateCategory(context.Background(), callerID, dto.CreateCategoryRequest{Name: "Side Hustle", Type: "income"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, err := svc.CreateCategory(context.Background(), otherID, dto.CreateCategoryRequest{Name: "Private", Type: "expense"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	categories, err := svc.ListCategories(context.Background(), callerID, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(categories) != 3 {
		t.Fatalf("expected 3 categories (2 system + caller's own 1), got %d", len(categories))
	}
	for _, c := range categories {
		if c.UserID != nil && *c.UserID == otherID {
			t.Fatalf("leaked another user's private category")
		}
	}
}
