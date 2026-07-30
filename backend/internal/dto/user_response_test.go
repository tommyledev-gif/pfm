package dto

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
)

// TC-USR-44: password_hash, invite_token, invite_expires_at must never
// appear in the serialized response, even when populated on the source row.
func TestUserResponse_NeverSerializesSensitiveFields(t *testing.T) {
	hash := "$2a$12$somebcrypthash"
	token := "deadbeef"
	expiresAt := time.Now().Add(72 * time.Hour)
	fullName := "Homer Truong"

	u := &model.User{
		ID:              uuid.New(),
		Email:           "homer@example.com",
		FullName:        &fullName,
		PasswordHash:    &hash,
		Status:          model.UserStatusPending,
		Role:            model.UserRoleAdmin,
		InviteToken:     &token,
		InviteExpiresAt: &expiresAt,
		CreatedAt:       time.Now(),
	}

	raw, err := json.Marshal(NewUserResponse(u))
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}
	body := string(raw)

	for _, forbidden := range []string{hash, token, "password_hash", "invite_token", "invite_expires_at"} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("response body must never contain %q, got: %s", forbidden, body)
		}
	}
}

// TC-USR-36: an empty result set must serialize as "data":[], never "data":null.
func TestListUsersResponse_EmptyDataIsEmptyArrayNotNull(t *testing.T) {
	resp := ListUsersResponse{
		Data:       []UserResponse{},
		Pagination: PaginationResponse{NextCursor: nil, Total: 0},
	}
	raw, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}
	if strings.Contains(string(raw), `"data":null`) {
		t.Fatalf("expected \"data\":[] , got: %s", raw)
	}
	if !strings.Contains(string(raw), `"data":[]`) {
		t.Fatalf("expected \"data\":[] in body, got: %s", raw)
	}
}
