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
