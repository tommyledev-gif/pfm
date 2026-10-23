package service

import (
	"context"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

const foreignSigningKey = "a-key-this-server-never-signed-with-0123456789"

// S-HRD-13: a token signed with another key, valid until year 9999, used to
// add a deny-list row nobody could ever purge.
func TestLogout_ForgedTokenWritesNothing(t *testing.T) {
	svc, _, revokedRepo := newTestAuthService(t)
	forged, err := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.NewString(),
			Subject:   uuid.NewString(),
			ExpiresAt: jwt.NewNumericDate(time.Date(9999, 1, 1, 0, 0, 0, 0, time.UTC)),
		},
	}).SignedString([]byte(foreignSigningKey))
	if err != nil {
		t.Fatal(err)
	}

	if err := svc.Logout(context.Background(), forged); err != nil {
		t.Fatalf("a forged token must be a silent success, got %v", err)
	}
	if got := revokedRepo.revokedCount(); got != 0 {
		t.Fatalf("nothing may be written for a forged token, got %d rows", got)
	}
}

// S-HRD-14: an expired genuine token is idempotent success, nothing written.
func TestLogout_ExpiredTokenWritesNothing(t *testing.T) {
	svc, repo, revokedRepo := newTestAuthService(t)
	seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
	user, _ := repo.GetUserByEmail(context.Background(), "homer@example.com")
	_, expired, err := svc.tokens.sign(user, uuid.Nil, uuid.NewString(), time.Now().UTC().Add(-time.Hour))
	if err != nil {
		t.Fatal(err)
	}

	if err := svc.Logout(context.Background(), expired); err != nil {
		t.Fatalf("expired token: %v", err)
	}
	if got := revokedRepo.revokedCount(); got != 0 {
		t.Fatalf("an expired token can never be refreshed; got %d rows", got)
	}
}

// S-HRD-17 and a correctly signed token of the wrong kind: both 400, as before.
func TestLogout_NotARefreshTokenIsInvalidInput(t *testing.T) {
	svc, repo, revokedRepo := newTestAuthService(t)
	seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
	_, access, _, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1", nil)
	if err != nil {
		t.Fatal(err)
	}

	wantAppCode(t, svc.Logout(context.Background(), "abc"), common.ErrCodeInvalidInput)
	wantAppCode(t, svc.Logout(context.Background(), access), common.ErrCodeInvalidInput)
	if got := revokedRepo.revokedCount(); got != 0 {
		t.Fatalf("got %d rows", got)
	}
}

// S-HRD-18: the same for the deprecated switch-token revoke.
func TestRevokeSwitchToken_ForgedTokenWritesNothing(t *testing.T) {
	f := newSwitchFixture(t)
	forged, _, err := NewTokenService(foreignSigningKey).IssueSwitchToken(uuid.New())
	if err != nil {
		t.Fatal(err)
	}

	if err := f.switches.Revoke(context.Background(), forged); err != nil {
		t.Fatalf("a forged token must be a silent success, got %v", err)
	}
	if got := f.revoked.revokedCount(); got != 0 {
		t.Fatalf("nothing may be written for a forged token, got %d rows", got)
	}
}

func TestIsUntrustedToken(t *testing.T) {
	tokens := NewTokenService(testSigningKey)
	forged, _, _ := NewTokenService(foreignSigningKey).IssueSwitchToken(uuid.New())
	_, err := tokens.ParseSwitchToken(forged)
	if !isUntrustedToken(err) {
		t.Fatalf("bad signature must be untrusted: %v", err)
	}
	_, err = tokens.ParseSwitchToken("not-a-jwt")
	if isUntrustedToken(err) {
		t.Fatalf("a malformed value is not a token at all, so it is not 'untrusted': %v", err)
	}
	none := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.RegisteredClaims{ID: "x", Subject: uuid.NewString()})
	unsigned, _ := none.SignedString(jwt.UnsafeAllowNoneSignatureType)
	_, err = tokens.ParseRefreshToken(unsigned)
	if !isUntrustedToken(err) {
		t.Fatalf("alg=none must be untrusted: %v", err)
	}
}
