package middleware

import (
	"net/http"
	"testing"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
)

// newAIRoutesApp mirrors routes.go's /ai group: per-route limiters, one shared
// model-budget instance, one shared local instance.
func newAIRoutesApp() *fiber.App {
	app := fiber.New()
	asUser := func(c *fiber.Ctx) error { // stand-in for JWTAuth
		c.Locals(common.LocalsUserID, "user-1")
		return c.Next()
	}
	ok := func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) }
	model := AIChatRateLimiter(zap.NewNop())
	local := AILocalRateLimiter(zap.NewNop())
	ai := app.Group("/ai", asUser)
	ai.Post("/chat", model, ok)
	ai.Post("/suggest-category-name", model, ok)
	ai.Post("/chat/thread/sync", local, ok)
	ai.Post("/budget-proposals", local, ok)
	return app
}

// specs/security-hardening-2026-10 F-17: syncing the thread after every
// message must not spend the chat's model budget.
func TestAIRateLimits_SyncNeverSpendsTheChatBudget(t *testing.T) {
	app := newAIRoutesApp()
	for i := 0; i < common.AIChatRateLimit*3; i++ {
		if got := post(t, app, "/ai/chat/thread/sync"); got != http.StatusOK {
			t.Fatalf("sync %d: got %d", i+1, got)
		}
	}
	if got := post(t, app, "/ai/chat"); got != http.StatusOK {
		t.Fatalf("chat after many syncs: got %d, want 200", got)
	}
}

// The two model-backed routes still share one budget.
func TestAIRateLimits_ModelRoutesShareOneBudget(t *testing.T) {
	app := newAIRoutesApp()
	for i := 0; i < common.AIChatRateLimit; i++ {
		path := []string{"/ai/chat", "/ai/suggest-category-name"}[i%2]
		if got := post(t, app, path); got != http.StatusOK {
			t.Fatalf("request %d: got %d", i+1, got)
		}
	}
	if got := post(t, app, "/ai/chat"); got != http.StatusTooManyRequests {
		t.Fatalf("past the shared model budget: got %d, want 429", got)
	}
	if got := post(t, app, "/ai/budget-proposals"); got != http.StatusOK {
		t.Fatalf("local routes keep working: got %d", got)
	}
}
