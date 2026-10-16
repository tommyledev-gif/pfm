package config

import (
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"os"
	"strings"
)

// PasskeyConfig configures passkeys (WebAuthn, mig 032). RPID empty means
// passkeys are off: their endpoints answer 503 PASSKEYS_UNAVAILABLE and
// password sign-in is untouched — the same "don't fail startup" pattern as
// SMTP_HOST and R2_ACCOUNT_ID.
type PasskeyConfig struct {
	// RPID is the relying party: the domain passkeys are bound to
	// (api.example.com). It must serve /.well-known/assetlinks.json.
	RPID string
	// WebOrigins are extra web origins allowed to run a ceremony, besides
	// https://RPID itself (see Origins); empty is fine for the app alone.
	WebOrigins []string
	// AndroidPackage and AndroidCertSHA256 are the app's package name and the
	// SHA-256 fingerprints of its signing certificates, colon-separated hex as
	// keytool and `eas credentials` print them. They are served in
	// assetlinks.json, and each fingerprint is also an accepted origin: what
	// Android's Credential Manager sends for a native app is
	// "android:apk-key-hash:" + base64url(SHA-256 of the certificate).
	AndroidPackage    string
	AndroidCertSHA256 []string
}

// Enabled reports whether passkeys can run at all.
func (p PasskeyConfig) Enabled() bool { return p.RPID != "" }

// AndroidOrigins turns the certificate fingerprints into WebAuthn origins.
func (p PasskeyConfig) AndroidOrigins() []string {
	out := make([]string, 0, len(p.AndroidCertSHA256))
	for _, fp := range p.AndroidCertSHA256 {
		raw, _ := hex.DecodeString(strings.ReplaceAll(fp, ":", "")) // validated at load
		out = append(out, "android:apk-key-hash:"+base64.RawURLEncoding.EncodeToString(raw))
	}
	return out
}

func loadPasskeyConfig() (PasskeyConfig, error) {
	cfg := PasskeyConfig{
		RPID:              strings.TrimSpace(os.Getenv("WEBAUTHN_RP_ID")),
		WebOrigins:        splitList(os.Getenv("WEBAUTHN_RP_ORIGINS")),
		AndroidPackage:    strings.TrimSpace(os.Getenv("ANDROID_APP_PACKAGE")),
		AndroidCertSHA256: splitList(os.Getenv("ANDROID_CERT_SHA256")),
	}
	for _, fp := range cfg.AndroidCertSHA256 {
		raw, err := hex.DecodeString(strings.ReplaceAll(fp, ":", ""))
		if err != nil || len(raw) != 32 {
			return PasskeyConfig{}, fmt.Errorf("config.Load: ANDROID_CERT_SHA256 entries must be SHA-256 fingerprints like AB:CD:…, got %q", fp)
		}
	}
	return cfg, nil
}

// Origins lists the web origins a ceremony may come from: the relying party's
// own https origin first (go-webauthn requires at least one), then any extra.
func (p PasskeyConfig) Origins() []string {
	out := []string{"https://" + p.RPID}
	for _, o := range p.WebOrigins {
		if o != out[0] {
			out = append(out, o)
		}
	}
	return out
}

func splitList(raw string) []string {
	var out []string
	for _, part := range strings.Split(raw, ",") {
		if part = strings.TrimSpace(part); part != "" {
			out = append(out, part)
		}
	}
	return out
}
