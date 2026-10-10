package middleware

import (
	"context"
	"io"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
	"github.com/example/pfm/backend/internal/repository/sqlc"
	"github.com/example/pfm/backend/internal/service"
)

// JWTAuth end to end: the real SessionService and the real SQL behind it,
// rather than a stubbed authorizer. Needs a database with every migration
// applied; skipped unless PFM_TEST_DATABASE_URL is set (see
// internal/repository/session_repository_integration_test.go).

type liveStack struct {
	pool   *pgxpool.Pool
	tokens *service.TokenService
	svc    *service.SessionService
	app    *fiber.App
}

func newLiveStack(t *testing.T) *liveStack {
	t.Helper()
	url := os.Getenv("PFM_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("PFM_TEST_DATABASE_URL is not set")
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)

	tokens := service.NewTokenService(testSigningKey)
	svc := service.NewSessionService(repository.NewSessionRepository(sqlc.New(pool), pool), tokens, zap.NewNop())
	return &liveStack{pool: pool, tokens: tokens, svc: svc, app: newProtectedTestAppWith(tokens, svc)}
}

func (s *liveStack) newUser(t *testing.T, role model.UserRole) *model.User {
	t.Helper()
	var id uuid.UUID
	email := uuid.NewString() + "@jwt-test.example.com"
	if err := s.pool.QueryRow(context.Background(),
		`INSERT INTO users (email, role, status) VALUES ($1, $2, 'active') RETURNING id`, email, string(role)).Scan(&id); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	t.Cleanup(func() {
		_, _ = s.pool.Exec(context.Background(), `DELETE FROM sessions WHERE user_id = $1`, id)
		_, _ = s.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1`, id)
	})
	return &model.User{ID: id, Email: email, Role: role, Status: model.UserStatusActive}
}

func (s *liveStack) get(t *testing.T, access string) (int, string) {
	t.Helper()
	req, _ := http.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+access)
	resp, err := s.app.Test(req, -1)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close() //nolint:errcheck // test
	body, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, string(body)
}

func (s *liveStack) start(t *testing.T, user *model.User) (access, refresh string) {
	t.Helper()
	access, refresh, err := s.svc.Start(context.Background(), user)
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	return access, refresh
}

func TestLiveJWTAuthAcceptsALiveSessionAndReadsTheRoleFromTheDatabase(t *testing.T) {
	s := newLiveStack(t)
	admin := s.newUser(t, model.UserRoleAdmin)
	access, _ := s.start(t, admin)

	if status, body := s.get(t, access); status != http.StatusOK || body != string(model.UserRoleAdmin) {
		t.Fatalf("live session: %d %q, want 200 admin", status, body)
	}

	// Demoted in the database: the very same token now carries member rights.
	if _, err := s.pool.Exec(context.Background(), `UPDATE users SET role = 'member' WHERE id = $1`, admin.ID); err != nil {
		t.Fatal(err)
	}
	if status, body := s.get(t, access); status != http.StatusOK || body != string(model.UserRoleMember) {
		t.Fatalf("after demotion: %d %q, want 200 member", status, body)
	}
}

func TestLiveJWTAuthStopsAtOnceWhenTheSessionEnds(t *testing.T) {
	s := newLiveStack(t)
	user := s.newUser(t, model.UserRoleMember)
	access, refresh := s.start(t, user)
	if status, _ := s.get(t, access); status != http.StatusOK {
		t.Fatalf("before: %d", status)
	}

	info, err := s.tokens.ParseRefreshToken(refresh)
	if err != nil {
		t.Fatal(err)
	}
	sessionID, _ := uuid.Parse(info.SessionID)
	if err := s.svc.End(context.Background(), sessionID, user.ID, model.SessionRevokedLogout); err != nil {
		t.Fatal(err)
	}
	if status, _ := s.get(t, access); status != http.StatusUnauthorized {
		t.Fatalf("after logout the 15-minute access token must be dead at once, got %d", status)
	}
}

func TestLiveJWTAuthStopsForADisabledUserAndAfterSignOutEverywhere(t *testing.T) {
	s := newLiveStack(t)
	ctx := context.Background()

	disabled := s.newUser(t, model.UserRoleMember)
	access, _ := s.start(t, disabled)
	if _, err := s.pool.Exec(ctx, `UPDATE users SET status = 'disabled' WHERE id = $1`, disabled.ID); err != nil {
		t.Fatal(err)
	}
	if status, _ := s.get(t, access); status != http.StatusUnauthorized {
		t.Fatalf("a disabled user's token: %d, want 401", status)
	}

	signedOut := s.newUser(t, model.UserRoleMember)
	old, _ := s.start(t, signedOut)
	if _, err := s.pool.Exec(ctx, `UPDATE users SET tokens_valid_after = NOW() + INTERVAL '1 hour' WHERE id = $1`, signedOut.ID); err != nil {
		t.Fatal(err)
	}
	if status, _ := s.get(t, old); status != http.StatusUnauthorized {
		t.Fatalf("a token issued before the sign-out point: %d, want 401", status)
	}
}

func TestLiveJWTAuthRefusesTheLeastRecentlyUsedSessionOnceTheLimitIsPassed(t *testing.T) {
	s := newLiveStack(t)
	user := s.newUser(t, model.UserRoleMember)

	var tokens []string
	for i := 0; i < common.SessionMaxActive+1; i++ {
		access, _ := s.start(t, user)
		tokens = append(tokens, access)
	}
	if status, _ := s.get(t, tokens[0]); status != http.StatusUnauthorized {
		t.Fatalf("the first of six sessions: %d, want 401 (evicted)", status)
	}
	for i, access := range tokens[1:] {
		if status, _ := s.get(t, access); status != http.StatusOK {
			t.Fatalf("session %d of the newest five: %d, want 200", i+2, status)
		}
	}
}

// A token that names a session which does not exist — what a token forged with
// a leaked signing key looks like — gets nothing.
func TestLiveJWTAuthRefusesAForgedAdminTokenWithAMadeUpSession(t *testing.T) {
	s := newLiveStack(t)
	admin := s.newUser(t, model.UserRoleAdmin)
	forged, _, err := s.tokens.IssueSessionTokens(admin, uuid.New(), uuid.NewString(), time.Now().Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if status, _ := s.get(t, forged); status != http.StatusUnauthorized {
		t.Fatalf("forged token: %d, want 401", status)
	}
}

// Not being able to ask is not a 401: clients sign the user out on 401.
func TestLiveJWTAuthDatabaseOutageIsNotA401(t *testing.T) {
	s := newLiveStack(t)
	user := s.newUser(t, model.UserRoleMember)
	access, _ := s.start(t, user)

	s.pool.Close()
	if status, _ := s.get(t, access); status != http.StatusInternalServerError {
		t.Fatalf("with the database gone: %d, want 500", status)
	}
}
