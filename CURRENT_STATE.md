# PFM — Current Project State

_Last updated: 2026-08-03_
_Command: /cook-state_

> ⚡ Load file này đầu tiên khi bắt đầu session mới.
> Không edit manual — chạy /cook-state để refresh.

---

## TL;DR — Project Health

- **Phase:** MVP (F-01 → F-06 done backend+web, F-07/F-10 remaining)
- **Overall completion:** ~75% của MVP scope (6/8 MVP features có backend, 6/8 có web frontend, 2/8 có mobile)
- **Last feature shipped:** Transaction Management (backend + web frontend + slash-command tooling enhancement)
- **Currently in progress:** nothing checked out — repo is clean except untracked `README.md`
- **Next up:** F-07 Financial Reporting (summary) hoặc F-10 Notification Handling — cả hai chưa có handler/service/migration nào
- **Blockers:** none

---

## What's Actually Working (Code + DB + UI)

> Backend = Go handler+service+repository tồn tại. Web = frontend/src/features tồn tại. Mobile = mobile/lib/features tồn tại.

| Feature | Backend | Web (frontend/) | Mobile |
|---|---|---|---|
| F-01 User Management (invite/activate/list) | ✅ | ✅ (`features/users`) | ✅ (`features/admin`) |
| F-02 System Security (JWT auth, login/logout) | ✅ | ✅ (`features/auth`) | ✅ (`features/auth`) |
| F-03 Wallet Management | ✅ | ✅ (`features/wallets`) | ❌ |
| F-04 Category Management | ✅ | ✅ (`features/categories`) | ❌ |
| F-05 Budget Management | ✅ (per-currency `budget_limits` child table) | ✅ (`features/budgets`) | ❌ |
| F-06 Transaction Management | ✅ (atomic wallet-balance update) | ✅ (`features/transactions`) | ❌ |

Mobile chỉ implement Phase 0 (F-01/F-02) — đúng với ghi chú trong CLAUDE.md rằng `mobile/` đang paused, việc build tiếp mobile cho F-03→F-06 cần được yêu cầu rõ ràng.

---

## Partial / In Progress

- 🔶 **QC coverage** — `specs/wallet-management/`, `specs/category-management/`, `specs/budget-management/`, `specs/transaction-management/` đều có `spec.md` + `plan.md` nhưng **chưa có `test_cases.md`** (chỉ `user-management` và `security` có). Backend có unit test files (`*_service_test.go`) cho tất cả, nhưng chưa chạy `/cook-qc` chính thức cho 4 feature này.
- 🔶 **docs/features.md** — chỉ cover Phase 0 (US-01→US-05), chưa list F-03→F-11. Cần `/renew-features` để đồng bộ với state thực tế.

---

## Specced, Not Yet Coded

> Có spec.md/plan.md nhưng backend chưa có handler/service tương ứng.

- Không có — tất cả 6 spec hiện tại (user-management, security, wallet, category, budget, transaction) đều đã có code.
- F-07 (Reporting) và F-10 (Notification) **chưa có spec.md** — cần chạy `/cook-ba` trước.

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
| Frontend priority | `frontend/` (Next.js web) built first; `mobile/` (Flutter) paused | Explicit instruction in CLAUDE.md |
| Mobile state | Riverpod code-gen (`.g.dart`) | Established in F-01/F-02 mobile code |

---

## Established Patterns (follow these)

### Backend
- Handler chỉ parse + validate + call service → return response
- Service owns business logic + DB transaction boundary (e.g. transaction create = insert + wallet balance update atomic)
- Repository: sqlc-generated queries only (`backend/db/queries/*.sql` → gen)
- Error: `common/` error codes → returned as `{error_code, message}`
- Each service has a paired `fake_*_repo_test.go` for unit tests (in-memory fake, no real DB)
- Route registration comments in `routes.go` reference the specific plan.md finding that justified auth/role choices — keep that trail when adding new route groups

### Web (frontend/)
- `features/{feature}/api/use-*-query.ts` and `use-*-mutation.ts` — TanStack Query hooks
- `features/{feature}/components/` — table + skeleton + create/edit/delete dialogs pattern (see `wallets`, `categories`, `budgets`, `transactions` for the template)
- `features/{feature}/types.ts` — shared types
- Route pages under `app/app/{feature}/page.tsx` and `app/app/{feature}/[id]/page.tsx`
- API calls proxy through `app/api/proxy/[...path]/route.ts` (BFF pattern) — dio/axios talk to Go backend via this proxy, not directly

### Mobile (paused, F-01/F-02 only)
- `features/{feature}/domain` → `data` → `presentation/{pages,providers,widgets}`
- Riverpod `@riverpod` + code-gen (`.g.dart`)
- `core/api/dio_client.dart` — shared dio client, `session_events.dart` handles force-logout on 401

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

Wallets/categories/budgets/transactions groups have **no `RequireRole` gate** — every active user manages only their own data (`user_id` scoping in service layer), only `/admin/*` requires `role=admin`.

---

## Active TODOs / Known Issues

- [ ] `/auth/refresh` endpoint chưa implement — hiện tại 401 = force re-login (không phải bug, là quyết định MVP)
- [ ] `test_cases.md` thiếu cho wallet/category/budget/transaction-management — chạy `/cook-qc` cho từng feature
- [ ] `docs/features.md` chỉ cover Phase 0 — chạy `/renew-features` để sync F-03→F-11
- [ ] F-07 Financial Reporting: chưa có spec.md — cần `/cook-ba`
- [ ] F-10 Notification Handling: chưa có spec.md, chưa có `notifications` table migration — cần `/cook-ba`
- [ ] `ai-service/` (Python FastAPI) directory chưa tồn tại — AI Service chưa bắt đầu
- [ ] Mobile F-03→F-06 (wallet/category/budget/transaction) chưa build — paused theo CLAUDE.md, cần yêu cầu rõ ràng để resume
- [ ] Root có untracked `README.md` chưa commit (theo git status đầu session)

---

## Environment / Infra Notes

- Local dev: Docker Compose (`docker-compose.yml`, root)
- DB: PostgreSQL 16-alpine, port `${POSTGRES_PORT}` (5432 in `.env.example`)
- Backend: Go Fiber, port `${BACKEND_PORT}` (8090 in `.env.example`)
- Mobile (Flutter web build): served via nginx, port `${FRONTEND_PORT}` (8081) — labeled `frontend` service in compose but is the Flutter build, don't confuse with `web`
- Web (Next.js, `frontend/`): port `${WEB_FRONTEND_PORT}` (8082) — labeled `web` service in compose, BFF-proxies `/api/proxy/*` → `http://backend:8080`
- AI Service: not started, no `ai-service/` directory yet
- Migrations mounted directly as `docker-entrypoint-initdb.d/*` scripts on the postgres service (no golang-migrate runner wired into compose yet — new migration files need a corresponding compose mount line)

---

## Files to Read First for Each Task

| Task | Files to read |
|------|--------------|
| Add new backend feature | `backend/cmd/server/routes.go`, `backend/internal/service/interfaces.go`, closest existing handler + service + repository (transaction_* is most recent/most complete example) |
| Add new web feature | Closest existing `frontend/src/features/{feature}` (transactions or budgets are most complete: query+mutation hooks, table+skeleton, create/edit/delete dialogs) |
| Add new mobile feature | `mobile/lib/features/admin/` (only fully-built non-auth example) — but confirm resuming mobile work is actually wanted first (it's paused) |
| Fix a bug | Relevant `*_service_test.go` / `fake_*_repo_test.go` in `backend/internal/service/` |
| Update DB schema | Latest migration file (`008_transactions.sql`) + corresponding `docker-compose.yml` mount + `backend/db/queries/*.sql` |
| BA/spec new feature (F-07, F-10) | `docs/features.md`, closest existing `specs/{feature}/spec.md` (transaction-management is most recent/thorough template) |
