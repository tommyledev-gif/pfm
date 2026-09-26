package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
)

// newLimiterTestApp mirrors routes.go's shape: the /ai group carries
// AIChatRateLimiter as group middleware, /analytics/consult carries its own
// per-route limiter, /analytics/query carries none.
func newLimiterTestApp(consultStatus int) *fiber.App {
	app := fiber.New()
	asUser := func(c *fiber.Ctx) error { // stand-in for JWTAuth
		c.Locals(common.LocalsUserID, "user-1")
		return c.Next()
	}
	ok := func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) }

	ai := app.Group("/ai", asUser, AIChatRateLimiter(zap.NewNop()))
	ai.Post("/chat", ok)
	analytics := app.Group("/analytics", asUser)
	analytics.Post("/query", ok)
	analytics.Post("/consult", AIConsultRateLimiter(zap.NewNop()), func(c *fiber.Ctx) error { return c.SendStatus(consultStatus) })
	return app
}

func post(t *testing.T, app *fiber.App, path string) int {
	t.Helper()
	resp, err := app.Test(httptest.NewRequest(http.MethodPost, path, nil))
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	return resp.StatusCode
}

// S-AIQ-37/S-AIQ-38/S-AIQ-39: exhausting the free-text limit rate-limits
// only free text — recording via chat and chips keep working.
func TestAIConsultRateLimiter_IsolatedFromRecording(t *testing.T) {
	app := newLimiterTestApp(fiber.StatusOK)
	for i := 0; i < common.AIConsultRateLimit; i++ {
		if got := post(t, app, "/analytics/consult"); got != http.StatusOK {
			t.Fatalf("request %d: got %d", i, got)
		}
	}
	if got := post(t, app, "/analytics/consult"); got != http.StatusTooManyRequests {
		t.Fatalf("expected 429 after the limit, got %d", got)
	}
	if got := post(t, app, "/ai/chat"); got != http.StatusOK {
		t.Fatalf("recording via chat must still work, got %d", got)
	}
	if got := post(t, app, "/analytics/query"); got != http.StatusOK {
		t.Fatalf("chips must still work, got %d", got)
	}
}

// Plan BR-19: rejected (4xx) messages do not count toward the limit.
func TestAIConsultRateLimiter_SkipsFailedRequests(t *testing.T) {
	app := newLimiterTestApp(fiber.StatusBadRequest)
	for i := 0; i <= common.AIConsultRateLimit; i++ {
		if got := post(t, app, "/analytics/consult"); got != http.StatusBadRequest {
			t.Fatalf("request %d: got %d, rejected requests must not be rate limited", i, got)
		}
	}
}
