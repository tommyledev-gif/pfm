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

// AccessRequestHandler is HTTP-only for access requests (mig 031): filing
// one from the login screen, approving one from the admin's email link or
// from the app, and rejecting one from the app.
//
// CSRF: the two public routes carry no ambient credential (the approval
// token is in the body, not a cookie), and the admin route is Bearer-JWT.
type AccessRequestHandler struct {
	service *service.AccessRequestService
	logger  *zap.Logger
}

func NewAccessRequestHandler(svc *service.AccessRequestService, logger *zap.Logger) *AccessRequestHandler {
	return &AccessRequestHandler{service: svc, logger: logger}
}

// RequestAccess handles POST /auth/access-requests — public, IP rate-limited.
// 202 whether or not the email already has an account (see
// AccessRequestService.RequestAccess for why the answer is the same).
func (h *AccessRequestHandler) RequestAccess(c *fiber.Ctx) error {
	var req dto.AccessRequestRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}

	if err := h.service.RequestAccess(c.Context(), req.Email, req.AdminEmail); err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusAccepted, "access request received", nil)
}

// ApproveByToken handles POST /auth/access-requests/approve — public; the
// one-time approval token from the admin's email is the credential.
func (h *AccessRequestHandler) ApproveByToken(c *fiber.Ctx) error {
	var req dto.ApproveAccessRequestRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}

	user, err := h.service.ApproveByToken(c.Context(), req.Token)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "access request approved", dto.ApproveAccessRequestResponse{Email: user.Email})
}

// Approve handles POST /admin/users/:id/approve (JWTAuth + RequireRole("admin")).
func (h *AccessRequestHandler) Approve(c *fiber.Ctx) error {
	userID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("id must be a valid UUID"))
	}

	user, err := h.service.Approve(c.Context(), userID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "access request approved", dto.NewUserResponse(user))
}

// Reject handles POST /admin/users/:id/reject (JWTAuth + RequireRole("admin")).
// No data in the 200: the request row is gone from every list afterwards.
func (h *AccessRequestHandler) Reject(c *fiber.Ctx) error {
	userID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("id must be a valid UUID"))
	}

	if err := h.service.Reject(c.Context(), userID); err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "access request rejected", nil)
}
