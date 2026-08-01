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
    (NULL, 'Health',        '💊', 'expense');
