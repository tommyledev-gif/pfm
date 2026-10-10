package model

import (
	"time"

	"github.com/google/uuid"
)

// Session is one signed-in device (sessions table, mig 028). Like User it
// holds zero framework imports.
type Session struct {
	ID     uuid.UUID
	UserID uuid.UUID
	// RefreshJTI is the only refresh token currently valid for the session.
	// PrevRefreshJTI/RotatedAt are the one before it and when it was
	// replaced: it stays acceptable for a short grace window so a client that
	// lost the refresh response can retry.
	RefreshJTI     string
	PrevRefreshJTI *string
	RotatedAt      *time.Time

	CreatedAt  time.Time
	LastUsedAt time.Time
	// ExpiresAt is the idle expiry (the current refresh token's exp);
	// AbsoluteExpiresAt is the hard stop that refreshing never moves.
	ExpiresAt         time.Time
	AbsoluteExpiresAt time.Time
	RevokedAt         *time.Time
	RevokedReason     *string
}

// SessionAuthState is what JWTAuth needs to decide on one request.
type SessionAuthState struct {
	RevokedAt         *time.Time
	ExpiresAt         time.Time
	AbsoluteExpiresAt time.Time
	UserStatus        UserStatus
	UserRole          UserRole
	// TokensValidAfter is the user's sign-out-everywhere point (nil = none).
	TokensValidAfter *time.Time
}

// Why a session ended, stored in revoked_reason.
const (
	SessionRevokedLogout       = "logout"
	SessionRevokedSignOutAll   = "sign_out_all"
	SessionRevokedAdmin        = "admin_sign_out"
	SessionRevokedLimit        = "session_limit"
	SessionRevokedRefreshReuse = "refresh_reuse"
)
