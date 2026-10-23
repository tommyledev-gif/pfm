package common

import (
	"fmt"
	"net/http"
	"time"
)

// MaxPasswordBytes is bcrypt's input limit. bcrypt.GenerateFromPassword
// refuses anything longer, which used to surface as a 500 on activation and
// on password change (specs/security-hardening-2026-10 US-03). Bytes, not
// letters: a Vietnamese letter with diacritics takes 2-3 of them.
const MaxPasswordBytes = 72

// ErrPasswordTooLong is the one answer to a new password over MaxPasswordBytes.
var ErrPasswordTooLong = &AppError{
	Code:    ErrCodeWeakPassword,
	Status:  http.StatusBadRequest,
	Message: fmt.Sprintf("Mật khẩu tối đa %d ký tự không dấu.", MaxPasswordBytes),
}

// PasswordTooLong reports whether a new password is past what bcrypt hashes.
// Every bcrypt.GenerateFromPassword call on user input checks it first.
func PasswordTooLong(password string) bool {
	return len(password) > MaxPasswordBytes
}

// Password change (PUT /users/me/password, specs/mobile-account-switch US-11).
//
// Every refusal is 400 or 429, never 401: the mobile client reads a 401 as
// "this session is over" and would sign the user out for a mistyped password.
const (
	ErrCodeWrongCurrentPassword = "WRONG_CURRENT_PASSWORD"
	ErrCodeSamePassword         = "SAME_PASSWORD"

	// PasswordChangeRateLimit / Window cap FAILED changes per user, so a
	// phone left unlocked cannot be used to guess the current password.
	PasswordChangeRateLimit       = 5
	PasswordChangeRateLimitWindow = 15 * time.Minute
)

var (
	ErrWrongCurrentPassword = &AppError{Code: ErrCodeWrongCurrentPassword, Status: http.StatusBadRequest, Message: "Mật khẩu hiện tại không đúng."}
	ErrSamePassword         = &AppError{Code: ErrCodeSamePassword, Status: http.StatusBadRequest, Message: "Mật khẩu mới trùng mật khẩu hiện tại."}
)
