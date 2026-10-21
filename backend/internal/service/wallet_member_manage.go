package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// WalletMembers is a wallet's member list as one caller sees it: the owner
// first, then members in invitation order.
type WalletMembers struct {
	OwnerID       uuid.UUID
	OwnerName     string
	OwnerUsername *string
	Members       []*model.WalletMember
}

// ListMembers implements US-05's list. Owner or any active member may read
// it (BR-05); only the owner sees pending invitations — to a member they are
// someone else's unanswered mail.
func (s *WalletMemberService) ListMembers(ctx context.Context, userID, walletID uuid.UUID) (*WalletMembers, error) {
	wallet, err := requireReadableWallet(ctx, s.wallets, userID, walletID)
	if err != nil {
		return nil, err
	}
	owner, err := s.users.GetUserByID(ctx, wallet.UserID)
	if err != nil {
		return nil, fmt.Errorf("service.ListMembers: %w", err)
	}
	members, err := s.members.ListWalletMembers(ctx, walletID)
	if err != nil {
		return nil, fmt.Errorf("service.ListMembers: %w", err)
	}
	if wallet.Access != model.WalletAccessOwner {
		active := members[:0]
		for _, m := range members {
			if m.IsActive() {
				active = append(active, m)
			}
		}
		members = active
	}
	return &WalletMembers{
		OwnerID:       owner.ID,
		OwnerName:     model.DisplayName(owner.FullName, owner.Username, owner.Email),
		OwnerUsername: owner.Username,
		Members:       members,
	}, nil
}

// ChangeRole implements US-05's role change (owner only, S-SHW-40). Works on
// a pending invitation too, before it is answered.
func (s *WalletMemberService) ChangeRole(ctx context.Context, ownerID, walletID, memberID uuid.UUID, role model.WalletMemberRole) (*model.WalletMember, error) {
	if _, err := s.requireOwner(ctx, ownerID, walletID); err != nil {
		return nil, err
	}
	member, err := s.members.UpdateWalletMemberRole(ctx, walletID, memberID, role)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, common.ErrWalletMemberNotFound
		}
		return nil, fmt.Errorf("service.ChangeRole: %w", err)
	}
	return member, nil
}

// RemoveMember implements US-05's removal: the owner removes anyone or
// cancels an invitation; a member removes only themself (leaving). The
// owner cannot leave their own wallet (S-SHW-42). Nothing they recorded is
// touched (BR-08).
func (s *WalletMemberService) RemoveMember(ctx context.Context, callerID, walletID, memberID uuid.UUID) error {
	wallet, err := s.wallets.GetWalletByID(ctx, walletID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return common.ErrWalletNotFound
		}
		return fmt.Errorf("service.RemoveMember: %w", err)
	}
	if memberID == wallet.UserID {
		return common.NewInvalidInputError("chủ ví không thể rời ví của mình")
	}
	if callerID != wallet.UserID && callerID != memberID {
		return common.ErrWalletAccessDenied
	}
	if _, err := s.members.RemoveWalletMember(ctx, walletID, memberID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return common.ErrWalletMemberNotFound
		}
		return fmt.Errorf("service.RemoveMember: %w", err)
	}
	return nil
}
