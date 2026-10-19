package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/response"
)

// PasswordChangeRateLimiter caps FAILED password changes per user
// (PUT /users/me/password): whoever picks up an unlocked phone must not be
// able to guess the current password at full speed. Only failures count, so
// the owner fixing a typo is not what trips it. Keyed by the caller, so it
// must run after JWTAuth.
func PasswordChangeRateLimiter(logger *zap.Logger) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:                    common.PasswordChangeRateLimit,
		Expiration:             common.PasswordChangeRateLimitWindow,
		SkipSuccessfulRequests: true,
		KeyGenerator: func(c *fiber.Ctx) string {
			userID, _ := c.Locals(common.LocalsUserID).(string)
			return "password-change:" + userID
		},
		LimitReached: func(c *fiber.Ctx) error {
			return response.Error(c, logger, common.ErrRateLimited)
		},
	})
}
