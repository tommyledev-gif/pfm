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

// NotificationHandler is HTTP-only for F-10 (Notification Handling): parse
// request, call service, map result to a response. No business logic lives
// here — dedup, title/body rendering, and the 403-vs-404 split are all in
// NotificationService. EvaluateBudgets (the background job) has no HTTP
// surface at all — it is invoked directly from cmd/server/main.go's ticker.
type NotificationHandler struct {
	notificationService *service.NotificationService
	logger              *zap.Logger
}

func NewNotificationHandler(notificationService *service.NotificationService, logger *zap.Logger) *NotificationHandler {
	return &NotificationHandler{notificationService: notificationService, logger: logger}
}

// ListNotifications handles GET /notifications (registered behind JWTAuth
// only — every active user sees only their own notifications, no role gate).
func (h *NotificationHandler) ListNotifications(c *fiber.Ctx) error {
	var q dto.ListNotificationsQuery
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

	limit := q.Limit
	if limit == 0 {
		limit = common.DefaultListLimit
	}

	notifications, nextCursor, total, err := h.notificationService.ListNotifications(c.Context(), userID, q.IsRead, q.Cursor, limit)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	items := make([]dto.NotificationResponse, 0, len(notifications))
	for _, n := range notifications {
		items = append(items, dto.NewNotificationResponse(n))
	}

	return response.Success(c, fiber.StatusOK, "notifications retrieved successfully", dto.ListNotificationsResponse{
		Data:       items,
		Pagination: dto.PaginationResponse{NextCursor: nextCursor, Total: total},
	})
}

// GetNotification handles GET /notifications/:id.
func (h *NotificationHandler) GetNotification(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	notificationID, err := notificationIDParam(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	notification, err := h.notificationService.GetNotification(c.Context(), userID, notificationID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "notification retrieved successfully", dto.NewNotificationResponse(notification))
}

// MarkNotificationRead handles POST /notifications/:id/read — a dedicated
// action endpoint, not a generic PATCH field, mirroring F-03's
// POST /wallets/:id/set-default (spec.md US-03, Open Questions #6).
func (h *NotificationHandler) MarkNotificationRead(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	notificationID, err := notificationIDParam(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	notification, err := h.notificationService.MarkRead(c.Context(), userID, notificationID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "notification marked as read", dto.NewNotificationResponse(notification))
}

// notificationIDParam parses the :id path segment, returning 400
// INVALID_INPUT before any service/DB call for a malformed UUID.
func notificationIDParam(c *fiber.Ctx) (uuid.UUID, error) {
	return pathUUID(c, "id", "notification id")
}
