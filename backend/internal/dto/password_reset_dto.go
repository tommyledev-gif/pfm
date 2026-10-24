package dto

// PasswordResetRequest is the body of POST /auth/password-reset/request.
// Identifier is an email or a tên đăng nhập, like LoginRequest.Email.
type PasswordResetRequest struct {
	Identifier string `json:"identifier" validate:"required,max=254"`
}

// PasswordResetConfirmRequest is the body of POST /auth/password-reset/confirm.
// The password rules (8 characters, 72 bytes) are business rules checked by
// the service, which answers WEAK_PASSWORD; max=256 only keeps a
// multi-megabyte field out.
type PasswordResetConfirmRequest struct {
	Identifier  string `json:"identifier" validate:"required,max=254"`
	Code        string `json:"code" validate:"required,len=6,numeric"`
	NewPassword string `json:"new_password" validate:"required,max=256"`
}
