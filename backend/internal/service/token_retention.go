package service

import (
	"context"
	"time"

	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
)

// ExpiredPurger deletes rows that ended before a cutoff and reports how many.
// Both SessionRepo and the revoked-token repository satisfy it.
type ExpiredPurger interface {
	DeleteExpired(ctx context.Context, cutoff time.Time) (int64, error)
}

// TokenRetention keeps the session and token-deny-list tables from growing
// without bound: a revoked_tokens row only matters until its token expires,
// and a session row only until a token presenting it would be refused for
// age anyway. Invoked on a ticker from main.go, never from a request; each
// statement is idempotent, so a missed or doubled tick is harmless.
type TokenRetention struct {
	sessions      ExpiredPurger
	revokedTokens ExpiredPurger
	logger        *zap.Logger
	now           func() time.Time
}

func NewTokenRetention(sessions, revokedTokens ExpiredPurger, logger *zap.Logger) *TokenRetention {
	return &TokenRetention{sessions: sessions, revokedTokens: revokedTokens, logger: logger, now: time.Now}
}

// Purge runs one pass. Failures are logged and retried on the next tick —
// there is no caller to return to. A failure in one table does not skip the
// other.
func (r *TokenRetention) Purge(ctx context.Context) {
	now := r.now()
	sessions, err := r.sessions.DeleteExpired(ctx, now.Add(-common.SessionPurgeRetention))
	if err != nil {
		r.logger.Error("token retention: deleting expired sessions failed", zap.Error(err))
	}
	// A deny-list row is inert the moment its token has expired.
	revoked, err2 := r.revokedTokens.DeleteExpired(ctx, now)
	if err2 != nil {
		r.logger.Error("token retention: deleting expired revoked tokens failed", zap.Error(err2))
	}
	if err == nil && err2 == nil {
		r.logger.Info("token retention done", zap.Int64("sessions_deleted", sessions), zap.Int64("revoked_tokens_deleted", revoked))
	}
}
