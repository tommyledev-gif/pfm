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

// UserHandler is HTTP-only: parse request, call service, map result to a
// response. No business logic lives here (spec.md's duplicate-email check,
// role gating, etc. are all in UserService/middleware).
//
// CSRF: not applicable to either route below — this is a Bearer-JWT API
// with no cookie/session auth, so there is no ambient credential a forged
// cross-site request could ride on.
type UserHandler struct {
	userService *service.UserService
	logger      *zap.Logger
}

func NewUserHandler(userService *service.UserService, logger *zap.Logger) *UserHandler {
	return &UserHandler{userService: userService, logger: logger}
}

// InviteUser handles POST /admin/users/invite (registered behind JWTAuth +
// RequireRole("admin") + InviteRateLimiter — see cmd/server routes).
func (h *UserHandler) InviteUser(c *fiber.Ctx) error {
	var req dto.InviteUserRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}

	adminID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	user, err := h.userService.InviteUser(c.Context(), adminID, req.Email, req.Role)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusCreated, "user invited successfully", dto.NewInviteUserResponse(user))
}

// ResendInvite handles POST /admin/users/:id/resend-invite (registered
// behind JWTAuth + RequireRole("admin")). The cooldown is a service rule.
func (h *UserHandler) ResendInvite(c *fiber.Ctx) error {
	userID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("id must be a valid UUID"))
	}

	user, err := h.userService.ResendInvite(c.Context(), userID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "invitation resent successfully", dto.NewUserResponse(user))
}

// ListUsers handles GET /admin/users (registered behind JWTAuth + RequireRole("admin")).
func (h *UserHandler) ListUsers(c *fiber.Ctx) error {
	var q dto.ListUsersQuery
	if err := c.QueryParser(&q); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed query parameters"))
	}
	if err := validate.Struct(q); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}

	limit := q.Limit
	if limit == 0 {
		limit = common.DefaultListLimit
	}

	users, nextCursor, total, err := h.userService.ListUsers(c.Context(), q.Status, q.Role, q.Cursor, limit)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	items := make([]dto.UserResponse, 0, len(users))
	for _, u := range users {
		items = append(items, dto.NewUserResponse(u))
	}

	return response.Success(c, fiber.StatusOK, "users retrieved successfully", dto.ListUsersResponse{
		Data:       items,
		Pagination: dto.PaginationResponse{NextCursor: nextCursor, Total: total},
	})
}

// callerUUID reads the user ID JWTAuth already resolved and stored in
// locals — never re-parses the token here.
func callerUUID(c *fiber.Ctx) (uuid.UUID, error) {
	idStr, _ := c.Locals(common.LocalsUserID).(string)
	return uuid.Parse(idStr)
}
