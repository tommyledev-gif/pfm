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

// WalletHandler is HTTP-only for F-03 (Wallet Management): parse request,
// call service, map result to a response. No business logic lives here —
// default-forcing, the atomic default-swap, and ownership checks are all in
// WalletService.
//
// CSRF: not applicable — Bearer-JWT API, no cookie/session auth surface
// (same reasoning as UserHandler/AuthHandler).
type WalletHandler struct {
	walletService *service.WalletService
	logger        *zap.Logger
}

func NewWalletHandler(walletService *service.WalletService, logger *zap.Logger) *WalletHandler {
	return &WalletHandler{walletService: walletService, logger: logger}
}

// CreateWallet handles POST /wallets (registered behind JWTAuth only — every
// active user manages only their own wallets, no role gate).
func (h *WalletHandler) CreateWallet(c *fiber.Ctx) error {
	var req dto.CreateWalletRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}

	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	wallet, err := h.walletService.CreateWallet(c.Context(), userID, req)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusCreated, "wallet created successfully", dto.NewWalletResponse(wallet))
}

// ListWallets handles GET /wallets.
func (h *WalletHandler) ListWallets(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	wallets, err := h.walletService.ListWallets(c.Context(), userID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "wallets retrieved successfully", dto.NewListWalletsResponse(wallets))
}

// GetWallet handles GET /wallets/:id.
func (h *WalletHandler) GetWallet(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	walletID, err := walletIDParam(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	wallet, err := h.walletService.GetWallet(c.Context(), userID, walletID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "wallet retrieved successfully", dto.NewWalletResponse(wallet))
}

// UpdateWallet handles PATCH /wallets/:id. Uses dto.DecodeStrict instead of
// c.BodyParser so an unrecognized "balance" (or any other) field is
// rejected with 400 rather than silently ignored (plan.md Finding #4).
func (h *WalletHandler) UpdateWallet(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	walletID, err := walletIDParam(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	var req dto.UpdateWalletRequest
	if err := dto.DecodeStrict(c.Body(), &req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body or unrecognized field"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}

	wallet, err := h.walletService.UpdateWallet(c.Context(), userID, walletID, req)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "wallet updated successfully", dto.NewWalletResponse(wallet))
}

// SetDefaultWallet handles POST /wallets/:id/set-default — a dedicated
// action endpoint, not a generic PATCH field (spec.md Edge Case, US-05 #2).
func (h *WalletHandler) SetDefaultWallet(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	walletID, err := walletIDParam(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	wallet, err := h.walletService.SetDefaultWallet(c.Context(), userID, walletID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "default wallet updated successfully", dto.NewWalletResponse(wallet))
}

// walletIDParam parses the :id path segment, returning 400 INVALID_INPUT
// (spec.md S-WAL-18) before any service/DB call for a malformed UUID.
func walletIDParam(c *fiber.Ctx) (uuid.UUID, error) {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return uuid.UUID{}, common.NewInvalidInputError("wallet id must be a valid UUID")
	}
	return id, nil
}
