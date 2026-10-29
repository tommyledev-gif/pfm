package service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
)

// The fake's half of WalletMemberUserLookup's account creation: the tx is
// the fake wallet repo's no-op one, so these run straight against the maps.

func (f *fakeUserRepo) CreatePendingUserTx(ctx context.Context, _ pgx.Tx, email string, role model.UserRole, invitedBy uuid.UUID, inviteToken string) (*model.User, error) {
	return f.CreatePendingUser(ctx, email, role, invitedBy, inviteToken)
}

func (f *fakeUserRepo) RefreshPendingInvite(_ context.Context, _ pgx.Tx, id uuid.UUID, inviteToken string) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	for _, u := range f.byEmail {
		if u.ID != id || u.Status != model.UserStatusPending {
			continue
		}
		expiresAt := time.Now().UTC().Add(72 * time.Hour)
		u.InviteToken = &inviteToken
		u.InviteExpiresAt = &expiresAt
		f.byToken[inviteToken] = u
		return nil
	}
	return pgx.ErrNoRows
}
