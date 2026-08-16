# PFM — Features Status & Roadmap

_Last updated: 2026-08-16_
_Updated by: /renew-features_

> **Note on clarification questions:** this run skipped the usual blind Q1–Q5 clarification pass. Within this same session the user already established the direction explicitly — spec the AI Chat "create transaction" flow (`specs/ai-chat-assistant/spec.md`), then run `/renew-docs` + `/renew-features` — so the inferred answers below are stated up front rather than re-asked: **Priority = AI Features** (Q1-C), building on top of a now-complete MVP; **pain point** = none reported this session; **scope** = backend + web full-stack, `mobile/` stays paused (Q3, consistent with `CLAUDE.md`); **constraint** = Groq/Anthropic API budget, and `ai-service/` not existing yet is a real, unstarted dependency (Q4); **preference** = new feature (AI Chat), not enhancement-only (Q5-B). If any of this is wrong, say so and this file gets corrected.

---

## 1. Project State Summary

**MVP is now fully complete.** F-10 Notification Handling has shipped (migration `009_notifications.sql`, `notification_handler.go`/`notification_service.go`, a background scheduler goroutine in `main.go`, and `frontend/src/features/notifications`) since the last `/renew-features` run (2026-08-13) — this file was stale on that point until now.

**Implemented (code + DB + Web UI):**
- **User Management (F-01)** — invite-only flow, admin invite/list, activation (backend + web `features/users` + mobile `features/admin`)
- **System Security (F-02)** — JWT login/logout, invite-token activation, rate limiting (backend + web `features/auth` + mobile `features/auth`)
- **Wallet Management (F-03)** — CRUD, set-default with DB-level uniqueness (backend + web `features/wallets`)
- **Category Management (F-04)** — CRUD, system + user categories, dedup index (backend + web `features/categories`)
- **Budget Management (F-05)** — per-category budget, per-currency limits (backend + web `features/budgets`)
- **Transaction Management (F-06)** — CRUD with atomic wallet-balance update (backend + web `features/transactions`)
- **Financial Reporting (F-07)** — summary + by-category totals, filters by date/wallet/category (backend + web `features/reports`, no new schema)
- **Notification Handling (F-10)** — budget-exceeded alerts via background scheduler, list/view/mark-read (backend + web `features/notifications`) — **newly confirmed shipped this run**

**Partial:**
- Mobile only covers F-01/F-02 (Phase 0); F-03→F-07/F-10 mobile UI is explicitly paused per `CLAUDE.md`, not a gap to close without an explicit request.

**Specced only (có spec, chưa có code):**
- **AI Chat Assistant (Feature-12) — US-01 "Create a Transaction via Chat" only** (`specs/ai-chat-assistant/spec.md`, new this session). Deliberately narrow scope: only the create-transaction flow is specced; US-02 (Edit via Chat), US-03 (Query Spending), US-04 (General Advice) are **not yet specced**. Nothing coded yet — no `ai-service/` directory, no new migrations (`idempotency_key` on `transactions`, new `chat_messages` table), no `POST /ai/chat` handler.

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
| 3 | Wallet Management | FR-01 | ✓ | ✓ | ✓ | ⏸ paused | DONE |
| 4 | Category Management | FR-03 | ✓ | ✓ | ✓ | ⏸ paused | DONE |
| 5 | Budget Management | FR-04 | ✓ | ✓ | ✓ | ⏸ paused | DONE |
| 6 | Transaction Management | FR-02 | ✓ | ✓ | ✓ | ⏸ paused | DONE |
| 7 | Financial Reporting | FR-07 | ✓ | ✓ | ✓ | ⏸ paused | DONE |
| 8 | Financial Goal | FR-05 | ✗ | ✗ | ✗ | ✗ | BACKLOG (Release 1) |
| 9 | Investment Portfolio | FR-06 | ✗ | ✗ | ✗ | ✗ | BACKLOG (Release 2) |
| 10 | Notification Handling | Feature-10 | ✓ | ✓ | ✓ | ⏸ paused | **DONE** (was BACKLOG as of 2026-08-13) |
| 11 | Data Overview Dashboard | FR-08 | ✗ | ✗ | ✗ | ✗ | BACKLOG (Release 1) |
| 12 | AI Chat Assistant — US-01 Create via Chat | FR-09 / Feature-12 | ✓ (`specs/ai-chat-assistant/spec.md`) | ✗ | ✗ | ✗ | **SPEC_ONLY** (Release 1) |
| — | AI Chat Assistant — US-02/03/04 (Edit/Query/Advice) | FR-09 / Feature-12 | ✗ | ✗ | ✗ | ✗ | BACKLOG (Release 1) — not yet specced |

`⏸ paused` = deliberate scope decision (`CLAUDE.md`: mobile paused until explicitly requested), not an incomplete implementation.

---

## 3. Recommended Next Features

> MVP is closed (all 8 MVP features DONE). Direction this session = AI Features, building on the freshly-written `specs/ai-chat-assistant/spec.md`.

### 🔥 High Priority (next sprint)

#### [FEAT-AI-01] Build AI Chat — Create Transaction via Chat (Feature-12 US-01)
- **Type:** New Feature
- **SRS ref:** FR-09, Feature-12 US-01, BF-10; SDS §5.12 US-12-01, §6 API Design, §7 Security Design
- **Rationale:** Just specced this session (`specs/ai-chat-assistant/spec.md`) after confirming MVP is fully done — satisfies `docs/features.md`'s own prior note to "revisit AI Service after F-10 ships." This is the highest-value, most-scoped-down next slice: create-only, no edit/query/advice yet.
- **Scope:** Full-stack minus mobile — new `ai-service/` (Python FastAPI, Groq primary/Anthropic fallback), Go Backend (`POST /ai/chat`, `idempotency_key` addition to `POST /transactions`), web frontend (`frontend/src/features/ai-chat/`). Mobile stays paused.
- **Dependencies:** Transaction Management (done), Category Management (done), Wallet Management (done). Blocked on `ai-service/` scaffold not existing yet — building it is part of this feature's own work, not a separate prerequisite ticket.
- **Rough complexity:** L — greenfield Python service + two new migrations (`transactions.idempotency_key`, new `chat_messages` table) + one new Go handler/service + web UI with async/loading/error states.
- **Clarifying questions to resolve before further planning** (already flagged as Open Questions in `specs/ai-chat-assistant/spec.md`, repeated here for roadmap visibility):
  - [ ] Exact rate-limit threshold for `POST /ai/chat` (spec assumes 30/hour/user as a placeholder).
  - [ ] Confidence threshold of 0.6 for auto-proposing vs. asking for clarification — needs explicit product sign-off.
  - [ ] Should `idempotency_key` on `POST /transactions` be documented as general-purpose (any client) or AI-Chat-only? Spec recommends general-purpose.
  - [ ] Groq/Anthropic fallback trigger conditions (timeout duration, specific error codes) — left to implementation.

### 📋 Medium Priority (next 2-3 sprints)

#### [FEAT-QC] Close QC coverage gap on F-03→F-07 and F-10
- **Type:** Technical Debt / Quality
- **Rationale:** 6 features (wallet, category, budget, transaction, financial-reporting, **and now notification-handling**) have `spec.md` + `plan.md` and backend unit tests, but no formal `test_cases.md` — only `user-management` and `security` have one. Cheap to close, unblocks confidence before AI Chat's backend work lands on top of `transactions`.
- **Scope:** QC only, no code change expected unless gaps are found
- **Dependencies:** None
- **Rough complexity:** S (per feature) × 6

#### [FEAT-08] Financial Goal (Release 1)
- **Type:** New Feature
- **SRS ref:** FR-05, Feature-08, BF-06
- **Rationale:** SDS domain model note explicitly says FinancialGoal "depends on stable budgeting and reporting" (both done). Competes with FEAT-AI-01 for next-sprint attention; direction this session favors AI first.
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
- [ ] [Mobile] F-03→F-07/F-10 mobile UI not built — paused per `CLAUDE.md`; resume only on explicit request
- [ ] [Transaction Management] `POST /transactions` has no idempotency key today — `specs/ai-chat-assistant/spec.md` proposes closing this as part of FEAT-AI-01 rather than as a standalone fix

---

## 5. Technical Debt Items

- [ ] **Migration deployment is manual, not automated** — migrations are mounted directly as `docker-compose.yml` `docker-entrypoint-initdb.d/*` scripts instead of running through `golang-migrate`. Adding a new migration file requires remembering to add a matching compose mount line; no automated apply-on-boot for existing databases (`backend/db/migrations/`, `docker-compose.yml`).
- [ ] **`docs/architecture.md` / `docs/tech_stacks.md` had drifted from actual code** — fixed this run (`/renew-docs`); the old, differently-named `docs/architecture_design.md` has been removed in favor of the canonical `docs/architecture.md` name that `CLAUDE.md`/`README.md` already reference. Re-run `/renew-docs` after each feature ships, not just at ad-hoc intervals.
- [ ] **`docs/open-ai.md` is a hand-drafted, aspirational OpenAPI sketch, not a generated/enforced contract** — it already documents things not implemented yet (`POST /auth/refresh`, `idempotency_key` on `CreateTransactionRequest`). Worth clarifying whether this file is meant to become the real API-first source of truth (`CLAUDE.md`'s stated intent) or should be deleted/relabeled as a design note.
- [ ] **No rate limit on any route except `/auth/login` and `/admin/users/invite`** — relevant now that `POST /ai/chat` (FEAT-AI-01) will call a paid/metered LLM API; this needs its own rate limit, not a reuse of the existing two.

---

## 6. AI Service Roadmap

> Independent Python microservice — still not started (`ai-service/` directory does not exist), but now has a concrete first spec to build against: `specs/ai-chat-assistant/spec.md`. User has flagged **Groq/Anthropic API budget** as a constraint to watch — prioritize Groq's free tier as primary, Anthropic strictly as fallback (per `CLAUDE.md` tech stack), and avoid designs that call the LLM on every request when a cheaper heuristic would do.

**Phase 0 (foundation):** Setup FastAPI, health check, internal-network reachability from the Go Backend — **next up**, required by FEAT-AI-01, not yet built.
**Phase 1 (core AI):** Transaction extraction from a chat message (FEAT-AI-01's actual extraction endpoint) — **next up**, specced, not yet built.
**Phase 2 (chatbot):** Edit/Query/General-advice intents (FEAT-AI-02/03/04) — specced only for none of these yet.
**Phase 3 (insights):** Anomaly detection, spending pattern — not specced, not scoped.

**Current phase:** Not started in code, but Phase 0/1 now has a spec to build against (`specs/ai-chat-assistant/spec.md`) — this is the top recommended next feature (FEAT-AI-01).
