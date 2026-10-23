package common

import "time"

// HTTP edge hardening (specs/security-hardening-2026-10): request tracing,
// security response headers, the public token-route limit and the
// backend-to-AI-Service credential.

// Request tracing (middleware.RequestLogger, US-06). The id travels in
// fiber.HeaderXRequestID both ways.
const (
	// LocalsRequestID / LocalsClientIP are set by RequestLogger, the outermost
	// middleware, so every later log line (response.Error, Recover) can carry
	// them without importing the middleware package.
	LocalsRequestID = "requestID"
	LocalsClientIP  = "clientIP"
)

// Security response headers (middleware.SecurityHeaders, US-05). Every value
// is for a JSON API plus two small self-contained HTML pages.
const (
	// HeaderCrossOriginOpenerPolicy has no fiber.Header* constant.
	HeaderCrossOriginOpenerPolicy = "Cross-Origin-Opener-Policy"

	ContentTypeOptionsValue = "nosniff"
	FrameOptionsValue       = "DENY"
	ReferrerPolicyValue     = "no-referrer"
	CrossOriginOpenerValue  = "same-origin"
	// HSTSValue: browsers ignore the header on plain-HTTP responses (RFC 6797
	// §8.1), so local development is unaffected. No includeSubDomains: other
	// subdomains of the zone are not this service's to pin.
	HSTSValue              = "max-age=31536000"
	PermissionsPolicyValue = "camera=(), microphone=(), geolocation=(), payment=()"
	// HTMLPageCacheControl keeps the token-bearing pages (/activate,
	// /approve-access) out of every cache.
	HTMLPageCacheControl = "no-store"
)

// PublicTokenRateLimit / Window cap, per client IP, the unauthenticated routes
// that take a token instead of a password: /auth/refresh, /auth/logout,
// /auth/activate and /auth/switch-token/revoke (one shared counter, US-04).
// About four times the busiest real pattern: each account saved on a phone
// refreshes once per 15-minute access token.
const (
	PublicTokenRateLimit       = 60
	PublicTokenRateLimitWindow = time.Minute
)

// AILocalRateLimit / Window cap, per user, the /ai routes that never call the
// AI Service (thread GET/sync, budget-wizard prefill/proposals). A sync
// follows every chat message and edit, so this sits far above
// AIChatRateLimit, which only the model-backed routes spend (F-17).
const (
	AILocalRateLimit       = 600
	AILocalRateLimitWindow = time.Hour
)

// Backend -> AI Service (US-07).
const (
	// HeaderInternalToken carries AI_SERVICE_TOKEN on every call to the AI
	// Service, which refuses requests without it once the token is set there.
	HeaderInternalToken = "X-Internal-Token"
	// AIServiceResponseMaxBytes caps how much of an AI Service response body is
	// read. The largest real reply (an image reading with 20 entries and their
	// lines) is a few tens of KB.
	AIServiceResponseMaxBytes = 1 << 20
)
