package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
)

func newRoleGatedTestApp(requiredRole, injectedRole string) *fiber.App {
	app := fiber.New()
	app.Get("/admin-only",
		func(c *fiber.Ctx) error { // stand-in for JWTAuth, since it only needs to set locals
			c.Locals(common.LocalsRole, injectedRole)
			return c.Next()
		},
		RequireRole(requiredRole, zap.NewNop()),
		func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) },
	)
	return app
}

// TC-USR-09/37: caller role does not match the required role -> 403.
func TestRequireRole_Forbidden(t *testing.T) {
	app := newRoleGatedTestApp("admin", "member")
	resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/admin-only", nil))
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
}

func TestRequireRole_Allowed(t *testing.T) {
	app := newRoleGatedTestApp("admin", "admin")
	resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/admin-only", nil))
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}
