package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// ListDevices returns the user's live sessions — one per device they are
// signed in on, or saved as a switchable account on — most recently used
// first (specs/mobile-account-switch US-10).
func (s *SessionService) ListDevices(ctx context.Context, userID uuid.UUID) ([]model.SessionSummary, error) {
	sessions, err := s.repo.ListLive(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.SessionService.ListDevices: %w", err)
	}
	return sessions, nil
}

// SignOutDevice ends one of the user's sessions from another device — the
// remedy for a lost phone. Its access stops at its next request, its refresh
// is refused, and the account saved on it needs signing in again.
//
// The caller's own session is refused (they log out instead, which also
// tidies the device), a session that is not theirs is 404 whether or not it
// exists, and one already over is a successful no-op.
func (s *SessionService) SignOutDevice(ctx context.Context, userID, currentSessionID, targetID uuid.UUID) error {
	if targetID == currentSessionID {
		return common.NewInvalidInputError("use POST /auth/logout to sign out this device")
	}
	session, err := s.repo.Get(ctx, targetID)
	if errors.Is(err, pgx.ErrNoRows) {
		return common.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("service.SessionService.SignOutDevice: %w", err)
	}
	if session.UserID != userID {
		return common.ErrNotFound
	}
	if _, err := s.repo.Revoke(ctx, targetID, userID, model.SessionRevokedDeviceSignOut); err != nil {
		return fmt.Errorf("service.SessionService.SignOutDevice: %w", err)
	}
	return nil
}
