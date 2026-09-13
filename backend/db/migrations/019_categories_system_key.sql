-- F-13.1 AI Budget Setup Wizard v2, Phase 1 / BWZ2-T01
-- (specs/ai-budget-wizard-v2/spec.md US-02, plan.md BR-08).
--
-- WHY THIS EXISTS: the v2 preset table (spec.md US-06) maps a lifestyle
-- profile to Categories. v1 matched them by NAME, and the names did not line
-- up with anything: 006_seed_categories.sql seeds ENGLISH system Categories
-- ("Food", "Transport", ...) while the presets, like the rest of the app, are
-- Vietnamese ("Ăn uống", "Di chuyển", ...). Every preset therefore matched
-- ZERO existing Categories, and a first-time user would have finished the
-- wizard with six brand-new Categories sitting beside the seven seeded ones,
-- their spending split across both. This is spec.md's blindspot BS-13.
--
-- The fix is a stable key that survives renaming, so preset resolution never
-- depends on display text again.
--
-- Idempotent by design: initdb scripts re-run on any fresh volume, and steps
-- 2/4/5 are all no-ops on a database that already has the column populated.

-- 1. The key itself. Nullable: a user's own Categories never carry one, and
--    that absence is meaningful (plan.md BR-09 classifies a keyless Category
--    as `essential`, the safer side of the cut order).
ALTER TABLE categories ADD COLUMN IF NOT EXISTS system_key TEXT;

-- 2. Adopt the existing system rows by their CURRENT (English) names, before
--    step 4 renames them out from under this match. `system_key IS NULL`
--    guards a re-run: once assigned, nothing re-matches.
UPDATE categories SET system_key = 'food'          WHERE user_id IS NULL AND system_key IS NULL AND lower(name) = 'food';
UPDATE categories SET system_key = 'transport'     WHERE user_id IS NULL AND system_key IS NULL AND lower(name) = 'transport';
UPDATE categories SET system_key = 'entertainment' WHERE user_id IS NULL AND system_key IS NULL AND lower(name) = 'entertainment';
UPDATE categories SET system_key = 'shopping'      WHERE user_id IS NULL AND system_key IS NULL AND lower(name) = 'shopping';
UPDATE categories SET system_key = 'health'        WHERE user_id IS NULL AND system_key IS NULL AND lower(name) = 'health';
UPDATE categories SET system_key = 'housing'       WHERE user_id IS NULL AND system_key IS NULL AND lower(name) = 'rent';
UPDATE categories SET system_key = 'utilities'     WHERE user_id IS NULL AND system_key IS NULL AND lower(name) = 'utilities';
UPDATE categories SET system_key = 'salary'        WHERE user_id IS NULL AND system_key IS NULL AND lower(name) = 'salary';
UPDATE categories SET system_key = 'bonus'         WHERE user_id IS NULL AND system_key IS NULL AND lower(name) = 'bonus';
UPDATE categories SET system_key = 'investment'    WHERE user_id IS NULL AND system_key IS NULL AND lower(name) = 'investment';
-- 017_seed_savings_category.sql already seeded this one in Vietnamese.
UPDATE categories SET system_key = 'savings'       WHERE user_id IS NULL AND system_key IS NULL AND lower(name) = 'tiết kiệm';

-- 3. One row per key, system scope only. Partial on `user_id IS NULL` so a
--    user-owned Category — which never has a key — can never collide with a
--    system one, and partial on `deleted_at IS NULL` so a soft-deleted system
--    Category does not block re-seeding its replacement.
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_system_key
    ON categories (system_key)
    WHERE user_id IS NULL AND deleted_at IS NULL AND system_key IS NOT NULL;

-- 4. Vietnamese display names (spec.md US-02 / OQ-14). Keyed on system_key,
--    not on the old name, so a re-run is a no-op rather than a second rename.
--    ⚠️ Touches `name` ONLY — `deleted_at` is left alone, so a user who
--    soft-deleted a system Category keeps it deleted. Transactions and
--    budgets reference `category_id` and are completely unaffected.
--    User-created Categories are untouched: every statement is scoped to
--    `user_id IS NULL`.
UPDATE categories SET name = 'Ăn uống'              WHERE user_id IS NULL AND system_key = 'food';
UPDATE categories SET name = 'Di chuyển'            WHERE user_id IS NULL AND system_key = 'transport';
UPDATE categories SET name = 'Cafe & Giải trí'      WHERE user_id IS NULL AND system_key = 'entertainment';
UPDATE categories SET name = 'Mua sắm'              WHERE user_id IS NULL AND system_key = 'shopping';
UPDATE categories SET name = 'Sức khoẻ'             WHERE user_id IS NULL AND system_key = 'health';
UPDATE categories SET name = 'Nhà ở'                WHERE user_id IS NULL AND system_key = 'housing';
UPDATE categories SET name = 'Hoá đơn & Tiện ích'   WHERE user_id IS NULL AND system_key = 'utilities';
UPDATE categories SET name = 'Lương'                WHERE user_id IS NULL AND system_key = 'salary';
UPDATE categories SET name = 'Thưởng'               WHERE user_id IS NULL AND system_key = 'bonus';
UPDATE categories SET name = 'Đầu tư'               WHERE user_id IS NULL AND system_key = 'investment';

-- 5. The two Categories every preset needs and no seed ever created
--    (spec.md US-06: `own_family`/`student` both allocate to children_education,
--    and all four presets allocate to `other`). Same ON CONFLICT target
--    017_seed_savings_category.sql uses, so a user who already made their own
--    "Chi khác" does not break this migration.
INSERT INTO categories (user_id, name, icon, type, system_key) VALUES
    (NULL, 'Con cái & Học tập', '👶', 'expense', 'children_education'),
    (NULL, 'Chi khác',          '⋯',  'expense', 'other')
ON CONFLICT (user_id, lower(name), type) WHERE deleted_at IS NULL DO NOTHING;

-- Backstop for the DO NOTHING above: if a row with that exact name already
-- existed in the system scope, the insert was skipped and its key is still
-- unset. Without this the preset would find nothing and silently fall back to
-- creating a duplicate — the precise failure this migration exists to remove.
UPDATE categories SET system_key = 'children_education'
    WHERE user_id IS NULL AND system_key IS NULL AND lower(name) = 'con cái & học tập';
UPDATE categories SET system_key = 'other'
    WHERE user_id IS NULL AND system_key IS NULL AND lower(name) = 'chi khác';
