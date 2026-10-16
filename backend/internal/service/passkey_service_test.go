package service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

const (
	testRPID = "passkeys.test"
	// What Android's Credential Manager sends for a native app.
	testAndroidOrigin = "android:apk-key-hash:Q2hlY2tpbmdUaGVBbmRyb2lkT3JpZ2luUGF0aDEyMzQ"
)

type passkeyFixture struct {
	svc   *PasskeyService
	users *fakeUserRepo
	repo  *fakePasskeyRepo
}

func newPasskeyFixture(t *testing.T) passkeyFixture {
	t.Helper()
	users := newFakeUserRepo()
	repo := newFakePasskeyRepo()
	clock := newTestClock()
	sessions := NewSessionService(newFakeSessionRepo(clock, users), NewTokenService("test-signing-key-not-for-production"), zap.NewNop())
	sessions.now = clock.Now
	svc, err := NewPasskeyService(&PasskeyRelyingParty{
		ID: testRPID, Origins: []string{"https://" + testRPID}, AndroidOrigins: []string{testAndroidOrigin},
	}, repo, users, sessions, zap.NewNop())
	if err != nil {
		t.Fatalf("NewPasskeyService: %v", err)
	}
	return passkeyFixture{svc: svc, users: users, repo: repo}
}

func (f passkeyFixture) addUser(email string, status model.UserStatus) *model.User {
	u := &model.User{ID: uuid.New(), Email: email, Status: status, Role: model.UserRoleMember}
	f.users.mu.Lock()
	f.users.byEmail[email] = u
	f.users.mu.Unlock()
	return u
}

// register runs a whole registration for user on a fresh phone.
func (f passkeyFixture) register(t *testing.T, user *model.User) *virtualAuthenticator {
	t.Helper()
	ctx := context.Background()
	phone := newVirtualAuthenticator(t, testRPID, testAndroidOrigin)
	challengeID, options, err := f.svc.BeginRegistration(ctx, user.ID)
	if err != nil {
		t.Fatalf("BeginRegistration: %v", err)
	}
	if _, err := f.svc.FinishRegistration(ctx, user.ID, challengeID, phone.create(options), "Pixel 8"); err != nil {
		t.Fatalf("FinishRegistration: %v", err)
	}
	return phone
}

func (f passkeyFixture) login(t *testing.T, phone *virtualAuthenticator, forUser *uuid.UUID) (*model.User, error) {
	t.Helper()
	ctx := context.Background()
	challengeID, options, err := f.svc.BeginLogin(ctx, forUser)
	if err != nil {
		return nil, err
	}
	user, access, refresh, err := f.svc.FinishLogin(ctx, challengeID, phone.get(options))
	if err == nil && (access == "" || refresh == "") {
		t.Fatal("a passkey sign-in must start a session")
	}
	return user, err
}

func TestPasskey_RegisterThenDiscoverableSignIn(t *testing.T) {
	f := newPasskeyFixture(t)
	user := f.addUser("an@example.com", model.UserStatusActive)
	phone := f.register(t, user)

	got, err := f.login(t, phone, nil)
	if err != nil {
		t.Fatalf("sign-in: %v", err)
	}
	if got.ID != user.ID {
		t.Fatalf("signed in as %s, want %s", got.ID, user.ID)
	}
	list, _ := f.svc.List(context.Background(), user.ID)
	if len(list) != 1 || list[0].Name != "Pixel 8" || list[0].LastUsedAt == nil {
		t.Fatalf("expected one used passkey named Pixel 8, got %+v", list)
	}
}

func TestPasskey_SignInForSavedAccount(t *testing.T) {
	f := newPasskeyFixture(t)
	a := f.addUser("a@example.com", model.UserStatusActive)
	b := f.addUser("b@example.com", model.UserStatusActive)
	phoneA := f.register(t, a)
	phoneB := f.register(t, b)

	if got, err := f.login(t, phoneA, &a.ID); err != nil || got.ID != a.ID {
		t.Fatalf("switch to A with A's passkey: user=%v err=%v", got, err)
	}
	// Switching to A must never succeed with B's passkey.
	if _, err := f.login(t, phoneB, &a.ID); !errors.Is(err, common.ErrPasskeyFailed) {
		t.Fatalf("B's passkey for A: want ErrPasskeyFailed, got %v", err)
	}
}

func TestPasskey_ChallengeIsSingleUse(t *testing.T) {
	f := newPasskeyFixture(t)
	user := f.addUser("an@example.com", model.UserStatusActive)
	phone := f.register(t, user)
	ctx := context.Background()

	challengeID, options, err := f.svc.BeginLogin(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	answer := phone.get(options)
	if _, _, _, err := f.svc.FinishLogin(ctx, challengeID, answer); err != nil {
		t.Fatalf("first answer: %v", err)
	}
	if _, _, _, err := f.svc.FinishLogin(ctx, challengeID, answer); !errors.Is(err, common.ErrPasskeyFailed) {
		t.Fatalf("replayed answer: want ErrPasskeyFailed, got %v", err)
	}
}

func TestPasskey_RegistrationBelongsToItsStarter(t *testing.T) {
	f := newPasskeyFixture(t)
	a := f.addUser("a@example.com", model.UserStatusActive)
	b := f.addUser("b@example.com", model.UserStatusActive)
	ctx := context.Background()

	challengeID, options, err := f.svc.BeginRegistration(ctx, a.ID)
	if err != nil {
		t.Fatal(err)
	}
	phone := newVirtualAuthenticator(t, testRPID, testAndroidOrigin)
	if _, err := f.svc.FinishRegistration(ctx, b.ID, challengeID, phone.create(options), ""); !errors.Is(err, common.ErrPasskeyFailed) {
		t.Fatalf("finishing A's registration as B: want ErrPasskeyFailed, got %v", err)
	}
}

func TestPasskey_WrongOriginRejected(t *testing.T) {
	f := newPasskeyFixture(t)
	user := f.addUser("an@example.com", model.UserStatusActive)
	ctx := context.Background()
	challengeID, options, err := f.svc.BeginRegistration(ctx, user.ID)
	if err != nil {
		t.Fatal(err)
	}
	impostor := newVirtualAuthenticator(t, testRPID, "android:apk-key-hash:SomeOtherAppSigningKeyHashThatIsNotOurs000")
	if _, err := f.svc.FinishRegistration(ctx, user.ID, challengeID, impostor.create(options), ""); !errors.Is(err, common.ErrPasskeyFailed) {
		t.Fatalf("another app's origin: want ErrPasskeyFailed, got %v", err)
	}
}

func TestPasskey_DisabledAccountCannotSignIn(t *testing.T) {
	f := newPasskeyFixture(t)
	user := f.addUser("an@example.com", model.UserStatusActive)
	phone := f.register(t, user)
	f.users.mu.Lock()
	f.users.byEmail[user.Email].Status = model.UserStatusDisabled
	f.users.mu.Unlock()

	if _, err := f.login(t, phone, nil); !errors.Is(err, common.ErrAccountDisabled) {
		t.Fatalf("want ErrAccountDisabled, got %v", err)
	}
}

func TestPasskey_BeginLoginForAccountWithoutPasskeys(t *testing.T) {
	f := newPasskeyFixture(t)
	user := f.addUser("an@example.com", model.UserStatusActive)
	if _, _, err := f.svc.BeginLogin(context.Background(), &user.ID); !errors.Is(err, common.ErrPasskeyNotFound) {
		t.Fatalf("want ErrPasskeyNotFound, got %v", err)
	}
}

func TestPasskey_DeleteOnlyOwn(t *testing.T) {
	f := newPasskeyFixture(t)
	a := f.addUser("a@example.com", model.UserStatusActive)
	b := f.addUser("b@example.com", model.UserStatusActive)
	f.register(t, a)
	ctx := context.Background()
	list, _ := f.svc.List(ctx, a.ID)

	if err := f.svc.Delete(ctx, b.ID, list[0].ID); !errors.Is(err, common.ErrPasskeyNotFound) {
		t.Fatalf("deleting another account's passkey: want ErrPasskeyNotFound, got %v", err)
	}
	if err := f.svc.Delete(ctx, a.ID, list[0].ID); err != nil {
		t.Fatalf("deleting own passkey: %v", err)
	}
}

func TestPasskey_OffWithoutRelyingParty(t *testing.T) {
	svc, err := NewPasskeyService(nil, newFakePasskeyRepo(), newFakeUserRepo(), nil, zap.NewNop())
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := svc.BeginLogin(context.Background(), nil); !errors.Is(err, common.ErrPasskeysUnavailable) {
		t.Fatalf("want ErrPasskeysUnavailable, got %v", err)
	}
}

func TestPasskeyName(t *testing.T) {
	if got := passkeyName("   "); got != "Điện thoại" {
		t.Errorf("blank name: got %q", got)
	}
	long := string(make([]rune, common.PasskeyNameMaxLength+5))
	if got := []rune(passkeyName(long + "x")); len(got) != common.PasskeyNameMaxLength {
		t.Errorf("long name: got %d runes", len(got))
	}
}
