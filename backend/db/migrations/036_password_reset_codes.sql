-- Forgot password (specs/forgot-password): a 6-digit code emailed to the
-- account, entered in the app with a new password.
--
-- code_hash is HMAC-SHA256 under a server key, never the digits: a copy of
-- this table alone does not give anyone a usable code. A code is live while
-- used_at and revoked_at are NULL and expires_at is in the future. A newer
-- code, or the 5th wrong try, sets revoked_at. Rows are hard-deleted after a
-- day by the token retention job: they are credentials, not financial records.
--
-- Additive and idempotent, same convention as 022-035.

CREATE TABLE IF NOT EXISTS password_reset_codes (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id),
    code_hash  TEXT NOT NULL,
    attempts   INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ NULL,
    revoked_at TIMESTAMPTZ NULL
);

-- The newest code of a user (live-code lookup, 60 s cooldown, hourly cap).
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_user_created
    ON password_reset_codes (user_id, created_at DESC);

-- Retention: rows older than a day.
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_created
    ON password_reset_codes (created_at);
