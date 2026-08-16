# PFM — Architecture Design

_Last updated: 2026-08-16_
_Updated by: /renew-docs_

> Source of truth: generated from the actual codebase (`docker-compose.yml`, `backend/go.mod`, `backend/cmd/server/routes.go`, `backend/db/migrations/`, `mobile/package.json`, `frontend/package.json`), not from initial design intent. This file replaces the previous `docs/architecture_design.md`, which had drifted from actual code.
>
> **2026-08-16: `mobile/` was rebuilt from scratch as React Native (Expo), replacing the previous Flutter app** (deleted by the user). This is a project-scaffold pass only — Expo Router, TanStack Query, Zustand, Axios, and secure-store are wired and the app boots, but no feature screens exist yet.

---

## 1. System Overview

```
[Next.js Web (frontend/)] ──┐
                             │ HTTPS REST /api/v1 (BFF proxy: app/api/proxy/[...path])
[React Native App (mobile/, Expo)] ──┤  ← calls the backend directly, no BFF (see §3)
                             ▼
                    [Go + Fiber Backend :8080]
                             │
                             ▼
                    [PostgreSQL 16-alpine]

Python AI Service (ai-service/): scaffolded, Groq-primary/Anthropic-fallback,
reachable from the backend over the internal Docker network — see §5.
```

**Active services** (from `docker-compose.yml`):

| Service | Image/Build | Port (container → host via `.env`) | Description |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | `5432` → `${POSTGRES_PORT}` | Primary DB; migrations mounted directly as `docker-entrypoint-initdb.d/*` scripts (no `golang-migrate` runner wired in) |
| `backend` | built from `./backend/Dockerfile` | `8080` → `${BACKEND_PORT}` | Go Fiber API |
| `ai-service` | built from `./ai-service/Dockerfile` | internal only, no host port | Python FastAPI AI Service |
| `web` | built from `./frontend/Dockerfile` | `3000` → `${WEB_FRONTEND_PORT}` | Next.js app (`frontend/`) — BFF-proxies to `backend:8080` via `API_PROXY_TARGET` |

**`mobile/` is intentionally not a compose service** — the old Flutter-web-build `frontend` service was removed when `mobile/` was rebuilt as React Native/Expo. Expo's dev flow (`npx expo start`) doesn't fit the "serve a static build via a container" pattern the Flutter setup used; `npx expo export --platform web` could produce a static bundle for a future containerized preview if ever needed. No `redis` or `nginx` entries exist either.

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
| POST | `/api/v1/ai/chat` | Yes (+ `AIChatRateLimiter`) | any | `ChatHandler.Chat` |

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
| 010 | `transactions_idempotency_key` | additive `idempotency_key` column + partial unique index on `transactions` |
| 011 | `chat_messages` | `chat_messages` table (Feature-12 AI Chat) |

No `pgvector` extension is enabled anywhere in the actual migrations (unlike the superseded `architecture_design.md`, which described it as already enabled).

**Key tables:** `users`, `revoked_tokens`, `wallets`, `categories`, `budgets` + `budget_limits`, `transactions`, `notifications`, `chat_messages`.

⚠️ **Operational gotcha, hit live in this session:** `docker-entrypoint-initdb.d/*` scripts only run once, on a genuinely empty Postgres volume. A long-running dev volume that predates a migration file being added will silently never pick it up — `009_notifications.sql` had to be applied by hand (`psql < 009_notifications.sql`) against an already-initialized volume from 2026-08-02. This is the concrete failure mode behind the "no automated apply-on-boot" gap already noted in §8's Decisions table — not hypothetical.

---

## 3. Mobile Architecture (React Native + Expo, `mobile/` — project scaffold only)

**Expo SDK:** `^54.0.0` · **React Native:** `0.81.5` · **React:** `19.1.0` · **TypeScript:** `~5.9.2` (from `mobile/package.json`).

`mobile/` was deleted and rebuilt from scratch on 2026-08-16 as React Native (Expo), replacing the previous Flutter app. This pass is **setup only** — no feature screens (auth, wallets, etc.) exist; the app boots to a placeholder "Login screen — coming soon" / "Welcome to PFM" screen depending on session state.

⚠️ **Deliberately pinned to SDK 54, not the latest (57)** — went through two rounds of trial and error the same day: scaffolded on SDK 57 → real-device testing via the Play Store's Expo Go failed with `Project is incompatible with this version of Expo Go` → downgraded to SDK 56, same failure → **confirmed directly from the tester's own installed Expo Go app** (its Profile tab reported client version `54.0.8`, "supported SDK 54") that the Play Store build was several SDKs behind the newly-released SDK 57, not just one. Downgraded to SDK 54, verified working. Expo's own changelogs corroborate this: SDK 56's changelog states *"Expo Go for SDK 56 is not available on the Apple App Store or Google Play Store. We do not have a timeline for when they will be."* — the lesson generalized in `mobile/AGENTS.md`: **don't infer the safe SDK from changelogs alone; have someone check Expo Go's own Profile/Settings tab on a real device and match that number exactly.**

### Structure (from `mobile/`)

```
mobile/
├── app/                          — Expo Router file-based routes (thin — compose from src/features)
│   ├── _layout.tsx               — Root layout: SafeAreaProvider, QueryClientProvider, session
│   │                                hydration, Stack.Protected auth-gated route split
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx             — placeholder screen, no form/mutation yet
│   └── (app)/
│       ├── _layout.tsx
│       └── index.tsx             — placeholder home screen
└── src/
    ├── features/
    │   └── auth/                 — only scaffolded feature (mirrors the old Flutter Phase-0 precedent)
    │       ├── api/               (empty — TanStack Query hooks land here)
    │       ├── components/        (empty — screen components land here)
    │       └── types.ts           — LoginRequest/LoginResponse, mirrors backend dto shape
    ├── components/{ui,shared}/   — empty, ready for reusable primitives as features are added
    ├── lib/
    │   ├── axios.ts               — direct-to-backend client (no BFF — see below), JWT interceptor, 401 handling
    │   ├── query-client.ts        — TanStack QueryClient singleton
    │   ├── secure-storage.ts      — expo-secure-store wrapper
    │   ├── constants.ts           — mirrors backend/internal/common/constants.go
    │   └── currency.ts            — ported verbatim from frontend/src/lib/currency.ts
    └── stores/
        └── session-store.ts       — global Zustand store (accessToken/refreshToken/isHydrated)
```

### Why this stack (deliberate departure from the old Flutter choices)

- **TanStack Query + Zustand, not Riverpod** — matches `frontend/`'s exact state-management pairing, so there is one state-management mental model across both clients instead of two (Riverpod was Flutter-only).
- **Expo Router, not go_router** — file-based routing, directly analogous to `frontend/`'s Next.js App Router; auth gating uses the current SDK's declarative `Stack.Protected guard={...}` (see `mobile/app/_layout.tsx`), not a manual redirect-on-navigate check.
- **No BFF/proxy layer, unlike `frontend/`.** The web client hides the JWT behind a same-origin Next.js proxy (`app/api/proxy/[...path]`) so the browser never holds it. A mobile app has no equivalent server tier — `lib/axios.ts` calls the Go backend directly over HTTPS, with the JWT read from `expo-secure-store` via the interceptor. This mirrors the old Flutter app's `dio_client.dart` pattern, not the web client's BFF pattern.
- **No offline/local-DB layer yet** (no SQLite/`drift`-equivalent). The old Flutter stack listed `drift` in its intended tech stack but never actually adopted it (per this doc's prior finding); this scaffold doesn't repeat that "planned but unused" gap — TanStack Query's own cache is the only client-side persistence for now.

### Key dependencies (from `mobile/package.json`)

| Package | Version | Purpose |
|---|---|---|
| `expo` | `^54.0.0` | Framework/SDK |
| `expo-router` | `~6.0.24` | File-based routing, `Stack.Protected` auth gating (present and working at this version too — verified, not assumed) |
| `expo-secure-store` | `~15.0.8` | JWT storage |
| `expo-constants` / `expo-linking` | `~18.0.13` / `~8.0.12` | Router runtime deps |
| `react-native-safe-area-context` | `~5.6.0` | Safe-area insets |
| `react-native-screens` | `~4.16.0` | Native screen containers (React Navigation dep) |
| `react-native-web` / `react-dom` | `^0.21.2` / `19.1.0` | Enables `expo start --web` browser preview |
| `@tanstack/react-query` | `^5.101.4` | Server state |
| `zustand` | `^5.0.15` | Global client state (session) |
| `axios` | `^1.19.0` | HTTP client |

**Dev dependencies:** `typescript ~5.9.2`, `eslint ^9.0.0` + `eslint-config-expo ~10.0.0` (via `npx expo lint`). Note `expo-router`'s own package version (`~6.0.24`) doesn't track the Expo SDK number 1:1 — don't assume version-number parity between the two when cross-referencing Expo's docs.

⚠️ `expo-status-bar` must **not** be listed in `app.json`'s `plugins` array on this SDK — its config-plugin resolution throws `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` if present (see `mobile/AGENTS.md`).

**Not yet a dependency:** any form library (`react-hook-form` planned once a real form screen exists), any charting library (planned once Dashboard/Reports mobile work starts) — neither is needed by anything built so far.

### Auth-gating pattern (`app/_layout.tsx`)

```tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Protected guard={hasSession}>
    <Stack.Screen name="(app)" />
  </Stack.Protected>
  <Stack.Protected guard={!hasSession}>
    <Stack.Screen name="(auth)" />
  </Stack.Protected>
</Stack>
```
`hasSession` reads `useSessionStore`, hydrated once from `expo-secure-store` on app start; an `isHydrated` flag gates rendering the `Stack` at all, so a signed-in user's session never flashes the login screen while the async secure-store read is in flight.

---

## 4. Web Frontend Architecture (Next.js, `frontend/`)

Per `CLAUDE.md`, `frontend/` (this Next.js app) is the **currently prioritized** client — built out through F-01, F-02 (`features/auth`, `features/users`), F-03–F-07 (`wallets`, `categories`, `budgets`, `transactions`, `reports`), Feature-12 AI Chat (`features/ai-chat`), while `mobile/` (React Native/Expo, §3) has only a project scaffold.

```
frontend/src/
├── app/
│   ├── api/
│   │   ├── auth/{activate,login,logout}/route.ts   — thin auth passthroughs
│   │   └── proxy/[...path]/route.ts                — BFF proxy: forwards to API_PROXY_TARGET (http://backend:8080)
│   └── app/{feature}/                              — route pages
└── features/
    ├── auth/, users/, wallets/, categories/, budgets/, transactions/, reports/, notifications/
    └── ai-chat/
        └── each: api/ (TanStack Query hooks), components/, types.ts
```

`frontend/src/features/notifications/` and `frontend/src/features/ai-chat/` already exist — the Next.js web UI for F-10 and Feature-12 (US-01 only) have both shipped, alongside their backend counterparts.

---

## 5. AI Service Architecture

**Status: implemented** (Feature-12, US-01 "Create a Transaction via Chat" only) — `ai-service/app/` exists, containerized (`docker-compose.yml`'s `ai-service` entry, internal-only, no host port), reachable from the Go Backend at `http://ai-service:8000/extract` (`AI_SERVICE_URL`).

```
ai-service/app/
├── main.py                    — FastAPI app, GET /health, mounts extract_router; configures structured JSON logging
├── core/
│   ├── config.py              — pydantic-settings: GROQ_API_KEY, ANTHROPIC_API_KEY, groq_model, temperature=0, max_tokens
│   ├── groq_client.py         — Groq + Anthropic client singletons
│   └── logging.py             — JSON log formatter (required for `extra={...}` fields to actually appear in output)
├── routers/extract_router.py  — POST /extract
├── services/
│   ├── extract_service.py     — Groq primary, Anthropic fallback on exception
│   └── prompt_builder.py      — system prompt assembly (pure function, no I/O)
└── schemas/extract_schema.py  — Pydantic v2: ExtractRequest, ExtractResponse, ProposedTransaction, WalletContext, CategoryContext
```

**Key implementation decisions, found necessary via live testing against the real Groq API (not decided up front):**
- **Tool/function calling, not prose-described `response_format: json_object`.** A prose "return this exact JSON shape" instruction was observed to not reliably hold — Groq returned different field names (`amount`/`type`/`date`) than the ones asked for (`amount_vnd`/`tx_type`/`occurred_at`). The tool schema is `ExtractResponse.model_json_schema()` itself (single source of truth), passed to both Groq's `tools`/`tool_choice` and Anthropic's `tools`/`tool_choice` params.
- **`temperature=0`.** The default (~0.7–1.0) was observed to return a different — and often wrong — Category for the identical input across repeated calls; this is a classification task, not creative generation.
- **Categories are grouped by type (expense vs. income) in the prompt**, not a flat list — a flat list was observed to sometimes let the model match an expense message to an income Category with a similar "vibe" (e.g. "Bonus" for a lunch expense).
- No `pgvector`/RAG usage — not designed for this feature.

The Go Backend re-validates every Wallet/Category ID the AI Service returns for caller ownership before use (`ChatService.resolveActions`) — the AI Service is untrusted input for authorization, per `specs/ai-chat-assistant/spec.md`.

---

## 6. Data Flow

### Auth flow (mobile, `src/lib/axios.ts` / `src/stores/session-store.ts`) — not yet exercised end to end, no login screen exists

```
Client → POST /api/v1/auth/login (LoginRateLimiter) → Backend validates → JWT access+refresh
                                                                       → mobile: stored via expo-secure-store
Client → subsequent requests → Authorization: Bearer {access_token} (attached by an axios request interceptor)
Backend → 401 → axios response interceptor clears the session store
                                                          → (TODO once a login screen exists: redirect to (auth))
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
- **AI Chat (implemented, per `specs/ai-chat-assistant/spec.md`):** the AI Service is treated as untrusted input for authorization — every Wallet/Category ID it returns is re-validated for ownership by `ChatService.resolveActions` before use; a mismatch is silently dropped, never surfaced or trusted.

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
| Frontend priority | `frontend/` (Next.js) built first; `mobile/` has a project scaffold only (React Native/Expo, rebuilt 2026-08-16, no feature screens yet) | Explicit `CLAUDE.md` instruction | Feature parity gap between web and mobile is intentional, not a bug |
| Mobile framework | React Native (Expo) | User-directed change 2026-08-16, replacing Flutter — no further rationale recorded | Zero code reuse from the old Flutter app; TanStack Query/Zustand pairing does reuse the web client's mental model |
| AI Service | Implemented (Feature-12 US-01 only); Groq primary / Anthropic fallback via tool/function calling | Budget-conscious (`docs/features.md` §6); prose-described JSON schemas proved unreliable in live testing | Only the create-transaction-via-chat slice exists — edit/query/advice intents are unspecced |

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
| S-AI-* | AI Chat — Create Transaction (Release 1) | `specs/ai-chat-assistant/spec.md` — implemented (backend + web); mobile has no chat screen yet (§3) |
