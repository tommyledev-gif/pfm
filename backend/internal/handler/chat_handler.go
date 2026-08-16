package handler

import (
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

// ChatHandler is HTTP-only for Feature-12 US-01 (AI Chat — Create Transaction
// via Chat): parse request, call service, map result to a response. No
// business logic lives here — context loading, the AI Service call,
// ownership re-validation, and the confidence gate are all in ChatService.
type ChatHandler struct {
	chatService *service.ChatService
	logger      *zap.Logger
}

func NewChatHandler(chatService *service.ChatService, logger *zap.Logger) *ChatHandler {
	return &ChatHandler{chatService: chatService, logger: logger}
}

// Chat handles POST /ai/chat (registered behind JWTAuth + AIChatRateLimiter —
// every active user manages only their own chat, no role gate).
func (h *ChatHandler) Chat(c *fiber.Ctx) error {
	var req dto.ChatRequest
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

	resp, err := h.chatService.Chat(c.Context(), userID, req)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "chat processed successfully", resp)
}
