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

// Who may do what with a wallet (specs/shared-wallets BR-05), decided in one
// place for every service that touches wallets:
//
//   - owner (wallets.user_id): everything;
//   - active editor: read, and record transactions into it;
//   - active viewer: read only;
//   - anyone else, including a pending invitee or a removed member: 403.
//
// A missing or deleted wallet is 404 before any of that, keeping the
// existing 404-vs-403 split. Owner-only operations (edit, set default,
// manage members) keep checking wallet.UserID themselves.

// resolveWalletAccess loads the wallet and the caller's access to it, with
// wallet.Access filled. The owner path costs no extra query.
func resolveWalletAccess(ctx context.Context, repo WalletRepo, userID, walletID uuid.UUID) (*model.Wallet, error) {
	wallet, err := repo.GetWalletByID(ctx, walletID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, common.ErrWalletNotFound
		}
		return nil, fmt.Errorf("service.resolveWalletAccess: %w", err)
	}
	if wallet.UserID == userID {
		wallet.Access = model.WalletAccessOwner
		return wallet, nil
	}
	member, err := repo.GetLiveWalletMember(ctx, walletID, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, common.ErrWalletAccessDenied
		}
		return nil, fmt.Errorf("service.resolveWalletAccess: %w", err)
	}
	if !member.IsActive() {
		return nil, common.ErrWalletAccessDenied
	}
	wallet.Access = member.Role.Access()
	return wallet, nil
}

// requireReadableWallet: owner or any active member.
func requireReadableWallet(ctx context.Context, repo WalletRepo, userID, walletID uuid.UUID) (*model.Wallet, error) {
	return resolveWalletAccess(ctx, repo, userID, walletID)
}

// requireWritableWallet: owner or active editor — who may record into it.
func requireWritableWallet(ctx context.Context, repo WalletRepo, userID, walletID uuid.UUID) (*model.Wallet, error) {
	wallet, err := resolveWalletAccess(ctx, repo, userID, walletID)
	if err != nil {
		return nil, err
	}
	if !wallet.Access.CanWrite() {
		return nil, common.ErrWalletAccessDenied
	}
	return wallet, nil
}
