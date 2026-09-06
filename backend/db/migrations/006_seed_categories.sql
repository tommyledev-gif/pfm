-- Starter system category list — product content, not a spec requirement.
-- Explicit assumption (specs/category-management/plan.md Finding #5), pending
-- product sign-off; safe to extend with a later migration without touching
-- this one.
INSERT INTO categories (user_id, name, icon, type) VALUES
    (NULL, 'Salary',        '💰', 'income'),
    (NULL, 'Bonus',         '🎁', 'income'),
    (NULL, 'Investment',    '📈', 'income'),
    (NULL, 'Food',          '🍔', 'expense'),
    (NULL, 'Rent',          '🏠', 'expense'),
    (NULL, 'Transport',     '🚗', 'expense'),
    (NULL, 'Utilities',     '💡', 'expense'),
    (NULL, 'Entertainment', '🎬', 'expense'),
    (NULL, 'Shopping',      '🛍️', 'expense'),
    (NULL, 'Health',        '💊', 'expense')
-- Matches idx_categories_owner_name_type_unique (005_categories.sql), same
-- clause 017_seed_savings_category.sql already uses. Required now that
-- cmd/migrate applies migrations on every deploy: a bare INSERT here would
-- hit that unique index on the second run and abort the deploy (the index is
-- NULLS NOT DISTINCT, so system rows really do collide). Also makes the file
-- safe to re-run by hand.
ON CONFLICT (user_id, lower(name), type) WHERE deleted_at IS NULL DO NOTHING;
