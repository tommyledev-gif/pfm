package service

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

func TestAccountSwitchService_Issue(t *testing.T) {
	ctx := context.Background()
	now := jwt.NewNumericDate(time.Now().UTC())

	t.Run("active caller gets a token and identity", func(t *testing.T) {
		f := newSwitchFixture(t)
		user := seedUser(f.users, "a@example.com", model.UserStatusActive)
		got, token, expiresAt, err := f.switches.Issue(ctx, user.ID, now)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if token == "" || got.Email != user.Email || !expiresAt.After(time.Now()) {
			t.Fatalf("unexpected result: %q %v %v", token, got, expiresAt)
		}
	})

	t.Run("inactive caller is refused", func(t *testing.T) {
		f := newSwitchFixture(t)
		user := seedUser(f.users, "d@example.com", model.UserStatusDisabled)
		_, _, _, err := f.switches.Issue(ctx, user.ID, now)
		wantAppCode(t, err, common.ErrCodeUnauthenticated)
	})

	t.Run("unknown caller is refused", func(t *testing.T) {
		f := newSwitchFixture(t)
		_, _, _, err := f.switches.Issue(ctx, uuid.New(), now)
		wantAppCode(t, err, common.ErrCodeUnauthenticated)
	})

	t.Run("access issued before the sign-out point is refused (S-ASW-66)", func(t *testing.T) {
		f := newSwitchFixture(t)
		user := seedUser(f.users, "a@example.com", model.UserStatusActive)
		f.users.setTokensValidAfter(user.ID, time.Now().UTC().Add(time.Minute))
		_, _, _, err := f.switches.Issue(ctx, user.ID, now)
		wantAppCode(t, err, common.ErrCodeUnauthenticated)
	})
}

func TestAccountSwitchService_Switch(t *testing.T) {
	ctx := context.Background()

	t.Run("happy path rotates the token; replay is refused", func(t *testing.T) {
		f := newSwitchFixture(t)
		user := seedUser(f.users, "a@example.com", model.UserStatusActive)
		token, _, _ := f.tokens.IssueSwitchToken(user.ID)

		session, err := f.switches.Switch(ctx, token)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if session.AccessToken == "" || session.RefreshToken == "" || session.SwitchToken == "" || session.SwitchToken == token {
			t.Fatal("expected a fresh pair and a rotated switch token")
		}
		if session.User.ID != user.ID {
			t.Fatal("session for the wrong user")
		}
		if _, err := f.switches.Switch(ctx, session.SwitchToken); err != nil {
			t.Fatalf("rotated token must work: %v", err)
		}
		_, err = f.switches.Switch(ctx, token)
		wantAppCode(t, err, common.ErrCodeUnauthenticated)
	})

	t.Run("concurrent use: exactly one succeeds", func(t *testing.T) {
		f := newSwitchFixture(t)
		user := seedUser(f.users, "a@example.com", model.UserStatusActive)
		token, _, _ := f.tokens.IssueSwitchToken(user.ID)
		const attempts = 10
		var wg sync.WaitGroup
		var mu sync.Mutex
		successes := 0
		for i := 0; i < attempts; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				if _, err := f.switches.Switch(ctx, token); err == nil {
					mu.Lock()
					successes++
					mu.Unlock()
				}
			}()
		}
		wg.Wait()
		if successes != 1 {
			t.Fatalf("expected exactly 1 success, got %d", successes)
		}
	})

	t.Run("revoked token is refused", func(t *testing.T) {
		f := newSwitchFixture(t)
		user := seedUser(f.users, "a@example.com", model.UserStatusActive)
		token, _, _ := f.tokens.IssueSwitchToken(user.ID)
		if err := f.switches.Revoke(ctx, token); err != nil {
			t.Fatalf("revoke: %v", err)
		}
		_, err := f.switches.Switch(ctx, token)
		wantAppCode(t, err, common.ErrCodeUnauthenticated)
	})

	t.Run("expired token is refused", func(t *testing.T) {
		f := newSwitchFixture(t)
		user := seedUser(f.users, "a@example.com", model.UserStatusActive)
		now := time.Now().UTC()
		token := backdatedSwitchToken(t, user.ID, now.Add(-200*24*time.Hour), now.Add(-time.Hour))
		_, err := f.switches.Switch(ctx, token)
		wantAppCode(t, err, common.ErrCodeUnauthenticated)
	})

	t.Run("wrong purpose tokens are refused", func(t *testing.T) {
		f := newSwitchFixture(t)
		user := seedUser(f.users, "a@example.com", model.UserStatusActive)
		access, refresh, _ := f.tokens.GenerateTokenPair(user)
		importToken, _ := f.tokens.IssueImportToken(user.ID, nil)
		for name, token := range map[string]string{"access": access, "refresh": refresh, "import": importToken} {
			_, err := f.switches.Switch(ctx, token)
			if err == nil {
				t.Fatalf("%s token accepted as a switch token", name)
			}
			wantAppCode(t, err, common.ErrCodeUnauthenticated)
		}
	})

	t.Run("token signed with another key is refused", func(t *testing.T) {
		f := newSwitchFixture(t)
		user := seedUser(f.users, "a@example.com", model.UserStatusActive)
		token, _, _ := NewTokenService("another-key").IssueSwitchToken(user.ID)
		_, err := f.switches.Switch(ctx, token)
		wantAppCode(t, err, common.ErrCodeUnauthenticated)
	})

	t.Run("inactive and deleted users are refused", func(t *testing.T) {
		f := newSwitchFixture(t)
		disabled := seedUser(f.users, "d@example.com", model.UserStatusDisabled)
		deleted := seedUser(f.users, "x@example.com", model.UserStatusActive)
		f.users.softDelete("x@example.com")
		for _, id := range []uuid.UUID{disabled.ID, deleted.ID} {
			token, _, _ := f.tokens.IssueSwitchToken(id)
			_, err := f.switches.Switch(ctx, token)
			wantAppCode(t, err, common.ErrCodeUnauthenticated)
		}
	})

	t.Run("issued before the sign-out point: refused and not consumed", func(t *testing.T) {
		f := newSwitchFixture(t)
		user := seedUser(f.users, "a@example.com", model.UserStatusActive)
		now := time.Now().UTC()
		token := backdatedSwitchToken(t, user.ID, now.Add(-time.Hour), now.Add(time.Hour))
		f.users.setTokensValidAfter(user.ID, now.Truncate(time.Second))
		_, err := f.switches.Switch(ctx, token)
		wantAppCode(t, err, common.ErrCodeUnauthenticated)
		if got := f.revoked.revokedCount(); got != 0 {
			t.Fatalf("refused token must not be claimed, got %d rows", got)
		}
	})

	t.Run("issued in the same second as the point is accepted", func(t *testing.T) {
		f := newSwitchFixture(t)
		user := seedUser(f.users, "a@example.com", model.UserStatusActive)
		token, _, _ := f.tokens.IssueSwitchToken(user.ID)
		claims, _ := f.tokens.ParseSwitchToken(token)
		f.users.setTokensValidAfter(user.ID, claims.IssuedAt.Time.Add(500*time.Millisecond))
		if _, err := f.switches.Switch(ctx, token); err != nil {
			t.Fatalf("expected success, got %v", err)
		}
	})

	t.Run("malformed value is invalid input", func(t *testing.T) {
		f := newSwitchFixture(t)
		_, err := f.switches.Switch(ctx, "not-a-jwt")
		wantAppCode(t, err, common.ErrCodeInvalidInput)
	})
}

func TestAccountSwitchService_Revoke(t *testing.T) {
	ctx := context.Background()

	t.Run("idempotent", func(t *testing.T) {
		f := newSwitchFixture(t)
		token, _, _ := f.tokens.IssueSwitchToken(uuid.New())
		for i := 0; i < 2; i++ {
			if err := f.switches.Revoke(ctx, token); err != nil {
				t.Fatalf("revoke #%d: %v", i+1, err)
			}
		}
		if got := f.revoked.revokedCount(); got != 1 {
			t.Fatalf("expected 1 row, got %d", got)
		}
	})

	t.Run("expired token revokes silently", func(t *testing.T) {
		f := newSwitchFixture(t)
		now := time.Now().UTC()
		token := backdatedSwitchToken(t, uuid.New(), now.Add(-200*24*time.Hour), now.Add(-time.Hour))
		if err := f.switches.Revoke(ctx, token); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("malformed value is invalid input", func(t *testing.T) {
		f := newSwitchFixture(t)
		wantAppCode(t, f.switches.Revoke(ctx, "garbage"), common.ErrCodeInvalidInput)
	})

	t.Run("wrong purpose is invalid input", func(t *testing.T) {
		f := newSwitchFixture(t)
		_, refresh, _ := f.tokens.GenerateTokenPair(&model.User{ID: uuid.New(), Role: model.UserRoleMember})
		wantAppCode(t, f.switches.Revoke(ctx, refresh), common.ErrCodeInvalidInput)
	})
}
