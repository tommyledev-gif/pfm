package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/service"
)

const testSigningKey = "test-signing-key-not-for-production"

// stubSessions answers JWTAuth's session question with a canned result and
// records what it was asked.
type stubSessions struct {
	state     *model.SessionAuthState
	err       error
	gotUserID uuid.UUID
	gotSID    uuid.UUID
	calls     int
}

func (s *stubSessions) Authorize(_ context.Context, sessionID, userID uuid.UUID, _ *jwt.NumericDate) (*model.SessionAuthState, error) {
	s.calls++
	s.gotSID, s.gotUserID = sessionID, userID
	return s.state, s.err
}

func liveSession() *stubSessions {
	return &stubSessions{state: &model.SessionAuthState{UserStatus: model.UserStatusActive, UserRole: model.UserRoleMember}}
}

func newProtectedTestApp(tokens *service.TokenService) *fiber.App {
	return newProtectedTestAppWith(tokens, liveSession())
}

func newProtectedTestAppWith(tokens *service.TokenService, sessions SessionAuthorizer) *fiber.App {
	app := fiber.New()
	app.Get("/protected", JWTAuth(tokens, sessions, zap.NewNop()), func(c *fiber.Ctx) error {
		return c.SendString(c.Locals(common.LocalsRole).(string))
	})
	return app
}

// sessionAccessToken mints an access token bound to a session, the way
// SessionService does.
func sessionAccessToken(t *testing.T, tokens *service.TokenService, user *model.User, sessionID uuid.UUID) string {
	t.Helper()
	access, _, err := tokens.IssueSessionTokens(user, sessionID, uuid.NewString(), time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}
	return access
}

func doGetWithAuth(t *testing.T, app *fiber.App, authHeader string) *http.Response {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	if authHeader != "" {
		req.Header.Set(fiber.HeaderAuthorization, authHeader)
	}
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	return resp
}

// TC-USR-07/38: absent Authorization header -> 401.
func TestJWTAuth_Absent(t *testing.T) {
	tokens := service.NewTokenService(testSigningKey)
	app := newProtectedTestApp(tokens)

	resp := doGetWithAuth(t, app, "")
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

// Happy path: valid token with a live session -> 200, request reaches the
// handler, and the session was asked about exactly this (user, session).
func TestJWTAuth_Valid(t *testing.T) {
	tokens := service.NewTokenService(testSigningKey)
	sessions := liveSession()
	app := newProtectedTestAppWith(tokens, sessions)
	user := &model.User{ID: uuid.New(), Role: model.UserRoleMember}
	sid := uuid.New()

	resp := doGetWithAuth(t, app, "Bearer "+sessionAccessToken(t, tokens, user, sid))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	if sessions.calls != 1 || sessions.gotUserID != user.ID || sessions.gotSID != sid {
		t.Fatalf("session asked %d times about user %s / session %s, want once about %s / %s",
			sessions.calls, sessions.gotUserID, sessions.gotSID, user.ID, sid)
	}
}

// The role comes from the session's user row, not from the token: a demoted
// admin's old token stops carrying admin rights at once.
func TestJWTAuth_RoleComesFromTheDatabase(t *testing.T) {
	tokens := service.NewTokenService(testSigningKey)
	sessions := &stubSessions{state: &model.SessionAuthState{UserStatus: model.UserStatusActive, UserRole: model.UserRoleMember}}
	app := newProtectedTestAppWith(tokens, sessions)
	adminAtIssue := &model.User{ID: uuid.New(), Role: model.UserRoleAdmin}

	resp := doGetWithAuth(t, app, "Bearer "+sessionAccessToken(t, tokens, adminAtIssue, uuid.New()))
	body := make([]byte, 16)
	n, _ := resp.Body.Read(body)
	if got := string(body[:n]); got != string(model.UserRoleMember) {
		t.Fatalf("handler saw role %q, want %q (the database's)", got, model.UserRoleMember)
	}
}

// A token with no `sid` predates sessions: refused even though its signature
// is valid. This is also what stops a token forged with a leaked signing key
// — it has no session to point at.
func TestJWTAuth_RejectsTokenWithoutSession(t *testing.T) {
	tokens := service.NewTokenService(testSigningKey)
	sessions := liveSession()
	app := newProtectedTestAppWith(tokens, sessions)
	access, _, err := tokens.GenerateTokenPair(&model.User{ID: uuid.New(), Role: model.UserRoleMember})
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	resp := doGetWithAuth(t, app, "Bearer "+access)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
	if sessions.calls != 0 {
		t.Fatal("a token without a session must be refused before any lookup")
	}
}

// A correctly signed admin token whose session does not exist (forged with
// the real key, or its session was revoked) -> 401.
func TestJWTAuth_RejectsDeadOrUnknownSession(t *testing.T) {
	tokens := service.NewTokenService(testSigningKey)
	sessions := &stubSessions{err: common.ErrUnauthenticated}
	app := newProtectedTestAppWith(tokens, sessions)
	forgedAdmin := &model.User{ID: uuid.New(), Role: model.UserRoleAdmin}

	resp := doGetWithAuth(t, app, "Bearer "+sessionAccessToken(t, tokens, forgedAdmin, uuid.New()))
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

// Failing to look the session up is a server error, never a 401: clients
// sign the user out on 401.
func TestJWTAuth_SessionLookupFailureIsNot401(t *testing.T) {
	tokens := service.NewTokenService(testSigningKey)
	sessions := &stubSessions{err: errors.New("connection refused")}
	app := newProtectedTestAppWith(tokens, sessions)

	resp := doGetWithAuth(t, app, "Bearer "+sessionAccessToken(t, tokens, &model.User{ID: uuid.New(), Role: model.UserRoleMember}, uuid.New()))
	if resp.StatusCode != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", resp.StatusCode)
	}
}

// TC-USR-08: expired token -> 401.
func TestJWTAuth_Expired(t *testing.T) {
	tokens := service.NewTokenService(testSigningKey)
	app := newProtectedTestApp(tokens)

	past := time.Now().UTC().Add(-1 * time.Hour)
	expired := jwt.NewWithClaims(jwt.SigningMethodHS256, service.AccessClaims{
		UserID: uuid.NewString(),
		Role:   string(model.UserRoleMember),
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(past.Add(-common.AccessTokenTTL)),
			ExpiresAt: jwt.NewNumericDate(past),
		},
	})
	signed, err := expired.SignedString([]byte(testSigningKey))
	if err != nil {
		t.Fatalf("failed to sign expired token: %v", err)
	}

	resp := doGetWithAuth(t, app, "Bearer "+signed)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

// TC-USR-47/48: structurally valid JWT, tampered/wrong-key signature -> 401,
// distinct code path from "expired" and "absent".
func TestJWTAuth_InvalidSignature(t *testing.T) {
	tokens := service.NewTokenService(testSigningKey)
	app := newProtectedTestApp(tokens)

	future := time.Now().UTC().Add(common.AccessTokenTTL)
	tampered := jwt.NewWithClaims(jwt.SigningMethodHS256, service.AccessClaims{
		UserID: uuid.NewString(),
		Role:   string(model.UserRoleAdmin),
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(time.Now().UTC()),
			ExpiresAt: jwt.NewNumericDate(future),
		},
	})
	// Signed with a DIFFERENT key than the server verifies against.
	signed, err := tampered.SignedString([]byte("a-completely-different-key"))
	if err != nil {
		t.Fatalf("failed to sign tampered token: %v", err)
	}

	resp := doGetWithAuth(t, app, "Bearer "+signed)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestJWTAuth_MalformedHeader(t *testing.T) {
	tokens := service.NewTokenService(testSigningKey)
	app := newProtectedTestApp(tokens)

	resp := doGetWithAuth(t, app, "not-a-bearer-token")
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

// specs/mobile-account-switch S-ASW-22 / plan Finding #2: a switch token
// carries no user_id/role claims, so it can never act as an access token.
func TestJWTAuth_RejectsSwitchToken(t *testing.T) {
	tokens := service.NewTokenService(testSigningKey)
	app := newProtectedTestApp(tokens)
	switchToken, _, err := tokens.IssueSwitchToken(uuid.New())
	if err != nil {
		t.Fatalf("failed to issue switch token: %v", err)
	}

	resp := doGetWithAuth(t, app, "Bearer "+switchToken)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}
