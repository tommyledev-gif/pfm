package service

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"github.com/example/pfm/backend/internal/common"
)

// generateInviteToken produces a crypto/rand-backed token — never a UUID
// (uuid.New() draws from a weaker entropy guarantee than crypto/rand for a
// security-sensitive token; see spec.md Edge Case #1 for US-01).
func generateInviteToken() (string, error) {
	b := make([]byte, common.InviteTokenBytes)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("service.generateInviteToken: %w", err)
	}
	return hex.EncodeToString(b), nil
}
