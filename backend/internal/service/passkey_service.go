package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// PasskeyRepo is the data access PasskeyService needs (PasskeyRepository).
type PasskeyRepo interface {
	Create(ctx context.Context, userID uuid.UUID, credentialID, credential []byte, name string) (*model.Passkey, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]*model.Passkey, error)
	GetByCredentialID(ctx context.Context, credentialID []byte) (*model.Passkey, error)
	CountByUser(ctx context.Context, userID uuid.UUID) (int64, error)
	Touch(ctx context.Context, id, userID uuid.UUID, credential []byte) error
	Delete(ctx context.Context, id, userID uuid.UUID) (bool, error)
	CreateChallenge(ctx context.Context, userID *uuid.UUID, purpose model.PasskeyChallengePurpose, session []byte, expiresAt time.Time) (uuid.UUID, error)
	ConsumeChallenge(ctx context.Context, id uuid.UUID, purpose model.PasskeyChallengePurpose) (*uuid.UUID, []byte, error)
}

// PasskeyRelyingParty is the passkey half of the server config.
type PasskeyRelyingParty struct {
	ID string
	// Origins are https origins; AndroidOrigins are "android:apk-key-hash:…".
	Origins        []string
	AndroidOrigins []string
}

// PasskeyService owns passkeys (WebAuthn, mig 032): registering one to the
// signed-in account, signing in with one, and listing/removing them. A
// passkey sign-in starts a session exactly like a password one
// (SessionService.Start), so the session limit, `sid` and revocation all
// apply unchanged.
type PasskeyService struct {
	wa       *webauthn.WebAuthn // nil: passkeys are off (no relying party configured)
	repo     PasskeyRepo
	users    UserRepo
	sessions *SessionService
	logger   *zap.Logger
	now      func() time.Time
}

// NewPasskeyService builds the service; rp nil turns passkeys off, and every
// method then returns ErrPasskeysUnavailable.
func NewPasskeyService(rp *PasskeyRelyingParty, repo PasskeyRepo, users UserRepo, sessions *SessionService, logger *zap.Logger) (*PasskeyService, error) {
	s := &PasskeyService{repo: repo, users: users, sessions: sessions, logger: logger, now: time.Now}
	if rp == nil {
		return s, nil
	}
	wa, err := webauthn.New(&webauthn.Config{
		RPID:            rp.ID,
		RPDisplayName:   common.PasskeyRPDisplayName,
		RPOrigins:       rp.Origins,
		RPOpaqueOrigins: rp.AndroidOrigins,
		// Nobody here verifies device makers: attestation would only be
		// collected and ignored.
		AttestationPreference: protocol.PreferNoAttestation,
		AuthenticatorSelection: protocol.AuthenticatorSelection{
			// Discoverable, so sign-in needs no username: the phone offers
			// the passkeys it holds for this app.
			ResidentKey:        protocol.ResidentKeyRequirementRequired,
			RequireResidentKey: protocol.ResidentKeyRequired(),
			// The fingerprint/face/PIN is the point — never presence alone.
			UserVerification: protocol.VerificationRequired,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("service.NewPasskeyService: %w", err)
	}
	s.wa = wa
	return s, nil
}

// Enabled reports whether a relying party is configured.
func (s *PasskeyService) Enabled() bool { return s.wa != nil }

// BeginRegistration starts adding a passkey to the signed-in user. The
// returned options go to the phone's passkey API as they are; the challenge
// id comes back with its answer.
func (s *PasskeyService) BeginRegistration(ctx context.Context, userID uuid.UUID) (uuid.UUID, protocol.PublicKeyCredentialCreationOptions, error) {
	var none protocol.PublicKeyCredentialCreationOptions
	if !s.Enabled() {
		return uuid.Nil, none, common.ErrPasskeysUnavailable
	}
	user, existing, err := s.loadUser(ctx, userID)
	if err != nil {
		return uuid.Nil, none, fmt.Errorf("service.PasskeyService.BeginRegistration: %w", err)
	}
	if len(existing.creds) >= common.MaxPasskeysPerUser {
		return uuid.Nil, none, common.ErrPasskeyLimit
	}
	// The phone refuses to make a second passkey where it already holds one
	// for this account, instead of silently stacking duplicates.
	exclusions := make([]protocol.CredentialDescriptor, 0, len(existing.creds))
	for _, c := range existing.creds {
		exclusions = append(exclusions, c.Descriptor())
	}
	creation, session, err := s.wa.BeginRegistration(existing, webauthn.WithExclusions(exclusions))
	if err != nil {
		return uuid.Nil, none, fmt.Errorf("service.PasskeyService.BeginRegistration: %w", err)
	}
	id, err := s.storeChallenge(ctx, &user.ID, model.PasskeyChallengeRegister, session)
	if err != nil {
		return uuid.Nil, none, fmt.Errorf("service.PasskeyService.BeginRegistration: %w", err)
	}
	return id, creation.Response, nil
}

// FinishRegistration verifies the phone's answer and stores the passkey.
// Any verification failure is ErrPasskeyFailed: the reason is logged, never
// returned.
func (s *PasskeyService) FinishRegistration(ctx context.Context, userID, challengeID uuid.UUID, credentialJSON []byte, name string) (*model.Passkey, error) {
	if !s.Enabled() {
		return nil, common.ErrPasskeysUnavailable
	}
	session, owner, err := s.consumeChallenge(ctx, challengeID, model.PasskeyChallengeRegister)
	if err != nil {
		return nil, err
	}
	// A challenge started by one account can never be finished by another.
	if owner == nil || *owner != userID {
		return nil, common.ErrPasskeyFailed
	}
	_, existing, err := s.loadUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.PasskeyService.FinishRegistration: %w", err)
	}
	parsed, err := protocol.ParseCredentialCreationResponseBytes(credentialJSON)
	if err != nil {
		s.logger.Warn("passkey registration: unreadable response", zap.Error(err))
		return nil, common.ErrPasskeyFailed
	}
	credential, err := s.wa.CreateCredential(existing, *session, parsed)
	if err != nil {
		s.logger.Warn("passkey registration rejected", zap.Error(err))
		return nil, common.ErrPasskeyFailed
	}
	record, err := json.Marshal(credential)
	if err != nil {
		return nil, fmt.Errorf("service.PasskeyService.FinishRegistration: %w", err)
	}
	passkey, err := s.repo.Create(ctx, userID, credential.ID, record, passkeyName(name))
	if err != nil {
		if isUniqueViolation(err) {
			return nil, common.ErrPasskeyFailed
		}
		return nil, fmt.Errorf("service.PasskeyService.FinishRegistration: %w", err)
	}
	return passkey, nil
}

// List returns the signed-in user's passkeys, newest first.
func (s *PasskeyService) List(ctx context.Context, userID uuid.UUID) ([]*model.Passkey, error) {
	passkeys, err := s.repo.ListByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.PasskeyService.List: %w", err)
	}
	return passkeys, nil
}

// Delete removes one of the signed-in user's own passkeys. Someone else's id
// is "not found", same as an unknown one.
func (s *PasskeyService) Delete(ctx context.Context, userID, passkeyID uuid.UUID) error {
	deleted, err := s.repo.Delete(ctx, passkeyID, userID)
	if err != nil {
		return fmt.Errorf("service.PasskeyService.Delete: %w", err)
	}
	if !deleted {
		return common.ErrPasskeyNotFound
	}
	return nil
}

func (s *PasskeyService) storeChallenge(ctx context.Context, userID *uuid.UUID, purpose model.PasskeyChallengePurpose, session *webauthn.SessionData) (uuid.UUID, error) {
	raw, err := json.Marshal(session)
	if err != nil {
		return uuid.Nil, err
	}
	return s.repo.CreateChallenge(ctx, userID, purpose, raw, s.now().Add(common.PasskeyChallengeTTL))
}

// consumeChallenge takes a challenge out of the store (single use). Unknown,
// expired, used or wrong-purpose all read as ErrPasskeyFailed.
func (s *PasskeyService) consumeChallenge(ctx context.Context, id uuid.UUID, purpose model.PasskeyChallengePurpose) (*webauthn.SessionData, *uuid.UUID, error) {
	owner, raw, err := s.repo.ConsumeChallenge(ctx, id, purpose)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, common.ErrPasskeyFailed
		}
		return nil, nil, fmt.Errorf("service.PasskeyService.consumeChallenge: %w", err)
	}
	var session webauthn.SessionData
	if err := json.Unmarshal(raw, &session); err != nil {
		return nil, nil, fmt.Errorf("service.PasskeyService.consumeChallenge: %w", err)
	}
	return &session, owner, nil
}

// loadUser returns the user and the WebAuthn view of them (with credentials).
func (s *PasskeyService) loadUser(ctx context.Context, userID uuid.UUID) (*model.User, *passkeyUser, error) {
	user, err := s.users.GetUserByID(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	passkeys, err := s.repo.ListByUser(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	return user, newPasskeyUser(user, passkeys), nil
}

func passkeyName(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return "Điện thoại"
	}
	if runes := []rune(name); len(runes) > common.PasskeyNameMaxLength {
		return string(runes[:common.PasskeyNameMaxLength])
	}
	return name
}
