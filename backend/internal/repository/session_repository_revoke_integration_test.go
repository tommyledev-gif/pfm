package repository

import (
	"context"

	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

func TestSessionRevokeIsScopedToTheUser(t *testing.T) {
	pool := testPool(t)
	repo := NewSessionRepository(sqlc.New(pool), pool)
	alice, bob := newUser(t, pool), newUser(t, pool)
	s := newSession(alice)
	if err := repo.Create(context.Background(), s, 5); err != nil {
		t.Fatal(err)
	}

	if ok, err := repo.Revoke(context.Background(), s.ID, bob, model.SessionRevokedLogout); err != nil || ok {
		t.Fatalf("Bob revoking Alice's session: ok=%v err=%v, want false, nil", ok, err)
	}
	if ok, err := repo.Revoke(context.Background(), s.ID, alice, model.SessionRevokedLogout); err != nil || !ok {
		t.Fatalf("Alice revoking her own session: ok=%v err=%v, want true, nil", ok, err)
	}
	if ok, _ := repo.Revoke(context.Background(), s.ID, alice, model.SessionRevokedLogout); ok {
		t.Fatal("revoking twice must report that nothing changed")
	}
}

func TestSessionRevokeAllForUserLeavesOthersAlone(t *testing.T) {
	pool := testPool(t)
	repo := NewSessionRepository(sqlc.New(pool), pool)
	alice, bob := newUser(t, pool), newUser(t, pool)
	for i := 0; i < 3; i++ {
		if err := repo.Create(context.Background(), newSession(alice), 5); err != nil {
			t.Fatal(err)
		}
	}
	if err := repo.Create(context.Background(), newSession(bob), 5); err != nil {
		t.Fatal(err)
	}

	n, err := repo.RevokeAllForUser(context.Background(), alice, model.SessionRevokedSignOutAll)
	if err != nil || n != 3 {
		t.Fatalf("RevokeAllForUser = %d, %v, want 3, nil", n, err)
	}
	if liveSessions(t, pool, alice) != 0 || liveSessions(t, pool, bob) != 1 {
		t.Fatal("RevokeAllForUser must end Alice's sessions and only hers")
	}
}

func TestSessionAuthState(t *testing.T) {
	pool := testPool(t)
	repo := NewSessionRepository(sqlc.New(pool), pool)
	user := newUser(t, pool)
	other := newUser(t, pool)
	s := newSession(user)
	if err := repo.Create(context.Background(), s, 5); err != nil {
		t.Fatal(err)
	}

	state, err := repo.AuthState(context.Background(), s.ID, user)
	if err != nil || state == nil {
		t.Fatalf("AuthState = %+v, %v, want a state", state, err)
	}
	if state.UserStatus != model.UserStatusActive || state.UserRole != model.UserRoleMember || state.RevokedAt != nil {
		t.Fatalf("unexpected state: %+v", state)
	}

	if state, err := repo.AuthState(context.Background(), s.ID, other); err != nil || state != nil {
		t.Fatalf("another user's id must find nothing, got %+v, %v", state, err)
	}
	if state, err := repo.AuthState(context.Background(), uuid.New(), user); err != nil || state != nil {
		t.Fatalf("an unknown session must find nothing, got %+v, %v", state, err)
	}

	if _, err := pool.Exec(context.Background(), `UPDATE users SET status = 'disabled', tokens_valid_after = NOW() WHERE id = $1`, user); err != nil {
		t.Fatal(err)
	}
	state, _ = repo.AuthState(context.Background(), s.ID, user)
	if state == nil || state.UserStatus != model.UserStatusDisabled || state.TokensValidAfter == nil {
		t.Fatalf("AuthState must reflect the live user row, got %+v", state)
	}

	if _, err := pool.Exec(context.Background(), `UPDATE users SET deleted_at = NOW() WHERE id = $1`, user); err != nil {
		t.Fatal(err)
	}
	if state, err := repo.AuthState(context.Background(), s.ID, user); err != nil || state != nil {
		t.Fatalf("a soft-deleted user's session must find nothing, got %+v, %v", state, err)
	}
}

func TestSessionDeleteExpired(t *testing.T) {
	pool := testPool(t)
	repo := NewSessionRepository(sqlc.New(pool), pool)
	user := newUser(t, pool)

	live, pastHardStop, oldRevoked := newSession(user), newSession(user), newSession(user)
	pastHardStop.AbsoluteExpiresAt = time.Now().Add(-10 * 24 * time.Hour)
	pastHardStop.ExpiresAt = time.Now().Add(-10 * 24 * time.Hour)
	for _, s := range []model.Session{live, pastHardStop, oldRevoked} {
		if _, err := pool.Exec(context.Background(),
			`INSERT INTO sessions (id, user_id, refresh_jti, expires_at, absolute_expires_at) VALUES ($1,$2,$3,$4,$5)`,
			s.ID, s.UserID, s.RefreshJTI, s.ExpiresAt, s.AbsoluteExpiresAt); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := pool.Exec(context.Background(),
		`UPDATE sessions SET revoked_at = NOW() - INTERVAL '10 days' WHERE id = $1`, oldRevoked.ID); err != nil {
		t.Fatal(err)
	}

	if _, err := repo.DeleteExpired(context.Background(), time.Now().Add(-7*24*time.Hour)); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.Get(context.Background(), live.ID); err != nil {
		t.Fatalf("a live session must survive retention: %v", err)
	}
	for name, s := range map[string]model.Session{"past its hard stop": pastHardStop, "revoked long ago": oldRevoked} {
		if _, err := repo.Get(context.Background(), s.ID); err == nil {
			t.Errorf("the session %s should have been deleted", name)
		}
	}
}

func TestRevokedTokenDeleteExpired(t *testing.T) {
	pool := testPool(t)
	repo := NewRevokedTokenRepository(sqlc.New(pool))
	ctx := context.Background()
	expired, valid := uuid.NewString(), uuid.NewString()
	if err := repo.Revoke(ctx, expired, nil, time.Now().Add(-time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err := repo.Revoke(ctx, valid, nil, time.Now().Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM revoked_tokens WHERE token_jti = $1`, valid) })

	if _, err := repo.DeleteExpired(ctx, time.Now()); err != nil {
		t.Fatal(err)
	}
	if revoked, _ := repo.IsRevoked(ctx, expired); revoked {
		t.Error("an expired deny-list row should have been deleted")
	}
	if revoked, _ := repo.IsRevoked(ctx, valid); !revoked {
		t.Error("a deny-list row for a token that is still valid must be kept")
	}
}

// Mig 033: a sign-in on a device replaces the user's session there, the list
// shows only live sessions, and a refresh records a device only once.
func TestSessionDevices(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	repo := NewSessionRepository(sqlc.New(pool), pool)
	userID := newUser(t, pool)
	phone := uuid.New()
	name := "Pixel 8"

	first := newSession(userID)
	first.DeviceID, first.DeviceName = &phone, &name
	if err := repo.Create(ctx, first, 5); err != nil {
		t.Fatalf("create first: %v", err)
	}
	legacy := newSession(userID) // no device, like a session from before mig 033
	if err := repo.Create(ctx, legacy, 5); err != nil {
		t.Fatalf("create legacy: %v", err)
	}
	second := newSession(userID)
	second.DeviceID = &phone
	if err := repo.Create(ctx, second, 5); err != nil {
		t.Fatalf("create second: %v", err)
	}

	got, err := repo.Get(ctx, first.ID)
	if err != nil || got.RevokedAt == nil || *got.RevokedReason != model.SessionRevokedReplaced {
		t.Fatalf("first session on the phone = %+v (err %v), want replaced", got, err)
	}
	items, err := repo.ListLive(ctx, userID)
	if err != nil || len(items) != 2 {
		t.Fatalf("ListLive = %+v (err %v), want the second and the legacy session", items, err)
	}

	tablet := uuid.New()
	if ok, err := repo.Rotate(ctx, legacy.ID, legacy.RefreshJTI, uuid.NewString(), time.Now().Add(time.Hour), &model.SessionDevice{ID: tablet, Name: "Tab S9"}); err != nil || !ok {
		t.Fatalf("rotate legacy: ok=%v err=%v", ok, err)
	}
	got, _ = repo.Get(ctx, legacy.ID)
	if got.DeviceID == nil || *got.DeviceID != tablet || got.DeviceName == nil || *got.DeviceName != "Tab S9" {
		t.Fatalf("legacy session did not learn its device: %+v", got)
	}
	if ok, err := repo.Rotate(ctx, legacy.ID, got.RefreshJTI, uuid.NewString(), time.Now().Add(time.Hour), &model.SessionDevice{ID: uuid.New(), Name: "Other"}); err != nil || !ok {
		t.Fatalf("rotate again: ok=%v err=%v", ok, err)
	}
	got, _ = repo.Get(ctx, legacy.ID)
	if *got.DeviceID != tablet || *got.DeviceName != "Tab S9" {
		t.Fatalf("a recorded device was overwritten: %+v", got)
	}
}
