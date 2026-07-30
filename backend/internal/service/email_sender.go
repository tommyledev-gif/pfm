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
