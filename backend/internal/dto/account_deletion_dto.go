package dto

// SearchUsersQuery is the query string of GET /admin/users/search — the
// account deletion tool's search box. Matches email or tên đăng nhập.
type SearchUsersQuery struct {
	Q string `query:"q" validate:"required,max=254"`
}

// SearchUsersResponse is a single page by design (common.AccountSearchLimit);
// there is no cursor.
type SearchUsersResponse struct {
	Data []UserResponse `json:"data"`
}
