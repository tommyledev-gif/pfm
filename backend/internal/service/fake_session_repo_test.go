package service

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
)

// testClock is a controllable clock shared by the fake session repo and the
// SessionService under test, so tests can age sessions without sleeping.
type testClock struct {
	mu sync.Mutex
	t  time.Time
}

// Starts at the real time: JWT expiry is checked against the real clock, so a
// fixed date would turn these tests into time bombs.
func newTestClock() *testClock { return &testClock{t: time.Now().UTC().Truncate(time.Second)} }

func (c *testClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.t
}

func (c *testClock) Advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.t = c.t.Add(d)
}

// fakeSessionRepo is an in-memory SessionRepo that follows the SQL's
// semantics (db/queries/sessions.sql): same-device replacement then
// least-recently-used eviction on Create, compare-and-swap Rotate (filling a
// missing device), user-scoped Revoke.
type fakeSessionRepo struct {
	mu       sync.Mutex
	clock    *testClock
	users    *fakeUserRepo
	sessions map[uuid.UUID]*model.Session

	// beforeRotate, when set, runs once at the start of Rotate while the
	// repo is unlocked: tests use it to land a competing refresh first.
	beforeRotate func()
	// failAuthState makes AuthState return this error (a database outage).
	failAuthState error
	// failCreate makes Create return this error (a database outage).
	failCreate error
}

func newFakeSessionRepo(clock *testClock, users *fakeUserRepo) *fakeSessionRepo {
	return &fakeSessionRepo{clock: clock, users: users, sessions: map[uuid.UUID]*model.Session{}}
}

func (f *fakeSessionRepo) live(s *model.Session) bool {
	now := f.clock.Now()
	return s.RevokedAt == nil && now.Before(s.ExpiresAt) && now.Before(s.AbsoluteExpiresAt)
}

func (f *fakeSessionRepo) Create(_ context.Context, s model.Session, maxActive int) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.failCreate != nil {
		return f.failCreate
	}

	now := f.clock.Now()
	if s.DeviceID != nil {
		for _, existing := range f.sessions {
			if existing.UserID == s.UserID && existing.RevokedAt == nil && existing.DeviceID != nil && *existing.DeviceID == *s.DeviceID {
				reason := model.SessionRevokedReplaced
				existing.RevokedAt, existing.RevokedReason = &now, &reason
			}
		}
	}

	var mine []*model.Session
	for _, existing := range f.sessions {
		if existing.UserID == s.UserID && f.live(existing) {
			mine = append(mine, existing)
		}
	}
	sort.Slice(mine, func(i, j int) bool {
		if !mine[i].LastUsedAt.Equal(mine[j].LastUsedAt) {
			return mine[i].LastUsedAt.After(mine[j].LastUsedAt)
		}
		if !mine[i].CreatedAt.Equal(mine[j].CreatedAt) {
			return mine[i].CreatedAt.After(mine[j].CreatedAt)
		}
		return mine[i].ID.String() < mine[j].ID.String()
	})
	for i := maxActive - 1; i < len(mine); i++ {
		mine[i].RevokedAt = &now
		reason := model.SessionRevokedLimit
		mine[i].RevokedReason = &reason
	}

	stored := s
	stored.CreatedAt, stored.LastUsedAt = now, now
	f.sessions[s.ID] = &stored
	return nil
}

func (f *fakeSessionRepo) Get(_ context.Context, id uuid.UUID) (*model.Session, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	s, ok := f.sessions[id]
	if !ok {
		return nil, notFoundErr()
	}
	cp := *s
	return &cp, nil
}

func (f *fakeSessionRepo) Rotate(_ context.Context, id uuid.UUID, currentJTI, newJTI string, expiresAt time.Time, device *model.SessionDevice) (bool, error) {
	if hook := f.beforeRotate; hook != nil {
		f.beforeRotate = nil
		hook()
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	s, ok := f.sessions[id]
	if !ok || s.RevokedAt != nil || s.RefreshJTI != currentJTI {
		return false, nil
	}
	now := f.clock.Now()
	prev := s.RefreshJTI
	s.PrevRefreshJTI, s.RefreshJTI = &prev, newJTI
	s.RotatedAt, s.LastUsedAt, s.ExpiresAt = &now, now, expiresAt
	if device != nil && s.DeviceID == nil {
		id := device.ID
		s.DeviceID = &id
	}
	if device != nil && device.Name != "" && s.DeviceName == nil {
		name := device.Name
		s.DeviceName = &name
	}
	return true, nil
}

func (f *fakeSessionRepo) ListLive(_ context.Context, userID uuid.UUID) ([]model.SessionSummary, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var items []model.SessionSummary
	for _, s := range f.sessions {
		if s.UserID == userID && f.live(s) {
			items = append(items, model.SessionSummary{ID: s.ID, DeviceName: s.DeviceName, CreatedAt: s.CreatedAt, LastUsedAt: s.LastUsedAt})
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].LastUsedAt.After(items[j].LastUsedAt) })
	return items, nil
}

func (f *fakeSessionRepo) Revoke(_ context.Context, id, userID uuid.UUID, reason string) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	s, ok := f.sessions[id]
	if !ok || s.UserID != userID || s.RevokedAt != nil {
		return false, nil
	}
	now := f.clock.Now()
	s.RevokedAt, s.RevokedReason = &now, &reason
	return true, nil
}

func (f *fakeSessionRepo) RevokeAllForUser(_ context.Context, userID uuid.UUID, reason string) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var n int64
	now := f.clock.Now()
	for _, s := range f.sessions {
		if s.UserID == userID && s.RevokedAt == nil {
			r := reason
			s.RevokedAt, s.RevokedReason = &now, &r
			n++
		}
	}
	return n, nil
}

func (f *fakeSessionRepo) AuthState(_ context.Context, id, userID uuid.UUID) (*model.SessionAuthState, error) {
	if f.failAuthState != nil {
		return nil, f.failAuthState
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	s, ok := f.sessions[id]
	if !ok || s.UserID != userID {
		return nil, nil
	}
	user := f.users.byID(userID)
	if user == nil {
		return nil, nil
	}
	return &model.SessionAuthState{
		RevokedAt:         s.RevokedAt,
		ExpiresAt:         s.ExpiresAt,
		AbsoluteExpiresAt: s.AbsoluteExpiresAt,
		UserStatus:        user.Status,
		UserRole:          user.Role,
		TokensValidAfter:  user.TokensValidAfter,
	}, nil
}

func (f *fakeSessionRepo) DeleteExpired(_ context.Context, cutoff time.Time) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var n int64
	for id, s := range f.sessions {
		if s.AbsoluteExpiresAt.Before(cutoff) || (s.RevokedAt != nil && s.RevokedAt.Before(cutoff)) {
			delete(f.sessions, id)
			n++
		}
	}
	return n, nil
}

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
