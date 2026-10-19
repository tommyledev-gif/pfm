package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

var errPasskeyOwnerMismatch = errors.New("passkey belongs to another account")

// BeginLogin starts a passkey sign-in.
//
// Without a user id it is discoverable: the phone offers every passkey it
// holds for this app, and the one picked says whose account it is. With one
// — switching to a saved account — only that account's passkeys are allowed,
// so the phone goes straight to the right one; an account with none is
// ErrPasskeyNotFound, which tells the app to fall back to its saved-account
// switch. (A user id is an unguessable UUID the device already holds, so
// this reveals nothing to anyone who does not.)
func (s *PasskeyService) BeginLogin(ctx context.Context, userID *uuid.UUID) (uuid.UUID, protocol.PublicKeyCredentialRequestOptions, error) {
	var none protocol.PublicKeyCredentialRequestOptions
	if !s.Enabled() {
		return uuid.Nil, none, common.ErrPasskeysUnavailable
	}

	var (
		assertion *protocol.CredentialAssertion
		session   *webauthn.SessionData
		err       error
	)
	if userID != nil {
		_, wu, loadErr := s.loadUser(ctx, *userID)
		if loadErr != nil {
			if errors.Is(loadErr, pgx.ErrNoRows) {
				return uuid.Nil, none, common.ErrPasskeyNotFound
			}
			return uuid.Nil, none, fmt.Errorf("service.PasskeyService.BeginLogin: %w", loadErr)
		}
		if len(wu.creds) == 0 {
			return uuid.Nil, none, common.ErrPasskeyNotFound
		}
		assertion, session, err = s.wa.BeginLogin(wu)
	} else {
		assertion, session, err = s.wa.BeginDiscoverableLogin()
	}
	if err != nil {
		return uuid.Nil, none, fmt.Errorf("service.PasskeyService.BeginLogin: %w", err)
	}

	id, err := s.storeChallenge(ctx, userID, model.PasskeyChallengeLogin, session)
	if err != nil {
		return uuid.Nil, none, fmt.Errorf("service.PasskeyService.BeginLogin: %w", err)
	}
	return id, assertion.Response, nil
}

// FinishLogin verifies the phone's assertion and starts a session for the
// passkey's owner on the calling device, with the same account-status rules
// as a password sign-in. Every verification failure is ErrPasskeyFailed; the
// reason is only logged.
func (s *PasskeyService) FinishLogin(ctx context.Context, challengeID uuid.UUID, credentialJSON []byte, device *model.SessionDevice) (*model.User, string, string, error) {
	if !s.Enabled() {
		return nil, "", "", common.ErrPasskeysUnavailable
	}
	session, expectedUser, err := s.consumeChallenge(ctx, challengeID, model.PasskeyChallengeLogin)
	if err != nil {
		return nil, "", "", err
	}
	parsed, err := protocol.ParseCredentialRequestResponseBytes(credentialJSON)
	if err != nil {
		s.logger.Warn("passkey sign-in: unreadable response", zap.Error(err))
		return nil, "", "", common.ErrPasskeyFailed
	}

	owner, credential, err := s.validateLogin(ctx, session, expectedUser, parsed)
	if err != nil {
		s.logger.Warn("passkey sign-in rejected", zap.Error(err))
		return nil, "", "", common.ErrPasskeyFailed
	}
	// The counter went backwards: two copies of one key exist. Synced
	// passkeys always report 0, which the library never flags.
	if credential.Authenticator.CloneWarning {
		s.logger.Warn("passkey sign-in: clone warning", zap.String("user_id", owner.user.ID.String()))
		return nil, "", "", common.ErrPasskeyFailed
	}

	if err := accountStatusError(owner.user); err != nil {
		return nil, "", "", err
	}
	if record := owner.recordFor(credential.ID); record != nil {
		if updated, err := json.Marshal(credential); err == nil {
			// Best effort: a failed bookkeeping write must not fail a sign-in
			// that has already been verified.
			if err := s.repo.Touch(ctx, record.ID, owner.user.ID, updated); err != nil {
				s.logger.Warn("passkey sign-in: could not update the credential", zap.Error(err))
			}
		}
	}

	accessToken, refreshToken, err := s.sessions.Start(ctx, owner.user, device)
	if err != nil {
		return nil, "", "", fmt.Errorf("service.PasskeyService.FinishLogin: %w", err)
	}
	return owner.user, accessToken, refreshToken, nil
}

// validateLogin checks the assertion against the account it was started for
// (saved-account switch), or against whichever account owns the passkey the
// phone picked (discoverable sign-in).
func (s *PasskeyService) validateLogin(ctx context.Context, session *webauthn.SessionData, expectedUser *uuid.UUID, parsed *protocol.ParsedCredentialAssertionData) (*passkeyUser, *webauthn.Credential, error) {
	if expectedUser != nil {
		_, wu, err := s.loadUser(ctx, *expectedUser)
		if err != nil {
			return nil, nil, err
		}
		credential, err := s.wa.ValidateLogin(wu, *session, parsed)
		return wu, credential, err
	}

	var owner *passkeyUser
	handler := func(rawID, userHandle []byte) (webauthn.User, error) {
		record, err := s.repo.GetByCredentialID(ctx, rawID)
		if err != nil {
			return nil, err
		}
		if len(userHandle) > 0 && !bytes.Equal(userHandle, record.UserID[:]) {
			return nil, errPasskeyOwnerMismatch
		}
		_, wu, err := s.loadUser(ctx, record.UserID)
		if err != nil {
			return nil, err
		}
		owner = wu
		return wu, nil
	}
	_, credential, err := s.wa.ValidatePasskeyLogin(handler, *session, parsed)
	if err != nil {
		return nil, nil, err
	}
	return owner, credential, nil
}

// accountStatusError mirrors AuthService.Login's status checks.
func accountStatusError(user *model.User) error {
	switch user.Status {
	case model.UserStatusRequested:
		return common.ErrAccountAwaitingApproval
	case model.UserStatusPending:
		return common.ErrAccountNotActive
	case model.UserStatusDisabled:
		return common.ErrAccountDisabled
	}
	return nil
}
