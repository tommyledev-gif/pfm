# PFM — Features Status & Roadmap

_Last updated: 2026-08-13_
_Updated by: /renew-features_

---

## 1. Project State Summary

> Direction confirmed by user (2026-08-13): **hoàn thiện MVP** trước, feature tiếp theo build **full-stack** (backend + web cùng lúc), ưu tiên cân bằng enhance-cũ/feature-mới theo ROI. AI Service tạm chưa là ưu tiên — nếu làm, cần để ý budget gọi Groq/Anthropic.

**Implemented (code + DB + Web UI):**
- **User Management (F-01)** — invite-only flow, admin invite/list, activation (backend + web `features/users` + mobile `features/admin`)
- **System Security (F-02)** — JWT login/logout, invite-token activation, rate limiting (backend + web `features/auth` + mobile `features/auth`)
- **Wallet Management (F-03)** — CRUD, set-default with DB-level uniqueness (backend + web `features/wallets`)
- **Category Management (F-04)** — CRUD, system + user categories, dedup index (backend + web `features/categories`)
- **Budget Management (F-05)** — per-category budget, per-currency limits (backend + web `features/budgets`)
- **Transaction Management (F-06)** — CRUD with atomic wallet-balance update (backend + web `features/transactions`)
- **Financial Reporting (F-07)** — summary + by-category totals, filters by date/wallet/category (backend + web `features/reports`, no new schema — reuses `transactions.sql` aggregates)

**Partial:**
- None at the backend+web layer — F-01→F-07 are fully implemented there. Mobile only covers F-01/F-02 (Phase 0); F-03→F-07 mobile UI is explicitly paused per `CLAUDE.md`, not a gap to close without an explicit request.

**Specced only (có spec, chưa có code):**
- None — every spec in `specs/` (user-management, security, wallet-management, category-management, budget-management, transaction-management, financial-reporting) already has matching backend + web code.

**SRS items chưa spec (chưa bắt đầu ở bất kỳ layer nào):**
- **Notification Handling (F-10)** — MVP scope per SRS, no spec.md, no migration, no handler.
- **Financial Goal (F-08)** — Release 1.
- **Investment Portfolio (F-09)** — Release 2.
- **Data Overview Dashboard (F-11)** — Release 1.

---

## 2. Feature Status Matrix

| # | Feature | SRS Ref | Spec | Backend | Web | Mobile | Status |
|---|---------|---------|------|---------|-----|--------|--------|
| 1 | User Management | Feature-01 | ✓ | ✓ | ✓ | ✓ | DONE |
| 2 | System Security | Feature-02 | ✓ | ✓ | ✓ | ✓ | DONE |
| 3 | Wallet Management | FR-01 | ✓ | ✓ | ✓ | ⏸ paused | DONE |
| 4 | Category Management | FR-03 | ✓ | ✓ | ✓ | ⏸ paused | DONE |
| 5 | Budget Management | FR-04 | ✓ | ✓ | ✓ | ⏸ paused | DONE |
| 6 | Transaction Management | FR-02 | ✓ | ✓ | ✓ | ⏸ paused | DONE |
| 7 | Financial Reporting | FR-07 | ✓ | ✓ | ✓ | ⏸ paused | DONE |
| 8 | Financial Goal | FR-05 | ✗ | ✗ | ✗ | ✗ | BACKLOG (Release 1) |
| 9 | Investment Portfolio | FR-06 | ✗ | ✗ | ✗ | ✗ | BACKLOG (Release 2) |
| 10 | Notification Handling | Feature-10 | ✗ | ✗ | ✗ | ✗ | BACKLOG (MVP scope, not started) |
| 11 | Data Overview Dashboard | FR-08 | ✗ | ✗ | ✗ | ✗ | BACKLOG (Release 1) |

`⏸ paused` = deliberate scope decision (CLAUDE.md: mobile paused until explicitly requested), not an incomplete implementation.

---

## 3. Recommended Next Features

> Dựa trên: MVP đã 7/8 xong, direction = hoàn thiện MVP, scope = full-stack, ROI-balanced.

### 🔥 High Priority (next sprint)

#### [FEAT-10] Notification Handling (F-10)
- **Type:** New Feature
- **SRS ref:** Feature-10, US-10-01/02/03, BF-09; SDS Scenario S-NOT-01
- **Rationale:** Last remaining MVP feature per SRS's Feature-level Release table (row 10, MVP ✔) and per CLAUDE.md's MVP Features list. Every other MVP feature (F-01→F-07) is done — closing this finishes the MVP.
- **Scope:** Full-stack (backend `notification_handler/service/repository` + new `notifications` migration + web `features/notifications`)
- **Dependencies:** Needs Budget Management (done) and Transaction Management (done) as trigger sources — BF-01 step 11 implies budget-limit notifications originate from transaction/budget events.
- **Rough complexity:** M — SRS scope for MVP is only 3 read-oriented user stories (list, view, mark-as-read); no push/email channel implied.
- **Clarifying questions to resolve before BA:**
  - [ ] MVP trigger scope: chỉ "budget limit reached" (BF-01 step 11), hay thêm các trigger khác (giao dịch lớn, số dư thấp)?
  - [ ] Delivery channel cho MVP: chỉ in-app (poll `GET /notifications`), hay cần push/email ngay?
  - [ ] Notification được tạo ở đâu: đồng bộ trong `BudgetService`/`TransactionService` khi vượt ngưỡng, hay qua background job riêng?

### 📋 Medium Priority (next 2-3 sprints)

#### [FEAT-QC] Close QC coverage gap on F-03→F-07
- **Type:** Technical Debt / Quality
- **Rationale:** 5 features (wallet, category, budget, transaction, financial-reporting) have `spec.md` + `plan.md` and backend unit tests, but no formal `test_cases.md` — `/cook-qc` was never run for them. Matches the "cả hai theo ROI" answer: cheap to close, unblocks confidence before adding F-10.
- **Scope:** QC only, no code change expected unless gaps are found
- **Dependencies:** None
- **Rough complexity:** S (per feature) × 5

#### [FEAT-08] Financial Goal (Release 1)
- **Type:** New Feature
- **SRS ref:** FR-05, Feature-08, BF-06
- **Rationale:** Natural next feature after MVP closes — SDS domain model note explicitly says FinancialGoal "depends on stable budgeting and reporting" (both done).
- **Scope:** Full-stack
- **Dependencies:** Budget Management (done), Financial Reporting (done)
- **Rough complexity:** L
- **Clarifying questions to resolve before BA:**
  - [ ] Goal progress tracked from dedicated "allocation" transactions, or just any transaction tagged to the Goal's category?
  - [ ] Multiple concurrent Goals per user allowed, or one active Goal at a time?

### 🔮 Low Priority / Future

#### [FEAT-11] Data Overview Dashboard (Release 1)
- **Type:** New Feature — aggregates existing data (wallets, budgets, transactions, reports), no new domain object per SDS.
- **Dependencies:** Best done after Financial Goal (F-08) so the dashboard can show goal progress too.
- **Rough complexity:** M

#### [FEAT-09] Investment Portfolio (Release 2)
- **Type:** New Feature — advanced, "mature users" per SRS row 9.
- **Rough complexity:** XL

#### [AI] AI Service — see Section 6

---

## 4. Enhancement Backlog (existing features)

- [ ] [Financial Reporting] No `test_cases.md` yet — see FEAT-QC above
- [ ] [Wallet/Category/Budget/Transaction] Same QC gap — see FEAT-QC above
- [ ] [System Security] `/auth/refresh` endpoint not implemented — 401 forces full re-login; acceptable for MVP but worth an explicit decision before Release 1 (mobile session UX will suffer more than web)
- [ ] [Mobile] F-03→F-07 mobile UI not built — paused per CLAUDE.md; resume only on explicit request

---

## 5. Technical Debt Items

- [ ] **Migration deployment is manual, not automated** — migrations are mounted directly as `docker-compose.yml` `docker-entrypoint-initdb.d/*` scripts instead of running through `golang-migrate`. Adding a new migration file requires remembering to add a matching compose mount line; no automated apply-on-boot for existing databases (`backend/db/migrations/`, `docker-compose.yml`).
- [ ] **`docs/features.md` drifts from actual state** — this file only covered Phase 0 until this update, despite F-03→F-07 having shipped. Re-run `/renew-features` after each feature ships, not just at ad-hoc intervals.
- [ ] **Untracked `clear-port.md` at repo root** — a personal PowerShell helper (kills processes on ports 8080/8081/8082), not project code. Should be `.gitignore`d or removed rather than left untracked indefinitely.

---

## 6. AI Service Roadmap

> Independent Python microservice — not started (`ai-service/` directory does not exist yet). User has flagged **Groq/Anthropic API budget** as a constraint to watch for whenever this is picked up — prioritize Groq's free tier as primary, Anthropic strictly as fallback (per CLAUDE.md tech stack), and avoid designs that call the LLM on every request when a cheaper heuristic would do.

**Phase 0 (foundation):** Setup FastAPI, auth with backend, basic health check
**Phase 1 (core AI):** Auto-categorize transaction
**Phase 2 (chatbot):** Chat về chi tiêu
**Phase 3 (insights):** Anomaly detection, spending pattern

**Current phase:** Not started — low priority given today's direction (hoàn thiện MVP first). Revisit after F-10 (Notification) ships.
