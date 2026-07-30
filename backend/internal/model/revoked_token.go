package model

import (
	"time"

	"github.com/google/uuid"
)

// RevokedToken records a refresh token's JWT ID as revoked. The raw bearer
// token is never stored — only its jti claim (see spec.md security rules).
type RevokedToken struct {
	ID        uuid.UUID
	TokenJTI  string
	UserID    *uuid.UUID
	ExpiresAt time.Time
	RevokedAt time.Time
}
