// cmd/migrate applies pending SQL migrations and records them in a
// schema_migrations ledger. Invoked by backend/deploy.sh on every deploy,
// immediately after the stack comes up and before cmd/seed runs.
//
// Why this exists: for most of this project's life the only thing that ever
// ran db/migrations/*.sql was Postgres's docker-entrypoint-initdb.d hook,
// which fires exactly once — when the data volume is first initialized. Every
// migration added afterwards silently required a human with psql, and
// forgetting shipped a green deploy against a schema missing the table the
// new code needed (500 SQLSTATE 42P01). That happened to 009_notifications
// and again, in production, to 015 through 018. CI cannot catch it: it
// compiles Go and runs unit tests against in-memory fakes, never Postgres.
//
// Design notes:
//   - The ledger is keyed on filename, not on a sequence number, so a gap or
//     an out-of-order addition can't silently skip anything.
//   - Each migration runs inside its own transaction together with its own
//     ledger insert, so a file either fully applies and is recorded, or
//     neither. Every migration in this project is transaction-safe (nothing
//     uses CREATE INDEX CONCURRENTLY); if one ever isn't, it must be split
//     out and applied by hand rather than defeating this guarantee.
//   - A failure here exits non-zero, which fails the deploy. That is the
//     point: a broken schema should stop the release, not surface later as a
//     runtime 500.
package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/example/pfm/backend/db"
)

// Postgres SQLSTATEs meaning "the object this statement creates is already
// there". On the very first run against a database that predates the ledger
// (every environment built by docker-entrypoint-initdb.d), that is not a
// failure — it is proof the migration was already applied, so the runner
// adopts it into the ledger instead of dying. See adoptOrFail.
var duplicateObjectCodes = map[string]bool{
	"42P07": true, // duplicate_table (also covers indexes)
	"42701": true, // duplicate_column
	"42710": true, // duplicate_object
	"42P06": true, // duplicate_schema
	"42723": true, // duplicate_function
	"42P16": true, // invalid_table_definition (e.g. re-adding an existing PK)
}

const createLedgerSQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    checksum   TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`

func main() {
	// Escape hatch, not part of the normal path: the runner adopts a
	// pre-existing schema by itself on its first run (see adoptOrFail), so
	// no operator step is needed to migrate an environment onto the ledger.
	// This flag stays for the case where adoption isn't safe to infer — e.g.
	// a migration whose statements are all `IF NOT EXISTS` and therefore
	// raise no duplicate error to detect, on a database where it never ran.
	baseline := flag.Bool("baseline", false,
		"record every migration as applied WITHOUT running any SQL. Only correct when the schema is known to already match every migration — against a partially-migrated database this leaves it permanently short.")
	flag.Parse()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("migrate: DATABASE_URL is required")
	}

	migrations, err := db.Migrations()
	if err != nil {
		log.Fatalf("migrate: %v", err)
	}
	if len(migrations) == 0 {
		log.Fatal("migrate: no embedded migrations found — this binary was built wrong")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("migrate: connecting to database: %v", err)
	}
	defer pool.Close()

	if _, err := pool.Exec(ctx, createLedgerSQL); err != nil {
		log.Fatalf("migrate: creating schema_migrations: %v", err)
	}

	applied, err := appliedMigrations(ctx, pool)
	if err != nil {
		log.Fatalf("migrate: reading schema_migrations: %v", err)
	}

	if *baseline {
		if err := runBaseline(ctx, pool, migrations, applied); err != nil {
			log.Fatalf("migrate: %v", err)
		}
		return
	}

	// Adoption is only permitted on a run that starts with an empty ledger —
	// i.e. the first ever run against a database whose schema was built by
	// docker-entrypoint-initdb.d (or by hand) before this runner existed.
	// Once anything is recorded, a duplicate-object error is a genuine
	// problem and must fail the deploy rather than be quietly swallowed.
	adoptionAllowed := len(applied) == 0
	if adoptionAllowed {
		log.Print("migrate: ledger is empty — first run. Migrations whose objects already exist will be adopted into the ledger without re-running.")
	}

	pending, adopted := 0, 0
	for _, migration := range migrations {
		sum := checksum(migration.SQL)

		if recordedSum, ok := applied[migration.Filename]; ok {
			// Content drift on an already-applied file. Logged, never fatal:
			// editing an old migration is usually harmless housekeeping (018
			// itself gained `IF NOT EXISTS` after it had already been applied
			// by hand), and failing the deploy over it would block releases
			// for a cosmetic edit. What it must not do is silently re-run —
			// the file stays applied, and the mismatch is surfaced so a real
			// semantic edit gets noticed.
			if recordedSum != sum {
				log.Printf("migrate: WARNING %s already applied but its contents changed since (ledger %s, now %s) — not re-applying",
					migration.Filename, shortSum(recordedSum), shortSum(sum))
			}
			continue
		}

		log.Printf("migrate: applying %s", migration.Filename)
		err := applyMigration(ctx, pool, migration, sum)
		if err == nil {
			pending++
			continue
		}

		wasAdopted, adoptErr := adoptOrFail(ctx, pool, migration, sum, adoptionAllowed, err)
		if adoptErr != nil {
			log.Fatalf("migrate: applying %s: %v", migration.Filename, adoptErr)
		}
		if wasAdopted {
			adopted++
		}
	}

	switch {
	case pending == 0 && adopted == 0:
		log.Printf("migrate: schema up to date (%d migrations already applied)", len(applied))
	case adopted > 0:
		log.Printf("migrate: applied %d migration(s), adopted %d pre-existing migration(s) into the ledger", pending, adopted)
	default:
		log.Printf("migrate: applied %d migration(s)", pending)
	}
}

// adoptOrFail decides what a failed migration means. A duplicate-object
// error on the first run (empty ledger) means the file was already applied
// before this runner existed — the ledger just didn't know — so it is
// recorded and the run continues. Anything else, or the same error once the
// ledger is populated, is a real failure and aborts the deploy.
//
// ⚠️ Limitation worth knowing: this infers "already applied" from the first
// statement that collides. A file left genuinely half-applied (initdb runs
// each file without a wrapping transaction, so a mid-file crash could do
// that) would be adopted as complete, leaving its later statements missing.
// That is why adoption is restricted to the first run and logged per file —
// check the adopted list against reality once, and it can never happen again.
func adoptOrFail(
	ctx context.Context,
	pool *pgxpool.Pool,
	migration db.Migration,
	sum string,
	adoptionAllowed bool,
	applyErr error,
) (bool, error) {
	var pgErr *pgconn.PgError
	if !errors.As(applyErr, &pgErr) || !duplicateObjectCodes[pgErr.Code] {
		return false, applyErr
	}
	if !adoptionAllowed {
		return false, fmt.Errorf("%w (ledger is already populated, so this is not a pre-existing schema)", applyErr)
	}

	if _, err := pool.Exec(ctx,
		`INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)
		 ON CONFLICT (filename) DO NOTHING`,
		migration.Filename, sum,
	); err != nil {
		return false, fmt.Errorf("recording adopted migration: %w", err)
	}

	log.Printf("migrate: adopted %s — its objects already exist (%s: %s), recorded as applied without re-running",
		migration.Filename, pgErr.Code, pgErr.Message)
	return true, nil
}

func appliedMigrations(ctx context.Context, pool *pgxpool.Pool) (map[string]string, error) {
	rows, err := pool.Query(ctx, `SELECT filename, checksum FROM schema_migrations`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	applied := make(map[string]string)
	for rows.Next() {
		var filename, sum string
		if err := rows.Scan(&filename, &sum); err != nil {
			return nil, err
		}
		applied[filename] = sum
	}
	return applied, rows.Err()
}

// applyMigration runs one file and records it in the same transaction, so a
// migration can never be applied-but-unrecorded (which would re-run it next
// deploy) or recorded-but-unapplied (which would skip it forever).
func applyMigration(ctx context.Context, pool *pgxpool.Pool, migration db.Migration, sum string) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	if _, err := tx.Exec(ctx, migration.SQL); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)`,
		migration.Filename, sum,
	); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

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

func checksum(sql string) string {
	sum := sha256.Sum256([]byte(sql))
	return hex.EncodeToString(sum[:])
}

func shortSum(sum string) string {
	if len(sum) < 12 {
		return sum
	}
	return sum[:12]
}
