// Package db embeds the SQL migration files so they ship inside the compiled
// binary rather than being read from disk at runtime.
//
// Embedding (rather than mounting ./db/migrations into the container) is what
// makes "the deployed image" and "the schema that image expects" one
// artifact: the migrate binary can never be run against a different set of
// .sql files than the server binary was built alongside. It also means the
// runner needs no volume mount, no synced directory on the host, and no
// working-directory assumption.
//
// The embed pattern is relative to this file's own directory, which is why
// this package lives at backend/db/ rather than next to cmd/migrate — go:embed
// cannot reach upward past its own package (`../../db/migrations` is illegal).
package db

import (
	"embed"
	"fmt"
	"io/fs"
	"sort"
	"strings"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// SkippedMigrations are files in migrations/ that must never be applied
// automatically.
//
// 002_seed_admin.sql inserts an admin row with a placeholder password hash —
// it predates cmd/seed and is kept only as a manual reference script. Both
// compose files already exclude it from their docker-entrypoint-initdb.d
// mount list for the same reason; this is that exclusion restated for the
// runner, since the two mechanisms must agree on what counts as a migration.
var SkippedMigrations = map[string]bool{
	"002_seed_admin.sql": true,
}

// Migration is one .sql file: its filename (the ledger's primary key) and
// contents.
type Migration struct {
	Filename string
	SQL      string
}

// Migrations returns every applicable migration in filename order, which is
// also apply order — the NNN_ prefix makes lexical sort and intended order
// the same thing. Skipped files are filtered out here so no caller has to
// remember the exclusion.
func Migrations() ([]Migration, error) {
	entries, err := fs.ReadDir(migrationFS, "migrations")
	if err != nil {
		return nil, fmt.Errorf("db.Migrations: reading embedded migrations: %w", err)
	}

	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		if SkippedMigrations[entry.Name()] {
			continue
		}
		names = append(names, entry.Name())
	}
	sort.Strings(names)

	migrations := make([]Migration, 0, len(names))
	for _, name := range names {
		content, err := migrationFS.ReadFile("migrations/" + name)
		if err != nil {
			return nil, fmt.Errorf("db.Migrations: reading %s: %w", name, err)
		}
		migrations = append(migrations, Migration{Filename: name, SQL: string(content)})
	}
	return migrations, nil
}
