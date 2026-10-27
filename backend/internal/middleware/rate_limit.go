package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"net"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/response"
)

// limit describes one rate limit: at most max requests per window for each
// key (one user, one IP address, one account), after which the route answers
// 429 RATE_LIMITED until the window ends.
//
// Every exported *RateLimiter in this package is one limit. Each call builds
// its own counters, kept in this process's memory: they reset when the
// backend restarts, and two backend replicas would each count separately.
type limit struct {
	name   string // prefixes every key; names the limit when debugging
	max    int
	window time.Duration
	keyBy  func(c *fiber.Ctx) string // who is being counted
	counts countedRequests
}

// countedRequests is which requests use up a limit.
type countedRequests int

const (
	// countAll counts every request, whatever it was answered with.
	countAll countedRequests = iota
	// countFailuresOnly counts requests answered 4xx/5xx, so the real owner
	// getting it right never uses up the limit (failed logins, say).
	countFailuresOnly
	// countSuccessesOnly counts requests answered 2xx/3xx, so a rejected or
	// refused request never costs the caller anything.
	countSuccessesOnly
)

func newLimiter(l limit, logger *zap.Logger) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:                    l.max,
		Expiration:             l.window,
		SkipSuccessfulRequests: l.counts == countFailuresOnly,
		SkipFailedRequests:     l.counts == countSuccessesOnly,
		KeyGenerator: func(c *fiber.Ctx) string {
			return l.name + ":" + l.keyBy(c)
		},
		LimitReached: func(c *fiber.Ctx) error {
			return response.Error(c, logger, common.ErrRateLimited)
		},
	})
}

// byUser counts per signed-in user. The route must run JWTAuth first: that is
// what puts the caller's user id in Locals.
func byUser(c *fiber.Ctx) string {
	userID, _ := c.Locals(common.LocalsUserID).(string)
	return userID
}

// byIP counts per client address, for routes nobody is signed in to yet.
// See RateLimitIP.
func byIP(c *fiber.Ctx) string { return RateLimitIP(c) }

// InviteRateLimiter enforces spec.md S-USR-07 (20 invites/hour/admin).
func InviteRateLimiter(logger *zap.Logger) fiber.Handler {
	return newLimiter(limit{
		name: "invite", keyBy: byUser,
		max: common.InviteRateLimit, window: common.InviteRateLimitWindow,
	}, logger)
}

// AIChatRateLimiter enforces specs/ai-chat-assistant/spec.md S-AI-16
// (30 messages/hour/user — an explicit assumption, plan.md Open Task #29,
// not yet product-confirmed). Applies only to the routes that call the AI
// model (routes.go), never to the confirm step (POST /transactions).
func AIChatRateLimiter(logger *zap.Logger) fiber.Handler {
	return newLimiter(limit{
		name: "ai-chat", keyBy: byUser,
		max: common.AIChatRateLimit, window: common.AIChatRateLimitWindow,
	}, logger)
}

// AIConsultRateLimiter caps free-text analytics questions per user
// (specs/ai-chat-query-spending/spec.md US-05). It is attached to
// POST /analytics/consult only — never to the /ai group — so asking
// questions can never use up the transaction-recording budget of
// AIChatRateLimiter (S-AIQ-37), and chips/follow-ups (POST /analytics/query)
// are never counted (S-AIQ-35). Rejected messages (400) do not count
// (plan.md BR-19); a degraded reply is 200 and counts.
func AIConsultRateLimiter(logger *zap.Logger) fiber.Handler {
	return newLimiter(limit{
		name: "ai-consult", keyBy: byUser, counts: countSuccessesOnly,
		max: common.AIConsultRateLimit, window: common.AIConsultRateLimitWindow,
	}, logger)
}

// AIImageRateLimiter caps image readings per user (specs/ai-chat-image-capture
// spec BR-10). Attached to POST /transactions/image-proposals only — never to
// the /ai group — so it and AIChatRateLimiter never spend each other's budget
// (S-AIIMG-20, S-AIIMG-21). Busy, feature-off and rejected uploads never count
// (S-AIIMG-60).
func AIImageRateLimiter(logger *zap.Logger) fiber.Handler {
	return newLimiter(limit{
		name: "ai-image", keyBy: byUser, counts: countSuccessesOnly,
		max: common.AIImageRateLimit, window: common.AIImageRateLimitWindow,
	}, logger)
}

// LoginRateLimiter enforces spec.md S-SEC-07 (10 attempts/15min/IP).
//
// It counts every attempt from an IP, not only failed ones: strictly safer
// than spec.md's hedged "failed attempts only (assumption)". Failed-only
// counting per account is LoginAccountRateLimiter's job.
func LoginRateLimiter(logger *zap.Logger) fiber.Handler {
	return newLimiter(limit{
		name: "login", keyBy: byIP,
		max: common.LoginRateLimit, window: common.LoginRateLimitWindow,
	}, logger)
}

// SwitchRateLimiter caps POST /auth/switch per client IP
// (specs/mobile-account-switch S-ASW-20: 20 per 15 minutes). The route is
// unauthenticated, so there is no user id to count by.
func SwitchRateLimiter(logger *zap.Logger) fiber.Handler {
	return newLimiter(limit{
		name: "switch", keyBy: byIP,
		max: common.SwitchRateLimit, window: common.SwitchRateLimitWindow,
	}, logger)
}

// LoginAccountRateLimiter caps FAILED logins per account, across every IP:
// LoginRateLimiter alone lets an attacker with many addresses try a password
// list against one account at 10 tries per address. Only failed attempts
// count, so the account's owner signing in correctly is never what trips it.
//
// Trade-off, accepted: whoever knows an email can lock that account out of
// logging in for the window by failing on purpose. The window is short, the
// app is invite-only (emails are not public), and the alternative is letting
// a distributed guess run unchecked.
func LoginAccountRateLimiter(logger *zap.Logger) fiber.Handler {
	return newLimiter(limit{
		name: "login-account", keyBy: loginAccountKey, counts: countFailuresOnly,
		max: common.LoginAccountRateLimit, window: common.LoginAccountRateLimitWindow,
	}, logger)
}

// loginAccountKey is a hash of the normalised email or tên đăng nhập (the
// same field carries either; lowercasing normalises both), read with the
// same parser the login handler uses (c.BodyParser: JSON, form and multipart
// alike). A different parser here would let a form-encoded body slip past the
// account limit while the handler still accepted it. An account can be tried
// under both its email and its username, so its effective cap is twice the
// limit. Hashing keeps the key a fixed size however large the body is. A body
// that carries no email falls back to the client IP, so malformed requests
// cannot all share one key.
func loginAccountKey(c *fiber.Ctx) string {
	var req dto.LoginRequest
	if err := c.BodyParser(&req); err == nil && req.Email != "" {
		sum := sha256.Sum256([]byte(common.NormalizeEmail(req.Email)))
		return "account:" + hex.EncodeToString(sum[:16])
	}
	return "ip:" + RateLimitIP(c)
}

// UploadRateLimiter caps image uploads per user. Every upload is decoded and
// re-encoded on the server (imageupload.Process), which costs real CPU, so an
// authenticated client must not be able to loop it.
func UploadRateLimiter(logger *zap.Logger) fiber.Handler {
	return newLimiter(limit{
		name: "upload", keyBy: byUser,
		max: common.UploadRateLimit, window: common.UploadRateLimitWindow,
	}, logger)
}

// RateLimitIP is the key IP-based limiters use: ClientIP (the real client
// behind Cloudflare, not the tunnel container every request arrives from),
// with an IPv6 address reduced to its /64. A single household or VPS is
// handed a whole /64 (2^64 addresses), so keying on the full address would let
// one machine rotate through addresses and never meet the limit.
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
