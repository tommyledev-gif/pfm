package model

import (
	"time"

	"github.com/google/uuid"
)

type UserStatus string

const (
	// UserStatusRequested: asked for an account from the login screen, not
	// yet approved by an admin (mig 031). Approval moves it to pending.
	UserStatusRequested UserStatus = "requested"
	UserStatusPending   UserStatus = "pending"
	UserStatusActive    UserStatus = "active"
	UserStatusDisabled  UserStatus = "disabled"
)

type UserRole string

const (
	UserRoleAdmin  UserRole = "admin"
	UserRoleMember UserRole = "member"
)

// User is the domain representation of the users table. It holds zero
// framework imports (no Fiber, pgx, or sqlc types) so it can be shared
// across handler/service/repository without leaking a persistence detail.
type User struct {
	ID              uuid.UUID
	Email           string
	FullName        *string
	PasswordHash    *string
	Status          UserStatus
	Role            UserRole
	InvitedBy       *uuid.UUID
	InviteToken     *string
	InviteExpiresAt *time.Time
	ActivatedAt     *time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
	DeletedAt       *time.Time
	// InviteSentAt is when the current invite email went out (nil for rows
	// that were never pending); InviteResendCount is how many times it has
	// been resent. Together they drive common.InviteResendAvailableAt.
	InviteSentAt      *time.Time
	InviteResendCount int32
	// TokensValidAfter is the sign-out-everywhere point (mig 025, UTC, whole
	// seconds; nil = never used). Populated only by GetUserByID.
	TokensValidAfter *time.Time
	// AvatarURL is the public URL of the uploaded avatar (mig 027); nil = none.
	// Populated only by GetUserByID and the profile queries.
	AvatarURL *string
	// Username is the tên đăng nhập chosen at activation (mig 030), lowercase;
	// nil for accounts activated before it existed. Never changes afterwards.
	Username *string
}
