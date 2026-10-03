-- Emails are case-insensitive: User@gmail.com and user@gmail.com are the same
-- inbox, but `email = $1` plus the plain unique index from 001_init.sql
-- treated them as two accounts — an admin could invite both, and a user who
-- typed their address with a capital letter at login got INVALID_CREDENTIALS.
--
-- The fix is "store lowercase, always" rather than lower() on every lookup:
-- UserService/AuthService/cmd/seed now normalize before touching the DB
-- (common.NormalizeEmail), so the existing `email = $1` queries and the
-- existing unique index (which SeedAdminUser's ON CONFLICT (email) targets)
-- keep working unchanged. The CHECK below makes that invariant the database's
-- job, so a future write path that forgets to normalize fails loudly instead
-- of quietly re-creating the duplicate.
--
-- If two non-deleted rows differ only by case, the UPDATE hits
-- idx_users_email_active_unique and this migration fails, which fails the
-- deploy. That is deliberate: which of the two accounts survives is a human
-- decision, not something to guess here.
UPDATE users
SET email = lower(email), updated_at = NOW()
WHERE email <> lower(email);

ALTER TABLE users ADD CONSTRAINT users_email_lowercase CHECK (email = lower(email));
