package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
)

// Account-switch additions to the shared in-memory fakes
// (specs/mobile-account-switch AS-T05/AS-T26), kept apart from
// fake_repo_test.go so that file stays under the 300-line limit.

// Claim mirrors ClaimTokenJTI: ON CONFLICT DO NOTHING + rows affected.
func (f *fakeRevokedTokenRepo) Claim(_ context.Context, tokenJTI string, _ *uuid.UUID, _ time.Time) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.revoked[tokenJTI] {
		return false, nil
	}
	f.revoked[tokenJTI] = true
	return true, nil
}

// Release mirrors ReleaseTokenJTI: the claim is deleted.
func (f *fakeRevokedTokenRepo) Release(_ context.Context, tokenJTI string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.revoked, tokenJTI)
	return nil
}

// SetTokensValidAfter mirrors SetUserTokensValidAfter (0 rows → false).
func (f *fakeUserRepo) SetTokensValidAfter(_ context.Context, id uuid.UUID, at time.Time) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, u := range f.byEmail {
		if u.ID == id {
			point := at
			u.TokensValidAfter = &point
			return true, nil
		}
	}
	return false, nil
}

// failingSetUserRepo makes the sign-out write fail (500 path).
type failingSetUserRepo struct {
	*fakeUserRepo
}

var errFakeWrite = errors.New("fake: write failed")

func (f failingSetUserRepo) SetTokensValidAfter(context.Context, uuid.UUID, time.Time) (bool, error) {
	return false, errFakeWrite
}

// seedUser inserts a user with a real id and returns it.
func seedUser(repo *fakeUserRepo, email string, status model.UserStatus) *model.User {
	u := &model.User{ID: uuid.New(), Email: email, Status: status, Role: model.UserRoleMember}
	repo.mu.Lock()
	repo.byEmail[email] = u
	repo.mu.Unlock()
	cp := *u
	return &cp
}

// setTokensValidAfter backdates/forwards a user's sign-out point directly.
func (f *fakeUserRepo) setTokensValidAfter(id uuid.UUID, at time.Time) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, u := range f.byEmail {
		if u.ID == id {
			point := at
			u.TokensValidAfter = &point
		}
	}
}

// softDelete removes a user from lookups, like deleted_at IS NOT NULL.
func (f *fakeUserRepo) softDelete(email string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.byEmail, email)
}
