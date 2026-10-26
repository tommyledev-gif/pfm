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

// PublicTokenRateLimiter caps, per client IP, the unauthenticated routes whose
// credential is a token: /auth/refresh, /auth/logout, /auth/activate and
// /auth/switch-token/revoke. None of them can be brute-forced (the tokens are
// signed or 32 random bytes), but each costs a database round trip, so an
// unlimited loop was free load on Postgres. routes.go shares ONE instance
// across the four routes: one counter per client.
func PublicTokenRateLimiter(logger *zap.Logger) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        common.PublicTokenRateLimit,
		Expiration: common.PublicTokenRateLimitWindow,
		KeyGenerator: func(c *fiber.Ctx) string {
			return "public-token:" + RateLimitIP(c)
		},
		LimitReached: func(c *fiber.Ctx) error {
			return response.Error(c, logger, common.ErrRateLimited)
		},
	})
}

// AILocalRateLimiter caps, per user, the /ai routes that never call the AI
// Service (chat thread cache, budget-wizard prefill and proposals): plain
// database work, so a looser cap than AIChatRateLimiter, which is kept for the
// two model-backed routes. routes.go shares ONE instance across them. Must run
// after JWTAuth.
func AILocalRateLimiter(logger *zap.Logger) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        common.AILocalRateLimit,
		Expiration: common.AILocalRateLimitWindow,
		KeyGenerator: func(c *fiber.Ctx) string {
			userID, _ := c.Locals(common.LocalsUserID).(string)
			return "ai-local:" + userID
		},
		LimitReached: func(c *fiber.Ctx) error {
			return response.Error(c, logger, common.ErrRateLimited)
		},
	})
}

// MemberLookupRateLimiter caps, per owner, the shared-wallet invite field's
// account lookup (GET /wallets/:id/members/lookup), which answers whether an
// email or tên đăng nhập belongs to an account. Must run after JWTAuth.
func MemberLookupRateLimiter(logger *zap.Logger) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        common.MemberLookupRateLimit,
		Expiration: common.MemberLookupRateLimitWindow,
		KeyGenerator: func(c *fiber.Ctx) string {
			userID, _ := c.Locals(common.LocalsUserID).(string)
			return "member-lookup:" + userID
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
