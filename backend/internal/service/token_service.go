package service

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// AccessClaims is embedded in the access token; JWTAuth middleware decodes
// this to resolve the caller's identity and role. Field names are duplicated
// as constants in common.JWTClaimUserID/JWTClaimRole so issuance (here) and
// parsing (middleware) can't drift apart on a typo'd string literal.
type AccessClaims struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
	// SessionID is the sessions row this token belongs to (`sid`). JWTAuth
	// requires it and checks the row on every request, which is what makes a
	// token revocable instantly and unforgeable from the signing key alone.
	SessionID string `json:"sid,omitempty"`
	jwt.RegisteredClaims
}

// refreshClaims only needs a jti (for revocation) and the standard registered
// claims — the refresh token itself carries no role, since it's never used
// for authorization, only to identify itself for revocation at logout.
//
// Purpose is never set on a real refresh token; it exists only so
// ParseRefreshToken can see — and refuse — a switch token, which carries
// jti/sub/exp too (specs/mobile-account-switch plan.md Finding #1).
type refreshClaims struct {
	Purpose string `json:"purpose,omitempty"`
	// SessionID is empty only on refresh tokens issued before sessions
	// existed (mig 028); AuthService.Refresh upgrades those to a session.
	SessionID string `json:"sid,omitempty"`
	jwt.RegisteredClaims
}

// ImportTokenClaims is the third, deliberately distinct claims type this
// service issues (specs/transaction-export-import/spec.md Context #6): the
// payload of the import_token Preview mints and Commit consumes. It is NOT
// an access token and is never accepted by JWTAuth — Purpose is what makes
// that a structural guarantee rather than a naming convention, and
// ParseImportToken refuses any token whose Purpose isn't
// common.TransactionImportTokenPurpose.
//
// Rows is the entire validated row list rather than a reference to something
// stored server-side: this feature adds no tables, so the signed, expiring
// token IS the state (plan.md Finding #6/#7).
type ImportTokenClaims struct {
	UserID  string          `json:"user_id"`
	Purpose string          `json:"purpose"`
	Rows    []dto.ImportRow `json:"rows"`
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

// GenerateTokenPair issues a session-less 15-minute access token and 7-day
// refresh token for the given user (no `sid`).
//
// ⚠️ Production code issues credentials through SessionService, which binds
// them to a sessions row. This exists for tests of the legacy paths (JWTAuth
// refusing a token with no `sid`, AuthService.Refresh upgrading a
// pre-session refresh token); JWTAuth rejects what it returns as an access
// token. Both durations are named constants (common.AccessTokenTTL /
// common.RefreshTokenTTL) — never inlined.
func (s *TokenService) GenerateTokenPair(user *model.User) (accessToken string, refreshToken string, err error) {
	return s.sign(user, uuid.Nil, uuid.NewString(), time.Now().UTC().Add(common.RefreshTokenTTL))
}

// IssueSessionTokens signs an access/refresh pair bound to sessionID. The
// refresh token carries refreshJTI and expires at refreshExpiresAt, which
// SessionService has already recorded on the session row.
func (s *TokenService) IssueSessionTokens(user *model.User, sessionID uuid.UUID, refreshJTI string, refreshExpiresAt time.Time) (accessToken string, refreshToken string, err error) {
	return s.sign(user, sessionID, refreshJTI, refreshExpiresAt)
}

// sign mints the pair; uuid.Nil leaves `sid` off both tokens.
func (s *TokenService) sign(user *model.User, sessionID uuid.UUID, refreshJTI string, refreshExpiresAt time.Time) (accessToken string, refreshToken string, err error) {
	now := time.Now().UTC()
	sid := ""
	if sessionID != uuid.Nil {
		sid = sessionID.String()
	}

	access := jwt.NewWithClaims(jwt.SigningMethodHS256, AccessClaims{
		UserID:    user.ID.String(),
		Role:      string(user.Role),
		SessionID: sid,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(common.AccessTokenTTL)),
		},
	})
	accessToken, err = access.SignedString(s.signingKey)
	if err != nil {
		return "", "", fmt.Errorf("service.TokenService.sign: sign access token: %w", err)
	}

	refresh := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims{
		SessionID: sid,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        refreshJTI,
			Subject:   user.ID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(refreshExpiresAt),
		},
	})
	refreshToken, err = refresh.SignedString(s.signingKey)
	if err != nil {
		return "", "", fmt.Errorf("service.TokenService.sign: sign refresh token: %w", err)
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

// ParseRefreshToken verifies a refresh token's signature and expiry before
// any claim is trusted. ⚠️ Refresh mints a new pair for the token's subject,
// so an unverified parse there let anyone forge a token for any user. The
// jti requirement also rejects access and import tokens (they carry none),
// which share the signing key; the purpose check rejects switch tokens.
// IssuedAt is returned for the sign-out-everywhere check.
func (s *TokenService) ParseRefreshToken(tokenString string) (*RefreshTokenInfo, error) {
	claims := &refreshClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.signingKey, nil
	}, jwt.WithExpirationRequired())
	if err != nil {
		return nil, fmt.Errorf("service.ParseRefreshToken: %w", err)
	}
	if !token.Valid || claims.ID == "" || claims.Subject == "" || claims.Purpose != "" {
		return nil, fmt.Errorf("service.ParseRefreshToken: not a valid refresh token")
	}
	return &RefreshTokenInfo{
		JTI:       claims.ID,
		Subject:   claims.Subject,
		SessionID: claims.SessionID,
		ExpiresAt: claims.ExpiresAt.Time,
		IssuedAt:  claims.IssuedAt,
	}, nil
}

// RefreshTokenInfo is what a verified refresh token tells AuthService.
type RefreshTokenInfo struct {
	JTI       string
	Subject   string
	SessionID string // "" for a refresh token issued before sessions existed
	ExpiresAt time.Time
	IssuedAt  *jwt.NumericDate
}

// ParseRefreshTokenUnverified extracts the jti and expiry from a refresh
// token WITHOUT verifying its signature. Logout only — never to issue
// credentials (see ParseRefreshToken) — plan.md's US-05 sequence diagram
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

// IssueImportToken mints the short-lived token that carries a previewed
// import's validated rows through to Commit
// (specs/transaction-export-import/spec.md Context #6). Reuses the same
// signing key as the access/refresh pair — there is no second secret to
// manage — but a structurally different claims type, so the two can never be
// confused for one another.
func (s *TokenService) IssueImportToken(userID uuid.UUID, rows []dto.ImportRow) (string, error) {
	now := time.Now().UTC()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, ImportTokenClaims{
		UserID:  userID.String(),
		Purpose: common.TransactionImportTokenPurpose,
		Rows:    rows,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(common.TransactionImportTokenTTL)),
		},
	})
	signed, err := token.SignedString(s.signingKey)
	if err != nil {
		return "", fmt.Errorf("service.IssueImportToken: %w", err)
	}
	return signed, nil
}

// ParseImportToken verifies signature, expiry and purpose. Called explicitly
// by TransactionImportService.CommitImport — never by JWTAuth middleware,
// which only ever calls ParseAccessToken.
//
// The purpose check lives here rather than at the call site so there is
// exactly one place that can decide a token is an import token, and it can
// never be skipped by a future second caller.
func (s *TokenService) ParseImportToken(tokenString string) (*ImportTokenClaims, error) {
	claims := &ImportTokenClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.signingKey, nil
	})
	if err != nil {
		return nil, fmt.Errorf("service.ParseImportToken: %w", err)
	}
	if !token.Valid {
		return nil, fmt.Errorf("service.ParseImportToken: token is not valid")
	}
	if claims.Purpose != common.TransactionImportTokenPurpose {
		return nil, fmt.Errorf("service.ParseImportToken: unexpected purpose %q", claims.Purpose)
	}
	return claims, nil
}
