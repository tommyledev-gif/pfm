package db

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// A broken go:embed pattern fails silently at runtime — the binary just
// reports "schema up to date" against an empty set and the deploy goes green
// with nothing applied, which is the exact class of failure cmd/migrate
// exists to prevent. These tests make that a build-time failure instead.

func TestMigrationsMatchDirectory(t *testing.T) {
	entries, err := os.ReadDir("migrations")
	if err != nil {
		t.Fatalf("reading migrations dir: %v", err)
	}

	wantCount := 0
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		if SkippedMigrations[entry.Name()] {
			continue
		}
		wantCount++
	}

	migrations, err := Migrations()
	if err != nil {
		t.Fatalf("Migrations(): %v", err)
	}
	if len(migrations) != wantCount {
		t.Fatalf("embedded %d migrations but %d applicable .sql files exist on disk — the go:embed pattern is out of sync",
			len(migrations), wantCount)
	}
	if wantCount == 0 {
		t.Fatal("no applicable migrations found on disk at all")
	}
}

func TestMigrationsAreSortedAndNonEmpty(t *testing.T) {
	migrations, err := Migrations()
	if err != nil {
		t.Fatalf("Migrations(): %v", err)
	}

	for i, migration := range migrations {
		if strings.TrimSpace(migration.SQL) == "" {
			t.Errorf("%s is embedded but empty", migration.Filename)
		}
		if filepath.Ext(migration.Filename) != ".sql" {
			t.Errorf("%s is not a .sql file", migration.Filename)
		}
		// Filename order is apply order — the NNN_ prefix makes lexical sort
		// and intended order the same thing, so a regression here would
		// reorder schema changes.
		if i > 0 && migrations[i-1].Filename >= migration.Filename {
			t.Errorf("migrations out of order: %s came before %s", migrations[i-1].Filename, migration.Filename)
		}
	}
}

func TestSkippedMigrationsAreExcluded(t *testing.T) {
	migrations, err := Migrations()
	if err != nil {
		t.Fatalf("Migrations(): %v", err)
	}
	for _, migration := range migrations {
		if SkippedMigrations[migration.Filename] {
			t.Errorf("%s is in SkippedMigrations but was still returned for applying", migration.Filename)
		}
	}
}

// 002_seed_admin.sql inserts an admin row with a placeholder password hash.
// Both compose files exclude it from their initdb mounts; if it ever stopped
// being excluded here too, a deploy would create a bogus admin login.
func TestSeedAdminIsSkipped(t *testing.T) {
	if !SkippedMigrations["002_seed_admin.sql"] {
		t.Fatal("002_seed_admin.sql must stay excluded — it carries a placeholder password hash")
	}
}
