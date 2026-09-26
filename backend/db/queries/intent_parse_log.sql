-- Feature-12 US-03 question log (specs/ai-chat-query-spending/plan.md
-- AIQ-T13). Append-only from the request path; the two retention statements
-- run from the backend scheduler. No query here is ever exposed through an
-- endpoint (spec.md S-AIQ-47).

-- name: InsertIntentParseLog :exec
INSERT INTO intent_parse_log (
    user_id, raw_text, normalized_text, parsed_intent, method, kind, outcome,
    confidence, latency_ms, token_in, token_out, cached_tokens
) VALUES (
    @user_id, @raw_text, @normalized_text, @parsed_intent, @method, @kind, @outcome,
    sqlc.narg('confidence'), @latency_ms, sqlc.narg('token_in'), sqlc.narg('token_out'), sqlc.narg('cached_tokens')
);

-- name: ClearExpiredIntentLogRawText :execrows
-- Privacy: the original wording goes first (spec.md S-AIQ-46).
UPDATE intent_parse_log
SET raw_text = NULL
WHERE raw_text IS NOT NULL
  AND created_at < @cutoff::timestamptz;

-- name: DeleteExpiredIntentLogs :execrows
DELETE FROM intent_parse_log
WHERE created_at < @cutoff::timestamptz;
