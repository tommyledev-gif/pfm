-- Resend invitation (POST /admin/users/:id/resend-invite). The cooldown is
-- measured from the last email actually sent, and gets longer after the
-- first resend (common.InviteResendAvailableAt), so both need storing:
--   invite_sent_at      — when the current invite email was dispatched
--   invite_resend_count — how many times it has been resent (0 = original)
ALTER TABLE users
    ADD COLUMN invite_sent_at      TIMESTAMPTZ NULL,
    ADD COLUMN invite_resend_count INT NOT NULL DEFAULT 0;

-- Invites created before this column existed were sent at creation time.
UPDATE users SET invite_sent_at = created_at WHERE status = 'pending';
