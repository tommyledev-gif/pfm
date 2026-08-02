package common

import "time"

// Invite (F-01 US-01)
const (
	InviteTokenBytes      = 32 // crypto/rand byte length -> 64 hex chars
	InviteTokenTTL        = 72 * time.Hour
	InviteRateLimit       = 20
	InviteRateLimitWindow = 1 * time.Hour
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

// Wallets (F-03). Name length mirrored by frontend/src/lib/constants.ts so
// the two never drift, same convention as MinPasswordLength above. The
// type/currency enums themselves live only in the dto validator `oneof` tags
// and the 004_wallets.sql CHECK constraints — go-playground/validator tags
// are compile-time string literals and cannot reference a shared Go slice,
// so a separate constant here would just be dead weight, not a real
// single source of truth (see model.WalletType for the canonical Go-side
// enum type used elsewhere in code).
const (
	WalletNameMaxLength   = 100
	WalletDefaultCurrency = "VND"
)

// Categories (F-04). CategoryIconMaxLength is an explicit assumption
// (specs/category-management/plan.md Finding #12) — spec.md left icon
// validation as "a reasonable max length" without committing to a number.
const (
	CategoryNameMaxLength = 50
	CategoryIconMaxLength = 32
)

// Budgets (F-05).
const (
	// BudgetPeriodMonthly is the only accepted `period` value in MVP
	// (specs/budget-management/spec.md Business invariants).
	BudgetPeriodMonthly = "monthly"
	// DateOnlyLayout is the Go reference-time layout for a plain DATE value
	// (start_date, no time-of-day component). Shared so budget_service.go's
	// parse and budget_response.go's format never drift apart. The
	// validator/v10 struct tag on dto.CreateBudgetRequest.StartDate
	// necessarily repeats this as a literal (struct tags can't reference a
	// Go const) — keep the two in sync by hand if this ever changes.
	DateOnlyLayout = "2006-01-02"
)

// SupportedCurrencies is the same {VND, USD} allow-list as Wallet's currency
// (WalletDefaultCurrency above), but expressed as a real Go-side lookup — not
// just a struct-tag oneof — because `limits` map-KEY validation cannot be
// expressed as a validator/v10 struct tag (specs/budget-management/plan.md
// Finding #5). This supersedes the earlier "a Go-side list is dead weight"
// reasoning for Wallet/Category, which only ever needed a struct-tag oneof.
var SupportedCurrencies = map[string]bool{
	"VND": true,
	"USD": true,
}
