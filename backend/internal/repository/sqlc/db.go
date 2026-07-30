// Package sqlc holds hand-authored code standing in for `sqlc generate`
// output. Go/sqlc are not installed in the environment this was written in,
// so this could not be generated and verified by the real toolchain — the
// queries in db/queries/*.sql are the actual source of truth; once sqlc is
// available, run `sqlc generate` from backend/ and diff the result against
// this package before trusting either over the other.
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
