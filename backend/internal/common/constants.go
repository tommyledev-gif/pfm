package common

import "time"

// Invite (F-01 US-01)
const (
	InviteTokenBytes       = 32 // crypto/rand byte length -> 64 hex chars
	InviteTokenTTL         = 72 * time.Hour
	InviteRateLimit        = 20
	InviteRateLimitWindow  = 1 * time.Hour
)

// Activation (F-01 US-02)
const (
	BcryptCost        = 12
	MinPasswordLength = 8
)

// List Users (F-01 US-03)
const (
	DefaultListLimit = 20
	MaxListLimit     = 100
)

// Tokens (F-02)
const (
	AccessTokenTTL  = 15 * time.Minute
	RefreshTokenTTL = 7 * 24 * time.Hour
)

// Login (F-02 US-04)
const (
	LoginRateLimit       = 10
	LoginRateLimitWindow = 15 * time.Minute
)

// Server-lifecycle timeouts.
const (
	EmailDispatchTimeout = 10 * time.Second
	ShutdownTimeout      = 10 * time.Second
)

// JWT claim keys, shared between TokenService (issuance) and JWTAuth middleware
// (parsing) so the two never drift out of sync on a typo'd string literal.
const (
	JWTClaimUserID = "user_id"
	JWTClaimRole   = "role"
)

// Fiber locals keys set by middleware and read by handlers/services.
const (
	LocalsUserID = "userID"
	LocalsRole   = "role"
)
