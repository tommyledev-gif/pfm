package handler

import (
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

// ReportHandler is HTTP-only for F-07 (Financial Reporting): parse request,
// call service, map result to a response. No business logic lives here —
// window default-resolution and Wallet/Category ownership checks are all in
// ReportService. One method covers spec.md US-01 through US-05 (Context
// decision #1 — one endpoint, query params vary by User Story).
type ReportHandler struct {
	reportService *service.ReportService
	logger        *zap.Logger
}

func NewReportHandler(reportService *service.ReportService, logger *zap.Logger) *ReportHandler {
	return &ReportHandler{reportService: reportService, logger: logger}
}

// GetSummary handles GET /reports/summary (registered behind JWTAuth only —
// every active user views only their own report, no role gate).
func (h *ReportHandler) GetSummary(c *fiber.Ctx) error {
	var q dto.ReportSummaryQuery
	if err := c.QueryParser(&q); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed query parameters"))
	}
	if err := validate.Struct(q); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}

	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	summary, err := h.reportService.GetSummary(c.Context(), userID, q)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "report summary retrieved successfully", summary)
}
