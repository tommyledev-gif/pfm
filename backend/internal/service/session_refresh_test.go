package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

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
		if ok, err := f.repo.Rotate(context.Background(), sid, info.JTI, uuid.NewString(), f.clock.Now().Add(time.Hour), nil); err != nil || !ok {
			t.Errorf("competing rotate: ok=%v err=%v", ok, err)
		}
	}
	if _, _, err := f.svc.Refresh(context.Background(), user, info, nil); err != nil {
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

	// Keep the session alive by refreshing well inside the idle window until
	// just before the hard stop.
	step := common.RefreshTokenTTL / 2
	elapsed := time.Duration(0)
	for elapsed+step < common.SessionAbsoluteTTL {
		f.clock.Advance(step)
		elapsed += step
		_, next, err := f.refresh(t, user, refresh)
		if err != nil {
			t.Fatalf("refresh after %v: %v", elapsed, err)
		}
		refresh = next
	}
	stored := f.repo.sessionFor(sid)
	if stored.ExpiresAt.After(stored.AbsoluteExpiresAt) {
		t.Fatalf("idle expiry %v must never pass the absolute %v", stored.ExpiresAt, stored.AbsoluteExpiresAt)
	}

	// Past the hard stop, yet still inside the idle window of the last refresh.
	f.clock.Advance(common.SessionAbsoluteTTL - elapsed + 24*time.Hour)
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
	if _, _, err := f.svc.Refresh(context.Background(), alice, info, nil); !isUnauthenticated(err) {
		t.Fatalf("an unknown session = %v, want 401", err)
	}
	info.SessionID = "not-a-uuid"
	if _, _, err := f.svc.Refresh(context.Background(), alice, info, nil); !isUnauthenticated(err) {
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
