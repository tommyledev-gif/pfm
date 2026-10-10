package middleware

import (
	"context"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

// SessionAuthorizer decides whether the session behind an access token is
// still good. *service.SessionService satisfies it.
type SessionAuthorizer interface {
	Authorize(ctx context.Context, sessionID, userID uuid.UUID, issuedAt *jwt.NumericDate) (*model.SessionAuthState, error)
}

// JWTAuth validates the access token's signature and expiry, then checks its
// session on every request, and injects the caller's identity into Fiber
// locals (common.LocalsUserID / LocalsRole) for downstream handlers/RequireRole
// to read.
//
// The session check is what makes revocation instant (sign out everywhere, an
// evicted or reuse-revoked session, a disabled user all stop working on the
// next request) and what makes a token unforgeable from the signing key
// alone: a token needs a live (user_id, sid) pair. A token with no `sid` —
// one issued before sessions existed — is refused; its holder refreshes and
// gets a session-bound pair.
//
// Every failure mode — missing header, expired token, a tampered/invalid
// signature, a dead session — maps to the same 401 without distinguishing the
// reason to the client (test_cases.md TC-USR-07/08/47/48 all expect a bare
// 401). The one exception is failing to look the session up at all: that is a
// server error, never a 401, because clients sign out on 401.
func JWTAuth(tokens *service.TokenService, sessions SessionAuthorizer, logger *zap.Logger) fiber.Handler {
	return func(c *fiber.Ctx) error {
		header := c.Get(fiber.HeaderAuthorization)
		const prefix = "Bearer "
		if !strings.HasPrefix(header, prefix) {
			return response.Error(c, logger, common.ErrUnauthenticated)
		}
		tokenString := strings.TrimPrefix(header, prefix)

		claims, err := tokens.ParseAccessToken(tokenString)
		if err != nil {
			return response.Error(c, logger, common.ErrUnauthenticated)
		}
		// Defense in depth for the import_token added by
		// specs/transaction-export-import (plan.md Finding #5): that token is
		// signed with this same key, so ParseAccessToken would happily verify
		// its signature and decode it into a zero-valued AccessClaims — an
		// empty Role, which RequireRole would then reject, but which would
		// have reached every non-role-gated handler as an authenticated
		// caller. Every real access token has carried a non-empty role since
		// F-02, so rejecting an empty one changes nothing for any valid
		// credential; it only closes this shape off explicitly.
		if claims.Role == "" || claims.UserID == "" {
			return response.Error(c, logger, common.ErrUnauthenticated)
		}

		userID, err := uuid.Parse(claims.UserID)
		if err != nil {
			return response.Error(c, logger, common.ErrUnauthenticated)
		}
		sessionID, err := uuid.Parse(claims.SessionID)
		if err != nil {
			return response.Error(c, logger, common.ErrUnauthenticated)
		}
		state, err := sessions.Authorize(c.Context(), sessionID, userID, claims.IssuedAt)
		if err != nil {
			return response.Error(c, logger, err)
		}

		c.Locals(common.LocalsUserID, claims.UserID)
		// The role comes from the database, not the token: a demoted admin
		// loses admin rights on the next request instead of in 15 minutes.
		c.Locals(common.LocalsRole, string(state.UserRole))
		c.Locals(common.LocalsTokenIssuedAt, claims.IssuedAt)
		return c.Next()
	}
}
