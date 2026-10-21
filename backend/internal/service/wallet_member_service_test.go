package service

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// specs/shared-wallets US-01, US-02, US-05.

type sharedWalletFixture struct {
	svc     *WalletMemberService
	wallets *fakeWalletRepo
	users   *fakeUserRepo
	owner   *model.User
	wallet  *model.Wallet
}

func seedWalletUser(users *fakeUserRepo, wallets *fakeWalletRepo, email, username, fullName string) *model.User {
	u := &model.User{ID: uuid.New(), Email: email, Username: &username, FullName: &fullName, Status: model.UserStatusActive, Role: model.UserRoleMember}
	users.byEmail[email] = u
	wallets.userNames[u.ID] = fullName
	return u
}

func newSharedWalletFixture(t *testing.T) *sharedWalletFixture {
	t.Helper()
	walletNotifications = nil
	wallets := newFakeWalletRepo()
	users := newFakeUserRepo()
	owner := seedWalletUser(users, wallets, "an@example.com", "an", "An")
	wallet := &model.Wallet{ID: uuid.New(), UserID: owner.ID, Name: "Chi tiêu nhà", Type: model.WalletTypeCash, Balance: 1_000_000_00, Currency: "VND"}
	wallets.wallets[wallet.ID] = wallet
	return &sharedWalletFixture{
		svc:     NewWalletMemberService(wallets, wallets, users, zap.NewNop()),
		wallets: wallets,
		users:   users,
		owner:   owner,
		wallet:  wallet,
	}
}

// S-SHW-01: invite by tên đăng nhập, pending, the invitee is notified.
func TestWalletMemberService_Invite_CreatesPendingAndNotifies(t *testing.T) {
	f := newSharedWalletFixture(t)
	binh := seedWalletUser(f.users, f.wallets, "binh@example.com", "binh", "Bình")

	member, err := f.svc.Invite(context.Background(), f.owner.ID, f.wallet.ID, "  BINH ", model.WalletMemberRoleEditor)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if member.UserID != binh.ID || member.Status != model.WalletMemberStatusPending || member.Name != "Bình" {
		t.Fatalf("unexpected member: %+v", member)
	}
	if len(walletNotifications) != 1 || walletNotifications[0].UserID != binh.ID || walletNotifications[0].Type != NotificationTypeWalletInvite {
		t.Fatalf("expected one invite notification to the invitee, got %+v", walletNotifications)
	}
}

// S-SHW-03 / S-SHW-04 / S-SHW-05 / S-SHW-06 / S-SHW-07.
func TestWalletMemberService_Invite_Rejections(t *testing.T) {
	f := newSharedWalletFixture(t)
	binh := seedWalletUser(f.users, f.wallets, "binh@example.com", "binh", "Bình")
	ctx := context.Background()

	_, err := f.svc.Invite(ctx, binh.ID, f.wallet.ID, "an@example.com", model.WalletMemberRoleEditor)
	assertAppErrCode(t, err, common.ErrCodeWalletAccessDenied)

	_, err = f.svc.Invite(ctx, f.owner.ID, f.wallet.ID, "nobody@example.com", model.WalletMemberRoleEditor)
	assertAppErrCode(t, err, common.ErrCodeWalletMemberUserNotFound)

	pending := seedWalletUser(f.users, f.wallets, "cuong@example.com", "cuong", "Cường")
	pending.Status = model.UserStatusPending
	_, err = f.svc.Invite(ctx, f.owner.ID, f.wallet.ID, "cuong@example.com", model.WalletMemberRoleEditor)
	assertAppErrCode(t, err, common.ErrCodeWalletMemberUserNotFound)

	_, err = f.svc.Invite(ctx, f.owner.ID, f.wallet.ID, "an@example.com", model.WalletMemberRoleEditor)
	assertAppErrCode(t, err, common.ErrCodeInvalidInput)

	if _, err := f.svc.Invite(ctx, f.owner.ID, f.wallet.ID, "binh@example.com", model.WalletMemberRoleEditor); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	_, err = f.svc.Invite(ctx, f.owner.ID, f.wallet.ID, "binh", model.WalletMemberRoleViewer)
	assertAppErrCode(t, err, common.ErrCodeWalletMemberExists)

	for i := 0; i < common.WalletMemberLimit; i++ {
		f.wallets.seedMember(f.wallet.ID, uuid.New(), model.WalletMemberRoleViewer, model.WalletMemberStatusActive)
	}
	extra := seedWalletUser(f.users, f.wallets, "dung@example.com", "dung", "Dũng")
	_, err = f.svc.Invite(ctx, f.owner.ID, f.wallet.ID, extra.Email, model.WalletMemberRoleEditor)
	assertAppErrCode(t, err, common.ErrCodeWalletMemberLimit)
}

// S-SHW-10 / S-SHW-11 / S-SHW-12 / S-SHW-13.
func TestWalletMemberService_AcceptAndDecline(t *testing.T) {
	f := newSharedWalletFixture(t)
	binh := seedWalletUser(f.users, f.wallets, "binh@example.com", "binh", "Bình")
	ctx := context.Background()
	if _, err := f.svc.Invite(ctx, f.owner.ID, f.wallet.ID, "binh", model.WalletMemberRoleEditor); err != nil {
		t.Fatalf("invite: %v", err)
	}

	invitations, err := f.svc.ListInvitations(ctx, binh.ID)
	if err != nil || len(invitations) != 1 || invitations[0].WalletID != f.wallet.ID || invitations[0].OwnerName != "An" {
		t.Fatalf("expected one invitation from An, got %+v (%v)", invitations, err)
	}

	walletNotifications = nil
	member, err := f.svc.AcceptInvitation(ctx, binh.ID, f.wallet.ID)
	if err != nil || !member.IsActive() {
		t.Fatalf("expected an active member, got %+v (%v)", member, err)
	}
	if len(walletNotifications) != 1 || walletNotifications[0].UserID != f.owner.ID || walletNotifications[0].Type != NotificationTypeWalletMemberJoined {
		t.Fatalf("expected the owner to be notified, got %+v", walletNotifications)
	}
	if again, err := f.svc.AcceptInvitation(ctx, binh.ID, f.wallet.ID); err != nil || !again.IsActive() {
		t.Fatalf("accepting twice must be a no-op, got %+v (%v)", again, err)
	}

	cuong := seedWalletUser(f.users, f.wallets, "cuong@example.com", "cuong", "Cường")
	if _, err := f.svc.Invite(ctx, f.owner.ID, f.wallet.ID, "cuong", model.WalletMemberRoleViewer); err != nil {
		t.Fatalf("invite: %v", err)
	}
	if err := f.svc.DeclineInvitation(ctx, cuong.ID, f.wallet.ID); err != nil {
		t.Fatalf("decline: %v", err)
	}
	_, err = f.svc.AcceptInvitation(ctx, cuong.ID, f.wallet.ID)
	assertAppErrCode(t, err, common.ErrCodeWalletInvitationNotFound)
	// Declined, so the owner may invite again.
	if _, err := f.svc.Invite(ctx, f.owner.ID, f.wallet.ID, "cuong", model.WalletMemberRoleViewer); err != nil {
		t.Fatalf("re-invite after decline: %v", err)
	}
}

// US-05: owner sees pending invitations, a member does not.
func TestWalletMemberService_ListMembers(t *testing.T) {
	f := newSharedWalletFixture(t)
	binh := seedWalletUser(f.users, f.wallets, "binh@example.com", "binh", "Bình")
	cuong := seedWalletUser(f.users, f.wallets, "cuong@example.com", "cuong", "Cường")
	f.wallets.seedMember(f.wallet.ID, binh.ID, model.WalletMemberRoleEditor, model.WalletMemberStatusActive)
	f.wallets.seedMember(f.wallet.ID, cuong.ID, model.WalletMemberRoleViewer, model.WalletMemberStatusPending)
	ctx := context.Background()

	asOwner, err := f.svc.ListMembers(ctx, f.owner.ID, f.wallet.ID)
	if err != nil || asOwner.OwnerName != "An" || len(asOwner.Members) != 2 {
		t.Fatalf("owner should see 2 members, got %+v (%v)", asOwner, err)
	}
	asMember, err := f.svc.ListMembers(ctx, binh.ID, f.wallet.ID)
	if err != nil || len(asMember.Members) != 1 || asMember.Members[0].UserID != binh.ID {
		t.Fatalf("member should see active members only, got %+v (%v)", asMember, err)
	}
	_, err = f.svc.ListMembers(ctx, cuong.ID, f.wallet.ID)
	assertAppErrCode(t, err, common.ErrCodeWalletAccessDenied)
}

// S-SHW-40 / S-SHW-41 / S-SHW-42 / S-SHW-43 / S-SHW-44.
func TestWalletMemberService_RoleAndRemoval(t *testing.T) {
	f := newSharedWalletFixture(t)
	binh := seedWalletUser(f.users, f.wallets, "binh@example.com", "binh", "Bình")
	cuong := seedWalletUser(f.users, f.wallets, "cuong@example.com", "cuong", "Cường")
	f.wallets.seedMember(f.wallet.ID, binh.ID, model.WalletMemberRoleEditor, model.WalletMemberStatusActive)
	f.wallets.seedMember(f.wallet.ID, cuong.ID, model.WalletMemberRoleEditor, model.WalletMemberStatusActive)
	ctx := context.Background()

	updated, err := f.svc.ChangeRole(ctx, f.owner.ID, f.wallet.ID, binh.ID, model.WalletMemberRoleViewer)
	if err != nil || updated.Role != model.WalletMemberRoleViewer {
		t.Fatalf("expected viewer, got %+v (%v)", updated, err)
	}
	_, err = f.svc.ChangeRole(ctx, binh.ID, f.wallet.ID, cuong.ID, model.WalletMemberRoleViewer)
	assertAppErrCode(t, err, common.ErrCodeWalletAccessDenied)

	err = f.svc.RemoveMember(ctx, binh.ID, f.wallet.ID, cuong.ID)
	assertAppErrCode(t, err, common.ErrCodeWalletAccessDenied)
	err = f.svc.RemoveMember(ctx, f.owner.ID, f.wallet.ID, f.owner.ID)
	assertAppErrCode(t, err, common.ErrCodeInvalidInput)

	if err := f.svc.RemoveMember(ctx, cuong.ID, f.wallet.ID, cuong.ID); err != nil {
		t.Fatalf("leave: %v", err)
	}
	if err := f.svc.RemoveMember(ctx, f.owner.ID, f.wallet.ID, binh.ID); err != nil {
		t.Fatalf("remove: %v", err)
	}
	err = f.svc.RemoveMember(ctx, f.owner.ID, f.wallet.ID, binh.ID)
	assertAppErrCode(t, err, common.ErrCodeWalletMemberNotFound)
}
