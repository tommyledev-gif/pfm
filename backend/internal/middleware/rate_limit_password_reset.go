package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/response"
)

// PasswordResetRequestRateLimiter caps POST /auth/password-reset/request per
// client IP (specs/forgot-password BR-05). Each accepted request can email
// someone, so it is the tighter of the two. The per-account cooldown and
// hourly cap in PasswordResetService hold even across many IPs.
func PasswordResetRequestRateLimiter(logger *zap.Logger) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        common.PasswordResetRequestRateLimit,
		Expiration: common.PasswordResetRequestRateLimitWindow,
		KeyGenerator: func(c *fiber.Ctx) string {
			return "password-reset-request:" + RateLimitIP(c)
		},
		LimitReached: func(c *fiber.Ctx) error {
			return response.Error(c, logger, common.ErrRateLimited)
		},
	})
}

// PasswordResetConfirmRateLimiter caps POST /auth/password-reset/confirm per
// client IP. Guessing is already bounded per code (5 tries); this bounds one
// client spreading guesses over many accounts.
func PasswordResetConfirmRateLimiter(logger *zap.Logger) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        common.PasswordResetConfirmRateLimit,
		Expiration: common.PasswordResetConfirmRateLimitWindow,
		KeyGenerator: func(c *fiber.Ctx) string {
			return "password-reset-confirm:" + RateLimitIP(c)
		},
		LimitReached: func(c *fiber.Ctx) error {
			return response.Error(c, logger, common.ErrRateLimited)
		},
	})
}
