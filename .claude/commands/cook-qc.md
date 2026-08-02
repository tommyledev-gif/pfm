@.claude/skills/agents/qc.md
@.claude/skills/gitnexus/gitnexus-exploring/SKILL.md

## Step 1 — Load context

1. Read `spec.md` and `plan.md` from the feature just implemented (most recently modified `specs/` subdirectory, or explicitly named by user).
2. Read `CURRENT_STATE.md` to understand data conventions (money as BIGINT cents, UTC timestamps, soft delete rules, idempotency requirements).

## Step 2 — Read implementation (gitnexus, targeted)

Use gitnexus to read the actual implementation files listed in `plan.md`'s Open Tasks table.  
Do not read the whole codebase — only the files that were changed for this feature.

## Step 3 — Produce test_cases.md

Follow all rules and output format in `@.claude/skills/agents/qc.md`.  
File path: `specs/{feature-slug}/test_cases.md`

Coverage must include at minimum:
- Every AC in `spec.md` has at least one TC
- All error flows from `plan.md`'s error table have corresponding TCs
- Financial data rules (if any money fields): atomic balance update, BIGINT only, soft-delete exclusion
- Auth matrix: unauthenticated → 401, wrong role → 403, wrong owner → 403

## Step 4 — Self-check

Run `/qc-checklist` and fix any violations before presenting the result.