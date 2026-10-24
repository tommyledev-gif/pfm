package middleware

import (
	"net/http"
	"testing"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
)

// S-FPW-07: past the per-IP cap the request route answers 429, and the two
// routes keep separate counters.
func TestPasswordResetRateLimiters(t *testing.T) {
	app := fiber.New()
	ok := func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) }
	app.Post("/request", PasswordResetRequestRateLimiter(zap.NewNop()), ok)
	app.Post("/confirm", PasswordResetConfirmRateLimiter(zap.NewNop()), ok)

	for i := 0; i < common.PasswordResetRequestRateLimit; i++ {
		if got := post(t, app, "/request"); got != http.StatusOK {
			t.Fatalf("request %d: got %d", i+1, got)
		}
	}
	if got := post(t, app, "/request"); got != http.StatusTooManyRequests {
		t.Fatalf("past the request cap: got %d, want 429", got)
	}
	for i := 0; i < common.PasswordResetConfirmRateLimit; i++ {
		if got := post(t, app, "/confirm"); got != http.StatusOK {
			t.Fatalf("confirm %d: got %d", i+1, got)
		}
	}
	if got := post(t, app, "/confirm"); got != http.StatusTooManyRequests {
		t.Fatalf("past the confirm cap: got %d, want 429", got)
	}
}
