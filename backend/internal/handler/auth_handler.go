package handler

import (
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

// AuthHandler is HTTP-only for Activate (F-01 US-02), Login, and Logout
// (F-02 US-04/US-05) — grouped together because all three issue or manage
// the shared JWT token pair (see plan.md Pre-flight Finding #3).
//
// CSRF: not applicable to any route below — Bearer-JWT API, no cookies or
// server-side sessions, so there is no ambient credential to forge against.
type AuthHandler struct {
	authService *service.AuthService
	logger      *zap.Logger
}

func NewAuthHandler(authService *service.AuthService, logger *zap.Logger) *AuthHandler {
	return &AuthHandler{authService: authService, logger: logger}
}

// Activate handles POST /auth/activate — unauthenticated (the invite token
// itself is the credential), never registered behind JWTAuth.
func (h *AuthHandler) Activate(c *fiber.Ctx) error {
	var req dto.ActivateRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}

	user, accessToken, refreshToken, err := h.authService.Activate(c.Context(), req.Token, req.FullName, req.Password, req.PasswordConfirm)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "account activated successfully", dto.ActivateResponse{
		User:         dto.NewUserResponse(user),
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	})
}

// Login handles POST /auth/login — public, registered behind LoginRateLimiter only.
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req dto.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}

	accessToken, refreshToken, err := h.authService.Login(c.Context(), req.Email, req.Password)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "login successful", dto.TokenPairResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	})
}

// Logout handles POST /auth/logout — deliberately NOT behind JWTAuth; it
// only needs the refresh token payload (plan.md Constitution Notes).
func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	var req dto.LogoutRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}

	if err := h.authService.Logout(c.Context(), req.RefreshToken); err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "logged out successfully", nil)
}
