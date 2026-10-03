package middleware

import (
	"net"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// clientIPHeader is set by Cloudflare's edge on every proxied request and
// overwritten (never appended to) if the client sent its own, so unlike
// X-Forwarded-For it holds exactly one address and its first value cannot be
// forged by the client — provided the request really came through Cloudflare.
const clientIPHeader = "CF-Connecting-IP"

// trustedProxyCIDRs are the peers allowed to tell us who the client is.
//
//   - Loopback and private ranges: in production every request arrives via
//     cloudflared (Cloudflare Tunnel) or the web BFF, both containers on the
//     same Docker network — so c.IP() is the same container address for every
//     user, and the login limiter keyed on it put all of them in one bucket.
//   - Cloudflare's published edge ranges (https://www.cloudflare.com/ips/):
//     only relevant while the origin port is still public, before the tunnel
//     cut-over in docs/ops-runbook.md §3.
//
// Any other peer is talking to the origin directly, so its header is ignored
// and its own address is used — otherwise anyone could pick their own bucket.
var trustedProxyCIDRs = mustParseCIDRs(
	"127.0.0.0/8", "::1/128",
	"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "fc00::/7",
	"173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
	"141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
	"197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
	"104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
	"2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32",
	"2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
)

// ClientIP is the address IP-keyed rate limits must use instead of c.IP().
func ClientIP(c *fiber.Ctx) string {
	peer := c.Context().RemoteIP()
	if isTrustedProxy(peer) {
		if forwarded := net.ParseIP(strings.TrimSpace(c.Get(clientIPHeader))); forwarded != nil {
			return forwarded.String()
		}
	}
	return peer.String()
}

func isTrustedProxy(ip net.IP) bool {
	for _, n := range trustedProxyCIDRs {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

func mustParseCIDRs(cidrs ...string) []*net.IPNet {
	nets := make([]*net.IPNet, 0, len(cidrs))
	for _, cidr := range cidrs {
		_, n, err := net.ParseCIDR(cidr)
		if err != nil {
			panic("middleware: invalid trusted proxy CIDR " + cidr)
		}
		nets = append(nets, n)
	}
	return nets
}
