package dto

import "github.com/example/pfm/backend/internal/model"

// AppNativeStatusResponse answers GET /api/v1/app-updates/apk/status: whether
// the phone asking has to install the newest APK, and which one that is.
// Mirrors mobile/src/features/app-update/types.ts.
type AppNativeStatusResponse struct {
	UpdateRequired bool   `json:"update_required"`
	VersionCode    int    `json:"version_code"`
	VersionName    string `json:"version_name"`
}

// NewAppNativeStatusResponse builds the answer; latest is nil before the
// first APK upload.
func NewAppNativeStatusResponse(latest *model.AppRelease, required bool) AppNativeStatusResponse {
	if latest == nil {
		return AppNativeStatusResponse{}
	}
	return AppNativeStatusResponse{UpdateRequired: required, VersionCode: latest.VersionCode, VersionName: latest.VersionName}
}
