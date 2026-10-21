-- Wallet card colour (specs/shared-wallets plan F10, SRS Feature-03 US-07).
--
-- A palette KEY ('blue', 'amber', …), not a hex: the app owns the actual face
-- colour and the text colour that stays readable on it, per theme, so the
-- palette can be tuned without touching stored rows. NULL keeps the old
-- behaviour, a colour picked from the wallet's position in the list.
-- The allowed keys are checked by the API (dto oneof), deliberately not by a
-- CHECK here: adding a colour must not need a migration.
--
-- Additive and idempotent, same convention as 022-033.

ALTER TABLE wallets ADD COLUMN IF NOT EXISTS color TEXT NULL;
