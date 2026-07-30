package sqlc

import (
	"time"

	"github.com/google/uuid"
)

// User mirrors the users table exactly, column for column — this is the raw
// row shape sqlc would generate. Repository code converts this into
// model.User; nothing outside internal/repository should ever see this type.
type User struct {
	ID              uuid.UUID
	Email           string
	FullName        *string
	PasswordHash    *string
	Status          string
	Role            string
	InvitedBy       *uuid.UUID
	InviteToken     *string
	InviteExpiresAt *time.Time
	ActivatedAt     *time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
	DeletedAt       *time.Time
}

// RevokedToken mirrors the revoked_tokens table exactly.
type RevokedToken struct {
	ID        uuid.UUID
	TokenJTI  string
	UserID    *uuid.UUID
	ExpiresAt time.Time
	RevokedAt time.Time
}
