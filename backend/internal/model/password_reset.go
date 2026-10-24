package model

import (
	"time"

	"github.com/google/uuid"
)

// PasswordResetCode is one emailed reset code (specs/forgot-password). Only
// its keyed hash is stored. Live while UsedAt and RevokedAt are nil and
// ExpiresAt is in the future.
type PasswordResetCode struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	CodeHash  string
	Attempts  int32
	CreatedAt time.Time
	ExpiresAt time.Time
	UsedAt    *time.Time
	RevokedAt *time.Time
}
