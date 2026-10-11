-- Access requests: someone without an account asks an admin for one from the
-- login screen. The request is a users row in the new status 'requested':
--
--   requested --(admin approves)--> pending --(activation link)--> active
--
-- From 'pending' on it is exactly an invited user (invite_token, 72h expiry,
-- resend), so approving reuses the invite path instead of a second one.
-- invited_by holds the admin the request was sent to.
--
-- approval_token: the credential behind the "Duyệt yêu cầu" link in the
-- admin's email (crypto/rand 32 bytes hex, like invite_token). Cleared on
-- approval, so a link works once.
--
-- notifications.related_user_id: the requester, on the admin's
-- 'access_request' notification, so the app can approve from it.
--
-- Additive except the status CHECK, which only widens. Idempotent.
-- The CHECK from 001_init.sql was declared inline, so its name is Postgres's
-- generated one (users_status_check). Found by definition rather than
-- trusted by name: if the name were different, a DROP ... IF EXISTS would
-- silently keep the old CHECK and every request insert would fail.
DO $$
DECLARE c RECORD;
BEGIN
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'users'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%status%'
          AND pg_get_constraintdef(oid) LIKE '%pending%'
    LOOP
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;
ALTER TABLE users ADD CONSTRAINT users_status_check
    CHECK (status IN ('requested', 'pending', 'active', 'disabled'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_token TEXT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_approval_token
    ON users (approval_token)
    WHERE approval_token IS NOT NULL;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_user_id UUID NULL REFERENCES users(id);
