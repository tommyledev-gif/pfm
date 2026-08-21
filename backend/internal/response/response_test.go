package response

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
)

func newTestApp() *fiber.App {
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			return Error(c, zap.NewNop(), err)
		},
	})
	app.Get("/only-get", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})
	app.Get("/app-error", func(c *fiber.Ctx) error {
		return Error(c, zap.NewNop(), common.ErrWalletNotFound)
	})
	app.Get("/unknown-error", func(c *fiber.Ctx) error {
		return Error(c, zap.NewNop(), errors.New("boom"))
	})
	return app
}

func doRequest(t *testing.T, app *fiber.App, method, path string) (int, Body) {
	t.Helper()
	resp, err := app.Test(httptest.NewRequest(method, path, nil))
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close() //nolint:errcheck // test cleanup

	var body Body
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	return resp.StatusCode, body
}

// SDS.md §6.1 / §12.1 Known Issues Log Items 1 & 4: a route that exists but
// doesn't accept this HTTP verb (Fiber's own 405, raised before any handler
// runs) must keep its real status and a matching error_code — not be
// coerced into a generic 500 INTERNAL_ERROR.
func TestError_FiberMethodNotAllowedPreservesStatus(t *testing.T) {
	app := newTestApp()
	status, body := doRequest(t, app, http.MethodPost, "/only-get")

	if status != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", status)
	}
	if body.ErrorCode != common.ErrCodeMethodNotAllowed {
		t.Fatalf("expected error_code %s, got %s", common.ErrCodeMethodNotAllowed, body.ErrorCode)
	}
	if body.Success {
		t.Fatalf("expected success=false")
	}
}

// Same bug, the other confirmed symptom: an unmatched route (Fiber's own
// 404) must not become a 500 either.
func TestError_FiberNotFoundPreservesStatus(t *testing.T) {
	app := newTestApp()
	status, body := doRequest(t, app, http.MethodGet, "/this-route-does-not-exist")

	if status != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", status)
	}
	if body.ErrorCode != common.ErrCodeNotFound {
		t.Fatalf("expected error_code %s, got %s", common.ErrCodeNotFound, body.ErrorCode)
	}
}

// Regression guard: a known *common.AppError must still map to its own
// status/code exactly as before this fix — the new *fiber.Error branch must
// never intercept it.
func TestError_AppErrorUnaffected(t *testing.T) {
	app := newTestApp()
	status, body := doRequest(t, app, http.MethodGet, "/app-error")

	if status != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", status)
	}
	if body.ErrorCode != common.ErrCodeWalletNotFound {
		t.Fatalf("expected error_code %s, got %s", common.ErrCodeWalletNotFound, body.ErrorCode)
	}
}

// Regression guard: a genuinely unknown error (neither AppError nor
// fiber.Error) must still fall through to the generic 500 INTERNAL_ERROR —
// this fix must not accidentally leak internal error details either.
func TestError_UnknownErrorStillInternalError(t *testing.T) {
	app := newTestApp()
	status, body := doRequest(t, app, http.MethodGet, "/unknown-error")

	if status != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", status)
	}
	if body.ErrorCode != "INTERNAL_ERROR" {
		t.Fatalf("expected error_code INTERNAL_ERROR, got %s", body.ErrorCode)
	}
	if body.Message != "an unexpected error occurred" {
		t.Fatalf("expected generic message, got %q (must never leak internal error text)", body.Message)
	}
}
