package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

func expectAppErrCode(t *testing.T, err error, code string) {
	t.Helper()
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != code {
		t.Fatalf("expected %s, got %v", code, err)
	}
}

func TestUserService_InviteUser_EmailIsCaseInsensitive(t *testing.T) {
	svc, _ := newTestUserService(t)
	adminID := uuid.New()

	user, err := svc.InviteUser(context.Background(), adminID, "  User@Gmail.com ", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if user.Email != "user@gmail.com" {
		t.Fatalf("expected email stored lowercase, got %q", user.Email)
	}

	_, err = svc.InviteUser(context.Background(), adminID, "user@gmail.com", "")
	expectAppErrCode(t, err, common.ErrCodeEmailAlreadyExists)
}

func TestUserService_ResendInvite(t *testing.T) {
	ctx := context.Background()

	t.Run("first resend waits 1 minute, later ones 30 minutes", func(t *testing.T) {
		svc, repo := newTestUserService(t)
		invited, err := svc.InviteUser(ctx, uuid.New(), "wait@example.com", "")
		if err != nil {
			t.Fatalf("setup invite failed: %v", err)
		}

		originalToken := *invited.InviteToken
		_, err = svc.ResendInvite(ctx, invited.ID)
		expectAppErrCode(t, err, common.ErrCodeInviteResendCooldown)

		repo.backdateInviteSentAt(invited.ID, common.InviteResendFirstCooldown+time.Second)
		resent, err := svc.ResendInvite(ctx, invited.ID)
		if err != nil {
			t.Fatalf("first resend after 1 minute should succeed: %v", err)
		}
		if resent.InviteResendCount != 1 || *resent.InviteToken == originalToken {
			t.Fatalf("expected count 1 and a rotated token, got count %d", resent.InviteResendCount)
		}

		// One minute is no longer enough once the first resend is used up.
		repo.backdateInviteSentAt(invited.ID, common.InviteResendFirstCooldown+time.Second)
		_, err = svc.ResendInvite(ctx, invited.ID)
		expectAppErrCode(t, err, common.ErrCodeInviteResendCooldown)

		repo.backdateInviteSentAt(invited.ID, common.InviteResendCooldown)
		if _, err := svc.ResendInvite(ctx, invited.ID); err != nil {
			t.Fatalf("second resend after 30 minutes should succeed: %v", err)
		}
	})

	t.Run("old token stops working after resend", func(t *testing.T) {
		svc, repo := newTestUserService(t)
		invited, _ := svc.InviteUser(ctx, uuid.New(), "rotate@example.com", "")
		originalToken := *invited.InviteToken
		repo.backdateInviteSentAt(invited.ID, common.InviteResendFirstCooldown)
		if _, err := svc.ResendInvite(ctx, invited.ID); err != nil {
			t.Fatalf("resend failed: %v", err)
		}
		if _, err := repo.GetUserByInviteToken(ctx, originalToken); err == nil {
			t.Fatalf("expected the previous invite token to be invalidated")
		}
	})

	t.Run("active user cannot be re-invited", func(t *testing.T) {
		svc, repo := newTestUserService(t)
		seedActiveUser(t, repo, "done@example.com", "correcthorse1", model.UserStatusActive)
		active, _ := repo.GetUserByEmail(ctx, "done@example.com")
		_, err := svc.ResendInvite(ctx, active.ID)
		expectAppErrCode(t, err, common.ErrCodeUserNotPending)
	})

	t.Run("unknown user is not found", func(t *testing.T) {
		svc, _ := newTestUserService(t)
		_, err := svc.ResendInvite(ctx, uuid.New())
		expectAppErrCode(t, err, common.ErrCodeNotFound)
	})
}

func TestAuthService_Login_EmailIsCaseInsensitive(t *testing.T) {
	svc, repo, _ := newTestAuthService(t)
	seedActiveUser(t, repo, "user@gmail.com", "correcthorse1", model.UserStatusActive)

	if _, _, _, err := svc.Login(context.Background(), " User@Gmail.com", "correcthorse1", nil); err != nil {
		t.Fatalf("login with a differently-cased email should succeed: %v", err)
	}
}
