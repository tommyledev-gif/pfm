package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/example/pfm/backend/internal/model"
)

// Profile methods of the shared fake user repo (UserRepo.UpdateFullName /
// SetAvatarURL), kept apart so fake_repo_test.go stays under 300 lines.

func (f *fakeUserRepo) UpdateFullName(_ context.Context, id uuid.UUID, fullName string) (*model.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, u := range f.byEmail {
		if u.ID == id {
			name := fullName
			u.FullName = &name
			cp := *u
			return &cp, nil
		}
	}
	return nil, pgx.ErrNoRows
}

// SetUsernameOnce mirrors the conditional UPDATE (no row once a username is
// set) and idx_users_username_active_unique.
func (f *fakeUserRepo) SetUsernameOnce(_ context.Context, id uuid.UUID, username string) (*model.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, other := range f.byEmail {
		if other.ID != id && other.Username != nil && *other.Username == username {
			return nil, &pgconn.PgError{Code: pgUniqueViolation, ConstraintName: "idx_users_username_active_unique"}
		}
	}
	for _, u := range f.byEmail {
		if u.ID == id && u.Username == nil {
			name := username
			u.Username = &name
			cp := *u
			return &cp, nil
		}
	}
	return nil, pgx.ErrNoRows
}

func (f *fakeUserRepo) SetAvatarURL(_ context.Context, id uuid.UUID, avatarURL *string) (*model.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, u := range f.byEmail {
		if u.ID == id {
			if avatarURL == nil {
				u.AvatarURL = nil
			} else {
				url := *avatarURL
				u.AvatarURL = &url
			}
			cp := *u
			return &cp, nil
		}
	}
	return nil, pgx.ErrNoRows
}
