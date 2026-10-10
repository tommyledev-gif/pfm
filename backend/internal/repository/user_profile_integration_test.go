package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// Runs the profile SQL (mig 027, users_profile.sql.go) against a real
// Postgres; see testPool for how to enable.

func TestProfileQueriesRoundTrip(t *testing.T) {
	pool := testPool(t)
	repo := NewUserRepository(sqlc.New(pool))
	user := newUser(t, pool)
	ctx := context.Background()

	updated, err := repo.UpdateFullName(ctx, user, "Nguyễn Văn A")
	if err != nil {
		t.Fatal(err)
	}
	if updated.FullName == nil || *updated.FullName != "Nguyễn Văn A" {
		t.Fatalf("full_name = %v", updated.FullName)
	}
	if updated.PasswordHash != nil {
		t.Fatal("a profile query must never return the password hash")
	}

	url := "https://img.example.com/avatars/" + uuid.NewString() + ".png"
	withAvatar, err := repo.SetAvatarURL(ctx, user, &url)
	if err != nil {
		t.Fatal(err)
	}
	if withAvatar.AvatarURL == nil || *withAvatar.AvatarURL != url {
		t.Fatalf("avatar_url = %v, want %s", withAvatar.AvatarURL, url)
	}

	// GetUserByID (used by refresh, account switch and GET /users/me) sees it.
	fetched, err := repo.GetUserByID(ctx, user)
	if err != nil {
		t.Fatal(err)
	}
	if fetched.AvatarURL == nil || *fetched.AvatarURL != url || fetched.FullName == nil || *fetched.FullName != "Nguyễn Văn A" {
		t.Fatalf("GetUserByID = %+v", fetched)
	}

	cleared, err := repo.SetAvatarURL(ctx, user, nil)
	if err != nil || cleared.AvatarURL != nil {
		t.Fatalf("clearing the avatar: %+v, %v", cleared, err)
	}
}

func TestProfileQueriesIgnoreUnknownAndDeletedUsers(t *testing.T) {
	pool := testPool(t)
	repo := NewUserRepository(sqlc.New(pool))
	ctx := context.Background()

	if _, err := repo.UpdateFullName(ctx, uuid.New(), "Ghost"); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("unknown user: err = %v, want pgx.ErrNoRows", err)
	}

	deleted := newUser(t, pool)
	if _, err := pool.Exec(ctx, `UPDATE users SET deleted_at = NOW() WHERE id = $1`, deleted); err != nil {
		t.Fatal(err)
	}
	url := "https://img.example.com/avatars/x.png"
	if _, err := repo.SetAvatarURL(ctx, deleted, &url); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("soft-deleted user: err = %v, want pgx.ErrNoRows", err)
	}
}

// Updating one user must never touch another.
func TestProfileQueriesAreScopedToOneRow(t *testing.T) {
	pool := testPool(t)
	repo := NewUserRepository(sqlc.New(pool))
	ctx := context.Background()
	alice, bob := newUser(t, pool), newUser(t, pool)

	if _, err := repo.UpdateFullName(ctx, alice, "Alice"); err != nil {
		t.Fatal(err)
	}
	other, err := repo.GetUserByID(ctx, bob)
	if err != nil {
		t.Fatal(err)
	}
	if other.FullName != nil {
		t.Fatalf("Bob's name changed to %q", *other.FullName)
	}
}
