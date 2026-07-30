// Package response is the single success-and-error-to-HTTP-response mapping
// layer used by every handler — no handler writes an ad-hoc
// c.Status(...).JSON(...) body of its own, success or error.
package response

import (
	"errors"
	"net/http"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
)

// Body is the single envelope every endpoint responds with, success or
// failure — a client can always check `success` first, then look at either
// `data` or `error_code`/`details`, never a bare unwrapped payload.
type Body struct {
	Success   bool        `json:"success"`
	Message   string      `json:"message"`
	Data      interface{} `json:"data,omitempty"`
	ErrorCode string      `json:"error_code,omitempty"`
	Details   interface{} `json:"details,omitempty"`
}

// Success writes a 2xx envelope. data may be nil (e.g. Logout has no payload).
func Success(c *fiber.Ctx, status int, message string, data interface{}) error {
	return c.Status(status).JSON(Body{
		Success: true,
		Message: message,
		Data:    data,
	})
}

// Error writes the correct status/envelope for a known *common.AppError, or
// a generic 500 for anything else — an unrecognized error's message is
// never forwarded to the client (it may contain internal details), only logged.
func Error(c *fiber.Ctx, logger *zap.Logger, err error) error {
	var appErr *common.AppError
	if errors.As(err, &appErr) {
		if appErr.Status == http.StatusUnauthorized || appErr.Status == http.StatusForbidden {
			logger.Warn("auth rejected",
				zap.Int("status", appErr.Status),
				zap.String("error_code", appErr.Code),
				zap.String("method", c.Method()),
				zap.String("path", c.Path()),
				zap.Any("user_id", c.Locals(common.LocalsUserID)),
			)
		}
		return c.Status(appErr.Status).JSON(Body{
			Success:   false,
			ErrorCode: appErr.Code,
			Message:   appErr.Message,
			Details:   appErr.Details,
		})
	}

	logger.Error("unhandled error", zap.Error(err), zap.String("path", c.Path()), zap.String("method", c.Method()))
	return c.Status(http.StatusInternalServerError).JSON(Body{
		Success:   false,
		ErrorCode: "INTERNAL_ERROR",
		Message:   "an unexpected error occurred",
	})
}
