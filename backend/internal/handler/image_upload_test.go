package handler

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/imageupload"
)

// uploadApp exposes readImageUpload on a bare route: it answers 200 with the
// stored content type on success, and the AppError on failure.
func uploadApp() *fiber.App {
	app := fiber.New()
	app.Post("/upload", func(c *fiber.Ctx) error {
		img, err := readImageUpload(c)
		if err != nil {
			appErr := err.(*common.AppError)
			return c.Status(appErr.Status).JSON(fiber.Map{"message": appErr.Message})
		}
		return c.JSON(fiber.Map{"content_type": img.ContentType, "bytes": len(img.Data)})
	})
	return app
}

func multipartRequest(t *testing.T, field, filename, partContentType string, data []byte) *http.Request {
	t.Helper()
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	header := textproto.MIMEHeader{}
	header.Set("Content-Disposition", `form-data; name="`+field+`"; filename="`+filename+`"`)
	header.Set("Content-Type", partContentType)
	part, err := w.CreatePart(header)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(data); err != nil {
		t.Fatal(err)
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/upload", &body)
	req.Header.Set("Content-Type", w.FormDataContentType())
	return req
}

func pngBytes(t *testing.T) []byte {
	t.Helper()
	img := image.NewNRGBA(image.Rect(0, 0, 32, 32))
	for y := 0; y < 32; y++ {
		for x := 0; x < 32; x++ {
			img.SetNRGBA(x, y, color.NRGBA{R: 10, G: 200, B: 90, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func send(t *testing.T, req *http.Request) (int, map[string]any) {
	t.Helper()
	resp, err := uploadApp().Test(req, -1)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close() //nolint:errcheck // test
	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	return resp.StatusCode, body
}

func TestReadImageUploadAcceptsARealPNG(t *testing.T) {
	status, body := send(t, multipartRequest(t, "file", "icon.png", "image/png", pngBytes(t)))
	if status != http.StatusOK || body["content_type"] != imageupload.ContentTypePNG {
		t.Fatalf("status %d body %v, want 200 and image/png", status, body)
	}
}

func TestReadImageUploadIgnoresDeclaredContentTypeAndFilename(t *testing.T) {
	// A real PNG is judged on its bytes even if declared as something odd...
	status, body := send(t, multipartRequest(t, "file", "../../x.svg", "text/plain", pngBytes(t)))
	if status != http.StatusOK || body["content_type"] != imageupload.ContentTypePNG {
		t.Fatalf("status %d body %v, want the PNG accepted", status, body)
	}

	// ...and an SVG with a script is refused however it is labelled.
	svg := []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`)
	for _, declared := range []string{"image/svg+xml", "image/png", "image/jpeg"} {
		status, body := send(t, multipartRequest(t, "file", "icon.png", declared, svg))
		if status != http.StatusBadRequest {
			t.Fatalf("declared %s: status %d body %v, want 400", declared, status, body)
		}
		if msg, _ := body["message"].(string); !strings.Contains(msg, "PNG, JPEG hoặc WebP") {
			t.Fatalf("declared %s: message %q does not name the accepted formats", declared, msg)
		}
	}
}

func TestReadImageUploadRejectsOversizedFile(t *testing.T) {
	big := bytes.Repeat([]byte{0x89}, common.CategoryIconMaxUploadBytes+1)
	status, body := send(t, multipartRequest(t, "file", "icon.png", "image/png", big))
	if status != http.StatusBadRequest {
		t.Fatalf("status %d body %v, want 400", status, body)
	}
	if msg, _ := body["message"].(string); !strings.Contains(msg, "lớn hơn 2 MB") {
		t.Fatalf("message %q does not state the limit", msg)
	}
}

func TestReadImageUploadRequiresTheFileField(t *testing.T) {
	status, body := send(t, multipartRequest(t, "other", "icon.png", "image/png", pngBytes(t)))
	if status != http.StatusBadRequest {
		t.Fatalf("status %d body %v, want 400", status, body)
	}
}
