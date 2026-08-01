package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// CategoryService owns F-04's business rules — cross-scope duplicate
// checking, the system-category write guard, and the visibility split
// (system/own/other-user). Shape validation (name/icon/type format) stays in
// dto/handler, never here.
type CategoryService struct {
	repo   CategoryRepo
	logger *zap.Logger
}

func NewCategoryService(repo CategoryRepo, logger *zap.Logger) *CategoryService {
	return &CategoryService{repo: repo, logger: logger}
}

// CreateCategory implements US-01. The (name, type) duplicate check spans
// system categories and the caller's own (spec.md S-CAT-04/S-CAT-05) — the
// own-scope and system-scope cases are also DB-constraint-guarded, but the
// cross-scope case (user vs. system) is service-check-only with an accepted
// concurrent-request race window (plan.md Finding #3).
func (s *CategoryService) CreateCategory(ctx context.Context, userID uuid.UUID, req dto.CreateCategoryRequest) (*model.Category, error) {
	if err := s.checkNameTypeAvailable(ctx, userID, req.Name, req.Type, nil); err != nil {
		return nil, err
	}

	category, err := s.repo.CreateCategory(ctx, repository.CreateCategoryParams{
		UserID: userID,
		Name:   req.Name,
		Icon:   req.Icon,
		Type:   req.Type,
	})
	if err != nil {
		if isUniqueViolation(err) {
			// Lost a concurrent-create race for the same own-scope or
			// system-scope (name, type) — the DB caught what our pre-check
			// couldn't (plan.md Finding #3).
			return nil, s.duplicateError(req.Name, req.Type)
		}
		return nil, fmt.Errorf("service.CreateCategory: %w", err)
	}
	return category, nil
}

// checkNameTypeAvailable is the shared duplicate-check helper used by both
// CreateCategory and UpdateCategory's rename path (plan.md Finding #10) —
// one rule, one call site logic, run from two places.
func (s *CategoryService) checkNameTypeAvailable(ctx context.Context, userID uuid.UUID, name, categoryType string, excludeID *uuid.UUID) error {
	exists, err := s.repo.NameTypeExists(ctx, userID, name, categoryType, excludeID)
	if err != nil {
		return fmt.Errorf("service.checkNameTypeAvailable: %w", err)
	}
	if exists {
		return s.duplicateError(name, categoryType)
	}
	return nil
}

func (s *CategoryService) duplicateError(name, categoryType string) error {
	return common.NewCategoryAlreadyExistsError(
		fmt.Sprintf("a %s category named %q already exists", categoryType, name),
	)
}

// ListCategories implements US-02 — system categories plus the caller's own,
// optionally filtered by type; ordering (system first, then alphabetical) is
// the repository query's job, not the service's.
func (s *CategoryService) ListCategories(ctx context.Context, userID uuid.UUID, categoryType *string) ([]*model.Category, error) {
	categories, err := s.repo.ListCategoriesForUser(ctx, userID, categoryType)
	if err != nil {
		return nil, fmt.Errorf("service.ListCategories: %w", err)
	}
	return categories, nil
}

// GetCategory implements US-03 — system categories are always visible;
// another user's category is a 403, distinct from a genuinely absent one
// (404), per spec.md S-CAT-16/S-CAT-17.
func (s *CategoryService) GetCategory(ctx context.Context, userID, categoryID uuid.UUID) (*model.Category, error) {
	return s.getVisibleCategory(ctx, userID, categoryID)
}

// getVisibleCategory fetches a category by ID and enforces read-visibility:
// system categories are always visible, the caller's own are visible,
// anything else is a 403. Shared by GetCategory; UpdateCategory/
// DeleteCategory use the stricter getOwnedCategory instead (plan.md Finding #11).
func (s *CategoryService) getVisibleCategory(ctx context.Context, userID, categoryID uuid.UUID) (*model.Category, error) {
	category, err := s.repo.GetCategoryByID(ctx, categoryID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, common.ErrCategoryNotFound
		}
		return nil, fmt.Errorf("service.getVisibleCategory: %w", err)
	}
	if category.IsSystem() || *category.UserID == userID {
		return category, nil
	}
	return nil, common.ErrCategoryAccessDenied
}

// getOwnedCategory fetches a category by ID and enforces write-visibility:
// only the caller's own category is writable — system categories are
// rejected here even though they are readable via getVisibleCategory
// (spec.md S-CAT-20/S-CAT-29: system categories are read-only to everyone).
func (s *CategoryService) getOwnedCategory(ctx context.Context, userID, categoryID uuid.UUID) (*model.Category, error) {
	category, err := s.repo.GetCategoryByID(ctx, categoryID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, common.ErrCategoryNotFound
		}
		return nil, fmt.Errorf("service.getOwnedCategory: %w", err)
	}
	if category.IsSystem() || *category.UserID != userID {
		return nil, common.ErrCategoryAccessDenied
	}
	return category, nil
}

// UpdateCategory implements US-04. type is never a request field (dto has no
// such field at the type level) — the only fields ever updated are name and
// icon. Renaming re-triggers the exact create-time duplicate rule
// (spec.md S-CAT-22 / plan.md Finding #10).
func (s *CategoryService) UpdateCategory(ctx context.Context, userID, categoryID uuid.UUID, req dto.UpdateCategoryRequest) (*model.Category, error) {
	if !req.HasUpdates() {
		return nil, common.NewInvalidInputError("at least one of name or icon must be provided")
	}
	// Ownership/visibility must gate before a rename-duplicate check can even
	// run — the check needs a real, owned row to exclude by ID (implementation-checklist:
	// only genuinely sequential/gating checks short-circuit ahead of others).
	category, err := s.getOwnedCategory(ctx, userID, categoryID)
	if err != nil {
		return nil, err
	}

	if req.Name != nil {
		if err := s.checkNameTypeAvailable(ctx, userID, *req.Name, string(category.Type), &categoryID); err != nil {
			return nil, err
		}
	}

	updated, err := s.repo.UpdateCategory(ctx, repository.UpdateCategoryParams{
		ID:     categoryID,
		UserID: userID,
		Name:   req.Name,
		Icon:   req.Icon,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, s.duplicateError(valueOr(req.Name, category.Name), string(category.Type))
		}
		return nil, fmt.Errorf("service.UpdateCategory: %w", err)
	}
	return updated, nil
}

// DeleteCategory implements US-05. The active-Budget existence check
// (spec.md S-CAT-27, 409 CATEGORY_IN_USE) is intentionally not implemented
// here — the budgets table doesn't exist yet (plan.md Finding #4 / CAT-T14).
// Deletion is unconditional once ownership is confirmed.
func (s *CategoryService) DeleteCategory(ctx context.Context, userID, categoryID uuid.UUID) (*model.Category, error) {
	if _, err := s.getOwnedCategory(ctx, userID, categoryID); err != nil {
		return nil, err
	}

	deleted, err := s.repo.SoftDeleteCategory(ctx, categoryID, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Lost a race to a concurrent delete of the same category
			// between the ownership check above and this write.
			return nil, common.ErrCategoryNotFound
		}
		return nil, fmt.Errorf("service.DeleteCategory: %w", err)
	}
	return deleted, nil
}

func valueOr(s *string, fallback string) string {
	if s == nil {
		return fallback
	}
	return *s
}
