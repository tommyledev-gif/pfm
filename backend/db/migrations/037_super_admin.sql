-- Super admin (2026-10-24): one flag above the admin role. A super admin
-- finds any account from Thành viên, inside their household or not, and can
-- soft-delete it — the deletion tool that used to sit on the Security screen,
-- open until now only to ACCOUNT_DELETION_OPERATOR_EMAIL (which still works).
-- Checked on top of the admin role gate, so it does nothing on a member.
--
-- Additive and idempotent, same convention as 022-036.

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- The first super admin, made an admin too so the flag can take effect.
-- A no-op where the account does not exist (a fresh database).
UPDATE users
SET is_super_admin = true, role = 'admin', updated_at = NOW()
WHERE lower(email) = 'owner@example.com'
  AND deleted_at IS NULL;
