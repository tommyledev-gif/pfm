package handler

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

// AnalyticsHandler is HTTP-only for Feature-12 US-03 Query Spending via Chat
// (specs/ai-chat-query-spending/): parse, shape-validate, call the service.
// Ownership, period/currency resolution and every business rule live in
// AnalyticsService / ConsultService.
type AnalyticsHandler struct {
	analyticsService *service.AnalyticsService
	consultService   *service.ConsultService
	logger           *zap.Logger
}

func NewAnalyticsHandler(analyticsService *service.AnalyticsService, consultService *service.ConsultService, logger *zap.Logger) *AnalyticsHandler {
	return &AnalyticsHandler{analyticsService: analyticsService, consultService: consultService, logger: logger}
}

// Query handles POST /analytics/query — a complete, structured question from
// a chip or follow-up chip. JWTAuth only: never rate limited (spec.md
// S-AIQ-35).
func (h *AnalyticsHandler) Query(c *fiber.Ctx) error {
	var req dto.AnalyticsQueryRequest
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

	answer, err := h.analyticsService.Answer(c.Context(), userID, req)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "analytics answered successfully", answer)
}

// Consult handles POST /analytics/consult — one free-text question, behind
// JWTAuth + AIConsultRateLimiter.
func (h *AnalyticsHandler) Consult(c *fiber.Ctx) error {
	var req dto.ConsultRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body"))
	}
	// Whitespace-only is empty (spec.md S-AIQ-32), and is rejected before
	// it can reach the interpreter or count toward the limit.
	req.Message = strings.TrimSpace(req.Message)
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	reply, err := h.consultService.Consult(c.Context(), userID, req)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "consult processed successfully", reply)
}
