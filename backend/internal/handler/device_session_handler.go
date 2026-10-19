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

const auditActionSignOutDevice = "sessions.sign_out_device"

// DeviceSessionHandler is HTTP-only for the Security screen's "Thiết bị đang
// đăng nhập" (specs/mobile-account-switch US-10): the caller's live sessions,
// and signing one of them out. Both behind JWTAuth.
//
// CSRF: not applicable — Bearer-JWT API, no cookies.
type DeviceSessionHandler struct {
	sessions *service.SessionService
	logger   *zap.Logger
}

func NewDeviceSessionHandler(sessions *service.SessionService, logger *zap.Logger) *DeviceSessionHandler {
	return &DeviceSessionHandler{sessions: sessions, logger: logger}
}

// List handles GET /auth/sessions.
func (h *DeviceSessionHandler) List(c *fiber.Ctx) error {
	callerID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	currentID, err := callerSessionID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	items, err := h.sessions.ListDevices(c.Context(), callerID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "sessions listed", dto.NewDeviceSessionListResponse(items, currentID))
}

// SignOut handles DELETE /auth/sessions/:id.
func (h *DeviceSessionHandler) SignOut(c *fiber.Ctx) error {
	targetID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("id must be a valid UUID"))
	}
	callerID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	currentID, err := callerSessionID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	if err := h.sessions.SignOutDevice(c.Context(), callerID, currentID, targetID); err != nil {
		return response.Error(c, h.logger, err)
	}

	// Ids, role and ip only — never an email, a device name or a token.
	role, _ := c.Locals(common.LocalsRole).(string)
	h.logger.Info("audit",
		zap.Time("timestamp", time.Now().UTC()),
		zap.String("action", auditActionSignOutDevice),
		zap.String("result", auditResultSuccess),
		zap.String("actor_id", callerID.String()),
		zap.String("actor_role", role),
		zap.String("entity_id", targetID.String()),
		zap.String("ip", middleware.ClientIP(c)))
	return response.Success(c, fiber.StatusOK, "device signed out", nil)
}

// callerSessionID reads the session id JWTAuth stored in locals.
func callerSessionID(c *fiber.Ctx) (uuid.UUID, error) {
	id, _ := c.Locals(common.LocalsSessionID).(string)
	return uuid.Parse(id)
}
