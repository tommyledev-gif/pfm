-- Tên đăng nhập (username). Chosen once, on the activation page, and signs in
-- in place of the email. Separate from full_name (the display name), which
-- stays editable from the profile screen; username is never changed after.
--
-- Stored lowercase: 3-30 characters, a letter first, then letters, digits,
-- "." or "_", ending on a letter or digit, never two of "." "_" in a row.
-- AuthService validates the same rule first (common.ValidUsername) so a bad
-- one comes back as 400 INVALID_USERNAME, not a constraint error.
--
-- NULL for every account activated before this column existed: those sign in
-- with their email only.
--
-- ⚠️ Apply BEFORE the backend that reads this column starts (same as 027):
-- the users queries select it. Idempotent, same convention as 022-029.
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT NULL;

DO $$
BEGIN
    ALTER TABLE users ADD CONSTRAINT chk_users_username_format CHECK (
        username IS NULL
        OR (username ~ '^[a-z][a-z0-9._]{1,28}[a-z0-9]$' AND username !~ '[._]{2}')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Unique among live accounts, same partial-index shape as the email one.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_active_unique
    ON users (username)
    WHERE deleted_at IS NULL AND username IS NOT NULL;
