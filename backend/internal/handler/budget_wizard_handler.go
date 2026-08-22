package handler

import (
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

// BudgetWizardHandler is HTTP-only for F-13 AI Budget Setup Wizard's three
// wizard-adjacent endpoints (specs/ai-budget-wizard/plan.md Finding #3):
// Prefill, Proposals, SuggestCategoryName. The bulk-create write itself is
// registered on BudgetHandler instead (it's a Budget write, not a
// wizard-specific concern) — see budget_handler.go's BulkCreateBudgets.
type BudgetWizardHandler struct {
	budgetWizardService *service.BudgetWizardService
	logger              *zap.Logger
}

func NewBudgetWizardHandler(budgetWizardService *service.BudgetWizardService, logger *zap.Logger) *BudgetWizardHandler {
	return &BudgetWizardHandler{budgetWizardService: budgetWizardService, logger: logger}
}

// Prefill handles GET /ai/budget-wizard/prefill (registered behind JWTAuth +
// AIChatRateLimiter — same group as every other /ai/* endpoint, even though
// this one never actually calls the AI Service, for URL-namespace and
// rate-limit consistency, plan.md Finding #4).
func (h *BudgetWizardHandler) Prefill(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	resp, err := h.budgetWizardService.Prefill(c.Context(), userID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "budget wizard prefill retrieved successfully", resp)
}

// Proposals handles POST /ai/budget-proposals.
func (h *BudgetWizardHandler) Proposals(c *fiber.Ctx) error {
	var req dto.BudgetProposalsRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}

	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	resp, err := h.budgetWizardService.Proposals(c.Context(), userID, req)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "budget proposals computed successfully", resp)
}

// SuggestCategoryName handles POST /ai/suggest-category-name (US-03 Step 2B).
func (h *BudgetWizardHandler) SuggestCategoryName(c *fiber.Ctx) error {
	var req dto.SuggestCategoryNameRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}

	if _, err := callerUUID(c); err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	resp, err := h.budgetWizardService.SuggestCategoryName(c.Context(), req)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "category name suggested successfully", resp)
}
