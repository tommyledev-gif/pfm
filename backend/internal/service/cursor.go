package service

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// cursorPayload is the opaque pagination cursor's decoded shape (plan.md
// Edge Case #1 for US-03: "{id, created_at} of the last item, base64 encoded").
type cursorPayload struct {
	ID        uuid.UUID `json:"id"`
	CreatedAt time.Time `json:"created_at"`
}

func encodeCursor(id uuid.UUID, createdAt time.Time) (string, error) {
	raw, err := json.Marshal(cursorPayload{ID: id, CreatedAt: createdAt})
	if err != nil {
		return "", fmt.Errorf("service.encodeCursor: %w", err)
	}
	return base64.URLEncoding.EncodeToString(raw), nil
}

func decodeCursor(cursor string) (uuid.UUID, time.Time, error) {
	raw, err := base64.URLEncoding.DecodeString(cursor)
	if err != nil {
		return uuid.UUID{}, time.Time{}, fmt.Errorf("service.decodeCursor: %w", err)
	}
	var payload cursorPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return uuid.UUID{}, time.Time{}, fmt.Errorf("service.decodeCursor: %w", err)
	}
	return payload.ID, payload.CreatedAt, nil
}
