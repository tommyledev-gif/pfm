package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// Notification types for the membership lifecycle; the app routes both to
// the Wallets screen.
const (
	NotificationTypeWalletInvite       = "wallet_invite"
	NotificationTypeWalletMemberJoined = "wallet_member_joined"
)

// WalletMemberService owns the shared-wallet membership rules
// (specs/shared-wallets US-01, US-02, US-05): owner-only management, the
// member limit, who may be invited, and the invite → accept lifecycle. Who
// may read or record into a wallet is decided by wallet_access.go.
type WalletMemberService struct {
	wallets WalletRepo
	members WalletMemberRepo
	users   WalletMemberUserLookup
	logger  *zap.Logger
}

func NewWalletMemberService(wallets WalletRepo, members WalletMemberRepo, users WalletMemberUserLookup, logger *zap.Logger) *WalletMemberService {
	return &WalletMemberService{wallets: wallets, members: members, users: users, logger: logger}
}

// requireOwner: 404 for a missing wallet, 403 for anyone but its owner
// (BR-01). A member gets 403 too, not a quieter error.
func (s *WalletMemberService) requireOwner(ctx context.Context, userID, walletID uuid.UUID) (*model.Wallet, error) {
	wallet, err := s.wallets.GetWalletByID(ctx, walletID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, common.ErrWalletNotFound
		}
		return nil, fmt.Errorf("service.requireOwner: %w", err)
	}
	if wallet.UserID != userID {
		return nil, common.ErrWalletAccessDenied
	}
	return wallet, nil
}

// Invite implements US-01: a pending membership plus the invitee's
// notification, in one DB transaction.
func (s *WalletMemberService) Invite(ctx context.Context, ownerID, walletID uuid.UUID, identifier string, role model.WalletMemberRole) (*model.WalletMember, error) {
	wallet, err := s.requireOwner(ctx, ownerID, walletID)
	if err != nil {
		return nil, err
	}
	target, err := s.findInvitee(ctx, identifier)
	if err != nil {
		return nil, err
	}
	if target.ID == ownerID {
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

	member.Name = model.DisplayName(target.FullName, target.Username, target.Email)
	member.Username = target.Username
	return member, nil
}

// findInvitee resolves an email or tên đăng nhập to an active account. Any
// other status (pending, disabled, deleted) reads as "not found": an
// invitation must reach someone who can actually sign in (BR-03).
func (s *WalletMemberService) findInvitee(ctx context.Context, identifier string) (*model.User, error) {
	identifier = strings.TrimSpace(identifier)
	var (
		user *model.User
		err  error
	)
	if strings.Contains(identifier, "@") {
		user, err = s.users.GetUserByEmail(ctx, common.NormalizeEmail(identifier))
	} else {
		user, err = s.users.GetUserByUsername(ctx, common.NormalizeUsername(identifier))
	}
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, common.ErrWalletMemberUserNotFound
		}
		return nil, fmt.Errorf("service.findInvitee: %w", err)
	}
	if user.Status != model.UserStatusActive || user.DeletedAt != nil {
		return nil, common.ErrWalletMemberUserNotFound
	}
	return user, nil
}

// ListInvitations implements US-02's list: the caller's pending invitations.
func (s *WalletMemberService) ListInvitations(ctx context.Context, userID uuid.UUID) ([]*model.WalletInvitation, error) {
	invitations, err := s.members.ListPendingWalletInvitations(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.ListInvitations: %w", err)
	}
	return invitations, nil
}

// pendingInvitation returns the caller's live membership of a live wallet,
// or ErrWalletInvitationNotFound — cancelled, declined, wallet deleted.
func (s *WalletMemberService) pendingInvitation(ctx context.Context, userID, walletID uuid.UUID) (*model.Wallet, *model.WalletMember, error) {
	wallet, err := s.wallets.GetWalletByID(ctx, walletID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, common.ErrWalletInvitationNotFound
		}
		return nil, nil, fmt.Errorf("service.pendingInvitation: %w", err)
	}
	member, err := s.wallets.GetLiveWalletMember(ctx, walletID, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, common.ErrWalletInvitationNotFound
		}
		return nil, nil, fmt.Errorf("service.pendingInvitation: %w", err)
	}
	return wallet, member, nil
}

// AcceptInvitation implements US-02 accept. Accepting twice is a no-op 200
// (S-SHW-11). The owner hears about it in the same DB transaction.
func (s *WalletMemberService) AcceptInvitation(ctx context.Context, userID, walletID uuid.UUID) (*model.WalletMember, error) {
	wallet, member, err := s.pendingInvitation(ctx, userID, walletID)
	if err != nil {
		return nil, err
	}
	if member.IsActive() {
		return member, nil
	}
	user, err := s.users.GetUserByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.AcceptInvitation: %w", err)
	}

	tx, err := s.members.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("service.AcceptInvitation: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	accepted, err := s.members.AcceptWalletInvitation(ctx, tx, walletID, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Cancelled between the read above and this write.
			return nil, common.ErrWalletInvitationNotFound
		}
		return nil, fmt.Errorf("service.AcceptInvitation: %w", err)
	}
	name := model.DisplayName(user.FullName, user.Username, user.Email)
	title := "Thành viên mới trong ví"
	body := fmt.Sprintf("%s đã tham gia ví %s.", name, wallet.Name)
	if err := s.members.CreateWalletNotification(ctx, tx, wallet.UserID, NotificationTypeWalletMemberJoined, title, body, userID); err != nil {
		return nil, fmt.Errorf("service.AcceptInvitation: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("service.AcceptInvitation: %w", err)
	}
	return accepted, nil
}

// DeclineInvitation implements US-02 decline: the pending row is removed,
// so the owner may invite again later.
func (s *WalletMemberService) DeclineInvitation(ctx context.Context, userID, walletID uuid.UUID) error {
	_, member, err := s.pendingInvitation(ctx, userID, walletID)
	if err != nil {
		return err
	}
	if member.Status != model.WalletMemberStatusPending {
		return common.ErrWalletInvitationNotFound
	}
	if _, err := s.members.RemoveWalletMember(ctx, walletID, userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return common.ErrWalletInvitationNotFound
		}
		return fmt.Errorf("service.DeclineInvitation: %w", err)
	}
	return nil
}
