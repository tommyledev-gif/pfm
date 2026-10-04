package handler

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/middleware"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

const (
	auditActionRevokeAllSessions = "sessions.revoke_all"
	auditResultSuccess           = "success"
)

// SessionRevocationHandler is HTTP-only for "sign out everywhere"
// (specs/mobile-account-switch US-08 self, US-09 admin).
//
// CSRF: not applicable — Bearer-JWT API, no cookies or server session.
type SessionRevocationHandler struct {
	revocationService *service.SessionRevocationService
	logger            *zap.Logger
}

func NewSessionRevocationHandler(revocationService *service.SessionRevocationService, logger *zap.Logger) *SessionRevocationHandler {
	return &SessionRevocationHandler{revocationService: revocationService, logger: logger}
}

// RevokeAllSelf handles POST /auth/sessions/revoke-all (behind JWTAuth).
// The requesting device gets a fresh pair + switch token (BR-12).
func (h *SessionRevocationHandler) RevokeAllSelf(c *fiber.Ctx) error {
	callerID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	session, err := h.revocationService.RevokeAllForSelf(c.Context(), callerID, callerTokenIssuedAt(c))
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	h.auditRevokeAll(c, callerID, callerID)
	return response.Success(c, fiber.StatusOK, "signed out on every other device", newSwitchResponse(session))
}

// RevokeAllForUser handles POST /admin/users/:id/sessions/revoke-all
// (behind JWTAuth + RequireRole("admin") via the /admin group).
func (h *SessionRevocationHandler) RevokeAllForUser(c *fiber.Ctx) error {
	targetID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("id must be a valid UUID"))
	}
	adminID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	if err := h.revocationService.RevokeAllForUser(c.Context(), adminID, targetID); err != nil {
		return response.Error(c, h.logger, err)
	}

	h.auditRevokeAll(c, adminID, targetID)
	return response.Success(c, fiber.StatusOK, "user signed out on every device", nil)
}

// auditRevokeAll writes the one audit line per successful sign-out
// everywhere: ids, role and ip only — never an email or a token (BR-10).
func (h *SessionRevocationHandler) auditRevokeAll(c *fiber.Ctx, actorID, targetID uuid.UUID) {
	actorRole, _ := c.Locals(common.LocalsRole).(string)
	h.logger.Info("audit",
		zap.Time("timestamp", time.Now().UTC()),
		zap.String("action", auditActionRevokeAllSessions),
		zap.String("result", auditResultSuccess),
		zap.String("actor_id", actorID.String()),
		zap.String("actor_role", actorRole),
		zap.String("entity_id", targetID.String()),
		zap.String("ip", middleware.ClientIP(c)))
}
