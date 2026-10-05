-- Where a transaction was recorded: an optional map pin set by the mobile app
-- when the Transaction is created, the reverse-geocoded place name for that
-- pin (e.g. "Quận 1, TP. Hồ Chí Minh"), and a free-text note about the place
-- (e.g. directions). Any transaction type may carry one.
--
-- Coordinates and place name are fixed at creation — PATCH can only change
-- location_note. A Transaction without a location can never gain one later.
--
-- TYPE: DOUBLE PRECISION is deliberate. CLAUDE.md's "never float" rule is
-- about money, which must stay exact integer cents; a coordinate is a
-- measurement, not an amount, and float8's ~15 significant digits are far
-- finer than any GPS fix. PostGIS was not worth a new extension for "show
-- one pin on a map" — nothing queries by distance.
--
-- ⚠️ Apply BEFORE the backend that reads these columns starts: every
-- transaction query selects them, so without this migration every
-- transaction endpoint fails (42703). Deploy: cmd/migrate (backend/deploy.sh)
-- applies it before `up -d`. Local: psql by hand (not mounted into
-- docker-entrypoint-initdb.d, same as 022–025).
--
-- Idempotent, same convention as 022/025.

-- 1. The columns. All NULL for a Transaction recorded without a location,
--    which is every Transaction that existed before this migration.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS location_name TEXT NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS location_note TEXT NULL;

-- 2. A pin is a pair: half a coordinate is not a place.
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_location_pair_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_location_pair_check
    CHECK ((location_lat IS NULL) = (location_lng IS NULL));

-- 3. Valid WGS84 ranges. BETWEEN also rejects 'NaN' and ±'Infinity', which
--    float8 would otherwise accept (NaN sorts above every number in Postgres).
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_location_range_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_location_range_check
    CHECK (
        (location_lat IS NULL OR location_lat BETWEEN -90 AND 90)
        AND (location_lng IS NULL OR location_lng BETWEEN -180 AND 180)
    );

-- 4. A place name or a place note only describes a pin, so neither may exist
--    without one. This is also the DB-level backstop for the service rule
--    that PATCH may not set location_note on a Transaction with no location.
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_location_details_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_location_details_check
    CHECK (location_lat IS NOT NULL OR (location_name IS NULL AND location_note IS NULL));
