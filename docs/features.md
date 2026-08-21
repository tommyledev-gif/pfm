# PFM — Features Status & Roadmap

_Last updated: 2026-08-21_
_Updated by: /renew-features_

> Clarification answers this run: **Priority = Ổn định MVP + fix bug** (stabilize MVP, fix the 3 confirmed defects found this session before expanding scope); **next feature scope = full-stack** (Wallet/Budget icon support touches migration + backend DTO + mobile UI at once); **preference = enhancement before new feature** (finish icon parity + fix the 3 known bugs before starting Financial Goal/Dashboard); **constraint** = AI Service currently runs `openai/gpt-oss-120b` via Groq's free tier — works well, user is watching it but it's not expected to bind at the current 20–100 user scale, so no urgent action needed there.

---

## 1. Project State Summary

**MVP is fully complete and mobile has reached full feature parity with web** — every screen that was a Profile entry-point-only row as of the last `/renew-docs` (2026-08-16) is now a real CRUD screen (Wallets, Categories, Budgets, Users/admin). Since then, three real defects were found and confirmed via code inspection during this session's `/renew-docs` pass (not yet fixed) — see `SDS.md` §12.1 Known Issues Log for full root-cause detail:

1. **Production VPS lagging behind `develop`** — category icon upload (`405`) and the `/activate` page (`404`→coerced `500`) both work in code as of commit `fe4f6cc` but the symptoms observed on `app.example.com` match an older deployed build. `deploy-backend.yml` should auto-deploy on push to `develop`; its run history for the current `HEAD` needs checking before assuming a manual redeploy is required.
2. **Global error handler masks real HTTP statuses** — `backend/internal/response/response.go`'s `Error()` only special-cases `*common.AppError`; any Fiber-level routing error (404/405) falls through to a blanket `500 INTERNAL_ERROR`, hiding the real cause from both client and logs. Real fix needed regardless of the deployment gap above.
3. **Keyboard covers the focused input in every bottom-sheet form** — the shared `Drawer.tsx` component (Wallet/Category/Budget/Transaction forms) has no keyboard-avoidance logic at all. Fix: wire in the project's existing `useKeyboardHeight()` hook, not a new third-party library.

**Implemented (code + DB + Web + Mobile UI, full CRUD unless noted):**
- **User Management (F-01)** — invite-only flow, admin invite/list, HTML activation page at `GET /activate` (backend + web `features/users` + mobile `features/users`, `app/(app)/users.tsx`, admin-only)
- **System Security (F-02)** — JWT login/logout, invite-token activation, rate limiting (backend + web `features/auth` + mobile `features/auth`)
- **Wallet Management (F-03)** — CRUD, set-default with DB-level uniqueness (backend + web `features/wallets` + mobile `features/wallets`, `app/(app)/wallets.tsx` — **full CRUD now, was read-only as of 2026-08-16**). No icon/photo field yet — see Known Issues Log Item 3 below.
- **Category Management (F-04)** — CRUD, system + user categories, dedup index, **uploaded-photo icon support** (Cloudflare R2 via `minio-go`, migration `012_categories_icon_url.sql`) on top of the existing emoji `icon` text field (backend + web `features/categories` + mobile `features/categories`, `app/(app)/categories.tsx` — **full CRUD + photo upload now, was read-only as of 2026-08-16**). Photo upload currently broken on production per Known Issues Log Item 1 (deployment gap, not a code bug).
- **Budget Management (F-05)** — per-category budget, per-currency limits (backend + web `features/budgets` + mobile `features/budgets`, Insights → Budgets tab). No icon/photo field yet — see Known Issues Log Item 3.
- **Transaction Management (F-06)** — CRUD with atomic wallet-balance update (backend + web `features/transactions` + mobile `features/transactions`)
- **Financial Reporting (F-07)** — summary + by-category totals, filters by date/wallet/category (backend + web `features/reports` + mobile Insights → Spending, incl. donut chart)
- **Notification Handling (F-10)** — budget-exceeded alerts via background scheduler, list/view/mark-read (backend + web `features/notifications` + mobile bell → full-screen overlay)
- **AI Chat Assistant (Feature-12) — US-01 "Create a Transaction via Chat" only** (`specs/ai-chat-assistant/spec.md`) — `ai-service/` (FastAPI, Groq primary/Anthropic fallback, currently `openai/gpt-oss-120b` on Groq's free tier — see constraint note above), `chat_handler.go`/`ChatService`, migration `011_chat_messages.sql`, `idempotency_key` on `transactions` (migration `010`), web `features/ai-chat`, mobile `app/(app)/ai-chat.tsx` (also ships `EditTransactionModal`/`EditMessageModal` — these only edit a not-yet-confirmed proposal or resend a sent message, **not** the SRS's separate "edit an existing transaction via `sửa@` prefix" flow; confirmed `chat_service.go` has no `edit_transaction`/`query_spending`/`general_advice` handling, so US-02/03/04 remain fully unbuilt, not partial).

**New since 2026-08-16, not yet spec'd for implementation:**
- **Wallet & Budget icon/photo support** — extend the pattern already shipped for Categories (emoji text + uploaded photo, replace/remove) to Wallets and Budgets. No DB column, DTO field, endpoint, or mobile UI exists yet for either. Target design already captured in `SDS.md` (Domain Model §2.1.2/§2.1.4, UI/UX Principles §3.2) — run `/cook-ba` next.
- **CI/CD (GitHub Actions) and EAS Build** — `.github/workflows/{ci-pr,backend-test,deploy-backend,deploy-ai-service}.yml` auto-test/build/deploy on push to `develop`; `mobile/eas.json` builds an internal `.apk`. Neither was documented before this run's `/renew-docs`. No spec needed (infra, not a product feature) but worth knowing when debugging "why isn't my change live" questions.

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
| 3 | Wallet Management | FR-01 | ✓ | ✓ | ✓ | ✓ full CRUD | DONE (icon support PARTIAL — planned, not started) |
| 4 | Category Management | FR-03 | ✓ | ✓ | ✓ | ✓ full CRUD + photo upload | DONE (photo upload blocked on prod — deployment gap, see §1) |
| 5 | Budget Management | FR-04 | ✓ | ✓ | ✓ | ✓ full CRUD | DONE (icon support PARTIAL — planned, not started) |
| 6 | Transaction Management | FR-02 | ✓ | ✓ | ✓ | ✓ | DONE |
| 7 | Financial Reporting | FR-07 | ✓ | ✓ | ✓ | ✓ | DONE |
| 8 | Financial Goal | FR-05 | ✗ | ✗ | ✗ | ✗ | BACKLOG (Release 1) |
| 9 | Investment Portfolio | FR-06 | ✗ | ✗ | ✗ | ✗ | BACKLOG (Release 2) |
| 10 | Notification Handling | Feature-10 | ✓ | ✓ | ✓ | ✓ | DONE |
| 11 | Data Overview Dashboard | FR-08 | ✗ | ✗ | ✗ | 🔶 Home screen covers some of this informally | BACKLOG (Release 1) |
| 12 | AI Chat Assistant — US-01 Create via Chat | FR-09 / Feature-12 | ✓ | ✓ | ✓ | ✓ | DONE |
| — | AI Chat Assistant — US-02/03/04 (Edit/Query/Advice) | FR-09 / Feature-12 | ✗ | ✗ | ✗ | ✗ | BACKLOG (Release 1) — not yet specced |
| — | Wallet/Budget icon & photo support | (SDS §12.1 Known Issues Log Item 3) | ✗ | ✗ | ✗ | ✗ | BACKLOG — next `/cook-ba` candidate |

---

## 3. Recommended Next Features

> User direction this run: stabilize MVP and fix known bugs first, enhancement before new scope, full-stack when the next feature does land. That reorders what was previously "next sprint" — Financial Goal moves down, the 3 confirmed defects + Wallet/Budget icon parity move up.

### 🔥 High Priority (next sprint)

#### [FEAT-BUG-01] Verify/fix production deployment gap (Category icon upload + `/activate`)
- **Type:** Bug Fix
- **Rationale:** Two features that are fully implemented in code (`fe4f6cc`) are failing on production with symptoms matching a stale deployed build. Blocks real invite-activation and category-photo-upload usage right now.
- **Scope:** DevOps/CI verification, not new code (unless the workflow run itself reveals a build/test failure)
- **Dependencies:** None
- **Rough complexity:** S
- **Clarifying questions to resolve before BA:** none — this is an operational check, not a spec. Check `deploy-backend.yml`'s run history for `fe4f6cc`/current `HEAD`; re-run via `workflow_dispatch` if it never fired or failed.

#### [FEAT-BUG-02] Fix global error handler swallowing real HTTP statuses
- **Type:** Bug Fix
- **SRS ref:** NFR-06 (updated this session to require accurate error responses)
- **Rationale:** `response.Error()` coerces every non-`AppError` (including Fiber's own 404/405) into `500 INTERNAL_ERROR`. Masks real failures in both logs and client responses — directly caused the confusing symptom in FEAT-BUG-01.
- **Scope:** Backend only
- **Dependencies:** None
- **Rough complexity:** S
- **Clarifying questions to resolve before BA:**
  - [ ] Should the new routing-error codes be `NOT_FOUND`/`METHOD_NOT_ALLOWED` exactly, or namespaced (e.g. `ROUTE_NOT_FOUND`) to avoid colliding with existing per-entity `{ENTITY}_NOT_FOUND` codes?

#### [FEAT-BUG-03] Fix keyboard covering focused input in Drawer forms
- **Type:** Bug Fix
- **SRS ref:** UXR-04 (added this session)
- **Rationale:** Every Wallet/Category/Budget/Transaction form is affected — a User can't see what they're typing on some devices.
- **Scope:** Mobile only
- **Dependencies:** None
- **Rough complexity:** S
- **Clarifying questions to resolve before BA:** none — the fix is already scoped (wire `useKeyboardHeight()` into `Drawer.tsx`); likely simple enough to skip straight to `/cook-plan`.

#### [FEAT-ICON] Wallet & Budget icon/photo support
- **Type:** Enhancement (extends existing Category pattern to two more entities)
- **SRS ref:** FR-01, FR-04 (both updated this session), SDS §12.1 Known Issues Log Item 3
- **Rationale:** User explicitly requested this alongside the 3 bugs above; full-stack scope matches this run's stated priority.
- **Scope:** Full-stack — migration (`icon`/`icon_url` on `wallets` and `budgets`), DTO/service/repository changes, upload endpoint (generalize `POST /categories/icon` or add `/wallets/icon` + `/budgets/icon` siblings), mobile form changes mirroring `CategoryFormModal.tsx`
- **Dependencies:** None (Category's pattern is the reference implementation)
- **Rough complexity:** M
- **Clarifying questions to resolve before BA:**
  - [ ] Generalize the existing `/categories/icon` upload endpoint into one shared `POST /icons` (any entity type), or add two near-duplicate `/wallets/icon` + `/budgets/icon` endpoints matching the Category precedent exactly?
  - [ ] Does a Budget's icon default to its Category's icon when unset, or show a generic placeholder?

### 📋 Medium Priority (next 2-3 sprints)

#### [FEAT-QC] Close QC coverage gap on F-03→F-07 and F-10
- **Type:** Technical Debt / Quality
- **Rationale:** 6 features (wallet, category, budget, transaction, financial-reporting, notification-handling) have `spec.md` + `plan.md` and backend unit tests, but no formal `test_cases.md` — only `user-management` and `security` have one. Cheap to close.
- **Scope:** QC only, no code change expected unless gaps are found
- **Dependencies:** None
- **Rough complexity:** S (per feature) × 6

#### [FEAT-08] Financial Goal (Release 1)
- **Type:** New Feature
- **SRS ref:** FR-05, Feature-08, BF-06
- **Rationale:** SDS domain model note explicitly says FinancialGoal "depends on stable budgeting and reporting" (both done). Deprioritized below the enhancement/bug-fix items this run per stated user preference.
- **Scope:** Full-stack
- **Dependencies:** Budget Management (done), Financial Reporting (done)
- **Rough complexity:** L
- **Clarifying questions to resolve before BA:**
  - [ ] Goal progress tracked from dedicated "allocation" transactions, or just any transaction tagged to the Goal's category?
  - [ ] Multiple concurrent Goals per user allowed, or one active Goal at a time?

### 🔮 Low Priority / Future

#### [FEAT-AI-02] AI Chat — Edit Transaction via Chat (Feature-12 US-02)
- **Type:** New Feature — depends on FEAT-AI-01 (shipped). Reuses its `POST /ai/chat` proposal flow and `chat_messages` table; needs the "`sửa@` prefix, find existing transaction" resolution logic the current `ChatService` doesn't have at all (confirmed — see §1).
- **Dependencies:** `PUT /transactions/{id}` (already implemented, named in SDS §6)
- **Rough complexity:** M

#### [FEAT-AI-03] AI Chat — Query Spending via Chat (Feature-12 US-03)
- **Type:** New Feature — read-only, could ship independently of US-02 once FEAT-AI-01's AI Service scaffold exists (it does).
- **Dependencies:** Financial Reporting (done, likely reused for aggregation)
- **Rough complexity:** M

#### [FEAT-11] Data Overview Dashboard (Release 1)
- **Type:** New Feature — aggregates existing data (wallets, budgets, transactions, reports); mobile's Home screen already does an informal version of this (hero balance, wallet cards, recent transactions) but Feature-11 itself has no spec.
- **Dependencies:** Best done after Financial Goal (F-08) so the dashboard can show goal progress too.
- **Rough complexity:** M

#### [FEAT-09] Investment Portfolio (Release 2)
- **Type:** New Feature — advanced, "mature users" per SRS row 9.
- **Rough complexity:** XL

#### [FEAT-AI-04] AI Chat — General Financial Advice (Feature-12 US-04, Post-MVP)
- **Type:** New Feature — lowest priority within Feature-12; SRS itself labels this Post-MVP.
- **Dependencies:** Financial Reporting data
- **Rough complexity:** M

---

## 4. Enhancement Backlog (existing features)

- [ ] [Wallet/Category/Budget/Transaction/Financial Reporting/Notification] No `test_cases.md` yet — see FEAT-QC above
- [ ] [System Security] `/auth/refresh` endpoint not implemented — 401 forces full re-login; acceptable for MVP but worth an explicit decision before Release 1 (mobile session UX suffers more than web)
- [ ] [Wallet Management] No icon/photo field — see FEAT-ICON above
- [ ] [Budget Management] No icon/photo field — see FEAT-ICON above
- [x] [Mobile] Dedicated Wallets/Categories/Users screens — **shipped** between 2026-08-16 and 2026-08-21 (`455bfb1` → `fe4f6cc`); Profile rows are no longer inert
- [x] [Transaction Management] `POST /transactions` idempotency key — shipped as part of FEAT-AI-01 (migration `010_transactions_idempotency_key.sql`)
- [x] [Category Management] Photo upload (R2) — shipped in code (`fe4f6cc`); blocked on production by the deployment gap in FEAT-BUG-01, not a code gap

---

## 5. Technical Debt Items

- [ ] **Migration deployment is manual, not automated** — migrations are mounted directly as `docker-compose.yml` `docker-entrypoint-initdb.d/*` scripts instead of running through `golang-migrate`. Adding a new migration file requires remembering to add a matching compose mount line; no automated apply-on-boot for existing databases. This exact failure mode already bit `009_notifications.sql` once (documented in `docs/architecture.md` §2).
- [ ] **Global error handler misclassifies routing errors as `INTERNAL_ERROR`** — see FEAT-BUG-02 above; listed here too since it's a systemic reliability issue, not just the one incident that surfaced it.
- [ ] **`docs/open-ai.md` is a hand-drafted, aspirational OpenAPI sketch, not a generated/enforced contract** — still drifted ahead of code in places. Worth clarifying whether this file should become the real API-first source of truth or be relabeled as a design note.
- [ ] **No staging API target for mobile EAS builds** — both `preview` and `production` profiles in `mobile/eas.json` point at the same production VPS URL. A broken production deploy is indistinguishable from a broken mobile build during testing.
- [x] **Rate limit on `POST /ai/chat`** — `AIChatRateLimiter` middleware shipped with FEAT-AI-01; exact threshold still an open question.

---

## 6. AI Service Roadmap

> Independent Python microservice — `ai-service/` implemented for US-01 (`specs/ai-chat-assistant/spec.md`), currently running **`openai/gpt-oss-120b` on Groq's free tier** (user-confirmed this run) — working well, being watched but not expected to bind at the project's current 20–100 user scale. Anthropic remains strictly a fallback, per `CLAUDE.md`.

**Phase 0 (foundation):** FastAPI, health check, internal-network reachability from the Go Backend — **done**.
**Phase 1 (core AI):** Transaction extraction from a chat message (FEAT-AI-01) — **done**, backend + web + mobile.
**Phase 2 (chatbot):** Edit/Query/General-advice intents (FEAT-AI-02/03/04) — not started at any layer, confirmed via `chat_service.go` inspection this run (mobile's `EditTransactionModal`/`EditMessageModal` only touch the pre-confirm proposal, not this).
**Phase 3 (insights):** Anomaly detection, spending pattern — not specced, not scoped.

**Current phase:** Phase 0/1 complete. Per this run's stated priority (stabilize MVP + fix bugs before new scope), Phase 2 stays deprioritized below FEAT-BUG-01/02/03 and FEAT-ICON.
