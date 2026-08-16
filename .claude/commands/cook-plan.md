@.claude/skills/agents/plan.md
@.claude/skills/gitnexus/gitnexus-exploring/SKILL.md

## Step 1 — Load context (minimal, targeted)

1. Read `CURRENT_STATE.md` if it exists.
2. Identify the feature being planned: read `spec.md` from the **most recently modified** `specs/` subdirectory (check git status or ask if unclear — do not guess).
3. The `spec.md` must exist before continuing. If it doesn't, stop and say so.

## Step 2 — Read existing implementation patterns (gitnexus, minimal)

For the stacks this feature touches, use gitnexus to read ONE existing, complete implementation as reference:
- **Go backend:** read the closest existing `_handler.go` + `_service.go` + `_repository.go` trio (e.g. `wallet` if planning a money feature)
- **Next.js web:** read one feature's `api/use-*-query.ts` + `components/*.tsx` + `types.ts`
- **Mobile (React Native/Expo):** read one feature's `api/` + `components/` + `types.ts` under `mobile/src/features/` (only if mobile scope is active — as of 2026-08-16 `mobile/` has only a project scaffold, no feature yet exists to use as reference)
- **Python AI:** read `ai-service/app/` structure only if this feature touches AI

Do NOT read all features. One reference implementation per stack is enough.

## Step 3 — Check migration sequence

Read `backend/db/migrations/` filenames only (not content).  
Note the next migration number. All new migrations must continue the sequence.

## Step 4 — Produce plan.md

Follow all rules and output format in `@.claude/skills/agents/plan.md`.  
File path: `specs/{feature-slug}/plan.md`

## Step 5 — Self-check

Run `/plan-checklist` and fix any violations before presenting the result.