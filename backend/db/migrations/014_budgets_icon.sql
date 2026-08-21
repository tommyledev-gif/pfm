-- Optional visual identity for a Budget, independent of its linked
-- Category's own icon (specs/wallet-budget-icons/spec.md Edge Case US-04
-- #1). Same icon/icon_url precedence convention as wallets/categories.
ALTER TABLE budgets ADD COLUMN icon TEXT;
ALTER TABLE budgets ADD COLUMN icon_url TEXT;
