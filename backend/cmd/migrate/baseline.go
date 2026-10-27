package main

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/example/pfm/backend/db"
)

// runBaseline records every migration as applied without executing any of
// them — the one-time bridge for a database that already has the schema but
// no ledger (every environment created before this runner existed).
//
// ⚠️ Only correct when the database really is up to date with every embedded
// migration. Run against a partially-migrated database it would mark the
// missing ones as done and leave the schema permanently short — exactly the
// failure this runner exists to prevent. It refuses to touch files that are
// already recorded, and prints everything it marks so the operator can check
// the list against reality.
func runBaseline(ctx context.Context, pool *pgxpool.Pool, migrations []db.Migration, applied map[string]string) error {
	marked := 0
	for _, migration := range migrations {
		if _, ok := applied[migration.Filename]; ok {
			continue
		}
		if _, err := pool.Exec(ctx,
			`INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)
			 ON CONFLICT (filename) DO NOTHING`,
			migration.Filename, checksum(migration.SQL),
		); err != nil {
			return fmt.Errorf("baselining %s: %w", migration.Filename, err)
		}
		log.Printf("migrate: baseline — marked %s as applied (no SQL run)", migration.Filename)
		marked++
	}

	if marked == 0 {
		log.Print("migrate: baseline — nothing to do, every migration was already recorded")
		return nil
	}
	log.Printf("migrate: baseline — recorded %d migration(s) as applied without running them", marked)
	return nil
}
