package handler

import (
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

// ProfileHandler serves the signed-in user's own profile under /users/me.
// HTTP only: the user id always comes from the verified token (callerUUID),
// never from the path or body, so there is no way to address another user.
//
// CSRF: not applicable — a Bearer-JWT API with no cookie session.
type ProfileHandler struct {
	profileService *service.ProfileService
	logger         *zap.Logger
}

func NewProfileHandler(profileService *service.ProfileService, logger *zap.Logger) *ProfileHandler {
	return &ProfileHandler{profileService: profileService, logger: logger}
}

// GetMe handles GET /users/me.
func (h *ProfileHandler) GetMe(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	user, err := h.profileService.Get(c.Context(), userID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "profile fetched successfully", dto.NewUserResponse(user))
}

// UpdateMe handles PATCH /users/me (display name only).
func (h *ProfileHandler) UpdateMe(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	var req dto.UpdateProfileRequest
	if err := dto.DecodeStrict(c.Body(), &req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body or unrecognized field"))
	}
	user, err := h.profileService.UpdateFullName(c.Context(), userID, req.FullName)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "profile updated successfully", dto.NewUserResponse(user))
}

// ClaimUsername handles PUT /users/me/username: an account with no tên đăng
// nhập (activated before mig 030) sets one, once.
func (h *ProfileHandler) ClaimUsername(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	var req dto.ClaimUsernameRequest
	if err := dto.DecodeStrict(c.Body(), &req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body or unrecognized field"))
	}
	user, err := h.profileService.ClaimUsername(c.Context(), userID, req.Username)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "username set successfully", dto.NewUserResponse(user))
}

// UploadAvatar handles POST /users/me/avatar (multipart, field "file").
func (h *ProfileHandler) UploadAvatar(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	img, err := readImageUpload(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	user, err := h.profileService.SetAvatar(c.Context(), userID, img)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "avatar updated successfully", dto.NewUserResponse(user))
}

// DeleteAvatar handles DELETE /users/me/avatar.
func (h *ProfileHandler) DeleteAvatar(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	user, err := h.profileService.RemoveAvatar(c.Context(), userID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "avatar removed successfully", dto.NewUserResponse(user))
}
