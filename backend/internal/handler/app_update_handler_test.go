package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/service"
)

const testRuntime = "650ee71704544584fe19689fc462f9f1ed7dcd4f"

func appUpdateApp(dir string) *fiber.App {
	h := NewAppUpdateHandler(service.NewAppUpdateService(dir), zap.NewNop())
	app := fiber.New()
	app.Get("/manifest", h.Manifest)
	app.Get("/apk", h.DownloadAPK)
	return app
}

func manifestRequest(platform, runtimeVersion string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/manifest", nil)
	req.Header.Set("expo-platform", platform)
	req.Header.Set("expo-runtime-version", runtimeVersion)
	req.Header.Set("expo-protocol-version", "1")
	return req
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestAppUpdateManifest_NothingPublishedIs204(t *testing.T) {
	resp, err := appUpdateApp(t.TempDir()).Test(manifestRequest("android", testRuntime))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("status = %d, want 204", resp.StatusCode)
	}
	// Without protocol version 1 the client treats an empty body as an error.
	if got := resp.Header.Get("expo-protocol-version"); got != "1" {
		t.Fatalf("expo-protocol-version = %q, want 1", got)
	}
}

func TestAppUpdateManifest_ServesSignedManifestUntouched(t *testing.T) {
	dir := t.TempDir()
	runtimeDir := filepath.Join(dir, "android", testRuntime)
	manifest := `{"id":"5b2c6e1a-0000-4000-8000-000000000001","runtimeVersion":"` + testRuntime + `"}`
	signature := `sig="c2lnbmF0dXJl", keyid="main", alg="rsa-v1_5-sha256"`
	writeFile(t, filepath.Join(runtimeDir, "current"), "5b2c6e1a-0000-4000-8000-000000000001\n")
	writeFile(t, filepath.Join(runtimeDir, "5b2c6e1a-0000-4000-8000-000000000001", "manifest.json"), manifest)
	writeFile(t, filepath.Join(runtimeDir, "5b2c6e1a-0000-4000-8000-000000000001", "manifest.sig"), signature+"\n")

	resp, err := appUpdateApp(dir).Test(manifestRequest("android", testRuntime))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	// The signature covers these exact bytes.
	if string(body) != manifest {
		t.Fatalf("body = %s, want the stored manifest byte for byte", body)
	}
	if got := resp.Header.Get("expo-signature"); got != signature {
		t.Fatalf("expo-signature = %q, want %q", got, signature)
	}
}

func TestAppUpdateManifest_OtherRuntimeGetsNothing(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "android", testRuntime, "current"), "abc")
	resp, err := appUpdateApp(dir).Test(manifestRequest("android", "0000000000000000000000000000000000000000"))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("status = %d, want 204: an APK built from other native code must not get this bundle", resp.StatusCode)
	}
}

func TestAppUpdateManifest_RejectsPathLikeInput(t *testing.T) {
	for _, tc := range []struct{ platform, runtime string }{
		{"android", "../../apk"},
		{"android", ".."},
		{"android", ""},
		{"web", testRuntime},
		{"../android", testRuntime},
	} {
		resp, err := appUpdateApp(t.TempDir()).Test(manifestRequest(tc.platform, tc.runtime))
		if err != nil {
			t.Fatal(err)
		}
		if resp.StatusCode != fiber.StatusBadRequest || errorCode(t, resp) != common.ErrCodeInvalidInput {
			t.Fatalf("%q/%q: status = %d, want 400 INVALID_INPUT", tc.platform, tc.runtime, resp.StatusCode)
		}
	}
}

func TestAppUpdateManifest_PointerOutsideRuntimeIsAnError(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "android", testRuntime, "current"), "../../apk")
	resp, err := appUpdateApp(dir).Test(manifestRequest("android", testRuntime))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusInternalServerError {
		t.Fatalf("status = %d, want 500 for a pointer that leaves its directory", resp.StatusCode)
	}
}

func TestAppUpdateAPK_NoneYetIs404(t *testing.T) {
	resp, err := appUpdateApp(t.TempDir()).Test(httptest.NewRequest(http.MethodGet, "/apk", nil))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("status = %d, want 404", resp.StatusCode)
	}
}

func TestAppUpdateAPK_ServesLatest(t *testing.T) {
	// Not t.TempDir: SendFile keeps the file open for a few seconds (fasthttp's
	// file cache), and Windows cannot delete an open file, which t.TempDir
	// reports as a failure.
	dir, err := os.MkdirTemp("", "app-update-apk")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(dir) })
	writeFile(t, filepath.Join(dir, "apk", "budgest-3.apk"), "apk-bytes")
	writeFile(t, filepath.Join(dir, "apk", "latest.json"), `{"file":"budgest-3.apk","versionCode":3,"versionName":"1.0.0"}`)

	resp, err := appUpdateApp(dir).Test(httptest.NewRequest(http.MethodGet, "/apk", nil))
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != fiber.StatusOK || string(body) != "apk-bytes" {
		t.Fatalf("status = %d body = %q, want 200 with the APK", resp.StatusCode, body)
	}
	if got := resp.Header.Get(fiber.HeaderContentType); got != "application/vnd.android.package-archive" {
		t.Fatalf("content-type = %q", got)
	}
}

func TestAppUpdateAPK_LatestNamingAnotherPathIsRefused(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "secret.apk"), "nope")
	writeFile(t, filepath.Join(dir, "apk", "latest.json"), `{"file":"../secret.apk","versionCode":3}`)

	resp, err := appUpdateApp(dir).Test(httptest.NewRequest(http.MethodGet, "/apk", nil))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", resp.StatusCode)
	}
}

func nativeStatus(t *testing.T, dir, query string) (int, map[string]any) {
	t.Helper()
	app := fiber.New()
	app.Get("/status", NewAppUpdateHandler(service.NewAppUpdateService(dir), zap.NewNop()).NativeStatus)
	resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/status?"+query, nil))
	if err != nil {
		t.Fatal(err)
	}
	var body struct {
		Data map[string]any `json:"data"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&body)
	return resp.StatusCode, body.Data
}

// Five published APKs: latest is 5 on runtime "new"; 4 was on runtime "old".
func publishedAPKs(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "apk", "latest.json"), `{"file":"budgest-5.apk","versionCode":5,"versionName":"1.0.0","runtimeVersion":"new"}`)
	writeFile(t, filepath.Join(dir, "android", "new", "apk.json"), `{"versionCode":5,"runtimeVersion":"new"}`)
	writeFile(t, filepath.Join(dir, "android", "old", "apk.json"), `{"versionCode":4,"runtimeVersion":"old"}`)
	writeFile(t, filepath.Join(dir, "android", "ahead", "apk.json"), `{"versionCode":6,"runtimeVersion":"ahead"}`)
	return dir
}

func TestAppNativeStatus(t *testing.T) {
	dir := publishedAPKs(t)
	for _, tc := range []struct {
		name, query string
		required    bool
	}{
		{"older APK must update", "platform=android&runtime_version=old", true},
		{"newest APK is fine", "platform=android&runtime_version=new", false},
		// A build never uploaded (a dev machine's) is not sent to an older APK.
		{"unknown runtime is left alone", "platform=android&runtime_version=devbuild", false},
		// latest.json rolled back by hand: the newer phone cannot install it.
		{"phone ahead of latest is left alone", "platform=android&runtime_version=ahead", false},
		{"iOS has no APK", "platform=ios&runtime_version=old", false},
	} {
		status, data := nativeStatus(t, dir, tc.query)
		if status != fiber.StatusOK || data["update_required"] != tc.required {
			t.Fatalf("%s: status %d, data %v, want update_required=%v", tc.name, status, data, tc.required)
		}
	}
	if _, data := nativeStatus(t, dir, "platform=android&runtime_version=old"); data["version_code"] != float64(5) {
		t.Fatalf("version_code = %v, want 5", data["version_code"])
	}
}

func TestAppNativeStatus_NothingPublishedYet(t *testing.T) {
	status, data := nativeStatus(t, t.TempDir(), "platform=android&runtime_version=old")
	if status != fiber.StatusOK || data["update_required"] != false {
		t.Fatalf("status %d, data %v, want 200 and no update", status, data)
	}
}

func TestAppNativeStatus_RejectsBadInput(t *testing.T) {
	for _, query := range []string{"platform=android", "platform=android&runtime_version=../apk", "platform=web&runtime_version=old"} {
		if status, _ := nativeStatus(t, t.TempDir(), query); status != fiber.StatusBadRequest {
			t.Fatalf("%q: status %d, want 400", query, status)
		}
	}
}

func TestAppUpdateAPK_InR2RedirectsThere(t *testing.T) {
	dir := t.TempDir()
	url := "https://pub-test.r2.dev/app-updates/apk/budgest-6.apk"
	writeFile(t, filepath.Join(dir, "apk", "latest.json"), `{"file":"budgest-6.apk","url":"`+url+`","versionCode":6}`)

	resp, err := appUpdateApp(dir).Test(httptest.NewRequest(http.MethodGet, "/apk", nil))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusFound || resp.Header.Get("Location") != url {
		t.Fatalf("status %d, Location %q; want 302 to %s", resp.StatusCode, resp.Header.Get("Location"), url)
	}
}

func TestAppUpdateAPK_NonHTTPSURLIsRefused(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "apk", "latest.json"), `{"file":"budgest-6.apk","url":"javascript:alert(1)","versionCode":6}`)

	resp, err := appUpdateApp(dir).Test(httptest.NewRequest(http.MethodGet, "/apk", nil))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusInternalServerError {
		t.Fatalf("status %d, want 500", resp.StatusCode)
	}
}
