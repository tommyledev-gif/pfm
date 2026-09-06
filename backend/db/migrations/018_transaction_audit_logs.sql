-- Transaction Audit Log (specs/transaction-audit-log/) — an append-only
-- history of every successful create/update/(soft-)delete of a Transaction.
--
-- Deliberately has NO updated_at and NO deleted_at: rows here are never
-- updated and never deleted, soft or hard (spec.md Context #2). That is a
-- stricter guarantee than the "soft delete only" rule the financial tables
-- follow — an audit trail that can be edited or removed isn't one.
CREATE TABLE transaction_audit_logs (
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
CREATE INDEX idx_transaction_audit_logs_user_created_at
    ON transaction_audit_logs (user_id, created_at DESC, id DESC);

-- Serves the optional ?transaction_id= filter (one Transaction's own history).
CREATE INDEX idx_transaction_audit_logs_transaction_id
    ON transaction_audit_logs (transaction_id);
