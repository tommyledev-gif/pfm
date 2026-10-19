package service

import (
	"context"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// ChangePassword replaces the caller's password after checking the current
// one (specs/mobile-account-switch US-11). It is a sign-out everywhere with a
// new password: the new hash and the sign-out point are written in one
// statement, every session of the user ends (password_changed), and the
// calling device gets a fresh session so it stays signed in. Every other
// device — and every account saved on one — needs the new password (or a
// passkey) to get back in.
//
// Stale access (granted before an earlier sign-out) is refused like
// RevokeAllForSelf does, so a phone already signed out cannot change the
// password back.
func (s *SessionRevocationService) ChangePassword(ctx context.Context, callerID uuid.UUID, callerIssuedAt *jwt.NumericDate, currentPassword, newPassword string, device *model.SessionDevice) (*SwitchSession, error) {
	user, err := s.switches.activeUser(ctx, callerID, callerIssuedAt)
	if err != nil {
		return nil, fmt.Errorf("service.ChangePassword: %w", err)
	}
	if user.PasswordHash == nil || bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(currentPassword)) != nil {
		return nil, common.ErrWrongCurrentPassword
	}
	if len(newPassword) < common.MinPasswordLength {
		return nil, common.NewWeakPasswordError(fmt.Sprintf("Mật khẩu mới cần ít nhất %d ký tự.", common.MinPasswordLength))
	}
	if newPassword == currentPassword {
		return nil, common.ErrSamePassword
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), common.BcryptCost)
	if err != nil {
		return nil, fmt.Errorf("service.ChangePassword: hash password: %w", err)
	}
	changed, err := s.userRepo.ChangePassword(ctx, user.ID, string(hash), revocationPointNow())
	if err != nil {
		return nil, fmt.Errorf("service.ChangePassword: %w", err)
	}
	if !changed {
		return nil, common.ErrUnauthenticated
	}

	// The password is changed from here on, so a failure must not answer as
	// if it were not. Ending the sessions is belt and braces: the sign-out
	// point just written already refuses every credential issued before it
	// (JWTAuth and Refresh both check it); this only makes them show as ended.
	if err := s.sessions.EndAll(ctx, user.ID, model.SessionRevokedPasswordChanged); err != nil {
		s.logger.Error("service.ChangePassword: could not end the old sessions", zap.String("user_id", user.ID.String()), zap.Error(err))
	}
	// Generated after the write, so its iat is never before the new point. No
	// switch token: any build that can call this endpoint saves accounts as
	// device-bound sessions.
	session, err := s.switches.newSession(ctx, user, device, false)
	if err != nil {
		return nil, fmt.Errorf("service.ChangePassword: %w", err)
	}
	return session, nil
}
