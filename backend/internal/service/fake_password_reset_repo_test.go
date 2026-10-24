package service

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// fakePasswordResetRepo is an in-memory PasswordResetRepo that follows the
// SQL's semantics (db/queries/password_reset_codes.sql). Its clock stands in
// for the database's NOW(); every method holds mu for its whole run, as the
// real one holds the user row lock or one conditional UPDATE.
type fakePasswordResetRepo struct {
	mu    sync.Mutex
	users *fakeUserRepo
	clock *testClock
	codes []*model.PasswordResetCode
}

func newFakePasswordResetRepo(users *fakeUserRepo, clock *testClock) *fakePasswordResetRepo {
	return &fakePasswordResetRepo{users: users, clock: clock}
}

func (f *fakePasswordResetRepo) live(c *model.PasswordResetCode) bool {
	return c.UsedAt == nil && c.RevokedAt == nil && c.ExpiresAt.After(f.clock.Now())
}

func (f *fakePasswordResetRepo) CreateCode(ctx context.Context, c repository.NewCode) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	user, err := f.users.GetUserByID(ctx, c.UserID)
	if err != nil || user.Status != model.UserStatusActive {
		return false, nil
	}
	var recent, inHour int64
	for _, old := range f.codes {
		if old.UserID != c.UserID {
			continue
		}
		if old.CreatedAt.After(c.CooldownSince) {
			recent++
		}
		if old.CreatedAt.After(c.HourSince) {
			inHour++
		}
	}
	if recent > 0 || inHour >= c.HourlyMax {
		return false, nil
	}
	now := f.clock.Now()
	for _, old := range f.codes {
		if old.UserID == c.UserID && old.UsedAt == nil && old.RevokedAt == nil {
			at := now
			old.RevokedAt = &at
		}
	}
	f.codes = append(f.codes, &model.PasswordResetCode{
		ID: uuid.New(), UserID: c.UserID, CodeHash: c.CodeHash, CreatedAt: now, ExpiresAt: c.ExpiresAt,
	})
	return true, nil
}

func (f *fakePasswordResetRepo) LiveCode(_ context.Context, userID uuid.UUID) (*model.PasswordResetCode, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for i := len(f.codes) - 1; i >= 0; i-- {
		if c := f.codes[i]; c.UserID == userID && f.live(c) {
			cp := *c
			return &cp, nil
		}
	}
	return nil, pgx.ErrNoRows
}

func (f *fakePasswordResetRepo) SpendTry(_ context.Context, codeID uuid.UUID, maxTries int32) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, c := range f.codes {
		if c.ID == codeID && c.UsedAt == nil && c.RevokedAt == nil {
			c.Attempts++
			if c.Attempts >= maxTries {
				at := f.clock.Now()
				c.RevokedAt = &at
			}
		}
	}
	return nil
}

// ResetPassword is all-or-nothing like the real transaction: the code is
// marked used only when the password change also took effect.
func (f *fakePasswordResetRepo) ResetPassword(ctx context.Context, codeID, userID uuid.UUID, maxTries int32, passwordHash string, signOutAt time.Time) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, c := range f.codes {
		if c.ID != codeID || c.UserID != userID || !f.live(c) || c.Attempts >= maxTries {
			continue
		}
		changed, err := f.users.ChangePassword(ctx, userID, passwordHash, signOutAt)
		if err != nil || !changed {
			return false, err
		}
		at := f.clock.Now()
		c.UsedAt = &at
		return true, nil
	}
	return false, nil
}

// count is how many codes the user has, live or not.
func (f *fakePasswordResetRepo) count(userID uuid.UUID) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	n := 0
	for _, c := range f.codes {
		if c.UserID == userID {
			n++
		}
	}
	return n
}

// attempts is the wrong-try count of the user's newest code.
func (f *fakePasswordResetRepo) attempts(userID uuid.UUID) int32 {
	f.mu.Lock()
	defer f.mu.Unlock()
	for i := len(f.codes) - 1; i >= 0; i-- {
		if f.codes[i].UserID == userID {
			return f.codes[i].Attempts
		}
	}
	return -1
}
