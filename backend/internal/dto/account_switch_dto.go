package dto

import "time"

// SwitchRequest is the body of POST /auth/switch. Only presence is checked
// here; malformed / expired / used / wrong-purpose tokens are told apart in
// AccountSwitchService.Switch (same split as RefreshRequest).
type SwitchRequest struct {
	SwitchToken string `json:"switch_token" validate:"required"`
}

// RevokeSwitchTokenRequest is the body of POST /auth/switch-token/revoke.
type RevokeSwitchTokenRequest struct {
	SwitchToken string `json:"switch_token" validate:"required"`
}

// SwitchTokenResponse is the 200 body of POST /auth/switch-token.
type SwitchTokenResponse struct {
	SwitchToken string       `json:"switch_token"`
	ExpiresAt   time.Time    `json:"expires_at"`
	User        UserResponse `json:"user"`
}

// SwitchResponse is the 200 body of POST /auth/switch and (same shape) of
// POST /auth/sessions/revoke-all — a fresh session pair for the device, plus
// a rotated switch token only for a client that sent no X-Device-Id (an app
// build from before device-bound sessions); omitted otherwise.
type SwitchResponse struct {
	AccessToken          string       `json:"access_token"`
	RefreshToken         string       `json:"refresh_token"`
	SwitchToken          string       `json:"switch_token,omitempty"`
	SwitchTokenExpiresAt *time.Time   `json:"switch_token_expires_at,omitempty"`
	User                 UserResponse `json:"user"`
}

// RevokeAllSessionsResponse is the 200 body of POST /auth/sessions/revoke-all.
type RevokeAllSessionsResponse = SwitchResponse
