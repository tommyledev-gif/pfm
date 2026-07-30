package service

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// AccessClaims is embedded in the access token; JWTAuth middleware decodes
// this to resolve the caller's identity and role. Field names are duplicated
// as constants in common.JWTClaimUserID/JWTClaimRole so issuance (here) and
// parsing (middleware) can't drift apart on a typo'd string literal.
type AccessClaims struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// refreshClaims only needs a jti (for revocation) and the standard registered
// claims — the refresh token itself carries no role, since it's never used
// for authorization, only to identify itself for revocation at logout.
type refreshClaims struct {
	jwt.RegisteredClaims
}

// TokenService issues and parses the JWT access/refresh pair shared by
// Login (F-02 US-04) and Activate (F-01 US-02) — owned here per plan.md's
// Pre-flight Finding #3 in the user-management plan.
type TokenService struct {
	signingKey []byte
}

func NewTokenService(signingKey string) *TokenService {
	return &TokenService{signingKey: []byte(signingKey)}
}

// GenerateTokenPair issues a 15-minute access token and a 7-day refresh
// token for the given user. Both durations are named constants
// (common.AccessTokenTTL / common.RefreshTokenTTL) — never inlined.
func (s *TokenService) GenerateTokenPair(user *model.User) (accessToken string, refreshToken string, err error) {
	now := time.Now().UTC()

	access := jwt.NewWithClaims(jwt.SigningMethodHS256, AccessClaims{
		UserID: user.ID.String(),
		Role:   string(user.Role),
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(common.AccessTokenTTL)),
		},
	})
	accessToken, err = access.SignedString(s.signingKey)
	if err != nil {
		return "", "", fmt.Errorf("service.GenerateTokenPair: sign access token: %w", err)
	}

	refresh := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.NewString(),
			Subject:   user.ID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(common.RefreshTokenTTL)),
		},
	})
	refreshToken, err = refresh.SignedString(s.signingKey)
	if err != nil {
		return "", "", fmt.Errorf("service.GenerateTokenPair: sign refresh token: %w", err)
	}

	return accessToken, refreshToken, nil
}

// ParseAccessToken verifies the signature and expiry and returns the
// decoded claims. Any failure here — expired, tampered signature, malformed
// structure — is surfaced identically as an error; JWTAuth middleware maps
// all of them to 401 without distinguishing the reason to the client.
func (s *TokenService) ParseAccessToken(tokenString string) (*AccessClaims, error) {
	claims := &AccessClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.signingKey, nil
	})
	if err != nil {
		return nil, fmt.Errorf("service.ParseAccessToken: %w", err)
	}
	if !token.Valid {
		return nil, fmt.Errorf("service.ParseAccessToken: token is not valid")
	}
	return claims, nil
}

// ParseRefreshTokenUnverified extracts the jti and expiry from a refresh
// token WITHOUT verifying its signature — plan.md's US-05 sequence diagram
// explicitly does not require signature re-verification to revoke a token
// (revoking a jti that never belonged to a real signed token is harmless:
// it just occupies a row that will never be looked up by a legitimate
// caller). Handler-level `validate:"jwt"` already rejects structurally
// malformed input before this is ever called.
func (s *TokenService) ParseRefreshTokenUnverified(tokenString string) (jti string, subject string, expiresAt time.Time, err error) {
	claims := &refreshClaims{}
	_, _, err = jwt.NewParser().ParseUnverified(tokenString, claims)
	if err != nil {
		return "", "", time.Time{}, fmt.Errorf("service.ParseRefreshTokenUnverified: %w", err)
	}
	if claims.ID == "" || claims.ExpiresAt == nil {
		return "", "", time.Time{}, fmt.Errorf("service.ParseRefreshTokenUnverified: missing jti or exp claim")
	}
	return claims.ID, claims.Subject, claims.ExpiresAt.Time, nil
}
