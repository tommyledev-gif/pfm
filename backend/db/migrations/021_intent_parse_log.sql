-- Feature-12 US-03 Query Spending via Chat (specs/ai-chat-query-spending/,
-- plan.md Domain objects / US-07) — one row per free-text analytics question:
-- how it was interpreted, by which path, and how long it took. The only way
-- to learn which questions users actually ask, and whether the AI provider's
-- token accounting matches its documentation.
--
-- NO deleted_at, and rows ARE hard-deleted: this is not a financial record.
-- Retention (raw_text cleared after 30 days, whole row deleted after 12
-- months) is a privacy requirement, enforced by the backend scheduler. No
-- endpoint reads this table.
-- IF NOT EXISTS throughout, same re-runnable convention as 018.
CREATE TABLE IF NOT EXISTS intent_parse_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id),
    -- Original text. Cleared to NULL once past raw retention.
    raw_text        TEXT,
    -- Accent-stripped, pronoun-stripped form; kept longer than raw_text.
    normalized_text TEXT NOT NULL,
    parsed_intent   JSONB NOT NULL,
    method          TEXT NOT NULL,
    kind            TEXT NOT NULL,
    outcome         TEXT NOT NULL,
    confidence      REAL,
    latency_ms      INT NOT NULL,
    token_in        INT,
    token_out       INT,
    cached_tokens   INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_intent_parse_log_method CHECK (method IN ('chip', 'drilldown', 'regex', 'llm')),
    CONSTRAINT chk_intent_parse_log_outcome CHECK (outcome IN ('answered', 'clarify', 'unsupported', 'degraded', 'error'))
);

-- Backs the retention purge (WHERE created_at < cutoff).
CREATE INDEX IF NOT EXISTS idx_intent_parse_log_created_at ON intent_parse_log (created_at);
