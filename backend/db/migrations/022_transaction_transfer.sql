-- Transfers between the caller's own wallets: a third transaction type
-- alongside income/expense.
--
-- MODEL: one row per transfer, not an expense+income pair. `wallet_id` is the
-- source (money leaves it), the new `to_wallet_id` is the destination (money
-- arrives there). A pair of rows would show up in every income/expense report
-- as spending and earning that never happened, and the two halves could be
-- edited or deleted independently of each other.
--
-- CATEGORY: `category_id` stays NOT NULL. Every transfer points at one system
-- Category (system_key 'transfer', type 'transfer') that the service assigns
-- itself — the client never picks it. That keeps every existing INNER JOIN on
-- categories valid without making category_id nullable across the codebase.
-- The Category is kept out of category listings, budgets (expense-only) and
-- every income/expense aggregate by the queries themselves.
--
-- Idempotent, same as the rest of db/migrations.

-- 1. The destination wallet. NULL for income/expense.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS to_wallet_id UUID REFERENCES wallets(id);

-- 2. Allow the new type. The inline CHECKs from 005/008 were auto-named.
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
    CHECK (type IN ('income', 'expense', 'transfer'));

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_type_check;
ALTER TABLE categories ADD CONSTRAINT categories_type_check
    CHECK (type IN ('income', 'expense', 'transfer'));

-- 3. A transfer always has a destination, and only a transfer has one; it
--    can never point back at its own source.
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_transfer_wallets_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_transfer_wallets_check
    CHECK (
        (type = 'transfer' AND to_wallet_id IS NOT NULL AND to_wallet_id <> wallet_id)
        OR (type <> 'transfer' AND to_wallet_id IS NULL)
    );

-- Serves the wallet filter on the transaction list, which matches a wallet
-- on either side of a transfer.
CREATE INDEX IF NOT EXISTS idx_transactions_to_wallet_id ON transactions (to_wallet_id)
    WHERE deleted_at IS NULL AND to_wallet_id IS NOT NULL;

-- 4. The one system Category every transfer uses.
INSERT INTO categories (user_id, name, icon, type, system_key)
SELECT NULL, 'Chuyển khoản', '🔁', 'transfer', 'transfer'
WHERE NOT EXISTS (
    SELECT 1 FROM categories
    WHERE user_id IS NULL AND system_key = 'transfer' AND deleted_at IS NULL
);
