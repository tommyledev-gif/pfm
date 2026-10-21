-- Shared wallets (specs/shared-wallets): the owner of a wallet invites other
-- accounts to it, so a household keeps one book of income and spending.
--
-- The owner is wallets.user_id and never has a row here. A member row is
--
--   pending --(invitee accepts)--> active
--      \--(declined / cancelled / removed / left)--> removed_at set
--
-- Rows are never deleted: a removed membership keeps who was invited, by whom
-- and when. Transactions never point at a membership, so removing a member
-- cannot touch any financial record (spec BR-08); it only ends their access.
--
-- role: 'editor' records into the wallet, 'viewer' only sees it.
--
-- Additive and idempotent, same convention as 022-034.

CREATE TABLE IF NOT EXISTS wallet_members (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id   UUID NOT NULL REFERENCES wallets(id),
    user_id     UUID NOT NULL REFERENCES users(id),
    role        TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
    invited_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ NULL,
    removed_at  TIMESTAMPTZ NULL
);

-- One live membership per (wallet, user). This index, not application code,
-- is what makes two identical invitations racing each other end with one row
-- and one 409 (spec S-SHW-08).
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_members_live
    ON wallet_members (wallet_id, user_id)
    WHERE removed_at IS NULL;

-- "Which wallets is this account in / invited to" — the wallet list and the
-- invitation list both start from the user.
CREATE INDEX IF NOT EXISTS idx_wallet_members_user_live
    ON wallet_members (user_id)
    WHERE removed_at IS NULL;
