package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
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
	sessions    *SessionService
	logger      *zap.Logger
	// legacyRefreshUntil is when pre-session refresh tokens stop being
	// accepted (see Refresh). The zero value means never accepted, which is the
	// safe default: only main.go, which can read when sessions were introduced,
	// opens the window.
	legacyRefreshUntil time.Time
}

func NewAuthService(userRepo UserRepo, revokedRepo RevokedTokenRepo, tokens *TokenService, sessions *SessionService, logger *zap.Logger) *AuthService {
	return &AuthService{userRepo: userRepo, revokedRepo: revokedRepo, tokens: tokens, sessions: sessions, logger: logger}
}

// SetLegacyRefreshDeadline opens the window in which a refresh token issued
// before sessions existed is still accepted and traded for a session-bound
// pair. It should be the moment such tokens have all expired on their own:
// when sessions were introduced plus common.RefreshTokenTTL. After it, a
// session-less refresh token is by definition not one this server issued, so
// a copy forged with a leaked signing key stops working too.
func (s *AuthService) SetLegacyRefreshDeadline(t time.Time) { s.legacyRefreshUntil = t }

// Activate implements F-01 US-02. It intentionally reads the invite before
// attempting the atomic update, ONLY to pick the correct error code (404 vs
// 410) — the update's own WHERE clause remains the sole authority on whether
// activation actually succeeds, so this does not reintroduce the TOCTOU race
// plan.md's Edge Case #1 warns against (see the comment inline below).
//
// The username (tên đăng nhập, mig 030) is chosen here, once: it is required,
// normalized to lowercase, and a clash with another live account is 409
// USERNAME_TAKEN with the invite left unused, so the same link can try again.
func (s *AuthService) Activate(ctx context.Context, token, username, fullName, password, passwordConfirm string) (*model.User, string, string, error) {
	username = common.NormalizeUsername(username)
	if problem := common.UsernameProblem(username); problem != "" {
		return nil, "", "", common.NewInvalidUsernameError(problem)
	}
	if len(password) < common.MinPasswordLength {
		return nil, "", "", common.NewWeakPasswordError(fmt.Sprintf("Mật khẩu cần ít nhất %d ký tự.", common.MinPasswordLength))
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
	activated, err := s.userRepo.ActivateUser(ctx, token, username, fullNamePtr, string(hash))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, "", "", common.ErrNotFound
		}
		// The only unique index this UPDATE can hit is the username one.
		if isUniqueViolation(err) {
			return nil, "", "", common.ErrUsernameTaken
		}
		return nil, "", "", fmt.Errorf("service.Activate: %w", err)
	}

	accessToken, refreshToken, err := s.sessions.Start(ctx, activated)
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
//
// identifier is an email or a tên đăng nhập (mig 030): anything with an "@"
// is an email, since a username cannot contain one. The signed-in user is
// returned so the client learns the account's email even when the username
// was typed.
func (s *AuthService) Login(ctx context.Context, identifier, password string) (*model.User, string, string, error) {
	user, err := s.loginUser(ctx, identifier)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			_ = bcrypt.CompareHashAndPassword(dummyPasswordHash, []byte(password))
			return nil, "", "", common.ErrInvalidCredentials
		}
		return nil, "", "", fmt.Errorf("service.Login: %w", err)
	}

	switch user.Status {
	case model.UserStatusRequested:
		return nil, "", "", common.ErrAccountAwaitingApproval
	case model.UserStatusPending:
		return nil, "", "", common.ErrAccountNotActive
	case model.UserStatusDisabled:
		return nil, "", "", common.ErrAccountDisabled
	}

	if user.PasswordHash == nil {
		// Defensive: an active user should always have a password hash set
		// at activation time. Treat as invalid credentials rather than panic.
		_ = bcrypt.CompareHashAndPassword(dummyPasswordHash, []byte(password))
		return nil, "", "", common.ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(password)); err != nil {
		return nil, "", "", common.ErrInvalidCredentials
	}

	accessToken, refreshToken, err := s.sessions.Start(ctx, user)
	if err != nil {
		return nil, "", "", fmt.Errorf("service.Login: %w", err)
	}
	return user, accessToken, refreshToken, nil
}

func (s *AuthService) loginUser(ctx context.Context, identifier string) (*model.User, error) {
	if strings.Contains(identifier, "@") {
		return s.userRepo.GetUserByEmail(ctx, common.NormalizeEmail(identifier))
	}
	return s.userRepo.GetUserByUsername(ctx, common.NormalizeUsername(identifier))
}

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
func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (accessToken string, newRefreshToken string, err error) {
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
		return s.sessions.Refresh(ctx, user, info)
	}

	accessToken, newRefreshToken, err = s.sessions.Start(ctx, user)
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
