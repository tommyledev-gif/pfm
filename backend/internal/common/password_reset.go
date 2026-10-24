package common

import (
	"net/http"
	"time"
)

// Forgot password by email code (specs/forgot-password).
const (
	// ResetCodeDigits is the length of an emailed reset code.
	ResetCodeDigits = 6
	// ResetCodeTTL is how long a code can be used (BR-03).
	ResetCodeTTL = 15 * time.Minute
	// ResetCodeMaxTries ends a code at its 5th wrong try (BR-04).
	ResetCodeMaxTries = 5
	// ResetCodeCooldown / ResetCodeHourlyMax cap new codes per account
	// (BR-05); over either, nothing is sent and the answer is unchanged.
	ResetCodeCooldown  = 60 * time.Second
	ResetCodeHourlyMax = 5
	// ResetCodeRetention is when retention deletes a code row (BR-10).
	ResetCodeRetention = 24 * time.Hour

	// Per client IP on the two public routes (BR-05).
	PasswordResetRequestRateLimit       = 5
	PasswordResetRequestRateLimitWindow = 15 * time.Minute
	PasswordResetConfirmRateLimit       = 20
	PasswordResetConfirmRateLimitWindow = 15 * time.Minute

	// ErrCodeResetCodeInvalid: wrong, expired, used or exhausted code, or no
	// active account behind the identifier — one answer for all (BR-02).
	ErrCodeResetCodeInvalid = "RESET_CODE_INVALID"
)

var ErrResetCodeInvalid = &AppError{
	Code:    ErrCodeResetCodeInvalid,
	Status:  http.StatusBadRequest,
	Message: "Mã không đúng hoặc đã hết hạn.",
}
