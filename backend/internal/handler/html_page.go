package handler

import (
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/example/pfm/backend/internal/common"
)

// htmlPage is one of the self-contained pages the backend serves itself
// (/activate, /approve-access), sent with a Content-Security-Policy that
// allows nothing but the page's own inline <script> and <style>, by SHA-256
// hash (specs/security-hardening-2026-10 US-05). An injected script, a framed
// copy of the page, or a stray form post anywhere all fail.
//
// The hashes are computed from the page text at startup, so editing a page can
// never leave a stale hash behind. A page that does not have exactly one
// <script> and one <style> panics at startup (package init), and the handler
// tests catch it first.
type htmlPage struct {
	html string
	csp  string
}

// htmlPageCSPDirectives are the fixed parts of every page's policy: fetches
// only to this origin (the page POSTs to /api/v1/...), no plugins, forms,
// <base> or framing.
var htmlPageCSPDirectives = []string{
	"default-src 'none'",
	"connect-src 'self'",
	"form-action 'none'",
	"frame-ancestors 'none'",
	"base-uri 'none'",
}

func newHTMLPage(html string) htmlPage {
	directives := append([]string{
		"script-src " + cspHashSource(inlineBlock(html, "script")),
		"style-src " + cspHashSource(inlineBlock(html, "style")),
	}, htmlPageCSPDirectives...)
	return htmlPage{html: html, csp: strings.Join(directives, "; ")}
}

// send writes the page uncached: its URL carries a one-time token.
func (p htmlPage) send(c *fiber.Ctx) error {
	c.Set(fiber.HeaderContentType, fiber.MIMETextHTMLCharsetUTF8)
	c.Set(fiber.HeaderContentSecurityPolicy, p.csp)
	c.Set(fiber.HeaderCacheControl, common.HTMLPageCacheControl)
	return c.SendString(p.html)
}

// inlineBlock returns the text between the page's only <tag> and </tag>,
// exactly as the browser hashes it.
func inlineBlock(html, tag string) string {
	open, closing := "<"+tag+">", "</"+tag+">"
	if strings.Count(html, open) != 1 || strings.Count(html, closing) != 1 {
		panic(fmt.Sprintf("handler: an HTML page needs exactly one %s ... %s block for its CSP", open, closing))
	}
	start := strings.Index(html, open) + len(open)
	end := strings.Index(html, closing)
	if end < start {
		panic(fmt.Sprintf("handler: %s closes before it opens", open))
	}
	return html[start:end]
}

func cspHashSource(content string) string {
	sum := sha256.Sum256([]byte(content))
	return "'sha256-" + base64.StdEncoding.EncodeToString(sum[:]) + "'"
}
