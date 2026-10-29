package service

import (
	"mime"
	"strings"
	"testing"
)

// render builds a message, failing the test on a template error.
func render(t *testing.T, toEmail string, email emailContent) string {
	t.Helper()
	msg, err := buildEmailMessage("no-reply@pfm.local", toEmail, email)
	if err != nil {
		t.Fatalf("buildEmailMessage() error: %v", err)
	}
	return string(msg)
}

func TestBuildEmailMessage_Activation(t *testing.T) {
	msg := render(t, "user@example.com", activationEmail("https://app.pfm.local/activate?token=abc123"))

	wantSubstrings := []string{
		"From: Budgest <no-reply@pfm.local>",
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

// The logo travels inside the message, and the layout points at it.
func TestBuildEmailMessage_EmbedsLogo(t *testing.T) {
	msg := render(t, "user@example.com", passwordResetEmail("123456"))

	for _, want := range []string{
		"Content-Type: multipart/related; boundary=",
		"Content-Type: image/png",
		"Content-ID: <" + emailLogoCID + ">",
		`src="cid:` + emailLogoCID + `"`,
	} {
		if !strings.Contains(msg, want) {
			t.Errorf("buildEmailMessage() missing %q", want)
		}
	}
	// The HTML part keeps the layout's bare LFs; net/smtp's DATA writer
	// turns them into CRLFs on the wire.
	for _, line := range strings.Split(msg, "\n") {
		if len(line) > 998 {
			t.Fatalf("line longer than SMTP's 998-character limit: %d", len(line))
		}
	}
}

// The requester's email lands in both the subject and the body; neither may
// let it inject a header line or markup.
func TestBuildEmailMessage_AccessRequestEscapesRequester(t *testing.T) {
	requester := "a<b>@example.com\r\nBcc: x@evil.test"
	msg := render(t, "admin@example.com", accessRequestEmail(requester, "https://app.pfm.local/approve-access?token=t"))

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

// Every template renders with its heading, button and link.
func TestBuildEmailMessage_AllTemplatesRender(t *testing.T) {
	const link = "https://app.pfm.local/activate?token=x"
	for name, email := range map[string]emailContent{
		"activation":      activationEmail(link),
		"access approved": accessApprovedEmail(link),
		"access request":  accessRequestEmail("a@example.com", link),
		"wallet invite":   walletInviteEmail("An", "Chi tiêu nhà", link),
	} {
		msg := render(t, "user@example.com", email)
		for _, want := range []string{link, email.ButtonLabel, email.Heading} {
			if !strings.Contains(msg, want) {
				t.Errorf("%s: missing %q", name, want)
			}
		}
	}
}
