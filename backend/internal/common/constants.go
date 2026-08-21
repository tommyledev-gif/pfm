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

// Category icon uploads (Cloudflare R2 — see service.R2IconUploader).
// CategoryIconMaxUploadBytes is a plan-owned assumption, same convention as
// CategoryIconMaxLength above — no spec commits to a number.
const CategoryIconMaxUploadBytes = 2 * 1024 * 1024 // 2 MiB

// CategoryIconAllowedContentTypes is the upload allow-list — png/jpg/svg
// per the product ask, checked against the multipart part's declared
// Content-Type (not sniffed from bytes; good enough for an
// invite-only app with no anonymous upload surface).
var CategoryIconAllowedContentTypes = map[string]bool{
	"image/png":     true,
	"image/jpeg":    true,
	"image/svg+xml": true,
}

// Icon upload object-storage key prefixes (service.IconUploader) — one per
// entity so Category/Wallet/Budget uploads land in distinctly namespaced R2
// keys despite sharing one uploader implementation
// (specs/wallet-budget-icons/plan.md Finding #5). Wallet/Budget reuse
// CategoryIconMaxUploadBytes/CategoryIconAllowedContentTypes as-is — a
// per-entity rename was considered and deliberately deferred (same plan.md
// finding) since the limits are identical across all three today.
const (
	CategoryIconKeyPrefix = "category-icons"
	WalletIconKeyPrefix   = "wallet-icons"
	BudgetIconKeyPrefix   = "budget-icons"
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

// Transactions (F-06). TransactionNoteMaxLength is an explicit assumption
// (specs/transaction-management/spec.md Domain Fields / Open Questions #4) —
// no source document commits to a number; mirrors CategoryIconMaxLength's
// precedent of a plan-owned constant for an assumed limit.
const (
	TransactionNoteMaxLength = 500
)

// Notifications (F-10). NotificationJobInterval is an explicit assumption
// (specs/notification-handling/spec.md Open Questions #2) — no SRS/SDS
// source states a cadence; 5 minutes balances alert staleness against load.
const (
	NotificationJobInterval = 5 * time.Minute
)

// AI Chat Assistant (Feature-12 US-01, specs/ai-chat-assistant).
const (
	// AIChatMessageMaxLength is an explicit assumption (spec.md Main Flow
	// step 2 / Open Questions #6) — no source document commits to a number.
	AIChatMessageMaxLength = 1000
	// AIChatConfidenceThreshold gates which AI-proposed items are surfaced
	// for confirmation vs. folded into an ambiguous reply (spec.md Resolved
	// design decision #8) — carried over from the original product proposal,
	// not an SRS-native number; flagged for product sign-off (spec.md Open
	// Questions #3).
	AIChatConfidenceThreshold = 0.6
	// AIChatRateLimit/AIChatRateLimitWindow are an explicit assumption
	// (spec.md Open Questions #1) — applies only to POST /ai/chat, never to
	// the confirm step (POST /transactions).
	AIChatRateLimit       = 30
	AIChatRateLimitWindow = 1 * time.Hour
	// AIChatHistoryLimit caps how many prior messages (both roles) are sent
	// to the AI Service as conversation context — enough to disambiguate a
	// short follow-up ("20k" after "mua cà phê ở highlands") without the
	// request body growing unbounded on a long-running conversation. An
	// explicit assumption, same convention as AIChatConfidenceThreshold —
	// no source document commits to a number. Must stay an EVEN number:
	// chat_messages always alternates user/assistant in pairs, and the AI
	// Service's Anthropic fallback requires its messages array to start with
	// "user" — taking the last N rows only lands on a user-turn boundary
	// when N is even (see ai-service/app/services/extract_service.py's
	// _history_messages, which fails safe if this is ever changed anyway).
	AIChatHistoryLimit = 10
	// VNDToCentsFactor converts the AI Service's plain-VND integer output
	// (e.g. 50000 for "50k") into this app's BIGINT-integer-cents storage
	// convention — the same conversion the manual create-transaction form's
	// toCents() helper already applies at its own client boundary. Found via
	// live testing: every AI-proposed amount displayed 100x too small
	// without this.
	VNDToCentsFactor = 100
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
