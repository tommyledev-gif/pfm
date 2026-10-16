package model

import (
	"time"

	"github.com/google/uuid"
)

// Passkey is one WebAuthn credential registered to a user (032_passkeys.sql).
// Credential is the WebAuthn library's own record, serialized — the domain
// layer never looks inside it.
type Passkey struct {
	ID           uuid.UUID
	UserID       uuid.UUID
	CredentialID []byte
	Credential   []byte
	Name         string
	CreatedAt    time.Time
	LastUsedAt   *time.Time
}

// PasskeyChallengePurpose says which ceremony a stored challenge belongs to,
// so one started for registering can never finish a sign-in.
type PasskeyChallengePurpose string

const (
	PasskeyChallengeRegister PasskeyChallengePurpose = "register"
	PasskeyChallengeLogin    PasskeyChallengePurpose = "login"
)
