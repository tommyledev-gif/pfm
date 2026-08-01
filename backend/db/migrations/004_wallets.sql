CREATE TABLE wallets (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id),
    name        TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'e_wallet', 'other')),
    balance     BIGINT NOT NULL DEFAULT 0,
    currency    TEXT NOT NULL DEFAULT 'VND' CHECK (currency IN ('VND', 'USD')),
    is_default  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

-- Source of truth for "at most one default wallet per user" (plan.md
-- Finding #9 / spec.md S-WAL-10, S-WAL-29) — enforced at the DB level so two
-- concurrent requests can never both leave a default set, not just relying
-- on service-level ordering.
CREATE UNIQUE INDEX idx_wallets_one_default_per_user ON wallets (user_id)
    WHERE is_default = true AND deleted_at IS NULL;

CREATE INDEX idx_wallets_user_id ON wallets (user_id) WHERE deleted_at IS NULL;
