package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// SwitchSession is what a successful switch (or self sign-out-everywhere)
// hands back: a fresh session pair, the identity the device shows on its
// saved-account row and — for a client that sent no device id, i.e. an app
// build from before device-bound sessions — a fresh switch token. Newer
// builds keep the session itself as the saved account, so SwitchToken is
// empty for them.
type SwitchSession struct {
	User                 *model.User
	AccessToken          string
	RefreshToken         string
	SwitchToken          string
	SwitchTokenExpiresAt time.Time
}

// AccountSwitchService issues, redeems and revokes account-switch tokens
// (specs/mobile-account-switch US-01/02/04/06). Every write is one atomic
// statement, so no DB transaction is needed (plan.md Finding #15).
//
// Deprecated 2026-10-19 for new app builds, which switch by refreshing the
// saved account's own device-bound session. Kept so older builds keep
// working, and so a newer build can trade the switch tokens it still holds
// for sessions once (Switch with a device).
type AccountSwitchService struct {
	userRepo    UserRepo
	revokedRepo RevokedTokenRepo
	tokens      *TokenService
	sessions    *SessionService
	logger      *zap.Logger
}

func NewAccountSwitchService(userRepo UserRepo, revokedRepo RevokedTokenRepo, tokens *TokenService, sessions *SessionService, logger *zap.Logger) *AccountSwitchService {
	return &AccountSwitchService{userRepo: userRepo, revokedRepo: revokedRepo, tokens: tokens, sessions: sessions, logger: logger}
}

// Issue mints a switch token for the authenticated caller. Refused when the
// caller is no longer active or their access token predates a
// sign-out-everywhere (plan.md Finding #19, spec S-ASW-66).
func (s *AccountSwitchService) Issue(ctx context.Context, callerID uuid.UUID, callerIssuedAt *jwt.NumericDate) (*model.User, string, time.Time, error) {
	user, err := s.activeUser(ctx, callerID, callerIssuedAt)
	if err != nil {
		return nil, "", time.Time{}, fmt.Errorf("service.AccountSwitch.Issue: %w", err)
	}
	token, expiresAt, err := s.tokens.IssueSwitchToken(user.ID)
	if err != nil {
		return nil, "", time.Time{}, fmt.Errorf("service.AccountSwitch.Issue: %w", err)
	}
	return user, token, expiresAt, nil
}

// Switch redeems a switch token: parse → user (active, not signed out
// everywhere since) → atomic single-use claim → new pair (+ a rotated switch
// token only for a client without a device id). A refused token is never
// claimed, so it is not consumed by the refusal. Every refusal is the same
// 401 — the reason is never leaked.
func (s *AccountSwitchService) Switch(ctx context.Context, switchToken string, device *model.SessionDevice) (*SwitchSession, error) {
	claims, err := s.tokens.ParseSwitchToken(switchToken)
	if errors.Is(err, jwt.ErrTokenMalformed) {
		return nil, common.NewInvalidInputError("switch token is malformed")
	}
	if err != nil {
		return nil, common.ErrUnauthenticated
	}

	user, err := s.activeUser(ctx, claims.UserID, claims.IssuedAt)
	if err != nil {
		return nil, fmt.Errorf("service.AccountSwitch.Switch: %w", err)
	}

	claimed, err := s.revokedRepo.Claim(ctx, claims.JTI, &claims.UserID, claims.ExpiresAt)
	if err != nil {
		return nil, fmt.Errorf("service.AccountSwitch.Switch: %w", err)
	}
	if !claimed {
		s.logger.Info("account switch refused: token already used or revoked", zap.String("jti", claims.JTI))
		return nil, common.ErrUnauthenticated
	}

	session, err := s.newSession(ctx, user, device, wantsSwitchToken(device))
	if err != nil {
		// The token was claimed (single use) but nothing came of it. Give it
		// back, or the client's retry would be refused and the account marked
		// expired, forcing a password login over what was only a hiccup.
		if releaseErr := s.revokedRepo.Release(ctx, claims.JTI); releaseErr != nil {
			s.logger.Error("account switch: could not release a claimed switch token", zap.String("jti", claims.JTI), zap.Error(releaseErr))
		}
		return nil, fmt.Errorf("service.AccountSwitch.Switch: %w", err)
	}
	return session, nil
}

// Revoke invalidates a switch token. Idempotent and session-free (logout,
// remove-from-device, replaced token); an already expired token succeeds.
func (s *AccountSwitchService) Revoke(ctx context.Context, switchToken string) error {
	claims, err := s.tokens.ParseSwitchTokenUnverified(switchToken)
	if err != nil {
		return common.NewInvalidInputError("switch token is malformed")
	}
	if err := s.revokedRepo.Revoke(ctx, claims.JTI, &claims.UserID, claims.ExpiresAt); err != nil {
		return fmt.Errorf("service.AccountSwitch.Revoke: %w", err)
	}
	return nil
}

// newSession opens a session for an already verified user on the calling
// device and issues its token pair, plus a switch token when asked for one.
// Shared with SessionRevocationService.RevokeAllForSelf and ChangePassword.
func (s *AccountSwitchService) newSession(ctx context.Context, user *model.User, device *model.SessionDevice, withSwitchToken bool) (*SwitchSession, error) {
	access, refresh, err := s.sessions.Start(ctx, user, device)
	if err != nil {
		return nil, fmt.Errorf("newSession: %w", err)
	}
	session := &SwitchSession{User: user, AccessToken: access, RefreshToken: refresh}
	if !withSwitchToken {
		return session, nil
	}
	session.SwitchToken, session.SwitchTokenExpiresAt, err = s.tokens.IssueSwitchToken(user.ID)
	if err != nil {
		return nil, fmt.Errorf("newSession: %w", err)
	}
	return session, nil
}

// activeUser loads the user and applies the gates shared by every
// credential-minting path: must exist, be active, and the presented
// token's iat must not predate the sign-out-everywhere point. Refusals are
// *common.AppError (401) and survive %w wrapping for response.Error.
func (s *AccountSwitchService) activeUser(ctx context.Context, userID uuid.UUID, issuedAt *jwt.NumericDate) (*model.User, error) {
	user, err := s.userRepo.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, common.ErrUnauthenticated
		}
		return nil, err
	}
	if user.Status != model.UserStatusActive {
		return nil, common.ErrUnauthenticated
	}
	if issuedBeforeRevocation(issuedAt, user.TokensValidAfter) {
		return nil, common.ErrUnauthenticated
	}
	return user, nil
}

// wantsSwitchToken: only a client that sends no device id — an app build from
// before device-bound sessions — still saves accounts by switch token. Every
// newer build sends one and keeps the session itself instead.
func wantsSwitchToken(device *model.SessionDevice) bool {
	return device == nil
}
