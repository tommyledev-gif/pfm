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
	// ErrCodeCategoryInUse is reserved for the active-Budget delete guard
	// (spec.md S-CAT-27) — not yet wired up, blocked on F-05 Budget
	// Management's migration (plan.md Finding #4 / CAT-T14).
	ErrCodeCategoryInUse = "CATEGORY_IN_USE"
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
	ErrEmailAlreadyExists = &AppError{Code: ErrCodeEmailAlreadyExists, Status: http.StatusConflict, Message: "an account with this email already exists"}
	ErrForbidden          = &AppError{Code: ErrCodeForbidden, Status: http.StatusForbidden, Message: "you do not have permission to perform this action"}
	ErrNotFound           = &AppError{Code: ErrCodeNotFound, Status: http.StatusNotFound, Message: "resource not found"}
	ErrTokenExpired       = &AppError{Code: ErrCodeTokenExpired, Status: http.StatusGone, Message: "this invite link has expired"}
	ErrRateLimited        = &AppError{Code: ErrCodeRateLimited, Status: http.StatusTooManyRequests, Message: "too many requests, please try again later"}
	ErrInvalidCredentials = &AppError{Code: ErrCodeInvalidCredentials, Status: http.StatusUnauthorized, Message: "invalid email or password"}
	ErrAccountNotActive   = &AppError{Code: ErrCodeAccountNotActivated, Status: http.StatusUnauthorized, Message: "this account has not been activated yet"}
	ErrAccountDisabled    = &AppError{Code: ErrCodeAccountDisabled, Status: http.StatusUnauthorized, Message: "this account has been disabled"}
	ErrPasswordMismatch   = &AppError{Code: ErrCodePasswordMismatch, Status: http.StatusBadRequest, Message: "password and confirmation do not match"}
	ErrUnauthenticated    = &AppError{Code: ErrCodeUnauthenticated, Status: http.StatusUnauthorized, Message: "authentication required"}
	ErrWalletAccessDenied = &AppError{Code: ErrCodeWalletAccessDenied, Status: http.StatusForbidden, Message: "you do not have access to this wallet"}
	ErrWalletNotFound     = &AppError{Code: ErrCodeWalletNotFound, Status: http.StatusNotFound, Message: "wallet not found"}
	ErrCategoryAccessDenied = &AppError{Code: ErrCodeCategoryAccessDenied, Status: http.StatusForbidden, Message: "you do not have access to this category"}
	ErrCategoryNotFound     = &AppError{Code: ErrCodeCategoryNotFound, Status: http.StatusNotFound, Message: "category not found"}
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
