package middleware

import (
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/response"
)

// RequireRole gates a route to a single role. Must be registered after
// JWTAuth in the chain — it reads the role JWTAuth already resolved from the
// token, it does not parse the request itself (auth/identity is resolved
// once in middleware, never re-derived downstream).
func RequireRole(role string, logger *zap.Logger) fiber.Handler {
	return func(c *fiber.Ctx) error {
		callerRole, _ := c.Locals(common.LocalsRole).(string)
		if callerRole != role {
			return response.Error(c, logger, common.ErrForbidden)
		}
		return c.Next()
	}
}
