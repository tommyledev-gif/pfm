package service

import (
	"context"
	"testing"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// The invite field's account lookup: owner-only, exact match by the same
// rules as Invite, and where the account already stands with the wallet.
func TestWalletMemberService_LookupInvitee(t *testing.T) {
	f := newSharedWalletFixture(t)
	binh := seedWalletUser(f.users, f.wallets, "binh@example.com", "binh", "Bình")
	cuong := seedWalletUser(f.users, f.wallets, "cuong@example.com", "cuong", "Cường")
	dung := seedWalletUser(f.users, f.wallets, "dung@example.com", "dung", "Dũng")
	f.wallets.seedMember(f.wallet.ID, binh.ID, model.WalletMemberRoleEditor, model.WalletMemberStatusActive)
	f.wallets.seedMember(f.wallet.ID, cuong.ID, model.WalletMemberRoleViewer, model.WalletMemberStatusPending)
	ctx := context.Background()

	cases := []struct {
		identifier string
		want       string
		userID     string
	}{
		{"dung@example.com", InviteeMembershipNone, dung.ID.String()},
		{"  DUNG@example.com ", InviteeMembershipNone, dung.ID.String()},
		{"dung", InviteeMembershipNone, dung.ID.String()},
		{"cuong", InviteeMembershipPending, cuong.ID.String()},
		{"binh@example.com", InviteeMembershipActive, binh.ID.String()},
		{"an", InviteeMembershipSelf, f.owner.ID.String()},
	}
	for _, tc := range cases {
		got, err := f.svc.LookupInvitee(ctx, f.owner.ID, f.wallet.ID, tc.identifier)
		if err != nil {
			t.Fatalf("%q: unexpected error %v", tc.identifier, err)
		}
		if got.Membership != tc.want || got.User.ID.String() != tc.userID {
			t.Fatalf("%q: got %s for %s, want %s for %s", tc.identifier, got.Membership, got.User.ID, tc.want, tc.userID)
		}
	}

	// Exact match only: a prefix is not a lookup.
	_, err := f.svc.LookupInvitee(ctx, f.owner.ID, f.wallet.ID, "dun")
	assertAppErrCode(t, err, common.ErrCodeWalletMemberUserNotFound)

	// An account that cannot sign in reads as not found, as Invite's does.
	dung.Status = model.UserStatusDisabled
	_, err = f.svc.LookupInvitee(ctx, f.owner.ID, f.wallet.ID, "dung")
	assertAppErrCode(t, err, common.ErrCodeWalletMemberUserNotFound)

	// Owner-only, like every membership change.
	_, err = f.svc.LookupInvitee(ctx, binh.ID, f.wallet.ID, "dung@example.com")
	assertAppErrCode(t, err, common.ErrCodeWalletAccessDenied)
}
