package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// Shared-wallet data access (specs/shared-wallets, mig 035), on the same
// WalletRepository so one type backs both the WalletRepo and WalletMemberRepo
// contracts. Data only: who may invite, read or write is decided by the
// services.

// GetLiveWalletMember returns pgx.ErrNoRows (unwrap with errors.Is) when the
// user has no live (pending or active) membership of the wallet.
func (r *WalletRepository) GetLiveWalletMember(ctx context.Context, walletID, userID uuid.UUID) (*model.WalletMember, error) {
	row, err := r.q.GetLiveWalletMember(ctx, walletID, userID)
	if err != nil {
		return nil, fmt.Errorf("repository.GetLiveWalletMember: %w", err)
	}
	return toWalletMemberModel(row), nil
}

// ListSharedWalletsForUser returns the wallets other users own that userID
// is an active member of, with Access and OwnerName filled.
func (r *WalletRepository) ListSharedWalletsForUser(ctx context.Context, userID uuid.UUID) ([]*model.Wallet, error) {
	rows, err := r.q.ListSharedWalletsForUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("repository.ListSharedWalletsForUser: %w", err)
	}
	wallets := make([]*model.Wallet, 0, len(rows))
	for _, row := range rows {
		w := toWalletModel(row.Wallet)
		w.Access = model.WalletMemberRole(row.MemberRole).Access()
		name := model.DisplayName(row.OwnerFullName, row.OwnerUsername, row.OwnerEmail)
		w.OwnerName = &name
		wallets = append(wallets, w)
	}
	return wallets, nil
}

// CountActiveMembersByWallets returns active member counts keyed by wallet
// id; wallets with none are absent from the map.
func (r *WalletRepository) CountActiveMembersByWallets(ctx context.Context, walletIDs []uuid.UUID) (map[uuid.UUID]int, error) {
	counts := make(map[uuid.UUID]int, len(walletIDs))
	if len(walletIDs) == 0 {
		return counts, nil
	}
	rows, err := r.q.CountActiveMembersByWallets(ctx, walletIDs)
	if err != nil {
		return nil, fmt.Errorf("repository.CountActiveMembersByWallets: %w", err)
	}
	for _, row := range rows {
		counts[row.WalletID] = int(row.MemberCount)
	}
	return counts, nil
}

// ListUserDisplayNames maps each id to model.DisplayName; unknown ids are
// absent from the map.
func (r *WalletRepository) ListUserDisplayNames(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]string, error) {
	names := make(map[uuid.UUID]string, len(ids))
	if len(ids) == 0 {
		return names, nil
	}
	rows, err := r.q.ListUserDisplayNames(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("repository.ListUserDisplayNames: %w", err)
	}
	for _, row := range rows {
		names[row.ID] = model.DisplayName(row.FullName, row.Username, row.Email)
	}
	return names, nil
}

func (r *WalletRepository) CountLiveWalletMembers(ctx context.Context, walletID uuid.UUID) (int64, error) {
	count, err := r.q.CountLiveWalletMembers(ctx, walletID)
	if err != nil {
		return 0, fmt.Errorf("repository.CountLiveWalletMembers: %w", err)
	}
	return count, nil
}

// CreateWalletMember inserts a pending membership inside the caller's
// transaction. A unique violation (another live membership for the same
// user) comes back wrapped; the service maps it to 409.
func (r *WalletRepository) CreateWalletMember(ctx context.Context, tx pgx.Tx, walletID, userID uuid.UUID, role model.WalletMemberRole, invitedBy uuid.UUID) (*model.WalletMember, error) {
	row, err := r.q.WithTx(tx).CreateWalletMember(ctx, walletID, userID, string(role), invitedBy)
	if err != nil {
		return nil, fmt.Errorf("repository.CreateWalletMember: %w", err)
	}
	return toWalletMemberModel(row), nil
}

// CreateWalletNotification writes an in-app notification inside the
// caller's transaction, so it exists exactly when the membership change does.
func (r *WalletRepository) CreateWalletNotification(ctx context.Context, tx pgx.Tx, userID uuid.UUID, notificationType, title, body string, relatedUserID uuid.UUID) error {
	if err := r.q.WithTx(tx).CreateWalletNotification(ctx, userID, notificationType, title, body, relatedUserID); err != nil {
		return fmt.Errorf("repository.CreateWalletNotification: %w", err)
	}
	return nil
}

func (r *WalletRepository) ListWalletMembers(ctx context.Context, walletID uuid.UUID) ([]*model.WalletMember, error) {
	rows, err := r.q.ListWalletMembers(ctx, walletID)
	if err != nil {
		return nil, fmt.Errorf("repository.ListWalletMembers: %w", err)
	}
	members := make([]*model.WalletMember, 0, len(rows))
	for _, row := range rows {
		m := toWalletMemberModel(row.WalletMember)
		m.Name = model.DisplayName(row.FullName, row.Username, row.Email)
		m.Username = row.Username
		m.AccountPending = row.UserStatus == string(model.UserStatusPending)
		members = append(members, m)
	}
	return members, nil
}

func (r *WalletRepository) ListPendingWalletInvitations(ctx context.Context, userID uuid.UUID) ([]*model.WalletInvitation, error) {
	rows, err := r.q.ListPendingWalletInvitations(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("repository.ListPendingWalletInvitations: %w", err)
	}
	invitations := make([]*model.WalletInvitation, 0, len(rows))
	for _, row := range rows {
		invitations = append(invitations, &model.WalletInvitation{
			WalletID:       row.WalletID,
			WalletName:     row.WalletName,
			WalletCurrency: row.WalletCurrency,
			WalletColor:    row.WalletColor,
			Role:           model.WalletMemberRole(row.Role),
			OwnerName:      model.DisplayName(row.OwnerFullName, row.OwnerUsername, row.OwnerEmail),
			InvitedAt:      row.CreatedAt,
		})
	}
	return invitations, nil
}

// AcceptWalletInvitation returns pgx.ErrNoRows when there is no live pending
// invitation for (walletID, userID).
func (r *WalletRepository) AcceptWalletInvitation(ctx context.Context, tx pgx.Tx, walletID, userID uuid.UUID) (*model.WalletMember, error) {
	row, err := r.q.WithTx(tx).AcceptWalletInvitation(ctx, walletID, userID)
	if err != nil {
		return nil, fmt.Errorf("repository.AcceptWalletInvitation: %w", err)
	}
	return toWalletMemberModel(row), nil
}

// UpdateWalletMemberRole returns pgx.ErrNoRows when there is no live membership.
func (r *WalletRepository) UpdateWalletMemberRole(ctx context.Context, walletID, userID uuid.UUID, role model.WalletMemberRole) (*model.WalletMember, error) {
	row, err := r.q.UpdateWalletMemberRole(ctx, walletID, userID, string(role))
	if err != nil {
		return nil, fmt.Errorf("repository.UpdateWalletMemberRole: %w", err)
	}
	return toWalletMemberModel(row), nil
}

// RemoveWalletMember soft-removes a live membership; pgx.ErrNoRows when
// there is none.
func (r *WalletRepository) RemoveWalletMember(ctx context.Context, walletID, userID uuid.UUID) (*model.WalletMember, error) {
	row, err := r.q.RemoveWalletMember(ctx, walletID, userID)
	if err != nil {
		return nil, fmt.Errorf("repository.RemoveWalletMember: %w", err)
	}
	return toWalletMemberModel(row), nil
}

func toWalletMemberModel(row sqlc.WalletMember) *model.WalletMember {
	return &model.WalletMember{
		ID:         row.ID,
		WalletID:   row.WalletID,
		UserID:     row.UserID,
		Role:       model.WalletMemberRole(row.Role),
		Status:     model.WalletMemberStatus(row.Status),
		InvitedBy:  row.InvitedBy,
		CreatedAt:  row.CreatedAt,
		UpdatedAt:  row.UpdatedAt,
		AcceptedAt: row.AcceptedAt,
		RemovedAt:  row.RemovedAt,
	}
}
