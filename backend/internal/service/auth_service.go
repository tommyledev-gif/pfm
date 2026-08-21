package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// dummyPasswordHash is compared against on a "no such user" login so the
// response time for "email not found" matches "wrong password on an
// existing account" — both do exactly one bcrypt compare. Without this, an
// attacker could distinguish the two cases by response latency even though
// the response *bodies* are identical (spec.md Edge Case #1).
var dummyPasswordHash []byte

func init() {
	hash, err := bcrypt.GenerateFromPassword([]byte("pfm-timing-equalization-placeholder"), common.BcryptCost)
	if err != nil {
		panic(fmt.Sprintf("service: failed to precompute dummy password hash: %v", err))
	}
	dummyPasswordHash = hash
}

// AuthService owns Login/Logout (F-02) and Activate (F-01 US-02) — grouped
// together because all three issue or manage the same JWT token pair, per
// plan.md's Pre-flight Finding #3 in the user-management plan.
type AuthService struct {
	userRepo    UserRepo
	revokedRepo RevokedTokenRepo
	tokens      *TokenService
	logger      *zap.Logger
}

func NewAuthService(userRepo UserRepo, revokedRepo RevokedTokenRepo, tokens *TokenService, logger *zap.Logger) *AuthService {
	return &AuthService{userRepo: userRepo, revokedRepo: revokedRepo, tokens: tokens, logger: logger}
}

// Activate implements F-01 US-02. It intentionally reads the invite before
// attempting the atomic update, ONLY to pick the correct error code (404 vs
// 410) — the update's own WHERE clause remains the sole authority on whether
// activation actually succeeds, so this does not reintroduce the TOCTOU race
// plan.md's Edge Case #1 warns against (see the comment inline below).
func (s *AuthService) Activate(ctx context.Context, token, fullName, password, passwordConfirm string) (*model.User, string, string, error) {
	if len(password) < common.MinPasswordLength {
		return nil, "", "", common.NewWeakPasswordError(fmt.Sprintf("password must be at least %d characters", common.MinPasswordLength))
	}
	if password != passwordConfirm {
		return nil, "", "", common.ErrPasswordMismatch
	}

	existing, err := s.userRepo.GetUserByInviteToken(ctx, token)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, "", "", common.ErrNotFound
		}
		return nil, "", "", fmt.Errorf("service.Activate: %w", err)
	}
	if existing.InviteExpiresAt == nil || existing.InviteExpiresAt.Before(time.Now().UTC()) {
		return nil, "", "", common.ErrTokenExpired
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), common.BcryptCost)
	if err != nil {
		return nil, "", "", fmt.Errorf("service.Activate: hash password: %w", err)
	}

	var fullNamePtr *string
	if fullName != "" {
		fullNamePtr = &fullName
	}

	// The atomic UPDATE (WHERE invite_token=$1 AND status='pending' AND
	// invite_expires_at > NOW()) is what actually decides success. If a
	// concurrent request already consumed the token between the read above
	// and this call, this returns pgx.ErrNoRows and the loser gets 404 —
	// exactly the race test_cases.md TC-USR-26 exercises.
	activated, err := s.userRepo.ActivateUser(ctx, token, fullNamePtr, string(hash))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, "", "", common.ErrNotFound
		}
		return nil, "", "", fmt.Errorf("service.Activate: %w", err)
	}

	accessToken, refreshToken, err := s.tokens.GenerateTokenPair(activated)
	if err != nil {
		return nil, "", "", fmt.Errorf("service.Activate: %w", err)
	}

	return activated, accessToken, refreshToken, nil
}

// Login implements F-02 US-04. Status checks (pending/disabled) are allowed
// to short-circuit before the password compare — spec.md treats those as
// distinguishable from INVALID_CREDENTIALS on purpose (the invitee already
// knows their own email, so this isn't an enumeration risk). Only the
// "email not found" vs. "wrong password" pair must be timing-equivalent,
// which the dummyPasswordHash compare below provides.
func (s *AuthService) Login(ctx context.Context, email, password string) (string, string, error) {
	user, err := s.userRepo.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			_ = bcrypt.CompareHashAndPassword(dummyPasswordHash, []byte(password))
			return "", "", common.ErrInvalidCredentials
		}
		return "", "", fmt.Errorf("service.Login: %w", err)
	}

	switch user.Status {
	case model.UserStatusPending:
		return "", "", common.ErrAccountNotActive
	case model.UserStatusDisabled:
		return "", "", common.ErrAccountDisabled
	}

	if user.PasswordHash == nil {
		// Defensive: an active user should always have a password hash set
		// at activation time. Treat as invalid credentials rather than panic.
		_ = bcrypt.CompareHashAndPassword(dummyPasswordHash, []byte(password))
		return "", "", common.ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(password)); err != nil {
		return "", "", common.ErrInvalidCredentials
	}

	accessToken, refreshToken, err := s.tokens.GenerateTokenPair(user)
	if err != nil {
		return "", "", fmt.Errorf("service.Login: %w", err)
	}
	return accessToken, refreshToken, nil
}

// Refresh implements the session-refresh extension to F-02
// (specs/mobile-session-refresh/spec.md US-01). It rotates the presented
// refresh token: the new pair is generated *before* the old token is
// revoked (spec.md Edge Case #1) so a mid-request failure never leaves the
// caller with no valid credentials at all — worst case, the old token
// simply outlives its intended single use by the remainder of its own TTL.
func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (accessToken string, newRefreshToken string, err error) {
	jti, subject, expiresAt, err := s.tokens.ParseRefreshTokenUnverified(refreshToken)
	if err != nil {
		return "", "", common.NewInvalidInputError("refresh token is malformed")
	}

	if expiresAt.Before(time.Now().UTC()) {
		return "", "", common.ErrUnauthenticated
	}

	revoked, err := s.revokedRepo.IsRevoked(ctx, jti)
	if err != nil {
		return "", "", fmt.Errorf("service.Refresh: %w", err)
	}
	if revoked {
		return "", "", common.ErrUnauthenticated
	}

	userID, err := uuid.Parse(subject)
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

	accessToken, newRefreshToken, err = s.tokens.GenerateTokenPair(user)
	if err != nil {
		return "", "", fmt.Errorf("service.Refresh: %w", err)
	}

	// Revoke only after the new pair is safely generated — a failure here is
	// logged, not returned, since the caller already holds usable
	// credentials (plan.md Pre-flight Finding #1).
	if err := s.revokedRepo.Revoke(ctx, jti, &userID, expiresAt); err != nil {
		s.logger.Error("service.Refresh: failed to revoke rotated refresh token", zap.String("jti", jti), zap.Error(err))
	}

	return accessToken, newRefreshToken, nil
}

// Logout implements F-02 US-05. Revocation is a conflict-safe upsert, so
// double-logout and logout-with-an-expired-token are both harmless no-op
// successes by construction — see repository.RevokedTokenRepository.Revoke.
func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
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
