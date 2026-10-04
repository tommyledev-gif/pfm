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

const testSwitchSigningKey = "test-signing-key-not-for-production"

type switchFixture struct {
	tokens   *TokenService
	users    *fakeUserRepo
	revoked  *fakeRevokedTokenRepo
	auth     *AuthService
	switches *AccountSwitchService
	sessions *SessionRevocationService
}

func newSwitchFixture(t *testing.T) *switchFixture {
	t.Helper()
	tokens := NewTokenService(testSwitchSigningKey)
	users := newFakeUserRepo()
	revoked := newFakeRevokedTokenRepo()
	switches := NewAccountSwitchService(users, revoked, tokens, zap.NewNop())
	return &switchFixture{
		tokens:   tokens,
		users:    users,
		revoked:  revoked,
		auth:     NewAuthService(users, revoked, tokens, zap.NewNop()),
		switches: switches,
		sessions: NewSessionRevocationService(users, switches, zap.NewNop()),
	}
}

// signTestClaims signs arbitrary claims with the fixture key, for tokens a
// real code path would never mint (expired, back-dated, wrong purpose).
func signTestClaims(t *testing.T, claims jwt.Claims) string {
	t.Helper()
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testSwitchSigningKey))
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return signed
}

// backdatedSwitchToken builds a valid-looking switch token issued at iat.
func backdatedSwitchToken(t *testing.T, userID uuid.UUID, iat, exp time.Time) string {
	t.Helper()
	return signTestClaims(t, switchTokenClaims{
		Purpose: common.AccountSwitchTokenPurpose,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.NewString(),
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(iat),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	})
}

func wantAppCode(t *testing.T, err error, code string) {
	t.Helper()
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != code {
		t.Fatalf("expected %s, got %v", code, err)
	}
}

func TestTokenService_SwitchTokenRoundTrip(t *testing.T) {
	tokens := NewTokenService(testSwitchSigningKey)
	userID := uuid.New()
	token, expiresAt, err := tokens.IssueSwitchToken(userID)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	if got := time.Until(expiresAt); got < common.AccountSwitchTokenTTL-time.Minute || got > common.AccountSwitchTokenTTL {
		t.Fatalf("expected ~180-day expiry, got %v", got)
	}
	claims, err := tokens.ParseSwitchToken(token)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if claims.UserID != userID || claims.JTI == "" || claims.IssuedAt == nil {
		t.Fatalf("unexpected claims %+v", claims)
	}
}

// BR-04 / S-ASW-22 / plan Finding #1: a switch token can never renew a session.
func TestAuthService_Refresh_RejectsSwitchToken(t *testing.T) {
	f := newSwitchFixture(t)
	user := seedUser(f.users, "a@example.com", model.UserStatusActive)
	switchToken, _, err := f.tokens.IssueSwitchToken(user.ID)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	_, _, err = f.auth.Refresh(context.Background(), switchToken)
	wantAppCode(t, err, common.ErrCodeUnauthenticated)
}

// BR-11 / S-ASW-57: a refresh token issued before the sign-out point is refused.
func TestAuthService_Refresh_RejectsTokenIssuedBeforeRevocation(t *testing.T) {
	f := newSwitchFixture(t)
	user := seedUser(f.users, "a@example.com", model.UserStatusActive)
	now := time.Now().UTC()
	refresh := signTestClaims(t, refreshClaims{RegisteredClaims: jwt.RegisteredClaims{
		ID:        uuid.NewString(),
		Subject:   user.ID.String(),
		IssuedAt:  jwt.NewNumericDate(now.Add(-time.Minute)),
		ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
	}})
	f.users.setTokensValidAfter(user.ID, now.Truncate(time.Second))

	_, _, err := f.auth.Refresh(context.Background(), refresh)
	wantAppCode(t, err, common.ErrCodeUnauthenticated)
}

func TestIssuedBeforeRevocation(t *testing.T) {
	point := time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC)
	tests := []struct {
		name  string
		iat   *jwt.NumericDate
		point *time.Time
		want  bool
	}{
		{"no point set", jwt.NewNumericDate(point.Add(-time.Hour)), nil, false},
		{"no iat with point", nil, &point, true},
		{"earlier second", jwt.NewNumericDate(point.Add(-time.Second)), &point, true},
		{"same second", jwt.NewNumericDate(point), &point, false},
		{"same second, point has sub-second part", jwt.NewNumericDate(point), ptrTime(point.Add(900 * time.Millisecond)), false},
		{"later", jwt.NewNumericDate(point.Add(time.Second)), &point, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := issuedBeforeRevocation(tc.iat, tc.point); got != tc.want {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
		})
	}
}

func ptrTime(v time.Time) *time.Time { return &v }
