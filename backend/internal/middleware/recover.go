package middleware

import (
	"runtime/debug"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"go.uber.org/zap"
)

// Recover turns a panic in any handler into an ordinary error, which the
// app's ErrorHandler (response.Error) answers with the generic 500 body —
// instead of fasthttp dropping the connection and the client seeing a network
// failure. Must be the first app.Use so it wraps every other middleware too.
//
// Only the panic value, route and stack are logged — never the request body
// or headers, which can carry passwords and tokens.
func Recover(logger *zap.Logger) fiber.Handler {
	return recover.New(recover.Config{
		EnableStackTrace: true,
		StackTraceHandler: func(c *fiber.Ctx, e interface{}) {
			logger.Error("panic recovered in HTTP handler",
				zap.Any("panic", e),
				zap.String("method", c.Method()),
				zap.String("path", c.Path()),
				zap.ByteString("stack", debug.Stack()),
			)
		},
	})
}
