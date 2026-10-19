package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

func TestSessionRevocationService_RevokeAllForSelf(t *testing.T) {
	ctx := context.Background()

	t.Run("fresh credentials keep working, older ones are refused", func(t *testing.T) {
		f := newSwitchFixture(t)
		user := seedUser(f.users, "a@example.com", model.UserStatusActive)
		earlier := time.Now().UTC().Add(-time.Minute)
		oldRefresh := signTestClaims(t, refreshClaims{RegisteredClaims: jwt.RegisteredClaims{
			ID: uuid.NewString(), Subject: user.ID.String(),
			IssuedAt: jwt.NewNumericDate(earlier), ExpiresAt: jwt.NewNumericDate(earlier.Add(time.Hour)),
		}})
		oldSwitch := backdatedSwitchToken(t, user.ID, earlier, earlier.Add(time.Hour))

		session, err := f.sessions.RevokeAllForSelf(ctx, user.ID, jwt.NewNumericDate(time.Now().UTC()), nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if _, _, err := f.auth.Refresh(ctx, session.RefreshToken, nil); err != nil {
			t.Fatalf("fresh refresh token must be accepted: %v", err)
		}
		if _, err := f.switches.Switch(ctx, session.SwitchToken, nil); err != nil {
			t.Fatalf("fresh switch token must be accepted: %v", err)
		}
		_, _, err = f.auth.Refresh(ctx, oldRefresh, nil)
		wantAppCode(t, err, common.ErrCodeUnauthenticated)
		_, err = f.switches.Switch(ctx, oldSwitch, nil)
		wantAppCode(t, err, common.ErrCodeUnauthenticated)
	})

	t.Run("stale access cannot re-run the sign-out (S-ASW-63)", func(t *testing.T) {
		f := newSwitchFixture(t)
		user := seedUser(f.users, "a@example.com", model.UserStatusActive)
		f.users.setTokensValidAfter(user.ID, time.Now().UTC())
		stale := jwt.NewNumericDate(time.Now().UTC().Add(-time.Minute))
		_, err := f.sessions.RevokeAllForSelf(ctx, user.ID, stale, nil)
		wantAppCode(t, err, common.ErrCodeUnauthenticated)
	})

	t.Run("inactive caller is refused", func(t *testing.T) {
		f := newSwitchFixture(t)
		user := seedUser(f.users, "d@example.com", model.UserStatusDisabled)
		_, err := f.sessions.RevokeAllForSelf(ctx, user.ID, jwt.NewNumericDate(time.Now().UTC()), nil)
		wantAppCode(t, err, common.ErrCodeUnauthenticated)
	})

	t.Run("write failure is a system error", func(t *testing.T) {
		f := newSwitchFixture(t)
		user := seedUser(f.users, "a@example.com", model.UserStatusActive)
		failing := failingSetUserRepo{f.users}
		svc := NewSessionRevocationService(failing, NewAccountSwitchService(failing, f.revoked, f.tokens, f.sessionSvc, zap.NewNop()), f.sessionSvc, zap.NewNop())
		_, err := svc.RevokeAllForSelf(ctx, user.ID, jwt.NewNumericDate(time.Now().UTC()), nil)
		var appErr *common.AppError
		if !errors.Is(err, errFakeWrite) || errors.As(err, &appErr) {
			t.Fatalf("expected the wrapped write error, got %v", err)
		}
	})
}

func TestSessionRevocationService_RevokeAllForUser(t *testing.T) {
	ctx := context.Background()

	t.Run("admin signs another user out everywhere", func(t *testing.T) {
		f := newSwitchFixture(t)
		target := seedUser(f.users, "m@example.com", model.UserStatusActive)
		token := backdatedSwitchToken(t, target.ID, time.Now().UTC().Add(-time.Minute), time.Now().UTC().Add(time.Hour))
		if err := f.sessions.RevokeAllForUser(ctx, uuid.New(), target.ID); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		_, err := f.switches.Switch(ctx, token, nil)
		wantAppCode(t, err, common.ErrCodeUnauthenticated)
	})

	t.Run("self target is invalid input", func(t *testing.T) {
		f := newSwitchFixture(t)
		admin := seedUser(f.users, "x@example.com", model.UserStatusActive)
		wantAppCode(t, f.sessions.RevokeAllForUser(ctx, admin.ID, admin.ID), common.ErrCodeInvalidInput)
	})

	t.Run("unknown target is not found", func(t *testing.T) {
		f := newSwitchFixture(t)
		wantAppCode(t, f.sessions.RevokeAllForUser(ctx, uuid.New(), uuid.New()), common.ErrCodeNotFound)
	})
}
