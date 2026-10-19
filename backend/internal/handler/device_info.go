package handler

import (
	"net/url"
	"strings"
	"unicode"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// requestDevice reads the device the request says it comes from
// (X-Device-Id / X-Device-Name, mig 033). nil when no usable id was sent —
// the web client, the activation page, an app build from before
// device-bound sessions. A malformed id is treated as absent rather than
// refused: signing in must never fail over a bookkeeping header.
func requestDevice(c *fiber.Ctx) *model.SessionDevice {
	id, err := uuid.Parse(strings.TrimSpace(c.Get(common.HeaderDeviceID)))
	if err != nil || id == uuid.Nil {
		return nil
	}
	return &model.SessionDevice{ID: id, Name: deviceName(c.Get(common.HeaderDeviceName))}
}

// deviceName decodes the URI-encoded name, drops control characters and cuts
// it to common.SessionDeviceNameMaxRunes. Shown back only to the account's
// own user, in their device list.
func deviceName(raw string) string {
	if decoded, err := url.PathUnescape(raw); err == nil {
		raw = decoded
	}
	cleaned := strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, raw)
	runes := []rune(strings.TrimSpace(cleaned))
	if len(runes) > common.SessionDeviceNameMaxRunes {
		runes = runes[:common.SessionDeviceNameMaxRunes]
	}
	return strings.TrimSpace(string(runes))
}
