package model

// AppUpdate is one published OTA update of the mobile app, as
// mobile/scripts/ota/publish-update.mjs stored it.
type AppUpdate struct {
	// Manifest is the expo-updates manifest byte for byte: the signature
	// covers these exact bytes, so they are served untouched.
	Manifest []byte
	// SignatureHeader is the full expo-signature header value
	// (sig="…", keyid="…", alg="…"), made on the developer's machine; the
	// private key never reaches the server. Empty for an unsigned update,
	// which a client built with code signing refuses.
	SignatureHeader string
}

// AppRelease describes the newest APK (apk/latest.json, written by
// mobile/scripts/ota/build-apk.mjs).
type AppRelease struct {
	File           string `json:"file"`
	VersionCode    int    `json:"versionCode"`
	VersionName    string `json:"versionName"`
	RuntimeVersion string `json:"runtimeVersion"`
	SHA256         string `json:"sha256"`
}
