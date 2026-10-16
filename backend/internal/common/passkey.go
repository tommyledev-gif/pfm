package common

import (
	"fmt"
	"net/http"
	"time"
)

// Passkeys (WebAuthn, mig 032).
const (
	// PasskeyChallengeTTL bounds how long a started ceremony can be finished.
	// Long enough for the OS sheet and a fingerprint, short enough that a
	// captured challenge is useless soon after.
	PasskeyChallengeTTL = 5 * time.Minute

	// MaxPasskeysPerUser caps registrations — one per phone is the norm.
	MaxPasskeysPerUser = 10

	// PasskeyNameMaxLength mirrors the column's purpose: a device name.
	PasskeyNameMaxLength = 60

	// PasskeyRPDisplayName is what the OS passkey sheet shows as the service.
	PasskeyRPDisplayName = "Budgest"
)

const (
	ErrCodePasskeysUnavailable = "PASSKEYS_UNAVAILABLE"
	ErrCodePasskeyFailed       = "PASSKEY_FAILED"
	ErrCodePasskeyNotFound     = "PASSKEY_NOT_FOUND"
	ErrCodePasskeyLimit        = "PASSKEY_LIMIT"
)

var (
	// ErrPasskeysUnavailable — the server has no relying party configured
	// (WEBAUTHN_RP_ID unset): passkeys are off, password sign-in still works.
	ErrPasskeysUnavailable = &AppError{Code: ErrCodePasskeysUnavailable, Status: http.StatusServiceUnavailable, Message: "Chưa dùng được passkey. Đăng nhập bằng mật khẩu."}
	// ErrPasskeyFailed covers every failed ceremony — expired or reused
	// challenge, bad signature, unknown credential — with one message, so a
	// failure tells an attacker nothing about which part was wrong.
	ErrPasskeyFailed   = &AppError{Code: ErrCodePasskeyFailed, Status: http.StatusUnauthorized, Message: "Không xác minh được passkey. Thử lại."}
	ErrPasskeyNotFound = &AppError{Code: ErrCodePasskeyNotFound, Status: http.StatusNotFound, Message: "Không tìm thấy passkey này."}
	ErrPasskeyLimit    = &AppError{Code: ErrCodePasskeyLimit, Status: http.StatusConflict, Message: fmt.Sprintf("Đã đủ %d passkey. Xóa bớt một passkey để thêm mới.", MaxPasskeysPerUser)}
)
