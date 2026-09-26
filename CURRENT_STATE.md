# PFM — Current Project State

_Last updated: 2026-09-26_
_Command: /cook-state_

> ⚡ Load file này đầu tiên khi bắt đầu session mới.
> Không edit manual — chạy /cook-state để refresh.

---

## TL;DR — Project Health

- **Phase:** MVP done (F-01→F-07, F-10 on backend + web + mobile). Release-1 AI work in progress: F-13.1 AI Budget Wizard v2 mostly shipped on mobile; Feature-12 AI Chat has US-01 only.
- **Overall completion:** MVP 100%. F-13.1 (`specs/ai-budget-wizard-v2/`): US-01, US-02, US-05→US-08 done; **US-03, US-04, US-09 zero code**. Feature-12: US-01 done, US-02/US-03/US-04 unbuilt.
- **Last feature shipped:** AI Chat **mode picker** (commit `f8770eb`, 2026-09-26) — `mobile/src/features/ai-chat/chat-mode.ts` with modes `transaction | budget | consult`; `consult` renders disabled (`CONSULT_MODE_ENABLED = false`) because `POST /ai/consult` does not exist yet.
- **Currently in progress:** BA/plan for **Feature-12 US-03 Query Spending via Chat** (brief: `docs/new-tasks.md` Phần II, internal nickname "F-14" — not an SRS feature id).
- **Next up:** (1) `/cook-ba` + `/cook-plan` for Feature-12 US-03 → (2) `/cook-implementation specs/ai-budget-wizard-v2/` to close **I-1 (US-03 cycle window + `AppTimezone`)** + I-4 race → (3) implement US-03 analytics → then US-05 Scenario (needs SRS entry first) → US-04 Evaluate.
- **Blockers:** Analytics implementation (not spec/plan) is blocked by F-13.1 US-03: `backend/db/queries/transactions.sql:217` still uses `date_trunc('month', NOW())` (UTC calendar month); `common.AppTimezone` (`common/budget_wizard_v2.go`) has zero importers; user-chosen `cycle_start_day` is ignored server-side.

---

## What's Actually Working (Code + DB + UI)

| Feature | Backend | Web (frontend/) | Mobile |
|---|---|---|---|
| F-01 User Management | ✅ | ✅ | ✅ (`app/(app)/users.tsx`) |
| F-02 System Security (JWT, `/auth/refresh`) | ✅ | ✅ | ✅ silent refresh (`lib/axios.ts`, `specs/mobile-session-refresh/`) |
| F-03 Wallet Management (+ icon upload) | ✅ | ✅ (no icon upload) | ✅ |
| F-04 Category Management (+ icon upload, `system_key`) | ✅ | ✅ | ✅ |
| F-05 Budget Management (+ icon, bulk) | ✅ | ✅ (no icon upload) | ✅ |
| F-06 Transaction Management (+ sort/filter, CSV export/import, audit log, delete guardrails) | ✅ | ✅ (core only) | ✅ |
| F-07 Financial Reporting (`GET /reports/summary`) | ✅ | ✅ | ✅ (Insights: donut + legend) |
| F-10 Notification Handling (in-app only, `budget_exceeded` only) | ✅ | ✅ | ✅ |
| Feature-12 AI Chat US-01 (create-via-chat, thread sync) | ✅ | ✅ | ✅ + mode picker |
| F-13 v1 → **F-13.1 v2** AI Budget Wizard (int64 deterministic engine, 3-screen flow) | ✅ (partial, see below) | ❌ (out of scope) | ✅ |

---

## Partial / In Progress

- 🔶 **F-13.1 AI Budget Wizard v2** (`specs/ai-budget-wizard-v2/`) — open items (numbering from `docs/new-tasks.md` §I.2):
  - **I-1 / US-03 Cycle window + timezone** — no `CycleWindow` helper, no `SumExpenseByUserCycle`. 🔴 blocks Feature-12 US-03 implementation.
  - **I-2 / US-04 Plan versioning** — `budget_plans` table exists (mig 020) but no query, no Go code writes it.
  - **I-3 / US-09 Budget impact at moment of spend** — `budget_impact` 0 hits; `TransactionActionCard.tsx:84-93` computes a pre-confirm bar client-side (not the DoD).
  - **I-4 First-submit race** — `budgets.sql:96-99` `FOR UPDATE` locks 0 rows when the user has no budget yet.
  - **I-5** — not verified on a real device.
- 🔶 **Feature-12 AI Chat** — US-01 only. `ai-service/app/schemas/extract_schema.py` intent enum is `create_transaction | ambiguous | budget_wizard`. US-02 (edit), US-03 (query spending), US-04 (advice) unbuilt at every layer.
- 🔶 **F-10 Notifications** — no push (`expo-notifications` not installed); `notifications` CHECK hardcoded to `budget_exceeded`.
- 🔶 **F-11 Dashboard** — real mobile home screen (`app/(app)/index.tsx`), never specced.
- 🔶 **QC coverage** — only `specs/security/` and `specs/user-management/` have `test_cases.md`.

---

## Specced, Not Yet Coded

- 📋 **F-13.1 US-03 / US-04 / US-09** — `specs/ai-budget-wizard-v2/spec.md` + `plan.md` (see above).
- 📋 **Feature-12 US-03 / US-04 / US-05 (Scenario)** — brief only (`docs/new-tasks.md` Phần II); no `specs/` folder yet. SRS §6 already has US-03 (line ~742) and US-04 (line ~758); US-05 must be added to SRS before its BA pass.

---

## Key Technical Decisions (không được thay đổi)

| Decision | Value | Reason |
|----------|-------|--------|
| Money storage | BIGINT xu (integer cents), everywhere incl. wizard engine; overflow-safe via `common/money.go` (`bits.Mul64/Div64`) | Float precision |
| JWT strategy | access 15m + refresh 7d, `revoked_tokens` table; `POST /auth/refresh` exists, mobile refreshes silently | Session UX on mobile |
| DB access | sqlc only; local sqlc CLI version differs → new queries hand-written into generated files | Avoid unreviewable regen diff |
| Error format | `{error_code, message, details?}` | Consistent across handlers |
| Cursor pagination | `{id, created_at}` base64 cursor | Scale-ready |
| Budget scope | 1 active budget per (user, category), per-currency limits in `budget_limits`; `period` monthly-only | See `project_budgets_monthly_only` |
| Category identity | `categories.system_key` (mig 019) + `ClassForSystemKey()` → 3-tier class `fixed/essential/discretion` (`common/budget_wizard_v2.go`) | Deterministic wizard cut order |
| Report aggregates | `ReportRepository` reuses queries in `transactions.sql`, no reports table | Accepted cross-repo exception |
| AI Chat routing | User picks mode in UI (`chat-mode.ts`), no LLM intent classification between create-TX and consult | Wrong guess silently turns a transaction into an analytics answer |
| AI extraction | Groq (`openai/gpt-oss-120b`) primary, Anthropic fallback, tool calling (flat schema, no nested `$ref`) | Prose JSON schemas unreliable |
| Mobile | Expo SDK 54 pinned; TanStack Query + Zustand; direct axios to backend (no BFF) | CLAUDE.md |
| Frontend priority | `frontend/` web is feature-complete-first, but F-13.1 and new AI chat work are mobile-first by decision | `docs/features.md` |

---

## Established Patterns (follow these)

### Backend
- Handler: parse + shape validation → service. Service: business rules + DB tx. Repository: sqlc only.
- Each service has `fake_*_repo_test.go` in-memory fakes for unit tests.
- Route comments in `routes.go` cite the spec/plan finding justifying auth/order decisions — keep the trail. Literal-path GETs must precede `/:id`.
- AI Service calls go through `service/ai_service_client.go` / `ai_budget_client.go` (internal REST to `http://ai-service:8000`).
- Migrations: new file needs a mount line in **both** `docker-compose.yml` and `backend/docker-compose.yml`; `cmd/migrate` runs on deploy, so migrations must be re-runnable (`IF EXISTS`/`IF NOT EXISTS`).

### Mobile (`mobile/`, React Native + Expo)
- `app/` thin routes → `src/features/{feature}/{api,components,hooks}` + `types.ts`.
- Shared primitives: `src/components/ui/` (`MoneySlider`, `Icon`…), `src/components/shared/` (`DonutChart`, `SegmentedBar`…).
- Server data in TanStack Query only; Zustand for client state (session, chat mode).
- All user-facing copy in Vietnamese.

### SQL
- Money `BIGINT NOT NULL`; timestamps `TIMESTAMPTZ`; soft delete `deleted_at`; `uuid_generate_v4()`; every query scoped `AND user_id = $n`.

---

## Current Schema (migrations applied)

| # | Migration | Key Changes |
|---|-----------|-------------|
| 001 | init | `users`, uuid-ossp + pgvector |
| 002 | seed_admin | admin seed |
| 003 | revoked_tokens | token revocation |
| 004 | wallets | one-default-per-user partial unique idx |
| 005 | categories | owner+name+type unique idx |
| 006 | seed_categories | system categories |
| 007 | budgets | `budgets` + `budget_limits`; `CHECK (period IN ('monthly'))` |
| 008 | transactions | no balance-floor constraint by design |
| 009 | notifications | dedup cols, `budget_exceeded`-only CHECK |
| 010 | transactions_idempotency_key | idempotency key + partial unique idx |
| 011 | chat_messages | AI context log (never read by client) |
| 012 | categories_icon_url | category icon upload |
| 013 | wallets_icon | wallet icon |
| 014 | budgets_icon | budget icon |
| 015 | chat_thread_sync | `chat_thread_messages` opaque `payload TEXT` (client-rendered thread) |
| 016 | transactions_created_at_sort_index | `idx_transactions_user_occurred_at` incl. created_at tie-break |
| 017 | seed_savings_category | "Tiết kiệm" system category |
| 018 | transaction_audit_logs | audit log table |
| 019 | categories_system_key | `system_key` + Vietnamese system categories |
| 020 | budget_plans | plan layer + `effective_from` (**no code writes it yet**) |

---

## API Surface (routes registered — `backend/cmd/server/routes.go`)

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /activate | No | ActivatePageHandler (HTML) |
| GET | /api/v1/health | No | inline |
| POST | /api/v1/auth/activate · /login (rate-limited) · /logout · /refresh | No | AuthHandler |
| POST · GET | /api/v1/admin/users/invite · /admin/users | admin | UserHandler |
| POST · GET · GET · PATCH · POST | /wallets/icon · / · /:id · /:id · /:id/set-default | JWT | WalletHandler |
| POST · POST · GET · GET · PATCH · DELETE | /categories/icon · / · / · /:id · /:id · /:id | JWT | CategoryHandler |
| POST · POST · POST · GET · GET · PATCH · DELETE | /budgets/icon · /bulk · / · / · /:id · /:id · /:id | JWT | BudgetHandler |
| POST · GET | /transactions/ | JWT | TransactionHandler |
| GET | /transactions/audit-logs | JWT | AuditLogHandler |
| GET · POST · POST | /transactions/export · /import/preview · /import/commit | JWT | TransactionExport/ImportHandler |
| GET · PATCH · DELETE | /transactions/:id | JWT | TransactionHandler |
| GET | /reports/summary | JWT | ReportHandler |
| GET · GET · POST | /notifications/ · /:id · /:id/read | JWT | NotificationHandler |
| POST · GET · POST | /ai/chat · /ai/chat/thread · /ai/chat/thread/sync | JWT + AIChatRateLimiter (30/h, whole `/ai` group) | ChatHandler |
| GET · POST · POST | /ai/budget-wizard/prefill · /ai/budget-proposals · /ai/suggest-category-name | JWT + AIChatRateLimiter | BudgetWizardHandler |

All paths under `/api/v1`. No `RequireRole` except `/admin/*`. Notifications are produced only by the background scheduler in `main.go`.

---

## Active TODOs / Known Issues

- [ ] F-13.1 I-1 cycle window + `AppTimezone` (blocking for AI analytics) and I-4 race — `/cook-implementation specs/ai-budget-wizard-v2/`
- [ ] F-13.1 I-2 plan versioning, I-3 US-09 moment-of-spend
- [ ] All period boundaries UTC (`transactions.sql:217`, `report_service.go`, `notification_service.go`) — month rolls over at 07:00 GMT+7
- [ ] `AIChatRateLimiter` applies to the whole `/ai` group — any new consult endpoint must not share it with create-TX
- [ ] Files over 300 lines: `backend/internal/service/chat_service.go` (339), `backend/internal/repository/budget_repository.go` (323)
- [ ] `test_cases.md` missing for most specs
- [ ] `docs/features.md` stale (2026-09-13: still says F-13.1 SPEC_ONLY) — run `/renew-features`
- [ ] Stray `mobile/pfm/` scaffold causes ~40 unrelated tsc errors — leave alone
- [ ] Mobile not verified on real device for recent work
- [ ] No `// TODO:` markers found in `backend/internal`, `ai-service/app`, `mobile/src`, `mobile/app`

---

## Environment / Infra Notes

- Local dev: Docker Compose (root `docker-compose.yml` + `backend/docker-compose.yml`) — backend, ai-service, postgres, web
- DB: PostgreSQL 16-alpine, `${POSTGRES_PORT}` (5432)
- Backend: Go Fiber, `${BACKEND_PORT}` (8090 in `.env.example`, 8080 in container)
- Web: Next.js `${WEB_FRONTEND_PORT}` (8082), BFF proxy
- Mobile: not containerized — `npx expo start`, `EXPO_PUBLIC_API_BASE_URL`; APK via local Gradle/EAS
- AI Service: FastAPI, internal-only `http://ai-service:8000`; Groq `openai/gpt-oss-120b` (`ai-service/app/core/config.py`)
- GitNexus: MCP configured in `.mcp.json`, index at `.gitnexus/` (repo name `pfm` — pass `repo: "pfm"`, several repos are indexed)

---

## Files to Read First for Each Task

| Task | Files to read |
|------|--------------|
| Add new backend feature | `routes.go`, `service/interfaces.go`, closest handler+service+repo (`report_*` for read-only aggregates, `transaction_*` for CRUD, `budget_wizard_*` for AI-adjacent) |
| Add AI chat capability | `service/chat_service.go`, `ai_service_client.go`, `ai-service/app/services/extract_service.py`, `mobile/src/features/ai-chat/chat-mode.ts`, `mobile/app/(app)/ai-chat.tsx` |
| Add new mobile feature | Closest `mobile/src/features/{feature}` (`budget-wizard` most recent) |
| Fix a bug | Relevant `*_service_test.go` / `fake_*_repo_test.go` |
| Update DB schema | `020_budget_plans.sql` + both compose files + `backend/db/queries/*.sql` |
| BA/spec new feature | `SRS.md` §6, `docs/features.md`, `docs/new-tasks.md`, closest spec (`ai-budget-wizard-v2`, `financial-reporting`) |
