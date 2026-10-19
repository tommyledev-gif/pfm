package service

import (
	"context"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

const testCurrentPassword = "correcthorse1"

// seedUserWithPassword is seedUser with a real (cheap) bcrypt hash, so Login
// and ChangePassword can check it.
func seedUserWithPassword(t *testing.T, repo *fakeUserRepo, email, password string) *model.User {
	t.Helper()
	user := seedUser(repo, email, model.UserStatusActive)
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	repo.mu.Lock()
	h := string(hash)
	repo.byEmail[email].PasswordHash = &h
	repo.mu.Unlock()
	return user
}

func TestChangePassword_Refusals(t *testing.T) {
	ctx := context.Background()
	f := newSwitchFixture(t)
	user := seedUserWithPassword(t, f.users, "a@example.com", testCurrentPassword)
	_, _, refresh, err := f.auth.Login(ctx, "a@example.com", testCurrentPassword, nil)
	if err != nil {
		t.Fatalf("Login: %v", err)
	}
	now := jwt.NewNumericDate(time.Now().UTC())

	_, err = f.sessions.ChangePassword(ctx, user.ID, now, "wrong-password", "brandnew-pass", nil)
	wantAppCode(t, err, common.ErrCodeWrongCurrentPassword)
	_, err = f.sessions.ChangePassword(ctx, user.ID, now, testCurrentPassword, "short", nil)
	wantAppCode(t, err, common.ErrCodeWeakPassword)
	_, err = f.sessions.ChangePassword(ctx, user.ID, now, testCurrentPassword, testCurrentPassword, nil)
	wantAppCode(t, err, common.ErrCodeSamePassword)

	// Nothing changed: the old session still refreshes, the old password
	// still signs in.
	if _, _, err := f.auth.Refresh(ctx, refresh, nil); err != nil {
		t.Fatalf("refresh after refused changes: %v", err)
	}
	if _, _, _, err := f.auth.Login(ctx, "a@example.com", testCurrentPassword, nil); err != nil {
		t.Fatalf("old password stopped working: %v", err)
	}
}

func TestChangePassword_SignsOutEverywhereButThisDevice(t *testing.T) {
	ctx := context.Background()
	f := newSwitchFixture(t)
	user := seedUserWithPassword(t, f.users, "a@example.com", testCurrentPassword)
	_, _, otherRefresh, err := f.auth.Login(ctx, "a@example.com", testCurrentPassword, &model.SessionDevice{ID: uuid.New()})
	if err != nil {
		t.Fatalf("Login: %v", err)
	}
	oldSwitch := backdatedSwitchToken(t, user.ID, time.Now().UTC().Add(-time.Minute), time.Now().UTC().Add(time.Hour))
	phone := &model.SessionDevice{ID: uuid.New(), Name: "Pixel 8"}

	session, err := f.sessions.ChangePassword(ctx, user.ID, jwt.NewNumericDate(time.Now().UTC()), testCurrentPassword, "brandnew-pass", phone)
	if err != nil {
		t.Fatalf("ChangePassword: %v", err)
	}
	if session.SwitchToken != "" {
		t.Fatal("a password change must not mint a switch token")
	}

	if _, _, err := f.auth.Refresh(ctx, session.RefreshToken, phone); err != nil {
		t.Fatalf("this device's fresh session: %v", err)
	}
	_, _, err = f.auth.Refresh(ctx, otherRefresh, nil)
	wantAppCode(t, err, common.ErrCodeUnauthenticated)
	_, err = f.switches.Switch(ctx, oldSwitch, nil)
	wantAppCode(t, err, common.ErrCodeUnauthenticated)

	_, _, _, err = f.auth.Login(ctx, "a@example.com", testCurrentPassword, nil)
	wantAppCode(t, err, common.ErrCodeInvalidCredentials)
	if _, _, _, err := f.auth.Login(ctx, "a@example.com", "brandnew-pass", nil); err != nil {
		t.Fatalf("new password: %v", err)
	}
}

func TestChangePassword_StaleAccessIsRefused(t *testing.T) {
	ctx := context.Background()
	f := newSwitchFixture(t)
	user := seedUserWithPassword(t, f.users, "a@example.com", testCurrentPassword)
	if _, err := f.users.SetTokensValidAfter(ctx, user.ID, time.Now().UTC()); err != nil {
		t.Fatalf("SetTokensValidAfter: %v", err)
	}
	stale := jwt.NewNumericDate(time.Now().UTC().Add(-time.Hour))
	_, err := f.sessions.ChangePassword(ctx, user.ID, stale, testCurrentPassword, "brandnew-pass", nil)
	wantAppCode(t, err, common.ErrCodeUnauthenticated)
}

// A build that sends a device id keeps the session as the saved account and
// never receives a switch token; an older build without one still does.
func TestSwitchTokenOnlyForClientsWithoutADevice(t *testing.T) {
	ctx := context.Background()
	f := newSwitchFixture(t)
	user := seedUser(f.users, "a@example.com", model.UserStatusActive)
	now := jwt.NewNumericDate(time.Now().UTC())

	legacy, err := f.sessions.RevokeAllForSelf(ctx, user.ID, now, nil)
	if err != nil || legacy.SwitchToken == "" {
		t.Fatalf("without a device: switch token %q, err %v; want one", legacy.SwitchToken, err)
	}
	withDevice, err := f.switches.Switch(ctx, legacy.SwitchToken, &model.SessionDevice{ID: uuid.New()})
	if err != nil {
		t.Fatalf("Switch with a device: %v", err)
	}
	if withDevice.SwitchToken != "" {
		t.Fatal("a client with a device id got a switch token")
	}
	if _, _, err := f.auth.Refresh(ctx, withDevice.RefreshToken, nil); err != nil {
		t.Fatalf("the traded session does not refresh: %v", err)
	}
}
