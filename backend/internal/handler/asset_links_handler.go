package handler

import (
	"github.com/gofiber/fiber/v2"
)

// assetLinkStatement is one entry of Android's Digital Asset Links file.
type assetLinkStatement struct {
	Relation []string        `json:"relation"`
	Target   assetLinkTarget `json:"target"`
}

type assetLinkTarget struct {
	Namespace              string   `json:"namespace"`
	PackageName            string   `json:"package_name"`
	SHA256CertFingerprints []string `json:"sha256_cert_fingerprints"`
}

// NewAssetLinksHandler serves GET /.well-known/assetlinks.json: the statement
// that lets the Android app use passkeys for this domain (the WebAuthn
// relying party, WEBAUTHN_RP_ID). Android fetches it from
// https://<rp id>/.well-known/assetlinks.json before it will create or use a
// passkey for the app. Not configured, it answers 404, the same as a domain
// that never had one.
func NewAssetLinksHandler(packageName string, certSHA256 []string) fiber.Handler {
	statements := []assetLinkStatement{{
		Relation: []string{
			"delegate_permission/common.handle_all_urls",
			"delegate_permission/common.get_login_creds",
		},
		Target: assetLinkTarget{Namespace: "android_app", PackageName: packageName, SHA256CertFingerprints: certSHA256},
	}}
	return func(c *fiber.Ctx) error {
		if packageName == "" || len(certSHA256) == 0 {
			return c.SendStatus(fiber.StatusNotFound)
		}
		return c.JSON(statements)
	}
}
