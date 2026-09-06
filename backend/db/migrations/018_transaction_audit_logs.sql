-- Transaction Audit Log (specs/transaction-audit-log/) — an append-only
-- history of every successful create/update/(soft-)delete of a Transaction.
--
-- Deliberately has NO updated_at and NO deleted_at: rows here are never
-- updated and never deleted, soft or hard (spec.md Context #2). That is a
-- stricter guarantee than the "soft delete only" rule the financial tables
-- follow — an audit trail that can be edited or removed isn't one.
-- IF NOT EXISTS throughout: this project has no migration runner, so a
-- migration added after a dev volume was already initialized has to be
-- applied by hand (`psql < 018_...sql`) — and the person doing that has no
-- way to know whether it already ran. Making it re-runnable turns a
-- half-remembered "did I apply this one?" into a harmless no-op instead of
-- an error that looks like a real failure.
CREATE TABLE IF NOT EXISTS transaction_audit_logs (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    -- Denormalized from the parent Transaction's own user_id (which is itself
    -- denormalized from wallets.user_id) so every read filters by user_id
    -- directly, with no join — CLAUDE.md's user-isolation rule.
    user_id        UUID NOT NULL REFERENCES users(id),
    action         TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
    -- before/after hold only the fields the operation actually touched
    -- (spec.md Context #4): create = {} -> full snapshot, update = only the
    -- changed keys, delete = full snapshot -> {}. Any `amount` inside is the
    -- same BIGINT cents value transactions.amount stores, never a float.
    before         JSONB,
    after          JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Serves the list endpoint's ORDER BY created_at DESC, id DESC keyset
-- pagination (reuses the existing generic {id, created_at} cursor helper).
CREATE INDEX IF NOT EXISTS idx_transaction_audit_logs_user_created_at
    ON transaction_audit_logs (user_id, created_at DESC, id DESC);

-- Serves the optional ?transaction_id= filter (one Transaction's own history).
CREATE INDEX IF NOT EXISTS idx_transaction_audit_logs_transaction_id
    ON transaction_audit_logs (transaction_id);
