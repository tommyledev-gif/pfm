package middleware

import (
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
)

// PasswordResetRequestRateLimiter caps POST /auth/password-reset/request per
// client IP (specs/forgot-password BR-05). Each accepted request can email
// someone, so it is the tighter of the two. The per-account cooldown and
// hourly cap in PasswordResetService hold even across many IPs.
func PasswordResetRequestRateLimiter(logger *zap.Logger) fiber.Handler {
	return newLimiter(limit{
		name: "password-reset-request", keyBy: byIP,
		max: common.PasswordResetRequestRateLimit, window: common.PasswordResetRequestRateLimitWindow,
	}, logger)
}

// PasswordResetConfirmRateLimiter caps POST /auth/password-reset/confirm per
// client IP. Guessing is already bounded per code (5 tries); this bounds one
// client spreading guesses over many accounts.
func PasswordResetConfirmRateLimiter(logger *zap.Logger) fiber.Handler {
	return newLimiter(limit{
		name: "password-reset-confirm", keyBy: byIP,
		max: common.PasswordResetConfirmRateLimit, window: common.PasswordResetConfirmRateLimitWindow,
	}, logger)
}
