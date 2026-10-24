package service

import (
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestResetCodeHasher(t *testing.T) {
	for i := 0; i < 50; i++ {
		code, err := generateResetCode()
		if err != nil || !sixDigits.MatchString(code) {
			t.Fatalf("generateResetCode() = %q, %v", code, err)
		}
	}
	h := newResetCodeHasher(testSwitchSigningKey)
	a, b := uuid.NewString(), uuid.NewString()
	stored := h.hash(a, "482915")
	if !h.matches(a, "482915", stored) {
		t.Fatal("the right code does not match")
	}
	if h.matches(a, "482916", stored) || h.matches(b, "482915", stored) {
		t.Fatal("a wrong code, or another user's code, matches")
	}
	if strings.Contains(stored, "482915") || newResetCodeHasher("another-secret-of-32-bytes-or-more!").matches(a, "482915", stored) {
		t.Fatal("the stored hash leaks the code or ignores the key")
	}
}
