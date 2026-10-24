package service

import (
	"context"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

const testNewPassword = "brandnew-pass"

var sixDigits = regexp.MustCompile(`^[0-9]{6}$`)

type resetFixture struct {
	*switchFixture
	clock *testClock
	codes *fakePasswordResetRepo
	email *recordingEmailSender
	svc   *PasswordResetService
}

func newResetFixture(t *testing.T) *resetFixture {
	t.Helper()
	f := newSwitchFixture(t)
	clock := newTestClock()
	codes := newFakePasswordResetRepo(f.users, clock)
	email := newRecordingEmailSender()
	svc := NewPasswordResetService(f.users, codes, testSwitchSigningKey, email, f.sessionSvc, zap.NewNop())
	svc.now = clock.Now
	return &resetFixture{switchFixture: f, clock: clock, codes: codes, email: email, svc: svc}
}

// request asks for a code and waits for the background work to finish.
func (f *resetFixture) request(t *testing.T, identifier string) {
	t.Helper()
	if err := f.svc.RequestReset(context.Background(), identifier); err != nil {
		t.Fatalf("RequestReset(%q) = %v, want nil", identifier, err)
	}
	f.svc.inflight.Wait()
}

// requestCode asks for a code and returns the one emailed.
func (f *resetFixture) requestCode(t *testing.T, identifier string) sentEmail {
	t.Helper()
	f.request(t, identifier)
	select {
	case sent := <-f.email.sent:
		if sent.kind != "reset" || !sixDigits.MatchString(sent.token) {
			t.Fatalf("email = %+v, want a 6-digit reset code", sent)
		}
		return sent
	default:
		t.Fatalf("no code was emailed for %q", identifier)
		return sentEmail{}
	}
}

func (f *resetFixture) noEmail(t *testing.T) {
	t.Helper()
	f.svc.inflight.Wait()
	select {
	case e := <-f.email.sent:
		t.Fatalf("sent %+v, want nothing", e)
	default:
	}
}

// otherCode is a well-formed code that is not the one sent.
func otherCode(code string) string {
	if code == "000000" {
		return "111111"
	}
	return "000000"
}

// S-FPW-01, S-FPW-10, S-FPW-14, S-FPW-18.
func TestPasswordReset_RequestThenConfirm(t *testing.T) {
	ctx := context.Background()
	f := newResetFixture(t)
	user := seedUserWithPassword(t, f.users, "a@example.com", testCurrentPassword)
	var others []string
	for i := 0; i < 2; i++ {
		_, _, refresh, err := f.auth.Login(ctx, "a@example.com", testCurrentPassword, &model.SessionDevice{ID: uuid.New()})
		if err != nil {
			t.Fatalf("Login: %v", err)
		}
		others = append(others, refresh)
	}

	sent := f.requestCode(t, " A@Example.com ")
	if sent.to != "a@example.com" || f.codes.count(user.ID) != 1 {
		t.Fatalf("email to %q, %d codes; want one code to a@example.com", sent.to, f.codes.count(user.ID))
	}

	phone := &model.SessionDevice{ID: uuid.New(), Name: "Pixel 8"}
	got, _, refresh, err := f.svc.ConfirmReset(ctx, "a@example.com", sent.token, testNewPassword, phone)
	if err != nil || got.ID != user.ID {
		t.Fatalf("ConfirmReset: user %v, err %v", got, err)
	}
	if _, _, err := f.auth.Refresh(ctx, refresh, phone); err != nil {
		t.Fatalf("this phone's new session: %v", err)
	}
	for _, old := range others {
		_, _, err := f.auth.Refresh(ctx, old, nil)
		wantAppCode(t, err, common.ErrCodeUnauthenticated)
	}
	_, _, _, err = f.auth.Login(ctx, "a@example.com", testCurrentPassword, nil)
	wantAppCode(t, err, common.ErrCodeInvalidCredentials)
	if _, _, _, err := f.auth.Login(ctx, "a@example.com", testNewPassword, nil); err != nil {
		t.Fatalf("new password: %v", err)
	}

	// Single use.
	_, _, _, err = f.svc.ConfirmReset(ctx, "a@example.com", sent.token, "another-pass1", nil)
	wantAppCode(t, err, common.ErrCodeResetCodeInvalid)
}

// S-FPW-02: the identifier is read like login reads it.
func TestPasswordReset_ByUsername(t *testing.T) {
	f := newResetFixture(t)
	seedUser(f.users, "lan@example.com", model.UserStatusActive)
	f.users.mu.Lock()
	name := "lan"
	f.users.byEmail["lan@example.com"].Username = &name
	f.users.mu.Unlock()

	sent := f.requestCode(t, "LAN ")
	if sent.to != "lan@example.com" {
		t.Fatalf("email to %q, want the account's email", sent.to)
	}
	if _, _, _, err := f.svc.ConfirmReset(context.Background(), "lan", sent.token, testNewPassword, nil); err != nil {
		t.Fatalf("ConfirmReset by username: %v", err)
	}
}

// S-FPW-03, S-FPW-04, S-FPW-16: nothing tells an unknown or inactive account
// apart from a real one.
func TestPasswordReset_IneligibleAccountsAreSilent(t *testing.T) {
	ctx := context.Background()
	f := newResetFixture(t)
	var ids []uuid.UUID
	for email, status := range map[string]model.UserStatus{
		"pending@example.com":   model.UserStatusPending,
		"requested@example.com": model.UserStatusRequested,
		"disabled@example.com":  model.UserStatusDisabled,
	} {
		ids = append(ids, seedUser(f.users, email, status).ID)
	}
	for _, identifier := range []string{"nobody@example.com", "nobody", "pending@example.com", "requested@example.com", "disabled@example.com"} {
		f.request(t, identifier)
		_, _, _, err := f.svc.ConfirmReset(ctx, identifier, "123456", testNewPassword, nil)
		wantAppCode(t, err, common.ErrCodeResetCodeInvalid)
	}
	for _, id := range ids {
		if n := f.codes.count(id); n != 0 {
			t.Fatalf("an inactive account got %d codes", n)
		}
	}
	f.noEmail(t)

	// An active account that never asked answers the same.
	seedUser(f.users, "a@example.com", model.UserStatusActive)
	_, _, _, err := f.svc.ConfirmReset(ctx, "a@example.com", "123456", testNewPassword, nil)
	wantAppCode(t, err, common.ErrCodeResetCodeInvalid)
}

// S-FPW-05, S-FPW-06 and the hourly cap (BR-05).
func TestPasswordReset_CooldownAndHourlyCap(t *testing.T) {
	ctx := context.Background()
	f := newResetFixture(t)
	user := seedUser(f.users, "a@example.com", model.UserStatusActive)

	first := f.requestCode(t, "a@example.com")
	f.clock.Advance(20 * time.Second)
	f.request(t, "a@example.com")
	f.noEmail(t)

	f.clock.Advance(2 * time.Minute)
	second := f.requestCode(t, "a@example.com")
	if second.token != first.token {
		_, _, _, err := f.svc.ConfirmReset(ctx, "a@example.com", first.token, testNewPassword, nil)
		wantAppCode(t, err, common.ErrCodeResetCodeInvalid)
	}

	for i := 0; i < common.ResetCodeHourlyMax-2; i++ {
		f.clock.Advance(common.ResetCodeCooldown + time.Second)
		f.requestCode(t, "a@example.com")
	}
	f.clock.Advance(common.ResetCodeCooldown + time.Second)
	f.request(t, "a@example.com")
	f.noEmail(t)
	if n := f.codes.count(user.ID); n != common.ResetCodeHourlyMax {
		t.Fatalf("%d codes, want %d", n, common.ResetCodeHourlyMax)
	}

	f.clock.Advance(time.Hour)
	last := f.requestCode(t, "a@example.com")
	if _, _, _, err := f.svc.ConfirmReset(ctx, "a@example.com", last.token, testNewPassword, nil); err != nil {
		t.Fatalf("newest code: %v", err)
	}
}

// S-FPW-11, S-FPW-12: the 5th wrong try ends the code.
func TestPasswordReset_WrongTriesEndTheCode(t *testing.T) {
	ctx := context.Background()
	f := newResetFixture(t)
	user := seedUser(f.users, "a@example.com", model.UserStatusActive)
	sent := f.requestCode(t, "a@example.com")
	wrong := otherCode(sent.token)

	for i := int32(1); i <= common.ResetCodeMaxTries; i++ {
		_, _, _, err := f.svc.ConfirmReset(ctx, "a@example.com", wrong, testNewPassword, nil)
		wantAppCode(t, err, common.ErrCodeResetCodeInvalid)
		if got := f.codes.attempts(user.ID); got != i {
			t.Fatalf("after %d wrong tries the count is %d", i, got)
		}
	}
	_, _, _, err := f.svc.ConfirmReset(ctx, "a@example.com", sent.token, testNewPassword, nil)
	wantAppCode(t, err, common.ErrCodeResetCodeInvalid)
}

// S-FPW-13.
func TestPasswordReset_ExpiredCode(t *testing.T) {
	f := newResetFixture(t)
	seedUser(f.users, "a@example.com", model.UserStatusActive)
	sent := f.requestCode(t, "a@example.com")
	f.clock.Advance(common.ResetCodeTTL + time.Minute)
	_, _, _, err := f.svc.ConfirmReset(context.Background(), "a@example.com", sent.token, testNewPassword, nil)
	wantAppCode(t, err, common.ErrCodeResetCodeInvalid)
}

// S-FPW-15: a refused password spends no try.
func TestPasswordReset_WeakPasswordSpendsNoTry(t *testing.T) {
	ctx := context.Background()
	f := newResetFixture(t)
	user := seedUser(f.users, "a@example.com", model.UserStatusActive)
	sent := f.requestCode(t, "a@example.com")

	for _, password := range []string{"short", strings.Repeat("a", common.MaxPasswordBytes+1)} {
		_, _, _, err := f.svc.ConfirmReset(ctx, "a@example.com", otherCode(sent.token), password, nil)
		wantAppCode(t, err, common.ErrCodeWeakPassword)
	}
	if got := f.codes.attempts(user.ID); got != 0 {
		t.Fatalf("tries = %d, want 0", got)
	}
	if _, _, _, err := f.svc.ConfirmReset(ctx, "a@example.com", sent.token, testNewPassword, nil); err != nil {
		t.Fatalf("right code after refused passwords: %v", err)
	}
}

// S-FPW-17: the same code confirmed twice at once works once.
func TestPasswordReset_ConcurrentConfirmWinsOnce(t *testing.T) {
	f := newResetFixture(t)
	seedUser(f.users, "a@example.com", model.UserStatusActive)
	sent := f.requestCode(t, "a@example.com")

	var wg sync.WaitGroup
	results := make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _, _, err := f.svc.ConfirmReset(context.Background(), "a@example.com", sent.token, testNewPassword, nil)
			results <- err
		}()
	}
	wg.Wait()
	close(results)
	wins := 0
	for err := range results {
		if err == nil {
			wins++
			continue
		}
		wantAppCode(t, err, common.ErrCodeResetCodeInvalid)
	}
	if wins != 1 {
		t.Fatalf("%d confirms succeeded, want exactly 1", wins)
	}
}
