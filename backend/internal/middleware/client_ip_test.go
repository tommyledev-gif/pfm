package middleware

import (
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestIsTrustedProxy(t *testing.T) {
	cases := map[string]bool{
		"172.18.0.5":     true,  // cloudflared / web BFF on the Docker network
		"127.0.0.1":      true,  // loopback
		"162.158.12.34":  true,  // Cloudflare edge
		"2606:4700::1":   true,  // Cloudflare edge, IPv6
		"203.0.113.9":    false, // arbitrary internet client hitting the origin
		"8.8.8.8":        false,
		"2001:db8::1234": false,
	}
	for ip, want := range cases {
		if got := isTrustedProxy(net.ParseIP(ip)); got != want {
			t.Errorf("isTrustedProxy(%s) = %v, want %v", ip, got, want)
		}
	}
}

// app.Test connects from 0.0.0.0 — not a trusted proxy — so a client-supplied
// CF-Connecting-IP must be ignored rather than letting it choose its bucket.
func TestClientIP_IgnoresHeaderFromUntrustedPeer(t *testing.T) {
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error { return c.SendString(ClientIP(c)) })

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(clientIPHeader, "198.51.100.7")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	buf := make([]byte, 64)
	n, _ := resp.Body.Read(buf)
	if got := string(buf[:n]); got == "198.51.100.7" {
		t.Fatalf("spoofed header from an untrusted peer was honoured")
	}
}
