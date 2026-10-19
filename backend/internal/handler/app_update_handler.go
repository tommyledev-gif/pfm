package handler

import (
	"errors"
	"fmt"
	"regexp"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

// runtimeVersionPattern accepts what app.json's runtimeVersion can produce (a
// fingerprint hash, or a version string) and nothing that could act as a path.
var runtimeVersionPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)

// AppUpdateHandler serves the mobile app's OTA updates (the expo-updates
// protocol, v1) and its newest APK. Unauthenticated on purpose: the app asks
// before anyone signs in, and nothing served is user data. What stops a
// forged update is the signature the app checks against the certificate
// built into it (mobile/certs/certificate.pem), not access control here.
type AppUpdateHandler struct {
	svc    *service.AppUpdateService
	logger *zap.Logger
}

func NewAppUpdateHandler(svc *service.AppUpdateService, logger *zap.Logger) *AppUpdateHandler {
	return &AppUpdateHandler{svc: svc, logger: logger}
}

// Manifest serves GET /api/v1/app-updates/manifest: the live update for the
// caller's platform and runtime version as a signed JSON manifest, or 204
// when there is none (protocol v1 reads an empty 204 as "keep what you have").
func (h *AppUpdateHandler) Manifest(c *fiber.Ctx) error {
	c.Set("expo-protocol-version", "1")
	c.Set("expo-sfv-version", "0")
	c.Set(fiber.HeaderCacheControl, "private, max-age=0")

	platform := c.Get("expo-platform")
	runtimeVersion := c.Get("expo-runtime-version")
	if platform != "android" && platform != "ios" {
		return response.Error(c, h.logger, common.NewInvalidInputError("expo-platform must be android or ios"))
	}
	if !runtimeVersionPattern.MatchString(runtimeVersion) {
		return response.Error(c, h.logger, common.NewInvalidInputError("expo-runtime-version is missing or malformed"))
	}

	update, err := h.svc.Latest(platform, runtimeVersion)
	if errors.Is(err, service.ErrNoAppUpdate) {
		return c.SendStatus(fiber.StatusNoContent)
	}
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	if update.SignatureHeader != "" {
		c.Set("expo-signature", update.SignatureHeader)
	}
	c.Set(fiber.HeaderContentType, "application/json; charset=utf-8")
	return c.Send(update.Manifest)
}

// NativeStatus serves GET /api/v1/app-updates/apk/status?platform=…&runtime_version=…:
// whether this phone's APK is too old for the OTA updates now being published
// and has to be replaced by the newest one (service.NativeUpdate). The app
// asks on every launch and, when told so, blocks until the User installs it.
func (h *AppUpdateHandler) NativeStatus(c *fiber.Ctx) error {
	c.Set(fiber.HeaderCacheControl, "no-store")
	platform := c.Query("platform")
	runtimeVersion := c.Query("runtime_version")
	if platform != "android" && platform != "ios" {
		return response.Error(c, h.logger, common.NewInvalidInputError("platform must be android or ios"))
	}
	if !runtimeVersionPattern.MatchString(runtimeVersion) {
		return response.Error(c, h.logger, common.NewInvalidInputError("runtime_version is missing or malformed"))
	}
	latest, required, err := h.svc.NativeUpdate(platform, runtimeVersion)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "app native status", dto.NewAppNativeStatusResponse(latest, required))
}

// DownloadAPK serves GET /api/v1/app-updates/apk: the newest APK, for a
// phone whose installed app is too old for the live OTA update.
func (h *AppUpdateHandler) DownloadAPK(c *fiber.Ctx) error {
	path, release, err := h.svc.LatestAPK()
	if errors.Is(err, service.ErrNoAppUpdate) {
		return response.Error(c, h.logger, common.ErrNotFound)
	}
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	c.Set(fiber.HeaderCacheControl, "no-store")
	// Stored in R2: send the browser there. The link itself stays the same
	// for every release; only where it points changes.
	if path == "" {
		return c.Redirect(release.URL, fiber.StatusFound)
	}
	c.Attachment(fmt.Sprintf("budgest-%s-%d.apk", release.VersionName, release.VersionCode))
	if err := c.SendFile(path); err != nil {
		return response.Error(c, h.logger, fmt.Errorf("handler.AppUpdate.DownloadAPK: %w", err))
	}
	// Set after SendFile, which guesses the type from the extension.
	c.Set(fiber.HeaderContentType, "application/vnd.android.package-archive")
	return nil
}
