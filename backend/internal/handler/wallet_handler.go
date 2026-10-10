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
	iconUploader  service.IconUploader
	logger        *zap.Logger
}

func NewWalletHandler(walletService *service.WalletService, iconUploader service.IconUploader, logger *zap.Logger) *WalletHandler {
	return &WalletHandler{walletService: walletService, iconUploader: iconUploader, logger: logger}
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

// UploadIcon handles POST /wallets/icon (multipart, field "file") — mirrors
// CategoryHandler.UploadIcon exactly (specs/wallet-budget-icons/spec.md
// US-01), a standalone upload step so a client can pick a photo before the
// wallet exists yet (the create form).
func (h *WalletHandler) UploadIcon(c *fiber.Ctx) error {
	if _, err := callerUUID(c); err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	img, err := readImageUpload(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	iconURL, err := h.iconUploader.UploadIcon(c.Context(), common.WalletIconKeyPrefix, img.ContentType, img.Data)
	if err != nil {
		h.logger.Error("icon upload failed", zap.Error(err))
		if _, unconfigured := h.iconUploader.(service.UnconfiguredIconUploader); unconfigured {
			return response.Error(c, h.logger, common.ErrIconUploadUnavailable)
		}
		return response.Error(c, h.logger, common.ErrIconUploadFailed)
	}

	return response.Success(c, fiber.StatusOK, "icon uploaded successfully", fiber.Map{"icon_url": iconURL})
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
