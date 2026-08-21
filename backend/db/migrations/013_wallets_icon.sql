-- Optional visual identity for a Wallet — same pattern as
-- 012_categories_icon_url.sql (specs/wallet-budget-icons/spec.md). icon is a
-- free-text emoji/short label; icon_url is an uploaded photo
-- (POST /wallets/icon) and takes display precedence over icon when both
-- are set.
ALTER TABLE wallets ADD COLUMN icon TEXT;
ALTER TABLE wallets ADD COLUMN icon_url TEXT;
