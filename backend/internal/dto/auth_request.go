package dto

// ActivateRequest is the body of POST /auth/activate.
// Password strength (min length) and password/confirm equality are
// deliberately NOT validator tags here: spec.md requires distinct error
// codes (WEAK_PASSWORD vs INVALID_INPUT vs PASSWORD_MISMATCH) that a single
// generic validation-tag failure can't express, so those checks live in
// AuthService instead — only presence is checked at this layer.
//
// Username (tên đăng nhập) is required too, but its format rules live in
// AuthService for the same reason: INVALID_USERNAME says which rule failed.
//
// The max tags are shape bounds only, far above every real value (an invite
// token is 64 hex characters, a password is at most 72 bytes): they keep a
// multi-megabyte field from ever reaching the services.
type ActivateRequest struct {
	Token           string `json:"token" validate:"required,max=128"`
	Username        string `json:"username" validate:"max=64"`
	FullName        string `json:"full_name" validate:"max=256"`
	Password        string `json:"password" validate:"required,max=256"`
	PasswordConfirm string `json:"password_confirm" validate:"required,max=256"`
}

// LoginRequest is the body of POST /auth/login. Email carries an email or a
// tên đăng nhập (mig 030); the JSON key keeps its old name so older clients
// keep working. AuthService.Login tells the two apart by the "@".
type LoginRequest struct {
	Email    string `json:"email" validate:"required,max=254"`
	Password string `json:"password" validate:"required,max=256"`
}

// LogoutRequest is the body of POST /auth/logout.
//
// Only presence and a size bound are enforced here, not a JWT-structure tag:
// a malformed (non-JWT) token is caught by TokenService.ParseRefreshToken,
// which AuthService.Logout maps to the same 400 INVALID_INPUT.
type LogoutRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required,max=4096"`
}

// RefreshRequest is the body of POST /auth/refresh — same shape as
// LogoutRequest (specs/mobile-session-refresh/spec.md decision #1), for the
// same reason: only presence is validated here, malformed/expired/revoked
// tokens are all distinguished inside AuthService.Refresh.
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required,max=4096"`
}
