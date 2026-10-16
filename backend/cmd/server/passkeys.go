package main

import (
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/config"
	"github.com/example/pfm/backend/internal/service"
)

// newPasskeyRelyingParty turns the passkey config into the service's relying
// party, or nil — passkeys off — when WEBAUTHN_RP_ID is unset. Password
// sign-in is unaffected either way.
func newPasskeyRelyingParty(cfg config.PasskeyConfig, logger *zap.Logger) *service.PasskeyRelyingParty {
	if !cfg.Enabled() {
		logger.Warn("WEBAUTHN_RP_ID not set — passkeys are off")
		return nil
	}
	if len(cfg.AndroidCertSHA256) == 0 {
		logger.Warn("ANDROID_CERT_SHA256 not set — the Android app cannot use passkeys")
	}
	logger.Info("passkeys configured", zap.String("rp_id", cfg.RPID), zap.Int("android_certs", len(cfg.AndroidCertSHA256)))
	return &service.PasskeyRelyingParty{ID: cfg.RPID, Origins: cfg.Origins(), AndroidOrigins: cfg.AndroidOrigins()}
}
