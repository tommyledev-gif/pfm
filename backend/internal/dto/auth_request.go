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
type ActivateRequest struct {
	Token           string `json:"token" validate:"required"`
	Username        string `json:"username" validate:"max=64"`
	FullName        string `json:"full_name" validate:"omitempty"`
	Password        string `json:"password" validate:"required"`
	PasswordConfirm string `json:"password_confirm" validate:"required"`
}

// LoginRequest is the body of POST /auth/login. Email carries an email or a
// tên đăng nhập (mig 030); the JSON key keeps its old name so older clients
// keep working. AuthService.Login tells the two apart by the "@".
type LoginRequest struct {
	Email    string `json:"email" validate:"required,max=254"`
	Password string `json:"password" validate:"required"`
}

// LogoutRequest is the body of POST /auth/logout.
//
// Only `required` is enforced here, not a JWT-structure tag: go-playground
// validator/v10's built-in tag set is not confirmed to include a `jwt`
// validator, and guessing wrong would panic at runtime on an unknown tag.
// A malformed (non-JWT) token is instead caught by
// AuthService.ParseRefreshTokenUnverified, which returns the same
// 400 INVALID_INPUT either way (see auth_service.go's Logout).
type LogoutRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// RefreshRequest is the body of POST /auth/refresh — same shape as
// LogoutRequest (specs/mobile-session-refresh/spec.md decision #1), for the
// same reason: only presence is validated here, malformed/expired/revoked
// tokens are all distinguished inside AuthService.Refresh.
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}
