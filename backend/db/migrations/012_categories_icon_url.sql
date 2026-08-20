-- Custom category icon uploads (Cloudflare R2 storage — see
-- service.R2IconUploader). Kept distinct from the existing `icon` column
-- (a free-text emoji/label, see 006_seed_categories.sql) rather than
-- repurposing it, so a category can still fall back to its emoji if the
-- uploaded image is ever removed.
ALTER TABLE categories ADD COLUMN icon_url TEXT;
