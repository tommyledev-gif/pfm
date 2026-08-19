// cmd/seed bootstraps the first admin account. Invite-only auth (see
// CLAUDE.md) means a brand-new environment has no one to send the first
// invite from — this is the one exception that creates a user directly.
// SeedAdminUser upserts by design: it creates the admin row on first run and
// re-syncs the password hash on every later run, so correcting a wrong
// SEED_ADMIN_PASSWORD and redeploying actually fixes it instead of leaving
// the bad first-run password stuck. deploy.sh runs this after every deploy.
package main

import (
	"context"
	"errors"
	"log"
	"os"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/example/pfm/backend/internal/repository/sqlc"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("seed: DATABASE_URL is required")
	}

	email := os.Getenv("SEED_ADMIN_EMAIL")
	password := os.Getenv("SEED_ADMIN_PASSWORD")
	if email == "" || password == "" {
		log.Println("seed: SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD not set, skipping admin bootstrap")
		return
	}

	name := os.Getenv("SEED_ADMIN_NAME")
	if name == "" {
		name = "Admin"
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("seed: connect to database: %v", err)
	}
	defer pool.Close()

	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		log.Fatalf("seed: hash admin password: %v", err)
	}
	hashStr := string(hash)

	queries := sqlc.New(pool)
	user, err := queries.SeedAdminUser(ctx, sqlc.SeedAdminUserParams{
		Email:        email,
		FullName:     &name,
		PasswordHash: &hashStr,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			log.Printf("seed: %s already exists as a non-admin user, skipping (not the seeded admin)", email)
			return
		}
		log.Fatalf("seed: upsert admin user: %v", err)
	}

	log.Printf("seed: admin user %s is ready (id=%s)", user.Email, user.ID)
}
