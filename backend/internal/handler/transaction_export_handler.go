package handler

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

// TransactionExportHandler is HTTP-only for GET /transactions/export
// (specs/transaction-export-import/spec.md US-01).
//
// The one endpoint in this codebase that does NOT return the standard
// response.Success envelope: its body is the .xlsx binary itself. Errors
// still go through response.Error, so a failure is the same JSON shape every
// other endpoint produces.
type TransactionExportHandler struct {
	exportService *service.TransactionExportService
	logger        *zap.Logger
}

func NewTransactionExportHandler(exportService *service.TransactionExportService, logger *zap.Logger) *TransactionExportHandler {
	return &TransactionExportHandler{exportService: exportService, logger: logger}
}

// ExportTransactions handles GET /transactions/export.
func (h *TransactionExportHandler) ExportTransactions(c *fiber.Ctx) error {
	var q dto.ExportTransactionsQuery
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

	workbook, filename, err := h.exportService.BuildExportWorkbook(c.Context(), userID, q)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	c.Set(fiber.HeaderContentType, common.TransactionExportContentType)
	c.Set(fiber.HeaderContentDisposition, fmt.Sprintf("attachment; filename=%q", filename))
	return c.Status(fiber.StatusOK).Send(workbook)
}
