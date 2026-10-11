package service

import (
	"mime"
	"strings"
	"testing"
)

func TestBuildEmailMessage_Activation(t *testing.T) {
	msg := string(buildEmailMessage(
		"no-reply@pfm.local", "PFM", "user@example.com", activationEmail("https://app.pfm.local/activate?token=abc123"),
	))

	wantSubstrings := []string{
		"From: PFM <no-reply@pfm.local>",
		"To: user@example.com",
		// Vietnamese subject, so it must arrive MIME-encoded.
		"Subject: " + mime.BEncoding.Encode("UTF-8", activationSubject),
		"Content-Type: text/html",
		"https://app.pfm.local/activate?token=abc123",
	}
	for _, want := range wantSubstrings {
		if !strings.Contains(msg, want) {
			t.Errorf("buildEmailMessage() missing %q in:\n%s", want, msg)
		}
	}

	headerEnd := strings.Index(msg, "\r\n\r\n")
	if headerEnd == -1 {
		t.Fatal("buildEmailMessage() must separate headers from body with a blank line (CRLF CRLF)")
	}
}

// The requester's email lands in both the subject and the body; neither may
// let it inject a header line or markup.
func TestBuildEmailMessage_AccessRequestEscapesRequester(t *testing.T) {
	requester := "a<b>@example.com\r\nBcc: x@evil.test"
	msg := string(buildEmailMessage(
		"no-reply@pfm.local", "PFM", "admin@example.com", accessRequestEmail(requester, "https://app.pfm.local/approve-access?token=t"),
	))

	headers := msg[:strings.Index(msg, "\r\n\r\n")]
	if strings.Contains(headers, "Bcc:") {
		t.Errorf("requester email injected a header:\n%s", headers)
	}
	if strings.Contains(msg, "<b>") {
		t.Errorf("requester email was not HTML-escaped:\n%s", msg)
	}
	if !strings.Contains(msg, "https://app.pfm.local/approve-access?token=t") {
		t.Errorf("approval link missing:\n%s", msg)
	}
}
