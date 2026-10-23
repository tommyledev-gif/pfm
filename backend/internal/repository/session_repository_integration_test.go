package repository

import (
	"context"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// These tests run the real SQL against a real Postgres, because the session
// rules that matter most (the per-user limit under concurrency, the
// compare-and-swap rotation) live in the queries, where the in-memory fakes
// used elsewhere cannot reach.
//
// They need a database with every migration applied (go run ./cmd/migrate) and
// are skipped unless PFM_TEST_DATABASE_URL is set, e.g.
//
//	PFM_TEST_DATABASE_URL=postgres://postgres:pw@127.0.0.1:5432/pfm?sslmode=disable go test ./internal/repository/
func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("PFM_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("PFM_TEST_DATABASE_URL is not set")
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// newUser inserts an active user and removes it (and its sessions) afterwards.
func newUser(t *testing.T, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	email := uuid.NewString() + "@session-test.example.com"
	err := pool.QueryRow(context.Background(),
		`INSERT INTO users (email, role, status) VALUES ($1, 'member', 'active') RETURNING id`, email).Scan(&id)
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM sessions WHERE user_id = $1`, id)
		_, _ = pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1`, id)
	})
	return id
}

func newSession(userID uuid.UUID) model.Session {
	now := time.Now().UTC()
	return model.Session{
		ID:                uuid.New(),
		UserID:            userID,
		RefreshJTI:        uuid.NewString(),
		ExpiresAt:         now.Add(7 * 24 * time.Hour),
		AbsoluteExpiresAt: now.Add(30 * 24 * time.Hour),
	}
}

func liveSessions(t *testing.T, pool *pgxpool.Pool, userID uuid.UUID) int {
	t.Helper()
	var n int
	if err := pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM sessions WHERE user_id = $1 AND revoked_at IS NULL`, userID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestSessionCreateKeepsAtMostMaxActive(t *testing.T) {
	pool := testPool(t)
	repo := NewSessionRepository(sqlc.New(pool), pool)
	user := newUser(t, pool)

	for i := 0; i < 8; i++ {
		if err := repo.Create(context.Background(), newSession(user), 5); err != nil {
			t.Fatalf("Create %d: %v", i, err)
		}
		if got := liveSessions(t, pool, user); got > 5 {
			t.Fatalf("after Create %d there are %d live sessions, want at most 5", i, got)
		}
	}
	if got := liveSessions(t, pool, user); got != 5 {
		t.Fatalf("live sessions = %d, want 5", got)
	}
}

// Ten sign-ins of one user at once must still end at exactly the limit: the
// user-row lock makes them queue instead of all seeing room.
func TestSessionCreateLimitHoldsUnderConcurrency(t *testing.T) {
	pool := testPool(t)
	repo := NewSessionRepository(sqlc.New(pool), pool)
	user := newUser(t, pool)

	var wg sync.WaitGroup
	var failures atomic.Int32
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := repo.Create(context.Background(), newSession(user), 5); err != nil {
				failures.Add(1)
				t.Errorf("Create: %v", err)
			}
		}()
	}
	wg.Wait()

	if failures.Load() > 0 {
		t.FailNow()
	}
	if got := liveSessions(t, pool, user); got != 5 {
		t.Fatalf("live sessions after 10 concurrent sign-ins = %d, want exactly 5", got)
	}
}

func TestSessionCreateEvictsTheLeastRecentlyUsed(t *testing.T) {
	pool := testPool(t)
	repo := NewSessionRepository(sqlc.New(pool), pool)
	user := newUser(t, pool)

	var created []model.Session
	for i := 0; i < 5; i++ {
		s := newSession(user)
		if err := repo.Create(context.Background(), s, 5); err != nil {
			t.Fatal(err)
		}
		created = append(created, s)
	}
	// Make the first one the most recently used by rotating it.
	if ok, err := repo.Rotate(context.Background(), created[0].ID, created[0].RefreshJTI, uuid.NewString(), time.Now().Add(time.Hour), nil); err != nil || !ok {
		t.Fatalf("rotate: ok=%v err=%v", ok, err)
	}
	// The second one is now the least recently used.
	if err := repo.Create(context.Background(), newSession(user), 5); err != nil {
		t.Fatal(err)
	}

	for i, s := range created {
		got, err := repo.Get(context.Background(), s.ID)
		if err != nil {
			t.Fatal(err)
		}
		wantRevoked := i == 1
		if (got.RevokedAt != nil) != wantRevoked {
			t.Errorf("session %d revoked = %v, want %v", i, got.RevokedAt != nil, wantRevoked)
		}
		if wantRevoked && (got.RevokedReason == nil || *got.RevokedReason != model.SessionRevokedLimit) {
			t.Errorf("session %d reason = %v, want %q", i, got.RevokedReason, model.SessionRevokedLimit)
		}
	}
}

func TestSessionCreateFailsForAnUnknownUser(t *testing.T) {
	pool := testPool(t)
	repo := NewSessionRepository(sqlc.New(pool), pool)

	if err := repo.Create(context.Background(), newSession(uuid.New()), 5); err == nil {
		t.Fatal("creating a session for a user that does not exist must fail")
	}
}

// Of several refreshes presenting the same current jti, exactly one wins.
func TestSessionRotateIsCompareAndSwap(t *testing.T) {
	pool := testPool(t)
	repo := NewSessionRepository(sqlc.New(pool), pool)
	user := newUser(t, pool)
	s := newSession(user)
	if err := repo.Create(context.Background(), s, 5); err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	var winners atomic.Int32
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ok, err := repo.Rotate(context.Background(), s.ID, s.RefreshJTI, uuid.NewString(), time.Now().Add(time.Hour), nil)
			if err != nil {
				t.Errorf("Rotate: %v", err)
			}
			if ok {
				winners.Add(1)
			}
		}()
	}
	wg.Wait()

	if winners.Load() != 1 {
		t.Fatalf("%d rotations won, want exactly 1", winners.Load())
	}
	got, _ := repo.Get(context.Background(), s.ID)
	if got.PrevRefreshJTI == nil || *got.PrevRefreshJTI != s.RefreshJTI || got.RotatedAt == nil {
		t.Fatalf("the replaced jti must be remembered with its rotation time: %+v", got)
	}
}

func TestSessionRotateRefusesARevokedSession(t *testing.T) {
	pool := testPool(t)
	repo := NewSessionRepository(sqlc.New(pool), pool)
	user := newUser(t, pool)
	s := newSession(user)
	if err := repo.Create(context.Background(), s, 5); err != nil {
		t.Fatal(err)
	}
	if ok, err := repo.Revoke(context.Background(), s.ID, user, model.SessionRevokedLogout); err != nil || !ok {
		t.Fatalf("revoke: ok=%v err=%v", ok, err)
	}
	if ok, err := repo.Rotate(context.Background(), s.ID, s.RefreshJTI, uuid.NewString(), time.Now().Add(time.Hour), nil); err != nil || ok {
		t.Fatalf("rotating a revoked session: ok=%v err=%v, want false, nil", ok, err)
	}
}
