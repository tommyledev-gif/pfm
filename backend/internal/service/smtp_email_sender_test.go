package service

import (
	"strings"
	"testing"
)

func TestBuildActivationEmailMessage(t *testing.T) {
	msg := string(buildActivationEmailMessage(
		"no-reply@pfm.local", "PFM", "user@example.com", "https://app.pfm.local/activate?token=abc123",
	))

	wantSubstrings := []string{
		"From: PFM <no-reply@pfm.local>",
		"To: user@example.com",
		"Subject: Activate your PFM account",
		"Content-Type: text/html",
		"https://app.pfm.local/activate?token=abc123",
	}
	for _, want := range wantSubstrings {
		if !strings.Contains(msg, want) {
			t.Errorf("buildActivationEmailMessage() missing %q in:\n%s", want, msg)
		}
	}

	headerEnd := strings.Index(msg, "\r\n\r\n")
	if headerEnd == -1 {
		t.Fatal("buildActivationEmailMessage() must separate headers from body with a blank line (CRLF CRLF)")
	}
}
