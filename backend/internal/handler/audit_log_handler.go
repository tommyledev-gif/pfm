package handler

import (
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

// AuditLogHandler is HTTP-only for the Transaction Audit Log's read side
// (specs/transaction-audit-log/spec.md US-02) — parse, call service, map to a
// response. The feature's write side has no handler at all: it is a side
// effect inside TransactionService's existing Create/Update/Delete flows.
type AuditLogHandler struct {
	auditLogService *service.AuditLogService
	logger          *zap.Logger
}

func NewAuditLogHandler(auditLogService *service.AuditLogService, logger *zap.Logger) *AuditLogHandler {
	return &AuditLogHandler{auditLogService: auditLogService, logger: logger}
}

// ListAuditLogs handles GET /transactions/audit-logs (registered behind
// JWTAuth only — every active user sees only their own history, no role
// gate). ⚠️ Route registration order matters: this literal path must be
// registered before the existing GET /transactions/:id, or Fiber matches
// :id="audit-logs" first (plan.md Finding #8).
func (h *AuditLogHandler) ListAuditLogs(c *fiber.Ctx) error {
	var q dto.ListAuditLogsQuery
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

	limit := q.Limit
	if limit == 0 {
		limit = common.DefaultListLimit
	}

	logs, nextCursor, total, err := h.auditLogService.ListAuditLogs(c.Context(), userID, q.TransactionID, q.Cursor, limit)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	items := make([]dto.AuditLogResponse, 0, len(logs))
	for _, log := range logs {
		items = append(items, dto.NewAuditLogResponse(log))
	}

	return response.Success(c, fiber.StatusOK, "audit logs retrieved successfully", dto.ListAuditLogsResponse{
		Data:       items,
		Pagination: dto.PaginationResponse{NextCursor: nextCursor, Total: total},
	})
}
