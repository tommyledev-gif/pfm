package service

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// issuedBeforeRevocation reports whether a token issued at iat must be
// refused because its user signed out everywhere at tokensValidAfter
// (specs/mobile-account-switch plan.md Finding #18).
//
// Compared in whole seconds only: `iat` carries jwt.TimePrecision (1 s) and
// tokensValidAfter is stored truncated to the same precision, so a fresh
// token issued in the same second as the sign-out point passes — that is
// what keeps the requesting device's new pair valid (spec AC-37). A token
// with no `iat` at all is refused once a point exists.
func issuedBeforeRevocation(iat *jwt.NumericDate, tokensValidAfter *time.Time) bool {
	if tokensValidAfter == nil {
		return false
	}
	if iat == nil {
		return true
	}
	return iat.Unix() < tokensValidAfter.Unix()
}

// revocationPointNow is the value stored as tokens_valid_after: computed on
// the same clock that signs `iat`, truncated to its precision.
func revocationPointNow() time.Time {
	return time.Now().UTC().Truncate(jwt.TimePrecision)
}
