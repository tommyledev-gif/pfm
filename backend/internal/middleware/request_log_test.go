package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"go.uber.org/zap/zaptest/observer"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/response"
)

// newObservedApp mirrors main.go's middleware order: RequestLogger, Recover,
// SecurityHeaders, then the routes.
func newObservedApp() (*fiber.App, *observer.ObservedLogs) {
	core, logs := observer.New(zapcore.DebugLevel)
	logger := zap.New(core)
	app := fiber.New(fiber.Config{ErrorHandler: func(c *fiber.Ctx, err error) error {
		return response.Error(c, logger, err)
	}})
	app.Use(RequestLogger(logger, "/health"))
	app.Use(Recover(logger))
	app.Use(SecurityHeaders())
	app.Get("/health", func(c *fiber.Ctx) error { return c.SendString("ok") })
	app.Get("/ok", func(c *fiber.Ctx) error {
		c.Locals(common.LocalsUserID, "user-1")
		return c.SendString("hello")
	})
	app.Get("/denied", func(c *fiber.Ctx) error { return response.Error(c, logger, common.ErrUnauthenticated) })
	app.Get("/panic", func(c *fiber.Ctx) error { panic("boom") })
	return app, logs
}

func get(t *testing.T, app *fiber.App, target string, header map[string]string) *http.Response {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, target, nil)
	for k, v := range header {
		req.Header.Set(k, v)
	}
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	return resp
}

func requestLines(logs *observer.ObservedLogs) []observer.LoggedEntry {
	return logs.FilterMessage("request").All()
}

// S-HRD-24: no id sent -> a UUID is made, echoed, and logged.
func TestRequestLogger_AssignsAndEchoesAnID(t *testing.T) {
	app, logs := newObservedApp()
	resp := get(t, app, "/ok", nil)

	id := resp.Header.Get(fiber.HeaderXRequestID)
	if _, err := uuid.Parse(id); err != nil || len(id) != uuidStringLength {
		t.Fatalf("response id %q is not a UUID", id)
	}
	lines := requestLines(logs)
	if len(lines) != 1 {
		t.Fatalf("want 1 request line, got %d", len(lines))
	}
	fields := lines[0].ContextMap()
	if fields["request_id"] != id || fields["status"] != int64(http.StatusOK) || fields["user_id"] != "user-1" || fields["bytes"] != int64(len("hello")) {
		t.Fatalf("unexpected fields: %v", fields)
	}
}

// S-HRD-25 / S-HRD-26: a client UUID is kept; anything else is replaced.
func TestRequestLogger_OnlyEchoesCanonicalUUIDs(t *testing.T) {
	app, _ := newObservedApp()
	sent := uuid.NewString()
	if got := get(t, app, "/ok", map[string]string{fiber.HeaderXRequestID: sent}).Header.Get(fiber.HeaderXRequestID); got != sent {
		t.Fatalf("client UUID not echoed: %q", got)
	}
	for _, bad := range []string{"a\tb", strings.Repeat("x", 300), "{" + sent + "}", "urn:uuid:" + sent} {
		got := get(t, app, "/ok", map[string]string{fiber.HeaderXRequestID: bad}).Header.Get(fiber.HeaderXRequestID)
		if got == bad || len(got) != uuidStringLength {
			t.Fatalf("id %q must be replaced, got %q", bad, got)
		}
	}
}

// S-HRD-27: the query string, where one-time tokens travel, is never logged.
func TestRequestLogger_NeverLogsTheQueryString(t *testing.T) {
	app, logs := newObservedApp()
	get(t, app, "/ok?token=SECRET-TOKEN", nil)

	for _, entry := range logs.All() {
		for _, value := range entry.ContextMap() {
			if s, ok := value.(string); ok && strings.Contains(s, "SECRET-TOKEN") {
				t.Fatalf("token leaked into the log: %v", entry.ContextMap())
			}
		}
	}
	if path := requestLines(logs)[0].ContextMap()["path"]; path != "/ok" {
		t.Fatalf("path = %v", path)
	}
}

// S-HRD-28: successful health probes are not logged; failures would be.
func TestRequestLogger_SkipsSuccessfulQuietPaths(t *testing.T) {
	app, logs := newObservedApp()
	get(t, app, "/health", nil)
	if n := len(requestLines(logs)); n != 0 {
		t.Fatalf("health probe logged %d lines", n)
	}
}

// Levels: security signals warn, a panic's 500 is an error line with the
// request id that Recover's own panic line carries too.
func TestRequestLogger_LevelsAndPanics(t *testing.T) {
	app, logs := newObservedApp()
	get(t, app, "/denied", nil)
	resp := get(t, app, "/panic", nil)
	if resp.StatusCode != http.StatusInternalServerError {
		t.Fatalf("panic status = %d", resp.StatusCode)
	}

	lines := requestLines(logs)
	if len(lines) != 2 || lines[0].Level != zapcore.WarnLevel || lines[1].Level != zapcore.ErrorLevel {
		t.Fatalf("unexpected request lines: %+v", lines)
	}
	panicID := resp.Header.Get(fiber.HeaderXRequestID)
	recovered := logs.FilterMessage("panic recovered in HTTP handler").All()
	if len(recovered) != 1 || recovered[0].ContextMap()["request_id"] != panicID {
		t.Fatalf("panic line must carry the request id %s: %+v", panicID, recovered)
	}
	if denied := logs.FilterMessage("auth rejected").All(); len(denied) != 1 || denied[0].ContextMap()["ip"] == nil {
		t.Fatalf("auth rejected line must carry the client ip: %+v", denied)
	}
}

// S-HRD-20 / S-HRD-23: every response, errors included, carries the headers.
func TestSecurityHeaders_OnEveryResponse(t *testing.T) {
	app, _ := newObservedApp()
	want := map[string]string{
		fiber.HeaderXContentTypeOptions:      common.ContentTypeOptionsValue,
		fiber.HeaderXFrameOptions:            common.FrameOptionsValue,
		fiber.HeaderReferrerPolicy:           common.ReferrerPolicyValue,
		common.HeaderCrossOriginOpenerPolicy: common.CrossOriginOpenerValue,
		fiber.HeaderStrictTransportSecurity:  common.HSTSValue,
		fiber.HeaderPermissionsPolicy:        common.PermissionsPolicyValue,
	}
	for _, path := range []string{"/ok", "/denied", "/panic", "/no-such-route"} {
		resp := get(t, app, path, nil)
		for name, value := range want {
			if got := resp.Header.Get(name); got != value {
				t.Errorf("%s: %s = %q, want %q", path, name, got, value)
			}
		}
	}
}

// S-HRD-19: one shared public-token limiter counts every route together.
func TestPublicTokenRateLimiter_SharedAcrossRoutes(t *testing.T) {
	app := fiber.New()
	shared := PublicTokenRateLimiter(zap.NewNop())
	ok := func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) }
	routes := []string{"/refresh", "/logout", "/activate", "/revoke"}
	for _, r := range routes {
		app.Post(r, shared, ok)
	}
	for i := 0; i < common.PublicTokenRateLimit; i++ {
		if got := post(t, app, routes[i%len(routes)]); got != http.StatusOK {
			t.Fatalf("request %d: got %d", i+1, got)
		}
	}
	for _, r := range routes {
		if got := post(t, app, r); got != http.StatusTooManyRequests {
			t.Errorf("%s past the shared cap: got %d, want 429", r, got)
		}
	}
}
