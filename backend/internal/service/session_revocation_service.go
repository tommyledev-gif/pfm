package service

import (
	"context"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// SessionRevocationService implements "sign out everywhere"
// (specs/mobile-account-switch US-08 self, US-09 admin) in two steps: it
// moves the user's tokens_valid_after point, which refuses every refresh and
// switch token issued before it (AuthService.Refresh /
// AccountSwitchService.Switch), and it revokes the user's sessions, which
// stops their access tokens at the next request instead of when they run out
// (the spec's EC-20 said they would simply run out).
type SessionRevocationService struct {
	userRepo UserRepo
	switches *AccountSwitchService
	sessions *SessionService
	logger   *zap.Logger
}

func NewSessionRevocationService(userRepo UserRepo, switches *AccountSwitchService, sessions *SessionService, logger *zap.Logger) *SessionRevocationService {
	return &SessionRevocationService{userRepo: userRepo, switches: switches, sessions: sessions, logger: logger}
}

// RevokeAllForSelf signs the caller out everywhere and returns a fresh
// session for the requesting device (BR-12) — plus a switch token for an
// older build that sends no device id. The fresh
// credentials are generated AFTER the write, so their iat is never before
// the stored point (plan.md Finding #18). Stale access (granted before an
// earlier sign-out) is refused, so a lost device cannot undo the owner's
// sign-out (S-ASW-63).
func (s *SessionRevocationService) RevokeAllForSelf(ctx context.Context, callerID uuid.UUID, callerIssuedAt *jwt.NumericDate, device *model.SessionDevice) (*SwitchSession, error) {
	user, err := s.switches.activeUser(ctx, callerID, callerIssuedAt)
	if err != nil {
		return nil, fmt.Errorf("service.RevokeAllForSelf: %w", err)
	}

	updated, err := s.userRepo.SetTokensValidAfter(ctx, user.ID, revocationPointNow())
	if err != nil {
		return nil, fmt.Errorf("service.RevokeAllForSelf: %w", err)
	}
	if !updated {
		return nil, common.ErrUnauthenticated
	}

	if err := s.sessions.EndAll(ctx, user.ID, model.SessionRevokedSignOutAll); err != nil {
		return nil, fmt.Errorf("service.RevokeAllForSelf: %w", err)
	}

	session, err := s.switches.newSession(ctx, user, device, wantsSwitchToken(device))
	if err != nil {
		return nil, fmt.Errorf("service.RevokeAllForSelf: %w", err)
	}
	return session, nil
}

// RevokeAllForUser lets an admin sign another user out everywhere (US-09).
// The admin role is enforced by the /admin route group; this layer refuses
// a self target (self goes through RevokeAllForSelf so the device keeps a
// fresh pair) and reports an unknown/soft-deleted target as 404. Any admin
// may target any other user, including another admin (spec EC-22).
func (s *SessionRevocationService) RevokeAllForUser(ctx context.Context, adminID, targetID uuid.UUID) error {
	if adminID == targetID {
		return common.NewInvalidInputError("use POST /auth/sessions/revoke-all to sign yourself out everywhere")
	}
	updated, err := s.userRepo.SetTokensValidAfter(ctx, targetID, revocationPointNow())
	if err != nil {
		return fmt.Errorf("service.RevokeAllForUser: %w", err)
	}
	if !updated {
		return common.ErrNotFound
	}
	if err := s.sessions.EndAll(ctx, targetID, model.SessionRevokedAdmin); err != nil {
		return fmt.Errorf("service.RevokeAllForUser: %w", err)
	}
	return nil
}
