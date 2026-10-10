package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

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
