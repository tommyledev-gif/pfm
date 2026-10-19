-- Device-bound sessions: a session now knows which phone it lives on.
--
-- The app generates a random device id once and sends it, with a device name,
-- on every request (X-Device-Id / X-Device-Name). With it:
--
--   * one live session per (user, device): signing in again on the same phone
--     revokes that user's previous session there (revoked_reason 'replaced')
--     instead of piling up rows until the 5-session cap evicts something;
--   * every account saved on a phone keeps its own session there, so the
--     Security screen can list "Thiết bị đang đăng nhập" and sign one device
--     out (revoked_reason 'device_sign_out') — the saved account on that phone
--     then needs a password again;
--   * switching between saved accounts is a plain refresh of that account's
--     session, replacing the separate 180-day switch token.
--
-- device_id is NULL for sessions started before this migration (filled on
-- their next refresh, never overwritten) and for clients that send no header
-- (the web client, the browser activation page).
--
-- public_key is reserved for phase 2 (a key pair made in the phone's
-- Keystore at sign-in, each refresh signing a server challenge, so a copied
-- refresh token is useless off the phone). Nothing reads or writes it yet.
--
-- ⚠️ Apply BEFORE the backend that reads these columns starts (login and
-- every refresh write them). Idempotent, same convention as 022-032.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_id   UUID NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_name TEXT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS public_key  TEXT NULL;

-- Finding the user's live session on one device (replaced on sign-in).
CREATE INDEX IF NOT EXISTS idx_sessions_user_device_live
    ON sessions (user_id, device_id)
    WHERE revoked_at IS NULL AND device_id IS NOT NULL;
