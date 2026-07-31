package service

import (
	"context"
	"fmt"
	"net/smtp"
)

// SMTPConfig is the subset of config.Config the SMTP sender needs — passed
// as a plain struct rather than *config.Config so this file has zero import
// on the config package (mirrors CLAUDE.md's model-layer isolation rule,
// applied here to keep the sender trivially unit-testable).
type SMTPConfig struct {
	Host      string
	Port      string
	Username  string
	Password  string
	FromEmail string
	FromName  string
	// AppBaseURL is the web frontend origin the activation link points at.
	AppBaseURL string
}

// SMTPEmailSender sends the activation email over real SMTP (Gmail: smtp.gmail.com:587
// with an App Password — Gmail rejects the account's normal password for SMTP auth
// once 2FA is enabled). Replaces LogEmailSender once SMTP_HOST is configured
// (see cmd/server/main.go).
type SMTPEmailSender struct {
	cfg SMTPConfig
}

func NewSMTPEmailSender(cfg SMTPConfig) *SMTPEmailSender {
	return &SMTPEmailSender{cfg: cfg}
}

// SendActivationEmail implements EmailSender. Gmail's SMTP server advertises
// STARTTLS on port 587; net/smtp.SendMail upgrades the connection automatically
// when the server offers it, so no manual TLS dialing is needed here.
func (s *SMTPEmailSender) SendActivationEmail(ctx context.Context, toEmail, inviteToken string) error {
	activationLink := fmt.Sprintf("%s/activate?token=%s", s.cfg.AppBaseURL, inviteToken)
	msg := buildActivationEmailMessage(s.cfg.FromEmail, s.cfg.FromName, toEmail, activationLink)

	addr := fmt.Sprintf("%s:%s", s.cfg.Host, s.cfg.Port)
	auth := smtp.PlainAuth("", s.cfg.Username, s.cfg.Password, s.cfg.Host)

	// net/smtp has no context-aware variant; run it on a goroutine so the
	// caller's timeout (common.EmailDispatchTimeout, set by
	// UserService.dispatchActivationEmail) is still honored even though the
	// underlying dial/write can't itself be cancelled mid-flight.
	done := make(chan error, 1)
	go func() { done <- smtp.SendMail(addr, auth, s.cfg.FromEmail, []string{toEmail}, msg) }()

	select {
	case <-ctx.Done():
		return fmt.Errorf("service.SMTPEmailSender.SendActivationEmail: %w", ctx.Err())
	case err := <-done:
		if err != nil {
			return fmt.Errorf("service.SMTPEmailSender.SendActivationEmail: %w", err)
		}
		return nil
	}
}

// buildActivationEmailMessage is a pure function so the message format is
// unit-testable without a real SMTP connection.
func buildActivationEmailMessage(fromEmail, fromName, toEmail, activationLink string) []byte {
	const subject = "Activate your PFM account"

	headers := fmt.Sprintf(
		"From: %s <%s>\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=\"UTF-8\"\r\n\r\n",
		fromName, fromEmail, toEmail, subject,
	)

	body := fmt.Sprintf(`<html><body style="font-family:sans-serif">
<h2>Welcome to PFM</h2>
<p>You've been invited to PFM — Personal Finance Management. Click below to activate your account:</p>
<p><a href="%s" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">Activate account</a></p>
<p>Or copy this link into your browser:<br><a href="%s">%s</a></p>
<p style="color:#666;font-size:12px">This link expires in 72 hours. If you didn't expect this invite, you can ignore this email.</p>
</body></html>`, activationLink, activationLink, activationLink)

	return []byte(headers + body)
}
