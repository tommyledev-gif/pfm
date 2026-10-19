# PFM — Features Status & Roadmap

_Last updated: 2026-09-13_
_Updated by: /renew-features_

> **Clarification answers this run:** the 5 standing questions were **not re-asked**, following the same precedent as the 2026-08-22 run — the user had already answered a far more specific set of ~19 scoping questions immediately before invoking this command, covering push notifications, the Settings screen, budget-plan versioning, category mapping, and wizard replacement strategy. Those answers are recorded as decisions **D-01 … D-13** in `docs/new-tasks.md` §21. Equivalent mapping to the standing questions:
>
> - **Q1 Priority direction → (C) AI Features**, specifically the F-13.1 AI Budget Wizard v2 rewrite, with its blocking backend debt (B1–B7, `int64`, `system_key`) pulled in as a prerequisite rather than a separate track.
> - **Q2 Pain point →** budget v1 is a one-shot guess with no feedback loop; the numbers are wrong for a first-time user and nothing ever corrects them. Named explicitly in `docs/new-tasks.md` §0.
> - **Q3 Mobile vs Backend → (C) Full-stack**, mobile-first client. `frontend/` (web) parity for F-13.1 is explicitly out of scope (§18).
> - **Q4 Constraints →** Windows dev machine (no `eas build --local`); EAS free tier 15 builds/month → local Gradle builds; Groq free tier unchanged; Expo pinned to SDK 54; **no App Store/Play Store release** — `.apk` only.
> - **Q5 Enhancement vs new → (C) Both, ROI-ordered** — F-13.1 replaces an existing shipped feature in place (D-13) rather than being added beside it.

---

## 1. Project State Summary

**All MVP features are shipped on backend + mobile + web, and F-13 (AI Budget Setup Wizard v1) shipped on mobile.** The work now on the table is not "add the next feature" — it is **replacing F-13 v1 with v2** (`docs/new-tasks.md`, feature code **F-13.1**), because v1 answers the wrong question for the dominant user.

The core finding driving this roadmap: **v1 assumes the user knows their own spending.** The dominant persona (`cold` — no transaction history) does not, so v1's budget is guaranteed wrong, and v1 has no mechanism to ever correct it. v2 replaces the 4-step / 120-decision flow with 3 screens and 2 questions, and adds a **convergence loop** (day 7 → day 14 → end of cycle) that treats the first budget as a hypothesis to be corrected rather than a truth to be enforced.

A parallel finding: `docs/new-tasks.md` §20 and §21.9 audited v2's own spec against the real codebase and found **13 blindspots (BS-01 … BS-13)** where the spec describes a codebase that does not exist — wrong money unit, a `cycle_start_day` axis with no backing query, a column name that does not exist (`transaction_date` vs `occurred_at`), an LLM stack that isn't the one deployed, and a preset table that cannot map to any seeded Category. Three of these **block** everything else and are pulled into Phase 1.

**Implemented (backend + mobile + web unless noted):**
- **User Management (F-01)** — invite-only, admin invite/list, HTML activation page
- **System Security (F-02)** — JWT login/logout, invite-token activation, rate limiting, revoked-token table. *Since this file was generated (see `specs/mobile-account-switch/`):* sessions table (mig 028), mobile account switching, sign out everywhere, passkeys (mig 032); revised 2026-10-19 to device-bound sessions (mig 033, 60 d idle / 180 d absolute), device list + sign out one device, change password, opt-in app lock — mobile only
- **Wallet Management (F-03)** — CRUD, default-wallet DB uniqueness, emoji + uploaded-photo icons *(web lacks icon upload)*
- **Category Management (F-04)** — CRUD, system + user categories, dedup index, icon/photo upload via R2
- **Budget Management (F-05)** — per-category budget, per-currency limits, own icon independent of Category's *(web deferred)*
- **Transaction Management (F-06)** — CRUD with atomic wallet-balance update, idempotency key, sorting/filtering, **CSV export/import**, **audit log** (`018_transaction_audit_logs.sql`, `app/(app)/audit-log.tsx`)
- **Financial Reporting (F-07)** — summary + by-category totals, date/wallet/category filters, donut chart on mobile Insights
- **AI Budget Setup Wizard (F-13 v1)** — `GET /ai/budget-wizard/prefill`, `POST /ai/budget-proposals`, `POST /budgets/bulk`, `budgetproposal` allocation package, 4-step mobile wizard, chat-card + quick-action triggers *(mobile only, by design)*

**Partial:**
- **Notification Handling (F-10)** — in-app list/view/mark-read + a 5-minute background scheduler for `budget_exceeded` only. **No push infrastructure at all** — `expo-notifications` is not installed, and the `notifications` table's `CHECK` constraint and dedup index are hardcoded to `type = 'budget_exceeded'` (`009_notifications.sql:15-30`).
- **AI Chat Assistant (F-12)** — **US-01 (create via chat) only.** The AI Service's intent enum is `create_transaction | ambiguous | budget_wizard` (`ai-service/app/schemas/extract_schema.py:75`) — US-02 (`sửa@` edit), US-03 (query spending), US-04 (advice) are **unbuilt**, not partial. Mobile's `EditTransactionModal`/`EditMessageModal` edit an unconfirmed proposal, which is a different thing.
- **Data Overview Dashboard (F-11)** — mobile `app/(app)/index.tsx` is a real home screen (net worth, liquid-fill balance, recent transactions), but there is no F-11 spec and no dedicated dashboard endpoint; it composes existing queries.

**Specced/designed only, no code:**
- **AI Budget Wizard v2 (F-13.1)** — `docs/new-tasks.md` (1585 lines: 21 sections, 13 decisions, 13 blindspots, 19 open questions). **Not yet in `specs/`** — that is what `/cook-ba` produces next.

**SRS items not started:**
- **Financial Goal (F-08)** · **Investment Portfolio (F-09)** — no migration, no model, no handler, no UI.

**Shipped outside the SRS** (mobile platform work, each with its own spec): `mobile-debug-console`, `mobile-loading-skeletons`, `mobile-session-refresh`, `transaction-audit-log`, `transaction-export-import`, `wallet-budget-icons`.

---

## 2. Feature Status Matrix

| # | Feature | SRS Ref | Spec | Backend | Mobile | Web | Status |
|---|---------|---------|------|---------|--------|-----|--------|
| F-01 | User Management | Feature-01 | ✓ | ✓ | ✓ | ✓ | **DONE** |
| F-02 | System Security | Feature-02 | ✓ | ✓ | ✓ | ✓ | **DONE** |
| F-03 | Wallet Management | FR-01 / Feature-03 | ✓ | ✓ | ✓ | ✓* | **DONE** |
| F-04 | Category Management | FR-03 / Feature-04 | ✓ | ✓ | ✓ | ✓ | **DONE** |
| F-05 | Budget Management | FR-04 / Feature-05 | ✓ | ✓ | ✓ | ✓* | **DONE** |
| F-06 | Transaction Management | FR-02 / Feature-06 | ✓ | ✓ | ✓ | ✓ | **DONE** |
| F-07 | Financial Reporting | FR-07 / Feature-07 | ✓ | ✓ | ✓ | ✓ | **DONE** |
| F-10 | Notification Handling | Feature-10 | ✓ | ✓ | ✓ | ✓ | **PARTIAL** — in-app only, no push |
| F-11 | Data Overview Dashboard | FR-08 / Feature-11 | ✗ | — | ✓ | ✗ | **PARTIAL** — home screen, unspecced |
| F-12 | AI Chat Assistant | FR-09 / Feature-12 | ✓ | ✓ | ✓ | ✓ | **PARTIAL** — US-01 only |
| F-13 | AI Budget Wizard **v1** | FR-10 / Feature-13 | ✓ | ✓ | ✓ | ✗ | **DONE** (mobile-only by design) |
| F-13.1 | AI Budget Wizard **v2** | FR-10 (extends) | ~ | ✗ | ✗ | ✗ | **SPEC_ONLY** — `docs/new-tasks.md`, not in `specs/` |
| F-08 | Financial Goal | FR-05 / Feature-08 | ✗ | ✗ | ✗ | ✗ | **BACKLOG** |
| F-09 | Investment Portfolio | FR-06 / Feature-09 | ✗ | ✗ | ✗ | ✗ | **BACKLOG** |

`✓*` = shipped without icon/photo support on web (deferred, see `specs/wallet-budget-icons/`).
`~` = designed in `docs/new-tasks.md` but not yet a `specs/<feature>/spec.md`.

---

## 3. Recommended Next Features

### 🔥 High Priority (next sprint)

#### [FEAT-13.1-P1] AI Budget Wizard v2 — Phase 1: engine, blocking migrations, 3-screen cold flow
- **Type:** New Feature + Technical Debt (inseparable — the debt blocks the feature)
- **SRS ref:** FR-10, Feature-13 US-03/US-04 (replaced in place)
- **Rationale:** `cold` is the dominant persona and v1 is wrong for them by construction. Everything else in v2 (calibration, P2 confirm, NL mode) reads from the same engine, so the engine's correctness is a hard prerequisite — and the engine currently computes money in `float64` (B2) and is **non-deterministic** (B1: Go randomizes map iteration, so `"Cafe & Ăn uống"` matches either `"cafe"` or `"ăn uống"` depending on the run, while the code comment claims order is insignificant).
- **Scope:** Backend + Mobile
- **Dependencies:** F-04 (Category), F-05 (Budget), F-13 v1 (replaced in place, D-13)
- **Rough complexity:** **XL**
- **Blocking sub-items (all must land before the wizard UI is useful):**
  1. **Migration 021** — `categories.system_key` + rename system Categories to Vietnamese + 2 new Categories (BS-13). Without this the §5.3 preset table maps to **zero** existing Categories and a `cold` user ends up with 6 duplicates beside the 7 English seeds.
  2. **`budgetproposal` → `int64` xu** + fix **B1–B7** (`compute.go`).
  3. **Port `budget-pace.ts` → Go** — the at-risk rule exists only in TypeScript today; the notification job runs in Go.
  4. **`SumExpenseByUserCycle` + `cycle_start_day`** (BS-02) — the only spending window that exists is `date_trunc('month', NOW())` (`transactions.sql:217`); every `đ/ngày` figure is wrong for anyone not paid on the 1st.
  5. **Fix `occurred_at` / income cap** (BS-03, BS-05) — §6.1's SQL references a column that does not exist; the income cap is off by 100× (`lte=9999999999` xu ≈ 100M đ, not 10B đ).
  6. **Migration 022** — `budget_plans.origin` + relaxed constraints + backfill for users who already have budgets (D-12).
- **Clarifying questions to resolve before BA:**
  - [ ] Does migration 021's Vietnamese rename of system Categories need a user-facing announcement, or is it silent? (OQ-14 assumes silent.)
  - [ ] `budget_plans.currency` — confirm one plan covers exactly one currency (the user's primary) and a second-currency wallet simply isn't planned (BS-08 / §20.2).
  - [ ] Does Phase 1 ship the wizard **without** calibration (i.e. the user gets a better first budget but still no feedback loop), or is P1+P2 one release? Phasing says separate; product value argues together.

#### [FEAT-13.1-P2] AI Budget Wizard v2 — Phase 2: convergence loop + push notifications + Settings
- **Type:** New Feature
- **SRS ref:** FR-10 + Feature-10 (Notification Handling, materially extended)
- **Rationale:** For the `cold` persona this **is** the product, not a follow-up. The first budget is knowingly wrong (§P-01); the day-7 / day-14 / end-of-cycle check-ins are what turn that from a churn reason into a return reason. This phase also finally gives F-10 real push delivery, closing its PARTIAL status.
- **Scope:** Backend + Mobile + Infra (Firebase/FCM)
- **Dependencies:** FEAT-13.1-P1 (plan versioning, cycle window, pace-in-Go all come from there)
- **Rough complexity:** **XL**
- **Sub-items:** zero-sum funding dialog (§8.3, multi-source per BS-12) · plan versioning chain · `expo-notifications` + dev-client build + FCM credentials · migrations 019/020 (`user_push_tokens`, relaxed `notifications`, `user_preferences`) · `notification_mutes` + push action buttons · `app/(app)/preferences.tsx`
- **Clarifying questions to resolve before BA:**
  - [ ] Firebase project: one project with two Android apps (dev/prod), or two projects? (OQ-15)
  - [ ] Push action button handling — confirm the deep-link approach (`pfm://preferences?mute=…`) over an Android background task, accepting that the app visibly opens for one beat (§21.5.1).
  - [ ] D-05 fires a push on **every** qualifying transaction. Confirm no absolute daily cap, relying on the shared Android notification id + one-tap mute instead (OQ-18/OQ-19).

### 📋 Medium Priority (next 2–3 sprints)

#### [FEAT-13.1-P3] AI Budget Wizard v2 — Phase 3: `hot` persona one-screen confirm
- **Type:** New Feature · **Scope:** Backend + Mobile · **Complexity:** M
- **Rationale:** Can only exist once real users have accumulated ~2 months of history, so it is naturally later. The "thực tế 3 tháng" column beside each proposal is the whole value — it proves the app isn't inventing numbers.
- **Dependencies:** FEAT-13.1-P1 (income median/lowest queries, §6.1)
- **Clarifying questions to resolve before BA:**
  - [ ] Median vs mean for the "actual" column — OQ-11 assumes median with a p40–p75 band. Confirm.

#### [FEAT-TZ] Cycle window + timezone correctness
- **Type:** Technical Debt · **Scope:** Backend · **Complexity:** M
- **Rationale:** Every period boundary in the system is **UTC** — `date_trunc('month', NOW())` in SQL, `time.UTC` in `report_service.go:124` and `notification_service.go:126`. For Vietnamese users that means the month rolls over at 07:00 local. This is deliberately **not** part of the wizard (§21 D-09): fixing it changes F-05 and F-07 numbers too, so it needs its own spec and its own regression pass.
- **Dependencies:** shares its edit site with `cycle_start_day` from FEAT-13.1-P1 — do them together or accept touching the same queries twice.
- **Clarifying questions to resolve before BA:**
  - [ ] Per-user timezone (`user_preferences.timezone`) or one app-wide `Asia/Ho_Chi_Minh` constant? (§21 D-09 defers the column deliberately — a stored value the backend ignores would be a lie.)
  - [ ] Do historical report figures change retroactively when the boundary moves, or is there a cutover date?

#### [FEAT-13.1-P4] AI Budget Wizard v2 — Phase 4: natural-language input mode (P3)
- **Type:** New Feature · **Scope:** AI Service + Backend + Mobile · **Complexity:** L
- **Rationale:** Smallest audience, most effort, highest accuracy risk — last by design. **Hard ship gate:** 100-sentence Vietnamese eval set, `amount ≥ 95%`, `freq_count ≥ 90%`, `freq_unit ≥ 90%`. Below the gate this does not ship; "ship and fix later" is explicitly rejected (§15).
- **Dependencies:** FEAT-13.1-P1 (the normalizer feeds the same allocator)
- **Clarifying questions to resolve before BA:**
  - [ ] BS-04: the spec says vLLM `guided_json` + fixed `seed`; the deployed stack is Groq/Anthropic **tool calling** with no `seed`. Confirm the flat, non-`$ref` schema shape — `extract_service.py:70` already records that gpt-oss-20b silently mishandles nested `$ref` schemas under forced `tool_choice`.
  - [ ] Who builds the 100-sentence eval set, and is it committed to the repo as a fixture?

### 🔮 Low Priority / Future

#### [FEAT-CHAT-EXT] AI Chat US-02 / US-03 — edit + query spending via chat
- **Type:** New Feature · **Scope:** AI Service + Backend + Mobile · **Complexity:** L
- **Rationale:** Closes F-12's PARTIAL status. US-03 (query spending) has extra pull now: F-13.1 §10 already computes "hôm nay còn X" at the moment of spend, which is most of a spending-query answer.
- **Dependencies:** none blocking; intent enum extension in `extract_schema.py`

#### [FEAT-08] Financial Goal · #### [FEAT-11] Dashboard · #### [FEAT-09] Investment Portfolio
- **Complexity:** L / M / XL · **Status:** untouched at every layer.
- F-13.1 §18 notes a natural bridge: the wizard's "Tiết kiệm" line is a Financial Goal in all but name. Deliberately out of v2 scope.
- F-11 partly exists as mobile's home screen; the work is specifying it, not inventing it.

---

## 4. Enhancement Backlog (existing features)

- [ ] **[F-10]** `buildBudgetExceededNotification()` emits English copy (*"Budget exceeded: …"*, `notification_service.go:111`) — translate when Phase 2 touches it.
- [ ] **[F-05]** `budgets.start_date` is stored but **no query uses it** to bound the spending window — mobile compensates client-side in `budgetPeriodElapsed()`, so a budget created on the 25th still counts the whole month's spend. Backend-side narrowing is the real fix.
- [ ] **[F-05]** `period` is `monthly` everywhere in practice, but `dto.BudgetProposalsRequest` still accepts `weekly`/`quarterly` (BS-06) — remove them so all three sources agree.
- [ ] **[F-03/F-05]** Web (`frontend/`) has no icon/photo upload for Wallets and Budgets — mobile-only since `specs/wallet-budget-icons/`.
- [ ] **[F-04]** Category's "can never clear `icon_url`" bug — same root cause as the one fixed for Wallet/Budget, deliberately deferred at the time.
- [ ] **[F-13.1]** Web parity for the whole wizard — explicitly out of scope in §18, but it is the largest client gap in the product.
- [ ] **[UI]** Vietnamese sweep still pending on: `wallets.tsx`, `categories.tsx`, `insights.tsx`, `profile.tsx`, notifications screen, auth screens, `BottomNav` labels, `SETTINGS_ROWS` in `settings.tsx`, and scattered `common.NewInvalidInputError("…")` call sites.

---

## 5. Technical Debt Items

| # | Item | Where | Severity |
|---|------|-------|----------|
| TD-01 | `budgetproposal` computes money in `float64` then truncates → `Σ entries + unallocated ≠ income`. Violates the project's own integer-money rule. | `service/budgetproposal/compute.go` (B2) | 🔴 |
| TD-02 | **Non-deterministic allocation** — `for pattern := range BudgetWizardCategoryBaselines` relies on Go map order; overlapping patterns (`"ăn"`/`"food"`, `"nhà"`/`"tiết kiệm"`) make the same input produce different budgets across runs. The comment above it asserts the opposite. | `common/constants.go:227-239` (B1, BS-10) | 🔴 |
| TD-03 | `BudgetWizardMinAmountPerCategory = 50_000` is in **xu** → the real floor is **500đ**, not 50.000đ. | `common/constants.go:182` (D-11) | 🔴 |
| TD-04 | Income cap `lte=9999999999` xu ≈ **100M đ**, while the spec intends 10B đ — blocks any user earning > 100M/month at screen 1. | `dto.BudgetProposalsRequest` (BS-05) | 🟠 |
| TD-05 | All period boundaries are UTC → the month rolls over at 07:00 for Vietnamese users. | `transactions.sql:217`, `report_service.go:124`, `notification_service.go:126` (BS-09) | 🟠 |
| TD-06 | `notifications` `CHECK` + dedup index hardcoded to `type='budget_exceeded'` — any new notification type needs a migration first. | `009_notifications.sql:15-30` (BS-07) | 🟠 |
| TD-07 | `enforceUnallocatedFloor()` returns `true` even when it reduced nothing → `ScaledDown` lies → the UI warns falsely. | `budgetproposal` (B3) | 🟡 |
| TD-08 | `applyFloor()`/`applyCeiling()` have no convergence proof and no re-check after shrink. | `budgetproposal` (B4) | 🟡 |
| TD-09 | `reasoningFor()` emits contentless filler (*"AI đề xuất mức chi tiêu tiêu biểu…"*) instead of real evidence. | `budgetproposal` (B7) | 🟡 |
| TD-10 | **Files over the 300-line limit** (CLAUDE.md, "không có ngoại lệ"): `mobile/app/(app)/ai-chat.tsx` **552**, `mobile/app/(app)/index.tsx` **451**, `backend/internal/service/chat_service.go` **339**, `backend/internal/repository/budget_repository.go` **323**. (sqlc-generated files excluded.) | — | 🟡 |
| TD-11 | **Stray `mobile/pfm/` scaffold** — a leftover `create-expo-app` directory that produces ~40 unrelated `tsc` errors. Not referenced by anything. | `mobile/pfm/` | 🟡 |
| TD-12 | Spec v1 §6.3 (weighted pool) contradicts the shipped code (absolute target share) — a dev reading the spec implements the wrong algorithm. | `specs/ai-budget-wizard/spec.md` (B6) | 🟡 |
| TD-13 | Local `sqlc` CLI rewrites **every** generated file differently from what is committed — regenerating produces an unreviewable diff, so new queries are hand-written instead. Pin the version or accept one deliberate re-gen commit. | `backend/internal/repository/sqlc/` | 🟡 |
| TD-14 | No API-contract codegen — every backend DTO and every mobile/web type is hand-synced across three directories. `api-spec/openapi.yaml` is referenced by CLAUDE.md but is not a live source of truth. | `api-spec/`, `dto/`, `features/*/types.ts` | 🟡 |
| TD-15 | Production VPS deployment verification (carried from 2026-08-22, unresolved in-session) — confirm `deploy-backend.yml` has actually run for current `HEAD`. | `.github/workflows/` | 🟡 |

---

## 6. AI Service Roadmap

**Phase 0 (foundation) — ✅ done.** FastAPI, internal REST from the Go backend, Groq primary + Anthropic fallback, health check, `extract_router` / `budget_router`.

**Phase 1 (core AI) — ✅ done.** Transaction extraction from Vietnamese natural language via **tool/function calling** (prose-described JSON schemas proved unreliable — `extract_service.py`), plus Category-name suggestion for the wizard. Intent enum today: `create_transaction | ambiguous | budget_wizard`.

**Phase 2 (structured budget extraction) — next, gated.** F-13.1 Phase 4's NL mode (§9): a strict extract-only prompt (**"BẠN CHỈ TRÍCH XUẤT. BẠN KHÔNG TÍNH TOÁN."**), a **flat** tool schema with no nested `$ref` (BS-04), an independent regex cross-check to catch `35k → 350k` mishearings (§9.3), and all arithmetic in Go. **Ship gate: `amount ≥ 95%` on a 100-sentence Vietnamese eval set.**

**Phase 3 (chat parity).** F-12 US-02/US-03 — extend the intent enum to `edit_transaction` and `query_spending`.

**Phase 4 (insights).** Anomaly detection, spending patterns. Per F-13.1 §18, if an LLM ever generates budget reasoning it may **only** see numbers already computed in Go, behind a verifier that rejects any figure not in that set.

**Current phase: 1 complete, 2 designed and gated.**
**Budget constraint:** Groq free tier, `openai/gpt-oss-120b`. Unchanged and not expected to bind at current scale. All wizard arithmetic is deliberately LLM-free (§P-08), so AI Service downtime degrades NL mode only — never the wizard itself.
