package dto

import "github.com/example/pfm/backend/internal/model"

// AppNativeStatusResponse answers GET /api/v1/app-updates/apk/status: whether
// the phone asking has to install the newest APK, and which one that is.
// Mirrors mobile/src/features/app-update/types.ts.
type AppNativeStatusResponse struct {
	UpdateRequired bool   `json:"update_required"`
	VersionCode    int    `json:"version_code"`
	VersionName    string `json:"version_name"`
	// DownloadURL is the APK link to open in a browser; omitted when the
	// server has none configured (APK_PUBLIC_URL), and the app then uses its
	// API's /app-updates/apk.
	DownloadURL string `json:"download_url,omitempty"`
}

// NewAppNativeStatusResponse builds the answer; latest is nil before the
// first APK upload.
func NewAppNativeStatusResponse(latest *model.AppRelease, required bool) AppNativeStatusResponse {
	if latest == nil {
		return AppNativeStatusResponse{}
	}
	return AppNativeStatusResponse{UpdateRequired: required, VersionCode: latest.VersionCode, VersionName: latest.VersionName}
}
