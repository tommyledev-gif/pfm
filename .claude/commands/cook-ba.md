@.claude/skills/agents/ba.md
@.claude/skills/gitnexus/gitnexus-exploring/SKILL.md

## Step 1 — Load project state (mandatory, do not skip)

1. Read `CURRENT_STATE.md` if it exists — this is the project memory. If absent, note that it hasn't been generated yet and continue.
2. Read `docs/features.md` if it exists — for roadmap priority.

## Step 2 — Identify the next feature to spec (do NOT re-spec what's already done)

Use gitnexus to list `specs/` directory only (no content read yet).  
Cross-check that list against `CURRENT_STATE.md` "What's Actually Working" and "Specced, Not Yet Coded".

From `SRS.md`, identify the highest-priority unspecced feature:
- Prefer: features that unblock other planned features
- Prefer: features already partially implemented (PARTIAL status) — spec what's missing
- Skip: anything already in `specs/` with a complete `spec.md` + `plan.md`

Read only the SRS section for that specific feature. Do not read full SRS.  
Read 1 existing `spec.md` from a completed feature as format reference. Stop there.

## Step 3 — Produce spec.md

Follow all rules and output format in `@.claude/skills/agents/ba.md`.  
File path: `specs/{feature-slug}/spec.md`

## Step 4 — Self-check

Run `/ba-checklist` and fix any violations before presenting the result.