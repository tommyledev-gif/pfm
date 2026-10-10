package middleware

import (
	"bytes"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
)

// loginApp is POST /login behind LoginAccountRateLimiter, answering `status`
// the way the real handler would for a wrong (401) or a right (200) password.
func loginApp(status int) *fiber.App {
	app := fiber.New()
	app.Post("/login", LoginAccountRateLimiter(zap.NewNop()), func(c *fiber.Ctx) error {
		return c.SendStatus(status)
	})
	return app
}

type loginBody func(t *testing.T, email string) *http.Request

func jsonLogin(t *testing.T, email string) *http.Request {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(fmt.Sprintf(`{"email":%q,"password":"x"}`, email)))
	req.Header.Set("Content-Type", "application/json")
	return req
}

func formLogin(t *testing.T, email string) *http.Request {
	t.Helper()
	form := url.Values{"email": {email}, "password": {"x"}}
	req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	return req
}

func multipartLogin(t *testing.T, email string) *http.Request {
	t.Helper()
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	_ = w.WriteField("email", email)
	_ = w.WriteField("password", "x")
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/login", &body)
	req.Header.Set("Content-Type", w.FormDataContentType())
	return req
}

func statusOf(t *testing.T, app *fiber.App, req *http.Request) int {
	t.Helper()
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatal(err)
	}
	return resp.StatusCode
}

// One account is one budget of failures, whatever shape the body has: a limiter
// that read only JSON let a form-encoded body (which the handler also accepts)
// sail past it.
func TestLoginAccountRateLimiter_CountsJSONFormAndMultipartTogether(t *testing.T) {
	app := loginApp(http.StatusUnauthorized)
	shapes := []loginBody{jsonLogin, formLogin, multipartLogin}

	for i := 0; i < common.LoginAccountRateLimit; i++ {
		// Mixed case and surrounding space must not make a new account either.
		email := []string{"victim@example.com", "Victim@Example.com", "  VICTIM@example.com "}[i%3]
		if got := statusOf(t, app, shapes[i%3](t, email)); got != http.StatusUnauthorized {
			t.Fatalf("attempt %d: got %d, want 401 (still under the limit)", i+1, got)
		}
	}
	for name, shape := range map[string]loginBody{"json": jsonLogin, "form": formLogin, "multipart": multipartLogin} {
		if got := statusOf(t, app, shape(t, "victim@example.com")); got != http.StatusTooManyRequests {
			t.Errorf("%s body after the limit: got %d, want 429", name, got)
		}
	}
}

func TestLoginAccountRateLimiter_OtherAccountsAreUnaffected(t *testing.T) {
	app := loginApp(http.StatusUnauthorized)
	for i := 0; i < common.LoginAccountRateLimit+3; i++ {
		statusOf(t, app, jsonLogin(t, "victim@example.com"))
	}
	if got := statusOf(t, app, jsonLogin(t, "someone-else@example.com")); got != http.StatusUnauthorized {
		t.Fatalf("a different account: got %d, want 401", got)
	}
}

// Only failures count: the owner signing in correctly must never be what
// locks them out.
func TestLoginAccountRateLimiter_SuccessfulLoginsAreNotCounted(t *testing.T) {
	app := loginApp(http.StatusOK)
	for i := 0; i < common.LoginAccountRateLimit*3; i++ {
		if got := statusOf(t, app, jsonLogin(t, "owner@example.com")); got != http.StatusOK {
			t.Fatalf("login %d: got %d, want 200", i+1, got)
		}
	}
}

// The key is a fixed-size hash, so a huge body does not become a huge map key.
func TestLoginAccountRateLimiter_HugeEmailStillWorks(t *testing.T) {
	app := loginApp(http.StatusUnauthorized)
	huge := strings.Repeat("a", 1<<20) + "@example.com"
	if got := statusOf(t, app, jsonLogin(t, huge)); got != http.StatusUnauthorized {
		t.Fatalf("got %d, want 401", got)
	}
}

func TestRateLimitKeyFor(t *testing.T) {
	cases := map[string]string{
		"203.0.113.7":                   "203.0.113.7",
		"2001:db8:1:2:aaaa:bbbb:cccc:1": "2001:db8:1:2::/64",
		"2001:db8:1:2:1111:2222:3333:4": "2001:db8:1:2::/64", // same /64, same key
		"2001:db8:1:3:aaaa:bbbb:cccc:1": "2001:db8:1:3::/64",
		"::ffff:203.0.113.7":            "::ffff:203.0.113.7",
		"not-an-ip":                     "not-an-ip",
	}
	for in, want := range cases {
		if got := rateLimitKeyFor(in); got != want {
			t.Errorf("rateLimitKeyFor(%q) = %q, want %q", in, got, want)
		}
	}
}

// One limiter instance shared by several routes counts them together; one
// instance per route would multiply the cap, which is why routes.go builds a
// single UploadRateLimiter.
func TestUploadRateLimiter_SharedInstanceCountsAcrossRoutes(t *testing.T) {
	app := fiber.New()
	asUser := func(c *fiber.Ctx) error {
		c.Locals(common.LocalsUserID, "user-1")
		return c.Next()
	}
	shared := UploadRateLimiter(zap.NewNop())
	ok := func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) }
	app.Post("/a", asUser, shared, ok)
	app.Post("/b", asUser, shared, ok)

	for i := 0; i < common.UploadRateLimit; i++ {
		path := []string{"/a", "/b"}[i%2]
		if got := post(t, app, path); got != http.StatusOK {
			t.Fatalf("upload %d: got %d", i+1, got)
		}
	}
	for _, path := range []string{"/a", "/b"} {
		if got := post(t, app, path); got != http.StatusTooManyRequests {
			t.Errorf("%s past the shared cap: got %d, want 429", path, got)
		}
	}
}
