-- Feature-12 US-06 Plan an Intended Purchase via Chat
-- (specs/ai-chat-spending-intentions/, plan.md Domain objects).
--
-- One row per thing the User plans to spend on: "niềng răng trả góp 12 tháng",
-- "mua nước hoa". Money is BIGINT xu (never float). Soft-deleted via
-- deleted_at, like every record the User can edit (a deleted intention stops
-- counting in the figures of the others, which every read derives live).
-- Every figure shown next to an intention (what a Budget has left, the usual
-- surplus) is computed at read time and never stored.
--
-- Additive and idempotent, same convention as 022-037.

CREATE TABLE IF NOT EXISTS spending_intentions (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id            UUID NOT NULL REFERENCES users(id),
    title              TEXT NOT NULL,
    kind               TEXT NOT NULL,
    category_id        UUID REFERENCES categories(id),
    currency           TEXT NOT NULL,
    -- one_time: the price, NULL while unknown. installment: the total.
    total_amount       BIGINT,
    -- installment only: what one month pays.
    monthly_amount     BIGINT,
    installment_months INT,
    -- First day of the local month the first (or only) payment falls in.
    target_month       DATE NOT NULL,
    note               TEXT,
    -- One per saved card, so a repeated save keeps one row.
    idempotency_key    TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at         TIMESTAMPTZ,
    CONSTRAINT chk_spending_intentions_kind CHECK (kind IN ('one_time', 'installment')),
    CONSTRAINT chk_spending_intentions_amounts CHECK (
        (total_amount IS NULL OR total_amount > 0) AND (monthly_amount IS NULL OR monthly_amount > 0)
    ),
    CONSTRAINT chk_spending_intentions_shape CHECK (
        (kind = 'one_time' AND monthly_amount IS NULL AND installment_months IS NULL)
        OR (kind = 'installment' AND monthly_amount IS NOT NULL AND installment_months >= 2)
    )
);

-- The list and every figure that sums the other intentions of a month.
CREATE INDEX IF NOT EXISTS idx_spending_intentions_user_month
    ON spending_intentions (user_id, target_month, created_at)
    WHERE deleted_at IS NULL;

-- Race guard behind the idempotent create: the service looks the key up first,
-- this keeps two concurrent saves of one card from both inserting.
CREATE UNIQUE INDEX IF NOT EXISTS uq_spending_intentions_user_key
    ON spending_intentions (user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
