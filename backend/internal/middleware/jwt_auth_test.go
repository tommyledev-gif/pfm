package middleware

import (
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

func newProtectedTestApp(tokens *service.TokenService) *fiber.App {
	app := fiber.New()
	app.Get("/protected", JWTAuth(tokens, zap.NewNop()), func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})
	return app
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

// Happy path: valid token -> 200, request reaches the handler.
func TestJWTAuth_Valid(t *testing.T) {
	tokens := service.NewTokenService(testSigningKey)
	app := newProtectedTestApp(tokens)
	access, _, err := tokens.GenerateTokenPair(&model.User{ID: uuid.New(), Role: model.UserRoleMember})
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	resp := doGetWithAuth(t, app, "Bearer "+access)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
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
