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

// TransactionHandler is HTTP-only for F-06 (Transaction Management): parse
// request, call service, map result to a response. No business logic lives
// here — Wallet/Category ownership, type-match, and the atomic balance
// mutation are all in TransactionService.
type TransactionHandler struct {
	transactionService *service.TransactionService
	logger             *zap.Logger
}

func NewTransactionHandler(transactionService *service.TransactionService, logger *zap.Logger) *TransactionHandler {
	return &TransactionHandler{transactionService: transactionService, logger: logger}
}

// CreateTransaction handles POST /transactions (registered behind JWTAuth
// only — every active user manages only their own transactions, no role gate).
func (h *TransactionHandler) CreateTransaction(c *fiber.Ctx) error {
	var req dto.CreateTransactionRequest
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

	transaction, walletBalance, wasReplay, err := h.transactionService.CreateTransaction(c.Context(), userID, req)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	// wasReplay means req.IdempotencyKey matched an already-created
	// Transaction — 200, not 201, and nothing new was written
	// (specs/ai-chat-assistant/spec.md Resolved design decision #5, S-AI-13).
	status := fiber.StatusCreated
	message := "transaction created successfully"
	if wasReplay {
		status = fiber.StatusOK
		message = "transaction already created"
	}
	return response.Success(c, status, message, dto.NewTransactionResponseWithBalance(transaction, walletBalance))
}

// ListTransactions handles GET /transactions.
func (h *TransactionHandler) ListTransactions(c *fiber.Ctx) error {
	var q dto.ListTransactionsQuery
	if err := c.QueryParser(&q); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed query parameters"))
	}
	if err := validate.Struct(q); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}

	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	result, err := h.transactionService.ListTransactions(c.Context(), userID, q)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "transactions retrieved successfully",
		dto.NewListTransactionsResponse(result.Transactions, result.NextCursor, result.Total))
}

// GetTransaction handles GET /transactions/:id.
func (h *TransactionHandler) GetTransaction(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	transactionID, err := transactionIDParam(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	transaction, err := h.transactionService.GetTransaction(c.Context(), userID, transactionID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "transaction retrieved successfully", dto.NewTransactionResponse(transaction))
}

// UpdateTransaction handles PATCH /transactions/:id. Uses dto.DecodeStrict
// instead of c.BodyParser so an unrecognized field such as "type" is rejected
// with 400 rather than silently ignored (mirrors
// UpdateWalletRequest/UpdateBudgetRequest's precedent). "wallet_id" is
// accepted since 2026-10-13 (moving a Transaction to another Wallet).
func (h *TransactionHandler) UpdateTransaction(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	transactionID, err := transactionIDParam(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	var req dto.UpdateTransactionRequest
	if err := dto.DecodeStrict(c.Body(), &req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body or unrecognized field"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}

	transaction, walletBalance, err := h.transactionService.UpdateTransaction(c.Context(), userID, transactionID, req)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "transaction updated successfully", dto.NewTransactionResponseWithBalance(transaction, walletBalance))
}

// DeleteTransaction handles DELETE /transactions/:id. Response includes the
// Wallet's new (possibly negative) balance, per spec.md US-05 step 4.
func (h *TransactionHandler) DeleteTransaction(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	transactionID, err := transactionIDParam(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	wallet, err := h.transactionService.DeleteTransaction(c.Context(), userID, transactionID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "transaction deleted successfully", dto.NewWalletResponse(wallet))
}

// transactionIDParam parses the :id path segment, returning 400 INVALID_INPUT
// (spec.md S-TRX-34) before any service/DB call for a malformed UUID.
func transactionIDParam(c *fiber.Ctx) (uuid.UUID, error) {
	return pathUUID(c, "id", "transaction id")
}
