# PFM — Current Project State

_Last updated: 2026-11-18_
_Command: /cook-state_

> ⚡ Load file này đầu tiên khi bắt đầu session mới.
> Không edit manual — chạy /cook-state để refresh.

---

## TL;DR — Project Health

- **Phase:** MVP done (F-01→F-07, F-10 on backend + web + mobile). Release-1 AI work: Feature-12 US-01 (create-via-chat) + **US-03 Query Spending (consult mode) shipped**; F-13.1 Budget Wizard v2 mostly shipped. Web (`frontend/`) is frozen — all new client work is mobile-only.
- **Overall completion:** MVP 100%. Feature-12: US-01 ✅, US-03 ✅ (`/analytics/query`, `/analytics/consult`), US-02 edit-via-chat / US-04 advice unbuilt. F-13.1: US-03/US-04/US-09 still zero code.
- **Last feature shipped:** Mobile light theme (commit `43e30b8`, 2026-10-03) — `ThemePicker` rendered inline on Settings; before that AI consult screen UI polish (`540c502`).
- **Currently in progress:** **Spending intentions + delete failed chat replies** (`specs/ai-chat-spending-intentions/`, Feature-12 US-06/US-07) — implemented 2026-11-18 (backend, AI service, mobile), automated tests pass, **mobile screens not yet checked on a device** and not committed. Same day, performance changes (not measured on a device): Transactions form host, Budgets and Spending sheet hosts with kept-mounted drawers, param-driven filter reset deferred until the tab slide ends.
- **Next up:** on-device check of the intention flow and the failed-reply delete → add intention rows to the consult golden set (`ai-service/tests/golden/analytics_intents.jsonl`) → F-13.1 I-1 cycle window + `AppTimezone` → Feature-12 US-04.
- **Blockers:** none for the UX batch. Known bug in scope: viewing history of a soft-deleted TX from chat → 404.

---

## What's Actually Working (Code + DB + UI)

| Feature | Backend | Web (frontend/, frozen) | Mobile |
|---|---|---|---|
| F-01 User Management (+ resend invite, mig 024) | ✅ | ✅ | ✅ (`app/(app)/users.tsx`) |
| F-02 System Security (JWT, `/auth/refresh`; sessions mig 028; device-bound sessions mig 033, 2026-10-19) | ✅ | ✅ | ✅ silent refresh, account switching, device list, change password, app lock (2026-10-19 revision in progress) |
| F-03 Wallet Management (+ icon) | ✅ | ✅ | ✅ (carousel on Home + Wallets) |
| F-04 Category Management (+ icon, `system_key`) | ✅ | ✅ | ✅ |
| F-05 Budget Management (+ icon, bulk) | ✅ | ✅ | ✅ |
| F-06 Transaction Management (+ **transfer type** mig 022, sort/filter, export, audit log, delete guardrails) | ✅ | ✅ (core) | ✅ (import pill commented out) |
| F-07 Financial Reporting | ✅ | ✅ | ✅ (Insights) |
| F-10 Notification Handling (in-app, `budget_exceeded` only) | ✅ | ✅ | ✅ |
| Feature-12 US-01 AI Chat create-TX (thread sync) | ✅ | ✅ | ✅ |
| Feature-12 US-03 Query Spending (consult mode, `intent_parse_log` mig 021) | ✅ | ❌ | ✅ (`ConsultPane`) |
| Feature-12 US-06 Spending intentions (`spending_intentions` mig 038; several per sentence, kept, edited, deleted; weighed together against Budgets, usual spending per Category and the usual surplus, month by month) | ✅ | ❌ | ✅ (`features/spending-intentions`, device check pending) |
| Feature-12 US-07 Delete a failed chat reply (`dismissed` flag on the synced message) | n/a | ❌ | ✅ (device check pending) |
| F-13.1 AI Budget Wizard v2 | ✅ partial | ❌ | ✅ |
| Theming (dark + light, `features/settings/ThemePicker`) | — | — | ✅ |

---

## Partial / In Progress

- 🔶 **F-13.1 Budget Wizard v2** — I-1 cycle window/timezone, I-2 plan versioning (`budget_plans` unwritten), I-3 US-09 server-side budget impact, I-4 first-submit race.
- 🔶 **Feature-12** — US-02 edit-via-chat (only client-side edit of proposal), US-04 advice unbuilt.
- 🔶 **F-10** — no push notifications.
- 🔶 **F-11 Dashboard** — real Home screen exists, never specced.
- 🔶 **Transaction import** — backend + mobile code exist, UI pill commented out in `TransactionsHeader.tsx`.
- 🔶 **QC coverage** — `test_cases.md` only for `security/`, `user-management/`.

---

## Specced, Not Yet Coded

- 📋 **F-13.1 US-03 / US-04 / US-09** — `specs/ai-budget-wizard-v2/`.
- 📋 **Mobile UX batch 2026-10** — `specs/mobile-ux-batch-2026-10/` (being written).
- 🔶 **Spending intentions** — `specs/ai-chat-spending-intentions/` has spec, plan and test cases; code exists, device check and golden-set rows outstanding.

---

## Key Technical Decisions (không được thay đổi)

| Decision | Value | Reason |
|----------|-------|--------|
| Money storage | BIGINT xu everywhere; overflow-safe `common/money.go` | Float precision |
| JWT strategy | access 15m + refresh bound to a `sessions` row (mig 028), one per user per device (mig 033), 60 d idle / 180 d absolute, rotation + reuse detection; mobile refreshes silently, each saved account keeps its own session (switch = refresh). Updated 2026-10-19 (was refresh 7d + `revoked_tokens`) | Session UX |
| DB access | sqlc only; local sqlc CLI version differs → hand-write new queries into generated files | Avoid unreviewable regen diff |
| Error format | `{error_code, message, details?}` | Consistent |
| Cursor pagination | `{id, created_at}` base64 cursor | Scale-ready |
| Budget scope | 1 active budget per (user, category), per-currency limits; monthly-only | — |
| Transfers | one row with `to_wallet_id`, not an expense+income pair (mig 022) | Reports never show phantom spend/earn |
| AI Chat routing | User picks mode (`chat-mode.ts`: transaction / budget / consult), no LLM intent routing between them | Wrong guess silently mis-files a message |
| Analytics rate limit | `/analytics/*` outside `/ai` group; only `/analytics/consult` limited (own limiter) | Don't burn create-TX quota |
| AI extraction | Groq primary, Anthropic fallback, tool calling (flat schema) | Prose JSON unreliable |
| Mobile | Expo SDK 54 pinned; TanStack Query + Zustand; direct axios; Reanimated 4 and RN `Animated` (native driver) side by side, `PanResponder` for swipes | Expo Go compatibility; see the memory notes on nav/drawer/theme-scope for the measured traps |
| Client priority | `frontend/` web frozen; client work goes to `mobile/` | User decision |

---

## Established Patterns (follow these)

### Backend
- Handler: parse + shape validation → service (business rules + DB tx) → repository (sqlc).
- `fake_*_repo_test.go` in-memory fakes per service.
- `routes.go` comments cite spec/plan findings; literal-path GETs before `/:id`.
- Migrations: mount in **both** compose files; re-runnable (`IF NOT EXISTS`).

### Mobile (`mobile/`, React Native + Expo)
- `app/` thin routes → `src/features/{feature}/{api,components,hooks}` + `types.ts`.
- Styles via `createStyles((colors) => …)` + `useColors()` (theme-reactive); tokens in `src/lib/theme`.
- Shared primitives: `src/components/ui/`, `src/components/shared/` (`SwipeableRow`, `QuickActionsPopup`, `BottomNav`…).
- Chat thread lives in `stores/chat-store.ts` (persisted + server-synced as opaque payload); mode in `chat-mode.ts` (not persisted).
- All user-facing copy in Vietnamese. File > 300 lines → split.

### SQL
- Money `BIGINT NOT NULL`; `TIMESTAMPTZ`; soft delete `deleted_at`; `uuid_generate_v4()`; every query `AND user_id = $n`.

---

## Current Schema (migrations applied)

| # | Migration | Key Changes |
|---|-----------|-------------|
| 001 | init | `users`, uuid-ossp + pgvector |
| 002 | seed_admin | admin seed |
| 003 | revoked_tokens | token revocation |
| 004 | wallets | one-default-per-user idx |
| 005 | categories | owner+name+type unique idx |
| 006 | seed_categories | system categories |
| 007 | budgets | `budgets` + `budget_limits`; monthly-only CHECK |
| 008 | transactions | no balance-floor constraint |
| 009 | notifications | `budget_exceeded`-only CHECK |
| 010 | transactions_idempotency_key | idempotency key |
| 011 | chat_messages | AI context log |
| 012 | categories_icon_url | category icon |
| 013 | wallets_icon | wallet icon |
| 014 | budgets_icon | budget icon |
| 015 | chat_thread_sync | `chat_thread_messages` opaque payload |
| 016 | transactions_created_at_sort_index | sort index |
| 017 | seed_savings_category | "Tiết kiệm" |
| 018 | transaction_audit_logs | audit log table |
| 019 | categories_system_key | `system_key` |
| 020 | budget_plans | plan layer (no code writes it) |
| 021 | intent_parse_log | analytics question log, hard-deleted by retention job |
| 022 | transaction_transfer | `type='transfer'` + `to_wallet_id` |
| 023 | users_email_lowercase | case-insensitive email |
| 024 | users_invite_resend | resend-invite cooldown cols |
| 025 | users_tokens_valid_after | token invalidation cut-off |
| 026 | transactions_location | pinned location on a transaction |
| 027 | users_avatar | profile photo |
| 028 | sessions | one row per sign-in; revocation takes effect at once |
| 029 | transaction_lines | items and adjustments of a transaction |
| 030 | users_username | sign-in by username |
| 031 | access_requests | request an account from the sign-in screen |
| 032 | passkeys | WebAuthn credentials |
| 033 | session_devices | device-bound sessions |
| 034 | wallets_color | card colour |
| 035 | wallet_members | shared wallets |
| 036 | password_reset_codes | 6-digit reset code by email |
| 037 | super_admin | `users.is_super_admin` |
| 038 | spending_intentions | planned spending: BIGINT xu, soft delete, idempotency key unique per user |

---

## API Surface (routes registered — `backend/cmd/server/routes.go`)

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /activate | No | ActivatePageHandler (HTML) |
| GET | /api/v1/health | No | inline |
| POST | /auth/activate · /login · /logout · /refresh | No | AuthHandler |
| GET · DELETE · POST | /auth/sessions · /auth/sessions/:id · /auth/sessions/revoke-all | JWT | device list, sign out one device (2026-10-19), sign out everywhere |
| PUT | /users/me/password | JWT + per-user failed-try limit | change password (2026-10-19) |
| POST | /auth/switch-token · /auth/switch · /auth/switch-token/revoke | JWT · No · No | AccountSwitchHandler — deprecated 2026-10-19 (older app builds) |
| POST · GET · POST | /admin/users/invite · /admin/users · /admin/users/:id/resend-invite | admin | UserHandler |
| POST · GET · GET · PATCH · POST | /wallets/icon · / · /:id · /:id · /:id/set-default | JWT | WalletHandler |
| POST · POST · GET · GET · PATCH · DELETE | /categories/icon · / · / · /:id · /:id · /:id | JWT | CategoryHandler |
| POST ×3 · GET ×2 · PATCH · DELETE | /budgets/icon · /bulk · / · / · /:id · /:id · /:id | JWT | BudgetHandler |
| POST · GET | /transactions/ | JWT | TransactionHandler |
| GET | /transactions/audit-logs | JWT | AuditLogHandler |
| GET · POST · POST | /transactions/export · /import/preview · /import/commit | JWT | Export/ImportHandler |
| GET · PATCH · DELETE | /transactions/:id | JWT | TransactionHandler |
| GET | /reports/summary | JWT | ReportHandler |
| GET · GET · POST | /notifications/ · /:id · /:id/read | JWT | NotificationHandler |
| POST · GET · POST | /ai/chat · /ai/chat/thread · /ai/chat/thread/sync | JWT + AIChatRateLimiter | ChatHandler |
| GET · POST · POST | /ai/budget-wizard/prefill · /ai/budget-proposals · /ai/suggest-category-name | JWT + AIChatRateLimiter | BudgetWizardHandler |
| POST · POST | /analytics/query · /analytics/consult (AIConsultRateLimiter) | JWT | AnalyticsHandler — consult now also answers reply kind `intention` |
| GET · POST · PUT · DELETE | /spending-intentions/ · / · /:id · /:id | JWT | SpendingIntentionHandler (no AI limiter; the sentence itself goes through consult) |

Sessions, passkeys, access requests, shared wallets, password reset and OTA updates have their own routes in `routes.go`, `routes_password_reset.go` and `routes_app_updates.go`; this table lists the money and AI surface only.

All under `/api/v1`.

---

## Active TODOs / Known Issues

- [x] 🐞 History of a soft-deleted TX → 404 — fixed in UX batch (US-13), pending device check.
- [x] 🐞 Pending row currency ($) — fixed in UX batch (US-10), pending device check.
- [ ] `FALLBACK_CURRENCY = "VND"` still duplicated in ~7 files; shared constant now in `mobile/src/lib/constants.ts`.
- [ ] F-13.1 I-1 cycle window + `AppTimezone`, I-2, I-3, I-4.
- [ ] Period boundaries are UTC (month rolls over at 07:00 GMT+7).
- [ ] Files over 300 lines: `backend/internal/service/chat_service.go` (340).
- [ ] `test_cases.md` missing for most specs; `docs/features.md` stale → `/renew-features`.
- [ ] Stray `mobile/pfm/` scaffold → ~40 unrelated tsc errors — leave alone.
- [ ] No `// TODO:` markers in `backend/internal`, `ai-service/app`, `mobile/src`, `mobile/app`.

---

## Environment / Infra Notes

- Local dev: Docker Compose (root + `backend/docker-compose.yml`) — backend, ai-service, postgres, web
- DB: PostgreSQL 16-alpine, 5432
- Backend: Go Fiber, 8090 host / 8080 container
- Mobile: `npx expo start`, `EXPO_PUBLIC_API_BASE_URL`; APK via EAS/Gradle
- AI Service: FastAPI internal `http://ai-service:8000`; Groq `openai/gpt-oss-120b` + Anthropic fallback
- GitNexus: repo `pfm` (pass `repo: "pfm"`), no embeddings; re-indexed 2026-10-03

---

## Files to Read First for Each Task

| Task | Files to read |
|------|--------------|
| Add backend feature | `routes.go`, `service/interfaces.go`, closest handler+service+repo |
| AI chat (record mode) | `mobile/app/(app)/(tabs)/ai-chat.tsx`, `features/ai-chat/{chat-mode.ts,hooks/use-chat-actions.ts,components/ChatMessageRow.tsx}`, `stores/chat-store.ts`, `service/chat_service.go` |
| AI chat (consult mode) | `features/ai-chat/components/ConsultPane.tsx`, `hooks/use-consult-actions.ts`, `features/analytics/*`, `handler/analytics_handler.go` |
| Spending intentions | `specs/ai-chat-spending-intentions/*`, `service/spending_intention_*.go`, `service/consult_intention.go`, `features/spending-intentions/*`, `stores/intention-sheets-store.ts` |
| Mobile UI primitive | `src/components/shared/*`, `src/lib/theme` |
| Update DB schema | latest migration (embedded and applied by `cmd/migrate`, no compose mount) + `backend/db/queries/*.sql` + the hand-written `repository/sqlc/*.sql.go` |
| BA/spec | `SRS.md` §6, `docs/features.md`, closest `specs/*/spec.md` |
