package middleware

import (
	"github.com/gofiber/fiber/v2"

	"github.com/example/pfm/backend/internal/common"
)

// SecurityHeaders sets the browser-facing safety headers on every response
// (specs/security-hardening-2026-10 US-05): no MIME sniffing, no framing (the
// admin's approve button on /approve-access must not be clickjackable), no
// Referer (two pages carry a one-time token in their URL), HTTPS pinned, and
// no powerful browser features.
//
// Set before the handler runs, so error responses (404, 429, 500) carry them
// too. Headers only, nothing about caching: the OTA and APK routes keep their
// own Cache-Control. The two HTML pages add their CSP themselves (handler
// htmlPage), since only they need one.
func SecurityHeaders() fiber.Handler {
	return func(c *fiber.Ctx) error {
		c.Set(fiber.HeaderXContentTypeOptions, common.ContentTypeOptionsValue)
		c.Set(fiber.HeaderXFrameOptions, common.FrameOptionsValue)
		c.Set(fiber.HeaderReferrerPolicy, common.ReferrerPolicyValue)
		c.Set(common.HeaderCrossOriginOpenerPolicy, common.CrossOriginOpenerValue)
		c.Set(fiber.HeaderStrictTransportSecurity, common.HSTSValue)
		c.Set(fiber.HeaderPermissionsPolicy, common.PermissionsPolicyValue)
		return c.Next()
	}
}
