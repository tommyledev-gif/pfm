package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
)

// uuidStringLength is the canonical 8-4-4-4-12 form, the only shape of a
// client-sent request id this server echoes.
const uuidStringLength = 36

// RequestLogger writes one structured line per request and gives every
// request an id (specs/security-hardening-2026-10 US-06), so an incident can be
// reconstructed and a user's report matched to server logs.
//
// Must be the FIRST app.Use, before Recover: a panic below is turned into an
// error by Recover and answered here, so its 500 is logged like any other.
// When the chain returns an error instead of writing a response, the app's
// ErrorHandler answers it here (as Fiber's own logger middleware does), which
// makes the logged status the status actually sent.
//
// Logged: request id, method, path, status, latency, client IP, response
// size, and the user id once JWTAuth has set it. Never logged: the query
// string (/activate and /approve-access carry a one-time token there),
// headers, or any body. Successful requests to quietPaths (the health probes,
// hit every few seconds by Docker) are not logged.
//
// The request id and client IP are also stored in locals, so response.Error
// and Recover can put them on their own lines.
func RequestLogger(logger *zap.Logger, quietPaths ...string) fiber.Handler {
	quiet := make(map[string]bool, len(quietPaths))
	for _, p := range quietPaths {
		quiet[p] = true
	}
	return func(c *fiber.Ctx) error {
		start := time.Now()
		requestID := requestIDFrom(c.Get(fiber.HeaderXRequestID))
		ip := ClientIP(c)
		c.Locals(common.LocalsRequestID, requestID)
		c.Locals(common.LocalsClientIP, ip)
		c.Set(fiber.HeaderXRequestID, requestID)

		if err := c.Next(); err != nil {
			if handlerErr := c.App().ErrorHandler(c, err); handlerErr != nil {
				// Last resort when even the error answer failed; nothing left to report to.
				_ = c.SendStatus(fiber.StatusInternalServerError)
			}
		}

		status := c.Response().StatusCode()
		path := c.Path()
		if quiet[path] && status < fiber.StatusBadRequest {
			return nil
		}
		fields := []zap.Field{
			zap.String("request_id", requestID),
			zap.String("method", c.Method()),
			zap.String("path", path),
			zap.Int("status", status),
			zap.Int64("latency_ms", time.Since(start).Milliseconds()),
			zap.String("ip", ip),
			zap.Int("bytes", responseSize(c)),
		}
		if userID, ok := c.Locals(common.LocalsUserID).(string); ok && userID != "" {
			fields = append(fields, zap.String("user_id", userID))
		}
		switch {
		case status >= fiber.StatusInternalServerError:
			logger.Error("request", fields...)
		case status == fiber.StatusUnauthorized, status == fiber.StatusForbidden, status == fiber.StatusTooManyRequests:
			logger.Warn("request", fields...)
		default:
			logger.Info("request", fields...)
		}
		return nil
	}
}

// requestIDFrom keeps a client's id only when it is a canonical UUID, so
// nothing a client sends can inject text into the logs.
func requestIDFrom(raw string) string {
	if len(raw) == uuidStringLength {
		if _, err := uuid.Parse(raw); err == nil {
			return raw
		}
	}
	return uuid.NewString()
}

// responseSize never touches a streamed body (the APK download): reading
// Body() on a stream would buffer the whole file and consume it.
func responseSize(c *fiber.Ctx) int {
	if c.Response().IsBodyStream() {
		return c.Response().Header.ContentLength()
	}
	return len(c.Response().Body())
}
