CREATE TABLE revoked_tokens (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_jti  TEXT UNIQUE NOT NULL,
    user_id    UUID REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No soft delete here (not a financial record) — expired rows are inert and
-- may be hard-deleted by a periodic cleanup job (see plan.md Open Task SEC-T1).
CREATE INDEX idx_revoked_tokens_expires_at ON revoked_tokens (expires_at);
