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
	logger        *zap.Logger
}

func NewBudgetHandler(budgetService *service.BudgetService, logger *zap.Logger) *BudgetHandler {
	return &BudgetHandler{budgetService: budgetService, logger: logger}
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

// budgetIDParam parses the :id path segment, returning 400 INVALID_INPUT
// (spec.md S-BUD-26) before any service/DB call for a malformed UUID.
func budgetIDParam(c *fiber.Ctx) (uuid.UUID, error) {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return uuid.UUID{}, common.NewInvalidInputError("budget id must be a valid UUID")
	}
	return id, nil
}
