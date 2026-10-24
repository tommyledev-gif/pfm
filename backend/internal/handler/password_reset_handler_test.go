package handler

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/service"
)

// noAccounts is a UserRepo where nobody exists; anything past the lookup
// would panic on the nil embedded interface or the nil code store.
type noAccounts struct{ service.UserRepo }

func (noAccounts) GetUserByEmail(context.Context, string) (*model.User, error) {
	return nil, pgx.ErrNoRows
}

func (noAccounts) GetUserByUsername(context.Context, string) (*model.User, error) {
	return nil, pgx.ErrNoRows
}

func passwordResetApp() *fiber.App {
	logger := zap.NewNop()
	svc := service.NewPasswordResetService(noAccounts{}, nil, strings.Repeat("k", 32), service.NewLogEmailSender(logger), nil, logger)
	h := NewPasswordResetHandler(svc, logger)
	app := fiber.New()
	app.Post("/request", h.Request)
	app.Post("/confirm", h.Confirm)
	return app
}

// S-FPW-08 and the confirm body's shape.
func TestPasswordResetHandler_RejectsBadBodies(t *testing.T) {
	app := passwordResetApp()
	cases := []struct{ path, body string }{
		{"/request", `{}`},
		{"/request", `{"identifier":"` + strings.Repeat("a", 255) + `"}`},
		{"/request", `not json`},
		{"/confirm", `{"identifier":"a@example.com","code":"12345","new_password":"brandnew-pass"}`},
		{"/confirm", `{"identifier":"a@example.com","code":"12a456","new_password":"brandnew-pass"}`},
		{"/confirm", `{"identifier":"a@example.com","code":"123456"}`},
	}
	for _, tc := range cases {
		status, body := do(t, app, http.MethodPost, tc.path, tc.body)
		if status != http.StatusBadRequest || body["error_code"] != common.ErrCodeInvalidInput {
			t.Errorf("%s %s: got %d %v, want 400 INVALID_INPUT", tc.path, tc.body, status, body["error_code"])
		}
	}
}

// S-FPW-03, S-FPW-16 at the HTTP edge: an unknown account asks like a real
// one and confirms with the generic code error.
func TestPasswordResetHandler_UnknownAccount(t *testing.T) {
	app := passwordResetApp()
	status, body := do(t, app, http.MethodPost, "/request", `{"identifier":"nobody@example.com"}`)
	if status != http.StatusOK || body["error_code"] != nil {
		t.Fatalf("request: got %d %v, want 200", status, body)
	}
	status, body = do(t, app, http.MethodPost, "/confirm", `{"identifier":"nobody","code":"123456","new_password":"brandnew-pass"}`)
	if status != http.StatusBadRequest || body["error_code"] != common.ErrCodeResetCodeInvalid {
		t.Fatalf("confirm: got %d %v, want 400 RESET_CODE_INVALID", status, body)
	}
}
