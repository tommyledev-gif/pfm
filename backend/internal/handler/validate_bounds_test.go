package handler

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/example/pfm/backend/internal/dto"
)

// specs/security-hardening-2026-10 US-09 and US-03: the shape bounds the
// shared validator enforces before any service runs.

func syncMessages(n int, payload string) []dto.ChatThreadMessageSync {
	out := make([]dto.ChatThreadMessageSync, n)
	for i := range out {
		out[i] = dto.ChatThreadMessageSync{ClientMessageID: fmt.Sprintf("msg_%d", i), Payload: json.RawMessage(payload)}
	}
	return out
}

func TestSyncChatThreadRequest_Bounds(t *testing.T) {
	small := `{"text":"ăn trưa 50k"}`
	if err := validate.Struct(dto.SyncChatThreadRequest{Messages: syncMessages(500, small)}); err != nil {
		t.Fatalf("500 messages are allowed: %v", err)
	}
	// S-HRD-41
	if err := validate.Struct(dto.SyncChatThreadRequest{Messages: syncMessages(501, small)}); err == nil {
		t.Fatal("501 messages must be refused")
	}
	// S-HRD-42
	big := `"` + strings.Repeat("a", 64*1024) + `"`
	if err := validate.Struct(dto.SyncChatThreadRequest{Messages: syncMessages(1, big)}); err == nil {
		t.Fatal("a payload over 64 KiB must be refused")
	}
	longID := dto.SyncChatThreadRequest{Messages: []dto.ChatThreadMessageSync{{ClientMessageID: strings.Repeat("x", 201), Payload: json.RawMessage(small)}}}
	if err := validate.Struct(longID); err == nil {
		t.Fatal("an id over 200 characters must be refused")
	}
}

// S-HRD-12: a multi-kilobyte password never reaches bcrypt or the services.
func TestAuthRequests_PasswordShapeBound(t *testing.T) {
	huge := strings.Repeat("p", 257)
	if err := validate.Struct(dto.LoginRequest{Email: "a@example.com", Password: huge}); err == nil {
		t.Fatal("login password over 256 characters must be refused")
	}
	if err := validate.Struct(dto.ActivateRequest{Token: "t", Password: huge, PasswordConfirm: huge}); err == nil {
		t.Fatal("activation password over 256 characters must be refused")
	}
	if err := validate.Struct(dto.LoginRequest{Email: "a@example.com", Password: strings.Repeat("p", 256)}); err != nil {
		t.Fatalf("256 characters pass the shape check: %v", err)
	}
}
