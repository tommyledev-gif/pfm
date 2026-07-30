package model

import (
	"time"

	"github.com/google/uuid"
)

type UserStatus string

const (
	UserStatusPending  UserStatus = "pending"
	UserStatusActive   UserStatus = "active"
	UserStatusDisabled UserStatus = "disabled"
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
}
