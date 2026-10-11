-- Items and Adjustments of a Transaction (specs/transaction-line-items/).
-- One table for both: kind 'item' is a line of what was bought or received;
-- 'tax' / 'fee' / 'discount' / 'other' are Adjustments explaining why the
-- Items do not add up to transactions.amount. The service enforces
-- items + adding adjustments - subtracting adjustments = transactions.amount.
--
-- Lines are detail, never money movement: no aggregate reads this table, and
-- reports/budgets keep summing transactions.amount by transactions.category_id.
--
-- Soft delete only: an edit retires the whole active list (deleted_at) and
-- inserts the new one, so earlier versions survive (spec BR-12). A deleted
-- Transaction keeps its lines untouched.
--
-- Purely additive: nothing existing reads this table, so it is safe to apply
-- before or after the backend that uses it. Applied by cmd/migrate.
-- Idempotent, same convention as 026.

CREATE TABLE IF NOT EXISTS transaction_lines (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    -- Denormalized from transactions.user_id so every read filters by user_id
    -- directly (CLAUDE.md user-isolation rule), same as transaction_audit_logs.
    user_id        UUID NOT NULL REFERENCES users(id),
    position       SMALLINT NOT NULL CHECK (position >= 0),
    kind           TEXT NOT NULL CHECK (kind IN ('item', 'tax', 'fee', 'discount', 'other')),
    -- +1 adds to the Items total, -1 subtracts. Items always +1.
    sign           SMALLINT NOT NULL CHECK (sign IN (1, -1)),
    -- Item name, or the label of an Adjustment (required for 'other').
    name           TEXT NULL,
    quantity       INTEGER NULL,
    -- Money: BIGINT minor units of the parent Transaction's Wallet currency.
    unit_price     BIGINT NULL CHECK (unit_price IS NULL OR unit_price > 0),
    amount         BIGINT NOT NULL CHECK (amount > 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at     TIMESTAMPTZ NULL
);

ALTER TABLE transaction_lines DROP CONSTRAINT IF EXISTS transaction_lines_item_check;
ALTER TABLE transaction_lines ADD CONSTRAINT transaction_lines_item_check
    CHECK (kind <> 'item' OR (name IS NOT NULL AND quantity >= 1 AND sign = 1));

ALTER TABLE transaction_lines DROP CONSTRAINT IF EXISTS transaction_lines_adjustment_check;
ALTER TABLE transaction_lines ADD CONSTRAINT transaction_lines_adjustment_check
    CHECK (kind = 'item' OR (quantity IS NULL AND unit_price IS NULL));

ALTER TABLE transaction_lines DROP CONSTRAINT IF EXISTS transaction_lines_sign_check;
ALTER TABLE transaction_lines ADD CONSTRAINT transaction_lines_sign_check
    CHECK (
        (kind IN ('tax', 'fee') AND sign = 1)
        OR (kind = 'discount' AND sign = -1)
        OR kind IN ('item', 'other')
    );

ALTER TABLE transaction_lines DROP CONSTRAINT IF EXISTS transaction_lines_other_label_check;
ALTER TABLE transaction_lines ADD CONSTRAINT transaction_lines_other_label_check
    CHECK (kind <> 'other' OR name IS NOT NULL);

-- Serves "active lines of one Transaction, in order" and the per-page count.
CREATE INDEX IF NOT EXISTS idx_transaction_lines_active
    ON transaction_lines (transaction_id, position) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transaction_lines_user_id
    ON transaction_lines (user_id);
