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

// SessionService owns the lifecycle of a signed-in device: opening a session
// (with the per-user limit), rotating its refresh token (with reuse
// detection and the absolute lifetime), ending it, and answering JWTAuth's
// per-request question "is this session still good?".
//
// Every credential-minting path (login, activation, account switch, sign-out
// everywhere, and the upgrade of a pre-session refresh token) goes through
// Start, so no token pair exists without a session row behind it.
type SessionService struct {
	repo   SessionRepo
	tokens *TokenService
	logger *zap.Logger
	now    func() time.Time
}

func NewSessionService(repo SessionRepo, tokens *TokenService, logger *zap.Logger) *SessionService {
	return &SessionService{repo: repo, tokens: tokens, logger: logger, now: func() time.Time { return time.Now().UTC() }}
}

// Start opens a session for an already verified user and returns its first
// token pair. If the user already has common.SessionMaxActive live sessions,
// the least recently used one is revoked to make room.
func (s *SessionService) Start(ctx context.Context, user *model.User) (accessToken, refreshToken string, err error) {
	now := s.now()
	sessionID := uuid.New()
	refreshJTI := uuid.NewString()
	absoluteExpiresAt := now.Add(common.SessionAbsoluteTTL)
	expiresAt := earlier(now.Add(common.RefreshTokenTTL), absoluteExpiresAt)

	err = s.repo.Create(ctx, model.Session{
		ID:                sessionID,
		UserID:            user.ID,
		RefreshJTI:        refreshJTI,
		ExpiresAt:         expiresAt,
		AbsoluteExpiresAt: absoluteExpiresAt,
	}, common.SessionMaxActive)
	if err != nil {
		return "", "", fmt.Errorf("service.SessionService.Start: %w", err)
	}

	accessToken, refreshToken, err = s.tokens.IssueSessionTokens(user, sessionID, refreshJTI, expiresAt)
	if err != nil {
		return "", "", fmt.Errorf("service.SessionService.Start: %w", err)
	}
	return accessToken, refreshToken, nil
}

// Refresh rotates the refresh token of the session named by info. The caller
// has already verified the token's signature and that the user is active and
// not signed out everywhere; this checks the session itself.
//
// Only the session's current refresh jti is accepted — plus the one it just
// replaced, for common.RefreshReuseGrace, so a client that lost the response
// can retry. Any other jti is an old token coming back: someone kept a copy.
// The whole session is revoked, which signs out the thief and the owner
// alike; the owner signs in again and the stolen copy is dead.
func (s *SessionService) Refresh(ctx context.Context, user *model.User, info *RefreshTokenInfo) (accessToken, refreshToken string, err error) {
	sessionID, err := uuid.Parse(info.SessionID)
	if err != nil {
		return "", "", common.ErrUnauthenticated
	}

	// Two tries: losing the compare-and-swap means another refresh of this
	// session landed first, so look again — the token we hold may now be the
	// previous one, still inside its grace window.
	for attempt := 0; attempt < 2; attempt++ {
		session, err := s.repo.Get(ctx, sessionID)
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", common.ErrUnauthenticated
		}
		if err != nil {
			return "", "", fmt.Errorf("service.SessionService.Refresh: %w", err)
		}

		now := s.now()
		if session.UserID != user.ID || !sessionLive(session.RevokedAt, session.ExpiresAt, session.AbsoluteExpiresAt, now) {
			return "", "", common.ErrUnauthenticated
		}
		if !refreshJTIAcceptable(session, info.JTI, now) {
			s.logger.Warn("refresh token reuse: session revoked",
				zap.String("user_id", user.ID.String()), zap.String("session_id", session.ID.String()))
			if _, err := s.repo.Revoke(ctx, session.ID, user.ID, model.SessionRevokedRefreshReuse); err != nil {
				return "", "", fmt.Errorf("service.SessionService.Refresh: revoke after reuse: %w", err)
			}
			return "", "", common.ErrUnauthenticated
		}

		newJTI := uuid.NewString()
		expiresAt := earlier(now.Add(common.RefreshTokenTTL), session.AbsoluteExpiresAt)
		rotated, err := s.repo.Rotate(ctx, session.ID, session.RefreshJTI, newJTI, expiresAt)
		if err != nil {
			return "", "", fmt.Errorf("service.SessionService.Refresh: %w", err)
		}
		if !rotated {
			continue
		}

		accessToken, refreshToken, err = s.tokens.IssueSessionTokens(user, session.ID, newJTI, expiresAt)
		if err != nil {
			return "", "", fmt.Errorf("service.SessionService.Refresh: %w", err)
		}
		return accessToken, refreshToken, nil
	}
	// Not a credentials problem, so not a 401: a client treats 401 as "signed
	// out" but a plain server error as "try again".
	return "", "", fmt.Errorf("service.SessionService.Refresh: session changed concurrently")
}

// End revokes one session of the user. Idempotent: ending a session that is
// already over, or is someone else's, is a successful no-op.
func (s *SessionService) End(ctx context.Context, sessionID, userID uuid.UUID, reason string) error {
	if _, err := s.repo.Revoke(ctx, sessionID, userID, reason); err != nil {
		return fmt.Errorf("service.SessionService.End: %w", err)
	}
	return nil
}

// EndAll revokes every live session of the user.
func (s *SessionService) EndAll(ctx context.Context, userID uuid.UUID, reason string) error {
	if _, err := s.repo.RevokeAllForUser(ctx, userID, reason); err != nil {
		return fmt.Errorf("service.SessionService.EndAll: %w", err)
	}
	return nil
}

// Authorize answers JWTAuth: is this access token's session still good? A
// session that is missing, someone else's, revoked, expired, or whose user is
// disabled, deleted or signed out everywhere since the token was issued is a
// 401. A failure to ask at all is NOT a 401 — clients sign out on 401, and a
// database blip must not do that.
func (s *SessionService) Authorize(ctx context.Context, sessionID, userID uuid.UUID, issuedAt *jwt.NumericDate) (*model.SessionAuthState, error) {
	state, err := s.repo.AuthState(ctx, sessionID, userID)
	if err != nil {
		return nil, fmt.Errorf("service.SessionService.Authorize: %w", err)
	}
	if state == nil ||
		!sessionLive(state.RevokedAt, state.ExpiresAt, state.AbsoluteExpiresAt, s.now()) ||
		state.UserStatus != model.UserStatusActive ||
		issuedBeforeRevocation(issuedAt, state.TokensValidAfter) {
		return nil, common.ErrUnauthenticated
	}
	return state, nil
}

func sessionLive(revokedAt *time.Time, expiresAt, absoluteExpiresAt, now time.Time) bool {
	return revokedAt == nil && now.Before(expiresAt) && now.Before(absoluteExpiresAt)
}

// refreshJTIAcceptable: the current jti always; the previous one only while
// it is inside the grace window.
func refreshJTIAcceptable(session *model.Session, jti string, now time.Time) bool {
	if jti == session.RefreshJTI {
		return true
	}
	return session.PrevRefreshJTI != nil && jti == *session.PrevRefreshJTI &&
		session.RotatedAt != nil && now.Sub(*session.RotatedAt) <= common.RefreshReuseGrace
}

func earlier(a, b time.Time) time.Time {
	if b.Before(a) {
		return b
	}
	return a
}
