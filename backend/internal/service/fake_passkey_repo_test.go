package service

import (
	"bytes"
	"context"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
)

type fakeChallenge struct {
	userID    *uuid.UUID
	purpose   model.PasskeyChallengePurpose
	session   []byte
	expiresAt time.Time
}

// fakePasskeyRepo is an in-memory PasskeyRepo with the real repository's
// semantics: soft deletes, single-use challenges, expiry on consume.
type fakePasskeyRepo struct {
	mu         sync.Mutex
	passkeys   []*model.Passkey
	challenges map[uuid.UUID]fakeChallenge
	now        func() time.Time
}

func newFakePasskeyRepo() *fakePasskeyRepo {
	return &fakePasskeyRepo{challenges: map[uuid.UUID]fakeChallenge{}, now: time.Now}
}

func (f *fakePasskeyRepo) Create(_ context.Context, userID uuid.UUID, credentialID, credential []byte, name string) (*model.Passkey, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	p := &model.Passkey{ID: uuid.New(), UserID: userID, CredentialID: credentialID, Credential: credential, Name: name, CreatedAt: f.now()}
	f.passkeys = append(f.passkeys, p)
	cp := *p
	return &cp, nil
}

func (f *fakePasskeyRepo) ListByUser(_ context.Context, userID uuid.UUID) ([]*model.Passkey, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []*model.Passkey
	for _, p := range f.passkeys {
		if p.UserID == userID {
			cp := *p
			out = append(out, &cp)
		}
	}
	return out, nil
}

func (f *fakePasskeyRepo) GetByCredentialID(_ context.Context, credentialID []byte) (*model.Passkey, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, p := range f.passkeys {
		if bytes.Equal(p.CredentialID, credentialID) {
			cp := *p
			return &cp, nil
		}
	}
	return nil, pgx.ErrNoRows
}

func (f *fakePasskeyRepo) CountByUser(ctx context.Context, userID uuid.UUID) (int64, error) {
	list, _ := f.ListByUser(ctx, userID)
	return int64(len(list)), nil
}

func (f *fakePasskeyRepo) Touch(_ context.Context, id, userID uuid.UUID, credential []byte) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, p := range f.passkeys {
		if p.ID == id && p.UserID == userID {
			p.Credential = credential
			now := f.now()
			p.LastUsedAt = &now
		}
	}
	return nil
}

func (f *fakePasskeyRepo) Delete(_ context.Context, id, userID uuid.UUID) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for i, p := range f.passkeys {
		if p.ID == id && p.UserID == userID {
			f.passkeys = append(f.passkeys[:i], f.passkeys[i+1:]...)
			return true, nil
		}
	}
	return false, nil
}

func (f *fakePasskeyRepo) CreateChallenge(_ context.Context, userID *uuid.UUID, purpose model.PasskeyChallengePurpose, session []byte, expiresAt time.Time) (uuid.UUID, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	id := uuid.New()
	f.challenges[id] = fakeChallenge{userID: userID, purpose: purpose, session: session, expiresAt: expiresAt}
	return id, nil
}

func (f *fakePasskeyRepo) ConsumeChallenge(_ context.Context, id uuid.UUID, purpose model.PasskeyChallengePurpose) (*uuid.UUID, []byte, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	c, ok := f.challenges[id]
	if !ok || c.purpose != purpose || !c.expiresAt.After(f.now()) {
		return nil, nil, pgx.ErrNoRows
	}
	delete(f.challenges, id)
	return c.userID, c.session, nil
}
