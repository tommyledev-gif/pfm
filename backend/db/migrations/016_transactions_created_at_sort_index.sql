-- ListTransactionsByUser's ORDER BY grew a created_at tie-break between
-- occurred_at and id (same-day transactions now break ties by "when the user
-- actually approved it," not insertion id order) — this index is rebuilt to
-- match, so the sort keeps coming straight off the index instead of an
-- in-memory sort for occurred_at ties.
-- IF EXISTS so the file is re-runnable: cmd/migrate applies migrations on
-- every deploy, and a bare DROP against an already-dropped index raises
-- 42704 (undefined_object), which is not a duplicate-object error the runner
-- can adopt — it would just abort the deploy.
DROP INDEX IF EXISTS idx_transactions_user_occurred_at;

CREATE INDEX idx_transactions_user_occurred_at
    ON transactions (user_id, occurred_at DESC, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;
