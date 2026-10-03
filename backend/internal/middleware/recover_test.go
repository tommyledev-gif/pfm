package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/response"
)

func TestRecover_PanicBecomes500(t *testing.T) {
	logger := zap.NewNop()
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error { return response.Error(c, logger, err) },
	})
	app.Use(Recover(logger))
	app.Get("/boom", func(*fiber.Ctx) error { panic("nil map write") })

	resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/boom", nil))
	if err != nil {
		t.Fatalf("app.Test failed (panic escaped the middleware?): %v", err)
	}
	if resp.StatusCode != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", resp.StatusCode)
	}
}
