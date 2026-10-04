package common

import "time"

// Account switching on mobile (specs/mobile-account-switch). A switch token
// is a single-purpose JWT whose only power is "start a session for its own
// user" via POST /auth/switch — never an access token, never a refresh token.
const (
	// AccountSwitchTokenTTL is the sliding 180-day expiry of a saved account
	// (spec decision #2). Each switch / daily renewal issues a fresh one.
	AccountSwitchTokenTTL = 180 * 24 * time.Hour

	// AccountSwitchTokenPurpose is the `purpose` claim ParseSwitchToken
	// requires and ParseRefreshToken refuses (plan.md Finding #1).
	AccountSwitchTokenPurpose = "account_switch"

	// SwitchRateLimit / SwitchRateLimitWindow cap POST /auth/switch per
	// client IP (spec S-ASW-20; owner decision: 20 per 15 minutes).
	SwitchRateLimit       = 20
	SwitchRateLimitWindow = 15 * time.Minute
)
