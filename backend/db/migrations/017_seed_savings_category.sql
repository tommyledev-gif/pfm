-- F-13 AI Budget Setup Wizard: the wizard always proposes a Savings budget by
-- default (on top of whatever expense Categories the user picked), which
-- needs a real, stable Category to attach that budget to. ON CONFLICT
-- matches idx_categories_owner_name_type_unique (005_categories.sql) so
-- re-running this migration, or a user having already created their own
-- "Tiết kiệm" category, never errors.
INSERT INTO categories (user_id, name, icon, type) VALUES
    (NULL, 'Tiết kiệm', '💰', 'expense')
ON CONFLICT (user_id, lower(name), type) WHERE deleted_at IS NULL DO NOTHING;
