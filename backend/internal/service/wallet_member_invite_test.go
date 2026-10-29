package service

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// Shared wallets, invited by email (2026-10-29): an address with no account
// gets a pending account in the invitation's transaction and an email
// carrying its activation link.

func TestWalletInvite_NewEmailCreatesPendingAccount(t *testing.T) {
	f := newSharedWalletFixture(t)

	member, err := f.svc.Invite(context.Background(), f.owner.ID, f.wallet.ID, "  Moi@Example.com ", model.WalletMemberRoleEditor)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	created, ok := f.users.byEmail["moi@example.com"]
	if !ok {
		t.Fatalf("expected a pending account for the invited address")
	}
	if created.Status != model.UserStatusPending || created.Role != model.UserRoleMember {
		t.Fatalf("expected a pending member account, got status=%s role=%s", created.Status, created.Role)
	}
	if created.InvitedBy == nil || *created.InvitedBy != f.owner.ID {
		t.Fatalf("expected the account to be invited by the wallet owner")
	}
	if member.UserID != created.ID || member.Status != model.WalletMemberStatusPending || !member.AccountPending {
		t.Fatalf("unexpected member: %+v", member)
	}
	if len(walletNotifications) != 1 || walletNotifications[0].UserID != created.ID {
		t.Fatalf("expected the invitation waiting for the new account, got %+v", walletNotifications)
	}
	sent := f.email.next(t)
	if sent.kind != "wallet-invite" || sent.to != "moi@example.com" || sent.token != *created.InviteToken {
		t.Fatalf("expected the activation link mailed to the address, got %+v", sent)
	}
}

// An account invited before but never activated: still a valid link, so the
// same one is mailed again rather than invalidating the earlier email.
func TestWalletInvite_PendingAccountKeepsValidLink(t *testing.T) {
	f := newSharedWalletFixture(t)
	pending, err := f.users.CreatePendingUser(context.Background(), "cho@example.com", model.UserRoleMember, uuid.New(), "token-still-valid")
	if err != nil {
		t.Fatalf("seed: %v", err)
	}

	member, err := f.svc.Invite(context.Background(), f.owner.ID, f.wallet.ID, "cho@example.com", model.WalletMemberRoleViewer)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if member.UserID != pending.ID || !member.AccountPending {
		t.Fatalf("expected the invitation on the existing pending account, got %+v", member)
	}
	if sent := f.email.next(t); sent.token != "token-still-valid" {
		t.Fatalf("expected the still-valid link, got %+v", sent)
	}
}

func TestWalletInvite_PendingAccountExpiredLinkIsRenewed(t *testing.T) {
	f := newSharedWalletFixture(t)
	pending, err := f.users.CreatePendingUser(context.Background(), "het@example.com", model.UserRoleMember, uuid.New(), "token-expired")
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	expired := time.Now().Add(-time.Hour)
	pending.InviteExpiresAt = &expired

	if _, err := f.svc.Invite(context.Background(), f.owner.ID, f.wallet.ID, "het@example.com", model.WalletMemberRoleViewer); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	sent := f.email.next(t)
	if sent.token == "token-expired" || sent.token != *f.users.byEmail["het@example.com"].InviteToken {
		t.Fatalf("expected a renewed link, got %+v", sent)
	}
}

func TestWalletInvite_ActiveAccountGetsNoEmail(t *testing.T) {
	f := newSharedWalletFixture(t)
	seedWalletUser(f.users, f.wallets, "binh@example.com", "binh", "Bình")

	member, err := f.svc.Invite(context.Background(), f.owner.ID, f.wallet.ID, "binh@example.com", model.WalletMemberRoleEditor)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if member.AccountPending {
		t.Fatalf("an active account is not pending")
	}
	select {
	case sent := <-f.email.sent:
		t.Fatalf("expected no email for an active account, got %+v", sent)
	case <-time.After(50 * time.Millisecond):
	}
}

func TestWalletInvite_MalformedEmailIsNotFound(t *testing.T) {
	f := newSharedWalletFixture(t)
	_, err := f.svc.Invite(context.Background(), f.owner.ID, f.wallet.ID, "a@@example.com", model.WalletMemberRoleEditor)
	assertAppErrCode(t, err, common.ErrCodeWalletMemberUserNotFound)
	if len(f.users.byEmail) != 1 {
		t.Fatalf("no account may be created for a malformed address")
	}
}
