package dto

// UpdateProfileRequest is the body of PATCH /users/me. It has exactly one
// field on purpose and is decoded with DecodeStrict, so "role", "status",
// "email" or anything else a client tries to slip in is rejected with 400
// instead of being silently ignored (mass assignment). The name's content
// rules live in the service (ProfileService.UpdateFullName).
type UpdateProfileRequest struct {
	FullName string `json:"full_name"`
}

// ClaimUsernameRequest is the body of PUT /users/me/username, decoded with
// DecodeStrict like UpdateProfileRequest. The username's rules live in the
// service (ProfileService.ClaimUsername, common.UsernameProblem).
type ClaimUsernameRequest struct {
	Username string `json:"username"`
}
