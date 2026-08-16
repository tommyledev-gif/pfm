package common

import "net/http"

// Error code constants returned in the API's { error_code, message, details? }
// response shape (CLAUDE.md API Design). Never construct these as raw strings
// elsewhere — always go through AppError / the sentinel errors below.
const (
	ErrCodeInvalidInput        = "INVALID_INPUT"
	ErrCodeEmailAlreadyExists  = "EMAIL_ALREADY_EXISTS"
	ErrCodeForbidden           = "FORBIDDEN"
	ErrCodeNotFound            = "NOT_FOUND"
	ErrCodeTokenExpired        = "TOKEN_EXPIRED"
	ErrCodeWeakPassword        = "WEAK_PASSWORD"
	ErrCodePasswordMismatch    = "PASSWORD_MISMATCH"
	ErrCodeRateLimited         = "RATE_LIMITED"
	ErrCodeInvalidCredentials  = "INVALID_CREDENTIALS"
	ErrCodeAccountNotActivated = "ACCOUNT_NOT_ACTIVATED"
	ErrCodeAccountDisabled     = "ACCOUNT_DISABLED"
	// ErrCodeUnauthenticated is used for missing/invalid/expired JWTs. Neither
	// spec.md nor plan.md names a specific code for this case (their Error
	// Flows tables show "—"), so this is an implementation-level choice made
	// to keep the API's error shape ({error_code, message}) consistent even
	// on 401s rather than sending an empty error_code.
	ErrCodeUnauthenticated = "UNAUTHENTICATED"
	// ErrCodeWalletAccessDenied and ErrCodeWalletNotFound (F-03 Wallet
	// Management) are deliberately distinct — a wallet owned by someone else
	// is a 403, not a 404, since wallet IDs are unguessable UUIDv4s with no
	// meaningful enumeration risk (specs/wallet-management/spec.md S-WAL-16).
	ErrCodeWalletAccessDenied = "WALLET_ACCESS_DENIED"
	ErrCodeWalletNotFound     = "WALLET_NOT_FOUND"
	// ErrCodeCategoryAccessDenied/ErrCodeCategoryNotFound (F-04 Category
	// Management) follow the same 403-vs-404 split as Wallet's equivalents —
	// unguessable UUIDv4 IDs, so "belongs to someone else" (or is a
	// never-writable system category) is a 403, not a 404
	// (specs/category-management/spec.md S-CAT-16/S-CAT-20).
	ErrCodeCategoryAccessDenied  = "CATEGORY_ACCESS_DENIED"
	ErrCodeCategoryNotFound      = "CATEGORY_NOT_FOUND"
	ErrCodeCategoryAlreadyExists = "CATEGORY_ALREADY_EXISTS"
	// ErrCodeCategoryInUse backs the active-Budget delete guard (spec.md
	// S-CAT-27) — wired up in F-05's plan.md Finding #2 / BUD-T16, now that
	// the budgets table exists.
	ErrCodeCategoryInUse = "CATEGORY_IN_USE"
	// ErrCodeBudgetAccessDenied/ErrCodeBudgetNotFound (F-05 Budget
	// Management) follow the same 403-vs-404 split as Wallet/Category's
	// equivalents — unguessable UUIDv4 IDs (specs/budget-management/spec.md
	// S-BUD-24/S-BUD-25).
	ErrCodeBudgetAccessDenied = "BUDGET_ACCESS_DENIED"
	ErrCodeBudgetNotFound     = "BUDGET_NOT_FOUND"
	// ErrCodeBudgetAlreadyExists backs the one-active-Budget-per-category
	// invariant (spec.md S-BUD-11/S-BUD-13).
	ErrCodeBudgetAlreadyExists = "BUDGET_ALREADY_EXISTS"
	// ErrCodeInvalidCategoryType backs the "Budget category must be
	// expense-type" business rule (spec.md S-BUD-03). 422, not 400 — the
	// request is well-formed, the referenced Category simply isn't eligible.
	ErrCodeInvalidCategoryType = "INVALID_CATEGORY_TYPE"
	// ErrCodeTransactionAccessDenied/ErrCodeTransactionNotFound (F-06
	// Transaction Management) follow the same 403-vs-404 split as Wallet/
	// Category/Budget's equivalents — unguessable UUIDv4 IDs
	// (specs/transaction-management/spec.md S-TRX-32/S-TRX-33).
	ErrCodeTransactionAccessDenied = "TRANSACTION_ACCESS_DENIED"
	ErrCodeTransactionNotFound     = "TRANSACTION_NOT_FOUND"
	// ErrCodeInsufficientBalance backs the insufficient-balance floor on
	// expense Transaction creation only — never Update/Delete
	// (specs/transaction-management/spec.md Context #3, S-TRX-09/S-TRX-18).
	// 409, grouped with the other "conflict with current resource state"
	// codes (BUDGET_ALREADY_EXISTS, CATEGORY_IN_USE, CURRENCY_LOCKED).
	ErrCodeInsufficientBalance = "INSUFFICIENT_BALANCE"
	// ErrCodeCategoryTypeMismatch backs the "Transaction type must match its
	// Category's type" business rule (spec.md S-TRX-14/S-TRX-40). 422, same
	// reasoning as ErrCodeInvalidCategoryType — the request is well-formed,
	// the referenced Category simply isn't eligible for this Transaction's type.
	ErrCodeCategoryTypeMismatch = "CATEGORY_TYPE_MISMATCH"
	// ErrCodeCurrencyLocked backs F-03's long-deferred 409 CURRENCY_LOCKED
	// check (specs/wallet-management/spec.md S-WAL-21) — wired up by
	// specs/transaction-management/plan.md Finding #2 / WAL-T14 now that the
	// transactions table exists. Was previously only described in a
	// wallet_service.go comment, never actually defined.
	ErrCodeCurrencyLocked = "CURRENCY_LOCKED"
	// ErrCodeNotificationAccessDenied/ErrCodeNotificationNotFound (F-10
	// Notification Handling) follow the same 403-vs-404 split as every prior
	// feature's equivalents — unguessable UUIDv4 IDs
	// (specs/notification-handling/spec.md S-NOT-14/S-NOT-15).
	ErrCodeNotificationAccessDenied = "NOTIFICATION_ACCESS_DENIED"
	ErrCodeNotificationNotFound     = "NOTIFICATION_NOT_FOUND"
	// ErrCodeAIServiceUnavailable backs POST /ai/chat's 502 when the AI
	// Service is unreachable or times out (Groq and Anthropic both failing
	// inside that service) — a system error, never surfaced with internal
	// detail (specs/ai-chat-assistant/spec.md S-AI-10).
	ErrCodeAIServiceUnavailable = "AI_SERVICE_UNAVAILABLE"
)

// AppError is the single sentinel-error shape services return for known
// business error cases. Handlers/middleware map it to an HTTP response via
// errors.As — never by string-matching Error(). Details, when set, carries
// structured per-field validation failures (e.g. multiple invalid fields in
// one request) so the client gets every failure in a single response body
// instead of discovering them one submit at a time.
type AppError struct {
	Code    string
	Status  int
	Message string
	Details interface{}
}

func (e *AppError) Error() string {
	return e.Message
}

// Fixed-message sentinel errors for errors.Is comparisons. Errors whose
// message varies per call site (e.g. field-specific validation failures) are
// built with NewValidationError/NewWeakPasswordError instead.
var (
	ErrEmailAlreadyExists       = &AppError{Code: ErrCodeEmailAlreadyExists, Status: http.StatusConflict, Message: "an account with this email already exists"}
	ErrForbidden                = &AppError{Code: ErrCodeForbidden, Status: http.StatusForbidden, Message: "you do not have permission to perform this action"}
	ErrNotFound                 = &AppError{Code: ErrCodeNotFound, Status: http.StatusNotFound, Message: "resource not found"}
	ErrTokenExpired             = &AppError{Code: ErrCodeTokenExpired, Status: http.StatusGone, Message: "this invite link has expired"}
	ErrRateLimited              = &AppError{Code: ErrCodeRateLimited, Status: http.StatusTooManyRequests, Message: "too many requests, please try again later"}
	ErrInvalidCredentials       = &AppError{Code: ErrCodeInvalidCredentials, Status: http.StatusUnauthorized, Message: "invalid email or password"}
	ErrAccountNotActive         = &AppError{Code: ErrCodeAccountNotActivated, Status: http.StatusUnauthorized, Message: "this account has not been activated yet"}
	ErrAccountDisabled          = &AppError{Code: ErrCodeAccountDisabled, Status: http.StatusUnauthorized, Message: "this account has been disabled"}
	ErrPasswordMismatch         = &AppError{Code: ErrCodePasswordMismatch, Status: http.StatusBadRequest, Message: "password and confirmation do not match"}
	ErrUnauthenticated          = &AppError{Code: ErrCodeUnauthenticated, Status: http.StatusUnauthorized, Message: "authentication required"}
	ErrWalletAccessDenied       = &AppError{Code: ErrCodeWalletAccessDenied, Status: http.StatusForbidden, Message: "you do not have access to this wallet"}
	ErrWalletNotFound           = &AppError{Code: ErrCodeWalletNotFound, Status: http.StatusNotFound, Message: "wallet not found"}
	ErrCategoryAccessDenied     = &AppError{Code: ErrCodeCategoryAccessDenied, Status: http.StatusForbidden, Message: "you do not have access to this category"}
	ErrCategoryNotFound         = &AppError{Code: ErrCodeCategoryNotFound, Status: http.StatusNotFound, Message: "category not found"}
	ErrCategoryInUse            = &AppError{Code: ErrCodeCategoryInUse, Status: http.StatusConflict, Message: "an active budget references this category"}
	ErrBudgetAccessDenied       = &AppError{Code: ErrCodeBudgetAccessDenied, Status: http.StatusForbidden, Message: "you do not have access to this budget"}
	ErrBudgetNotFound           = &AppError{Code: ErrCodeBudgetNotFound, Status: http.StatusNotFound, Message: "budget not found"}
	ErrBudgetAlreadyExists      = &AppError{Code: ErrCodeBudgetAlreadyExists, Status: http.StatusConflict, Message: "an active budget already exists for this category"}
	ErrInvalidCategoryType      = &AppError{Code: ErrCodeInvalidCategoryType, Status: http.StatusUnprocessableEntity, Message: "budgets can only be set on expense categories"}
	ErrTransactionAccessDenied  = &AppError{Code: ErrCodeTransactionAccessDenied, Status: http.StatusForbidden, Message: "you do not have access to this transaction"}
	ErrTransactionNotFound      = &AppError{Code: ErrCodeTransactionNotFound, Status: http.StatusNotFound, Message: "transaction not found"}
	ErrInsufficientBalance      = &AppError{Code: ErrCodeInsufficientBalance, Status: http.StatusConflict, Message: "Insufficient balance"}
	ErrCategoryTypeMismatch     = &AppError{Code: ErrCodeCategoryTypeMismatch, Status: http.StatusUnprocessableEntity, Message: "transaction type must match the category's type"}
	ErrCurrencyLocked           = &AppError{Code: ErrCodeCurrencyLocked, Status: http.StatusConflict, Message: "currency cannot be changed once the wallet has transactions"}
	ErrNotificationAccessDenied = &AppError{Code: ErrCodeNotificationAccessDenied, Status: http.StatusForbidden, Message: "you do not have access to this notification"}
	ErrNotificationNotFound     = &AppError{Code: ErrCodeNotificationNotFound, Status: http.StatusNotFound, Message: "notification not found"}
	ErrAIServiceUnavailable     = &AppError{Code: ErrCodeAIServiceUnavailable, Status: http.StatusBadGateway, Message: "the assistant is temporarily unavailable, please try again"}
)

// NewInvalidInputError builds a 400 INVALID_INPUT error with a field-specific message.
func NewInvalidInputError(message string) *AppError {
	return &AppError{Code: ErrCodeInvalidInput, Status: http.StatusBadRequest, Message: message}
}

// NewInvalidInputErrorWithDetails builds a 400 INVALID_INPUT error carrying
// every failing field in one response — never just the first (implementation-checklist:
// "Validation errors collected and returned as a single structured response").
func NewInvalidInputErrorWithDetails(message string, details interface{}) *AppError {
	return &AppError{Code: ErrCodeInvalidInput, Status: http.StatusBadRequest, Message: message, Details: details}
}

// NewWeakPasswordError builds a 400 WEAK_PASSWORD error — kept distinct from
// INVALID_INPUT because spec.md treats "too short" and "missing" as different
// codes (S-USR-13 vs S-USR-14).
func NewWeakPasswordError(message string) *AppError {
	return &AppError{Code: ErrCodeWeakPassword, Status: http.StatusBadRequest, Message: message}
}

// NewCategoryAlreadyExistsError builds a 409 CATEGORY_ALREADY_EXISTS error
// with a name/type-specific message (spec.md S-CAT-04/S-CAT-05/S-CAT-22).
func NewCategoryAlreadyExistsError(message string) *AppError {
	return &AppError{Code: ErrCodeCategoryAlreadyExists, Status: http.StatusConflict, Message: message}
}
