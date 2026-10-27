package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

// BudgetHandler is HTTP-only for F-05 (Budget Management): parse request,
// call service, map result to a response. No business logic lives here —
// category validation, the duplicate-active-Budget catch, and the
// (stubbed) spend computation are all in BudgetService.
type BudgetHandler struct {
	budgetService *service.BudgetService
	iconUploader  service.IconUploader
	logger        *zap.Logger
}

func NewBudgetHandler(budgetService *service.BudgetService, iconUploader service.IconUploader, logger *zap.Logger) *BudgetHandler {
	return &BudgetHandler{budgetService: budgetService, iconUploader: iconUploader, logger: logger}
}

// CreateBudget handles POST /budgets (registered behind JWTAuth only — every
// active user manages only their own budgets, no role gate).
func (h *BudgetHandler) CreateBudget(c *fiber.Ctx) error {
	var req dto.CreateBudgetRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}
	if err := dto.ValidateLimits(req.Limits); err != nil {
		return response.Error(c, h.logger, err)
	}

	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	budget, err := h.budgetService.CreateBudget(c.Context(), userID, req)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusCreated, "budget created successfully", dto.NewBudgetResponse(budget))
}

// ListBudgets handles GET /budgets.
func (h *BudgetHandler) ListBudgets(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	budgets, err := h.budgetService.ListBudgets(c.Context(), userID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "budgets retrieved successfully", dto.NewListBudgetsResponse(budgets))
}

// GetBudget handles GET /budgets/:id.
func (h *BudgetHandler) GetBudget(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	budgetID, err := budgetIDParam(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	budget, err := h.budgetService.GetBudget(c.Context(), userID, budgetID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "budget retrieved successfully", dto.NewBudgetResponse(budget))
}

// UpdateBudget handles PATCH /budgets/:id. Uses dto.DecodeStrict instead of
// c.BodyParser so an unrecognized "category_id"/"period"/"start_date" field
// is rejected with 400 rather than silently ignored (mirrors
// UpdateWalletRequest/UpdateCategoryRequest's precedent).
func (h *BudgetHandler) UpdateBudget(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	budgetID, err := budgetIDParam(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	var req dto.UpdateBudgetRequest
	if err := dto.DecodeStrict(c.Body(), &req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body or unrecognized field"))
	}
	// Validates icon/icon_url length limits (specs/wallet-budget-icons)
	// — Limits' own shape isn't a validator-tag concern (map-key
	// validation), so it keeps its separate ValidateLimits call below.
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}
	if req.Limits != nil {
		if err := dto.ValidateLimits(req.Limits); err != nil {
			return response.Error(c, h.logger, err)
		}
	}

	budget, err := h.budgetService.UpdateBudget(c.Context(), userID, budgetID, req)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "budget updated successfully", dto.NewBudgetResponse(budget))
}

// DeleteBudget handles DELETE /budgets/:id.
func (h *BudgetHandler) DeleteBudget(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	budgetID, err := budgetIDParam(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	if _, err := h.budgetService.DeleteBudget(c.Context(), userID, budgetID); err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "budget deleted successfully", nil)
}

// BulkCreateBudgets handles POST /budgets/bulk (specs/ai-budget-wizard/spec.md
// US-05) — the 20-item cap and duplicate-category_id check both run here,
// at handler level, before any service call (plan.md Business Rules): a
// generic `max` validator tag would produce 400 INVALID_INPUT, but this
// endpoint's contract requires the distinct 422 TOO_MANY_BUDGETS/
// DUPLICATE_CATEGORY_IN_REQUEST codes instead.
func (h *BudgetHandler) BulkCreateBudgets(c *fiber.Ctx) error {
	var req dto.BulkCreateBudgetsRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}
	if len(req.Budgets) > common.BudgetWizardMaxItems {
		return response.Error(c, h.logger, common.ErrTooManyBudgets)
	}
	seen := make(map[uuid.UUID]bool, len(req.Budgets))
	for _, b := range req.Budgets {
		if seen[b.CategoryID] {
			return response.Error(c, h.logger, common.ErrDuplicateCategoryInRequest)
		}
		seen[b.CategoryID] = true
	}

	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	budgets, err := h.budgetService.BulkReplaceBudgets(c.Context(), userID, req.Budgets)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusCreated, "budgets created successfully", dto.NewBulkCreateBudgetsResponse(budgets))
}

// UploadIcon handles POST /budgets/icon (multipart, field "file") — mirrors
// CategoryHandler.UploadIcon/WalletHandler.UploadIcon exactly
// (specs/wallet-budget-icons/spec.md US-03), a standalone upload step so a
// client can pick a photo before the budget exists yet (the create form).
func (h *BudgetHandler) UploadIcon(c *fiber.Ctx) error {
	return uploadIcon(c, h.iconUploader, common.BudgetIconKeyPrefix, h.logger)
}

// budgetIDParam parses the :id path segment, returning 400 INVALID_INPUT
// (spec.md S-BUD-26) before any service/DB call for a malformed UUID.
func budgetIDParam(c *fiber.Ctx) (uuid.UUID, error) {
	return pathUUID(c, "id", "budget id")
}
