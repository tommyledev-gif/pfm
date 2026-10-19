package model

import (
	"time"

	"github.com/google/uuid"
)

// Session is one signed-in device (sessions table, mig 028; device columns
// mig 033). Like User it holds zero framework imports.
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

	// DeviceID/DeviceName are what the client reported (X-Device-Id /
	// X-Device-Name); nil for a session started before mig 033 that has not
	// refreshed since, or by a client that sends neither (web).
	DeviceID   *uuid.UUID
	DeviceName *string
}

// SessionDevice is the device a request comes from, as the client reported
// it. Name may be empty; a nil *SessionDevice means "no device id sent".
type SessionDevice struct {
	ID   uuid.UUID
	Name string
}

// SessionSummary is one row of the user's "signed-in devices" list.
type SessionSummary struct {
	ID         uuid.UUID
	DeviceName *string
	CreatedAt  time.Time
	LastUsedAt time.Time
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
	// A new sign-in of the same user on the same device took its place.
	SessionRevokedReplaced = "replaced"
	// The user signed this device out from another one (device list).
	SessionRevokedDeviceSignOut = "device_sign_out"
	// The user changed their password; every session ends.
	SessionRevokedPasswordChanged = "password_changed"
)
