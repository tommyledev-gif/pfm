# PFM — Architecture Design

_Last updated: 2026-09-13_
_Updated by: /renew-docs_

> Source of truth: read from the actual codebase (`docker-compose.yml`, `go.mod`, `routes.go`, `db/migrations/`, `package.json`, `requirements.txt`), not from design intent. Every version and route below was verified in-file this run.

---

## 1. System Overview

```
[React Native / Expo app]        [Next.js web app]
   (mobile/, not in Docker)        (frontend/, :3000)
            │                              │
            │ HTTPS, JWT Bearer            │ same-origin /api/proxy/*  (BFF)
            │ direct to backend            ▼
            └───────────────────────► [Go + Fiber backend :8080]
                                              │            │
                                              │            └── REST (internal) ──► [Python FastAPI AI Service :8000]
                                              ▼                                              │
                                     [PostgreSQL 16]                                  Groq (primary)
                                                                                      Anthropic (fallback)
                                              │
                                              └── S3 API ──► [Cloudflare R2]  (uploaded icons)
```

**Active services** (root `docker-compose.yml` — local dev):

| Service | Image / Build | Host port | Notes |
|---------|---------------|-----------|-------|
| `postgres` | `postgres:16-alpine` | `${POSTGRES_PORT}` → 5432 | Named volume `pfm_pgdata`; migrations mounted individually into `docker-entrypoint-initdb.d` |
| `backend` | build `./backend` | `${BACKEND_PORT}` → 8080 | Waits on `postgres` healthcheck |
| `ai-service` | build `./ai-service` | **none** | Internal only — reachable at `http://ai-service:8000` on the compose network |
| `web` | build `./frontend` | `${WEB_FRONTEND_PORT}` → 3000 | `API_PROXY_TARGET=http://backend:8080` |

`backend/docker-compose.yml` is a **separate production compose** deployed to the VPS (container names `pfm-*`, images pulled from a registry, memory limits, Postgres bound to `127.0.0.1`, backend published on port 80). It is not used locally.

**`mobile/` is deliberately not containerized.** Expo's dev flow is `npx expo start` (Metro + dev client), not a served container.

---

## 2. Backend Architecture

**Go 1.23.0** · **Fiber v2.52.5** · **pgx/v5 v5.6.0** · **sqlc** (config `backend/sqlc.yaml`, `sql_package: pgx/v5`, `emit_pointers_for_null_types: true`)

### Layer structure

```
cmd/server/
  main.go        — DI wiring, notification ticker, graceful shutdown
  routes.go      — every route registration
  hashgen/       — bcrypt hash helper for the admin seed
internal/
  handler/       — HTTP only: parse, validate shape, format response
  service/       — business rules, owns DB transactions
    budgetproposal/ — F-13 allocation engine (pure arithmetic, no AI call)
  repository/    — data access
    sqlc/        — generated, do not edit
  model/         — domain structs
  dto/           — request/response shapes
  middleware/    — jwt_auth, rate_limit, require_role
  common/        — constants, errors, money, redact, transaction_io
  config/        — env loading
  response/      — standard envelope + Fiber error mapping
db/
  migrations/    — 001…018
  queries/       — .sql source for sqlc
```

### API routes (from `cmd/server/routes.go`)

| Method | Path | Middleware | Handler |
|--------|------|-----------|---------|
| GET | `/activate` | — | `ActivatePageHandler` (HTML form, served off the backend domain) |
| GET | `/api/v1/health` | — | inline — deploy probe, no DB call |
| POST | `/api/v1/auth/activate` | — | `AuthHandler.Activate` |
| POST | `/api/v1/auth/login` | `LoginRateLimiter` | `AuthHandler.Login` |
| POST | `/api/v1/auth/logout` | — | `AuthHandler.Logout` |
| POST | `/api/v1/auth/refresh` | — | `AuthHandler.Refresh` — also the mobile account switch since 2026-10-19 |
| GET · DELETE | `/api/v1/auth/sessions` · `/api/v1/auth/sessions/:id` | `JWTAuth` | Device list · sign out one device (2026-10-19) |
| POST | `/api/v1/auth/sessions/revoke-all` | `JWTAuth` | `SessionRevocationHandler.RevokeAllSelf` |
| POST | `/api/v1/auth/switch-token` · `/switch` · `/switch-token/revoke` | `JWTAuth` · `SwitchRateLimiter` · — | `AccountSwitchHandler` — **deprecated 2026-10-19**, older app builds only |
| PUT | `/api/v1/users/me/password` | `JWTAuth` → per-user failed-try limiter | Change password (2026-10-19) |
| POST | `/api/v1/admin/users/invite` | `JWTAuth` → `RequireRole(admin)` → `InviteRateLimiter` | `UserHandler.InviteUser` |
| GET | `/api/v1/admin/users` | `JWTAuth` → `RequireRole(admin)` | `UserHandler.ListUsers` |
| POST | `/api/v1/wallets/icon` | `JWTAuth` | `WalletHandler.UploadIcon` |
| POST · GET | `/api/v1/wallets/` | `JWTAuth` | `CreateWallet` · `ListWallets` |
| GET · PATCH | `/api/v1/wallets/:id` | `JWTAuth` | `GetWallet` · `UpdateWallet` |
| POST | `/api/v1/wallets/:id/set-default` | `JWTAuth` | `SetDefaultWallet` |
| POST | `/api/v1/categories/icon` | `JWTAuth` | `CategoryHandler.UploadIcon` |
| POST · GET | `/api/v1/categories/` | `JWTAuth` | `CreateCategory` · `ListCategories` |
| GET · PATCH · DELETE | `/api/v1/categories/:id` | `JWTAuth` | `GetCategory` · `UpdateCategory` · `DeleteCategory` |
| POST | `/api/v1/budgets/icon` | `JWTAuth` | `BudgetHandler.UploadIcon` |
| POST | `/api/v1/budgets/bulk` | `JWTAuth` | `BulkCreateBudgets` (F-13 wizard submit) |
| POST · GET | `/api/v1/budgets/` | `JWTAuth` | `CreateBudget` · `ListBudgets` |
| GET · PATCH · DELETE | `/api/v1/budgets/:id` | `JWTAuth` | `GetBudget` · `UpdateBudget` · `DeleteBudget` |
| POST · GET | `/api/v1/transactions/` | `JWTAuth` | `CreateTransaction` · `ListTransactions` |
| GET | `/api/v1/transactions/audit-logs` | `JWTAuth` | `AuditLogHandler.ListAuditLogs` |
| GET | `/api/v1/transactions/export` | `JWTAuth` | `TransactionExportHandler.ExportTransactions` |
| POST | `/api/v1/transactions/import/preview` | `JWTAuth` | `TransactionImportHandler.Preview` |
| POST | `/api/v1/transactions/import/commit` | `JWTAuth` | `TransactionImportHandler.Commit` |
| GET · PATCH · DELETE | `/api/v1/transactions/:id` | `JWTAuth` | `GetTransaction` · `UpdateTransaction` · `DeleteTransaction` |
| GET | `/api/v1/reports/summary` | `JWTAuth` | `ReportHandler.GetSummary` — one endpoint covers US-01…US-05 |
| GET | `/api/v1/notifications/` | `JWTAuth` | `ListNotifications` |
| GET | `/api/v1/notifications/:id` | `JWTAuth` | `GetNotification` |
| POST | `/api/v1/notifications/:id/read` | `JWTAuth` | `MarkNotificationRead` |
| POST | `/api/v1/ai/chat` | `JWTAuth` → `AIChatRateLimiter` | `ChatHandler.Chat` |
| GET | `/api/v1/ai/chat/thread` | `JWTAuth` → `AIChatRateLimiter` | `ChatHandler.GetThread` |
| POST | `/api/v1/ai/chat/thread/sync` | `JWTAuth` → `AIChatRateLimiter` | `ChatHandler.SyncThread` |
| GET | `/api/v1/ai/budget-wizard/prefill` | `JWTAuth` → `AIChatRateLimiter` | `BudgetWizardHandler.Prefill` — no AI call |
| POST | `/api/v1/ai/budget-proposals` | `JWTAuth` → `AIChatRateLimiter` | `BudgetWizardHandler.Proposals` — no AI call |
| POST | `/api/v1/ai/suggest-category-name` | `JWTAuth` → `AIChatRateLimiter` | `BudgetWizardHandler.SuggestCategoryName` — **the only wizard route that calls the AI Service** |

**Two ordering rules the file itself flags, both load-bearing:**
1. `JWTAuth` must precede `RequireRole` and both user-keyed rate limiters — the role and user ID come from the token.
2. Every literal path under `/transactions` (`/audit-logs`, `/export`) must be registered **before** `GET /:id`; Fiber matches in registration order, so otherwise `:id` binds the literal and the request 400s on a UUID parse.

### Notification background job

`main.go` starts a `time.NewTicker(common.NotificationJobInterval)` (**5 minutes**) in a goroutine, cancelled via `schedulerCtx` on shutdown. Notifications have **no create endpoint** — the job is the only producer.

### Database schema

PostgreSQL 16. Migrations are plain numbered `.sql` (no `.up`/`.down` pair), mounted individually into `docker-entrypoint-initdb.d` — **so they run once, on first volume initialization only.** An existing environment needs them applied by hand.

| # | File | What it adds |
|---|------|--------------|
| 001 | `init.sql` | `users`, uuid extension |
| 002 | `seed_admin.sql` | **Not auto-mounted** — manual placeholder-hash script |
| 003 | `revoked_tokens.sql` | Refresh-token revocation |
| 004 | `wallets.sql` | `wallets` + one-default-wallet partial unique index |
| 005 | `categories.sql` | `categories` + owner/name/type dedup index |
| 006 | `seed_categories.sql` | 10 system categories — **English names** (`Food`, `Rent`, `Transport`, `Utilities`, `Entertainment`, `Shopping`, `Health`, `Salary`, `Bonus`, `Investment`) |
| 007 | `budgets.sql` | `budgets` + `budget_limits` (one row per currency) |
| 008 | `transactions.sql` | `transactions` (`occurred_at`, not `transaction_date`) |
| 009 | `notifications.sql` | `notifications` + `CHECK` and dedup index **hardcoded to `type='budget_exceeded'`** |
| 010 | `transactions_idempotency_key.sql` | Guards double-confirm from the chat card |
| 011 | `chat_messages.sql` | AI chat history |
| 012 | `categories_icon_url.sql` | Uploaded-photo icon |
| 013 | `wallets_icon.sql` | Wallet icon/photo |
| 014 | `budgets_icon.sql` | Budget icon/photo, independent of its Category's |
| 015 | `chat_thread_sync.sql` | `chat_thread_messages` — client-thread restore |
| 016 | `transactions_created_at_sort_index.sql` | Sort index |
| 017 | `seed_savings_category.sql` | System `Tiết kiệm` category (the one Vietnamese-named seed) |
| 018 | `transaction_audit_logs.sql` | `transaction_audit_logs` |

> ⚠️ **Known drift, documented in both compose files:** 015–018 were absent from the initdb mount lists, so even a fresh volume came up without `chat_thread_messages` and `transaction_audit_logs`, and `/ai/chat/thread`, `/transactions/audit-logs` and `POST /transactions` all returned 500 (SQLSTATE 42P01). The mounts are fixed; **already-running environments still need 015–018 applied manually.**

---

## 3. Mobile Architecture

**Expo SDK ^54.0.36** · **React Native 0.81.5** · **React 19.1.0** · **TypeScript ~5.9.2**

> SDK 54 is pinned deliberately, **not** because it is latest (57 exists). The Play Store's Expo Go reported `54.0.8` / "supported SDK 54" on the tester's own device; SDK 56 and 57 were both confirmed unavailable in the stores. Full reasoning in `mobile/AGENTS.md` — do not bump without a fresh on-device reading of Expo Go's Profile tab.

### Routing — Expo Router, file-based

| Route | File | Guard |
|-------|------|-------|
| `/login` | `app/(auth)/login.tsx` | unauthenticated group |
| `/` | `app/(app)/index.tsx` | authenticated — Home |
| `/transactions` | `app/(app)/transactions.tsx` | authenticated |
| `/insights` | `app/(app)/insights.tsx` | authenticated — Spending + Budgets tabs |
| `/ai-chat` | `app/(app)/ai-chat.tsx` | authenticated |
| `/settings` | `app/(app)/settings.tsx` | authenticated |
| `/wallets` · `/categories` | `app/(app)/…` | authenticated |
| `/notifications` · `/audit-log` · `/developer` | `app/(app)/…` | authenticated |
| `/users` | `app/(app)/users.tsx` | authenticated; row hidden for non-admins (server-side `RequireRole` is the real boundary) |

`app/_layout.tsx` holds the providers and the `Stack.Protected` auth gate.

### Feature structure (`mobile/src/features/`)

`ai-chat` · `audit-log` · `auth` · `budget-wizard` · `budgets` · `categories` · `notifications` · `reports` · `transactions` · `users` · `wallets`

Each holds `api/` (TanStack Query hooks, `use-*-query.ts` / `use-*-mutation.ts`), `components/`, and `types.ts`.

### Key dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `expo-router` | ~6.0.24 | File-based routing, `Stack.Protected` |
| `@tanstack/react-query` | ^5.101.4 | **All** server state — never copied into `useState`/Zustand |
| `zustand` | ^5.0.15 | Client/global state (`session`, `chat`, `ui-prefs`, `sheet`, `toast`, `debug-log`) |
| `axios` | ^1.19.0 | HTTP — calls the backend **directly**, no BFF on mobile |
| `expo-secure-store` | ~15.0.8 | JWT storage |
| `@react-native-async-storage/async-storage` | 2.2.0 | Chat thread cache, UI prefs |
| `react-native-svg` | 15.12.1 | Charts (donut, liquid fill) — hand-rolled, no chart library |
| `react-native-calendars` | ^1.1314.0 | Date-range picker |
| `expo-image-picker` | ~17.0.11 | Icon/photo upload |
| `expo-document-picker` / `expo-file-system` / `expo-sharing` | ~14 / ~19 / ~14 | CSV import/export |
| `expo-blur` | ~15.0.8 | Bottom nav / overlay chrome |

**Not installed:** `expo-notifications`, `expo-device`, `expo-localization`. There is **no push capability today** — F-13.1 Phase 2 adds it.

### Shared lib (`mobile/src/lib/`)

`axios.ts` (interceptors) · `secure-storage.ts` · `query-client.ts` · `refresh-scheduler.ts` · `currency.ts` (divides by 100) · `theme.ts` · `use-keyboard-height.ts` · `global-error-logger.ts` · `redact.ts` · `number-to-words-vi.ts` · `date-range.ts` · `category-color.ts`

---

## 4. Web Frontend Architecture

**Next.js ^15.0.2** · **React ^19.0.0** · **TypeScript ^5.6.3** · **Tailwind ^3.4.14** · Radix UI primitives · `lucide-react` · TanStack Query ^5.59 · Zustand ^5

Unlike mobile, web goes through a **BFF proxy**: `src/app/api/proxy/[...path]/route.ts` plus dedicated `api/auth/{login,logout,activate}` routes, so the browser never holds the JWT directly and `API_PROXY_TARGET` stays server-side.

Features present: `ai-chat`, `auth`, `budgets`, `categories`, `notifications`, `reports`, `transactions`, `users`, `wallets`. **No `budget-wizard`** — F-13 is mobile-only by design.

---

## 5. AI Service Architecture

**Status: IN_PROGRESS — deployed and serving two routers.**

**Python** · FastAPI `0.141.1` · Uvicorn `0.52.3` · Pydantic `2.13.4` + pydantic-settings `2.15.0` · **groq `1.6.0`** (primary) · **anthropic `0.122.0`** (fallback) · httpx `0.28.1`

```
ai-service/app/
  main.py        — FastAPI("PFM AI Service"), GET /health, mounts both routers
  routers/       — extract_router.py, budget_router.py
  services/      — extract_service.py, category_suggestion_service.py, prompt_builder.py
  schemas/       — extract_schema.py, budget_schema.py
  core/          — config.py, groq_client.py, logging.py
```

**Structured output is done with tool/function calling, not prose-described JSON** — `extract_service.py` records the reason: gpt-oss-20b silently mishandles nested `$ref` schemas under a forced `tool_choice`. Any new schema must stay **flat**.

Current intent enum (`extract_schema.py:75`): `create_transaction | ambiguous | budget_wizard`. No `edit_transaction`, `query_spending`, or `general_advice`.

The service holds **no database connection** and never writes. It receives context from the Go backend and returns proposals; the backend re-validates every ID it gets back.

---

## 6. Data Flow

### Auth + silent refresh (mobile)

```
login → POST /auth/login (+ X-Device-Id / X-Device-Name) → access (15m) + refresh (60d idle, 180d max) → expo-secure-store
       one session per account per device; every saved account keeps its own refresh token,
       and switching account = POST /auth/refresh with that account's token (2026-10-19)
any request → Authorization: Bearer <access>
401 on a non-auth endpoint, not yet retried
   → session-store.refreshSession()           ← single in-flight promise,
   → POST /auth/refresh (interceptor-free axios) so N parallel 401s share ONE refresh
   → success: retry original once (_retried flag)
   → failure, or 401 on an auth endpoint, or second 401: clear() → redirect to /login
```
`refresh-scheduler.ts` also refreshes proactively before expiry, rather than waiting for a 401.

### Transaction creation

```
POST /api/v1/transactions
  handler validates shape → service validates wallet ownership
  BEGIN
    insert transaction (idempotency_key guards double-confirm)
    update wallet balance          ← same DB transaction, always
    write transaction_audit_log
  COMMIT
(separately, ≤5 min later) notification job: recompute spend vs budget_limits
                           → insert budget_exceeded notification (dedup index)
```

### AI chat → transaction

```
POST /ai/chat → ChatService loads the caller's OWN wallets + categories as context
             → AI Service extracts intent + proposed transactions
             → intent == budget_wizard  → return a tappable wizard card, no actions[]
             → otherwise resolveActions(): re-validate every wallet/category ID
                                           belongs to the caller
             → client renders confirmation card; NOTHING is written yet
             → user confirms → POST /transactions (standard path, idempotency key)
```

### Budget wizard (F-13 v1, current)

```
GET /ai/budget-wizard/prefill   → currency, categories, existing budgets   (no AI call)
POST /ai/budget-proposals       → budgetproposal.Compute() in Go            (no AI call)
POST /ai/suggest-category-name  → AI Service                                (the only AI call)
POST /budgets/bulk              → ownership re-check, then atomic replace of all budgets
```

---

## 7. Security Design

- **Auth:** JWT access token **15 min** (`common.AccessTokenTTL`); refresh token bound to a `sessions` row (migration 028, device columns migration 033) that ends **60 days** after its last refresh (`RefreshTokenTTL`, sliding) or **180 days** after sign-in (`SessionAbsoluteTTL`); `JWTAuth` checks the session on every request, so logout, device sign-out, sign out everywhere and password change take effect at once. One live session per user per device, at most 5 per user; refresh rotation with reuse detection. `revoked_tokens` now only covers pre-session and deprecated switch tokens. Invite token: `crypto/rand` 32-byte hex, **72 h** TTL (`InviteTokenTTL`), activation is one atomic UPDATE. Details: `docs/ops-runbook.md` §5.
- **Registration:** none. Invite-only, admin → email → activate.
- **Authorization:** `RequireRole("admin")` on `/admin/*` only; every other endpoint scopes by `user_id` in the query itself.
- **Rate limits:** login **10 / 15 min / IP**; invite **20 / hour / admin**; AI chat **30 / hour / user**. The two user-keyed limiters run *after* `JWTAuth` so `LocalsUserID` is populated.
- **AI Service is untrusted input for authorization** even on the internal network — every wallet/category ID it returns is re-validated against the caller before it leaves the backend.
- **Token storage:** `expo-secure-store` on mobile; HTTP-only server-side via the BFF proxy on web.
- **Error envelope:** `response.Error()` special-cases `*common.AppError` **and** `*fiber.Error`, so a routing 404/405 keeps its real status instead of collapsing into `500 INTERNAL_ERROR`.
- **Logging:** `common/redact.go` + `mobile/src/lib/redact.ts` — no passwords, tokens, or emails in production logs.

---

## 8. CI/CD

| Workflow | Trigger | Does |
|----------|---------|------|
| `ci-pr.yml` | PR | lint + build gate |
| `backend-test.yml` | push / PR | `go test ./...` |
| `deploy-backend.yml` | push to `develop` | build + push image, then `docker compose` up on the VPS with `backend/docker-compose.yml` |
| `deploy-ai-service.yml` | push to `develop` | same, for `pfm-ai-service` |
| `add-ssh-key.yml` | manual | VPS key bootstrap |

Mobile ships via **EAS Build** (`mobile/eas.json`, `preview` profile → internal `.apk`). **No App Store / Play Store release.** The free tier allows 15 cloud builds/month, so day-to-day builds should be local (`npx expo run:android`); `eas build --local` is **not supported on Windows**, which is this project's dev platform.

---

## 9. Decisions & Trade-offs

| Decision | Choice | Reason | Trade-off |
|----------|--------|--------|-----------|
| ORM | **sqlc**, no GORM | Type-safe, no reflection, SQL stays reviewable | More SQL to write; the local CLI version drifts from what is committed, so new queries are hand-written |
| Money | `BIGINT` **xu (cents)** everywhere | No float error at any layer | Every display layer must ÷100; the wizard spec briefly assumed "đồng" and produced a 100× class of bug (`docs/new-tasks.md` BS-01) |
| Budget scope | Category-only, across all wallets | Better product model than per-wallet | A category can span currencies → per-currency `budget_limits` rows |
| Budget allocation | Pure Go arithmetic, **no LLM** | Deterministic, survives AI downtime | Quality is bounded by the preset table's accuracy |
| Mobile state | TanStack Query (server) + Zustand (client) | One mental model shared with `frontend/` | Two stores to reason about |
| Mobile networking | Direct to backend, **no BFF** | Native app can hold a token safely; a BFF would add a hop | Web and mobile auth paths differ |
| Charts | Hand-rolled `react-native-svg` | No heavy chart dep; exact control of the dark theme | Every new chart is bespoke |
| Icon storage | Cloudflare R2 via `minio-go` (S3 API) | Cheap, S3-compatible | Unconfigured R2 → `503 ICON_UPLOAD_UNAVAILABLE` (a deliberate graceful degrade) |
| Notifications | 5-min polling job, in-app only | Simple, DB-level dedup, no push infra needed | Nothing reaches a user who doesn't open the app — F-13.1 Phase 2 changes this |
| Period boundary | `date_trunc('month', NOW())` in **UTC** | Simplest thing that worked | Month rolls over at 07:00 for Vietnamese users; no `cycle_start_day` support at all |
| Expo SDK | Pinned **54**, not latest | Matches the Expo Go build actually installed on the test device | Cannot use SDK 55+ APIs |
| API contract | Hand-synced DTOs, no codegen | No pipeline to maintain | Three places to change per field; `api-spec/openapi.yaml` is not a live source of truth |

---

## 10. Known architectural gaps

1. **No push notification infrastructure** — `expo-notifications` absent; `notifications` table's `CHECK` and dedup index hardcoded to `budget_exceeded`.
2. **No cycle window** — the only spending window is the UTC calendar month (`transactions.sql:217`); `budgets.start_date` is stored but never used to bound a query.
3. **Non-deterministic budget allocation** — `BudgetWizardCategoryBaselines` is a Go map iterated for keyword matching, so overlapping patterns resolve differently per run.
4. **Money computed in `float64`** inside `budgetproposal`, then truncated — the invariant `Σ entries + unallocated == income` does not hold.
5. **System categories are English** while all UI copy is Vietnamese; F-13.1's preset table cannot map to them.
6. **Initdb-only migrations** — no migration runner in the deploy path; a schema change needs manual application on any existing environment.
7. **No OpenAPI codegen** — `api-spec/openapi.yaml` is referenced by `CLAUDE.md` but is not generated from, or checked against, the code.

Each is tracked with severity in [docs/features.md](features.md) §5, and the wizard-facing ones in `docs/new-tasks.md` §20–21.
