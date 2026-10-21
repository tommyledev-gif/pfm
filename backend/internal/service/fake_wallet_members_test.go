package service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/example/pfm/backend/internal/model"
)

// The shared-wallet half of fakeWalletRepo (specs/shared-wallets). It plays
// both WalletRepo's membership reads and WalletMemberRepo, like the real
// WalletRepository. A live membership has RemovedAt == nil; the live
// uniqueness mirrors idx_wallet_members_live, answering 23505.

type fakeWalletNotification struct {
	UserID  uuid.UUID
	Type    string
	Body    string
	Related uuid.UUID
}

// notifications is kept outside the struct literal in fake_wallet_repo_test.go
// so this file owns everything sharing-specific.
var _ WalletMemberRepo = (*fakeWalletRepo)(nil)

func (f *fakeWalletRepo) liveMember(walletID, userID uuid.UUID) *model.WalletMember {
	for _, m := range f.members {
		if m.WalletID == walletID && m.UserID == userID && m.RemovedAt == nil {
			return m
		}
	}
	return nil
}

// seedMember adds a membership directly, skipping the invitation flow.
func (f *fakeWalletRepo) seedMember(walletID, userID uuid.UUID, role model.WalletMemberRole, status model.WalletMemberStatus) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.members = append(f.members, &model.WalletMember{
		ID: uuid.New(), WalletID: walletID, UserID: userID, Role: role, Status: status,
		CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
	})
}

func (f *fakeWalletRepo) GetLiveWalletMember(_ context.Context, walletID, userID uuid.UUID) (*model.WalletMember, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if m := f.liveMember(walletID, userID); m != nil {
		cp := *m
		return &cp, nil
	}
	return nil, pgx.ErrNoRows
}

func (f *fakeWalletRepo) ListSharedWalletsForUser(_ context.Context, userID uuid.UUID) ([]*model.Wallet, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []*model.Wallet
	for _, m := range f.members {
		if m.UserID != userID || !m.IsActive() {
			continue
		}
		w, ok := f.wallets[m.WalletID]
		if !ok {
			continue
		}
		cp := *w
		cp.Access = m.Role.Access()
		name := f.userNames[w.UserID]
		cp.OwnerName = &name
		out = append(out, &cp)
	}
	return out, nil
}

func (f *fakeWalletRepo) CountActiveMembersByWallets(_ context.Context, walletIDs []uuid.UUID) (map[uuid.UUID]int, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	counts := make(map[uuid.UUID]int)
	for _, id := range walletIDs {
		for _, m := range f.members {
			if m.WalletID == id && m.IsActive() {
				counts[id]++
			}
		}
	}
	return counts, nil
}

func (f *fakeWalletRepo) ListUserDisplayNames(_ context.Context, ids []uuid.UUID) (map[uuid.UUID]string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make(map[uuid.UUID]string)
	for _, id := range ids {
		if name, ok := f.userNames[id]; ok {
			out[id] = name
		}
	}
	return out, nil
}

func (f *fakeWalletRepo) CountLiveWalletMembers(_ context.Context, walletID uuid.UUID) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var n int64
	for _, m := range f.members {
		if m.WalletID == walletID && m.RemovedAt == nil {
			n++
		}
	}
	return n, nil
}

func (f *fakeWalletRepo) CreateWalletMember(_ context.Context, _ pgx.Tx, walletID, userID uuid.UUID, role model.WalletMemberRole, invitedBy uuid.UUID) (*model.WalletMember, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.liveMember(walletID, userID) != nil {
		return nil, &pgconn.PgError{Code: pgUniqueViolation}
	}
	now := time.Now().UTC()
	m := &model.WalletMember{
		ID: uuid.New(), WalletID: walletID, UserID: userID, Role: role,
		Status: model.WalletMemberStatusPending, InvitedBy: invitedBy, CreatedAt: now, UpdatedAt: now,
	}
	f.members = append(f.members, m)
	cp := *m
	return &cp, nil
}

func (f *fakeWalletRepo) CreateWalletNotification(_ context.Context, _ pgx.Tx, userID uuid.UUID, notificationType, _, body string, relatedUserID uuid.UUID) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	walletNotifications = append(walletNotifications, fakeWalletNotification{UserID: userID, Type: notificationType, Body: body, Related: relatedUserID})
	return nil
}

// walletNotifications records CreateWalletNotification calls; tests reset it.
var walletNotifications []fakeWalletNotification

func (f *fakeWalletRepo) ListWalletMembers(_ context.Context, walletID uuid.UUID) ([]*model.WalletMember, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []*model.WalletMember
	for _, m := range f.members {
		if m.WalletID == walletID && m.RemovedAt == nil {
			cp := *m
			cp.Name = f.userNames[m.UserID]
			out = append(out, &cp)
		}
	}
	return out, nil
}

func (f *fakeWalletRepo) ListPendingWalletInvitations(_ context.Context, userID uuid.UUID) ([]*model.WalletInvitation, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []*model.WalletInvitation
	for _, m := range f.members {
		if m.UserID != userID || m.RemovedAt != nil || m.Status != model.WalletMemberStatusPending {
			continue
		}
		w, ok := f.wallets[m.WalletID]
		if !ok {
			continue
		}
		out = append(out, &model.WalletInvitation{
			WalletID: w.ID, WalletName: w.Name, WalletCurrency: w.Currency, Role: m.Role,
			OwnerName: f.userNames[w.UserID], InvitedAt: m.CreatedAt,
		})
	}
	return out, nil
}

func (f *fakeWalletRepo) AcceptWalletInvitation(_ context.Context, _ pgx.Tx, walletID, userID uuid.UUID) (*model.WalletMember, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	m := f.liveMember(walletID, userID)
	if m == nil || m.Status != model.WalletMemberStatusPending {
		return nil, pgx.ErrNoRows
	}
	now := time.Now().UTC()
	m.Status = model.WalletMemberStatusActive
	m.AcceptedAt = &now
	cp := *m
	return &cp, nil
}

func (f *fakeWalletRepo) UpdateWalletMemberRole(_ context.Context, walletID, userID uuid.UUID, role model.WalletMemberRole) (*model.WalletMember, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	m := f.liveMember(walletID, userID)
	if m == nil {
		return nil, pgx.ErrNoRows
	}
	m.Role = role
	cp := *m
	return &cp, nil
}

func (f *fakeWalletRepo) RemoveWalletMember(_ context.Context, walletID, userID uuid.UUID) (*model.WalletMember, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	m := f.liveMember(walletID, userID)
	if m == nil {
		return nil, pgx.ErrNoRows
	}
	now := time.Now().UTC()
	m.RemovedAt = &now
	cp := *m
	return &cp, nil
}
