package handler

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

func TestDeviceName(t *testing.T) {
	cases := map[string]string{
		"Pixel%208":                         "Pixel 8",
		"%C4%90i%E1%BB%87n%20tho%E1%BA%A1i": "Điện thoại",
		"  Galaxy\tS24\n ":                  "GalaxyS24",
		"100%":                              "100%", // not valid escaping: kept as sent
		"":                                  "",
	}
	for raw, want := range cases {
		if got := deviceName(raw); got != want {
			t.Errorf("deviceName(%q) = %q, want %q", raw, got, want)
		}
	}
	long := deviceName(strings.Repeat("ạ", 100))
	if n := len([]rune(long)); n != common.SessionDeviceNameMaxRunes {
		t.Errorf("long name has %d runes, want %d", n, common.SessionDeviceNameMaxRunes)
	}
}

func TestRequestDevice(t *testing.T) {
	var got *model.SessionDevice
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error {
		got = requestDevice(c)
		return nil
	})
	call := func(id, name string) *model.SessionDevice {
		req := httptest.NewRequest("GET", "/", nil)
		if id != "" {
			req.Header.Set(common.HeaderDeviceID, id)
		}
		if name != "" {
			req.Header.Set(common.HeaderDeviceName, name)
		}
		if _, err := app.Test(req); err != nil {
			t.Fatalf("app.Test: %v", err)
		}
		return got
	}

	id := uuid.New()
	if d := call(id.String(), "Pixel%208"); d == nil || d.ID != id || d.Name != "Pixel 8" {
		t.Fatalf("valid headers: %+v", d)
	}
	for _, bad := range []string{"", "not-a-uuid", uuid.Nil.String()} {
		if d := call(bad, "Pixel"); d != nil {
			t.Fatalf("id %q: got %+v, want nil", bad, d)
		}
	}
}
