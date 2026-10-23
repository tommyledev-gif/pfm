package service

import (
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
)

// liveCount is how many sessions of the user are currently usable.
func (f *fakeSessionRepo) liveCount(userID uuid.UUID) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	n := 0
	for _, s := range f.sessions {
		if s.UserID == userID && f.live(s) {
			n++
		}
	}
	return n
}

// sessionFor finds the session a token pair was issued for.
func (f *fakeSessionRepo) sessionFor(id uuid.UUID) *model.Session {
	f.mu.Lock()
	defer f.mu.Unlock()
	if s, ok := f.sessions[id]; ok {
		cp := *s
		return &cp
	}
	return nil
}

func notFoundErr() error { return pgx.ErrNoRows }

// byID returns a copy of the user with that id, or nil.
func (f *fakeUserRepo) byID(id uuid.UUID) *model.User {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, u := range f.byEmail {
		if u.ID == id {
			cp := *u
			return &cp
		}
	}
	return nil
}

// setStatus changes a user's status directly (e.g. an admin disabling them).
func (f *fakeUserRepo) setStatus(id uuid.UUID, status model.UserStatus) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, u := range f.byEmail {
		if u.ID == id {
			u.Status = status
		}
	}
}

// fakeSessions reaches the fake behind an AuthService built by
// newTestAuthService.
func fakeSessions(svc *AuthService) *fakeSessionRepo {
	return svc.sessions.repo.(*fakeSessionRepo)
}

func countRevokedSessions(svc *AuthService) int {
	repo := fakeSessions(svc)
	repo.mu.Lock()
	defer repo.mu.Unlock()
	n := 0
	for _, s := range repo.sessions {
		if s.RevokedAt != nil {
			n++
		}
	}
	return n
}
