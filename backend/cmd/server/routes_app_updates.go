package main

import (
	"github.com/gofiber/fiber/v2"

	"github.com/example/pfm/backend/internal/handler"
)

// appUpdateFileMaxAge is how long a bundle or asset may be cached: every
// publish gets its own directory, so the file at a given URL never changes.
const appUpdateFileMaxAge = 365 * 24 * 60 * 60

// registerAppUpdateRoutes mounts the mobile app's OTA update endpoints
// (handler.AppUpdateHandler, docs/ops-runbook.md §8). They sit under /api/v1
// like every other route so the Cloudflare path rule (runbook §4) lets them
// through, and they take no token: the app checks for updates before anyone
// signs in.
func registerAppUpdateRoutes(app *fiber.App, h *handler.AppUpdateHandler, filesDir string) {
	updates := app.Group("/api/v1/app-updates")
	updates.Get("/manifest", h.Manifest)
	updates.Get("/apk", h.DownloadAPK)
	updates.Get("/apk/status", h.NativeStatus)
	updates.Static("/files", filesDir, fiber.Static{ByteRange: true, MaxAge: appUpdateFileMaxAge})
}
