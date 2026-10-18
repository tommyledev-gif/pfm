package handler

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/middleware"
)

// imageApp mounts the image route the way routes.go does (switch → limiter →
// handler). Every case here is rejected before the service, so it is nil.
func imageApp(enabled bool) *fiber.App {
	h := NewChatImageHandler(nil, enabled, zap.NewNop())
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals(common.LocalsUserID, "11111111-1111-4111-8111-111111111111")
		return c.Next()
	})
	app.Post("/upload", h.Switch, middleware.AIImageRateLimiter(zap.NewNop()), h.ProposeFromImage)
	return app
}

func errorCode(t *testing.T, resp *http.Response) string {
	t.Helper()
	var body struct {
		ErrorCode string `json:"error_code"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	return body.ErrorCode
}

func captionOnlyRequest(t *testing.T, caption string) *http.Request {
	t.Helper()
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	if err := w.WriteField(common.AIImageFormFieldCaption, caption); err != nil {
		t.Fatal(err)
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/upload", &body)
	req.Header.Set("Content-Type", w.FormDataContentType())
	return req
}

func TestImageProposals_SwitchOffRefusesBeforeReading(t *testing.T) { // S-AIIMG-56
	resp, err := imageApp(false).Test(multipartRequest(t, common.AIImageFormFieldImage, "a.png", "image/png", pngBytes(t)))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusServiceUnavailable || errorCode(t, resp) != common.ErrCodeAIImageDisabled {
		t.Fatalf("status %d", resp.StatusCode)
	}
}

func TestImageProposals_SwitchOffNeverSpendsTheLimit(t *testing.T) { // BR-18, S-AIIMG-60
	app := imageApp(false)
	for i := 0; i <= common.AIImageRateLimit; i++ {
		resp, _ := app.Test(multipartRequest(t, common.AIImageFormFieldImage, "a.png", "image/png", pngBytes(t)))
		if resp.StatusCode == http.StatusTooManyRequests {
			t.Fatalf("request %d was rate limited while the switch is off", i+1)
		}
	}
}

func TestImageProposals_MissingImageAndLongCaptionReportedTogether(t *testing.T) { // S-AIIMG-18
	resp, err := imageApp(true).Test(captionOnlyRequest(t, strings.Repeat("a", common.AIImageCaptionMaxLength+1)))
	if err != nil {
		t.Fatal(err)
	}
	var body struct {
		ErrorCode string       `json:"error_code"`
		Details   []fieldError `json:"details"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest || body.ErrorCode != common.ErrCodeInvalidInput || len(body.Details) != 2 {
		t.Fatalf("status %d, %+v", resp.StatusCode, body)
	}
}

func TestImageProposals_TooLarge(t *testing.T) { // S-AIIMG-16
	big := append(pngBytes(t), make([]byte, common.AIImageMaxUploadBytes)...)
	resp, err := imageApp(true).Test(multipartRequest(t, common.AIImageFormFieldImage, "a.png", "image/png", big), -1)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusRequestEntityTooLarge || errorCode(t, resp) != common.ErrCodeImageTooLarge {
		t.Fatalf("status %d", resp.StatusCode)
	}
}

func TestImageProposals_TypeComesFromTheBytes(t *testing.T) { // S-AIIMG-17
	pdf := []byte("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n")
	resp, err := imageApp(true).Test(multipartRequest(t, common.AIImageFormFieldImage, "receipt.jpg", "image/jpeg", pdf))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusUnsupportedMediaType || errorCode(t, resp) != common.ErrCodeUnsupportedImageType {
		t.Fatalf("status %d", resp.StatusCode)
	}
}
