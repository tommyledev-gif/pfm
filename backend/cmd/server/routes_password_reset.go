package main

import (
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/handler"
	"github.com/example/pfm/backend/internal/middleware"
)

// registerPasswordResetRoutes mounts forgot password (specs/forgot-password).
// Both routes are public; each has its own per-IP limiter (BR-05).
func registerPasswordResetRoutes(app *fiber.App, h *handler.PasswordResetHandler, logger *zap.Logger) {
	reset := app.Group("/api/v1/auth/password-reset")
	reset.Post("/request", middleware.PasswordResetRequestRateLimiter(logger), h.Request)
	reset.Post("/confirm", middleware.PasswordResetConfirmRateLimiter(logger), h.Confirm)
}
