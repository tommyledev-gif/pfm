package middleware

import (
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
)

// AccessRequestRateLimiter caps POST /auth/access-requests per client IP.
// Unauthenticated, and every accepted request emails an admin, so without a
// cap the route is a free way to flood that inbox.
func AccessRequestRateLimiter(logger *zap.Logger) fiber.Handler {
	return newLimiter(limit{
		name: "access-request", keyBy: byIP,
		max: common.AccessRequestRateLimit, window: common.AccessRequestRateLimitWindow,
	}, logger)
}

// AccessStatusRateLimiter caps POST /auth/access-requests/status per client
// IP. Its answer is a yes/no that POST /auth/login already gives; the cap
// only keeps it from being a faster way to ask.
func AccessStatusRateLimiter(logger *zap.Logger) fiber.Handler {
	return newLimiter(limit{
		name: "access-status", keyBy: byIP,
		max: common.AccessStatusRateLimit, window: common.AccessStatusRateLimitWindow,
	}, logger)
}

// PublicTokenRateLimiter caps, per client IP, the unauthenticated routes whose
// credential is a token: /auth/refresh, /auth/logout, /auth/activate and
// /auth/switch-token/revoke. None of them can be brute-forced (the tokens are
// signed or 32 random bytes), but each costs a database round trip, so an
// unlimited loop was free load on Postgres. routes.go shares ONE instance
// across the four routes: one counter per client.
func PublicTokenRateLimiter(logger *zap.Logger) fiber.Handler {
	return newLimiter(limit{
		name: "public-token", keyBy: byIP,
		max: common.PublicTokenRateLimit, window: common.PublicTokenRateLimitWindow,
	}, logger)
}

// AILocalRateLimiter caps, per user, the /ai routes that never call the AI
// Service (chat thread cache, budget-wizard prefill and proposals): plain
// database work, so a looser cap than AIChatRateLimiter, which is kept for the
// model-backed routes. routes.go shares ONE instance across them.
func AILocalRateLimiter(logger *zap.Logger) fiber.Handler {
	return newLimiter(limit{
		name: "ai-local", keyBy: byUser,
		max: common.AILocalRateLimit, window: common.AILocalRateLimitWindow,
	}, logger)
}

// MemberLookupRateLimiter caps, per owner, the shared-wallet invite field's
// account lookup (GET /wallets/:id/members/lookup), which answers whether an
// email or tên đăng nhập belongs to an account.
func MemberLookupRateLimiter(logger *zap.Logger) fiber.Handler {
	return newLimiter(limit{
		name: "member-lookup", keyBy: byUser,
		max: common.MemberLookupRateLimit, window: common.MemberLookupRateLimitWindow,
	}, logger)
}

// AccessApproveRateLimiter caps the email-link approval per client IP. The
// token cannot be guessed (32 random bytes); this only bounds the noise.
func AccessApproveRateLimiter(logger *zap.Logger) fiber.Handler {
	return newLimiter(limit{
		name: "access-approve", keyBy: byIP,
		max: common.AccessApproveRateLimit, window: common.AccessApproveRateLimitWindow,
	}, logger)
}
