package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
)

const insertIntentParseLog = `-- name: InsertIntentParseLog :exec
INSERT INTO intent_parse_log (
    user_id, raw_text, normalized_text, parsed_intent, method, kind, outcome,
    confidence, latency_ms, token_in, token_out, cached_tokens
) VALUES (
    $1, $2, $3, $4, $5, $6, $7,
    $8, $9, $10, $11, $12
)
`

type InsertIntentParseLogParams struct {
	UserID         uuid.UUID
	RawText        *string
	NormalizedText string
	ParsedIntent   []byte
	Method         string
	Kind           string
	Outcome        string
	Confidence     *float32
	LatencyMs      int32
	TokenIn        *int32
	TokenOut       *int32
	CachedTokens   *int32
}

// InsertIntentParseLog appends one free-text question record
// (specs/ai-chat-query-spending/plan.md AIQ-T13).
func (q *Queries) InsertIntentParseLog(ctx context.Context, arg InsertIntentParseLogParams) error {
	_, err := q.db.Exec(ctx, insertIntentParseLog,
		arg.UserID, arg.RawText, arg.NormalizedText, arg.ParsedIntent, arg.Method, arg.Kind, arg.Outcome,
		arg.Confidence, arg.LatencyMs, arg.TokenIn, arg.TokenOut, arg.CachedTokens,
	)
	return err
}

const clearExpiredIntentLogRawText = `-- name: ClearExpiredIntentLogRawText :execrows
UPDATE intent_parse_log
SET raw_text = NULL
WHERE raw_text IS NOT NULL
  AND created_at < $1::timestamptz
`

// ClearExpiredIntentLogRawText drops the original wording past raw
// retention (spec.md S-AIQ-46).
func (q *Queries) ClearExpiredIntentLogRawText(ctx context.Context, cutoff time.Time) (int64, error) {
	result, err := q.db.Exec(ctx, clearExpiredIntentLogRawText, cutoff)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

const deleteExpiredIntentLogs = `-- name: DeleteExpiredIntentLogs :execrows
DELETE FROM intent_parse_log
WHERE created_at < $1::timestamptz
`

// DeleteExpiredIntentLogs removes rows past full retention.
func (q *Queries) DeleteExpiredIntentLogs(ctx context.Context, cutoff time.Time) (int64, error) {
	result, err := q.db.Exec(ctx, deleteExpiredIntentLogs, cutoff)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}
