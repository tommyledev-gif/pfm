package repository

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// Real-Postgres checks of the forgot-password SQL (036_password_reset_codes.sql).
// Skipped without PFM_TEST_DATABASE_URL — see testPool.

const testResetMaxTries = 5

func newResetRepo(t *testing.T) (*PasswordResetRepository, *pgxpool.Pool, uuid.UUID) {
	t.Helper()
	pool := testPool(t)
	userID := newUser(t, pool)
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM password_reset_codes WHERE user_id = $1`, userID)
	})
	return NewPasswordResetRepository(sqlc.New(pool), pool), pool, userID
}

// newCodeFor is a code whose caps pass unless an earlier code is newer than
// cooldownSince.
func newCodeFor(userID uuid.UUID, hash string, cooldownSince time.Time) NewCode {
	now := time.Now().UTC()
	return NewCode{
		UserID: userID, CodeHash: hash, ExpiresAt: now.Add(15 * time.Minute),
		CooldownSince: cooldownSince, HourSince: now.Add(-time.Hour), HourlyMax: 5,
	}
}

func TestPasswordResetRepository_CapsAndTries(t *testing.T) {
	repo, pool, userID := newResetRepo(t)
	ctx := context.Background()
	now := time.Now().UTC()

	if ok, err := repo.CreateCode(ctx, newCodeFor(userID, "hash-1", now.Add(-time.Minute))); err != nil || !ok {
		t.Fatalf("first code: ok=%v err=%v", ok, err)
	}
	// Inside the cooldown: refused, nothing written.
	if ok, err := repo.CreateCode(ctx, newCodeFor(userID, "hash-2", now.Add(-time.Minute))); err != nil || ok {
		t.Fatalf("code inside the cooldown: ok=%v err=%v", ok, err)
	}
	// Past it (cutoff after the first code): the new code ends the old one.
	if ok, err := repo.CreateCode(ctx, newCodeFor(userID, "hash-3", time.Now().UTC().Add(time.Second))); err != nil || !ok {
		t.Fatalf("code after the cooldown: ok=%v err=%v", ok, err)
	}
	live, err := repo.LiveCode(ctx, userID)
	if err != nil || live.CodeHash != "hash-3" || live.Attempts != 0 {
		t.Fatalf("live code = %+v, %v; want hash-3", live, err)
	}

	for i := 0; i < testResetMaxTries; i++ {
		if err := repo.SpendTry(ctx, live.ID, testResetMaxTries); err != nil {
			t.Fatalf("spend try %d: %v", i+1, err)
		}
	}
	if _, err := repo.LiveCode(ctx, userID); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("code after %d wrong tries is still live: %v", testResetMaxTries, err)
	}
	if ok, err := repo.ResetPassword(ctx, live.ID, userID, testResetMaxTries, "new-hash", time.Now().UTC()); err != nil || ok {
		t.Fatalf("reset with an exhausted code: ok=%v err=%v", ok, err)
	}

	// Hourly cap: 2 codes this hour so far; a cap of 2 refuses a third.
	capped := newCodeFor(userID, "hash-4", time.Now().UTC().Add(time.Second))
	capped.HourlyMax = 2
	if ok, err := repo.CreateCode(ctx, capped); err != nil || ok {
		t.Fatalf("code over the hourly cap: ok=%v err=%v", ok, err)
	}

	// A disabled account gets no code.
	if _, err := pool.Exec(ctx, `UPDATE users SET status = 'disabled' WHERE id = $1`, userID); err != nil {
		t.Fatalf("disable: %v", err)
	}
	if ok, err := repo.CreateCode(ctx, newCodeFor(userID, "hash-5", time.Now().UTC().Add(time.Second))); err != nil || ok {
		t.Fatalf("code for a disabled account: ok=%v err=%v", ok, err)
	}
}

// S-FPW-17: two confirms with the same code at once; exactly one resets.
func TestPasswordResetRepository_ResetIsSingleUse(t *testing.T) {
	repo, pool, userID := newResetRepo(t)
	ctx := context.Background()
	if ok, err := repo.CreateCode(ctx, newCodeFor(userID, "hash", time.Now().UTC().Add(-time.Minute))); err != nil || !ok {
		t.Fatalf("create: ok=%v err=%v", ok, err)
	}
	live, err := repo.LiveCode(ctx, userID)
	if err != nil {
		t.Fatalf("live: %v", err)
	}

	signOutAt := time.Now().UTC().Truncate(time.Second).Add(time.Second)
	var wg sync.WaitGroup
	results := make(chan bool, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ok, err := repo.ResetPassword(ctx, live.ID, userID, testResetMaxTries, "new-hash", signOutAt)
			if err != nil {
				t.Errorf("reset: %v", err)
			}
			results <- ok
		}()
	}
	wg.Wait()
	close(results)
	wins := 0
	for ok := range results {
		if ok {
			wins++
		}
	}
	if wins != 1 {
		t.Fatalf("%d resets succeeded, want exactly 1", wins)
	}

	var hash string
	var validAfter time.Time
	if err := pool.QueryRow(ctx, `SELECT password_hash, tokens_valid_after FROM users WHERE id = $1`, userID).Scan(&hash, &validAfter); err != nil {
		t.Fatalf("read user: %v", err)
	}
	if hash != "new-hash" || !validAfter.Equal(signOutAt) {
		t.Fatalf("user hash %q, sign-out point %v; want the new ones", hash, validAfter)
	}
	if _, err := repo.LiveCode(ctx, userID); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("used code is still live: %v", err)
	}

	// Retention removes rows created before the cutoff.
	n, err := repo.DeleteExpired(ctx, time.Now().UTC().Add(time.Minute))
	if err != nil || n < 1 {
		t.Fatalf("delete old codes: n=%d err=%v", n, err)
	}
}
