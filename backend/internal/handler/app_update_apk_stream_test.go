package handler

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/service"
)

var storedAPKBytes = []byte("PK\x03\x04 a stand-in for an APK, long enough to cut a range from")

// fakeR2Host is the bucket's address in these tests. It must never show up in
// anything the client receives.
const fakeR2Host = "pub-test.r2.dev"

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

// fakeR2 stands in for the public bucket: it serves storedAPKBytes at the
// APK's key, honouring Range the way R2 does, and 404 for anything else.
// In-process rather than an httptest TLS server, so no network sits in
// between (a local antivirus that intercepts loopback TLS broke that).
func fakeR2() *http.Client {
	return &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		rec := httptest.NewRecorder()
		if r.URL.Host != fakeR2Host || r.URL.Path != "/app-updates/apk/budgest-6.apk" {
			http.NotFound(rec, r)
		} else {
			http.ServeContent(rec, r, "budgest-6.apk", time.Unix(0, 0), bytes.NewReader(storedAPKBytes))
		}
		return rec.Result(), nil
	})}
}

func storedAPKApp(t *testing.T, key string) *fiber.App {
	t.Helper()
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "apk", "latest.json"),
		`{"file":"budgest-6.apk","url":"https://`+fakeR2Host+key+`","versionCode":6,"versionName":"1.0.0"}`)
	h := NewAppUpdateHandler(service.NewAppUpdateServiceWithClient(dir, fakeR2()), zap.NewNop())
	app := fiber.New()
	app.Get("/apk", h.DownloadAPK)
	return app
}

func TestAppUpdateAPK_InR2IsStreamedNotRedirected(t *testing.T) {
	resp, err := storedAPKApp(t, "/app-updates/apk/budgest-6.apk").Test(httptest.NewRequest(http.MethodGet, "/apk", nil))
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != fiber.StatusOK || !bytes.Equal(body, storedAPKBytes) {
		t.Fatalf("status %d, body %q; want 200 with the stored APK", resp.StatusCode, body)
	}
	// The whole point: nothing in the response names the bucket.
	if loc := resp.Header.Get("Location"); loc != "" {
		t.Fatalf("Location = %q, want none", loc)
	}
	for name, values := range resp.Header {
		if strings.Contains(strings.Join(values, " "), fakeR2Host) {
			t.Fatalf("header %s carries the store's address: %v", name, values)
		}
	}
	if got := resp.Header.Get(fiber.HeaderContentType); got != apkContentType {
		t.Fatalf("Content-Type = %q, want %q", got, apkContentType)
	}
	if got := resp.Header.Get(fiber.HeaderContentDisposition); !strings.Contains(got, "budgest-1.0.0-6.apk") {
		t.Fatalf("Content-Disposition = %q, want the release's file name", got)
	}
	if resp.ContentLength != int64(len(storedAPKBytes)) {
		t.Fatalf("Content-Length = %d, want %d (the app's progress bar reads it)", resp.ContentLength, len(storedAPKBytes))
	}
}

func TestAppUpdateAPK_InR2PassesOnASingleRange(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/apk", nil)
	req.Header.Set("Range", "bytes=10-")
	resp, err := storedAPKApp(t, "/app-updates/apk/budgest-6.apk").Test(req)
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != fiber.StatusPartialContent || !bytes.Equal(body, storedAPKBytes[10:]) {
		t.Fatalf("status %d, body %q; want 206 with the tail from byte 10", resp.StatusCode, body)
	}
	if got := resp.Header.Get(fiber.HeaderContentRange); !strings.HasPrefix(got, "bytes 10-") {
		t.Fatalf("Content-Range = %q, want bytes 10-…", got)
	}
}

func TestAppUpdateAPK_InR2MissingObjectIs500WithoutTheAddress(t *testing.T) {
	resp, err := storedAPKApp(t, "/app-updates/apk/gone.apk").Test(httptest.NewRequest(http.MethodGet, "/apk", nil))
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != fiber.StatusInternalServerError {
		t.Fatalf("status %d, want 500", resp.StatusCode)
	}
	if strings.Contains(string(body), fakeR2Host) {
		t.Fatalf("error body names the store: %s", body)
	}
}
