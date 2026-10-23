package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

type sessionFixture struct {
	clock  *testClock
	users  *fakeUserRepo
	repo   *fakeSessionRepo
	tokens *TokenService
	svc    *SessionService
}

func newSessionFixture(t *testing.T) *sessionFixture {
	t.Helper()
	clock := newTestClock()
	users := newFakeUserRepo()
	repo := newFakeSessionRepo(clock, users)
	tokens := NewTokenService("test-signing-key-not-for-production")
	svc := NewSessionService(repo, tokens, zap.NewNop())
	svc.now = clock.Now
	return &sessionFixture{clock: clock, users: users, repo: repo, tokens: tokens, svc: svc}
}

func (f *sessionFixture) activeUser(email string) *model.User {
	return seedUser(f.users, email, model.UserStatusActive)
}

// start opens a session and returns its id and the refresh token.
func (f *sessionFixture) start(t *testing.T, user *model.User) (uuid.UUID, string, string) {
	t.Helper()
	access, refresh, err := f.svc.Start(context.Background(), user, nil)
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	claims, err := f.tokens.ParseAccessToken(access)
	if err != nil {
		t.Fatalf("ParseAccessToken: %v", err)
	}
	sid, err := uuid.Parse(claims.SessionID)
	if err != nil {
		t.Fatalf("access token has no usable sid: %q", claims.SessionID)
	}
	return sid, access, refresh
}

func (f *sessionFixture) refresh(t *testing.T, user *model.User, refreshToken string) (string, string, error) {
	t.Helper()
	info, err := f.tokens.ParseRefreshToken(refreshToken)
	if err != nil {
		t.Fatalf("ParseRefreshToken: %v", err)
	}
	return f.svc.Refresh(context.Background(), user, info, nil)
}

func (f *sessionFixture) authorized(sid uuid.UUID, user *model.User, access string) error {
	claims, err := f.tokens.ParseAccessToken(access)
	if err != nil {
		return err
	}
	_, err = f.svc.Authorize(context.Background(), sid, user.ID, claims.IssuedAt)
	return err
}

func isUnauthenticated(err error) bool {
	return errors.Is(err, common.ErrUnauthenticated)
}

func TestSessionStartBindsTokensToAStoredSession(t *testing.T) {
	f := newSessionFixture(t)
	user := f.activeUser("a@example.com")

	sid, access, refresh := f.start(t, user)

	stored := f.repo.sessionFor(sid)
	if stored == nil || stored.UserID != user.ID {
		t.Fatalf("session %s not stored for the user: %+v", sid, stored)
	}
	info, err := f.tokens.ParseRefreshToken(refresh)
	if err != nil {
		t.Fatal(err)
	}
	if info.SessionID != sid.String() || info.JTI != stored.RefreshJTI {
		t.Fatalf("refresh token (sid %s, jti %s) does not match the session (%s, %s)", info.SessionID, info.JTI, sid, stored.RefreshJTI)
	}
	if want := f.clock.Now().Add(common.SessionAbsoluteTTL); !stored.AbsoluteExpiresAt.Equal(want) {
		t.Fatalf("absolute expiry = %v, want %v", stored.AbsoluteExpiresAt, want)
	}
	if want := f.clock.Now().Add(common.RefreshTokenTTL); !stored.ExpiresAt.Equal(want) {
		t.Fatalf("idle expiry = %v, want %v", stored.ExpiresAt, want)
	}
	if err := f.authorized(sid, user, access); err != nil {
		t.Fatalf("a fresh session must authorize: %v", err)
	}
}

// Concurrent session limit: the 6th sign-in succeeds and the least recently
// used session is the one that goes.
func TestSessionLimitRevokesTheLeastRecentlyUsed(t *testing.T) {
	f := newSessionFixture(t)
	user := f.activeUser("a@example.com")

	type opened struct {
		sid    uuid.UUID
		access string
	}
	var sessions []opened
	for i := 0; i < common.SessionMaxActive; i++ {
		f.clock.Advance(time.Minute)
		sid, access, _ := f.start(t, user)
		sessions = append(sessions, opened{sid, access})
	}
	if got := f.repo.liveCount(user.ID); got != common.SessionMaxActive {
		t.Fatalf("live sessions = %d, want %d", got, common.SessionMaxActive)
	}

	f.clock.Advance(time.Minute)
	newest, newestAccess, _ := f.start(t, user)

	if got := f.repo.liveCount(user.ID); got != common.SessionMaxActive {
		t.Fatalf("after the 6th sign-in live sessions = %d, want %d", got, common.SessionMaxActive)
	}
	if err := f.authorized(sessions[0].sid, user, sessions[0].access); !isUnauthenticated(err) {
		t.Fatalf("the oldest session should have been revoked, Authorize = %v", err)
	}
	for _, s := range sessions[1:] {
		if err := f.authorized(s.sid, user, s.access); err != nil {
			t.Fatalf("session %s should have survived: %v", s.sid, err)
		}
	}
	if err := f.authorized(newest, user, newestAccess); err != nil {
		t.Fatalf("the new session must work: %v", err)
	}
	if reason := f.repo.sessionFor(sessions[0].sid).RevokedReason; reason == nil || *reason != model.SessionRevokedLimit {
		t.Fatalf("revoked reason = %v, want %q", reason, model.SessionRevokedLimit)
	}
}

// "Least recently used", not "oldest": refreshing a session makes it recent.
func TestSessionLimitSpareAnOldSessionThatWasJustUsed(t *testing.T) {
	f := newSessionFixture(t)
	user := f.activeUser("a@example.com")

	oldest, _, oldestRefresh := f.start(t, user)
	for i := 1; i < common.SessionMaxActive; i++ {
		f.clock.Advance(time.Minute)
		f.start(t, user)
	}
	f.clock.Advance(time.Minute)
	if _, _, err := f.refresh(t, user, oldestRefresh); err != nil {
		t.Fatalf("refresh: %v", err)
	}

	f.clock.Advance(time.Minute)
	f.start(t, user)

	if f.repo.sessionFor(oldest).RevokedAt != nil {
		t.Fatal("the session used a minute ago was evicted instead of the least recently used one")
	}
}

func TestSessionLimitIsPerUser(t *testing.T) {
	f := newSessionFixture(t)
	alice, bob := f.activeUser("alice@example.com"), f.activeUser("bob@example.com")

	bobSession, bobAccess, _ := f.start(t, bob)
	for i := 0; i < common.SessionMaxActive+3; i++ {
		f.clock.Advance(time.Minute)
		f.start(t, alice)
	}
	if err := f.authorized(bobSession, bob, bobAccess); err != nil {
		t.Fatalf("one user's sign-ins must never evict another user's session: %v", err)
	}
}
