-- Server-side sessions: one row per signed-in device.
--
-- Until now a session was only a pair of stateless JWTs plus a deny-list of
-- revoked refresh jtis, so the server could neither count a user's devices nor
-- end one instantly. This table makes a session a thing the server knows:
--
--   * concurrent session limit: starting a 6th session revokes the least
--     recently used one (common.SessionMaxActive);
--   * instant revocation: JWTAuth looks the session up on every request, so a
--     revoked, expired or disabled-user session stops working at once instead
--     of when its 15-minute access token runs out;
--   * refresh-token reuse detection: only the newest refresh jti (and, for a
--     short grace window, the one before it) is valid. A jti presented any
--     other time means a stolen copy is being replayed, and the whole session
--     is revoked;
--   * absolute lifetime: absolute_expires_at never moves, however often the
--     session is refreshed.
--
-- Access and refresh tokens carry this row's id as their `sid` claim. A
-- forged token with a guessed JWT secret still fails: it needs a live
-- (user_id, sid) pair.
--
-- expires_at is the idle expiry: the current refresh token's `exp`, pushed
-- forward on every refresh but never past absolute_expires_at.
--
-- ⚠️ Apply BEFORE the backend that reads this table starts (login and every
-- authenticated request query it). Deploy: cmd/migrate (backend/deploy.sh)
-- applies it before `up -d`. Idempotent, same convention as 022-027.

CREATE TABLE IF NOT EXISTS sessions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id),
    refresh_jti         TEXT NOT NULL,
    prev_refresh_jti    TEXT NULL,
    rotated_at          TIMESTAMPTZ NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ NOT NULL,
    absolute_expires_at TIMESTAMPTZ NOT NULL,
    revoked_at          TIMESTAMPTZ NULL,
    revoked_reason      TEXT NULL
);

-- Counting and evicting a user's live sessions.
CREATE INDEX IF NOT EXISTS idx_sessions_user_active
    ON sessions (user_id, last_used_at DESC)
    WHERE revoked_at IS NULL;

-- The retention job's range scan.
CREATE INDEX IF NOT EXISTS idx_sessions_absolute_expires_at
    ON sessions (absolute_expires_at);
