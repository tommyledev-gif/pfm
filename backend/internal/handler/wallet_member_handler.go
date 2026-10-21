package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

// WalletMemberHandler is HTTP-only for shared wallets (specs/shared-wallets):
// parse, call WalletMemberService, respond. Who may do what is decided there.
type WalletMemberHandler struct {
	service *service.WalletMemberService
	logger  *zap.Logger
}

func NewWalletMemberHandler(svc *service.WalletMemberService, logger *zap.Logger) *WalletMemberHandler {
	return &WalletMemberHandler{service: svc, logger: logger}
}

// ListMembers handles GET /wallets/:id/members.
func (h *WalletMemberHandler) ListMembers(c *fiber.Ctx) error {
	userID, walletID, err := callerAndWallet(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	members, err := h.service.ListMembers(c.Context(), userID, walletID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	items := make([]dto.WalletMemberResponse, 0, len(members.Members)+1)
	items = append(items, dto.NewWalletOwnerResponse(members.OwnerID, members.OwnerName, members.OwnerUsername))
	for _, m := range members.Members {
		items = append(items, dto.NewWalletMemberResponse(m))
	}
	return response.Success(c, fiber.StatusOK, "wallet members retrieved", dto.ListWalletMembersResponse{Data: items})
}

// Invite handles POST /wallets/:id/members.
func (h *WalletMemberHandler) Invite(c *fiber.Ctx) error {
	var req dto.InviteWalletMemberRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}
	userID, walletID, err := callerAndWallet(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	member, err := h.service.Invite(c.Context(), userID, walletID, req.Identifier, model.WalletMemberRole(req.Role))
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusCreated, "wallet member invited", dto.NewWalletMemberResponse(member))
}

// UpdateRole handles PATCH /wallets/:id/members/:user_id.
func (h *WalletMemberHandler) UpdateRole(c *fiber.Ctx) error {
	var req dto.UpdateWalletMemberRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}
	userID, walletID, err := callerAndWallet(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	memberID, err := memberIDParam(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	member, err := h.service.ChangeRole(c.Context(), userID, walletID, memberID, model.WalletMemberRole(req.Role))
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "wallet member updated", dto.NewWalletMemberResponse(member))
}

// Remove handles DELETE /wallets/:id/members/:user_id — remove, cancel an
// invitation, or leave (user_id = the caller).
func (h *WalletMemberHandler) Remove(c *fiber.Ctx) error {
	userID, walletID, err := callerAndWallet(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	memberID, err := memberIDParam(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	if err := h.service.RemoveMember(c.Context(), userID, walletID, memberID); err != nil {
		return response.Error(c, h.logger, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ListInvitations handles GET /wallets/invitations.
func (h *WalletMemberHandler) ListInvitations(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	invitations, err := h.service.ListInvitations(c.Context(), userID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "wallet invitations retrieved", dto.NewListWalletInvitationsResponse(invitations))
}

// AcceptInvitation handles POST /wallets/:id/invitation/accept.
func (h *WalletMemberHandler) AcceptInvitation(c *fiber.Ctx) error {
	userID, walletID, err := callerAndWallet(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	member, err := h.service.AcceptInvitation(c.Context(), userID, walletID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "wallet invitation accepted", dto.NewWalletMemberResponse(member))
}

// DeclineInvitation handles POST /wallets/:id/invitation/decline.
func (h *WalletMemberHandler) DeclineInvitation(c *fiber.Ctx) error {
	userID, walletID, err := callerAndWallet(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	if err := h.service.DeclineInvitation(c.Context(), userID, walletID); err != nil {
		return response.Error(c, h.logger, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func callerAndWallet(c *fiber.Ctx) (uuid.UUID, uuid.UUID, error) {
	userID, err := callerUUID(c)
	if err != nil {
		return uuid.UUID{}, uuid.UUID{}, common.ErrUnauthenticated
	}
	walletID, err := walletIDParam(c)
	if err != nil {
		return uuid.UUID{}, uuid.UUID{}, err
	}
	return userID, walletID, nil
}

func memberIDParam(c *fiber.Ctx) (uuid.UUID, error) {
	id, err := uuid.Parse(c.Params("user_id"))
	if err != nil {
		return uuid.UUID{}, common.NewInvalidInputError("user id must be a valid UUID")
	}
	return id, nil
}
