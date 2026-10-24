package service

import (
	"context"
	"fmt"
	"net/smtp"
	"net/url"
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
	// AppBaseURL is the origin the email links point at: the backend serves
	// /activate and /approve-access itself (handler.ActivatePageHandler).
	AppBaseURL string
}

// SMTPEmailSender sends the account emails over real SMTP (Gmail: smtp.gmail.com:587
// with an App Password — Gmail rejects the account's normal password for SMTP auth
// once 2FA is enabled). Replaces LogEmailSender once SMTP_HOST is configured
// (see cmd/server/main.go).
type SMTPEmailSender struct {
	cfg SMTPConfig
}

func NewSMTPEmailSender(cfg SMTPConfig) *SMTPEmailSender {
	return &SMTPEmailSender{cfg: cfg}
}

// SendActivationEmail implements EmailSender: the invite an admin sent.
func (s *SMTPEmailSender) SendActivationEmail(ctx context.Context, toEmail, inviteToken string) error {
	email := activationEmail(s.link("/activate", inviteToken))
	if err := s.send(ctx, toEmail, email); err != nil {
		return fmt.Errorf("service.SMTPEmailSender.SendActivationEmail: %w", err)
	}
	return nil
}

// SendAccessRequestEmail implements EmailSender: asks an admin to approve.
func (s *SMTPEmailSender) SendAccessRequestEmail(ctx context.Context, adminEmail, requesterEmail, approvalToken string) error {
	email := accessRequestEmail(requesterEmail, s.link("/approve-access", approvalToken))
	if err := s.send(ctx, adminEmail, email); err != nil {
		return fmt.Errorf("service.SMTPEmailSender.SendAccessRequestEmail: %w", err)
	}
	return nil
}

// SendAccessApprovedEmail implements EmailSender: the request was approved,
// and the next step is the same activation link an invite carries.
func (s *SMTPEmailSender) SendAccessApprovedEmail(ctx context.Context, toEmail, inviteToken string) error {
	email := accessApprovedEmail(s.link("/activate", inviteToken))
	if err := s.send(ctx, toEmail, email); err != nil {
		return fmt.Errorf("service.SMTPEmailSender.SendAccessApprovedEmail: %w", err)
	}
	return nil
}

// SendPasswordResetCode implements EmailSender: the forgot-password code.
func (s *SMTPEmailSender) SendPasswordResetCode(ctx context.Context, toEmail, code string) error {
	if err := s.send(ctx, toEmail, passwordResetEmail(code)); err != nil {
		return fmt.Errorf("service.SMTPEmailSender.SendPasswordResetCode: %w", err)
	}
	return nil
}

func (s *SMTPEmailSender) link(path, token string) string {
	return fmt.Sprintf("%s%s?token=%s", s.cfg.AppBaseURL, path, url.QueryEscape(token))
}

// send delivers one message. Gmail's SMTP server advertises STARTTLS on port
// 587; net/smtp.SendMail upgrades the connection automatically when the
// server offers it, so no manual TLS dialing is needed here.
func (s *SMTPEmailSender) send(ctx context.Context, toEmail string, email emailContent) error {
	msg, err := buildEmailMessage(s.cfg.FromEmail, s.cfg.FromName, toEmail, email)
	if err != nil {
		return err
	}
	addr := fmt.Sprintf("%s:%s", s.cfg.Host, s.cfg.Port)
	auth := smtp.PlainAuth("", s.cfg.Username, s.cfg.Password, s.cfg.Host)

	// net/smtp has no context-aware variant; run it on a goroutine so the
	// caller's timeout (common.EmailDispatchTimeout) is still honored even
	// though the underlying dial/write can't itself be cancelled mid-flight.
	done := make(chan error, 1)
	go func() { done <- smtp.SendMail(addr, auth, s.cfg.FromEmail, []string{toEmail}, msg) }()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-done:
		return err
	}
}
