package middleware

import (
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
)

// PasswordChangeRateLimiter caps FAILED password changes per user
// (PUT /users/me/password): whoever picks up an unlocked phone must not be
// able to guess the current password at full speed. Only failures count, so
// the owner fixing a typo is not what trips it.
func PasswordChangeRateLimiter(logger *zap.Logger) fiber.Handler {
	return newLimiter(limit{
		name: "password-change", keyBy: byUser, counts: countFailuresOnly,
		max: common.PasswordChangeRateLimit, window: common.PasswordChangeRateLimitWindow,
	}, logger)
}
