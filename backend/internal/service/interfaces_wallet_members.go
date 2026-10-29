package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
)

// Repository contracts for shared wallets (specs/shared-wallets), kept beside
// interfaces.go so neither passes 300 lines. The membership reads every
// access check needs are on WalletRepo itself.

// WalletMemberRepo is the membership lifecycle WalletMemberService drives
// (specs/shared-wallets). *repository.WalletRepository satisfies it as well
// as WalletRepo.
type WalletMemberRepo interface {
	BeginTx(ctx context.Context) (pgx.Tx, error)
	CountLiveWalletMembers(ctx context.Context, walletID uuid.UUID) (int64, error)
	CreateWalletMember(ctx context.Context, tx pgx.Tx, walletID, userID uuid.UUID, role model.WalletMemberRole, invitedBy uuid.UUID) (*model.WalletMember, error)
	CreateWalletNotification(ctx context.Context, tx pgx.Tx, userID uuid.UUID, notificationType, title, body string, relatedUserID uuid.UUID) error
	ListWalletMembers(ctx context.Context, walletID uuid.UUID) ([]*model.WalletMember, error)
	ListPendingWalletInvitations(ctx context.Context, userID uuid.UUID) ([]*model.WalletInvitation, error)
	AcceptWalletInvitation(ctx context.Context, tx pgx.Tx, walletID, userID uuid.UUID) (*model.WalletMember, error)
	UpdateWalletMemberRole(ctx context.Context, walletID, userID uuid.UUID, role model.WalletMemberRole) (*model.WalletMember, error)
	RemoveWalletMember(ctx context.Context, walletID, userID uuid.UUID) (*model.WalletMember, error)
}

// WalletMemberUserLookup finds the account an invitation is for — the two
// login lookups, by email or by tên đăng nhập — and, for an email with no
// account yet, creates the pending one the invitation waits on.
type WalletMemberUserLookup interface {
	GetUserByEmail(ctx context.Context, email string) (*model.User, error)
	GetUserByUsername(ctx context.Context, username string) (*model.User, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (*model.User, error)
	CreatePendingUserTx(ctx context.Context, tx pgx.Tx, email string, role model.UserRole, invitedBy uuid.UUID, inviteToken string) (*model.User, error)
	RefreshPendingInvite(ctx context.Context, tx pgx.Tx, id uuid.UUID, inviteToken string) error
}
