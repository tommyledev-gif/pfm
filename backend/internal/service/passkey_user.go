package service

import (
	"bytes"
	"encoding/json"

	"github.com/go-webauthn/webauthn/webauthn"

	"github.com/example/pfm/backend/internal/model"
)

// passkeyUser is the WebAuthn library's view of a user: the account's UUID
// as its user handle (opaque, never personal data), a name for the phone's
// passkey list, and the passkeys registered to it.
type passkeyUser struct {
	user    *model.User
	creds   []webauthn.Credential
	records []*model.Passkey // parallel to creds
}

func newPasskeyUser(user *model.User, passkeys []*model.Passkey) *passkeyUser {
	u := &passkeyUser{user: user}
	for _, p := range passkeys {
		var c webauthn.Credential
		// A record that no longer decodes cannot sign anyone in; skipping it
		// beats failing every ceremony for the account.
		if err := json.Unmarshal(p.Credential, &c); err != nil {
			continue
		}
		u.creds = append(u.creds, c)
		u.records = append(u.records, p)
	}
	return u
}

func (u *passkeyUser) WebAuthnID() []byte {
	id := u.user.ID
	return id[:]
}

// WebAuthnName is the account as the phone lists it: the tên đăng nhập when
// there is one, else the email.
func (u *passkeyUser) WebAuthnName() string {
	if u.user.Username != nil && *u.user.Username != "" {
		return *u.user.Username
	}
	return u.user.Email
}

func (u *passkeyUser) WebAuthnDisplayName() string {
	if u.user.FullName != nil && *u.user.FullName != "" {
		return *u.user.FullName
	}
	return u.WebAuthnName()
}

func (u *passkeyUser) WebAuthnCredentials() []webauthn.Credential { return u.creds }

// recordFor is the stored row behind a credential id, or nil.
func (u *passkeyUser) recordFor(credentialID []byte) *model.Passkey {
	for i, c := range u.creds {
		if bytes.Equal(c.ID, credentialID) {
			return u.records[i]
		}
	}
	return nil
}
