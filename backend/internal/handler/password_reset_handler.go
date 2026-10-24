package handler

import (
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

// PasswordResetHandler is HTTP-only for forgot password (specs/forgot-password).
//
// CSRF: both routes are public and carry no ambient credential (the code is in
// the body, no cookie), so there is nothing to forge.
type PasswordResetHandler struct {
	service *service.PasswordResetService
	logger  *zap.Logger
}

func NewPasswordResetHandler(svc *service.PasswordResetService, logger *zap.Logger) *PasswordResetHandler {
	return &PasswordResetHandler{service: svc, logger: logger}
}

// Request handles POST /auth/password-reset/request — public, IP rate-limited.
// The same 200 whether or not a code was sent (BR-02, BR-05).
func (h *PasswordResetHandler) Request(c *fiber.Ctx) error {
	var req dto.PasswordResetRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}

	if err := h.service.RequestReset(c.Context(), req.Identifier); err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "password reset requested", nil)
}

// Confirm handles POST /auth/password-reset/confirm — public, IP rate-limited.
// Same response as POST /auth/login: the calling phone is signed in.
func (h *PasswordResetHandler) Confirm(c *fiber.Ctx) error {
	var req dto.PasswordResetConfirmRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}

	user, accessToken, refreshToken, err := h.service.ConfirmReset(c.Context(), req.Identifier, req.Code, req.NewPassword, requestDevice(c))
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "password reset", dto.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		Email:        user.Email,
	})
}
