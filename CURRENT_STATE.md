# PFM — Current Project State

_Last updated: 2026-08-19_
_Command: /cook-state_

> ⚡ Load file này đầu tiên khi bắt đầu session mới.
> Không edit manual — chạy /cook-state để refresh.

---

## TL;DR — Project Health

- **Phase:** MVP done (backend+web full F-01→F-07, F-10); AI Chat (Feature-12 US-01) done backend+web+mobile; Mobile now has full CRUD on Wallet/Category/Budget/Transaction (this session), matching web's feature depth
- **Overall completion:** MVP 100% backend+web. Mobile: full CRUD on F-03/F-04/F-05/F-06 (this session closed the remaining gaps — Transaction manual create/edit/delete, Category delete, Budget delete); still excludes dedicated Household-Members/Security screens (out of design-handoff scope) and F-01 User Management
- **Last feature shipped:** Mobile Transaction/Category/Budget CRUD completion (this session) — `TransactionFormModal` (manual create+edit+delete, previously AI-Chat-only), Category delete wired to existing unused mutation, Budget delete (new mutation + wiring)
- **Currently in progress:** nothing checked out
- **Next up:** manual verification on-device (`npx expo start`, per `mobile/AGENTS.md` — not verified in this or prior sessions, no emulator/device available); QC coverage gap (FEAT-QC); Feature-12 AI Chat US-02 (edit via chat)/US-03 (query spending) — currently unimplemented at every layer, not just mobile; Financial Goal (F-08) or Data Overview Dashboard (F-11)
- **Blockers:** none

---

## What's Actually Working (Code + DB + UI)

> Backend = Go handler+service+repository tồn tại. Web = frontend/src/features tồn tại. Mobile = mobile/src/features tồn tại.

| Feature | Backend | Web (frontend/) | Mobile |
|---|---|---|---|
| F-01 User Management (invite/activate/list) | ✅ | ✅ (`features/users`) | ❌ (no mobile screen — not in design-handoff scope) |
| F-02 System Security (JWT auth, login/logout) | ✅ | ✅ (`features/auth`) | ✅ login form + mutation (`features/auth`), no `/auth/refresh` on any client |
| F-03 Wallet Management | ✅ | ✅ (`features/wallets`) | ✅ full CRUD (Profile → Wallets: create/edit modal, set-default) |
| F-04 Category Management | ✅ | ✅ (`features/categories`) | ✅ full CRUD (Profile → Categories: create/edit/delete modal, 409 CATEGORY_IN_USE surfaced) |
| F-05 Budget Management | ✅ (per-currency `budget_limits` child table) | ✅ (`features/budgets`) | ✅ full CRUD (Insights → Budgets tab: create/edit/delete modal) |
| F-06 Transaction Management | ✅ (atomic wallet-balance update) | ✅ (`features/transactions`) | ✅ full CRUD (manual `+` on Transactions screen + tap-to-edit/delete on Home/Transactions rows, alongside AI Chat create) |
| F-07 Financial Reporting (summary) | ✅ (`report_handler/service/repository`, aggregate queries reuse `transactions.sql`) | ✅ (`features/reports`) | ✅ (Insights → Spending tab: stat cards + clickable SVG donut chart + legend) |
| F-10 Notification Handling | ✅ (background scheduler) | ✅ (`features/notifications`) | ✅ (bell → full-screen Notifications overlay, day-grouped, unread toggle) |
| Feature-12 AI Chat (US-01 create-via-chat) | ✅ | ✅ (`features/ai-chat`) | ✅ (raised nav button → AI Chat screen, transaction-card confirm reuses `POST /transactions`) |

**2026-08-16: `mobile/` was deleted and rebuilt from scratch as React Native (Expo)**, replacing the previous Flutter app (which had shipped F-01/F-02 mobile screens — those are gone, not carried over). Later the same session, the full screen set above was built against `mobile/design_handoff_pfm_app/`. Not built: a dedicated Household-Members/Security screen (design handoff maps these as inert Profile entry-point rows only) and F-01 User Management.

**2026-08-19: closed the remaining mobile CRUD gaps** — `TransactionFormModal.tsx` (new: manual create, previously only reachable via AI Chat; plus edit and delete, previously nonexistent), Category delete (wired the already-existing but unused `use-delete-category-mutation.ts` into `CategoryFormModal.tsx`), Budget delete (new `use-delete-budget-mutation.ts` + wired into `NewBudgetModal.tsx`). Wallet was already full CRUD before this session — `CURRENT_STATE.md`'s prior "read-only" note for Wallet/Category was stale relative to the code even before today.

---

## Partial / In Progress

- 🔶 **QC coverage** — `specs/wallet-management/`, `specs/category-management/`, `specs/budget-management/`, `specs/transaction-management/`, `specs/financial-reporting/`, `specs/notification-handling/` đều có `spec.md` + `plan.md` nhưng **chưa có `test_cases.md`** (chỉ `user-management` và `security` có). Backend có unit test files (`*_service_test.go`) cho tất cả, nhưng chưa chạy `/cook-qc` chính thức cho các feature này.
- 🔶 **Mobile on-device verification** — screens were type-checked (`tsc --noEmit`), linted (`expo lint`), and smoke-built (`expo export --platform web`, 868 modules, no bundler errors) but **not visually verified in Expo Go/an emulator** — no device/emulator available in this session. Run `npx expo start` and check against `mobile/design_handoff_pfm_app/PFM App.dc.html` before treating pixel-fidelity as confirmed.

---

## Specced, Not Yet Coded

> Có spec.md/plan.md nhưng backend chưa có handler/service tương ứng.

- Không có — tất cả 8 spec hiện tại (user-management, security, wallet, category, budget, transaction, financial-reporting, notification-handling) đều đã có code, plus `ai-chat-assistant` (Feature-12 US-01).

---

## Key Technical Decisions (không được thay đổi)

| Decision | Value | Reason |
|----------|-------|--------|
| Money storage | BIGINT cents (÷100 at display) | Float precision |
| JWT strategy | access (15m) + refresh (7d), revoked_tokens table for logout | No Redis dependency for MVP |
| No `/auth/refresh` endpoint | 401 → force re-login | Not implemented yet (see Active TODOs) |
| DB access | sqlc only, no ORM | Type safety |
| Error format | `{error_code, message, details?}` | Consistent with all handlers |
| Cursor pagination | cursor-based (`{id, created_at}` base64) | Scale-ready, not offset |
| Wallet default | DB partial-unique index (`idx_wallets_one_default_per_user`), not just service logic | Prevents race on concurrent set-default |
| Budget scope | 1 active budget per (user, category), per-currency limits in child table `budget_limits` | sqlc typed-Go gen doesn't play well with JSONB |
| Transaction balance floor | Enforced only via conditional `DecrementWalletBalanceIfSufficient` query at Create — **no CHECK constraint** on wallets/transactions | Update/Delete must allow negative balance per spec (S-TRX-38, S-TRX-50) |
| Category dedup | `(user_id, lower(name), type)` unique index with `NULLS NOT DISTINCT` (PG15+) | Blocks dup system categories too; cross-scope (user vs system) collision is service-level only |
| Report aggregates | No new `reports` table/migration — `ReportRepository` reuses queries owned by `transactions.sql`, mirroring `BudgetRepository.SpentByUserCurrentPeriod` | Cross-repository query reuse is an accepted exception, not a violation of "repository owns its table" |
| Frontend priority | `frontend/` (Next.js web) feature-complete-first; `mobile/` builds only on explicit request | Explicit instruction in CLAUDE.md — this session is that explicit request |
| Mobile framework | React Native (Expo SDK 54, pinned — see `mobile/AGENTS.md`) | Replaced Flutter 2026-08-16, user-directed |
| Mobile state | TanStack Query (server state) + Zustand (client/global state) | Same pairing as `frontend/` — one mental model across clients |
| Mobile design source | `mobile/design_handoff_pfm_app/PFM App.dc.html` + `README.md` (dark "Noctis" theme) | High-fidelity handoff — treat as spec, recreate with RN components, not by copying the file's markup |

---

## Established Patterns (follow these)

### Backend
- Handler chỉ parse + validate + call service → return response
- Service owns business logic + DB transaction boundary (e.g. transaction create = insert + wallet balance update atomic)
- Repository: sqlc-generated queries only (`backend/db/queries/*.sql` → gen)
- Cross-repository query reuse is allowed when a new feature only *aggregates* existing tables (no new schema) — e.g. `ReportRepository` calling queries defined in `transactions.sql`; document the exception in a doc comment like `report_repository.go` does
- Error: `common/` error codes → returned as `{error_code, message}`
- Each service has a paired `fake_*_repo_test.go` for unit tests (in-memory fake, no real DB)
- Route registration comments in `routes.go` reference the specific plan.md finding that justified auth/role choices — keep that trail when adding new route groups

### Web (frontend/)
- `features/{feature}/api/use-*-query.ts` and `use-*-mutation.ts` — TanStack Query hooks
- `features/{feature}/components/` — table + skeleton + create/edit/delete dialogs pattern (see `wallets`, `categories`, `budgets`, `transactions` for the template); read-only aggregate features (e.g. `reports`) use filters + summary cards + breakdown table instead
- `features/{feature}/types.ts` — shared types
- Route pages under `app/app/{feature}/page.tsx` and `app/app/{feature}/[id]/page.tsx`
- API calls proxy through `app/api/proxy/[...path]/route.ts` (BFF pattern) — dio/axios talk to Go backend via this proxy, not directly

### Mobile (`mobile/`, React Native + Expo)
- `app/` — Expo Router file-based routes, thin, compose from `src/features`
- `src/features/{feature}/{api,components}` + `types.ts` — TanStack Query hooks (`use-*-query.ts`/`use-*-mutation.ts`), same convention as `frontend/`
- `src/lib/axios.ts` — direct-to-backend client (no BFF), JWT interceptor, force-logout on 401
- `src/components/{ui,shared}` — reusable primitives (theme tokens, buttons, cards, icon circles, bottom nav)
- `src/stores/` — Zustand, global state only (session), never server data

### SQL
- All money columns: `BIGINT NOT NULL` (+ `CHECK (amount > 0)` where relevant)
- All timestamps: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- Soft delete: `deleted_at TIMESTAMPTZ` on all financial-record tables (not on `revoked_tokens` — inert, cleanup job only)
- All IDs: `UUID DEFAULT uuid_generate_v4()`
- Migrations are also wired directly into `docker-compose.yml` postgres `docker-entrypoint-initdb.d/` mounts — adding a new migration file means adding a mount line too

---

## Current Schema (migrations applied)

| # | Migration | Key Changes |
|---|-----------|-------------|
| 001 | init | `users` table, uuid-ossp + pgvector extensions |
| 002 | seed_admin | admin user seed (manual, not automated) |
| 003 | revoked_tokens | logout/refresh-token revocation table |
| 004 | wallets | `wallets` table, one-default-per-user partial unique index |
| 005 | categories | `categories` table, owner+name+type unique index |
| 006 | seed_categories | 10 default system categories (income+expense) |
| 007 | budgets | `budgets` + `budget_limits` (per-currency child table) |
| 008 | transactions | `transactions` table, no balance-floor constraint (by design) |
| 009 | notifications | `notifications` table + dedup columns (`related_budget_id`/`currency`/`period_start`) |
| 010 | transactions_idempotency_key | additive `idempotency_key` column + partial unique index on `transactions` |
| 011 | chat_messages | `chat_messages` table (Feature-12 AI Chat) |

F-07 Financial Reporting added zero schema (no migration) — only new aggregate queries in `transactions.sql`.

---

## API Surface (routes registered — `backend/cmd/server/routes.go`)

| Method | Path | Auth | Role | Handler |
|--------|------|------|------|---------|
| POST | /api/v1/auth/activate | No | - | AuthHandler.Activate |
| POST | /api/v1/auth/login | No (rate-limited) | - | AuthHandler.Login |
| POST | /api/v1/auth/logout | No | - | AuthHandler.Logout |
| POST | /api/v1/admin/users/invite | Yes | admin | UserHandler.InviteUser |
| GET | /api/v1/admin/users | Yes | admin | UserHandler.ListUsers |
| POST | /api/v1/wallets/ | Yes | any | WalletHandler.CreateWallet |
| GET | /api/v1/wallets/ | Yes | any | WalletHandler.ListWallets |
| GET | /api/v1/wallets/:id | Yes | any | WalletHandler.GetWallet |
| PATCH | /api/v1/wallets/:id | Yes | any | WalletHandler.UpdateWallet |
| POST | /api/v1/wallets/:id/set-default | Yes | any | WalletHandler.SetDefaultWallet |
| POST | /api/v1/categories/ | Yes | any | CategoryHandler.CreateCategory |
| GET | /api/v1/categories/ | Yes | any | CategoryHandler.ListCategories |
| GET | /api/v1/categories/:id | Yes | any | CategoryHandler.GetCategory |
| PATCH | /api/v1/categories/:id | Yes | any | CategoryHandler.UpdateCategory |
| DELETE | /api/v1/categories/:id | Yes | any | CategoryHandler.DeleteCategory |
| POST | /api/v1/budgets/ | Yes | any | BudgetHandler.CreateBudget |
| GET | /api/v1/budgets/ | Yes | any | BudgetHandler.ListBudgets |
| GET | /api/v1/budgets/:id | Yes | any | BudgetHandler.GetBudget |
| PATCH | /api/v1/budgets/:id | Yes | any | BudgetHandler.UpdateBudget |
| DELETE | /api/v1/budgets/:id | Yes | any | BudgetHandler.DeleteBudget |
| POST | /api/v1/transactions/ | Yes | any | TransactionHandler.CreateTransaction |
| GET | /api/v1/transactions/ | Yes | any | TransactionHandler.ListTransactions |
| GET | /api/v1/transactions/:id | Yes | any | TransactionHandler.GetTransaction |
| PATCH | /api/v1/transactions/:id | Yes | any | TransactionHandler.UpdateTransaction |
| DELETE | /api/v1/transactions/:id | Yes | any | TransactionHandler.DeleteTransaction |
| GET | /api/v1/reports/summary | Yes | any | ReportHandler.GetSummary |
| GET | /api/v1/notifications/ | Yes | any | NotificationHandler.ListNotifications |
| GET | /api/v1/notifications/:id | Yes | any | NotificationHandler.GetNotification |
| POST | /api/v1/notifications/:id/read | Yes | any | NotificationHandler.MarkNotificationRead |
| POST | /api/v1/ai/chat | Yes (+ AIChatRateLimiter) | any | ChatHandler.Chat |

Wallets/categories/budgets/transactions/reports/notifications/ai groups have **no `RequireRole` gate** — every active user manages/views only their own data (`user_id` scoping in service layer), only `/admin/*` requires `role=admin`. There is no notification-creation endpoint — notifications are produced only by a background scheduler (`main.go`).

---

## Active TODOs / Known Issues

- [ ] `/auth/refresh` endpoint chưa implement — hiện tại 401 = force re-login (không phải bug, là quyết định MVP); worse UX impact on mobile than web
- [ ] `test_cases.md` thiếu cho wallet/category/budget/transaction/financial-reporting/notification-handling — chạy `/cook-qc` cho từng feature
- [ ] Mobile: screens not yet verified on-device/emulator (`npx expo start`) — only type-checked/linted/web-exported across both mobile sessions so far, no emulator available
- [ ] Mobile: no offline/local-DB layer — TanStack Query cache is the only client persistence
- [ ] Mobile: no dedicated Household-Members/Security screens — Profile rows for these are inert (design-handoff scope only)
- [ ] Feature-12 AI Chat US-02 (edit-via-chat)/US-03 (query-spending) intents are unimplemented at every layer (ai-service/backend/web/mobile) — only `create_transaction`/`ambiguous` exist in `ChatResponse.intent` today
- [ ] Root có untracked `clear-port.md` (personal PowerShell helper để free port 8080/8081/8082, không phải project code — không cần commit)

---

## Environment / Infra Notes

- Local dev: Docker Compose (`docker-compose.yml`, root)
- DB: PostgreSQL 16-alpine, port `${POSTGRES_PORT}` (5432 in `.env.example`)
- Backend: Go Fiber, port `${BACKEND_PORT}` (8090 in `.env.example`)
- Web (Next.js, `frontend/`): port `${WEB_FRONTEND_PORT}` (8082) — labeled `web` service in compose, BFF-proxies `/api/proxy/*` → `http://backend:8080`
- Mobile (`mobile/`, React Native/Expo): **not** a compose service — dev flow is `npx expo start` (Metro bundler + Expo Go/simulator), calls the backend directly (no BFF), no local port to configure beyond `EXPO_PUBLIC_API_BASE_URL`
- AI Service (`ai-service/`, Python FastAPI): containerized, internal-only (no host port), reachable at `http://ai-service:8000` from the backend via `AI_SERVICE_URL`
- Migrations mounted directly as `docker-entrypoint-initdb.d/*` scripts on the postgres service (no golang-migrate runner wired into compose yet — new migration files need a corresponding compose mount line; a migration added after the dev volume was first initialized needs a manual `psql <` apply, hit live with `009_notifications.sql`)

---

## Files to Read First for Each Task

| Task | Files to read |
|------|--------------|
| Add new backend feature | `backend/cmd/server/routes.go`, `backend/internal/service/interfaces.go`, closest existing handler + service + repository (`report_*` is most recent — good template for read-only aggregate features; `transaction_*` for full CRUD) |
| Add new web feature | Closest existing `frontend/src/features/{feature}` (`reports` for read-only aggregate UI; `transactions` or `budgets` for full CRUD: query+mutation hooks, table+skeleton, create/edit/delete dialogs) |
| Add new mobile feature | Closest existing `mobile/src/features/{feature}` once one exists, else mirror `frontend/src/features/{feature}` type names/shapes 1:1 (CLAUDE.md: keep DTOs hand-synced across backend/frontend/mobile) |
| Fix a bug | Relevant `*_service_test.go` / `fake_*_repo_test.go` in `backend/internal/service/` |
| Update DB schema | Latest migration file (`008_transactions.sql`) + corresponding `docker-compose.yml` mount + `backend/db/queries/*.sql` |
| BA/spec new feature (F-10) | `docs/features.md`, closest existing `specs/{feature}/spec.md` (`financial-reporting` is most recent/thorough template) |
