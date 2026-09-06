# PFM — Architecture Design

_Last updated: 2026-08-22_
_Updated by: /renew-docs_

> Source of truth: generated from the actual codebase (`docker-compose.yml`, `backend/go.mod`, `backend/cmd/server/routes.go`, `backend/db/migrations/`, `mobile/package.json`, `frontend/package.json`, `.github/workflows/*`), not from initial design intent. This file replaces the previous `docs/architecture_design.md`, which had drifted from actual code.
>
> **2026-08-16: `mobile/` was rebuilt from scratch as React Native (Expo), replacing the previous Flutter app** (deleted by the user). Same-day, later in this session, the full screen set was implemented against `mobile/design_handoff_pfm_app/` (Home, Transactions, Insights, AI Chat, Notifications, Profile) — see §3, no longer scaffold-only.
>
> **2026-08-21 update:** significant drift since the above — `mobile/` gained full CRUD feature screens for Wallets, Categories, Budgets, Users (admin), on top of what was previously entry-point-only rows; Category icons can now be an uploaded photo (Cloudflare R2 via `minio-go`), not just emoji text; invite emails are sent via real SMTP; four GitHub Actions workflows now build/test/deploy the backend, AI service, and gate PRs; mobile ships as an EAS-built `.apk`. See §3, §5 (renumbered), §9 (CI/CD, new), and `SDS.md` §12.1 Known Issues Log for a defect found while verifying this update (production VPS lagging behind the `develop` HEAD it should auto-deploy from).
>
> **2026-08-22 update:** drift here spans commits from later on 2026-08-21 through 2026-08-22 (the prior doc pass was written early on 08-21, per its own now-stale Known Issues about wallet/budget icons and the Drawer keyboard bug). Confirmed by commit timestamps (`git log --date=format:...`), not assumed: (1) later on **2026-08-21**, one commit (`5d4718e`, 14:37) bundled three features together — session refresh (`POST /api/v1/auth/refresh`, `specs/mobile-session-refresh/`, rotates a refresh token before revoking the old one; mobile's `axios.ts`/`session-store.ts` do both a proactive scheduled refresh and a reactive single-retry-on-401, de-duplicated across concurrent requests), a floating Debug Console (`specs/mobile-debug-console/`), and per-screen Loading Skeletons (`specs/mobile-loading-skeletons/`) — the latter two are user-requested, non-SRS, and deliberately built with zero new native dependencies; (2) also 2026-08-21: Wallet/Budget icon uploads shipped (`5bbb85d`/`f7487dc`, `specs/wallet-budget-icons/`) — migrations `013_wallets_icon.sql`/`014_budgets_icon.sql` plus `POST /wallets/icon` and `POST /budgets/icon`, closing the gap §12.1 Known Issues previously flagged; the mobile app was also renamed to **"Budgest"** (`ed677b7`, 16:13) with a new icon/logo; (3) on **2026-08-22**, the Drawer keyboard-covering-input bug got its real fix (`686043a`, 11:34 — `useKeyboardHeight` hook + Android `softwareKeyboardLayoutMode: resize`, replacing a broken `KeyboardAvoidingView`; an earlier same-day-08-21 attempt in `ff77d11` hadn't fully solved it), and a fifth GitHub Actions workflow, `add-ssh-key.yml` (`2fd2d87`, 09:09), was added. See §2, §3, §7, §9.

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
| GET | `/api/v1/health` | No | – | Inline handler in `routes.go` — deploy-verification probe used by CI/CD after a VPS deploy; no DB call, just proves the process is up |
| POST | `/api/v1/auth/activate` | No | – | `AuthHandler.Activate` |
| POST | `/api/v1/auth/login` | No (`LoginRateLimiter`) | – | `AuthHandler.Login` |
| POST | `/api/v1/auth/logout` | No | – | `AuthHandler.Logout` |
| POST | `/api/v1/auth/refresh` | No | – | `AuthHandler.Refresh` — **new since 2026-08-21** (`specs/mobile-session-refresh/spec.md` US-01/US-02); rotates the refresh token (new pair minted before the old one is revoked); no rate limiter, same reasoning as `/auth/logout` — the refresh token itself is the credential, no password-guessing surface |
| POST | `/api/v1/admin/users/invite` | Yes | admin | `UserHandler.InviteUser` (+ `InviteRateLimiter`) |
| GET | `/api/v1/admin/users` | Yes | admin | `UserHandler.ListUsers` |
| POST | `/api/v1/wallets/icon` | Yes | any | `WalletHandler.UploadIcon` — **new since 2026-08-21** (`specs/wallet-budget-icons/spec.md` US-01), standalone upload step before the wallet exists, same convention as categories' icon upload |
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
| POST | `/api/v1/budgets/icon` | Yes | any | `BudgetHandler.UploadIcon` — **new since 2026-08-21** (`specs/wallet-budget-icons/spec.md` US-03), same standalone-upload convention |
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
| 013 | `wallets_icon` | additive `icon` (emoji/text) + `icon_url` (uploaded photo) columns on `wallets` — **new since 2026-08-21**, closes the gap noted below |
| 014 | `budgets_icon` | additive `icon` + `icon_url` columns on `budgets`, independent of the linked Category's own icon — **new since 2026-08-21** |

No `pgvector` extension is enabled anywhere in the actual migrations (unlike the superseded `architecture_design.md`, which described it as already enabled). `wallets` and `budgets` now carry the same `icon`/`icon_url` precedence convention as `categories` (icon_url takes display precedence when both are set) — as of 2026-08-21 this was a gap (`SDS.md` §12.1 Known Issues Log, Item 3); migrations 013/014 plus `POST /wallets/icon`/`POST /budgets/icon` (§2 routes) closed it.

**Key tables:** `users`, `revoked_tokens`, `wallets`, `categories`, `budgets` + `budget_limits`, `transactions`, `notifications`, `chat_messages`.

⚠️ **Operational gotcha, hit live in this session:** `docker-entrypoint-initdb.d/*` scripts only run once, on a genuinely empty Postgres volume. A long-running dev volume that predates a migration file being added will silently never pick it up — `009_notifications.sql` had to be applied by hand (`psql < 009_notifications.sql`) against an already-initialized volume from 2026-08-02. This is the concrete failure mode behind the "no automated apply-on-boot" gap already noted in §8's Decisions table — not hypothetical.

⚠️ **Same gotcha, second occurrence (2026-09-06) — this time in production, and worse:** `015`–`018` were never applied to the VPS, so `/ai/chat/thread`, `/ai/chat/thread/sync`, `/transactions/audit-logs` **and `POST /transactions`** all returned 500 `SQLSTATE 42P01 (relation does not exist)` while CI/CD reported a fully green deploy. Two compounding causes, both now fixed:
> 1. **`backend/docker-compose.yml` (the production compose) only mounted `001`–`014`** — the mount list had drifted behind `backend/db/migrations/`, so even wiping the volume would not have created `chat_thread_messages` or `transaction_audit_logs`. The root `docker-compose.yml` (dev) had drifted identically.
> 2. **`backend/deploy.sh` has no migration step at all** — it pulls images, runs `docker compose up -d`, and runs the idempotent admin seed. Nothing applies SQL. And `backend-test.yml`/`ci-pr.yml` compile Go and run unit tests against in-memory fakes with no Postgres anywhere, so a missing table cannot fail CI.
>
> **Why `POST /transactions` broke too, not just the two new endpoints:** the Transaction Audit Log write is deliberately inside the same DB transaction as the wallet-balance mutation and the row insert (`specs/transaction-audit-log/spec.md` Context #1), so a missing `transaction_audit_logs` table fails the whole create rather than silently skipping history. Correct by design, but it means an unapplied migration escalates from "one feature is broken" to "the core write path is broken" — a strong argument for the migration runner below.
>
> **Fixed the same day — migrations are now applied automatically:** `backend/cmd/migrate` (a one-shot binary, same pattern as the existing `cmd/seed`) keeps a `schema_migrations` ledger — `filename` PK + sha256 `checksum` + `applied_at` — and applies only pending files, each inside its own transaction together with its own ledger insert, so a migration is never applied-but-unrecorded or recorded-but-unapplied. `backend/deploy.sh` runs it right after `docker compose up -d` and before `cmd/seed`; a failure exits non-zero and (with the workflow's `script_stop: true`) fails the deploy, which is the point — a half-migrated schema stops the release instead of surfacing as runtime 500s.
>
> The `.sql` files are compiled into the binary with `go:embed` (`backend/db/migrations.go`, which is why that package sits at `backend/db/` — `go:embed` cannot reach upward out of its own package), so the deployed image carries exactly the schema its server binary expects; there is no volume mount, synced host directory, or working-directory assumption in the apply path. `002_seed_admin.sql` stays excluded via `db.SkippedMigrations`, matching both compose files' initdb mount lists (it carries a placeholder password hash). `backend/db/migrations_test.go` fails the build if the embed pattern ever drifts from the directory, since a broken pattern would otherwise report "schema up to date" against an empty set.
>
> **No operator step is needed to adopt an existing environment.** On its first run (ledger empty), a migration that fails with a duplicate-object SQLSTATE — `42P07` table/index, `42701` column, `42710`, `42P06`, `42723`, `42P16` — is recorded as applied instead of aborting, because that error *is* the proof it already ran; genuinely missing migrations still apply normally. Adoption is permitted on that first run only: once the ledger is populated, the same error is a real failure and fails the deploy. A `-baseline` flag remains as an escape hatch for the case adoption cannot infer (a migration written entirely with `IF NOT EXISTS` raises no error to detect, so on a database where it never ran it would be recorded as applied without its objects existing).
>
> Its one limitation, logged per adopted file so it can be eyeballed once: adoption infers "already applied" from the first colliding statement, so a file left genuinely *half*-applied (initdb runs each file without a wrapping transaction, so a mid-file crash could do that) would be adopted as complete.
>
> **Making every migration re-runnable was part of this**, since the runner now executes pending files on every deploy and the adopt path only covers duplicate-*object* errors:
> - `006_seed_categories.sql` had a bare `INSERT` of the 10 system categories. `idx_categories_owner_name_type_unique` is `NULLS NOT DISTINCT`, so system rows really do collide — a second run would have raised `23505 unique_violation`, which is deliberately *not* adoptable, and aborted the deploy. It now carries the same `ON CONFLICT ... DO NOTHING` clause `017` already used.
> - `016_transactions_created_at_sort_index.sql`'s bare `DROP INDEX` became `DROP INDEX IF EXISTS` (a re-run against an already-dropped index raises `42704 undefined_object`, also not adoptable).
> - `018_transaction_audit_logs.sql` uses `IF NOT EXISTS` throughout.
>
> The `docker-entrypoint-initdb.d` mounts are kept as-is for genuinely fresh volumes; the runner then finds nothing pending.
>
> `golang-migrate` remains listed in CLAUDE.md's stack but is still not used — this runner is ~150 lines with no new dependency, and adopting `golang-migrate` would mean renaming every migration to its `NNN_name.up.sql` convention.

---

## 3. Mobile Architecture (React Native + Expo, `mobile/`)

**Expo SDK:** `^54.0.36` · **React Native:** `0.81.5` · **React:** `19.1.0` · **TypeScript:** `~5.9.2` (from `mobile/package.json`).

`mobile/` was deleted and rebuilt from scratch on 2026-08-16 as React Native (Expo), replacing the previous Flutter app. The initial pass that day was setup-only; later the same session the first screen set was built against the high-fidelity design handoff at `mobile/design_handoff_pfm_app/` (`PFM App.dc.html` + `README.md`, a dark "Noctis"-themed prototype — treated as a visual/behavioral spec, not copied as markup). Since then (commits `455bfb1` "customer drawer, implement the remaining features" through `fe4f6cc`), every Profile entry-point row that used to be inert has become a real screen with full CRUD:

- **Home** (`app/(app)/index.tsx`) — hero balance card (sum of wallets sharing the default wallet's currency), horizontal wallet cards, recent transactions
- **Transactions** (`app/(app)/transactions.tsx`) — filter chips (All/Income/Expense), cursor-paginated infinite list, create/edit via `TransactionFormModal` (`src/features/transactions/`)
- **Wallets** (`app/(app)/wallets.tsx`) — list + create/edit/set-default via `WalletFormModal` (`src/features/wallets/`); photo upload/replace via `expo-image-picker` + `POST /wallets/icon` (`use-upload-wallet-icon-mutation.ts`) shipped 2026-08-21 (`specs/wallet-budget-icons/`), closing the gap the 2026-08-21 pass of this doc had flagged
- **Categories** (`app/(app)/categories.tsx`) — list + create/edit/delete via `CategoryFormModal` (`src/features/categories/`), including photo upload/replace via `expo-image-picker` + `POST /categories/icon` (`use-upload-category-icon-mutation.ts`)
- **Insights** (`app/(app)/insights.tsx`) — Spending sub-tab (stat cards + clickable SVG donut chart + legend, `src/components/shared/DonutChart.tsx`) and Budgets sub-tab (stacked Budget-vs-Actual bars + create/edit via `NewBudgetModal`/`src/features/budgets/`); Budget photo upload via `use-upload-budget-icon-mutation.ts` + `POST /budgets/icon` shipped 2026-08-21 alongside Wallets, same spec
- **Users** (`app/(app)/users.tsx`, admin only) — list + `InviteUserModal` (`src/features/users/`), the mobile UI for F-01's admin-invite flow
- **AI Chat** (`app/(app)/ai-chat.tsx`) — chat thread against `POST /ai/chat`, renders a `TransactionActionCard` for parsed transactions, confirms via the existing `POST /transactions` (reusing its `idempotency_key`); also supports editing a proposed transaction (`EditTransactionModal`) and editing/retrying a sent message (`EditMessageModal`)
- **Notifications** (`app/(app)/notifications.tsx`) — full-screen overlay from the Home bell, day-grouped, unread-only toggle
- **Settings** (`app/(app)/settings.tsx`, renamed from `profile.tsx`) — stat cards + navigation rows into the screens above + logout; no rows are inert placeholders anymore

Every create/edit form (Wallet/Category/Budget/Transaction) shares one bottom-sheet chrome — `src/components/shared/Drawer.tsx` — introduced in `455bfb1` alongside these screens. **Fixed 2026-08-22 (`686043a`):** it previously had no working keyboard-avoidance logic (SDS §3.2 UI/UX Principles, §12.1 Known Issues Log Item 2 — a `KeyboardAvoidingView` attempt failed to restore layout once the keyboard closed). It now uses a custom `useKeyboardHeight()` hook (`src/lib/use-keyboard-height.ts`, sourced from OS keyboard-visibility events) to pad the ScrollView's `contentContainerStyle` by the live keyboard height, combined with `android.softwareKeyboardLayoutMode: "resize"` in `app.json` (Android otherwise ignores `adjustResize` above targetSdk 35).

Auth (`app/(auth)/login.tsx` + `src/features/auth/`) was also completed as a prerequisite — the screens above need a real session. There is no `GET /users/me` endpoint and the JWT's `AccessClaims` carry only `user_id`/`role` (`backend/internal/service/token_service.go`) — Settings's name/email come from the email typed at login, persisted client-side (`src/stores/session-store.ts`), not re-verified server-side. **Session refresh, added 2026-08-21** (commit `5d4718e`, `specs/mobile-session-refresh/`): `session-store.ts` schedules a proactive refresh ahead of access-token expiry (`lib/refresh-scheduler.ts`) and `lib/axios.ts`'s response interceptor retries exactly once on a 401 via `refreshSession()`, both paths sharing one in-flight `POST /auth/refresh` call so concurrent requests never fire duplicate refreshes; any refresh failure force-clears the session. There is still no rate limiter on `/auth/refresh` (§7).

Two further mobile-only, non-SRS features shipped 2026-08-21 (same commit, `5d4718e`, as the session-refresh work above) as explicit user requests (not tied to any numbered F-xx feature):
- **Debug Console** (`specs/mobile-debug-console/`) — a draggable floating bubble (`src/components/debug/DebugBubble.tsx`, built on core `PanResponder`/`Animated.ValueXY`, no new gesture/animation library) mounted globally in the root layout; tapping it opens a fullscreen log viewer (`DebugLogViewer.tsx`) backed by an in-memory 500-entry ring buffer (`src/stores/debug-log-store.ts`) of navigation changes, API request/response/error activity, and uncaught JS errors. Ships in every build (including release `.apk`), not just `__DEV__`, since that EAS-built `.apk` is the only build QA actually tests on.
- **Loading Skeletons** (`specs/mobile-loading-skeletons/`) — replaced bare `<ActivityIndicator>` spinners with content-shaped placeholders on Home, Transactions, Insights, Categories, and Users, via one shared `SkeletonBlock` primitive (`src/components/ui/SkeletonBlock.tsx`, pulsed with React Native's built-in `Animated` API) composed per-screen (`WalletCardSkeleton`, `TransactionRowSkeleton`, `BudgetCardSkeleton`, `CategoryListItemSkeleton`, `UserListItemSkeleton`, `SpendingTabSkeleton`). No new dependency, mirroring the Debug Console's same no-new-native-dependency stance. UI-only — no query/DTO/API change.

The app was also renamed from its working title to **"Budgest"** (`mobile/app.json` `expo.name`, Android package remains `com.example.pfm`) with a new icon/logo/splash screen, and picked up `expo-splash-screen` (`~31.0.13`) as a dependency + config plugin.

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
│       │   notifications.tsx, users.tsx (admin), ai-chat.tsx, settings.tsx,
│       │   developer.tsx
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
    │   ├── ui/                    — Avatar, Card, Chip, PillButton, PillTag, ProgressBar, Icon (hand-drawn SVG set), SkeletonBlock (new)
    │   ├── debug/                  — DebugBubble, DebugLogViewer (new, mobile-debug-console)
    │   └── shared/                 — Drawer (shared bottom-sheet form chrome), BottomNav, Screen, TopBar, WalletCard,
    │                                  TransactionRow, BudgetCard, DonutChart, NewBudgetModal, Date/SingleDatePickerModal,
    │                                  TypingIndicator
    ├── lib/
    │   ├── axios.ts               — direct-to-backend client (no BFF — see below), JWT interceptor, 401-retry-once via refreshSession()
    │   ├── api-envelope.ts        — unwrap()/getErrorMessage()/getErrorCode() (extracted out of axios.ts, no session-store dependency)
    │   ├── refresh-scheduler.ts   — schedules/cancels the proactive pre-expiry refresh timer (new, mobile-session-refresh)
    │   ├── query-client.ts        — TanStack QueryClient singleton
    │   ├── secure-storage.ts      — expo-secure-store wrapper
    │   ├── constants.ts           — mirrors backend/internal/common/constants.go
    │   ├── currency.ts            — ported verbatim from frontend/src/lib/currency.ts
    │   ├── config.ts               — env-driven config (EXPO_PUBLIC_API_BASE_URL — see EAS profiles, §9)
    │   ├── category-color.ts      — deterministic color assignment for categories without a photo
    │   ├── date-range.ts, format-date.ts, number-to-words-vi.ts
    │   ├── redact.ts              — strips sensitive fields before they hit the Debug Console's log store
    │   ├── global-error-logger.ts — feeds uncaught JS errors into the Debug Console's ring buffer
    │   └── use-keyboard-height.ts  — custom keyboard-height hook (see §3 note above and SDS §3.2/§12.1 — now fixed)
    └── stores/
        ├── session-store.ts       — global Zustand store (accessToken/refreshToken/email/isHydrated), owns refreshSession()
        └── debug-log-store.ts     — in-memory 500-entry ring buffer for the Debug Console (new)
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
| `expo-image-picker` | `~17.0.11` | Icon photo picking, now used by Category, Wallet, and Budget forms (as of 2026-08-21) — device library only, uploads immediately on pick via `POST /{categories,wallets,budgets}/icon` |
| `expo-splash-screen` | `~31.0.13` | **New 2026-08-21** — custom splash image/background color, added with the "Budgest" rename |
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

- **Auth:** `golang-jwt/jwt v5` access token (short TTL) + refresh token; logout revokes via the `revoked_tokens` table (`003_revoked_tokens.sql`). `POST /auth/refresh` (new since 2026-08-21, `specs/mobile-session-refresh/spec.md`) rotates the refresh token: `AuthService.Refresh` parses the presented token unverified for `jti`/`subject`/`expiresAt`, rejects if expired or already revoked (`revokedRepo.IsRevoked`), then mints a new access+refresh pair *before* revoking the old `jti` — a mid-request failure leaves the old token merely still-valid for the remainder of its own TTL, never the caller with nothing.
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
| Refresh token rotation | New pair minted before the old `jti` is revoked | `specs/mobile-session-refresh/spec.md` Edge Case #1 | A mid-request crash leaves the old token merely still-valid for its remaining TTL, rather than the caller stranded with zero valid credentials |
| Mobile Debug Console / Loading Skeletons | Built on RN core (`PanResponder`/`Animated`) only, zero new native deps | Both were ad-hoc user requests, not SRS features; a new native module would force a fresh EAS build given the SDK-54 pinning constraints (`mobile/AGENTS.md`) | Less polished than `react-native-reanimated`/`react-native-gesture-handler` would give, but avoids reopening the SDK-compatibility exercise from §3 |

---

## 9. CI/CD & Release Process {#9-ci-cd}

Four GitHub Actions workflows exist under `.github/workflows/` — none of this was documented as of the last `/renew-docs` pass (2026-08-16), since none of it existed yet.

| Workflow | Trigger | What it does |
|---|---|---|
| `ci-pr.yml` | PR against `develop` | Gate — runs the same checks as the deploy workflows without shipping anything |
| `backend-test.yml` | Called by `ci-pr.yml` and `deploy-backend.yml` (`workflow_call`) | `go vet` + `go test` for `backend/` — single source of truth so a broken build can't reach either caller |
| `deploy-backend.yml` | Push to `develop` touching `backend/**` (path-filtered — a mobile/frontend-only push never rebuilds the API), or manual `workflow_dispatch` | Runs `backend-test.yml` → builds and pushes a Docker image to Docker Hub → Trivy vulnerability scan → syncs deploy files and SSHes into the VPS to redeploy |
| `deploy-ai-service.yml` | Push to `develop` touching `ai-service/**` (same path-filter pattern) | Equivalent build/deploy pipeline for the Python AI Service |
| `add-ssh-key.yml` | **New since 2026-08-21** | Registers/rotates the SSH key used by `deploy-backend.yml`/`deploy-ai-service.yml` to reach the VPS from a personal machine (commit `2fd2d87` "feat: ssh key from personal machine") |

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
| S-REF-* | Mobile Session Refresh (not an SRS-numbered F-xx feature) | `specs/mobile-session-refresh/spec.md` — implemented, mobile + backend (§2, §3, §7) |
| — | Wallet & Budget Icon Upload (not an SRS-numbered F-xx feature) | `specs/wallet-budget-icons/spec.md` — implemented, mobile + backend (§2, §3) |
| — | Mobile Debug Console (not an SRS-numbered F-xx feature, explicit user request) | `specs/mobile-debug-console/spec.md` — implemented, mobile-only (§3) |
| — | Mobile Loading Skeletons (not an SRS-numbered F-xx feature, explicit user request) | `specs/mobile-loading-skeletons/spec.md` — implemented, mobile-only, UI-only change (§3) |
