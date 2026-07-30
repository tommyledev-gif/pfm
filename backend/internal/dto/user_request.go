package dto

// InviteUserRequest is the body of POST /admin/users/invite.
// Shape validation only (handler layer) — the email-already-exists business
// rule is checked in UserService, never here.
type InviteUserRequest struct {
	Email string `json:"email" validate:"required,email"`
	Role  string `json:"role" validate:"omitempty,oneof=admin member"`
}

// ListUsersQuery is the query-string binding for GET /admin/users.
type ListUsersQuery struct {
	Status string `query:"status" validate:"omitempty,oneof=pending active disabled"`
	Role   string `query:"role" validate:"omitempty,oneof=admin member"`
	Cursor string `query:"cursor"`
	Limit  int    `query:"limit" validate:"omitempty,min=1,max=100"`
}
