package common

import "time"

// Sessions (mig 028, device-bound since mig 033; service.SessionService).
const (
	// SessionMaxActive is how many sessions one user may hold at once — in
	// effect devices, since a sign-in on a device replaces that user's session
	// there. Starting another revokes the least recently used one, so the
	// newest sign-in always succeeds and an old, forgotten device is what drops.
	SessionMaxActive = 5

	// SessionAbsoluteTTL is a session's hard stop: refreshing extends the
	// idle window (RefreshTokenTTL) but never this. After it the account needs
	// its password again on that device, however often it was used.
	SessionAbsoluteTTL = 180 * 24 * time.Hour

	// SessionDeviceNameMaxRunes caps the device name a client reports
	// (X-Device-Name); a longer one is cut, never refused.
	SessionDeviceNameMaxRunes = 64

	// HeaderDeviceID / HeaderDeviceName carry the calling device: a random
	// UUID the app made once, and its model name URI-encoded (OkHttp refuses
	// non-ASCII header values). Sent on every mobile request; absent from web.
	HeaderDeviceID   = "X-Device-Id"
	HeaderDeviceName = "X-Device-Name"

	// RefreshReuseGrace is how long the refresh token just replaced stays
	// acceptable. A client whose refresh response was lost (dead mobile
	// network, a tunnel, airplane mode) retries with the old token once it is
	// back — the mobile client retries every 30 s and again on reconnect — and
	// without this it would be mistaken for a replayed, stolen one and signed
	// out. The window runs from the rotation, not from the reconnect, so it has
	// to cover the whole dead spot.
	//
	// Not longer, because it only delays detection: a thief using the old
	// token inside the window gets a pair, and the owner's next refresh then
	// presents a token that is no longer current. An attacker who keeps
	// refreshing within the window of each of the owner's refreshes could stay
	// undetected, but would have to match the owner's cadence indefinitely.
	RefreshReuseGrace = 5 * time.Minute
)

// Retention of finished token and session rows.
const (
	// SessionPurgeRetention is how long an expired or revoked session row is
	// kept before the retention job deletes it.
	SessionPurgeRetention = 7 * 24 * time.Hour
	// TokenPurgeInterval is how often the retention job runs (once at
	// startup too, like the intent log purge).
	TokenPurgeInterval = 6 * time.Hour
)

// Database and HTTP server limits (cmd/server).
const (
	// DBStatementTimeoutMs aborts any single statement that runs this long.
	// The slowest legitimate statements (report aggregates, an export over a
	// large history) finish in a few seconds.
	DBStatementTimeoutMs = 30_000
	// DBIdleInTxTimeoutMs ends a transaction left open and idle, which holds
	// row locks (a wallet balance!) until it does.
	DBIdleInTxTimeoutMs = 60_000

	// HealthDBPingTimeout bounds the readiness probe's database ping.
	HealthDBPingTimeout = 2 * time.Second

	// HTTPBodyLimitBytes must exceed the largest accepted upload plus its
	// multipart framing: TransactionImportMaxUploadBytes is 5 MiB, and
	// Fiber's own default of 4 MiB was refusing 4-5 MiB imports with a bare
	// 413 before the handler's own check could run.
	HTTPBodyLimitBytes = 6 * 1024 * 1024
	// HTTPReadTimeout covers reading the request, a slow 5 MiB upload on
	// mobile data included.
	HTTPReadTimeout = 30 * time.Second
	// HTTPWriteTimeout must outlast the slowest handler: the AI service
	// calls, which the backend itself abandons after 15 s.
	HTTPWriteTimeout = 60 * time.Second
	// HTTPIdleTimeout is how long a keep-alive connection may sit unused. It
	// is above cloudflared's 90 s origin keep-alive so the tunnel, not the
	// origin, decides when an idle connection closes.
	HTTPIdleTimeout = 120 * time.Second
)

// Failed logins per account, counted across every IP
// (middleware.LoginAccountRateLimiter).
const (
	LoginAccountRateLimit       = 10
	LoginAccountRateLimitWindow = 15 * time.Minute
)

// Image uploads per user (middleware.UploadRateLimiter): icons for wallets,
// categories and budgets, and the avatar.
const (
	UploadRateLimit       = 30
	UploadRateLimitWindow = time.Hour
)
