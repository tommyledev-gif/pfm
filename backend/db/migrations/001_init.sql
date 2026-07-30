CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email             TEXT NOT NULL,
    full_name         TEXT,
    password_hash     TEXT,
    status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'active', 'disabled')),
    role              TEXT NOT NULL DEFAULT 'member'
                      CHECK (role IN ('admin', 'member')),
    invited_by        UUID REFERENCES users(id),
    invite_token      TEXT UNIQUE,
    invite_expires_at TIMESTAMPTZ,
    activated_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
);

-- Partial unique index instead of a plain UNIQUE(email): a soft-deleted user's
-- email must be re-invitable, otherwise deleting a user permanently blocks
-- their email forever (test_cases.md TC-USR-16 flagged this as a design gap).
CREATE UNIQUE INDEX idx_users_email_active_unique ON users (email) WHERE deleted_at IS NULL;

CREATE INDEX idx_users_invite_token ON users (invite_token)
    WHERE invite_token IS NOT NULL;
CREATE INDEX idx_users_status ON users (status)
    WHERE deleted_at IS NULL;
-- Supports ListUsers' cursor pagination: WHERE (created_at, id) < (cursor) ORDER BY created_at DESC, id DESC
CREATE INDEX idx_users_created_at_id ON users (created_at DESC, id DESC)
    WHERE deleted_at IS NULL;
