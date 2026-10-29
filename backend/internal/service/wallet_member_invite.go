package service

import (
	"context"
	"errors"
	"fmt"
	"net/mail"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// Invite implements US-01: a pending membership plus the invitee's
// notification, in one DB transaction.
//
// An email with no account behind it (decided 2026-10-29, superseding the
// spec's "Out of Scope: inviting someone who has no account"): the same
// transaction creates the pending account an admin's invite would, invited
// by the owner, and the activation email names the wallet. Once they
// activate and sign in the invitation is waiting like any other. An account
// invited before but never activated is invited the same way, its link
// renewed if it has expired.
func (s *WalletMemberService) Invite(ctx context.Context, ownerID, walletID uuid.UUID, identifier string, role model.WalletMemberRole) (*model.WalletMember, error) {
	wallet, err := s.requireOwner(ctx, ownerID, walletID)
	if err != nil {
		return nil, err
	}
	target, newEmail, err := s.inviteTarget(ctx, identifier)
	if err != nil {
		return nil, err
	}
	if target != nil && target.ID == ownerID {
		return nil, common.NewInvalidInputError("không thể mời chính mình vào ví của mình")
	}
	// A soft limit: two invitations for different people racing at nine can
	// land eleven. Harmless, and not worth locking the wallet row (which
	// every balance update also takes) to prevent.
	count, err := s.members.CountLiveWalletMembers(ctx, walletID)
	if err != nil {
		return nil, fmt.Errorf("service.Invite: %w", err)
	}
	if count >= common.WalletMemberLimit {
		return nil, common.ErrWalletMemberLimit
	}

	owner, err := s.users.GetUserByID(ctx, ownerID)
	if err != nil {
		return nil, fmt.Errorf("service.Invite: %w", err)
	}
	ownerName := model.DisplayName(owner.FullName, owner.Username, owner.Email)

	tx, err := s.members.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("service.Invite: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	target, inviteToken, err := s.accountFor(ctx, tx, target, newEmail, ownerID)
	if err != nil {
		return nil, err
	}
	member, err := s.members.CreateWalletMember(ctx, tx, walletID, target.ID, role, ownerID)
	if err != nil {
		// The live-membership unique index (mig 035): already invited or a
		// member, including a duplicate invite racing this one (S-SHW-08).
		if isUniqueViolation(err) {
			return nil, common.ErrWalletMemberExists
		}
		return nil, fmt.Errorf("service.Invite: %w", err)
	}
	title := "Lời mời vào ví chung"
	body := fmt.Sprintf("%s mời bạn vào ví %s.", ownerName, wallet.Name)
	if err := s.members.CreateWalletNotification(ctx, tx, target.ID, NotificationTypeWalletInvite, title, body, ownerID); err != nil {
		return nil, fmt.Errorf("service.Invite: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("service.Invite: %w", err)
	}
	if inviteToken != "" {
		go s.dispatchWalletInviteEmail(target.Email, ownerName, wallet.Name, inviteToken)
	}

	member.Name = model.DisplayName(target.FullName, target.Username, target.Email)
	member.Username = target.Username
	member.AccountPending = target.Status == model.UserStatusPending
	return member, nil
}

// inviteTarget resolves who an invitation is for. An email with no account
// gives a nil user and that email, normalized: the account is created with
// the invitation. A pending account (invited, never activated) is a target
// as well. Anything else not active (disabled, an access request still
// waiting, a tên đăng nhập nobody has) reads as not found (BR-03).
func (s *WalletMemberService) inviteTarget(ctx context.Context, identifier string) (*model.User, string, error) {
	identifier = strings.TrimSpace(identifier)
	if !strings.Contains(identifier, "@") {
		user, err := s.findInvitee(ctx, identifier)
		return user, "", err
	}
	email := common.NormalizeEmail(identifier)
	user, err := s.users.GetUserByEmail(ctx, email)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		// A new account needs an address mail can reach; the handler only
		// checked the length.
		if addr, parseErr := mail.ParseAddress(email); parseErr != nil || addr.Address != email {
			return nil, "", common.ErrWalletMemberUserNotFound
		}
		return nil, email, nil
	case err != nil:
		return nil, "", fmt.Errorf("service.inviteTarget: %w", err)
	case user.DeletedAt == nil && (user.Status == model.UserStatusActive || user.Status == model.UserStatusPending):
		return user, "", nil
	default:
		return nil, "", common.ErrWalletMemberUserNotFound
	}
}

// accountFor returns the account the invitation attaches to and, when that
// account has not been activated, the token its email carries: a new
// pending account for an address with none, the current token while it is
// still valid, a renewed one once it has expired. Inside the invitation's tx.
func (s *WalletMemberService) accountFor(ctx context.Context, tx pgx.Tx, target *model.User, newEmail string, ownerID uuid.UUID) (*model.User, string, error) {
	if target != nil && target.Status != model.UserStatusPending {
		return target, "", nil
	}
	if target != nil && target.InviteToken != nil && target.InviteExpiresAt != nil && time.Now().Before(*target.InviteExpiresAt) {
		return target, *target.InviteToken, nil
	}
	token, err := generateInviteToken()
	if err != nil {
		return nil, "", fmt.Errorf("service.accountFor: %w", err)
	}
	if target == nil {
		created, err := s.users.CreatePendingUserTx(ctx, tx, newEmail, model.UserRoleMember, ownerID, token)
		if err != nil {
			// Another invitation of the same address got there first.
			if isUniqueViolation(err) {
				return nil, "", common.ErrEmailAlreadyExists
			}
			return nil, "", fmt.Errorf("service.accountFor: %w", err)
		}
		return created, token, nil
	}
	if err := s.users.RefreshPendingInvite(ctx, tx, target.ID, token); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Activated or deleted since it was read: ask again.
			return nil, "", common.ErrWalletMemberUserNotFound
		}
		return nil, "", fmt.Errorf("service.accountFor: %w", err)
	}
	return target, token, nil
}

// dispatchWalletInviteEmail sends on a detached context, fire-and-forget like
// UserService's activation email: the invitation is saved either way, and a
// failed send is only logged (never the token; the address masked).
func (s *WalletMemberService) dispatchWalletInviteEmail(toEmail, ownerName, walletName, token string) {
	ctx, cancel := context.WithTimeout(context.Background(), common.EmailDispatchTimeout)
	defer cancel()
	if err := s.email.SendWalletInviteEmail(ctx, toEmail, ownerName, walletName, token); err != nil {
		s.logger.Error("failed to dispatch wallet invite email", zap.String("email", common.MaskEmail(toEmail)), zap.Error(err))
	}
}
