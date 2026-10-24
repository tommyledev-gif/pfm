package service

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"

	"github.com/example/pfm/backend/internal/common"
)

// resetCodeKeyLabel derives the reset-code key from JWT_SECRET, so the codes
// get their own key without a new secret to deploy (specs/forgot-password
// plan Finding #3).
const resetCodeKeyLabel = "pfm/password-reset-code/v1"

// generateResetCode returns common.ResetCodeDigits uniform decimal digits from
// crypto/rand (leading zeros kept).
func generateResetCode() (string, error) {
	limit := new(big.Int).Exp(big.NewInt(10), big.NewInt(common.ResetCodeDigits), nil)
	n, err := rand.Int(rand.Reader, limit)
	if err != nil {
		return "", fmt.Errorf("service.generateResetCode: %w", err)
	}
	return fmt.Sprintf("%0*d", common.ResetCodeDigits, n), nil
}

// resetCodeHasher keys the stored hash of a code (BR-06): a copy of the
// table alone cannot be turned back into codes by trying all million.
type resetCodeHasher struct {
	key []byte
}

func newResetCodeHasher(secret string) resetCodeHasher {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(resetCodeKeyLabel))
	return resetCodeHasher{key: mac.Sum(nil)}
}

// hash binds the code to its account, so one code value never matches
// another user's row.
func (h resetCodeHasher) hash(userID, code string) string {
	mac := hmac.New(sha256.New, h.key)
	mac.Write([]byte(userID + ":" + strings.TrimSpace(code)))
	return hex.EncodeToString(mac.Sum(nil))
}

// matches compares in constant time.
func (h resetCodeHasher) matches(userID, code, stored string) bool {
	return hmac.Equal([]byte(h.hash(userID, code)), []byte(stored))
}
