# PFM — Features Status & Roadmap

_Last updated: 2026-08-16_
_Updated by: /renew-features_

> **Note on clarification questions:** this run skipped the usual blind Q1–Q5 clarification pass. Within this same session the user already established the direction explicitly — spec the AI Chat "create transaction" flow (`specs/ai-chat-assistant/spec.md`), then run `/renew-docs` + `/renew-features` — so the inferred answers below are stated up front rather than re-asked: **Priority = AI Features** (Q1-C), building on top of a now-complete MVP; **pain point** = none reported this session; **scope** = backend + web full-stack, `mobile/` stays paused (Q3, consistent with `CLAUDE.md`); **constraint** = Groq/Anthropic API budget, and `ai-service/` not existing yet is a real, unstarted dependency (Q4); **preference** = new feature (AI Chat), not enhancement-only (Q5-B). If any of this is wrong, say so and this file gets corrected.
>
> **2026-08-16 update:** the "`mobile/` stays paused" assumption above is superseded — mobile was explicitly requested and built out this session (see §1).

---

## 1. Project State Summary

**MVP is fully complete, AI Chat US-01 has since shipped too, and mobile has caught up from scaffold to a working screen set — this file was stale on all three points until now.**

**Implemented (code + DB + Web UI):**
- **User Management (F-01)** — invite-only flow, admin invite/list, activation (backend + web `features/users`)
- **System Security (F-02)** — JWT login/logout, invite-token activation, rate limiting (backend + web `features/auth` + mobile `features/auth` login form, added 2026-08-16)
- **Wallet Management (F-03)** — CRUD, set-default with DB-level uniqueness (backend + web `features/wallets`; mobile reads only, via Home/Profile)
- **Category Management (F-04)** — CRUD, system + user categories, dedup index (backend + web `features/categories`; mobile reads only, via Transactions/Insights/AI Chat)
- **Budget Management (F-05)** — per-category budget, per-currency limits (backend + web `features/budgets`; mobile reads + creates, via Insights → Budgets)
- **Transaction Management (F-06)** — CRUD with atomic wallet-balance update (backend + web `features/transactions`; mobile reads + creates, via Home/Transactions/AI Chat)
- **Financial Reporting (F-07)** — summary + by-category totals, filters by date/wallet/category (backend + web `features/reports`, no new schema; mobile via Insights → Spending, including a clickable donut chart)
- **Notification Handling (F-10)** — budget-exceeded alerts via background scheduler, list/view/mark-read (backend + web `features/notifications`; mobile via the Home bell → full-screen overlay)
- **AI Chat Assistant (Feature-12) — US-01 "Create a Transaction via Chat"** (`specs/ai-chat-assistant/spec.md`) — `ai-service/` (FastAPI, Groq primary/Anthropic fallback), `chat_handler.go`/`ChatService`, migration `011_chat_messages.sql`, `idempotency_key` on `transactions` (migration `010`), web `features/ai-chat`, and mobile `app/(app)/ai-chat.tsx` (added 2026-08-16) — **this row was incorrectly marked SPEC_ONLY/nothing-coded as of the last run; correcting it now.**

Mobile's 2026-08-16 build-out was scoped to what `mobile/design_handoff_pfm_app/` specifies — Wallets/Categories/Household Members/Security/Help are Profile entry-point rows only, no dedicated CRUD screens behind them yet (the design handoff itself maps them as entry points, not full screens).

**SRS items chưa spec (chưa bắt đầu ở bất kỳ layer nào):**
- **Financial Goal (F-08)** — Release 1.
- **Investment Portfolio (F-09)** — Release 2.
- **Data Overview Dashboard (F-11)** — Release 1.
- **AI Chat Assistant US-02/US-03/US-04** — Release 1 (Edit/Query/Advice via chat) — each needs its own BA pass.

---

## 2. Feature Status Matrix

| # | Feature | SRS Ref | Spec | Backend | Web | Mobile | Status |
|---|---------|---------|------|---------|-----|--------|--------|
| 1 | User Management | Feature-01 | ✓ | ✓ | ✓ | ✓ | DONE |
| 2 | System Security | Feature-02 | ✓ | ✓ | ✓ | ✓ | DONE |
| 3 | Wallet Management | FR-01 | ✓ | ✓ | 🔶 read-only (Home/Profile) | DONE |
| 4 | Category Management | FR-03 | ✓ | ✓ | 🔶 read-only (Transactions/Insights/AI Chat) | DONE |
| 5 | Budget Management | FR-04 | ✓ | ✓ | 🔶 read + create (Insights → Budgets) | DONE |
| 6 | Transaction Management | FR-02 | ✓ | ✓ | ✓ read + create (Home/Transactions/AI Chat) | DONE |
| 7 | Financial Reporting | FR-07 | ✓ | ✓ | ✓ (Insights → Spending) | DONE |
| 8 | Financial Goal | FR-05 | ✗ | ✗ | ✗ | BACKLOG (Release 1) |
| 9 | Investment Portfolio | FR-06 | ✗ | ✗ | ✗ | BACKLOG (Release 2) |
| 10 | Notification Handling | Feature-10 | ✓ | ✓ | ✓ (bell → overlay) | **DONE** (was BACKLOG as of 2026-08-13) |
| 11 | Data Overview Dashboard | FR-08 | ✗ | ✗ | ✗ | BACKLOG (Release 1) |
| 12 | AI Chat Assistant — US-01 Create via Chat | FR-09 / Feature-12 | ✓ (`specs/ai-chat-assistant/spec.md`) | ✓ | ✓ (2026-08-16) | **DONE** (was SPEC_ONLY as of last run) |
| — | AI Chat Assistant — US-02/03/04 (Edit/Query/Advice) | FR-09 / Feature-12 | ✗ | ✗ | ✗ | BACKLOG (Release 1) — not yet specced |

Mobile columns marked 🔶 are read/write only through the screens listed — there is no dedicated mobile CRUD UI for wallets/categories beyond what Home/Transactions/Insights/AI Chat expose (the design handoff maps Wallets/Categories/Household Members as Profile entry points only, not full screens).

---

## 3. Recommended Next Features

> MVP is closed (all 8 MVP features DONE). AI Chat US-01 (FEAT-AI-01, below) has also shipped since the last run of this file, and mobile has caught up from scaffold to a working screen set — both were previously listed here as "next sprint"/paused and are corrected now.

### ✅ Shipped since the last run

#### [FEAT-AI-01] AI Chat — Create Transaction via Chat (Feature-12 US-01) — DONE
- Full-stack: `ai-service/` (FastAPI, Groq primary/Anthropic fallback), `chat_handler.go`/`ChatService`, migrations `010_transactions_idempotency_key.sql`/`011_chat_messages.sql`, web `frontend/src/features/ai-chat/`, mobile `app/(app)/ai-chat.tsx`.
- Open items carried forward from the original spec (still not resolved): exact `POST /ai/chat` rate-limit threshold, product sign-off on the 0.6 confidence threshold, Groq/Anthropic fallback trigger conditions.

#### Mobile screen build-out (2026-08-16) — DONE for design-handoff scope
- Home, Transactions, Insights (Spending + Budgets sub-tabs), AI Chat, Notifications, Profile, plus a real login form — built against `mobile/design_handoff_pfm_app/`.
- Not in scope: dedicated Wallets/Categories/Household-Members/Security mobile screens (Profile has inert entry-point rows for these only, per the design handoff itself).

### 🔥 High Priority (next sprint)

#### [FEAT-QC] Close QC coverage gap on F-03→F-07 and F-10
- **Type:** Technical Debt / Quality
- **Rationale:** 6 features (wallet, category, budget, transaction, financial-reporting, notification-handling) have `spec.md` + `plan.md` and backend unit tests, but no formal `test_cases.md` — only `user-management` and `security` have one. Cheap to close, unblocks confidence before further AI Chat work (US-02/03/04) lands on top of `transactions`.
- **Scope:** QC only, no code change expected unless gaps are found
- **Dependencies:** None
- **Rough complexity:** S (per feature) × 6

#### [FEAT-08] Financial Goal (Release 1)
- **Type:** New Feature
- **SRS ref:** FR-05, Feature-08, BF-06
- **Rationale:** SDS domain model note explicitly says FinancialGoal "depends on stable budgeting and reporting" (both done).
- **Scope:** Full-stack
- **Dependencies:** Budget Management (done), Financial Reporting (done)
- **Rough complexity:** L
- **Clarifying questions to resolve before BA:**
  - [ ] Goal progress tracked from dedicated "allocation" transactions, or just any transaction tagged to the Goal's category?
  - [ ] Multiple concurrent Goals per user allowed, or one active Goal at a time?

### 🔮 Low Priority / Future

#### [FEAT-AI-02] AI Chat — Edit Transaction via Chat (Feature-12 US-02)
- **Type:** New Feature — depends on FEAT-AI-01 shipping first (reuses its `POST /ai/chat` proposal flow and `chat_messages` table).
- **Dependencies:** FEAT-AI-01, plus `PUT /transactions/{id}` (named in SDS §6, not yet implemented).
- **Rough complexity:** M

#### [FEAT-AI-03] AI Chat — Query Spending via Chat (Feature-12 US-03)
- **Type:** New Feature — read-only, could ship independently of US-02 once FEAT-AI-01's AI Service scaffold exists.
- **Dependencies:** FEAT-AI-01 (AI Service scaffold), Financial Reporting (done, likely reused for aggregation).
- **Rough complexity:** M

#### [FEAT-11] Data Overview Dashboard (Release 1)
- **Type:** New Feature — aggregates existing data (wallets, budgets, transactions, reports), no new domain object per SDS.
- **Dependencies:** Best done after Financial Goal (F-08) so the dashboard can show goal progress too.
- **Rough complexity:** M

#### [FEAT-09] Investment Portfolio (Release 2)
- **Type:** New Feature — advanced, "mature users" per SRS row 9.
- **Rough complexity:** XL

#### [FEAT-AI-04] AI Chat — General Financial Advice (Feature-12 US-04, Post-MVP)
- **Type:** New Feature — lowest priority within Feature-12; SRS itself labels this Post-MVP.
- **Dependencies:** FEAT-AI-01 at minimum; likely wants Financial Reporting data too.
- **Rough complexity:** M

---

## 4. Enhancement Backlog (existing features)

- [ ] [Wallet/Category/Budget/Transaction/Financial Reporting/Notification] No `test_cases.md` yet — see FEAT-QC above
- [ ] [System Security] `/auth/refresh` endpoint not implemented — 401 forces full re-login; acceptable for MVP but worth an explicit decision before Release 1 (mobile session UX will suffer more than web)
- [ ] [Mobile] No dedicated Wallets/Categories/Household-Members/Security screens — Profile's rows for these are inert entry points only (design-handoff scope); build on explicit request
- [x] [Transaction Management] `POST /transactions` idempotency key — shipped as part of FEAT-AI-01 (migration `010_transactions_idempotency_key.sql`)

---

## 5. Technical Debt Items

- [ ] **Migration deployment is manual, not automated** — migrations are mounted directly as `docker-compose.yml` `docker-entrypoint-initdb.d/*` scripts instead of running through `golang-migrate`. Adding a new migration file requires remembering to add a matching compose mount line; no automated apply-on-boot for existing databases (`backend/db/migrations/`, `docker-compose.yml`).
- [ ] **`docs/architecture.md` / `docs/tech_stacks.md` had drifted from actual code** — fixed this run (`/renew-docs`); the old, differently-named `docs/architecture_design.md` has been removed in favor of the canonical `docs/architecture.md` name that `CLAUDE.md`/`README.md` already reference. Re-run `/renew-docs` after each feature ships, not just at ad-hoc intervals.
- [ ] **`docs/open-ai.md` is a hand-drafted, aspirational OpenAPI sketch, not a generated/enforced contract** — it already documents things not implemented yet (`POST /auth/refresh`, `idempotency_key` on `CreateTransactionRequest`). Worth clarifying whether this file is meant to become the real API-first source of truth (`CLAUDE.md`'s stated intent) or should be deleted/relabeled as a design note.
- [x] **Rate limit on `POST /ai/chat`** — `AIChatRateLimiter` middleware shipped with FEAT-AI-01 (`backend/cmd/server/routes.go`); exact threshold still an open question (see §3).

---

## 6. AI Service Roadmap

> Independent Python microservice — `ai-service/` now exists and is implemented for US-01 (`specs/ai-chat-assistant/spec.md`). User has flagged **Groq/Anthropic API budget** as a constraint to watch — Groq's free tier is primary, Anthropic is strictly fallback (per `CLAUDE.md` tech stack), and the design avoids calling the LLM on every request when a cheaper heuristic would do.

**Phase 0 (foundation):** FastAPI, health check, internal-network reachability from the Go Backend — **done**.
**Phase 1 (core AI):** Transaction extraction from a chat message (FEAT-AI-01) — **done**, backend + web + mobile.
**Phase 2 (chatbot):** Edit/Query/General-advice intents (FEAT-AI-02/03/04) — specced only for none of these yet, not started.
**Phase 3 (insights):** Anomaly detection, spending pattern — not specced, not scoped.

**Current phase:** Phase 0/1 complete; Phase 2 (Edit/Query/Advice via chat) is the next AI Service work, pending its own BA pass.
