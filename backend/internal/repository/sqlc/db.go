// Package sqlc holds hand-authored code standing in for `sqlc generate`
// output. It was originally written in an environment without sqlc
// installed, so it could not be generated and verified by the real toolchain
// — the queries in db/queries/*.sql are the actual source of truth.
//
// A real sqlc (v1.31.1) IS available in this environment as of
// specs/ai-chat-assistant — but running `sqlc generate` unmodified rewrites
// every file in this package to pgtype-wrapped nullable types (pgtype.UUID,
// pgtype.Timestamptz, pgtype.Date) instead of this package's existing plain
// pointer convention (*uuid.UUID, *time.Time), which breaks every existing
// repository/service call site across every feature. Reconciling the whole
// package onto real sqlc's conventions is a legitimate, separate technical
// debt item — out of scope for any single feature's implementation — so new
// queries added here (this file's own CreateChatMessage/GetTransactionBy...
// additions included) continue to be hand-authored in the existing plain
// pointer style until that reconciliation is deliberately scheduled.
package sqlc

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// DBTX is satisfied by both *pgxpool.Pool and pgx.Tx, matching sqlc's
// standard generated interface for the pgx/v5 driver.
type DBTX interface {
	Exec(context.Context, string, ...interface{}) (pgconn.CommandTag, error)
	Query(context.Context, string, ...interface{}) (pgx.Rows, error)
	QueryRow(context.Context, string, ...interface{}) pgx.Row
}

type Queries struct {
	db DBTX
}

func New(db DBTX) *Queries {
	return &Queries{db: db}
}

// WithTx returns a Queries bound to an in-flight transaction — the Service
// layer owns the pgx.Tx lifecycle and passes it here, never the other way.
func (q *Queries) WithTx(tx pgx.Tx) *Queries {
	return &Queries{db: tx}
}
