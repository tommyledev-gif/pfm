package service

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
)

// switchTokenClaims is the payload of an account-switch token
// (specs/mobile-account-switch). It deliberately carries NO user_id/role
// claims, so JWTAuth rejects it as an access token by construction (plan.md
// Finding #2), and a non-empty Purpose, so ParseRefreshToken rejects it as a
// refresh token (Finding #1).
type switchTokenClaims struct {
	Purpose string `json:"purpose"`
	jwt.RegisteredClaims
}

// SwitchTokenClaims is the verified content of a switch token the service
// layer needs: who it belongs to, its single-use id, and its lifetime.
type SwitchTokenClaims struct {
	JTI       string
	UserID    uuid.UUID
	IssuedAt  *jwt.NumericDate
	ExpiresAt time.Time
}

// IssueSwitchToken mints a fresh 180-day switch token for userID.
func (s *TokenService) IssueSwitchToken(userID uuid.UUID) (token string, expiresAt time.Time, err error) {
	now := time.Now().UTC()
	expiresAt = now.Add(common.AccountSwitchTokenTTL)
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, switchTokenClaims{
		Purpose: common.AccountSwitchTokenPurpose,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.NewString(),
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}).SignedString(s.signingKey)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("service.IssueSwitchToken: %w", err)
	}
	// Return the second-truncated expiry actually encoded in the token, so
	// the client never shows a later expiry than the server enforces.
	return signed, jwt.NewNumericDate(expiresAt).Time.UTC(), nil
}

// ParseSwitchToken verifies signature, expiry (required), purpose, jti and
// subject. A value that is not a JWT at all is wrapped with
// jwt.ErrTokenMalformed so callers can answer 400 instead of 401.
func (s *TokenService) ParseSwitchToken(tokenString string) (*SwitchTokenClaims, error) {
	claims := &switchTokenClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.signingKey, nil
	}, jwt.WithExpirationRequired())
	if err != nil {
		return nil, fmt.Errorf("service.ParseSwitchToken: %w", err)
	}
	if !token.Valid {
		return nil, fmt.Errorf("service.ParseSwitchToken: token is not valid")
	}
	return switchClaimsFrom(claims, "service.ParseSwitchToken")
}

// ParseSwitchTokenUnverified reads a switch token WITHOUT verifying its
// signature — revoke only (same reasoning as ParseRefreshTokenUnverified:
// revoking a jti that was never genuinely issued is harmless). The purpose
// check still applies so a refresh/access token is never accepted here.
func (s *TokenService) ParseSwitchTokenUnverified(tokenString string) (*SwitchTokenClaims, error) {
	claims := &switchTokenClaims{}
	if _, _, err := jwt.NewParser().ParseUnverified(tokenString, claims); err != nil {
		return nil, fmt.Errorf("service.ParseSwitchTokenUnverified: %w", err)
	}
	if claims.ExpiresAt == nil {
		return nil, fmt.Errorf("service.ParseSwitchTokenUnverified: missing exp claim")
	}
	return switchClaimsFrom(claims, "service.ParseSwitchTokenUnverified")
}

func switchClaimsFrom(claims *switchTokenClaims, op string) (*SwitchTokenClaims, error) {
	if claims.Purpose != common.AccountSwitchTokenPurpose {
		return nil, fmt.Errorf("%s: unexpected purpose %q", op, claims.Purpose)
	}
	if claims.ID == "" || claims.ExpiresAt == nil {
		return nil, fmt.Errorf("%s: missing jti or exp claim", op)
	}
	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return nil, fmt.Errorf("%s: invalid subject: %w", op, err)
	}
	return &SwitchTokenClaims{
		JTI:       claims.ID,
		UserID:    userID,
		IssuedAt:  claims.IssuedAt,
		ExpiresAt: claims.ExpiresAt.Time,
	}, nil
}
