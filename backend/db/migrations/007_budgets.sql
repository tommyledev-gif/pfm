CREATE TABLE budgets (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id),
    category_id UUID NOT NULL REFERENCES categories(id),
    period      TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly')),
    start_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

-- Source of truth for "at most one active Budget per (user, category)"
-- (specs/budget-management/spec.md Business invariants / S-BUD-11, S-BUD-13)
-- — enforced at the DB level, same precedent as wallets' one-default index
-- and categories' name/type duplicate index, so two concurrent creates for
-- the same category can never both land.
CREATE UNIQUE INDEX idx_budgets_one_active_per_user_category ON budgets (user_id, category_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_budgets_user_id ON budgets (user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_budgets_category_id ON budgets (category_id) WHERE deleted_at IS NULL;

-- Per-currency limits (specs/budget-management/spec.md Domain Fields /
-- plan.md Finding #4 — a child table, not JSONB, to keep sqlc's typed-Go
-- generation working). ON DELETE CASCADE is a referential-integrity safety
-- net only: application code never hard-deletes a budgets row (soft delete
-- only, CLAUDE.md), so this never fires in normal operation.
CREATE TABLE budget_limits (
    budget_id    UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    currency     TEXT NOT NULL CHECK (currency IN ('VND', 'USD')),
    amount_limit BIGINT NOT NULL CHECK (amount_limit > 0),
    PRIMARY KEY (budget_id, currency)
);
