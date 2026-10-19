package main

import (
	"context"
	"fmt"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/config"
	"github.com/example/pfm/backend/internal/repository/sqlc"
	"github.com/example/pfm/backend/internal/service"
)

// newPool opens the pgx pool with explicit limits instead of pgx's defaults.
//
//   - MaxConns comes from config (DB_MAX_CONNS) rather than pgx's
//     max(4, CPU count), which on a small VPS is a handful of connections for
//     the whole API.
//   - statement_timeout and idle_in_transaction_session_timeout are set on
//     every connection by the server itself, so a runaway query or a
//     transaction a crashed request left open cannot hold a connection (and
//     its row locks) forever. The pgx pool recycles connections after an hour
//     and health-checks idle ones by default; those defaults are kept.
func newPool(ctx context.Context, cfg *config.Config) (*pgxpool.Pool, error) {
	poolCfg, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("newPool: parse DATABASE_URL: %w", err)
	}
	poolCfg.MaxConns = cfg.DBMaxConns
	if poolCfg.ConnConfig.RuntimeParams == nil {
		poolCfg.ConnConfig.RuntimeParams = map[string]string{}
	}
	poolCfg.ConnConfig.RuntimeParams["statement_timeout"] = strconv.Itoa(common.DBStatementTimeoutMs)
	poolCfg.ConnConfig.RuntimeParams["idle_in_transaction_session_timeout"] = strconv.Itoa(common.DBIdleInTxTimeoutMs)

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("newPool: %w", err)
	}
	return pool, nil
}

// legacyRefreshMigration is the migration that introduced sessions.
const legacyRefreshMigration = "028_sessions.sql"

// openLegacyRefreshWindow lets refresh tokens issued before sessions existed
// be traded for session-bound ones, until the day they have all expired on
// their own: when migration 028 was applied plus the lifetime they were
// issued with.
// If that moment cannot be read (no ledger, as on a database built outside
// cmd/migrate), the window stays shut and those few users sign in again,
// which is the safe failure.
func openLegacyRefreshWindow(ctx context.Context, queries *sqlc.Queries, auth *service.AuthService, logger *zap.Logger) {
	appliedAt, err := queries.GetMigrationAppliedAt(ctx, legacyRefreshMigration)
	if err != nil {
		logger.Warn("pre-session refresh tokens will not be accepted: could not read when sessions were introduced", zap.Error(err))
		return
	}
	deadline := appliedAt.Add(common.LegacyRefreshTokenTTL)
	auth.SetLegacyRefreshDeadline(deadline)
	logger.Info("pre-session refresh tokens accepted until", zap.Time("until", deadline))
}
