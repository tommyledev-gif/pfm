package service

import (
	"context"

	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
)

// EmailSender is the fire-and-forget dispatch boundary for the activation
// email (plan.md US-01 Main Flow step 7). The actual provider (SMTP vs. a
// transactional API) is unresolved — spec.md Open Question #2 — so this
// interface lets UserService depend on the contract, not the provider;
// swapping providers later never touches UserService.
type EmailSender interface {
	SendActivationEmail(ctx context.Context, toEmail, inviteToken string) error
	// SendAccessRequestEmail asks adminEmail to approve requesterEmail's
	// access request (mig 031) through a one-time approval link.
	SendAccessRequestEmail(ctx context.Context, adminEmail, requesterEmail, approvalToken string) error
	// SendAccessApprovedEmail tells the requester their request was approved;
	// it carries the same activation link an invite does.
	SendAccessApprovedEmail(ctx context.Context, toEmail, inviteToken string) error
}

// LogEmailSender is a placeholder implementation: it logs that an email
// *would* be sent and returns success. It exists so the invite flow is
// runnable before a real provider is chosen — replace with a real SMTP/API
// client once spec.md Open Question #2 is resolved (plan.md Open Task USR-T12).
type LogEmailSender struct {
	logger *zap.Logger
}

func NewLogEmailSender(logger *zap.Logger) *LogEmailSender {
	return &LogEmailSender{logger: logger}
}

func (s *LogEmailSender) SendActivationEmail(_ context.Context, toEmail, _ string) error {
	// Never log the raw invite token (spec.md DoD) or the full email.
	s.logger.Info("activation email dispatched (placeholder sender)",
		zap.String("email", common.MaskEmail(toEmail)),
	)
	return nil
}

func (s *LogEmailSender) SendAccessRequestEmail(_ context.Context, adminEmail, _, _ string) error {
	s.logger.Info("access request email dispatched (placeholder sender)",
		zap.String("email", common.MaskEmail(adminEmail)),
	)
	return nil
}

func (s *LogEmailSender) SendAccessApprovedEmail(_ context.Context, toEmail, _ string) error {
	s.logger.Info("access approved email dispatched (placeholder sender)",
		zap.String("email", common.MaskEmail(toEmail)),
	)
	return nil
}
