CREATE TABLE transactions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id),
    wallet_id   UUID NOT NULL REFERENCES wallets(id),
    category_id UUID NOT NULL REFERENCES categories(id),
    amount      BIGINT NOT NULL CHECK (amount > 0),
    type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    note        TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

-- Deliberately no CHECK(balance >= 0)-equivalent constraint exists here or on
-- wallets (specs/transaction-management/plan.md Finding #4) — the
-- insufficient-balance floor is enforced only by the conditional
-- DecrementWalletBalanceIfSufficient query at Create time, never at the
-- schema level, so Update/Delete's spec-mandated negative-balance-allowed
-- scenarios (S-TRX-38, S-TRX-50) are never blocked by a constraint added here.

CREATE INDEX idx_transactions_user_id ON transactions (user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_wallet_id ON transactions (wallet_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_category_id ON transactions (category_id) WHERE deleted_at IS NULL;

-- Serves both the cursor-paginated list query (occurred_at DESC, id DESC —
-- specs/transaction-management/spec.md Edge Cases US-02 #1) and, via its
-- leading user_id column, the F-05 spend-aggregation query
-- (SumExpenseByUserCurrentPeriod).
CREATE INDEX idx_transactions_user_occurred_at ON transactions (user_id, occurred_at DESC, id DESC)
    WHERE deleted_at IS NULL;
