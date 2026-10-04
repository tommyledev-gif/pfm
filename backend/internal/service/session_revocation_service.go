package service

import (
	"context"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
)

// SessionRevocationService implements "sign out everywhere"
// (specs/mobile-account-switch US-08 self, US-09 admin) by moving the
// user's tokens_valid_after point. Refresh and switch tokens issued before
// it are refused by AuthService.Refresh / AccountSwitchService.Switch;
// access tokens simply run out (spec EC-20).
type SessionRevocationService struct {
	userRepo UserRepo
	switches *AccountSwitchService
	logger   *zap.Logger
}

func NewSessionRevocationService(userRepo UserRepo, switches *AccountSwitchService, logger *zap.Logger) *SessionRevocationService {
	return &SessionRevocationService{userRepo: userRepo, switches: switches, logger: logger}
}

// RevokeAllForSelf signs the caller out everywhere and returns a fresh
// session + switch token for the requesting device (BR-12). The fresh
// credentials are generated AFTER the write, so their iat is never before
// the stored point (plan.md Finding #18). Stale access (granted before an
// earlier sign-out) is refused, so a lost device cannot undo the owner's
// sign-out (S-ASW-63).
func (s *SessionRevocationService) RevokeAllForSelf(ctx context.Context, callerID uuid.UUID, callerIssuedAt *jwt.NumericDate) (*SwitchSession, error) {
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

	session, err := s.switches.newSession(user)
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
	return nil
}
