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

// PasskeyHandler serves passkeys (WebAuthn, mig 032). HTTP only: shape
// validation here, every WebAuthn check in service.PasskeyService.
//
// Registering and managing passkeys needs a session (the caller is always
// the token's user). Signing in does not: the passkey assertion is the
// credential, and those routes sit behind the login rate limiter.
type PasskeyHandler struct {
	passkeys *service.PasskeyService
	logger   *zap.Logger
}

func NewPasskeyHandler(passkeys *service.PasskeyService, logger *zap.Logger) *PasskeyHandler {
	return &PasskeyHandler{passkeys: passkeys, logger: logger}
}

// BeginRegistration handles POST /users/me/passkeys/register/begin.
func (h *PasskeyHandler) BeginRegistration(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	challengeID, options, err := h.passkeys.BeginRegistration(c.Context(), userID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "passkey registration started", dto.PasskeyOptionsResponse{ChallengeID: challengeID, Options: options})
}

// FinishRegistration handles POST /users/me/passkeys/register/finish.
func (h *PasskeyHandler) FinishRegistration(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	req, challengeID, err := parsePasskeyFinish(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	passkey, err := h.passkeys.FinishRegistration(c.Context(), userID, challengeID, req.Credential, req.Name)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusCreated, "passkey registered", dto.NewPasskeyResponse(passkey))
}

// List handles GET /users/me/passkeys.
func (h *PasskeyHandler) List(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	passkeys, err := h.passkeys.List(c.Context(), userID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "passkeys fetched", dto.NewPasskeyListResponse(passkeys))
}

// Delete handles DELETE /users/me/passkeys/:id.
func (h *PasskeyHandler) Delete(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	passkeyID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, h.logger, common.ErrPasskeyNotFound)
	}
	if err := h.passkeys.Delete(c.Context(), userID, passkeyID); err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "passkey deleted", nil)
}

// BeginLogin handles POST /auth/passkeys/login/begin.
func (h *PasskeyHandler) BeginLogin(c *fiber.Ctx) error {
	var req dto.PasskeyBeginLoginRequest
	// An empty body is a discoverable sign-in.
	if len(c.Body()) > 0 {
		if err := dto.DecodeStrict(c.Body(), &req); err != nil {
			return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body or unrecognized field"))
		}
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}
	var userID *uuid.UUID
	if req.UserID != "" {
		id := uuid.MustParse(req.UserID) // validated above
		userID = &id
	}
	challengeID, options, err := h.passkeys.BeginLogin(c.Context(), userID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "passkey sign-in started", dto.PasskeyOptionsResponse{ChallengeID: challengeID, Options: options})
}

// FinishLogin handles POST /auth/passkeys/login/finish. Same response as
// POST /auth/login, so the app treats both sign-ins alike.
func (h *PasskeyHandler) FinishLogin(c *fiber.Ctx) error {
	req, challengeID, err := parsePasskeyFinish(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	user, accessToken, refreshToken, err := h.passkeys.FinishLogin(c.Context(), challengeID, req.Credential)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "login successful", dto.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		Email:        user.Email,
	})
}

func parsePasskeyFinish(c *fiber.Ctx) (dto.PasskeyFinishRequest, uuid.UUID, error) {
	var req dto.PasskeyFinishRequest
	if err := dto.DecodeStrict(c.Body(), &req); err != nil {
		return req, uuid.Nil, common.NewInvalidInputError("malformed request body or unrecognized field")
	}
	if err := validate.Struct(req); err != nil {
		return req, uuid.Nil, newValidationError(err)
	}
	return req, uuid.MustParse(req.ChallengeID), nil
}
