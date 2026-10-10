package dto

import (
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// InviteUserResponse is the 201 body for POST /admin/users/invite.
type InviteUserResponse struct {
	UserID          uuid.UUID `json:"user_id"`
	Email           string    `json:"email"`
	Status          string    `json:"status"`
	InviteExpiresAt time.Time `json:"invite_expires_at"`
}

func NewInviteUserResponse(u *model.User) InviteUserResponse {
	return InviteUserResponse{
		UserID:          u.ID,
		Email:           u.Email,
		Status:          string(u.Status),
		InviteExpiresAt: *u.InviteExpiresAt,
	}
}

// UserResponse is the explicit field whitelist for any endpoint that returns
// a user. password_hash, invite_token, and invite_expires_at must never be
// added here (test_cases.md TC-USR-44 / spec.md Edge Case #3).
type UserResponse struct {
	ID          uuid.UUID  `json:"id"`
	Email       string     `json:"email"`
	FullName    *string    `json:"full_name"`
	Status      string     `json:"status"`
	Role        string     `json:"role"`
	ActivatedAt *time.Time `json:"activated_at"`
	CreatedAt   time.Time  `json:"created_at"`
	// AvatarURL is null when the user has no avatar. Filled only by the
	// queries that select it (GetUserByID and the profile queries), so it is
	// null in the admin user list.
	AvatarURL *string `json:"avatar_url"`
	// InviteResendAvailableAt is set only for pending users: the earliest
	// moment POST /admin/users/:id/resend-invite will accept, so a client can
	// show a countdown instead of a button that 429s. Not sensitive — it
	// reveals timing only, never the token or its expiry.
	InviteResendAvailableAt *time.Time `json:"invite_resend_available_at"`
}

func NewUserResponse(u *model.User) UserResponse {
	return UserResponse{
		ID:          u.ID,
		Email:       u.Email,
		FullName:    u.FullName,
		Status:      string(u.Status),
		Role:        string(u.Role),
		ActivatedAt: u.ActivatedAt,
		CreatedAt:   u.CreatedAt,
		AvatarURL:   u.AvatarURL,

		InviteResendAvailableAt: inviteResendAvailableAt(u),
	}
}

func inviteResendAvailableAt(u *model.User) *time.Time {
	if u.Status != model.UserStatusPending {
		return nil
	}
	sentAt := u.CreatedAt
	if u.InviteSentAt != nil {
		sentAt = *u.InviteSentAt
	}
	at := common.InviteResendAvailableAt(sentAt, u.InviteResendCount).UTC()
	return &at
}

type PaginationResponse struct {
	NextCursor *string `json:"next_cursor"`
	Total      int64   `json:"total"`
}

type ListUsersResponse struct {
	Data       []UserResponse     `json:"data"`
	Pagination PaginationResponse `json:"pagination"`
}
