package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/example/pfm/backend/internal/model"
)

// ErrNoAppUpdate means nothing is published for the request: no update for
// that runtime version, or no APK yet. Not a failure — expo-updates expects
// it on almost every launch.
var ErrNoAppUpdate = errors.New("no app update published")

// updateIDPattern bounds what a `current` pointer file may name, so a damaged
// or hand-edited pointer can never point outside its runtime directory.
var updateIDPattern = regexp.MustCompile(`^[A-Za-z0-9-]{1,64}$`)

// AppUpdateService reads the mobile app's published OTA updates and APKs from
// disk. None of it is user data: mobile/scripts/ota/*.mjs uploads the files
// over SSH and any client may fetch them (docs/ops-runbook.md §8).
//
// Layout under dir:
//
//	<platform>/<runtimeVersion>/current             id of the live update
//	<platform>/<runtimeVersion>/<id>/manifest.json  the manifest, as signed
//	<platform>/<runtimeVersion>/<id>/manifest.sig   its expo-signature header
//	<platform>/<runtimeVersion>/<id>/…              bundle and assets
//	apk/latest.json                                 newest APK (model.AppRelease)
//	apk/<file>.apk
type AppUpdateService struct {
	dir string
}

func NewAppUpdateService(dir string) *AppUpdateService {
	return &AppUpdateService{dir: dir}
}

// Latest returns the live update for a platform and runtime version, or
// ErrNoAppUpdate. Callers validate both values as path-safe first; they are
// checked again here because they become path segments.
func (s *AppUpdateService) Latest(platform, runtimeVersion string) (*model.AppUpdate, error) {
	runtimeDir, err := s.localPath(platform, runtimeVersion)
	if err != nil {
		return nil, fmt.Errorf("service.AppUpdate.Latest: %w", err)
	}
	pointer, err := readOptional(filepath.Join(runtimeDir, "current"))
	if err != nil {
		return nil, fmt.Errorf("service.AppUpdate.Latest: %w", err)
	}
	if pointer == nil {
		return nil, ErrNoAppUpdate
	}
	id := strings.TrimSpace(string(pointer))
	if !updateIDPattern.MatchString(id) {
		return nil, fmt.Errorf("service.AppUpdate.Latest: bad update id %q in %s/current", id, runtimeVersion)
	}
	manifest, err := os.ReadFile(filepath.Join(runtimeDir, id, "manifest.json"))
	if err != nil {
		return nil, fmt.Errorf("service.AppUpdate.Latest: manifest of %s: %w", id, err)
	}
	signature, err := readOptional(filepath.Join(runtimeDir, id, "manifest.sig"))
	if err != nil {
		return nil, fmt.Errorf("service.AppUpdate.Latest: signature of %s: %w", id, err)
	}
	header := strings.TrimSpace(string(signature))
	if !isHeaderSafe(header) {
		return nil, fmt.Errorf("service.AppUpdate.Latest: signature of %s is not a single printable line", id)
	}
	return &model.AppUpdate{Manifest: manifest, SignatureHeader: header}, nil
}

// LatestAPK returns the newest APK's path on disk and its description, or
// ErrNoAppUpdate before the first upload.
func (s *AppUpdateService) LatestAPK() (string, *model.AppRelease, error) {
	release, err := s.readRelease(filepath.Join(s.dir, "apk", "latest.json"))
	if err != nil {
		return "", nil, fmt.Errorf("service.AppUpdate.LatestAPK: %w", err)
	}
	// In R2: no local path, the caller redirects to the URL.
	if release.URL != "" {
		if !strings.HasPrefix(release.URL, "https://") {
			return "", nil, fmt.Errorf("service.AppUpdate.LatestAPK: latest.json url %q is not https", release.URL)
		}
		return "", release, nil
	}
	if !filepath.IsLocal(release.File) || filepath.Base(release.File) != release.File || filepath.Ext(release.File) != ".apk" {
		return "", nil, fmt.Errorf("service.AppUpdate.LatestAPK: latest.json names %q, not an .apk file in apk/", release.File)
	}
	path := filepath.Join(s.dir, "apk", release.File)
	if _, err := os.Stat(path); err != nil {
		return "", nil, fmt.Errorf("service.AppUpdate.LatestAPK: %w", err)
	}
	return path, release, nil
}

// NativeUpdate says whether a phone running runtimeVersion must install the
// newest APK: OTA updates only reach phones whose native code matches, so a
// phone left on an older APK would otherwise never change again. It returns
// the newest APK (nil before the first upload) and the verdict.
//
// Required only when the phone's runtime is one an APK was uploaded for
// (its apk.json, written by build-apk.mjs) with a lower versionCode than
// the newest. A runtime the server never saw (a build made on a dev machine
// and not uploaded) is never told to "update" to an older APK, and neither
// is a phone already newer than latest (an APK rolled back by hand).
func (s *AppUpdateService) NativeUpdate(platform, runtimeVersion string) (*model.AppRelease, bool, error) {
	latest, err := s.readRelease(filepath.Join(s.dir, "apk", "latest.json"))
	if errors.Is(err, ErrNoAppUpdate) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("service.AppUpdate.NativeUpdate: %w", err)
	}
	if platform != "android" || latest.RuntimeVersion == runtimeVersion {
		return latest, false, nil
	}
	runtimeDir, err := s.localPath(platform, runtimeVersion)
	if err != nil {
		return nil, false, fmt.Errorf("service.AppUpdate.NativeUpdate: %w", err)
	}
	installed, err := s.readRelease(filepath.Join(runtimeDir, "apk.json"))
	if errors.Is(err, ErrNoAppUpdate) {
		return latest, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("service.AppUpdate.NativeUpdate: %w", err)
	}
	return latest, installed.VersionCode < latest.VersionCode, nil
}

// readRelease reads an APK description (latest.json, apk.json), or
// ErrNoAppUpdate when the file does not exist.
func (s *AppUpdateService) readRelease(path string) (*model.AppRelease, error) {
	raw, err := readOptional(path)
	if err != nil {
		return nil, err
	}
	if raw == nil {
		return nil, ErrNoAppUpdate
	}
	var release model.AppRelease
	if err := json.Unmarshal(raw, &release); err != nil {
		return nil, fmt.Errorf("%s: %w", filepath.Base(path), err)
	}
	return &release, nil
}

// localPath joins segments under dir, refusing anything that would leave it.
func (s *AppUpdateService) localPath(segments ...string) (string, error) {
	rel := filepath.Join(segments...)
	if !filepath.IsLocal(rel) {
		return "", fmt.Errorf("path %q escapes the updates directory", rel)
	}
	return filepath.Join(s.dir, rel), nil
}

// readOptional reads a file, answering (nil, nil) when it does not exist.
func readOptional(path string) ([]byte, error) {
	raw, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	return raw, err
}

// isHeaderSafe keeps a stored value from smuggling a line break into the
// response headers.
func isHeaderSafe(v string) bool {
	for _, r := range v {
		if r < 0x20 || r > 0x7e {
			return false
		}
	}
	return true
}
