CREATE TABLE notifications (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID NOT NULL REFERENCES users(id),
    type              TEXT NOT NULL,
    title             TEXT NOT NULL,
    body              TEXT NOT NULL,
    is_read           BOOLEAN NOT NULL DEFAULT FALSE,
    related_budget_id UUID REFERENCES budgets(id),
    currency          TEXT CHECK (currency IN ('VND', 'USD')),
    period_start      DATE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- spec.md Context decision #4 / Domain Fields: related_budget_id/currency/
    -- period_start are only meaningful for type='budget_exceeded' today, but
    -- must always be populated together whenever that type is used — this is
    -- what makes the dedup unique index below actually reliable.
    CONSTRAINT chk_notifications_budget_exceeded_fields CHECK (
        type <> 'budget_exceeded'
        OR (related_budget_id IS NOT NULL AND currency IS NOT NULL AND period_start IS NOT NULL)
    )
);

-- Source of truth for "at most one budget_exceeded Notification per
-- (budget, currency, calendar period)" (spec.md Business invariants /
-- S-NOT-06, plan.md Finding #4) — enforced at the DB level, same precedent as
-- F-03's one-default-wallet index and F-05's one-active-budget index, so the
-- background job can run repeatedly (even concurrently) without ever
-- producing a duplicate.
CREATE UNIQUE INDEX idx_notifications_budget_exceeded_dedup
    ON notifications (related_budget_id, currency, period_start)
    WHERE type = 'budget_exceeded';

-- Backs GET /notifications (cursor pagination, created_at DESC, id DESC —
-- same convention as F-01's admin/users list).
CREATE INDEX idx_notifications_user_created_at ON notifications (user_id, created_at DESC, id DESC);
CREATE INDEX idx_notifications_user_unread ON notifications (user_id) WHERE is_read = FALSE;
