package config

import (
	"strings"
	"testing"
)

// A keytool / `eas credentials` fingerprint becomes the origin Android's
// Credential Manager sends: base64url (no padding) of the same 32 bytes.
func TestPasskeyConfigAndroidOrigins(t *testing.T) {
	fp := strings.TrimSuffix(strings.Repeat("0A:", 32), ":")
	cfg := PasskeyConfig{RPID: "api.example.com", AndroidCertSHA256: []string{fp}}

	got := cfg.AndroidOrigins()
	want := "android:apk-key-hash:CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgo"
	if len(got) != 1 || got[0] != want {
		t.Fatalf("got %v, want [%s]", got, want)
	}
	if origins := cfg.Origins(); len(origins) != 1 || origins[0] != "https://api.example.com" {
		t.Fatalf("origins: got %v", origins)
	}
}

func TestLoadPasskeyConfigRejectsBadFingerprint(t *testing.T) {
	t.Setenv("WEBAUTHN_RP_ID", "api.example.com")
	t.Setenv("ANDROID_CERT_SHA256", "not-a-fingerprint")
	if _, err := loadPasskeyConfig(); err == nil {
		t.Fatal("expected an error for a malformed fingerprint")
	}
}
