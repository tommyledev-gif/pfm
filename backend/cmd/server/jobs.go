package main

import (
	"context"
	"time"

	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/service"
)

// runNotificationScheduler runs NotificationService.EvaluateBudgets on a
// fixed interval until ctx is cancelled. A ticker, not a one-shot timer
// loop, so a slow evaluation never causes ticks to pile up.
func runNotificationScheduler(ctx context.Context, notificationService *service.NotificationService, logger *zap.Logger) {
	ticker := time.NewTicker(common.NotificationJobInterval)
	defer ticker.Stop()

	logger.Info("notification scheduler started", zap.Duration("interval", common.NotificationJobInterval))
	for {
		select {
		case <-ctx.Done():
			logger.Info("notification scheduler stopped")
			return
		case <-ticker.C:
			notificationService.EvaluateBudgets(ctx)
		}
	}
}

// runTokenRetention deletes finished session rows and expired deny-list rows
// (service.TokenRetention) at startup and then on a fixed interval.
func runTokenRetention(ctx context.Context, retention *service.TokenRetention, logger *zap.Logger) {
	ticker := time.NewTicker(common.TokenPurgeInterval)
	defer ticker.Stop()

	retention.Purge(ctx)
	for {
		select {
		case <-ctx.Done():
			logger.Info("token retention stopped")
			return
		case <-ticker.C:
			retention.Purge(ctx)
		}
	}
}

// runIntentLogRetention applies the question log's privacy retention
// (specs/ai-chat-query-spending/spec.md US-07) once at startup and then on a
// fixed interval — at startup too, so a backend that restarts more often
// than the interval still purges.
func runIntentLogRetention(ctx context.Context, retention *service.IntentLogRetention, logger *zap.Logger) {
	ticker := time.NewTicker(common.IntentLogPurgeInterval)
	defer ticker.Stop()

	retention.Purge(ctx)
	for {
		select {
		case <-ctx.Done():
			logger.Info("intent log retention stopped")
			return
		case <-ticker.C:
			retention.Purge(ctx)
		}
	}
}
