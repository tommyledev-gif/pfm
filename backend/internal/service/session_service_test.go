package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
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
	access, refresh, err := f.svc.Start(context.Background(), user)
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
	return f.svc.Refresh(context.Background(), user, info)
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

func TestSessionRefreshRotatesAndKeepsTheSession(t *testing.T) {
	f := newSessionFixture(t)
	user := f.activeUser("a@example.com")
	sid, _, refresh := f.start(t, user)

	f.clock.Advance(time.Hour)
	newAccess, newRefresh, err := f.refresh(t, user, refresh)
	if err != nil {
		t.Fatalf("Refresh: %v", err)
	}

	claims, _ := f.tokens.ParseAccessToken(newAccess)
	newInfo, _ := f.tokens.ParseRefreshToken(newRefresh)
	oldInfo, _ := f.tokens.ParseRefreshToken(refresh)
	if claims.SessionID != sid.String() || newInfo.SessionID != sid.String() {
		t.Fatal("a refresh must stay inside the same session")
	}
	if newInfo.JTI == oldInfo.JTI {
		t.Fatal("the refresh token must be rotated")
	}
	stored := f.repo.sessionFor(sid)
	if stored.RefreshJTI != newInfo.JTI || stored.PrevRefreshJTI == nil || *stored.PrevRefreshJTI != oldInfo.JTI {
		t.Fatalf("session should now hold the new jti and remember the old one: %+v", stored)
	}
	if want := f.clock.Now().Add(common.RefreshTokenTTL); !stored.ExpiresAt.Equal(want) {
		t.Fatalf("idle expiry = %v, want %v", stored.ExpiresAt, want)
	}
}

// Replay of an old refresh token — outside the grace window — means a copy
// leaked: the whole session dies, new token included.
func TestSessionRefreshReuseRevokesTheSession(t *testing.T) {
	f := newSessionFixture(t)
	user := f.activeUser("a@example.com")
	sid, access, original := f.start(t, user)

	f.clock.Advance(time.Minute)
	_, current, err := f.refresh(t, user, original)
	if err != nil {
		t.Fatal(err)
	}
	f.clock.Advance(common.RefreshReuseGrace + time.Second)

	if _, _, err := f.refresh(t, user, original); !isUnauthenticated(err) {
		t.Fatalf("replaying the old refresh token = %v, want 401", err)
	}
	if f.repo.sessionFor(sid).RevokedAt == nil {
		t.Fatal("reuse must revoke the session")
	}
	if _, _, err := f.refresh(t, user, current); !isUnauthenticated(err) {
		t.Fatalf("the legitimate newest token must be dead too, got %v", err)
	}
	if err := f.authorized(sid, user, access); !isUnauthenticated(err) {
		t.Fatalf("access tokens of the session must stop at once, got %v", err)
	}
	if reason := f.repo.sessionFor(sid).RevokedReason; reason == nil || *reason != model.SessionRevokedRefreshReuse {
		t.Fatalf("revoked reason = %v, want %q", reason, model.SessionRevokedRefreshReuse)
	}
}

// A client that lost the refresh response retries with the old token: inside
// the grace window that is fine and does not end the session.
func TestSessionRefreshAcceptsTheJustReplacedTokenWithinGrace(t *testing.T) {
	f := newSessionFixture(t)
	user := f.activeUser("a@example.com")
	sid, _, original := f.start(t, user)

	f.clock.Advance(time.Minute)
	if _, _, err := f.refresh(t, user, original); err != nil {
		t.Fatal(err)
	}
	f.clock.Advance(common.RefreshReuseGrace / 2)

	access, refresh, err := f.refresh(t, user, original)
	if err != nil {
		t.Fatalf("retry within grace = %v, want success", err)
	}
	if f.repo.sessionFor(sid).RevokedAt != nil {
		t.Fatal("a retry inside the grace window must not revoke the session")
	}
	if err := f.authorized(sid, user, access); err != nil {
		t.Fatalf("the retried pair must work: %v", err)
	}
	if _, _, err := f.refresh(t, user, refresh); err != nil {
		t.Fatalf("and so must its refresh token: %v", err)
	}
}

// Two refreshes racing with the same token: the loser's compare-and-swap
// fails, it looks again, finds its token is now the previous one (inside
// grace) and succeeds.
func TestSessionRefreshSurvivesLosingARace(t *testing.T) {
	f := newSessionFixture(t)
	user := f.activeUser("a@example.com")
	sid, _, original := f.start(t, user)
	info, _ := f.tokens.ParseRefreshToken(original)

	f.repo.beforeRotate = func() {
		// The competing refresh lands between our read and our write.
		if ok, err := f.repo.Rotate(context.Background(), sid, info.JTI, uuid.NewString(), f.clock.Now().Add(time.Hour)); err != nil || !ok {
			t.Errorf("competing rotate: ok=%v err=%v", ok, err)
		}
	}
	if _, _, err := f.svc.Refresh(context.Background(), user, info); err != nil {
		t.Fatalf("Refresh after losing a race = %v, want success", err)
	}
	if f.repo.sessionFor(sid).RevokedAt != nil {
		t.Fatal("losing a race is not reuse")
	}
}

func TestSessionRefreshNeverOutlivesTheAbsoluteLifetime(t *testing.T) {
	f := newSessionFixture(t)
	user := f.activeUser("a@example.com")
	sid, _, refresh := f.start(t, user)

	// Keep the session alive by refreshing every 6 days until just before the
	// 30-day hard stop.
	for day := 6; day <= 24; day += 6 {
		f.clock.Advance(6 * 24 * time.Hour)
		_, next, err := f.refresh(t, user, refresh)
		if err != nil {
			t.Fatalf("refresh on day %d: %v", day, err)
		}
		refresh = next
	}
	stored := f.repo.sessionFor(sid)
	if stored.ExpiresAt.After(stored.AbsoluteExpiresAt) {
		t.Fatalf("idle expiry %v must never pass the absolute %v", stored.ExpiresAt, stored.AbsoluteExpiresAt)
	}

	f.clock.Advance(7 * 24 * time.Hour) // day 31
	if _, _, err := f.refresh(t, user, refresh); !isUnauthenticated(err) {
		t.Fatalf("refresh past the absolute lifetime = %v, want 401", err)
	}
}

func TestSessionRefreshAfterIdleExpiryFails(t *testing.T) {
	f := newSessionFixture(t)
	user := f.activeUser("a@example.com")
	_, _, refresh := f.start(t, user)

	f.clock.Advance(common.RefreshTokenTTL + time.Minute)
	if _, _, err := f.refresh(t, user, refresh); !isUnauthenticated(err) {
		t.Fatalf("refresh after 7 idle days = %v, want 401", err)
	}
}

func TestSessionRefreshRejectsOtherUsersAndUnknownSessions(t *testing.T) {
	f := newSessionFixture(t)
	alice, mallory := f.activeUser("alice@example.com"), f.activeUser("mallory@example.com")
	_, _, aliceRefresh := f.start(t, alice)

	if _, _, err := f.refresh(t, mallory, aliceRefresh); !isUnauthenticated(err) {
		t.Fatalf("a refresh token presented for another user = %v, want 401", err)
	}

	info, _ := f.tokens.ParseRefreshToken(aliceRefresh)
	info.SessionID = uuid.NewString()
	if _, _, err := f.svc.Refresh(context.Background(), alice, info); !isUnauthenticated(err) {
		t.Fatalf("an unknown session = %v, want 401", err)
	}
	info.SessionID = "not-a-uuid"
	if _, _, err := f.svc.Refresh(context.Background(), alice, info); !isUnauthenticated(err) {
		t.Fatalf("a malformed session id = %v, want 401", err)
	}
}

func TestSessionAuthorizeRefusesWhatShouldBeDead(t *testing.T) {
	cases := []struct {
		name    string
		endWith func(f *sessionFixture, user *model.User, sid uuid.UUID)
	}{
		{"revoked", func(f *sessionFixture, user *model.User, sid uuid.UUID) {
			_ = f.svc.End(context.Background(), sid, user.ID, model.SessionRevokedLogout)
		}},
		{"user disabled", func(f *sessionFixture, user *model.User, _ uuid.UUID) {
			f.users.setStatus(user.ID, model.UserStatusDisabled)
		}},
		{"signed out everywhere after issue", func(f *sessionFixture, user *model.User, _ uuid.UUID) {
			f.users.setTokensValidAfter(user.ID, time.Now().Add(time.Hour))
		}},
		{"idle expired", func(f *sessionFixture, _ *model.User, _ uuid.UUID) {
			f.clock.Advance(common.RefreshTokenTTL + time.Minute)
		}},
		{"absolute expired", func(f *sessionFixture, _ *model.User, _ uuid.UUID) {
			f.clock.Advance(common.SessionAbsoluteTTL + time.Minute)
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newSessionFixture(t)
			user := f.activeUser("a@example.com")
			sid, access, _ := f.start(t, user)
			if err := f.authorized(sid, user, access); err != nil {
				t.Fatalf("before: %v", err)
			}

			tc.endWith(f, user, sid)

			if err := f.authorized(sid, user, access); !isUnauthenticated(err) {
				t.Fatalf("Authorize = %v, want 401", err)
			}
		})
	}
}

func TestSessionAuthorizeRefusesAnotherUsersSessionId(t *testing.T) {
	f := newSessionFixture(t)
	alice, bob := f.activeUser("alice@example.com"), f.activeUser("bob@example.com")
	aliceSession, _, _ := f.start(t, alice)

	// A token naming Bob's user_id but Alice's session id.
	_, err := f.svc.Authorize(context.Background(), aliceSession, bob.ID, jwt.NewNumericDate(time.Now()))
	if !isUnauthenticated(err) {
		t.Fatalf("Authorize = %v, want 401", err)
	}
}

// A failure to ask is not "unauthenticated": clients sign out on 401.
func TestSessionAuthorizeDatabaseErrorIsNot401(t *testing.T) {
	f := newSessionFixture(t)
	user := f.activeUser("a@example.com")
	sid, access, _ := f.start(t, user)

	f.repo.failAuthState = errors.New("connection reset")
	err := f.authorized(sid, user, access)
	if err == nil || isUnauthenticated(err) {
		t.Fatalf("Authorize = %v, want a non-401 error", err)
	}
	var appErr *common.AppError
	if errors.As(err, &appErr) {
		t.Fatalf("a database failure must not surface as an AppError: %v", appErr)
	}
}

func TestSessionEndAndEndAll(t *testing.T) {
	f := newSessionFixture(t)
	user, other := f.activeUser("a@example.com"), f.activeUser("b@example.com")
	first, firstAccess, _ := f.start(t, user)
	second, secondAccess, _ := f.start(t, user)
	otherSession, otherAccess, _ := f.start(t, other)

	if err := f.svc.End(context.Background(), first, user.ID, model.SessionRevokedLogout); err != nil {
		t.Fatal(err)
	}
	if err := f.svc.End(context.Background(), first, user.ID, model.SessionRevokedLogout); err != nil {
		t.Fatalf("ending an ended session must be a no-op, got %v", err)
	}
	if err := f.svc.End(context.Background(), otherSession, user.ID, model.SessionRevokedLogout); err != nil {
		t.Fatal(err)
	}
	if err := f.authorized(otherSession, other, otherAccess); err != nil {
		t.Fatalf("End with the wrong user id must not touch another user's session: %v", err)
	}
	if err := f.authorized(first, user, firstAccess); !isUnauthenticated(err) {
		t.Fatalf("ended session: %v", err)
	}
	if err := f.authorized(second, user, secondAccess); err != nil {
		t.Fatalf("End must only end the one session: %v", err)
	}

	if err := f.svc.EndAll(context.Background(), user.ID, model.SessionRevokedSignOutAll); err != nil {
		t.Fatal(err)
	}
	if err := f.authorized(second, user, secondAccess); !isUnauthenticated(err) {
		t.Fatalf("EndAll left a session alive: %v", err)
	}
	if err := f.authorized(otherSession, other, otherAccess); err != nil {
		t.Fatalf("EndAll must not touch other users: %v", err)
	}
}
