package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// IntentParseLogRepository appends and purges the free-text question log
// (specs/ai-chat-query-spending/plan.md AIQ-T13/T14). Nothing reads it back
// through the app (spec.md S-AIQ-47).
type IntentParseLogRepository struct {
	q *sqlc.Queries
}

func NewIntentParseLogRepository(q *sqlc.Queries) *IntentParseLogRepository {
	return &IntentParseLogRepository{q: q}
}

func (r *IntentParseLogRepository) Insert(ctx context.Context, entry model.IntentParseLog) error {
	raw := entry.RawText
	if err := r.q.InsertIntentParseLog(ctx, sqlc.InsertIntentParseLogParams{
		UserID: entry.UserID, RawText: &raw, NormalizedText: entry.NormalizedText,
		ParsedIntent: entry.ParsedIntent, Method: entry.Method, Kind: entry.Kind, Outcome: entry.Outcome,
		Confidence: entry.Confidence, LatencyMs: entry.LatencyMs,
		TokenIn: entry.TokenIn, TokenOut: entry.TokenOut, CachedTokens: entry.CachedTokens,
	}); err != nil {
		return fmt.Errorf("repository.InsertIntentParseLog: %w", err)
	}
	return nil
}

// ClearRawTextBefore and DeleteBefore back the retention job; each returns
// the number of rows it touched, for the job's log line.
func (r *IntentParseLogRepository) ClearRawTextBefore(ctx context.Context, cutoff time.Time) (int64, error) {
	n, err := r.q.ClearExpiredIntentLogRawText(ctx, cutoff)
	if err != nil {
		return 0, fmt.Errorf("repository.ClearRawTextBefore: %w", err)
	}
	return n, nil
}

func (r *IntentParseLogRepository) DeleteBefore(ctx context.Context, cutoff time.Time) (int64, error) {
	n, err := r.q.DeleteExpiredIntentLogs(ctx, cutoff)
	if err != nil {
		return 0, fmt.Errorf("repository.DeleteBefore: %w", err)
	}
	return n, nil
}
