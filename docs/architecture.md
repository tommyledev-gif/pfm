# PFM — Architecture Design

_Last updated: 2026-08-21_
_Updated by: /renew-docs_

> Source of truth: generated from the actual codebase (`docker-compose.yml`, `backend/go.mod`, `backend/cmd/server/routes.go`, `backend/db/migrations/`, `mobile/package.json`, `frontend/package.json`, `.github/workflows/*`), not from initial design intent. This file replaces the previous `docs/architecture_design.md`, which had drifted from actual code.
>
> **2026-08-16: `mobile/` was rebuilt from scratch as React Native (Expo), replacing the previous Flutter app** (deleted by the user). Same-day, later in this session, the full screen set was implemented against `mobile/design_handoff_pfm_app/` (Home, Transactions, Insights, AI Chat, Notifications, Profile) — see §3, no longer scaffold-only.
>
> **2026-08-21 update:** significant drift since the above — `mobile/` gained full CRUD feature screens for Wallets, Categories, Budgets, Users (admin), on top of what was previously entry-point-only rows; Category icons can now be an uploaded photo (Cloudflare R2 via `minio-go`), not just emoji text; invite emails are sent via real SMTP; four GitHub Actions workflows now build/test/deploy the backend, AI service, and gate PRs; mobile ships as an EAS-built `.apk`. See §3, §5 (renumbered), §9 (CI/CD, new), and `SDS.md` §12.1 Known Issues Log for a defect found while verifying this update (production VPS lagging behind the `develop` HEAD it should auto-deploy from).

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
| `backend` | built from `./backend/Dockerfile` | `8080` → `${BACKEND_PORT}` | Go Fiber API. Also takes `SMTP_*`/`APP_BASE_URL` (invite emails) and `R2_*` (category icon uploads) env vars — both optional at boot (see §7) |
| `ai-service` | built from `./ai-service/Dockerfile` | internal only, no host port | Python FastAPI AI Service |
| `web` | built from `./frontend/Dockerfile` | `3000` → `${WEB_FRONTEND_PORT}` | Next.js app (`frontend/`) — BFF-proxies to `backend:8080` via `API_PROXY_TARGET` |

**External dependencies** (beyond the compose network): an SMTP provider (invite-activation emails, `backend/internal/service/smtp_email_sender.go`) and a Cloudflare R2 bucket (category-icon photo uploads, `backend/internal/service/icon_uploader.go`, S3-compatible via `minio-go`). Both are optional at boot — a missing `SMTP_HOST` falls back to `LogEmailSender` (logs instead of sending) and missing R2 credentials fall back to `UnconfiguredIconUploader` (fails only the individual upload request, not startup).

**`mobile/` is intentionally not a compose service** — the old Flutter-web-build `frontend` service was removed when `mobile/` was rebuilt as React Native/Expo. Expo's dev flow (`npx expo start`) doesn't fit the "serve a static build via a container" pattern the Flutter setup used; `npx expo export --platform web` could produce a static bundle for a future containerized preview if ever needed. No `redis` or `nginx` entries exist either.

---

## 2. Backend Architecture

**Go version:** 1.23.0 (`backend/go.mod`, bumped from 1.22 since the last update)
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
    ├── handler/     — HTTP layer: auth, user, wallet, category, budget, transaction, report, notification, chat, activate_page (+ validate.go shared helpers)
    ├── service/     — business logic + DB transaction boundaries; one `fake_*_repo_test.go` per service for in-memory unit tests; also owns two storage-boundary interfaces — `EmailSender` (`email_sender.go`/`smtp_email_sender.go`) and `IconUploader` (`icon_uploader.go`, R2 via `minio-go`) — both swappable behind an interface so handlers never see the concrete provider
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
| GET | `/activate` | No | – | `handler.ActivatePageHandler` — self-contained HTML activation form, served at the backend's own domain (not under `/api/v1`) because `frontend/` has no production deployment for the invite email's link to land on; the form POSTs client-side to the row below |
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
| POST | `/api/v1/categories/icon` | Yes | any | `CategoryHandler.UploadIcon` — standalone upload step (not nested under `/:id`) so a client can pick a photo before the category exists yet |
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
| 012 | `categories_icon_url` | additive `icon_url` column on `categories` — an uploaded-photo alternative to the existing emoji `icon` text field, used when a client uploads via `POST /categories/icon` |

No `pgvector` extension is enabled anywhere in the actual migrations (unlike the superseded `architecture_design.md`, which described it as already enabled). No equivalent `icon_url` column exists yet on `wallets` or `budgets` — see `SDS.md` §12.1 Known Issues Log, Item 3, for that planned (not yet spec'd) extension.

**Key tables:** `users`, `revoked_tokens`, `wallets`, `categories`, `budgets` + `budget_limits`, `transactions`, `notifications`, `chat_messages`.

⚠️ **Operational gotcha, hit live in this session:** `docker-entrypoint-initdb.d/*` scripts only run once, on a genuinely empty Postgres volume. A long-running dev volume that predates a migration file being added will silently never pick it up — `009_notifications.sql` had to be applied by hand (`psql < 009_notifications.sql`) against an already-initialized volume from 2026-08-02. This is the concrete failure mode behind the "no automated apply-on-boot" gap already noted in §8's Decisions table — not hypothetical.

---

## 3. Mobile Architecture (React Native + Expo, `mobile/`)

**Expo SDK:** `^54.0.36` · **React Native:** `0.81.5` · **React:** `19.1.0` · **TypeScript:** `~5.9.2` (from `mobile/package.json`).

`mobile/` was deleted and rebuilt from scratch on 2026-08-16 as React Native (Expo), replacing the previous Flutter app. The initial pass that day was setup-only; later the same session the first screen set was built against the high-fidelity design handoff at `mobile/design_handoff_pfm_app/` (`PFM App.dc.html` + `README.md`, a dark "Noctis"-themed prototype — treated as a visual/behavioral spec, not copied as markup). Since then (commits `455bfb1` "customer drawer, implement the remaining features" through `fe4f6cc`), every Profile entry-point row that used to be inert has become a real screen with full CRUD:

- **Home** (`app/(app)/index.tsx`) — hero balance card (sum of wallets sharing the default wallet's currency), horizontal wallet cards, recent transactions
- **Transactions** (`app/(app)/transactions.tsx`) — filter chips (All/Income/Expense), cursor-paginated infinite list, create/edit via `TransactionFormModal` (`src/features/transactions/`)
- **Wallets** (`app/(app)/wallets.tsx`) — list + create/edit/set-default via `WalletFormModal` (`src/features/wallets/`); no icon/photo field yet (SDS §12.1 Known Issues Log, Item 3)
- **Categories** (`app/(app)/categories.tsx`) — list + create/edit/delete via `CategoryFormModal` (`src/features/categories/`), including photo upload/replace via `expo-image-picker` + `POST /categories/icon` (`use-upload-category-icon-mutation.ts`)
- **Insights** (`app/(app)/insights.tsx`) — Spending sub-tab (stat cards + clickable SVG donut chart + legend, `src/components/shared/DonutChart.tsx`) and Budgets sub-tab (stacked Budget-vs-Actual bars + create/edit via `NewBudgetModal`/`src/features/budgets/`); no icon/photo field yet (SDS §12.1 Known Issues Log, Item 3)
- **Users** (`app/(app)/users.tsx`, admin only) — list + `InviteUserModal` (`src/features/users/`), the mobile UI for F-01's admin-invite flow
- **AI Chat** (`app/(app)/ai-chat.tsx`) — chat thread against `POST /ai/chat`, renders a `TransactionActionCard` for parsed transactions, confirms via the existing `POST /transactions` (reusing its `idempotency_key`); also supports editing a proposed transaction (`EditTransactionModal`) and editing/retrying a sent message (`EditMessageModal`)
- **Notifications** (`app/(app)/notifications.tsx`) — full-screen overlay from the Home bell, day-grouped, unread-only toggle
- **Profile** (`app/(app)/profile.tsx`) — stat cards + navigation rows into the screens above + logout; no rows are inert placeholders anymore

Every create/edit form (Wallet/Category/Budget/Transaction) shares one bottom-sheet chrome — `src/components/shared/Drawer.tsx` — introduced in `455bfb1` alongside these screens. It currently has no keyboard-avoidance logic (SDS §3.2 UI/UX Principles, §12.1 Known Issues Log Item 2).

Auth (`app/(auth)/login.tsx` + `src/features/auth/`) was also completed as a prerequisite — the screens above need a real session. There is no `GET /users/me` endpoint and the JWT's `AccessClaims` carry only `user_id`/`role` (`backend/internal/service/token_service.go`) — Profile's name/email come from the email typed at login, persisted client-side (`src/stores/session-store.ts`), not re-verified server-side.

A `BottomNav` (`src/components/shared/BottomNav.tsx`) is a floating, blurred (`expo-blur`) pill overlaid in `app/(app)/_layout.tsx` — not expo-router's native tab bar, since the design's raised center button (always opens AI Chat) and floating shape don't map onto a standard tab bar. `react-native-svg` was added for the donut chart and the hand-drawn icon set (`src/components/ui/Icon.tsx` — no icon font/library, matching the design handoff's own "minimal inline SVG" approach).

⚠️ **Deliberately pinned to SDK 54, not the latest (57)** — went through two rounds of trial and error the same day: scaffolded on SDK 57 → real-device testing via the Play Store's Expo Go failed with `Project is incompatible with this version of Expo Go` → downgraded to SDK 56, same failure → **confirmed directly from the tester's own installed Expo Go app** (its Profile tab reported client version `54.0.8`, "supported SDK 54") that the Play Store build was several SDKs behind the newly-released SDK 57, not just one. Downgraded to SDK 54, verified working. Expo's own changelogs corroborate this: SDK 56's changelog states *"Expo Go for SDK 56 is not available on the Apple App Store or Google Play Store. We do not have a timeline for when they will be."* — the lesson generalized in `mobile/AGENTS.md`: **don't infer the safe SDK from changelogs alone; have someone check Expo Go's own Profile/Settings tab on a real device and match that number exactly.**

### Structure (from `mobile/`)

```
mobile/
├── app/                          — Expo Router file-based routes (thin — compose from src/features)
│   ├── _layout.tsx               — Root layout: SafeAreaProvider, QueryClientProvider, session
│   │                                hydration, Stack.Protected auth-gated route split
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx             — LoginForm (src/features/auth/components/)
│   └── (app)/
│       ├── _layout.tsx           — BottomNav overlay + auth-gated shell
│       ├── index.tsx             — Home
│       ├── transactions.tsx, wallets.tsx, categories.tsx, insights.tsx,
│       │   notifications.tsx, users.tsx (admin), ai-chat.tsx, profile.tsx
│       └── (each screen composes components/hooks from the matching src/features/{name}/)
└── src/
    ├── features/                 — one folder per screen's data layer, all following the same api/+components/+types.ts shape
    │   ├── auth/                 — use-login-mutation.ts, LoginForm.tsx
    │   ├── wallets/               — CRUD hooks, WalletFormModal.tsx, WalletListItem.tsx, wallet-totals.ts
    │   ├── categories/            — CRUD hooks + use-upload-category-icon-mutation.ts, CategoryFormModal.tsx, CategoryListItem.tsx
    │   ├── budgets/                — CRUD hooks, BudgetsTab.tsx
    │   ├── transactions/          — CRUD hooks, TransactionFormModal.tsx
    │   ├── reports/                — use-report-summary-query.ts, SpendingTab.tsx
    │   ├── notifications/         — list/mark-read hooks, NotificationRow.tsx
    │   ├── users/                  — admin list/invite hooks, InviteUserModal.tsx, UserListItem.tsx
    │   └── ai-chat/                — send-message hook, ChatBubble/TransactionActionCard/EditMessageModal/EditTransactionModal
    ├── components/
    │   ├── ui/                    — Avatar, Card, Chip, PillButton, PillTag, ProgressBar, Icon (hand-drawn SVG set)
    │   └── shared/                 — Drawer (shared bottom-sheet form chrome), BottomNav, Screen, TopBar, WalletCard,
    │                                  TransactionRow, BudgetCard, DonutChart, NewBudgetModal, Date/SingleDatePickerModal,
    │                                  TypingIndicator
    ├── lib/
    │   ├── axios.ts               — direct-to-backend client (no BFF — see below), JWT interceptor, 401 handling
    │   ├── query-client.ts        — TanStack QueryClient singleton
    │   ├── secure-storage.ts      — expo-secure-store wrapper
    │   ├── constants.ts           — mirrors backend/internal/common/constants.go
    │   ├── currency.ts            — ported verbatim from frontend/src/lib/currency.ts
    │   ├── config.ts               — env-driven config (EXPO_PUBLIC_API_BASE_URL — see EAS profiles, §9)
    │   ├── category-color.ts      — deterministic color assignment for categories without a photo
    │   ├── format-date.ts
    │   └── use-keyboard-height.ts  — custom keyboard-height hook (see §3 note above and SDS §3.2/§12.1)
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
| `react-native-svg` | `15.12.1` (pinned) | Donut chart segments + the hand-drawn icon set (no icon font/library) |
| `expo-blur` | `~15.0.8` | `BlurView` behind the floating bottom-nav pill |
| `expo-image-picker` | `~17.0.11` | Category icon photo picking (`CategoryFormModal.tsx`) — device library only, uploads immediately on pick via `POST /categories/icon` |
| `react-native-calendars` | `^1.1314.0` | Date pickers (`DateRangePickerModal`/`SingleDatePickerModal`) — Transaction date, report date-range filters |
| `@react-native-async-storage/async-storage` | `2.2.0` | Peer dependency pulled in by another package (not directly used for app persistence — `expo-secure-store` remains the only session store) |

**Dev dependencies:** `typescript ~5.9.2`, `eslint ^9.0.0` + `eslint-config-expo ~10.0.0` (via `npx expo lint`). Note `expo-router`'s own package version (`~6.0.24`) doesn't track the Expo SDK number 1:1 — don't assume version-number parity between the two when cross-referencing Expo's docs.

⚠️ `expo-status-bar` must **not** be listed in `app.json`'s `plugins` array on this SDK — its config-plugin resolution throws `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` if present (see `mobile/AGENTS.md`).

**Not yet a dependency:** any form library — every Drawer-based form (Wallet/Category/Budget/Transaction) is still plain `useState`, small enough not to need `react-hook-form`. The donut chart is hand-built on `react-native-svg` rather than a charting library (`src/components/shared/DonutChart.tsx` — stacked `<Circle>` arcs via `strokeDasharray`/`strokeDashoffset`).

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

### Auth flow (mobile, `src/lib/axios.ts` / `src/stores/session-store.ts`)

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
- **File upload (`POST /categories/icon`):** uploaded bytes go straight to a Cloudflare R2 bucket via `R2IconUploader` (`backend/internal/service/icon_uploader.go`); the client-supplied filename is sanitized (path separators stripped) before it becomes part of the object key, and a `uuid`-prefixed key guarantees uniqueness regardless.
- **Error-response accuracy gap (confirmed defect, not yet fixed):** the global Fiber `ErrorHandler` (`main.go`) routes every error, including Fiber's own built-in 404/405 `*fiber.Error`s, through `response.Error`, which only special-cases `*common.AppError` — everything else is coerced into a blanket `500 INTERNAL_ERROR`. This masks real routing errors (e.g. hitting a stale-deployed backend that lacks a route yet) as generic server errors in both logs and client responses. See `SDS.md` §6.1 API Design Standards and §12.1 Known Issues Log for the fix and the incident that surfaced it.

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
| Category icon storage | Cloudflare R2 via `minio-go` (S3-compatible) | Lighter than `aws-sdk-go-v2` for a single-bucket, single-operation use case | Both `EmailSender` and `IconUploader` degrade to a no-op/log fallback when unconfigured, so a missing `R2_*`/`SMTP_*` env var fails one request, not the whole boot — but it also means a misconfigured VPS fails *silently* per-request rather than at deploy time |
| Mobile distribution | EAS Build → internal `.apk` (`mobile/eas.json`) | CLAUDE.md: no App Store/Play Store submission, test builds only | `submit.production` block exists but unused; `preview`/`production` profiles both point at the same hardcoded production API URL (`https://api.example.com/api/v1`) — no staging API target |

---

## 9. CI/CD & Release Process {#9-ci-cd}

Four GitHub Actions workflows exist under `.github/workflows/` — none of this was documented as of the last `/renew-docs` pass (2026-08-16), since none of it existed yet.

| Workflow | Trigger | What it does |
|---|---|---|
| `ci-pr.yml` | PR against `develop` | Gate — runs the same checks as the deploy workflows without shipping anything |
| `backend-test.yml` | Called by `ci-pr.yml` and `deploy-backend.yml` (`workflow_call`) | `go vet` + `go test` for `backend/` — single source of truth so a broken build can't reach either caller |
| `deploy-backend.yml` | Push to `develop` touching `backend/**` (path-filtered — a mobile/frontend-only push never rebuilds the API), or manual `workflow_dispatch` | Runs `backend-test.yml` → builds and pushes a Docker image to Docker Hub → Trivy vulnerability scan → syncs deploy files and SSHes into the VPS to redeploy |
| `deploy-ai-service.yml` | Push to `develop` touching `ai-service/**` (same path-filter pattern) | Equivalent build/deploy pipeline for the Python AI Service |

**Operational implication (see `SDS.md` §12.1 Known Issues Log):** this pipeline is what *should* keep the VPS's backend in sync with `develop` automatically. A production symptom that only makes sense against an older backend build (e.g. a 405 on a route added in a recent commit) means either this workflow's run for that commit failed, was skipped, or hasn't fired yet — check the Actions run history before assuming a code fix is needed.

`mobile/` ships via **EAS Build**, not this CI (`mobile/eas.json`): a `preview` profile (`buildType: apk`, internal distribution) and a `production` profile (`autoIncrement: true`), both pointed at the same hardcoded `EXPO_PUBLIC_API_BASE_URL` (the production VPS) — there is no separate staging API target for mobile builds.

---

## 10. Key Scenarios (Scenario View — from `specs/*/spec.md`, not aspirational)

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
