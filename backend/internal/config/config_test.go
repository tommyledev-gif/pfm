package config

import (
	"strings"
	"testing"
)

func setRequired(t *testing.T) {
	t.Helper()
	t.Setenv("DATABASE_URL", "postgres://u:p@localhost:5432/db")
	t.Setenv("JWT_SECRET", strings.Repeat("a", MinJWTSecretBytes))
	t.Setenv("DB_MAX_CONNS", "")
}

func TestLoadAcceptsA32ByteJWTSecret(t *testing.T) {
	setRequired(t)
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DBMaxConns != defaultDBMaxConns {
		t.Fatalf("DBMaxConns = %d, want default %d", cfg.DBMaxConns, defaultDBMaxConns)
	}
}

func TestLoadRejectsShortJWTSecret(t *testing.T) {
	setRequired(t)
	for _, secret := range []string{"pfm", strings.Repeat("a", MinJWTSecretBytes-1)} {
		t.Setenv("JWT_SECRET", secret)
		_, err := Load()
		if err == nil || !strings.Contains(err.Error(), "JWT_SECRET must be at least 32 bytes") {
			t.Fatalf("secret of %d bytes: err = %v, want a length error", len(secret), err)
		}
		if strings.Contains(err.Error(), secret) && len(secret) > 0 {
			t.Fatalf("error leaks the secret: %v", err)
		}
	}
}

func TestLoadStillRequiresJWTSecretAndDatabaseURL(t *testing.T) {
	setRequired(t)
	t.Setenv("JWT_SECRET", "")
	if _, err := Load(); err == nil {
		t.Fatal("empty JWT_SECRET must fail")
	}
	setRequired(t)
	t.Setenv("DATABASE_URL", "")
	if _, err := Load(); err == nil {
		t.Fatal("empty DATABASE_URL must fail")
	}
}

func TestLoadDBMaxConns(t *testing.T) {
	setRequired(t)
	t.Setenv("DB_MAX_CONNS", "25")
	cfg, err := Load()
	if err != nil || cfg.DBMaxConns != 25 {
		t.Fatalf("DBMaxConns = %v, err %v, want 25", cfg, err)
	}
	for _, bad := range []string{"0", "-1", "ten", "5000"} {
		t.Setenv("DB_MAX_CONNS", bad)
		if _, err := Load(); err == nil {
			t.Errorf("DB_MAX_CONNS=%q must fail", bad)
		}
	}
}
