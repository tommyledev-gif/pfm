package service

import (
	"context"
	"time"

	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
)

// IntentLogRetention enforces the question log's privacy retention
// (specs/ai-chat-query-spending/spec.md US-07): original wording cleared
// first, whole rows deleted later. Invoked on a ticker from main.go, never
// from a request; each statement is idempotent, so a missed or doubled tick
// is harmless.
type IntentLogRetention struct {
	logs   IntentParseLogRepo
	logger *zap.Logger
	now    func() time.Time
}

func NewIntentLogRetention(logs IntentParseLogRepo, logger *zap.Logger) *IntentLogRetention {
	return &IntentLogRetention{logs: logs, logger: logger, now: time.Now}
}

// Purge runs one retention pass. Failures are logged (never with question
// text) and retried on the next tick — there is no caller to return to.
func (r *IntentLogRetention) Purge(ctx context.Context) {
	now := r.now()
	cleared, err := r.logs.ClearRawTextBefore(ctx, now.Add(-common.IntentLogRawRetention))
	if err != nil {
		r.logger.Error("intent log retention: clearing raw text failed", zap.Error(err))
		return
	}
	deleted, err := r.logs.DeleteBefore(ctx, now.Add(-common.IntentLogRetention))
	if err != nil {
		r.logger.Error("intent log retention: deleting expired rows failed", zap.Error(err))
		return
	}
	r.logger.Info("intent log retention done", zap.Int64("raw_text_cleared", cleared), zap.Int64("rows_deleted", deleted))
}
