package handler

import (
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

// SpendingIntentionHandler is HTTP-only for Feature-12 US-06 (spending
// intentions, specs/ai-chat-spending-intentions): parse, shape-validate, call
// the service. Ownership, the Category, the month window, the cap and every
// figure are SpendingIntentionService's.
type SpendingIntentionHandler struct {
	intentions *service.SpendingIntentionService
	logger     *zap.Logger
}

func NewSpendingIntentionHandler(intentions *service.SpendingIntentionService, logger *zap.Logger) *SpendingIntentionHandler {
	return &SpendingIntentionHandler{intentions: intentions, logger: logger}
}

// List handles GET /spending-intentions.
func (h *SpendingIntentionHandler) List(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	list, err := h.intentions.List(c.Context(), userID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "spending intentions retrieved successfully", list)
}

// Create handles POST /spending-intentions: 201 for a new intention, 200 when
// the card's key was already kept (the same body, so a retry is safe).
func (h *SpendingIntentionHandler) Create(c *fiber.Ctx) error {
	var req dto.CreateSpendingIntentionRequest
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
	kept, created, err := h.intentions.Create(c.Context(), userID, req)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	status := fiber.StatusOK
	if created {
		status = fiber.StatusCreated
	}
	return response.Success(c, status, "spending intention kept successfully", kept)
}

// Update handles PUT /spending-intentions/:id — the whole editable set.
func (h *SpendingIntentionHandler) Update(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	id, err := pathUUID(c, "id", "spending intention id")
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	var req dto.SpendingIntentionRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}
	updated, err := h.intentions.Update(c.Context(), userID, id, req)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "spending intention updated successfully", updated)
}

// Delete handles DELETE /spending-intentions/:id.
func (h *SpendingIntentionHandler) Delete(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	id, err := pathUUID(c, "id", "spending intention id")
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	if err := h.intentions.Delete(c.Context(), userID, id); err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "spending intention deleted successfully", nil)
}
