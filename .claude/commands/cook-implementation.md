@.claude/skills/agents/dev.md
@.claude/skills/gitnexus/gitnexus-exploring/SKILL.md

## Step 1 — Load context

1. Read `CURRENT_STATE.md` if it exists — for established patterns and decided conventions. Do not reinvent anything already listed under "Key Technical Decisions".
2. Read `spec.md` and `plan.md` from the feature currently being implemented (most recently modified `specs/` subdirectory, or explicitly named by user).
3. Read `docs/tech_stacks.md` for version-specific conventions.
4. If the feature puts any text in front of a user (it almost always does), load the `pfm-ux-copy` skill (`.claude/skills/pfm-ux-copy/SKILL.md`) and its `references/glossary.md` now, before naming anything. Copy written in `spec.md` is a draft: where it breaks the skill, follow the skill and list the change in the result.

## Step 2 — Read existing reference implementation (gitnexus, targeted)

Before writing any code, use gitnexus to read the ONE closest existing complete implementation for each stack being touched. Purpose: match established patterns exactly, not invent new ones.

- Go: handler + service + repository + dto files for the nearest entity
- Next.js: `api/` hooks + `components/` for one existing feature
- Mobile (React Native/Expo): `api/` + `components/` for one existing feature under `mobile/src/features/`. `mobile/` reached full MVP feature parity on 2026-08-21 — use `features/budgets/` or `features/transactions/` as the CRUD reference, `features/ai-chat/` as the chat/AI reference. (Ignore any older note saying `mobile/` is only a scaffold; that stopped being true in August.)
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

User-visible text, at whichever step it appears, follows `pfm-ux-copy`. Before writing each piece, read the matching section of `references/patterns.md` (button, empty state, error, toast, confirm, draft-confirmation, budget state, push…) and `references/vi-style.md`. This includes backend `message` strings and push/notification text a client will show (steps 5–6), and AI-service reply prompts (`references/llm-runtime-prompt.md`).

## Step 4 — Self-check

Run `/implementation-checklist` and fix any violations before presenting the result — its **UX COPY** section is the gate for every new or changed string.

In the result, list every new or changed user-visible string with where it appears (screen/component), so the copy can be reviewed in one place.