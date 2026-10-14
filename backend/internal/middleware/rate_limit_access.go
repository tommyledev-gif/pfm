package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/response"
)

// AccessRequestRateLimiter caps POST /auth/access-requests per client IP.
// Unauthenticated, and every accepted request emails an admin, so without a
// cap the route is a free way to flood that inbox. Keyed by ClientIP for the
// same Cloudflare-Tunnel reason as LoginRateLimiter.
func AccessRequestRateLimiter(logger *zap.Logger) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        common.AccessRequestRateLimit,
		Expiration: common.AccessRequestRateLimitWindow,
		KeyGenerator: func(c *fiber.Ctx) string {
			return "access-request:" + RateLimitIP(c)
		},
		LimitReached: func(c *fiber.Ctx) error {
			return response.Error(c, logger, common.ErrRateLimited)
		},
	})
}

// AccessStatusRateLimiter caps POST /auth/access-requests/status per client
// IP. Its answer is a yes/no that POST /auth/login already gives; the cap
// only keeps it from being a faster way to ask.
func AccessStatusRateLimiter(logger *zap.Logger) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        common.AccessStatusRateLimit,
		Expiration: common.AccessStatusRateLimitWindow,
		KeyGenerator: func(c *fiber.Ctx) string {
			return "access-status:" + RateLimitIP(c)
		},
		LimitReached: func(c *fiber.Ctx) error {
			return response.Error(c, logger, common.ErrRateLimited)
		},
	})
}

// AccessApproveRateLimiter caps the email-link approval per client IP. The
// token cannot be guessed (32 random bytes); this only bounds the noise.
func AccessApproveRateLimiter(logger *zap.Logger) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        common.AccessApproveRateLimit,
		Expiration: common.AccessApproveRateLimitWindow,
		KeyGenerator: func(c *fiber.Ctx) string {
			return "access-approve:" + RateLimitIP(c)
		},
		LimitReached: func(c *fiber.Ctx) error {
			return response.Error(c, logger, common.ErrRateLimited)
		},
	})
}
