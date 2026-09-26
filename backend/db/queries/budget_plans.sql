-- name: GetActiveCycleStartDay :one
-- Backs service.CycleResolver (specs/ai-budget-wizard-v2/spec.md US-03) —
-- the one field the spend window needs from the plan layer. At most one row
-- by idx_budget_plans_one_active_per_user; no row means the User has no plan
-- and the resolver falls back to the calendar month.
SELECT cycle_start_day FROM budget_plans
WHERE user_id = $1
  AND superseded_at IS NULL;
