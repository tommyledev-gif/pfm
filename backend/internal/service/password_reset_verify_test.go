package service

import (
	"context"
	"testing"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// The App's code step: a right code is not used up, so the password step can
// still set the new password with it.
func TestPasswordReset_VerifyKeepsTheCodeLive(t *testing.T) {
	ctx := context.Background()
	f := newResetFixture(t)
	user := seedUser(f.users, "a@example.com", model.UserStatusActive)
	sent := f.requestCode(t, "a@example.com")

	for i := 0; i < 2; i++ {
		if err := f.svc.VerifyCode(ctx, "a@example.com", sent.token); err != nil {
			t.Fatalf("VerifyCode #%d = %v, want nil", i+1, err)
		}
	}
	if got := f.codes.attempts(user.ID); got != 0 {
		t.Fatalf("attempts = %d after right codes, want 0", got)
	}
	if _, _, _, err := f.svc.ConfirmReset(ctx, "a@example.com", sent.token, testNewPassword, nil); err != nil {
		t.Fatalf("ConfirmReset after VerifyCode: %v", err)
	}
	wantAppCode(t, f.svc.VerifyCode(ctx, "a@example.com", sent.token), common.ErrCodeResetCodeInvalid)
}

// BR-04 across both steps: a wrong verify spends a try like a wrong confirm,
// and the last try ends the code for both.
func TestPasswordReset_VerifySpendsTries(t *testing.T) {
	ctx := context.Background()
	f := newResetFixture(t)
	user := seedUser(f.users, "a@example.com", model.UserStatusActive)
	sent := f.requestCode(t, "a@example.com")
	wrong := otherCode(sent.token)

	for i := int32(1); i < common.ResetCodeMaxTries; i++ {
		wantAppCode(t, f.svc.VerifyCode(ctx, "a@example.com", wrong), common.ErrCodeResetCodeInvalid)
		if got := f.codes.attempts(user.ID); got != i {
			t.Fatalf("attempts = %d, want %d", got, i)
		}
	}
	_, _, _, err := f.svc.ConfirmReset(ctx, "a@example.com", wrong, testNewPassword, nil)
	wantAppCode(t, err, common.ErrCodeResetCodeInvalid)

	wantAppCode(t, f.svc.VerifyCode(ctx, "a@example.com", sent.token), common.ErrCodeResetCodeInvalid)
	_, _, _, err = f.svc.ConfirmReset(ctx, "a@example.com", sent.token, testNewPassword, nil)
	wantAppCode(t, err, common.ErrCodeResetCodeInvalid)
}

// BR-02: an unknown identifier and an account with no code answer the same.
func TestPasswordReset_VerifyIneligibleIsSilent(t *testing.T) {
	ctx := context.Background()
	f := newResetFixture(t)
	seedUser(f.users, "a@example.com", model.UserStatusActive)
	seedUser(f.users, "disabled@example.com", model.UserStatusDisabled)

	for _, identifier := range []string{"nobody@example.com", "a@example.com", "disabled@example.com"} {
		wantAppCode(t, f.svc.VerifyCode(ctx, identifier, "123456"), common.ErrCodeResetCodeInvalid)
	}
}
