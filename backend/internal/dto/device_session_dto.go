package dto

import (
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
)

// DeviceSessionResponse is one row of GET /auth/sessions — a device the
// caller is signed in on (or saved as a switchable account on). Never carries
// a token, a jti or the raw device id.
type DeviceSessionResponse struct {
	ID         string    `json:"id"`
	DeviceName *string   `json:"device_name"`
	CreatedAt  time.Time `json:"created_at"`
	LastUsedAt time.Time `json:"last_used_at"`
	IsCurrent  bool      `json:"is_current"`
}

// DeviceSessionListResponse is the 200 body of GET /auth/sessions.
type DeviceSessionListResponse struct {
	Data []DeviceSessionResponse `json:"data"`
}

// NewDeviceSessionListResponse marks the session the request was made with
// as is_current.
func NewDeviceSessionListResponse(items []model.SessionSummary, currentSessionID uuid.UUID) DeviceSessionListResponse {
	data := make([]DeviceSessionResponse, 0, len(items))
	for _, item := range items {
		data = append(data, DeviceSessionResponse{
			ID:         item.ID.String(),
			DeviceName: item.DeviceName,
			CreatedAt:  item.CreatedAt.UTC(),
			LastUsedAt: item.LastUsedAt.UTC(),
			IsCurrent:  item.ID == currentSessionID,
		})
	}
	return DeviceSessionListResponse{Data: data}
}

// ChangePasswordRequest is the body of PUT /users/me/password. Length and
// "differs from the current one" are service rules with their own error
// codes (WEAK_PASSWORD, SAME_PASSWORD), so only presence is checked here —
// same split as ActivateRequest.
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" validate:"required,max=256"`
	NewPassword     string `json:"new_password" validate:"required,max=256"`
}
