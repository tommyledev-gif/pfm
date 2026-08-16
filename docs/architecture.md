# PFM — Architecture Design

_Last updated: 2026-08-16_
_Updated by: /renew-docs_

> Source of truth: generated from the actual codebase (`docker-compose.yml`, `backend/go.mod`, `backend/cmd/server/routes.go`, `backend/db/migrations/`, `mobile/pubspec.yaml`, `frontend/package.json`), not from initial design intent. This file replaces the previous `docs/architecture_design.md`, which had drifted from actual code (e.g. it still described oapi-codegen/Retrofit-DTO-generation and a `/categorize`+`/insights` AI Service as already-decided, none of which exist in code).

---

## 1. System Overview

```
[Next.js Web (frontend/)] ──┐
                             │ HTTPS REST /api/v1 (BFF proxy: app/api/proxy/[...path])
[Flutter Web (mobile/)]  ────┤
                             ▼
                    [Go + Fiber Backend :8080]
                             │
                             ▼
                    [PostgreSQL 16-alpine]

Python AI Service: not started — no `ai-service/` directory exists yet.
```

**Active services** (from `docker-compose.yml`):

| Service | Image/Build | Port (container → host via `.env`) | Description |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | `5432` → `${POSTGRES_PORT}` | Primary DB; migrations mounted directly as `docker-entrypoint-initdb.d/*` scripts (no `golang-migrate` runner wired in) |
| `backend` | built from `./backend/Dockerfile` | `8080` → `${BACKEND_PORT}` | Go Fiber API |
| `frontend` | built from `./mobile/Dockerfile` | `80` → `${FRONTEND_PORT}` | **Flutter web build** — labeled `frontend` in compose but is the mobile/Flutter output, not the Next.js app |
| `web` | built from `./frontend/Dockerfile` | `3000` → `${WEB_FRONTEND_PORT}` | Next.js app (`frontend/`) — BFF-proxies to `backend:8080` via `API_PROXY_TARGET` |

No `ai-service`, `redis`, or `nginx` entries exist in `docker-compose.yml` today.

---

## 2. Backend Architecture

**Go version:** 1.22 (`backend/go.mod`)
**Framework:** Fiber v2.52.5

### Layer structure (from `backend/internal/`)

```
backend/
├── cmd/
│   ├── server/
│   │   ├── main.go      — entrypoint, DI wiring, starts the notification scheduler goroutine
│   │   └── routes.go    — route registration
│   └── hashgen/main.go  — standalone CLI to bcrypt-hash a password (used to generate ADMIN_SEED_PASSWORD_HASH)
└── internal/
    ├── handler/     — HTTP layer: auth, user, wallet, category, budget, transaction, report, notification (+ validate.go shared helpers)
    ├── service/     — business logic + DB transaction boundaries; one `fake_*_repo_test.go` per service for in-memory unit tests
    ├── repository/
    │   └── sqlc/    — sqlc-generated code, DO NOT EDIT
    ├── model/       — domain structs
    ├── dto/         — request/response shapes, one pair of files per feature
    ├── middleware/  — jwt_auth.go, rate_limit.go (Fiber's built-in `limiter` — see §6), require_role.go
    ├── response/     — response.go, the shared `{success, message, data, error_code?, details?}` envelope helper
    ├── config/      — env loading
    └── common/      — constants.go, errors.go, money.go, redact.go
```

There is no `dto`-generation step and no `api-spec/openapi.yaml` — every handler and DTO in `internal/dto/` is hand-written Go, not generated. (`docs/open-ai.md` contains a hand-drafted, aspirational OpenAPI 3.1 document that is **ahead of** actual code in places — e.g. it already documents `POST /auth/refresh` and an `idempotency_key` field on `CreateTransactionRequest`, neither of which is implemented yet — treat it as a design sketch, not a generated contract.)

### API Routes (from `routes.go`)

| Method | Path | Auth | Role | Handler |
|---|---|---|---|---|
| POST | `/api/v1/auth/activate` | No | – | `AuthHandler.Activate` |
| POST | `/api/v1/auth/login` | No (`LoginRateLimiter`) | – | `AuthHandler.Login` |
| POST | `/api/v1/auth/logout` | No | – | `AuthHandler.Logout` |
| POST | `/api/v1/admin/users/invite` | Yes | admin | `UserHandler.InviteUser` (+ `InviteRateLimiter`) |
| GET | `/api/v1/admin/users` | Yes | admin | `UserHandler.ListUsers` |
| POST | `/api/v1/wallets/` | Yes | any | `WalletHandler.CreateWallet` |
| GET | `/api/v1/wallets/` | Yes | any | `WalletHandler.ListWallets` |
| GET | `/api/v1/wallets/:id` | Yes | any | `WalletHandler.GetWallet` |
| PATCH | `/api/v1/wallets/:id` | Yes | any | `WalletHandler.UpdateWallet` |
| POST | `/api/v1/wallets/:id/set-default` | Yes | any | `WalletHandler.SetDefaultWallet` |
| POST | `/api/v1/categories/` | Yes | any | `CategoryHandler.CreateCategory` |
| GET | `/api/v1/categories/` | Yes | any | `CategoryHandler.ListCategories` |
| GET | `/api/v1/categories/:id` | Yes | any | `CategoryHandler.GetCategory` |
| PATCH | `/api/v1/categories/:id` | Yes | any | `CategoryHandler.UpdateCategory` |
| DELETE | `/api/v1/categories/:id` | Yes | any | `CategoryHandler.DeleteCategory` |
| POST | `/api/v1/budgets/` | Yes | any | `BudgetHandler.CreateBudget` |
| GET | `/api/v1/budgets/` | Yes | any | `BudgetHandler.ListBudgets` |
| GET | `/api/v1/budgets/:id` | Yes | any | `BudgetHandler.GetBudget` |
| PATCH | `/api/v1/budgets/:id` | Yes | any | `BudgetHandler.UpdateBudget` |
| DELETE | `/api/v1/budgets/:id` | Yes | any | `BudgetHandler.DeleteBudget` |
| POST | `/api/v1/transactions/` | Yes | any | `TransactionHandler.CreateTransaction` |
| GET | `/api/v1/transactions/` | Yes | any | `TransactionHandler.ListTransactions` |
| GET | `/api/v1/transactions/:id` | Yes | any | `TransactionHandler.GetTransaction` |
| PATCH | `/api/v1/transactions/:id` | Yes | any | `TransactionHandler.UpdateTransaction` |
| DELETE | `/api/v1/transactions/:id` | Yes | any | `TransactionHandler.DeleteTransaction` |
| GET | `/api/v1/reports/summary` | Yes | any | `ReportHandler.GetSummary` |
| GET | `/api/v1/notifications/` | Yes | any | `NotificationHandler.ListNotifications` |
| GET | `/api/v1/notifications/:id` | Yes | any | `NotificationHandler.GetNotification` |
| POST | `/api/v1/notifications/:id/read` | Yes | any | `NotificationHandler.MarkNotificationRead` |

Every group except `/admin/*` requires only `JWTAuth`, no `RequireRole` gate — ownership is enforced in the service layer (`user_id` scoping), per-route comments in `routes.go` reference the `plan.md` findings that justified this. There is no notification-creation endpoint — Notifications are produced only by a background scheduler (§5).

### Database Schema (from `backend/db/migrations/`)

| # | Migration | Key Changes |
|---|---|---|
| 001 | `init` | `users` table, `uuid-ossp` extension |
| 002 | `seed_admin` | admin user seed (manual) |
| 003 | `revoked_tokens` | logout/refresh-token revocation table |
| 004 | `wallets` | `wallets` table, one-default-per-user partial unique index |
| 005 | `categories` | `categories` table, owner+name+type unique index |
| 006 | `seed_categories` | 10 default system categories |
| 007 | `budgets` | `budgets` + `budget_limits` (per-currency child table) |
| 008 | `transactions` | `transactions` table, no balance-floor CHECK constraint (by design) |
| 009 | `notifications` | `notifications` table + `related_budget_id`/`currency`/`period_start` dedup columns |

No `pgvector` extension is enabled anywhere in the actual migrations (unlike the superseded `architecture_design.md`, which described it as already enabled).

**Key tables:** `users`, `revoked_tokens`, `wallets`, `categories`, `budgets` + `budget_limits`, `transactions`, `notifications`.

**Pending, specced but not yet migrated** (per `specs/ai-chat-assistant/spec.md`): an additive `idempotency_key` column on `transactions`, and a new `chat_messages` table — not yet in `backend/db/migrations/`.

---

## 3. Mobile Architecture (Flutter, `mobile/` — Phase 0 only)

**Dart SDK constraint:** `>=3.9.0 <4.0.0` (`mobile/pubspec.yaml`) — no separate "Flutter version" pin beyond the SDK constraint.

Per `CLAUDE.md`, `mobile/` is **paused** after Phase 0 (F-01 User Management, F-02 System Security) — F-03 through F-07/F-10 have no mobile implementation, deliberately.

### Feature structure (from `mobile/lib/`)

```
lib/
├── core/
│   ├── api/          — dio_client.dart, session_events.dart (force-logout on 401), auth_api.dart/.g.dart (Retrofit), admin_api.dart/.g.dart, api_endpoints.dart, api_providers.dart/.g.dart
│   ├── common/        — api_exception.dart, app_constants.dart, jwt_decoder.dart
│   ├── env/           — env.dart
│   ├── router/        — app_router.dart/.g.dart (go_router), route_paths.dart
│   ├── storage/        — secure_storage_service.dart
│   └── theme/          — app_theme.dart
└── features/
    ├── auth/{data,domain,presentation/pages,presentation/providers}
    ├── admin/{data,domain,presentation/pages,presentation/providers,presentation/widgets}
    └── home/presentation/pages
```

Only `auth` and `admin` exist as full feature modules — no `wallets`/`categories`/`budgets`/`transactions`/`reports`/`notifications` directories under `mobile/lib/features/`.

### Key dependencies (from `pubspec.yaml`)

| Package | Version | Purpose |
|---|---|---|
| `flutter_riverpod` | `^3.0.0` | State management |
| `riverpod_annotation` | `^4.0.0` | Riverpod codegen annotations |
| `go_router` | `^14.6.2` | Navigation |
| `dio` | `^5.7.0` | HTTP client |
| `retrofit` | `^4.9.2` | Type-safe API client codegen on top of `dio` |
| `json_annotation` | `^4.9.0` | JSON (de)serialization codegen |
| `flutter_secure_storage` | `^9.2.2` | JWT storage |
| `cupertino_icons` | `^1.0.8` | Icon set |

**Code-gen tools (dev dependencies):** `build_runner ^2.4.13`, `riverpod_generator ^4.0.0`, `retrofit_generator ^10.2.8`, `json_serializable ^6.9.0`, `flutter_lints ^5.0.0`.

**Not present despite earlier planning docs:** `drift`, `fl_chart`, `flutter_form_builder`, `envied` — none are dependencies today; CLAUDE.md's tech-stack list for `mobile/` describes an intended, not-yet-adopted stack for these.

---

## 4. Web Frontend Architecture (Next.js, `frontend/`)

Per `CLAUDE.md`, `frontend/` (this Next.js app) is the **currently prioritized** client — built out through F-01, F-02 (`features/auth`, `features/users`), F-03–F-07 (`wallets`, `categories`, `budgets`, `transactions`, `reports`), while `mobile/` stays paused.

```
frontend/src/
├── app/
│   ├── api/
│   │   ├── auth/{activate,login,logout}/route.ts   — thin auth passthroughs
│   │   └── proxy/[...path]/route.ts                — BFF proxy: forwards to API_PROXY_TARGET (http://backend:8080)
│   └── app/{feature}/                              — route pages
└── features/
    ├── auth/, users/, wallets/, categories/, budgets/, transactions/, reports/
    └── notifications/
        └── each: api/ (TanStack Query hooks), components/, types.ts
```

`frontend/src/features/notifications/` already exists — the Next.js web UI for F-10 has shipped, alongside the backend.

---

## 5. AI Service Architecture

**Status: NOT_STARTED** — no `ai_service/`, `ai-service/`, or `python_service/` directory exists anywhere in the repository.

Planned (per `CLAUDE.md` and `specs/ai-chat-assistant/spec.md`, not yet built):
- Python 3.12+ / FastAPI
- Groq SDK (primary, free tier) + Anthropic SDK (fallback)
- One internal extraction endpoint reachable from the Go Backend over the internal Docker network (no such network path exists in `docker-compose.yml` today — adding the service will also require a new `docker-compose.yml` entry)
- No `pgvector`/RAG usage is designed yet for any specced feature

---

## 6. Data Flow

### Auth flow (mobile, `dio_client.dart` / `session_events.dart`)

```
Client → POST /api/v1/auth/login (LoginRateLimiter) → Backend validates → JWT access+refresh
                                                                       → mobile: stored via flutter_secure_storage
Client → subsequent requests → Authorization: Bearer {access_token}
Backend → 401 → mobile's dio interceptor clears storage → session_events fires
                                                          → router redirects to /login
```

There is no `/auth/refresh` endpoint — a 401 forces a full re-login (explicit MVP decision, not a bug).

### Notification generation flow (background scheduler, `main.go`)

```
main.go starts a goroutine on boot: runNotificationScheduler(schedulerCtx, notificationService, logger)
  → time.NewTicker(common.NotificationJobInterval)
  → on each tick: evaluate every active Budget's live-computed `spent` vs `amount_limit`
  → insert a `budget_exceeded` Notification, deduped via the partial unique index
    on (related_budget_id, currency, period_start)
schedulerCtx is cancelled on graceful shutdown (waitForShutdown in main.go)
```

This is the only Notification-creation path — there is no HTTP endpoint that creates a Notification directly.

### Transaction creation flow

```
Client → POST /api/v1/transactions/
Backend → validate input (handler) → verify Wallet/Category ownership + type match (service)
       → BEGIN DB transaction
             → if expense: conditional UPDATE wallets SET balance = balance - amount WHERE balance >= amount
               (zero rows affected ⇒ 409 INSUFFICIENT_BALANCE)
             → if income: unconditional UPDATE wallets SET balance = balance + amount
             → INSERT transactions row
       → COMMIT → 201 with the created Transaction + Wallet's new balance
```

---

## 7. Security Design

- **Auth:** `golang-jwt/jwt v5` access token (short TTL) + refresh token; logout revokes via the `revoked_tokens` table (`003_revoked_tokens.sql`). No `/auth/refresh` endpoint exists yet.
- **Authorization:** every non-admin route group requires only `JWTAuth`; ownership (`user_id = caller`) is checked in the service layer per resource — no `RequireRole` gate on wallets/categories/budgets/transactions/reports/notifications.
- **Rate limiting:** Fiber's built-in `limiter` middleware (`backend/internal/middleware/rate_limit.go`), two concrete uses today — `LoginRateLimiter` (keyed by IP) and `InviteRateLimiter` (keyed by the authenticated caller's user ID). No rate limit exists yet on any other route.
- **Password hashing:** bcrypt (`golang.org/x/crypto`).
- **Invite tokens:** `crypto/rand` 32-byte hex, not UUID (`backend/internal/service/invite_token.go`).
- **Redaction:** `backend/internal/common/redact.go` exists for keeping sensitive fields out of logs, per CLAUDE.md's "don't log sensitive data" rule.
- **AI Chat (planned, per `specs/ai-chat-assistant/spec.md`):** the (not-yet-built) AI Service is treated as untrusted input for authorization — any Wallet/Category ID it returns must be re-validated for ownership by the Go Backend before use.

---

## 8. Decisions & Trade-offs

| Decision | Choice | Reason | Trade-off |
|---|---|---|---|
| Query layer | sqlc, no ORM | Type-safe, explicit SQL, no N+1 magic | More SQL to hand-write |
| API generation | Hand-written handlers/DTOs | No `openapi.yaml`/oapi-codegen wired up despite CLAUDE.md's stated intent | `docs/open-ai.md` is a design sketch, not a generated contract — it has already drifted ahead of actual code in places |
| Money type | `BIGINT` cents | Avoid float precision | Must ÷100 at display layer everywhere |
| Migrations | Numbered `.sql` files mounted directly into `docker-entrypoint-initdb.d/*` | Simple for MVP | No automated apply-on-boot for an existing DB volume; adding a migration requires a matching compose mount line (`golang-migrate` is planned but not wired in) |
| Budget scope | Category-only, aggregated across all Wallets, per-currency limits in child table `budget_limits` | Resolved in `specs/budget-management/spec.md`; sqlc doesn't type-gen JSONB well | An extra child table instead of one blended limit column |
| Notification delivery | In-app only, background ticker in `main.go` | No SRS/SDS basis for push/email in MVP | No real-time channel (WebSocket/SSE) |
| Frontend priority | `frontend/` (Next.js) built first; `mobile/` (Flutter) paused after Phase 0 | Explicit `CLAUDE.md` instruction | Feature parity gap between web and mobile is intentional, not a bug |
| AI Service | Not started; Groq primary / Anthropic fallback when built | Budget-conscious (`docs/features.md` §6) | Feature-12 (AI Chat) blocked on this scaffold existing first |

---

## 9. Key Scenarios (Scenario View — from `specs/*/spec.md`, not aspirational)

| Scenario ID prefix | Feature | Spec |
|---|---|---|
| S-USR-* | User Management | `specs/user-management/spec.md` |
| S-SEC-* | System Security | `specs/security/spec.md` |
| S-WAL-* | Wallet Management | `specs/wallet-management/spec.md` |
| S-CAT-* | Category Management | `specs/category-management/spec.md` |
| S-BUD-* | Budget Management | `specs/budget-management/spec.md` |
| S-TRX-* | Transaction Management | `specs/transaction-management/spec.md` |
| S-RPT-* (or equivalent) | Financial Reporting | `specs/financial-reporting/spec.md` |
| S-NOT-* | Notification Handling | `specs/notification-handling/spec.md` |
| S-AI-* | AI Chat — Create Transaction (Release 1) | `specs/ai-chat-assistant/spec.md` — specced, **not yet coded**; `ai-service/` scaffold does not exist |
