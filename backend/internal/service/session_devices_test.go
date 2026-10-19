package service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// startOn opens a session for user on device and returns its id and refresh
// token.
func (f *sessionFixture) startOn(t *testing.T, user *model.User, device *model.SessionDevice) (uuid.UUID, string) {
	t.Helper()
	access, refresh, err := f.svc.Start(context.Background(), user, device)
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	claims, err := f.tokens.ParseAccessToken(access)
	if err != nil {
		t.Fatalf("ParseAccessToken: %v", err)
	}
	return uuid.MustParse(claims.SessionID), refresh
}

func TestSessionStart_ReplacesTheUsersSessionOnTheSameDevice(t *testing.T) {
	f := newSessionFixture(t)
	alice := f.activeUser("alice@example.com")
	bob := f.activeUser("bob@example.com")
	phone := &model.SessionDevice{ID: uuid.New(), Name: "Pixel 8"}

	first, _ := f.startOn(t, alice, phone)
	other, _ := f.startOn(t, alice, &model.SessionDevice{ID: uuid.New()})
	bobOnPhone, _ := f.startOn(t, bob, phone)
	second, _ := f.startOn(t, alice, phone)

	if s := f.repo.sessionFor(first); s.RevokedAt == nil || *s.RevokedReason != model.SessionRevokedReplaced {
		t.Fatalf("first session on the phone = %+v, want revoked as replaced", s)
	}
	for name, id := range map[string]uuid.UUID{"new phone session": second, "other device": other, "other user on the phone": bobOnPhone} {
		if s := f.repo.sessionFor(id); s.RevokedAt != nil {
			t.Fatalf("%s was revoked (%s)", name, *s.RevokedReason)
		}
	}
	if s := f.repo.sessionFor(second); s.DeviceName == nil || *s.DeviceName != "Pixel 8" {
		t.Fatalf("device name not stored: %+v", s.DeviceName)
	}
}

func TestSessionStart_WithoutDeviceNeverReplaces(t *testing.T) {
	f := newSessionFixture(t)
	alice := f.activeUser("alice@example.com")
	first, _ := f.startOn(t, alice, nil)
	f.startOn(t, alice, nil)
	if s := f.repo.sessionFor(first); s.RevokedAt != nil {
		t.Fatalf("a session without a device was replaced (%s)", *s.RevokedReason)
	}
}

func TestSessionRefresh_RecordsADeviceOnlyOnce(t *testing.T) {
	f := newSessionFixture(t)
	alice := f.activeUser("alice@example.com")
	sid, refresh := f.startOn(t, alice, nil)

	info, _ := f.tokens.ParseRefreshToken(refresh)
	phone := &model.SessionDevice{ID: uuid.New(), Name: "Galaxy S24"}
	_, next, err := f.svc.Refresh(context.Background(), alice, info, phone)
	if err != nil {
		t.Fatalf("Refresh: %v", err)
	}
	if s := f.repo.sessionFor(sid); s.DeviceID == nil || *s.DeviceID != phone.ID || *s.DeviceName != "Galaxy S24" {
		t.Fatalf("device not recorded on refresh: %+v", s)
	}

	info, _ = f.tokens.ParseRefreshToken(next)
	if _, _, err := f.svc.Refresh(context.Background(), alice, info, &model.SessionDevice{ID: uuid.New(), Name: "Other"}); err != nil {
		t.Fatalf("second Refresh: %v", err)
	}
	if s := f.repo.sessionFor(sid); *s.DeviceID != phone.ID || *s.DeviceName != "Galaxy S24" {
		t.Fatalf("a recorded device was overwritten: %+v", s)
	}
}

func TestSessionListDevices_OnlyTheUsersLiveSessions(t *testing.T) {
	f := newSessionFixture(t)
	alice := f.activeUser("alice@example.com")
	bob := f.activeUser("bob@example.com")
	live, _ := f.startOn(t, alice, &model.SessionDevice{ID: uuid.New(), Name: "Pixel 8"})
	ended, _ := f.startOn(t, alice, &model.SessionDevice{ID: uuid.New()})
	f.startOn(t, bob, nil)
	if err := f.svc.End(context.Background(), ended, alice.ID, model.SessionRevokedLogout); err != nil {
		t.Fatalf("End: %v", err)
	}

	items, err := f.svc.ListDevices(context.Background(), alice.ID)
	if err != nil {
		t.Fatalf("ListDevices: %v", err)
	}
	if len(items) != 1 || items[0].ID != live {
		t.Fatalf("ListDevices = %+v, want only %s", items, live)
	}
}

func TestSessionSignOutDevice(t *testing.T) {
	ctx := context.Background()
	f := newSessionFixture(t)
	alice := f.activeUser("alice@example.com")
	bob := f.activeUser("bob@example.com")
	current, _ := f.startOn(t, alice, &model.SessionDevice{ID: uuid.New()})
	lost, lostRefresh := f.startOn(t, alice, &model.SessionDevice{ID: uuid.New()})
	bobs, _ := f.startOn(t, bob, nil)

	t.Run("the calling device is refused", func(t *testing.T) {
		var appErr *common.AppError
		err := f.svc.SignOutDevice(ctx, alice.ID, current, current)
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeInvalidInput {
			t.Fatalf("err = %v, want INVALID_INPUT", err)
		}
	})

	t.Run("another user's session is not found", func(t *testing.T) {
		if err := f.svc.SignOutDevice(ctx, alice.ID, current, bobs); !errors.Is(err, common.ErrNotFound) {
			t.Fatalf("err = %v, want NOT_FOUND", err)
		}
		if err := f.svc.SignOutDevice(ctx, alice.ID, current, uuid.New()); !errors.Is(err, common.ErrNotFound) {
			t.Fatalf("unknown id: err = %v, want NOT_FOUND", err)
		}
		if s := f.repo.sessionFor(bobs); s.RevokedAt != nil {
			t.Fatal("bob's session was revoked")
		}
	})

	t.Run("signs the device out, twice is fine", func(t *testing.T) {
		if err := f.svc.SignOutDevice(ctx, alice.ID, current, lost); err != nil {
			t.Fatalf("SignOutDevice: %v", err)
		}
		if s := f.repo.sessionFor(lost); s.RevokedAt == nil || *s.RevokedReason != model.SessionRevokedDeviceSignOut {
			t.Fatalf("lost session = %+v, want revoked as device_sign_out", s)
		}
		if _, _, err := f.refresh(t, alice, lostRefresh); !isUnauthenticated(err) {
			t.Fatalf("refresh on the signed-out device = %v, want 401", err)
		}
		if err := f.svc.SignOutDevice(ctx, alice.ID, current, lost); err != nil {
			t.Fatalf("second SignOutDevice = %v, want no-op", err)
		}
		if s := f.repo.sessionFor(current); s.RevokedAt != nil {
			t.Fatal("the calling device was signed out too")
		}
	})
}
