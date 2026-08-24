-- ListTransactionsByUser's ORDER BY grew a created_at tie-break between
-- occurred_at and id (same-day transactions now break ties by "when the user
-- actually approved it," not insertion id order) — this index is rebuilt to
-- match, so the sort keeps coming straight off the index instead of an
-- in-memory sort for occurred_at ties.
DROP INDEX idx_transactions_user_occurred_at;

CREATE INDEX idx_transactions_user_occurred_at
    ON transactions (user_id, occurred_at DESC, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;
