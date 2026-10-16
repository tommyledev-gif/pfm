package dto

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
)

// PasskeyBeginLoginRequest is the body of POST /auth/passkeys/login/begin.
// UserID is set when switching to a saved account: only that account's
// passkeys are allowed. Empty means "whichever passkey the phone offers".
type PasskeyBeginLoginRequest struct {
	UserID string `json:"user_id" validate:"omitempty,uuid"`
}

// PasskeyFinishRequest is the body of both .../finish endpoints: the
// challenge the ceremony started with, and the phone's answer exactly as its
// passkey API returned it (RegistrationResponseJSON / AuthenticationResponseJSON).
type PasskeyFinishRequest struct {
	ChallengeID string          `json:"challenge_id" validate:"required,uuid"`
	Credential  json.RawMessage `json:"credential" validate:"required"`
	// Registration only: the device it is made on, for the Security list.
	Name string `json:"name" validate:"omitempty,max=60"`
}

// PasskeyOptionsResponse is what a .../begin endpoint returns. Options is the
// WebAuthn `publicKey` options object, to hand to the phone's passkey API
// unchanged.
type PasskeyOptionsResponse struct {
	ChallengeID uuid.UUID `json:"challenge_id"`
	Options     any       `json:"options"`
}

// PasskeyResponse is one passkey in the Security list. The credential itself
// never leaves the server.
type PasskeyResponse struct {
	ID         uuid.UUID  `json:"id"`
	Name       string     `json:"name"`
	CreatedAt  time.Time  `json:"created_at"`
	LastUsedAt *time.Time `json:"last_used_at"`
}

func NewPasskeyResponse(p *model.Passkey) PasskeyResponse {
	return PasskeyResponse{ID: p.ID, Name: p.Name, CreatedAt: p.CreatedAt, LastUsedAt: p.LastUsedAt}
}

func NewPasskeyListResponse(passkeys []*model.Passkey) []PasskeyResponse {
	out := make([]PasskeyResponse, 0, len(passkeys))
	for _, p := range passkeys {
		out = append(out, NewPasskeyResponse(p))
	}
	return out
}
