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

// AuthService's session-token lifecycle: renewing a session (Refresh) and
// ending it (Logout). Split from auth_service.go (300-line rule).

// Refresh implements the session-refresh extension to F-02
// (specs/mobile-session-refresh/spec.md US-01). It rotates the presented
// refresh token: the new pair is generated *before* the old token is
// revoked (spec.md Edge Case #1) so a mid-request failure never leaves the
// caller with no valid credentials at all — worst case, the old token
// simply outlives its intended single use by the remainder of its own TTL.
//
// A refresh token carrying a `sid` belongs to a session: SessionService
// rotates it, detects replay of an old one, and enforces the session's
// lifetime. A token without one predates sessions (mig 028); it is accepted
// once, on the old deny-list rules, and traded for a session-bound pair, so
// nobody is signed out by the upgrade. The branch closes by itself at
// legacyRefreshUntil, when every pre-session refresh token has expired, and
// can be deleted after that.
//
// device is the calling phone, recorded on a session that has none yet. On
// mobile this is also how an account saved on the device is switched to: its
// own session is refreshed.
func (s *AuthService) Refresh(ctx context.Context, refreshToken string, device *model.SessionDevice) (accessToken string, newRefreshToken string, err error) {
	// Signature, expiry and token kind are all checked here; a forged,
	// expired or non-refresh token is simply unauthenticated.
	info, err := s.tokens.ParseRefreshToken(refreshToken)
	if errors.Is(err, jwt.ErrTokenMalformed) {
		return "", "", common.NewInvalidInputError("refresh token is malformed")
	}
	if err != nil {
		return "", "", common.ErrUnauthenticated
	}
	legacy := info.SessionID == ""

	if legacy {
		if !time.Now().Before(s.legacyRefreshUntil) {
			return "", "", common.ErrUnauthenticated
		}
		revoked, err := s.revokedRepo.IsRevoked(ctx, info.JTI)
		if err != nil {
			return "", "", fmt.Errorf("service.Refresh: %w", err)
		}
		if revoked {
			return "", "", common.ErrUnauthenticated
		}
	}

	userID, err := uuid.Parse(info.Subject)
	if err != nil {
		return "", "", common.ErrUnauthenticated
	}
	user, err := s.userRepo.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", common.ErrUnauthenticated
		}
		return "", "", fmt.Errorf("service.Refresh: %w", err)
	}
	if user.Status != model.UserStatusActive {
		return "", "", common.ErrUnauthenticated
	}
	// Sign out everywhere (specs/mobile-account-switch BR-11): a refresh
	// chain started before the user's sign-out point ends here.
	if issuedBeforeRevocation(info.IssuedAt, user.TokensValidAfter) {
		return "", "", common.ErrUnauthenticated
	}

	if !legacy {
		return s.sessions.Refresh(ctx, user, info, device)
	}

	accessToken, newRefreshToken, err = s.sessions.Start(ctx, user, device)
	if err != nil {
		return "", "", fmt.Errorf("service.Refresh: %w", err)
	}

	// Revoke only after the new pair is safely generated — a failure here is
	// logged, not returned, since the caller already holds usable
	// credentials (plan.md Pre-flight Finding #1).
	if err := s.revokedRepo.Revoke(ctx, info.JTI, &userID, info.ExpiresAt); err != nil {
		s.logger.Error("service.Refresh: failed to revoke rotated refresh token", zap.String("jti", info.JTI), zap.Error(err))
	}

	return accessToken, newRefreshToken, nil
}

// Logout implements F-02 US-05. Revocation is a conflict-safe upsert, so
// double-logout and logout-with-an-expired-token are both harmless no-op
// successes by construction — see repository.RevokedTokenRepository.Revoke.
//
// A refresh token that verifies and belongs to a session ends that session
// (its access token stops working at once too). Anything else — a pre-session
// token, an expired or unverifiable one — takes the old path: its jti goes on
// the deny-list.
func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	if info, err := s.tokens.ParseRefreshToken(refreshToken); err == nil && info.SessionID != "" {
		sessionID, sidErr := uuid.Parse(info.SessionID)
		userID, uidErr := uuid.Parse(info.Subject)
		if sidErr == nil && uidErr == nil {
			if err := s.sessions.End(ctx, sessionID, userID, model.SessionRevokedLogout); err != nil {
				return fmt.Errorf("service.Logout: %w", err)
			}
			return nil
		}
	}

	jti, subject, expiresAt, err := s.tokens.ParseRefreshTokenUnverified(refreshToken)
	if err != nil {
		return common.NewInvalidInputError("refresh token is malformed")
	}

	var userID *uuid.UUID
	if parsed, parseErr := uuid.Parse(subject); parseErr == nil {
		userID = &parsed
	} else {
		s.logger.Warn("logout: refresh token subject is not a valid UUID, revoking without user_id link")
	}

	if err := s.revokedRepo.Revoke(ctx, jti, userID, expiresAt); err != nil {
		return fmt.Errorf("service.Logout: %w", err)
	}
	return nil
}
