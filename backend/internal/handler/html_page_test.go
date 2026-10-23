package handler

import (
	"crypto/sha256"
	"encoding/base64"
	"io"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"

	"github.com/example/pfm/backend/internal/common"
)

var inlineBlockPattern = regexp.MustCompile(`(?s)<(script|style)>(.*?)</(?:script|style)>`)

// S-HRD-21 / S-HRD-22: each page's CSP lists the hash of exactly the inline
// script and style the response body carries, and nothing looser.
func TestHTMLPages_CSPMatchesTheServedInlineCode(t *testing.T) {
	app := fiber.New()
	app.Get("/activate", ActivatePageHandler)
	app.Get("/approve-access", ApproveAccessPageHandler)

	for _, path := range []string{"/activate?token=abc", "/approve-access?token=abc"} {
		resp, err := app.Test(httptest.NewRequest(http.MethodGet, path, nil))
		if err != nil {
			t.Fatalf("%s: %v", path, err)
		}
		body, _ := io.ReadAll(resp.Body)
		csp := resp.Header.Get(fiber.HeaderContentSecurityPolicy)

		blocks := inlineBlockPattern.FindAllStringSubmatch(string(body), -1)
		if len(blocks) != 2 {
			t.Fatalf("%s: want one script and one style block, got %d", path, len(blocks))
		}
		for _, block := range blocks {
			sum := sha256.Sum256([]byte(block[2]))
			want := block[1] + "-src 'sha256-" + base64.StdEncoding.EncodeToString(sum[:]) + "'"
			if !strings.Contains(csp, want) {
				t.Errorf("%s: CSP %q lacks %q", path, csp, want)
			}
		}
		for _, directive := range []string{"default-src 'none'", "frame-ancestors 'none'", "form-action 'none'", "base-uri 'none'", "connect-src 'self'"} {
			if !strings.Contains(csp, directive) {
				t.Errorf("%s: CSP lacks %q", path, directive)
			}
		}
		if strings.Contains(csp, "unsafe-inline") || strings.Contains(csp, "unsafe-eval") {
			t.Errorf("%s: CSP must not allow unsafe sources: %q", path, csp)
		}
		if got := resp.Header.Get(fiber.HeaderCacheControl); got != common.HTMLPageCacheControl {
			t.Errorf("%s: Cache-Control = %q", path, got)
		}
		if got := resp.Header.Get(fiber.HeaderContentType); !strings.HasPrefix(got, "text/html") {
			t.Errorf("%s: Content-Type = %q", path, got)
		}
	}
}

func TestNewHTMLPage_RefusesAPageItCannotHash(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatal("a page with two scripts must panic at startup")
		}
	}()
	newHTMLPage("<style>a{}</style><script>1</script><script>2</script>")
}
