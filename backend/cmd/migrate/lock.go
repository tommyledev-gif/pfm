package main

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// migrationLockName names the Postgres advisory lock this runner holds;
// hashtext turns it into the number pg_advisory_lock takes.
const migrationLockName = "pfm cmd/migrate"

// lockMigrations holds a Postgres advisory lock on a connection of its own
// until unlock is called. Two deploys that overlap, or a deploy while someone
// migrates by hand, would otherwise both see a migration as pending and race
// to apply it, and the loser fails the deploy on "already exists". If this
// process dies instead, its connection closes and Postgres frees the lock.
func lockMigrations(ctx context.Context, pool *pgxpool.Pool) (unlock func(), err error) {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return nil, fmt.Errorf("connecting for the migration lock: %w", err)
	}
	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock(hashtext($1))`, migrationLockName); err != nil {
		conn.Release()
		return nil, fmt.Errorf("taking the migration lock: %w", err)
	}
	return func() {
		_, _ = conn.Exec(context.Background(), `SELECT pg_advisory_unlock(hashtext($1))`, migrationLockName)
		conn.Release()
	}, nil
}
