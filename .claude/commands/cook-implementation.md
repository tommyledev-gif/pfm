@.claude/skills/agents/dev.md
@.claude/skills/gitnexus/gitnexus-exploring/SKILL.md

## Step 1 — Load context

1. Read `CURRENT_STATE.md` if it exists — for established patterns and decided conventions. Do not reinvent anything already listed under "Key Technical Decisions".
2. Read `spec.md` and `plan.md` from the feature currently being implemented (most recently modified `specs/` subdirectory, or explicitly named by user).
3. Read `docs/tech_stacks.md` for version-specific conventions.

## Step 2 — Read existing reference implementation (gitnexus, targeted)

Before writing any code, use gitnexus to read the ONE closest existing complete implementation for each stack being touched. Purpose: match established patterns exactly, not invent new ones.

- Go: handler + service + repository + dto files for the nearest entity
- Next.js: `api/` hooks + `components/` for one existing feature
- Mobile (React Native/Expo): `api/` + `components/` for one existing feature under `mobile/src/features/` (only if mobile scope active — as of 2026-08-16 `mobile/` has only a project scaffold, no feature yet exists to use as reference; `mobile/src/features/auth/` shows the folder shape but has no implemented API/components yet)
- Migration: read the latest `.sql` migration as format reference

## Step 3 — Implement

Follow all rules in `@.claude/skills/agents/dev.md`.

Implement in this order to catch integration issues early:
1. DB migration (if schema changes needed)
2. sqlc queries → run `sqlc generate`
3. Model + DTO
4. Repository
5. Service (with tests)
6. Handler + routes registration
7. Frontend (web or mobile per current priority)

## Step 4 — Self-check

Run `/implementation-checklist` and fix any violations before presenting the result.