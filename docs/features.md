# PFM — Features Status & Roadmap

_Last updated: 2026-08-21_
_Updated by: /renew-features_

> Clarification answers this run: **Priority = Ổn định MVP + fix bug** (stabilize MVP, fix the 3 confirmed defects found this session before expanding scope); **next feature scope = full-stack** (Wallet/Budget icon support touches migration + backend DTO + mobile UI at once); **preference = enhancement before new feature** (finish icon parity + fix the 3 known bugs before starting Financial Goal/Dashboard); **constraint** = AI Service currently runs `openai/gpt-oss-120b` via Groq's free tier — works well, user is watching it but it's not expected to bind at the current 20–100 user scale, so no urgent action needed there.

---

## 1. Project State Summary

**MVP is fully complete and mobile has reached full feature parity with web** — every screen that was a Profile entry-point-only row as of the last `/renew-docs` (2026-08-16) is now a real CRUD screen (Wallets, Categories, Budgets, Users/admin). Since then, four items were found via code inspection during this session — see `SDS.md` §12.1 Known Issues Log for full root-cause detail; three are now fixed/shipped, one remains a pure deployment-verification step nobody in this session could execute:

1. **Production VPS lagging behind `develop`** — category icon upload (`405`) and the `/activate` page (`404`→coerced `500`) both work in code as of commit `fe4f6cc` but the symptoms observed on `app.example.com` match an older deployed build. **Still outstanding** — `deploy-backend.yml` should auto-deploy on push to `develop`; its run history for the current `HEAD` needs checking (`gh` CLI wasn't available this session) before assuming a manual redeploy/`workflow_dispatch` is required.
2. **Global error handler masks real HTTP statuses — ✅ fixed.** `response.Error()` now special-cases `*fiber.Error`, preserving real routing-error statuses instead of a blanket `500 INTERNAL_ERROR`. New tests in `internal/response/response_test.go`.
3. **Keyboard covers the focused input in every bottom-sheet form — ✅ fixed.** `Drawer.tsx` now wires in the project's existing `useKeyboardHeight()` hook.
4. **Wallet/Budget icon support — ✅ shipped** as FEAT-ICON (see §3 below).

**Implemented (code + DB + Web + Mobile UI, full CRUD unless noted):**
- **User Management (F-01)** — invite-only flow, admin invite/list, HTML activation page at `GET /activate` (backend + web `features/users` + mobile `features/users`, `app/(app)/users.tsx`, admin-only)
- **System Security (F-02)** — JWT login/logout, invite-token activation, rate limiting (backend + web `features/auth` + mobile `features/auth`)
- **Wallet Management (F-03)** — CRUD, set-default with DB-level uniqueness, **uploaded-photo icon support** (migration `013_wallets_icon.sql`, `POST /wallets/icon`) on top of an emoji `icon` text field (backend + mobile `features/wallets`, `app/(app)/wallets.tsx` — **full CRUD + photo upload now**; web (`frontend/`) has CRUD but not the icon feature, deferred). No `updated_at`/DTO gap remaining — see FEAT-ICON.
- **Category Management (F-04)** — CRUD, system + user categories, dedup index, **uploaded-photo icon support** (Cloudflare R2 via `minio-go`, migration `012_categories_icon_url.sql`) on top of the existing emoji `icon` text field (backend + web `features/categories` + mobile `features/categories`, `app/(app)/categories.tsx` — **full CRUD + photo upload now, was read-only as of 2026-08-16**). Photo upload currently broken on production per Known Issues Log Item 1 (deployment gap, not a code bug).
- **Budget Management (F-05)** — per-category budget, per-currency limits, **uploaded-photo icon support independent of its linked Category's own icon** (migration `014_budgets_icon.sql`, `POST /budgets/icon`) (backend + mobile `features/budgets`, Insights → Budgets tab — full CRUD + photo upload; web deferred, same as Wallet).
- **Transaction Management (F-06)** — CRUD with atomic wallet-balance update (backend + web `features/transactions` + mobile `features/transactions`)
- **Financial Reporting (F-07)** — summary + by-category totals, filters by date/wallet/category (backend + web `features/reports` + mobile Insights → Spending, incl. donut chart)
- **Notification Handling (F-10)** — budget-exceeded alerts via background scheduler, list/view/mark-read (backend + web `features/notifications` + mobile bell → full-screen overlay)
- **AI Chat Assistant (Feature-12) — US-01 "Create a Transaction via Chat" only** (`specs/ai-chat-assistant/spec.md`) — `ai-service/` (FastAPI, Groq primary/Anthropic fallback, currently `openai/gpt-oss-120b` on Groq's free tier — see constraint note above), `chat_handler.go`/`ChatService`, migration `011_chat_messages.sql`, `idempotency_key` on `transactions` (migration `010`), web `features/ai-chat`, mobile `app/(app)/ai-chat.tsx` (also ships `EditTransactionModal`/`EditMessageModal` — these only edit a not-yet-confirmed proposal or resend a sent message, **not** the SRS's separate "edit an existing transaction via `sửa@` prefix" flow; confirmed `chat_service.go` has no `edit_transaction`/`query_spending`/`general_advice` handling, so US-02/03/04 remain fully unbuilt, not partial).

**Shipped this session (specced → planned → implemented, full loop):**
- **Wallet & Budget icon/photo support** (`specs/wallet-budget-icons/`) — see FEAT-ICON in §3/§4 above for full detail.

**Documented this session, no code needed:**
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
| 3 | Wallet Management | FR-01 | ✓ | ✓ | ✓ | ✓ full CRUD + photo upload | DONE (icon/photo shipped 2026-08-21 — FEAT-ICON) |
| 4 | Category Management | FR-03 | ✓ | ✓ | ✓ | ✓ full CRUD + photo upload | DONE (photo upload blocked on prod — deployment gap, see §1) |
| 5 | Budget Management | FR-04 | ✓ | ✓ | ✓ | ✓ full CRUD + photo upload | DONE (icon/photo shipped 2026-08-21 — FEAT-ICON) |
| 6 | Transaction Management | FR-02 | ✓ | ✓ | ✓ | ✓ | DONE |
| 7 | Financial Reporting | FR-07 | ✓ | ✓ | ✓ | ✓ | DONE |
| 8 | Financial Goal | FR-05 | ✗ | ✗ | ✗ | ✗ | BACKLOG (Release 1) |
| 9 | Investment Portfolio | FR-06 | ✗ | ✗ | ✗ | ✗ | BACKLOG (Release 2) |
| 10 | Notification Handling | Feature-10 | ✓ | ✓ | ✓ | ✓ | DONE |
| 11 | Data Overview Dashboard | FR-08 | ✗ | ✗ | ✗ | 🔶 Home screen covers some of this informally | BACKLOG (Release 1) |
| 12 | AI Chat Assistant — US-01 Create via Chat | FR-09 / Feature-12 | ✓ | ✓ | ✓ | ✓ | DONE |
| — | AI Chat Assistant — US-02/03/04 (Edit/Query/Advice) | FR-09 / Feature-12 | ✗ | ✗ | ✗ | ✗ | BACKLOG (Release 1) — not yet specced |
| — | Wallet/Budget icon & photo support | (SDS §12.1 Known Issues Log Item 3) | ✓ | ✓ | ✗ | ✓ | DONE (2026-08-21) — mobile only, `frontend/` parity deferred |

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

#### [FEAT-BUG-02] Fix global error handler swallowing real HTTP statuses — ✅ DONE (2026-08-21)
- **Type:** Bug Fix
- **SRS ref:** NFR-06 (updated this session to require accurate error responses)
- **Resolution:** `response.Error()` now special-cases `*fiber.Error` (Fiber's own 404/405, raised before any handler runs) and preserves the real status + a matching `common.ErrCodeNotFound`/`ErrCodeMethodNotAllowed`/`ErrCodeRequestError`, instead of coercing everything into `500 INTERNAL_ERROR`. New `internal/response/response_test.go` (4 tests) locks in the exact 405 scenario from the original report, plus regression guards that `*common.AppError` and genuinely-unknown errors are unaffected. `go test ./...` passes.

#### [FEAT-BUG-03] Fix keyboard covering focused input in Drawer forms — ✅ DONE (2026-08-21)
- **Type:** Bug Fix
- **SRS ref:** UXR-04 (added this session)
- **Resolution:** `Drawer.tsx` now calls the project's existing `useKeyboardHeight()` hook and pads the `ScrollView`'s content bottom by the live keyboard height — not `KeyboardAvoidingView`, not a third-party library, consistent with why that hook exists. Verified via `tsc --noEmit`, `eslint`, and a full `expo export --platform web` smoke-build. **Not verified on-device/emulator** — none available this session; carry forward to the next mobile on-device verification pass.

#### [FEAT-ICON] Wallet & Budget icon/photo support — ✅ DONE (2026-08-21)
- **Type:** Enhancement (extends existing Category pattern to two more entities)
- **SRS ref:** FR-01, FR-04 (both updated this session), SDS §12.1 Known Issues Log Item 3
- **Resolution:** Specced (`specs/wallet-budget-icons/spec.md`), planned (`plan.md`), and implemented full-stack — migrations `013_wallets_icon.sql`/`014_budgets_icon.sql`, sibling `POST /wallets/icon`/`POST /budgets/icon` endpoints (not a generalized shared route — explicit plan.md assumption, to avoid touching the already-shipped Category endpoint), full DTO/service/repository/handler wiring including a new `dto.OptionalString` type to correctly distinguish "omitted" from "explicit null" for `icon_url` clearing, and mobile form/list/card updates mirroring `CategoryFormModal.tsx`. Verified against a real (throwaway) Postgres instance, not just in-memory fakes.
- **Deliberately deferred** (flagged in plan.md, needs sign-off): retrofitting Category's own identical "can never clear `icon_url`" bug (same COALESCE-vs-explicit-null root cause discovered while building this); web (`frontend/`) parity (scoped mobile-only).

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
- [x] [Wallet Management] Icon/photo field — shipped as FEAT-ICON (2026-08-21)
- [x] [Budget Management] Icon/photo field — shipped as FEAT-ICON (2026-08-21)
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
