package handler

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/middleware"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

const auditActionDeleteUser = "users.delete"

// AccountDeletionHandler serves the account deletion tool on the mobile
// Security screen. Both routes sit in the /admin group; the service then
// lets through only common.AccountDeletionOperatorEmail.
type AccountDeletionHandler struct {
	service *service.AccountDeletionService
	logger  *zap.Logger
}

func NewAccountDeletionHandler(svc *service.AccountDeletionService, logger *zap.Logger) *AccountDeletionHandler {
	return &AccountDeletionHandler{service: svc, logger: logger}
}

// SearchUsers handles GET /admin/users/search?q=.
func (h *AccountDeletionHandler) SearchUsers(c *fiber.Ctx) error {
	callerID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	var q dto.SearchUsersQuery
	if err := c.QueryParser(&q); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed query parameters"))
	}
	if err := validate.Struct(q); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}

	users, err := h.service.SearchUsers(c.Context(), callerID, q.Q)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	items := make([]dto.UserResponse, 0, len(users))
	for _, u := range users {
		items = append(items, dto.NewUserResponse(u))
	}
	return response.Success(c, fiber.StatusOK, "users found", dto.SearchUsersResponse{Data: items})
}

// DeleteUser handles DELETE /admin/users/:id — a soft delete.
func (h *AccountDeletionHandler) DeleteUser(c *fiber.Ctx) error {
	targetID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("id must be a valid UUID"))
	}
	callerID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	if err := h.service.DeleteUser(c.Context(), callerID, targetID); err != nil {
		return response.Error(c, h.logger, err)
	}

	// Ids, role and ip only — never an email (same rule as auditRevokeAll).
	actorRole, _ := c.Locals(common.LocalsRole).(string)
	h.logger.Info("audit",
		zap.Time("timestamp", time.Now().UTC()),
		zap.String("action", auditActionDeleteUser),
		zap.String("result", auditResultSuccess),
		zap.String("actor_id", callerID.String()),
		zap.String("actor_role", actorRole),
		zap.String("entity_id", targetID.String()),
		zap.String("ip", middleware.ClientIP(c)))
	return response.Success(c, fiber.StatusOK, "user deleted", nil)
}
