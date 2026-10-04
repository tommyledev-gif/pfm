package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/response"
)

// InviteRateLimiter enforces spec.md S-USR-07 (20 invites/hour/admin). Must
// run after JWTAuth so common.LocalsUserID is already populated.
func InviteRateLimiter(logger *zap.Logger) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        common.InviteRateLimit,
		Expiration: common.InviteRateLimitWindow,
		KeyGenerator: func(c *fiber.Ctx) string {
			userID, _ := c.Locals(common.LocalsUserID).(string)
			return userID
		},
		LimitReached: func(c *fiber.Ctx) error {
			return response.Error(c, logger, common.ErrRateLimited)
		},
	})
}

// AIChatRateLimiter enforces specs/ai-chat-assistant/spec.md S-AI-16
// (30 messages/hour/user — an explicit assumption, plan.md Open Task #29,
// not yet product-confirmed). Keyed by the caller's user ID like
// InviteRateLimiter, not by IP — must run after JWTAuth so
// common.LocalsUserID is already populated. Applies only to POST /ai/chat,
// never to the confirm step (POST /transactions), which carries no
// additional limit beyond what it already has today.
func AIChatRateLimiter(logger *zap.Logger) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        common.AIChatRateLimit,
		Expiration: common.AIChatRateLimitWindow,
		KeyGenerator: func(c *fiber.Ctx) string {
			userID, _ := c.Locals(common.LocalsUserID).(string)
			return userID
		},
		LimitReached: func(c *fiber.Ctx) error {
			return response.Error(c, logger, common.ErrRateLimited)
		},
	})
}

// AIConsultRateLimiter caps free-text analytics questions per user
// (specs/ai-chat-query-spending/spec.md US-05). It is attached to
// POST /analytics/consult only — never to the /ai group — so asking
// questions can never use up the transaction-recording budget of
// AIChatRateLimiter (S-AIQ-37), and chips/follow-ups (POST /analytics/query)
// are never counted (S-AIQ-35). SkipFailedRequests keeps rejected messages
// (400) from counting (plan.md BR-19); a degraded reply is 200 and counts.
func AIConsultRateLimiter(logger *zap.Logger) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:                common.AIConsultRateLimit,
		Expiration:         common.AIConsultRateLimitWindow,
		SkipFailedRequests: true,
		KeyGenerator: func(c *fiber.Ctx) string {
			userID, _ := c.Locals(common.LocalsUserID).(string)
			return userID
		},
		LimitReached: func(c *fiber.Ctx) error {
			return response.Error(c, logger, common.ErrRateLimited)
		},
	})
}

// LoginRateLimiter enforces spec.md S-SEC-07 (10 attempts/15min/IP).
//
// Deliberate simplification: this counts every request to /auth/login from
// an IP within the window, not only failed ones. spec.md's own Edge Case
// text hedges this as "counts failed attempts only (assumption)" — true
// failed-only counting needs a custom post-response hook (increment after
// the handler determines the outcome), which Fiber's stock limiter doesn't
// do. Counting all attempts is strictly safer (a legitimate user retrying
// after a typo consumes the same budget as an attacker), just not literally
// what the hedge in spec.md guessed. Flagged here rather than silently
// assumed either way.
func LoginRateLimiter(logger *zap.Logger) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        common.LoginRateLimit,
		Expiration: common.LoginRateLimitWindow,
		// ClientIP, not c.IP(): behind Cloudflare Tunnel c.IP() is the
		// cloudflared container for every user, so all of them shared one
		// 10-attempt bucket and one attacker could lock everyone out.
		KeyGenerator: ClientIP,
		LimitReached: func(c *fiber.Ctx) error {
			return response.Error(c, logger, common.ErrRateLimited)
		},
	})
}

// SwitchRateLimiter caps POST /auth/switch per client IP
// (specs/mobile-account-switch S-ASW-20: 20 per 15 minutes). Keyed by
// ClientIP for the same Cloudflare-Tunnel reason as LoginRateLimiter — the
// route is unauthenticated, so there is no user id to key on.
func SwitchRateLimiter(logger *zap.Logger) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:          common.SwitchRateLimit,
		Expiration:   common.SwitchRateLimitWindow,
		KeyGenerator: ClientIP,
		LimitReached: func(c *fiber.Ctx) error {
			return response.Error(c, logger, common.ErrRateLimited)
		},
	})
}
