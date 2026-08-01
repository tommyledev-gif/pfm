CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id),
    name        TEXT NOT NULL,
    icon        TEXT,
    type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

-- Same-scope duplicate protection only (specs/category-management/plan.md
-- Finding #3): prevents a single user's own categories from colliding with
-- each other, and separately prevents system categories (user_id IS NULL)
-- from colliding with each other. NULLS NOT DISTINCT (PG15+) makes multiple
-- user_id = NULL rows collide the same way same-user rows do — without it,
-- plain UNIQUE lets unlimited duplicate system rows through since NULL <> NULL.
-- This index does NOT catch a user-owned row colliding with a system row
-- (different user_id values are different index keys) — that cross-scope
-- case is a service-level check only (CategoryService.checkNameTypeAvailable).
CREATE UNIQUE INDEX idx_categories_owner_name_type_unique
    ON categories (user_id, lower(name), type)
    NULLS NOT DISTINCT
    WHERE deleted_at IS NULL;

CREATE INDEX idx_categories_user_id ON categories (user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_categories_type ON categories (type) WHERE deleted_at IS NULL;
