package repository

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// Real-Postgres checks of the passkey SQL (032_passkeys.sql): the JSONB
// round trip, the live-only unique credential id, soft delete, and
// single-use, purpose-bound, expiring challenges. Skipped without
// PFM_TEST_DATABASE_URL — see testPool.

func TestPasskeyRepository_CredentialLifecycle(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	userID := newUser(t, pool)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM passkey_challenges WHERE user_id = $1`, userID)
		_, _ = pool.Exec(ctx, `DELETE FROM passkeys WHERE user_id = $1`, userID)
	})
	repo := NewPasskeyRepository(sqlc.New(pool))

	credID := []byte(uuid.NewString())
	created, err := repo.Create(ctx, userID, credID, []byte(`{"id":"abc","publicKey":"def"}`), "Pixel 8")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	got, err := repo.GetByCredentialID(ctx, credID)
	if err != nil || got.ID != created.ID || got.Name != "Pixel 8" {
		t.Fatalf("get by credential id: %+v, %v", got, err)
	}
	if string(got.Credential) == "" || got.Credential[0] != '{' {
		t.Fatalf("credential JSON did not round-trip: %q", got.Credential)
	}

	// A second live passkey with the same credential id is refused.
	if _, err := repo.Create(ctx, userID, credID, []byte(`{}`), "dup"); err == nil {
		t.Fatal("expected a unique violation for a duplicate live credential id")
	}

	if err := repo.Touch(ctx, created.ID, userID, []byte(`{"id":"abc","signCount":3}`)); err != nil {
		t.Fatalf("touch: %v", err)
	}
	list, err := repo.ListByUser(ctx, userID)
	if err != nil || len(list) != 1 || list[0].LastUsedAt == nil {
		t.Fatalf("list after touch: %+v, %v", list, err)
	}

	if ok, err := repo.Delete(ctx, created.ID, uuid.New()); err != nil || ok {
		t.Fatalf("delete as another user: ok=%v err=%v", ok, err)
	}
	if ok, err := repo.Delete(ctx, created.ID, userID); err != nil || !ok {
		t.Fatalf("delete own: ok=%v err=%v", ok, err)
	}
	if _, err := repo.GetByCredentialID(ctx, credID); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("deleted passkey still found: %v", err)
	}
	// Deleted, the same credential id may be registered again.
	if _, err := repo.Create(ctx, userID, credID, []byte(`{}`), "again"); err != nil {
		t.Fatalf("re-register after delete: %v", err)
	}
}

func TestPasskeyRepository_ChallengesAreSingleUse(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	userID := newUser(t, pool)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM passkey_challenges WHERE user_id = $1`, userID) })
	repo := NewPasskeyRepository(sqlc.New(pool))

	id, err := repo.CreateChallenge(ctx, &userID, model.PasskeyChallengeLogin, []byte(`{"challenge":"x"}`), time.Now().Add(time.Minute))
	if err != nil {
		t.Fatalf("create challenge: %v", err)
	}
	// Wrong purpose: not consumed.
	if _, _, err := repo.ConsumeChallenge(ctx, id, model.PasskeyChallengeRegister); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("wrong purpose: %v", err)
	}
	owner, session, err := repo.ConsumeChallenge(ctx, id, model.PasskeyChallengeLogin)
	if err != nil || owner == nil || *owner != userID || len(session) == 0 {
		t.Fatalf("consume: owner=%v session=%q err=%v", owner, session, err)
	}
	if _, _, err := repo.ConsumeChallenge(ctx, id, model.PasskeyChallengeLogin); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("second consume: %v", err)
	}

	// A discoverable sign-in has no owner; an expired challenge is gone.
	anon, err := repo.CreateChallenge(ctx, nil, model.PasskeyChallengeLogin, []byte(`{}`), time.Now().Add(-time.Second))
	if err != nil {
		t.Fatalf("create anonymous challenge: %v", err)
	}
	if _, _, err := repo.ConsumeChallenge(ctx, anon, model.PasskeyChallengeLogin); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("expired challenge consumed: %v", err)
	}
}
