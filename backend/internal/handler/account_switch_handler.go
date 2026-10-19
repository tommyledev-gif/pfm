package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

// AccountSwitchHandler is HTTP-only for the account-switch endpoints
// (specs/mobile-account-switch US-01/02/04).
//
// CSRF: not applicable — Bearer-in-header / token-in-body API, no cookies
// and no server-side session (same posture as AuthHandler).
type AccountSwitchHandler struct {
	switchService *service.AccountSwitchService
	logger        *zap.Logger
}

func NewAccountSwitchHandler(switchService *service.AccountSwitchService, logger *zap.Logger) *AccountSwitchHandler {
	return &AccountSwitchHandler{switchService: switchService, logger: logger}
}

// IssueSwitchToken handles POST /auth/switch-token (behind JWTAuth).
func (h *AccountSwitchHandler) IssueSwitchToken(c *fiber.Ctx) error {
	callerID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	user, token, expiresAt, err := h.switchService.Issue(c.Context(), callerID, callerTokenIssuedAt(c))
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "switch token issued successfully", dto.SwitchTokenResponse{
		SwitchToken: token,
		ExpiresAt:   expiresAt,
		User:        dto.NewUserResponse(user),
	})
}

// Switch handles POST /auth/switch — unauthenticated (the switch token is
// the credential), behind SwitchRateLimiter only.
func (h *AccountSwitchHandler) Switch(c *fiber.Ctx) error {
	var req dto.SwitchRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}

	session, err := h.switchService.Switch(c.Context(), req.SwitchToken, requestDevice(c))
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "account switched successfully", newSwitchResponse(session))
}

// RevokeSwitchToken handles POST /auth/switch-token/revoke — unauthenticated
// and idempotent (logout / remove-from-device may run with no session).
func (h *AccountSwitchHandler) RevokeSwitchToken(c *fiber.Ctx) error {
	var req dto.RevokeSwitchTokenRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}

	if err := h.switchService.Revoke(c.Context(), req.SwitchToken); err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "switch token revoked successfully", nil)
}

// newSwitchResponse leaves switch_token and its expiry out when none was
// minted (the client sent a device id and keeps the session instead).
func newSwitchResponse(session *service.SwitchSession) dto.SwitchResponse {
	res := dto.SwitchResponse{
		AccessToken:  session.AccessToken,
		RefreshToken: session.RefreshToken,
		User:         dto.NewUserResponse(session.User),
	}
	if session.SwitchToken != "" {
		res.SwitchToken = session.SwitchToken
		expiresAt := session.SwitchTokenExpiresAt
		res.SwitchTokenExpiresAt = &expiresAt
	}
	return res
}

// callerTokenIssuedAt reads the access token's `iat` JWTAuth stored in
// locals; nil when absent (treated as "issued before" once a sign-out point
// exists — fail closed).
func callerTokenIssuedAt(c *fiber.Ctx) *jwt.NumericDate {
	issuedAt, _ := c.Locals(common.LocalsTokenIssuedAt).(*jwt.NumericDate)
	return issuedAt
}
