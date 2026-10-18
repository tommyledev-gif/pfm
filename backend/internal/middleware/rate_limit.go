package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"net"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
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

// AIImageRateLimiter caps image readings per user (specs/ai-chat-image-capture
// spec BR-10, plan AIIMG-T18). Attached to POST /transactions/image-proposals
// only — never to the /ai group — so it and AIChatRateLimiter never spend
// each other's budget (S-AIIMG-20, S-AIIMG-21). SkipFailedRequests: busy,
// feature-off and rejected uploads never count (S-AIIMG-60).
func AIImageRateLimiter(logger *zap.Logger) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:                common.AIImageRateLimit,
		Expiration:         common.AIImageRateLimitWindow,
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
		KeyGenerator: RateLimitIP,
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
		KeyGenerator: RateLimitIP,
		LimitReached: func(c *fiber.Ctx) error {
			return response.Error(c, logger, common.ErrRateLimited)
		},
	})
}

// LoginAccountRateLimiter caps FAILED logins per account, across every IP:
// LoginRateLimiter alone lets an attacker with many addresses try a password
// list against one account at 10 tries per address. Only failed attempts
// count (a 4xx/5xx response), so the account's owner signing in correctly is
// never what trips it.
//
// Trade-off, accepted: whoever knows an email can lock that account out of
// logging in for the window by failing on purpose. The window is short, the
// app is invite-only (emails are not public), and the alternative is letting
// a distributed guess run unchecked.
//
// The key is a hash of the normalised email or tên đăng nhập (the same field
// carries either; lowercasing normalises both), read with the same parser
// the login handler uses (c.BodyParser: JSON, form and multipart alike). A
// different parser here would let a form-encoded body slip past the account
// limit while the handler still accepted it. An account can be tried under
// both its email and its username, so its effective cap is twice the limit. Hashing keeps the key a fixed
// size however large the body is. A body that carries no email falls back to
// the client IP so malformed requests cannot all share one key.
func LoginAccountRateLimiter(logger *zap.Logger) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:                    common.LoginAccountRateLimit,
		Expiration:             common.LoginAccountRateLimitWindow,
		SkipSuccessfulRequests: true,
		KeyGenerator: func(c *fiber.Ctx) string {
			var req dto.LoginRequest
			if err := c.BodyParser(&req); err == nil && req.Email != "" {
				sum := sha256.Sum256([]byte(common.NormalizeEmail(req.Email)))
				return "login-account:" + hex.EncodeToString(sum[:16])
			}
			return "login-account-ip:" + RateLimitIP(c)
		},
		LimitReached: func(c *fiber.Ctx) error {
			return response.Error(c, logger, common.ErrRateLimited)
		},
	})
}

// UploadRateLimiter caps image uploads per user. Every upload is decoded and
// re-encoded on the server (imageupload.Process), which costs real CPU, so an
// authenticated client must not be able to loop it. Must run after JWTAuth so
// common.LocalsUserID is already populated.
func UploadRateLimiter(logger *zap.Logger) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        common.UploadRateLimit,
		Expiration: common.UploadRateLimitWindow,
		KeyGenerator: func(c *fiber.Ctx) string {
			userID, _ := c.Locals(common.LocalsUserID).(string)
			return "upload:" + userID
		},
		LimitReached: func(c *fiber.Ctx) error {
			return response.Error(c, logger, common.ErrRateLimited)
		},
	})
}

// RateLimitIP is the key IP-based limiters use: an IPv4 address as is, an IPv6
// address reduced to its /64. A single household or VPS is handed a whole /64
// (2^64 addresses), so keying on the full address would let one machine
// rotate through addresses and never meet the limit.
func RateLimitIP(c *fiber.Ctx) string {
	return rateLimitKeyFor(ClientIP(c))
}

func rateLimitKeyFor(raw string) string {
	ip := net.ParseIP(raw)
	if ip == nil || ip.To4() != nil {
		return raw
	}
	return ip.Mask(net.CIDRMask(64, 128)).String() + "/64"
}
