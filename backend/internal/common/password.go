package common

import (
	"net/http"
	"time"
)

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
