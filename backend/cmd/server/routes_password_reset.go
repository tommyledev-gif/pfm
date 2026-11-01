package main

import (
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/handler"
	"github.com/example/pfm/backend/internal/middleware"
)

// registerPasswordResetRoutes mounts forgot password (specs/forgot-password).
// Every route is public, with a per-IP limiter (BR-05). Verify and confirm
// share one: both take a code guess, so the code step adds no guesses per IP.
func registerPasswordResetRoutes(app *fiber.App, h *handler.PasswordResetHandler, logger *zap.Logger) {
	reset := app.Group("/api/v1/auth/password-reset")
	codeLimiter := middleware.PasswordResetConfirmRateLimiter(logger)
	reset.Post("/request", middleware.PasswordResetRequestRateLimiter(logger), h.Request)
	reset.Post("/verify", codeLimiter, h.Verify)
	reset.Post("/confirm", codeLimiter, h.Confirm)
}
