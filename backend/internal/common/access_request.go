package common

import (
	"net/http"
	"regexp"
	"strings"
	"time"
)

// Access requests (mig 031) and the tên đăng nhập chosen at activation (mig 030).
const (
	// ErrCodeInvalidUsername: the username does not follow ValidUsername.
	ErrCodeInvalidUsername = "INVALID_USERNAME"
	// ErrCodeUsernameTaken: another live account already has it.
	ErrCodeUsernameTaken = "USERNAME_TAKEN"
	// ErrCodeUsernameAlreadySet: PUT /users/me/username on an account that
	// already has one. A username is set once and never changed.
	ErrCodeUsernameAlreadySet = "USERNAME_ALREADY_SET"
	// ErrCodeAdminNotFound: the admin email on an access request is not an
	// active admin. Said plainly so a typo can be fixed; whether the
	// requester's own email has an account is never revealed.
	ErrCodeAdminNotFound = "ADMIN_NOT_FOUND"
	// ErrCodeAccessRequestHandled: approving or rejecting a request that is
	// no longer waiting (already approved or rejected, from the email link or
	// another admin).
	ErrCodeAccessRequestHandled = "ACCESS_REQUEST_HANDLED"
	// ErrCodeAccountAwaitingApproval: login with the email of a request an
	// admin has not approved yet.
	ErrCodeAccountAwaitingApproval = "ACCOUNT_AWAITING_APPROVAL"
)

var (
	ErrUsernameTaken           = &AppError{Code: ErrCodeUsernameTaken, Status: http.StatusConflict, Message: "Tên đăng nhập đã có người dùng."}
	ErrUsernameAlreadySet      = &AppError{Code: ErrCodeUsernameAlreadySet, Status: http.StatusConflict, Message: "Tài khoản đã có tên đăng nhập."}
	ErrAdminNotFound           = &AppError{Code: ErrCodeAdminNotFound, Status: http.StatusUnprocessableEntity, Message: "Không có admin nào dùng email này."}
	ErrAccessRequestHandled    = &AppError{Code: ErrCodeAccessRequestHandled, Status: http.StatusConflict, Message: "Yêu cầu này không còn chờ duyệt."}
	ErrAccountAwaitingApproval = &AppError{Code: ErrCodeAccountAwaitingApproval, Status: http.StatusUnauthorized, Message: "Yêu cầu tạo tài khoản đang chờ admin duyệt."}
)

// NewInvalidUsernameError is 400 INVALID_USERNAME; the message says how to fix it.
func NewInvalidUsernameError(message string) *AppError {
	return &AppError{Code: ErrCodeInvalidUsername, Status: http.StatusBadRequest, Message: message}
}

const (
	UsernameMinLength = 3
	UsernameMaxLength = 30
	// AccessRequestRateLimit caps POST /auth/access-requests per client IP:
	// each accepted request emails an admin, so it must not be loopable.
	AccessRequestRateLimit       = 5
	AccessRequestRateLimitWindow = 1 * time.Hour
	// AccessApproveRateLimit caps the email-link approval per client IP; the
	// token is 32 random bytes, so this only stops pointless hammering.
	AccessApproveRateLimit       = 20
	AccessApproveRateLimitWindow = 15 * time.Minute
	// AccessStatusRateLimit caps the requester's "approved yet?" check per
	// client IP: room for a device polling every 30 s with the login screen
	// open, not for walking a list of emails.
	AccessStatusRateLimit       = 60
	AccessStatusRateLimitWindow = 15 * time.Minute
)

// usernameChars is the allowed alphabet; UsernameProblem checks the rest of
// chk_users_username_format (mig 030) rule by rule, so the error can say
// which one failed.
var usernameChars = regexp.MustCompile(`^[a-z0-9._]+$`)

// NormalizeUsername is the one form a username is stored and looked up in.
func NormalizeUsername(username string) string {
	return strings.ToLower(strings.TrimSpace(username))
}

// UsernameProblem returns "" for a valid, already-normalized username, or the
// message saying what to change. Same rule as the DB CHECK constraint.
func UsernameProblem(username string) string {
	switch {
	case username == "":
		return "Nhập tên đăng nhập."
	case len(username) < UsernameMinLength || len(username) > UsernameMaxLength:
		return "Tên đăng nhập dài 3 đến 30 ký tự."
	case !usernameChars.MatchString(username):
		return "Chỉ dùng chữ không dấu, số, dấu chấm hoặc gạch dưới."
	case username[0] < 'a' || username[0] > 'z':
		return "Tên đăng nhập bắt đầu bằng chữ cái."
	case strings.HasSuffix(username, ".") || strings.HasSuffix(username, "_"):
		return "Tên đăng nhập kết thúc bằng chữ hoặc số."
	case strings.Contains(username, "..") || strings.Contains(username, "__") ||
		strings.Contains(username, "._") || strings.Contains(username, "_."):
		return "Không đặt hai dấu chấm hoặc gạch dưới liền nhau."
	}
	return ""
}
