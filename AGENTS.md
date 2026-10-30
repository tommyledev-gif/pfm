# PFM — Agent Notes
DO NOT USE SUBAGENT MODE

Project rules live in `CLAUDE.md`. Keep anything added here ABOVE the GitNexus block below: that block is regenerated wholesale by `npx gitnexus analyze`.

## UX copy (user-facing text)

Before writing or changing any text a user can see, read `.claude/skills/pfm-ux-copy/SKILL.md`, then the reference it names for the case (`references/vi-style.md`, `patterns.md`, `glossary.md`, `llm-runtime-prompt.md`). This applies to labels, buttons, titles, empty states, errors, toasts, dialogs, placeholders, `accessibilityLabel`, push/notification text, backend `message` strings that reach the UI, and AI-service replies and prompts. It does not apply to code comments, specs, docs, or commit messages.

The `UX Copy` section of `CLAUDE.md` lists the non-negotiables. Neither client has an i18n layer yet (strings are hardcoded Vietnamese), so write the VI string in place; the skill's locale-file rules and `scripts/lint_copy.py` apply only once locale files exist.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **pfm** (13396 symbols, 42550 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "develop"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/pfm/context` | Codebase overview, check index freshness |
| `gitnexus://repo/pfm/clusters` | All functional areas |
| `gitnexus://repo/pfm/processes` | All execution flows |
| `gitnexus://repo/pfm/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
