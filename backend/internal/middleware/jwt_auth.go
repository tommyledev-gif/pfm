package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

// JWTAuth validates the access token's signature and expiry and injects the
// caller's identity into Fiber locals (common.LocalsUserID / LocalsRole) for
// downstream handlers/RequireRole to read. Every failure mode — missing
// header, expired token, or a tampered/invalid signature — maps to the same
// 401 without distinguishing the reason to the client (test_cases.md
// TC-USR-07/08/47/48 all expect a bare 401).
func JWTAuth(tokens *service.TokenService, logger *zap.Logger) fiber.Handler {
	return func(c *fiber.Ctx) error {
		header := c.Get(fiber.HeaderAuthorization)
		const prefix = "Bearer "
		if !strings.HasPrefix(header, prefix) {
			return response.Error(c, logger, common.ErrUnauthenticated)
		}
		tokenString := strings.TrimPrefix(header, prefix)

		claims, err := tokens.ParseAccessToken(tokenString)
		if err != nil {
			return response.Error(c, logger, common.ErrUnauthenticated)
		}
		// Defense in depth for the import_token added by
		// specs/transaction-export-import (plan.md Finding #5): that token is
		// signed with this same key, so ParseAccessToken would happily verify
		// its signature and decode it into a zero-valued AccessClaims — an
		// empty Role, which RequireRole would then reject, but which would
		// have reached every non-role-gated handler as an authenticated
		// caller. Every real access token has carried a non-empty role since
		// F-02, so rejecting an empty one changes nothing for any valid
		// credential; it only closes this shape off explicitly.
		if claims.Role == "" || claims.UserID == "" {
			return response.Error(c, logger, common.ErrUnauthenticated)
		}

		c.Locals(common.LocalsUserID, claims.UserID)
		c.Locals(common.LocalsRole, claims.Role)
		return c.Next()
	}
}
