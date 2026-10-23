package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/service"
)

// profileUsers is a UserRepo with just the methods the profile endpoints
// reach; anything else would panic on the nil embedded interface, which is
// itself a useful assertion that PATCH touches nothing else.
type profileUsers struct {
	service.UserRepo
	user       model.User
	updatedFor uuid.UUID
}

func (p *profileUsers) GetUserByID(_ context.Context, id uuid.UUID) (*model.User, error) {
	u := p.user
	return &u, nil
}

func (p *profileUsers) UpdateFullName(_ context.Context, id uuid.UUID, name string) (*model.User, error) {
	p.updatedFor = id
	p.user.FullName = &name
	u := p.user
	return &u, nil
}

func profileApp(users *profileUsers, callerID uuid.UUID) *fiber.App {
	logger := zap.NewNop()
	h := NewProfileHandler(service.NewProfileService(users, service.UnconfiguredIconUploader{}, logger), logger)
	app := fiber.New()
	// Stands in for JWTAuth: the caller's id comes from the token, nowhere else.
	app.Use(func(c *fiber.Ctx) error {
		c.Locals(common.LocalsUserID, callerID.String())
		return c.Next()
	})
	app.Get("/users/me", h.GetMe)
	app.Patch("/users/me", h.UpdateMe)
	app.Delete("/users/me/avatar", h.DeleteAvatar)
	return app
}

func do(t *testing.T, app *fiber.App, method, path, body string) (int, map[string]any) {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close() //nolint:errcheck // test
	var out map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return resp.StatusCode, out
}

func newProfileUsers() (*profileUsers, uuid.UUID) {
	id := uuid.New()
	return &profileUsers{user: model.User{
		ID: id, Email: "a@example.com", Status: model.UserStatusActive, Role: model.UserRoleMember,
		CreatedAt: time.Now(),
	}}, id
}

func TestPatchMeUpdatesOnlyTheCallersName(t *testing.T) {
	users, id := newProfileUsers()
	app := profileApp(users, id)

	status, body := do(t, app, http.MethodPatch, "/users/me", `{"full_name":"  Lê   Thị Mai "}`)

	if status != http.StatusOK {
		t.Fatalf("status %d body %v, want 200", status, body)
	}
	if users.updatedFor != id {
		t.Fatalf("updated user %s, want the caller %s", users.updatedFor, id)
	}
	data := body["data"].(map[string]any)
	if data["full_name"] != "Lê Thị Mai" {
		t.Fatalf("full_name = %v, want the cleaned name", data["full_name"])
	}
	if _, leaked := data["password_hash"]; leaked {
		t.Fatal("the response must never carry password_hash")
	}
}

// Mass assignment: PATCH /users/me takes a name and nothing else, so a client
// cannot promote itself or touch its status or email.
func TestPatchMeRejectsAnyOtherField(t *testing.T) {
	for _, field := range []string{`"role":"admin"`, `"status":"active"`, `"email":"x@example.com"`, `"id":"` + uuid.NewString() + `"`, `"avatar_url":"https://evil.example.com/a.png"`} {
		users, id := newProfileUsers()
		app := profileApp(users, id)

		status, body := do(t, app, http.MethodPatch, "/users/me", `{"full_name":"An",`+field+`}`)

		if status != http.StatusBadRequest {
			t.Errorf("%s: status %d body %v, want 400", field, status, body)
		}
		if users.updatedFor != uuid.Nil {
			t.Errorf("%s: a rejected request must not reach the database", field)
		}
	}
}

func TestPatchMeRejectsABadNameWithAUserFacingMessage(t *testing.T) {
	users, id := newProfileUsers()
	app := profileApp(users, id)

	status, body := do(t, app, http.MethodPatch, "/users/me", `{"full_name":"<b>An</b>"}`)

	if status != http.StatusBadRequest {
		t.Fatalf("status %d, want 400", status)
	}
	if msg, _ := body["message"].(string); !strings.HasPrefix(msg, "Tên chỉ gồm") {
		t.Fatalf("message %q should be the Vietnamese rule, not an internal error", msg)
	}
}

func TestPatchMeRejectsMalformedAndEmptyBodies(t *testing.T) {
	for _, raw := range []string{``, `not json`, `[]`, `{}`, `{"full_name":null}`} {
		users, id := newProfileUsers()
		status, body := do(t, profileApp(users, id), http.MethodPatch, "/users/me", raw)
		if status != http.StatusBadRequest {
			t.Errorf("body %q: status %d %v, want 400", raw, status, body)
		}
	}
}

func TestGetMeReturnsTheProfileWithAnAvatarField(t *testing.T) {
	users, id := newProfileUsers()
	url := "https://img.example.com/avatars/a.jpg"
	users.user.AvatarURL = &url

	status, body := do(t, profileApp(users, id), http.MethodGet, "/users/me", "")

	if status != http.StatusOK {
		t.Fatalf("status %d, want 200", status)
	}
	data := body["data"].(map[string]any)
	if data["avatar_url"] != url || data["email"] != "a@example.com" {
		t.Fatalf("unexpected profile: %v", data)
	}
}

// specs/security-hardening-2026-10 F-18: GET /users/me tells the app whether
// to show the account deletion tool; only the configured operator who is an
// admin gets true.
func TestGetMe_CanDeleteAccounts(t *testing.T) {
	callerID := uuid.New()
	logger := zap.NewNop()
	cases := []struct {
		name  string
		email string
		role  model.UserRole
		want  bool
	}{
		{"operator admin", "Operator@Example.com", model.UserRoleAdmin, true},
		{"operator but member", "operator@example.com", model.UserRoleMember, false},
		{"another admin", "admin@example.com", model.UserRoleAdmin, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			users := &profileUsers{user: model.User{ID: callerID, Email: tc.email, Role: tc.role, Status: model.UserStatusActive}}
			svc := service.NewProfileService(users, service.UnconfiguredIconUploader{}, logger).
				WithAccountDeletionPolicy(service.NewAccountDeletionPolicy("operator@example.com"))
			app := fiber.New()
			app.Use(func(c *fiber.Ctx) error {
				c.Locals(common.LocalsUserID, callerID.String())
				return c.Next()
			})
			app.Get("/users/me", NewProfileHandler(svc, logger).GetMe)

			status, body := do(t, app, http.MethodGet, "/users/me", "")
			data, _ := body["data"].(map[string]any)
			if status != http.StatusOK || data["can_delete_accounts"] != tc.want || data["email"] != tc.email {
				t.Fatalf("status %d, data %v", status, data)
			}
		})
	}
}
