package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
)

// Where the account an owner is about to invite stands with the wallet.
const (
	InviteeMembershipNone    = "none"
	InviteeMembershipPending = "pending"
	InviteeMembershipActive  = "active"
	InviteeMembershipSelf    = "self"
)

// InviteeLookup is who an email or tên đăng nhập belongs to, as the owner
// types it into the invite field, and where that person stands with the
// wallet (one of the InviteeMembership values).
type InviteeLookup struct {
	User       *model.User
	Membership string
}

// LookupInvitee resolves what the owner has typed to the account an
// invitation would reach, so the app can show who it is (name, avatar)
// before anything is sent.
//
// Exact match only, by the same rules as Invite (findInvitee: a whole email
// or tên đăng nhập, active accounts only), never a prefix search: it answers
// nothing Invite's own "no such account" error does not already, and it is
// rate-limited per owner (middleware.MemberLookupRateLimiter). Owner-only,
// like every other membership change.
func (s *WalletMemberService) LookupInvitee(ctx context.Context, ownerID, walletID uuid.UUID, identifier string) (*InviteeLookup, error) {
	if _, err := s.requireOwner(ctx, ownerID, walletID); err != nil {
		return nil, err
	}
	target, err := s.findInvitee(ctx, identifier)
	if err != nil {
		return nil, err
	}
	if target.ID == ownerID {
		return &InviteeLookup{User: target, Membership: InviteeMembershipSelf}, nil
	}
	member, err := s.wallets.GetLiveWalletMember(ctx, walletID, target.ID)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return &InviteeLookup{User: target, Membership: InviteeMembershipNone}, nil
	case err != nil:
		return nil, fmt.Errorf("service.LookupInvitee: %w", err)
	case member.Status == model.WalletMemberStatusPending:
		return &InviteeLookup{User: target, Membership: InviteeMembershipPending}, nil
	default:
		return &InviteeLookup{User: target, Membership: InviteeMembershipActive}, nil
	}
}
