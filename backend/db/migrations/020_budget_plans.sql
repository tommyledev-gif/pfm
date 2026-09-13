-- F-13.1 AI Budget Setup Wizard v2, Phase 1 / BWZ2-T03
-- (specs/ai-budget-wizard-v2/spec.md US-04, plan.md BR-13/BR-14).
--
-- WHY A SECOND LAYER: `budgets` + `budget_limits` are the ENFORCEMENT layer —
-- what a spend is checked against. They cannot answer "what did we plan, from
-- what income, and how has that changed?", because they hold one number per
-- category and no history. Phase 2's whole job is comparing a plan against
-- reality, so it needs something to compare to.
--
-- The mapping between the two layers is exactly one rule:
--     budget_limits.amount_limit = budget_plan_items.amount_max
-- `amount_min` exists only to render the band and classify the spend state.

CREATE TABLE budget_plans (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id),
    version          INT  NOT NULL,
    parent_plan_id   UUID REFERENCES budget_plans(id),
    origin           TEXT NOT NULL CHECK (origin IN ('wizard', 'manual', 'calibration')),
    currency         TEXT NOT NULL CHECK (currency IN ('VND', 'USD')),
    period           TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly')),
    cycle_start_day  SMALLINT NOT NULL DEFAULT 1,

    -- ⚠️ MONEY IS XU (integer cents), like every other amount in this schema.
    -- spec.md A-01 rejected the v2 draft's proposal to store these in đồng:
    -- `amount_limit` above is xu, so a plan in đồng writing into it would be a
    -- silent 100x error on every number the user sees.
    --
    -- NULL income/disposable is legal ONLY for origin='manual' — a budget
    -- created by hand on the Budgets screen has no income context, and
    -- inventing one would be worse than admitting it is unknown (BR-15: the
    -- per-day figure is then hidden, never guessed).
    income           BIGINT,
    income_source    TEXT NOT NULL DEFAULT 'manual'
                          CHECK (income_source IN ('manual', 'median_history', 'lowest_history')),
    fixed_total      BIGINT NOT NULL DEFAULT 0,
    savings_target   BIGINT NOT NULL DEFAULT 0,
    disposable       BIGINT,

    profile_preset   TEXT,
    confidence       TEXT NOT NULL DEFAULT 'low' CHECK (confidence IN ('low', 'medium', 'high')),

    -- When this version started governing spending. Distinct from created_at
    -- on purpose: Phase 2 has to attribute each day's spend to whichever plan
    -- was in force that day, and cannot do that from a creation timestamp
    -- alone. Added now rather than later because backfilling it once real
    -- version chains exist means guessing at history.
    effective_from   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- A plan is never deleted, only superseded — the version chain IS the
    -- audit trail (plan.md, Audit & Logging). Hence no `deleted_at` here,
    -- deliberately breaking the project-wide soft-delete convention rather
    -- than carrying a column that would never be set.
    superseded_at    TIMESTAMPTZ,

    CONSTRAINT chk_budget_plans_cycle_day CHECK (cycle_start_day BETWEEN 1 AND 28),
    CONSTRAINT chk_budget_plans_disposable CHECK (
        origin = 'manual' OR (income > 0 AND disposable > 0)
    )
);

-- At most one live plan per user. Same DB-level-invariant precedent as
-- wallets' one-default index and budgets' one-active-per-category index: two
-- devices submitting the wizard at once serialize instead of interleaving
-- (spec.md S-BWZ2-25).
CREATE UNIQUE INDEX idx_budget_plans_one_active_per_user
    ON budget_plans (user_id) WHERE superseded_at IS NULL;

CREATE INDEX idx_budget_plans_user_version ON budget_plans (user_id, version DESC);

CREATE TABLE budget_plan_items (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id      UUID NOT NULL REFERENCES budget_plans(id) ON DELETE CASCADE,
    -- Plain FK, no ON DELETE clause (plan.md F7). Categories are soft-deleted,
    -- never hard-deleted, so this row survives a category's removal on its own
    -- and the history stays readable; readers filter on the category's own
    -- deleted_at instead.
    category_id  UUID NOT NULL REFERENCES categories(id),
    amount_min   BIGINT NOT NULL,   -- xu
    amount_max   BIGINT NOT NULL,   -- xu — this is what becomes amount_limit
    source       TEXT NOT NULL CHECK (source IN ('stated', 'history', 'preset', 'manual')),
    locked       BOOLEAN NOT NULL DEFAULT FALSE,
    confidence   REAL NOT NULL DEFAULT 0,
    -- "54 giao dịch / 3 tháng, TB 53k/lần". NULL means there is no evidence,
    -- and the UI then shows only the confidence badge — never a filler
    -- sentence (spec.md S-BWZ2-38, fixing B7).
    evidence     TEXT,

    CONSTRAINT chk_budget_plan_items_band CHECK (amount_min <= amount_max AND amount_min > 0),
    CONSTRAINT chk_budget_plan_items_confidence CHECK (confidence >= 0 AND confidence <= 1),
    UNIQUE (plan_id, category_id)
);

CREATE INDEX idx_budget_plan_items_plan ON budget_plan_items (plan_id);

-- ---------------------------------------------------------------------------
-- Backfill (spec.md S-BWZ2-26).
--
-- Without this, every user who already has budgets has no plan, and Phase 2's
-- calibration silently skips all of them — it would have nothing to compare
-- this cycle's spending against. They get a version 1 `manual` plan whose
-- items mirror their current limits exactly, so nothing they see changes.
--
-- income/disposable stay NULL: we genuinely do not know what they earn, and
-- the alternative (deriving it from transaction history) would put a fabricated
-- number into the audit trail.
-- ---------------------------------------------------------------------------
WITH currency_rank AS (
    -- A plan covers exactly one currency (spec.md A-04). For the rare user
    -- with limits in both, pick the one carrying the most budgets; ties break
    -- alphabetically so the backfill is deterministic across re-runs.
    SELECT b.user_id,
           bl.currency,
           ROW_NUMBER() OVER (
               PARTITION BY b.user_id ORDER BY COUNT(*) DESC, bl.currency ASC
           ) AS rn
    FROM budgets b
    JOIN budget_limits bl ON bl.budget_id = b.id
    WHERE b.deleted_at IS NULL
    GROUP BY b.user_id, bl.currency
),
primary_currency AS (
    SELECT cr.user_id, cr.currency
    FROM currency_rank cr
    WHERE cr.rn = 1
      -- Re-run guard: the unique index above would reject a second active
      -- plan, and initdb scripts do get re-executed.
      AND NOT EXISTS (
          SELECT 1 FROM budget_plans p
          WHERE p.user_id = cr.user_id AND p.superseded_at IS NULL
      )
),
new_plans AS (
    INSERT INTO budget_plans (
        user_id, version, origin, currency, period, cycle_start_day,
        income_source, fixed_total, savings_target, confidence, effective_from
    )
    SELECT pc.user_id, 1, 'manual', pc.currency, 'monthly', 1,
           'manual', 0, 0, 'low',
           MIN(b.created_at)
    FROM primary_currency pc
    JOIN budgets b ON b.user_id = pc.user_id AND b.deleted_at IS NULL
    GROUP BY pc.user_id, pc.currency
    RETURNING id, user_id, currency
)
INSERT INTO budget_plan_items (
    plan_id, category_id, amount_min, amount_max, source, locked, confidence, evidence
)
SELECT np.id, b.category_id, bl.amount_limit, bl.amount_limit, 'manual', FALSE, 0.3, NULL
FROM new_plans np
JOIN budgets b ON b.user_id = np.user_id AND b.deleted_at IS NULL
JOIN budget_limits bl ON bl.budget_id = b.id AND bl.currency = np.currency;
