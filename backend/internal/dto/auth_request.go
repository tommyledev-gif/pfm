package dto

// ActivateRequest is the body of POST /auth/activate.
// Password strength (min length) and password/confirm equality are
// deliberately NOT validator tags here: spec.md requires distinct error
// codes (WEAK_PASSWORD vs INVALID_INPUT vs PASSWORD_MISMATCH) that a single
// generic validation-tag failure can't express, so those checks live in
// AuthService instead — only presence is checked at this layer.
type ActivateRequest struct {
	Token           string `json:"token" validate:"required"`
	FullName        string `json:"full_name" validate:"omitempty"`
	Password        string `json:"password" validate:"required"`
	PasswordConfirm string `json:"password_confirm" validate:"required"`
}

// LoginRequest is the body of POST /auth/login.
type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
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
