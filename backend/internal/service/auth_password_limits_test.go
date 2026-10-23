package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/example/pfm/backend/internal/common"
)

// specs/security-hardening-2026-10 US-03: a password bcrypt cannot hash is a
// validation error with the invite left unused, never a 500.
func TestActivate_PasswordByteLimit(t *testing.T) {
	ctx := context.Background()
	svc, repo, _ := newTestAuthService(t)
	expires := time.Now().UTC().Add(72 * time.Hour)

	t.Run("S-HRD-08 73 ASCII bytes", func(t *testing.T) {
		token := newPendingInvite(t, svc, repo, "long@example.com", expires)
		long := strings.Repeat("a", common.MaxPasswordBytes+1)
		_, _, _, err := svc.Activate(ctx, token, "longpass", "", long, long)
		wantAppCode(t, err, common.ErrCodeWeakPassword)
		if repo.byToken[token].Status != "pending" {
			t.Fatalf("invite must stay unused")
		}
	})

	t.Run("S-HRD-09 exactly 72 bytes", func(t *testing.T) {
		token := newPendingInvite(t, svc, repo, "edge@example.com", expires)
		edge := strings.Repeat("a", common.MaxPasswordBytes)
		if _, _, _, err := svc.Activate(ctx, token, "edgepass", "", edge, edge); err != nil {
			t.Fatalf("72 bytes must be accepted: %v", err)
		}
	})

	t.Run("S-HRD-10 30 accented letters are over 72 bytes", func(t *testing.T) {
		token := newPendingInvite(t, svc, repo, "accent@example.com", expires)
		accented := strings.Repeat("ữ", 30) // 3 bytes each in UTF-8
		_, _, _, err := svc.Activate(ctx, token, "accentpass", "", accented, accented)
		wantAppCode(t, err, common.ErrCodeWeakPassword)
	})
}

func TestActivate_FullNameFollowsTheProfileRules(t *testing.T) {
	ctx := context.Background()
	svc, repo, _ := newTestAuthService(t)
	expires := time.Now().UTC().Add(72 * time.Hour)

	for name, fullName := range map[string]string{
		"too long":        strings.Repeat("a", ProfileNameMaxLength+1),
		"markup":          "<script>",
		"control rune":    "Lan\u0000Anh",
		"zero-width rune": "Lan\u200bAnh",
	} {
		t.Run(name, func(t *testing.T) {
			token := newPendingInvite(t, svc, repo, strings.ReplaceAll(name, " ", "")+"@example.com", expires)
			_, _, _, err := svc.Activate(ctx, token, "user"+strings.ReplaceAll(name, " ", "")[:4], fullName, "correcthorse1", "correcthorse1")
			wantAppCode(t, err, common.ErrCodeInvalidFullName)
		})
	}

	t.Run("a valid name is stored normalised", func(t *testing.T) {
		token := newPendingInvite(t, svc, repo, "named@example.com", expires)
		user, _, _, err := svc.Activate(ctx, token, "namedone", "  Lê   Thị  Lan ", "correcthorse1", "correcthorse1")
		if err != nil {
			t.Fatalf("Activate: %v", err)
		}
		if user.FullName == nil || *user.FullName != "Lê Thị Lan" {
			t.Fatalf("full name = %v, want normalised", user.FullName)
		}
	})
}

// S-HRD-11: the over-long new password is refused after the current one is
// checked, and nothing changes.
func TestChangePassword_RefusesPasswordsBcryptCannotHash(t *testing.T) {
	ctx := context.Background()
	f := newSwitchFixture(t)
	user := seedUserWithPassword(t, f.users, "b@example.com", testCurrentPassword)
	_, _, refresh, err := f.auth.Login(ctx, "b@example.com", testCurrentPassword, nil)
	if err != nil {
		t.Fatalf("Login: %v", err)
	}

	long := strings.Repeat("b", common.MaxPasswordBytes+1)
	_, err = f.sessions.ChangePassword(ctx, user.ID, jwt.NewNumericDate(time.Now().UTC()), testCurrentPassword, long, nil)
	wantAppCode(t, err, common.ErrCodeWeakPassword)

	if _, _, err := f.auth.Refresh(ctx, refresh, nil); err != nil {
		t.Fatalf("no session may end on a refused change: %v", err)
	}
	if _, _, _, err := f.auth.Login(ctx, "b@example.com", testCurrentPassword, nil); err != nil {
		t.Fatalf("old password stopped working: %v", err)
	}
}
