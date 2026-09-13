# Feature Spec: F-13.1 AI Budget Setup Wizard v2 — Phase 1

> Source: `docs/new-tasks.md` (user-authored v2 design, 2026-09-12 → 2026-09-13: §0–§19 design, §20 codebase blindspot audit BS-01…BS-12, §21 decisions D-01…D-13 + BS-13). `SRS.md` FR-10 / Feature-13. This spec restructures **Phase 1 of §17's roadmap** into the project's standard spec format; `docs/new-tasks.md` remains the fuller worked example for UI copy, layout, and the rationale behind each design principle (P-01…P-10).
> Status: Draft — highest-priority next feature per `docs/features.md` (2026-09-13 run), user-directed
> Supersedes: `specs/ai-budget-wizard/spec.md` §5 (Wizard Steps) and §6.2 (allocation algorithm) — **that spec's US-03 and US-04 are replaced in place** (decision D-13). Its US-01/US-02 (triggers) and US-05 (bulk submit) survive, extended here.
> Related: [F-05 Budget Management](../budget-management/spec.md) (`budgets`/`budget_limits` remain the enforcement layer, unchanged), [F-04 Category Management](../category-management/spec.md) (gains `system_key`), [F-06 Transaction Management](../transaction-management/spec.md) (US-09 extends its create response), [Feature-12 AI Chat](../ai-chat-assistant/spec.md) (the wizard's surface)

## Context

F-13 v1 shipped a 4-step wizard that asks the User, for each of up to 20 Categories, how much they want to spend on it ("a little"/"normal"/"a lot"/"let AI decide") — up to 120 decisions. That question only has an answer if the User already knows their own spending.

**They don't.** The dominant persona is a User with no transaction history (`cold`), which is precisely why they installed a budgeting app. v1 therefore produces a budget that is **guaranteed wrong**, presents it as a firm number, and then has no mechanism to ever correct it. When reality diverges in week 2, the app looks broken and the User leaves.

v2's founding statement: **the first budget is a hypothesis, not a truth.** The product's value is in how fast it converges, not in first-attempt accuracy. Phase 1 delivers the correct *first* hypothesis (3 screens, 2 questions, ≤45 seconds) and the engine that makes every later phase possible; Phase 2 delivers the convergence loop that corrects it.

Phase 1 also absorbs six pieces of blocking work that are not optional polish — the current engine computes money in `float64` and is **non-deterministic** (the same input can produce different budgets across runs), and the data model has no notion of a spending cycle that starts on any day but the 1st.

Actor: **User** — any authenticated `active` user (`admin` or `member`). Personal setup flow, not an admin capability.

**Explicit assumptions (flagged per BA convention):**

1. **A-01 — Money stays in xu (integer cents), everywhere.** `docs/new-tasks.md` §4.1 originally proposed switching `budget_plans` to đồng. That is rejected (D-01/§20.2): the entire system — `transactions.amount`, `wallets.balance`, `budget_limits.amount_limit`, `formatCurrency()` — is xu, and a plan layer in đồng writing into `budget_limits` in xu is a silent 100× bug. What v2's "B5" correctly identified is that the engine must stop using `float64`; the *unit* was never wrong. Every constant in this spec is restated in xu. *Enforced in US-01 (engine) and US-05 (client state).*
2. **A-02 — Phase 1 ships the `cold` flow only.** Persona resolution (`cold`/`warm`/`hot`) is computed and stored so later phases have it, but **all three personas get the same 3-screen preset flow** in Phase 1. History-sourced amounts and the `hot` one-screen confirm are Phase 3. Income prefill from history is likewise Phase 3 — Screen 1 starts empty. *Enforced in US-05; `persona` is still stored by US-04.*
3. **A-03 — `period` is `monthly`-only.** `weekly`/`quarterly` are removed from `dto.BudgetProposalsRequest` so the DTO, `common.BudgetPeriodMonthly`, and the mobile client finally agree (BS-06). *Enforced in US-08, server-side.*
4. **A-04 — One plan covers exactly one currency** (the User's primary wallet currency). Multi-currency planning stays out of scope, as in v1. *Enforced in US-04 (plan currency fixed at creation) and US-09 (no impact for other currencies).*
5. **A-05 — All period arithmetic remains UTC-based** in Phase 1. `cycle_start_day` fixes *which days* a cycle spans; it does **not** fix the timezone of the day boundary. Timezone is a separate feature (D-09) — until it lands, `E-14` of the v2 design is **not satisfied**, and this spec says so rather than implying otherwise. *Recorded in Out of Scope; no US depends on it.*

## Preconditions (feature-level)

- Caller holds a valid access JWT and is `active`.
- Caller has at least one Wallet — its currency is the plan's currency (A-04).
- System Categories exist (migration 006 + 017 + this feature's 019).
- The wizard remains **client-only and ephemeral until the final confirmation**: nothing is written at any step before US-08. Dismissing at any point leaves Budgets, Categories, and plans untouched.

### Key Entities Involved

| Entity | How this feature uses it |
|---|---|
| **`budget_plans`** *(new)* | The **planning** layer: income, fixed costs, savings target, disposable, preset, confidence, cycle day, origin, version chain. One active row per User. |
| **`budget_plan_items`** *(new)* | Per-Category planned band (`amount_min`…`amount_max`), source, lock, confidence, evidence. |
| Budget / `budget_limits` (F-05) | Unchanged as the **enforcement** layer. Mapping rule: `budget_limits.amount_limit = budget_plan_items.amount_max`. |
| Category (F-04) | Gains nullable `system_key`; system rows renamed to Vietnamese; two new system rows added. |
| Transaction (F-06) | Read for cycle spend; its create response gains an optional `budget_impact` (US-09). |

⚠️ **Money rule:** every amount in this feature — income, fixed total, savings target, disposable, band edges, limits — is **`int64` xu**. No `float64` appears anywhere on the money path, in transit, in storage, or in intermediate arithmetic. Proportional division uses `a * num / den` (multiply before divide), never floating-point ratios.

⚠️ **Timestamps:** `TIMESTAMPTZ` in UTC; `budget_plans.cycle_start_day` is a plain `smallint` day-of-month (1–28), not a date.

### Constants (restated in xu — these are business rules and each needs its own test)

| Constant | Value (xu) | Display |
|---|---|---|
| `BudgetWizardMinAmountPerCategory` | `5_000_000` | 50.000đ |
| Income cap | `999_999_999_900` | 9.999.999.999đ |
| `MinUnallocatedShare` | `0.12` (ratio, applied as `×12/100`) | 12% buffer |
| `MaxShareOfDisposable` | `0.50` (applied as `×1/2`) | 50% ceiling per Category |
| Minimum viable disposable (E-02) | `30_000_000` | 300.000đ |
| `roundStep(a)` | `a < 10_000_000` → `500_000`; `< 100_000_000` → `1_000_000`; `< 1_000_000_000` → `5_000_000`; else `10_000_000` | 5k / 10k / 50k / 100k đ |

---

## US-01: Deterministic, integer-only allocation engine

**As a** User,
**I want** the same answers to always produce the same budget,
**so that** I can trust the number I'm shown and re-running the wizard doesn't quietly change my plan.

**API:** internal — `service/budgetproposal`. Surfaced through `POST /ai/budget-proposals`.

### Preconditions
- None beyond a valid request; this is pure computation with no I/O.

### Main Flow
1. System normalizes every input source into one `CategoryIntent` struct (`CategoryID`, `Source`, `AmountMin`, `AmountMax`, `Locked`, `Confidence`, `Evidence`). Precedence when a Category has several sources, highest first: `stated` → `manual` → `history` → `preset`. The winning source **overwrites completely** — no blending — and also determines the confidence and evidence shown.
2. System computes `disposable = income − fixed_total − savings_target`.
3. System resolves each intent's centre amount: `preset` → `presetShare × disposable`; `manual`/`stated` → the stated figure.
4. System computes `capAllocatable = disposable × 88 / 100`.
5. If `Σ(unlocked) + Σ(locked) > capAllocatable`, System scales **only unlocked** items proportionally. If `Σ(locked)` alone already exceeds the cap, System scales nothing and returns `OverCommitted = true` with the shortfall.
6. System raises any item below the floor to `5_000_000` xu, shrinking unlocked above-floor items proportionally, looping floor↔ceiling to a fixed point (`maxIter = n + 2`).
7. System applies the ceiling: no item exceeds `disposable / 2` unless it is the only item. Clipped amount becomes buffer — **never redistributed** to other items.
8. System derives the band per source (US-07).
9. System quantizes both band edges to the VND step ladder, last, using the step frozen from the raw amount.
10. System sets `unallocated = disposable − Σ(amount_max)`.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-BWZ2-01 | Any valid input | Engine runs 1.000 times with identical input | Output is byte-identical every run | ⚠️ Guards the B1 regression |
| S-BWZ2-02 | A Category named `"Cafe & Ăn uống"` matching two keyword patterns | Engine resolves its baseline | The same pattern wins every run — longest-pattern-first, ordered slice, not a Go map | B1 |
| S-BWZ2-03 | Any valid input | Engine completes | `Σ amount_max + unallocated == disposable`, **exactly** | ⚠️ B2 — financial consistency |
| S-BWZ2-04 | An item's raw amount is `3_087_425_000` xu | Engine quantizes | Result is a multiple of its frozen `roundStep` | Quantization |
| S-BWZ2-05 | Every item already sits at the floor | Buffer floor cannot be met | `ScaledDown == false` — nothing was actually reduced | B3 |
| S-BWZ2-06 | An item is `Locked` | Engine scales and quantizes | That item's amount is returned unchanged, bit for bit | I6 |
| S-BWZ2-07 | `Σ(locked) > capAllocatable` | Engine runs | `OverCommitted = true` + shortfall; **no item is silently reduced** | User stated absolutes; overriding them destroys intent |
| S-BWZ2-08 | `income = 12_000_000`, `fixed = 12_000_000`, `savings = 1_000_000` | Engine runs | `400 E_DISPOSABLE_NONPOSITIVE` | Validation error (4xx) |
| S-BWZ2-09 | One Category only, share would exceed 50% | Engine applies ceiling | Ceiling does **not** apply — a single Category may take the whole disposable | Explicit carve-out |
| S-BWZ2-10 | 20 Categories, `disposable = 50_000_000` xu | Engine runs | Floor cannot be met for all → `ScaledDown = true`, shortfall reported, no negative amounts | Degenerate but must not panic |

### Edge Cases
1. **Rounding remainder never vanishes and never inflates.** `unallocated` absorbs 100% of the remainder. A test asserts the invariant on 10.000 fuzzed inputs (`income ∈ [10_000_000, 100_000_000_000]` xu, `n ∈ [1,20]`).
2. **The quantization step is frozen from the raw amount**, not recomputed from the rounded one — otherwise an amount sitting on a ladder boundary oscillates between two steps.
3. ⚠️ **Ceiling overflow is not redistributed.** Money clipped from an over-ceiling Category goes to the buffer. Redistributing would silently inflate other Categories the User never asked to raise.
4. **`ScaledDown` must be true only if at least 1 xu was actually reduced** — the current code returns `true` whenever the loop ran, so the UI warns about a scale-down that never happened.
5. **Zero intents** → `400 INVALID_INPUT`; the engine is never called with an empty set.
6. **Floor > cap** (tiny disposable, many Categories) resolves by accepting the shortfall and flagging it, never by emitting an amount below the floor or a negative buffer.

### Definition of Done
- No `float64` remains on any money path in `service/budgetproposal` (verified by grep + review, not just tests).
- B1–B7 fixed, including deleting the false comment at `common/constants.go:227`.
- Property test, 10.000 random cases, asserting I1–I6 (multiple-of-step · Σ ≤ cap · ≥ floor · exact sum invariant · determinism · locked untouched).
- Table test over 4 presets × 5 income levels (3tr / 8tr / 12tr / 25tr / 100tr đ, in xu): no fractional display amounts, no floor or ceiling violation.
- `go test ./...` green.

### Idempotency
Pure function — idempotent by construction. `POST /ai/budget-proposals` writes nothing.

---

## US-02: Canonical system Categories (`system_key`)

**As a** User,
**I want** the wizard's suggested Categories to be the Categories I already have,
**so that** I don't end up with "Food" and "Ăn uống" splitting the same spending in two.

**API:** migration only; read through `GET /ai/budget-wizard/prefill`.

### Preconditions
- Migration 019 applied.

### Main Flow
1. System adds nullable `categories.system_key`, unique among system rows (`user_id IS NULL AND deleted_at IS NULL`).
2. System assigns a key to each existing system Category by its current English name.
3. System renames every system Category to its Vietnamese display name.
4. System inserts two system Categories the presets require and that do not exist: `children_education` ("Con cái & Học tập") and `other` ("Chi khác").
5. Presets and allocation baselines resolve by `system_key`; keyword matching survives **only** as a fallback for user-created Categories.

| `system_key` | New `name` | Class (§7.2) |
|---|---|---|
| `food` | Ăn uống | `essential` |
| `transport` | Di chuyển | `essential` |
| `entertainment` | Cafe & Giải trí | `discretion` |
| `shopping` | Mua sắm | `discretion` |
| `health` | Sức khoẻ | `essential` |
| `housing` | Nhà ở | `fixed` |
| `utilities` | Hoá đơn & Tiện ích | `fixed` |
| `children_education` | Con cái & Học tập *(new)* | `essential` |
| `other` | Chi khác *(new)* | `discretion` |
| `savings` | Tiết kiệm | — (deducted up front) |
| `salary` / `bonus` / `investment` | Lương / Thưởng / Đầu tư | — (income) |

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-BWZ2-11 | Fresh database | Migration 019 runs | 12 system Categories carry a `system_key`; names are Vietnamese; `children_education` and `other` exist | Happy path |
| S-BWZ2-12 | A User created their own Category literally named "Ăn uống" | Migration renames system `food` to "Ăn uống" | Both rows survive; the dedup index is scoped by `user_id`, so no conflict | ⚠️ Must not fail the migration |
| S-BWZ2-13 | A User has transactions against system "Food" | Migration renames it | Every transaction still resolves — the FK is `category_id`, untouched | No data movement |
| S-BWZ2-14 | A User-created Category with `system_key IS NULL` | Engine classifies it | Treated as `essential` | Safer: `discretion` is cut first (§7.2) |
| S-BWZ2-15 | Migration 019 runs twice | Second run | Idempotent — `ON CONFLICT DO NOTHING` on inserts, keyed updates are already-correct no-ops | Initdb re-run safety |

### Edge Cases
1. **A User who soft-deleted a system Category** keeps it deleted — the rename touches `name` only, never `deleted_at`.
2. **The unique index on `system_key` is partial** (`WHERE user_id IS NULL AND deleted_at IS NULL`) — a user-created Category never carries a key, so it can never collide.
3. **A preset Category the User genuinely doesn't have** is created at submit time through the existing US-05 path, now keyed so it never duplicates later.
4. ⚠️ **This migration is the one irreversible-feeling change in Phase 1** — Users who know "Food" will see "Ăn uống". Accepted (OQ-14), consistent with the app being Vietnamese throughout.

### Definition of Done
- Migration 019 applied and mounted in **both** `docker-compose.yml` and `backend/docker-compose.yml` (the 015–018 drift must not repeat).
- Preset → Category resolution has zero name-matching in its path, proven by a test using a Category whose name was renamed.
- Test: user-created Category with a colliding name does not break the migration.

### Idempotency
Migration is re-runnable (initdb may re-execute on a fresh volume).

---

## US-03: Spending cycle window

**As a** User paid on the 25th,
**I want** my budget to track my pay cycle, not the calendar month,
**so that** "còn bao nhiêu mỗi ngày" is a number I can actually act on.

**API:** internal query `SumExpenseByUserCycle`; `cycle_start_day` carried on `budget_plans`.

### Preconditions
- Migration 020 applied (`budget_plans` exists with `cycle_start_day`).

### Main Flow
1. User sets "Lương về ngày N" on Screen 1 (1–28, default 1).
2. System stores it on the plan.
3. System derives the current cycle as `[cycleStart, nextCycleStart)` where `cycleStart` is the most recent occurrence of day N at or before today.
4. Every spend figure the wizard, the budget list, and US-09 read comes from `SumExpenseByUserCycle(user_id, cycle_start, cycle_end)` — replacing `date_trunc('month', NOW())` in `SumExpenseByUserCurrentPeriod`.
5. `daysInCycle = cycleEnd − cycleStart` in whole days, computed from the real dates — never hardcoded 30.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-BWZ2-16 | `cycle_start_day = 1`, today is the 14th of a 31-day month | System computes the cycle | `[1st, 1st of next month)`, `daysInCycle = 31`, `elapsed = 14` | Matches today's behaviour exactly |
| S-BWZ2-17 | `cycle_start_day = 25`, today is the 3rd | System computes the cycle | Cycle started on the **25th of last month** | The whole point of the feature |
| S-BWZ2-18 | `cycle_start_day = 28`, cycle runs into February | System computes `daysInCycle` | 28 Jan → 28 Feb = 31 days; 28 Feb → 28 Mar = 28 or 29 | E-11 — no hardcoded month length |
| S-BWZ2-19 | User submits `cycle_start_day = 29` | Validation | `400 INVALID_INPUT` — range is 1..28 | Avoids the "no 30th in February" class of bug |
| S-BWZ2-20 | User has no plan at all | Budget list reads spend | Falls back to the calendar month, unchanged from today | ⚠️ No regression for pre-v2 Users |

### Edge Cases
1. **Days 29–31 are rejected, not clamped.** Clamping would silently move a User's cycle without telling them.
2. ⚠️ **`budget_limits.spent` changes meaning** for any User with a non-default cycle day. F-05's list, F-07's report, and the Budgets tab must all read the same window, or two screens will disagree about the same budget. One shared query, one caller path.
3. **A cycle day change mid-cycle** (US-04 version bump) recomputes `daysLeft` from today; already-recorded spending is not reassigned to a different cycle.
4. **`budgets.start_date` remains unused for windowing** in Phase 1 — narrowing spend to a mid-cycle budget's own start is a separate, pre-existing gap (features.md §4), deliberately not bundled here.

### Definition of Done
- `SumExpenseByUserCycle` exists in `db/queries/transactions.sql`, is generated/hand-written to match, and **every** caller of `SumExpenseByUserCurrentPeriod` is migrated to it.
- Tests for S-BWZ2-16…20, including the February boundary.
- A User with `cycle_start_day = 1` produces identical numbers to today's code (regression lock).

### Idempotency
Read-only.

---

## US-04: Budget plan layer & versioning

**As a** User,
**I want** every change to my budget to be recorded as a new version,
**so that** I can see what I changed and the app has something to compare against later.

**API:** `POST /budgets/bulk` (extended, US-08); schema via migration 020.

### Preconditions
- Migration 020 applied.

### Main Flow
1. System stores a plan per User: `income`, `fixed_total`, `savings_target`, `disposable`, `currency`, `period`, `cycle_start_day`, `profile_preset`, `confidence`, `origin`, `version`, `parent_plan_id`, `superseded_at`.
2. System stores one `budget_plan_items` row per planned Category: `amount_min`, `amount_max`, `source`, `locked`, `confidence`, `evidence`.
3. At most one active plan per User — partial unique index on `superseded_at IS NULL`.
4. **Every** change to the enforcement layer creates a new version, whatever its origin: `wizard` (US-08), `manual` (the Budgets screen's own create/edit/delete), or `calibration` (Phase 2).
5. A `manual` plan inherits income/fixed/savings/disposable from the active plan when one exists; when the User has never run the wizard, those stay `NULL`.
6. Backfill: every User with active Budgets gets `version = 1, origin = 'manual'`, items derived from `budget_limits` (`amount_min = amount_max = amount_limit`, `source = 'manual'`, `confidence = 0.3`).

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-BWZ2-21 | User has no plan | Wizard submits | Plan `version = 1, origin = 'wizard'`, `parent_plan_id = NULL` | Happy path |
| S-BWZ2-22 | User has an active plan v1 | User edits one budget on the Budgets screen | Plan v2 `origin = 'manual'`, `parent_plan_id = v1`, v1 `superseded_at` set | D-12 |
| S-BWZ2-23 | User never ran the wizard | User creates a budget manually | Plan v1 `origin = 'manual'` with `income`/`disposable` **NULL** | Constraint must permit this |
| S-BWZ2-24 | Plan has `disposable IS NULL` | Any surface renders "còn được chi / ngày" | That line is **hidden**, not zero, not guessed | ⚠️ Never fabricate a figure |
| S-BWZ2-25 | Two devices submit the wizard at the same time | Both writes race | Partial unique index rejects the second; the later submit supersedes, the earlier does not survive as active | E-15 |
| S-BWZ2-26 | User had 3 budgets before v2 shipped | Migration 020 backfill runs | A v1 `manual` plan exists with 3 items matching their limits | Without this, Phase 2 skips every existing User |
| S-BWZ2-27 | A Category is deleted after the plan exists | Plan is read | The item is retained for audit; enforcement and later calibration ignore it | E-13 |

### Edge Cases
1. ⚠️ **Plan creation and the `budgets`/`budget_limits` replace must share one DB transaction.** A plan pointing at limits that were never written, or limits with no plan, is a silent inconsistency that Phase 2 would then "calibrate" against nonsense.
2. **`chk_disposable_positive` must be conditional** on origin, or every manual budget creation fails on a constraint the User never touched.
3. **Version count can grow quickly** — editing six budgets in a row makes six versions. Accepted in v2; a 5-minute in-place coalescing rule is noted as a later optimization, not built.
4. **`budget_plan_items` keeps a deleted Category's row**, so history stays readable; the FK is not `ON DELETE CASCADE` for `category_id`.
5. **Plan currency is fixed at creation** (A-04) — a User who later changes primary wallet currency keeps the plan's own currency until a new plan is created.

### Definition of Done
- Migration 020 creates both tables, the partial unique index, the conditional constraint, and the backfill; mounted in both compose files.
- Bulk submit writes plan + items + budgets + limits in **one** transaction, verified against a real Postgres instance (not only in-memory fakes) — same bar as `specs/wallet-budget-icons/`.
- Manual budget CRUD on the Budgets screen produces a `manual` plan version.
- Tests for S-BWZ2-21…27.

### Idempotency
`POST /budgets/bulk` is **not** naturally idempotent (it version-bumps). It reuses F-05's `SELECT … FOR UPDATE` serialization; a duplicate submit produces a second version, not duplicate budgets. A client-generated idempotency key is **out of scope** — see Open Questions #3.

---

## US-05: Wizard Screen 1 — money in, money committed

**As a** User,
**I want** to say what I earn, what's already spoken for, and what I want to save,
**so that** I find out what I can actually spend — before deciding how to split it.

**Client:** `mobile/` only. **API:** `GET /ai/budget-wizard/prefill` (extended with `persona`).

### Preconditions
- Caller authenticated with at least one Wallet.

### Main Flow
1. User enters income; then fixed costs (hint: nhà, điện nước, internet, học phí); then picks a savings level — `0% / 5% / 10% / 20% / custom`, **defaulting to 10%**.
2. Client shows `Còn được chi` and `đ/ngày` updating live on every keystroke.
3. User picks "Lương về ngày N" (default 1).
4. Client validates and enables "Tiếp".

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-BWZ2-28 | Income 12tr, fixed 2,5tr, savings 10% | User finishes typing | Shows `8.300.000đ` and `276.000đ/ngày` (30-day cycle), updating live | Happy path; P-10 — the screen is useful on its own |
| S-BWZ2-29 | `fixed + savings ≥ income` | User attempts Next | Blocked, message *"Chi phí cố định và tiết kiệm đã vượt thu nhập. Bạn xem lại giúp nhé."* | E-01, validation error (4xx if it reaches the server) |
| S-BWZ2-30 | Income `> 999_999_999_900` xu | User types | Blocked with an explicit cap message | BS-05 — the old cap silently rejected anyone over 100tr/tháng |
| S-BWZ2-31 | `disposable < 30_000_000` xu | User attempts Next | Warned, and the Category count is capped at `disposable / 5_000_000` | E-02 |
| S-BWZ2-32 | Income = 0 | User attempts Next | Blocked, "Thu nhập phải lớn hơn 0" | Validation error |
| S-BWZ2-33 | User picks savings 20% | Slider moves | Amount and `đ/ngày` recompute; default remains 10% for the next User | Deliberate: 20% is best practice but breaks in week 2 for a first-time budgeter |

### Edge Cases
1. **State is held in xu.** The input renders đồng; `Math.round(x * 100)` happens at the input boundary only, never mid-calculation.
2. **`đ/ngày` uses the real cycle length** from `cycle_start_day` (US-03), not 30.
3. ⚠️ **A savings default of 20% would be the "correct" advice and the wrong product decision** — committing 20% plus unknown costs breaks in week 2 and the User leaves. 10% is near-certainly keepable; Phase 2 raises it when the data shows slack.
4. **Dismissing here writes nothing** — no plan, no budget, no Category.
5. **Screen 1 does not prefill income from history in Phase 1** (A-02), even for a User who has it.

### Definition of Done
- All five validations enforced **client-side and server-side** (the client blocks; the server never trusts it).
- `đ/ngày` visibly updates while typing.
- Value in state is xu throughout; verified by a test on the boundary conversion.

### Idempotency
No write.

---

## US-06: Wizard Screen 2 — one question

**As a** User,
**I want** to be asked one thing I actually know,
**so that** I get a starting budget without guessing 120 numbers.

**Client:** `mobile/` only. **API:** none (client-side selection).

### Preconditions
- Screen 1 complete.

### Main Flow
1. System asks "Bạn đang sống kiểu nào?" with four options: 🏙 `rented_eating_out`, 🏡 `with_family`, 👨‍👩‍👧 `own_family`, 🎓 `student`.
2. User picks one.
3. System maps the preset to shares **of disposable** (not of gross income), resolved by `system_key`.
4. System proceeds to Screen 3.

| Category | 🏙 | 🏡 | 👨‍👩‍👧 | 🎓 |
|---|---|---|---|---|
| `food` | 40% | 26% | 34% | 40% |
| `transport` | 11% | 12% | 10% | 8% |
| `entertainment` | 14% | 20% | — | 17% |
| `shopping` | 11% | 17% | 9% | 6% |
| `health` | 4% | 5% | 8% | — |
| `children_education` | — | — | 20% | 12% |
| `other` | 8% | 8% | 7% | 5% |
| **Allocated** | **88%** | **88%** | **88%** | **88%** |
| **Buffer** | **12%** | **12%** | **12%** | **12%** |

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-BWZ2-34 | Disposable 8,3tr | User picks 🏙 | 6 Categories proposed; buffer is 12%; every preset totals exactly 88% | Happy path |
| S-BWZ2-35 | Any preset | Shares are summed | Exactly `88` — asserted by a test over all four presets | A typo here silently changes every User's budget |
| S-BWZ2-36 | Preset names a Category the User doesn't have | User proceeds | It is created at submit (US-08), keyed by `system_key` | Never created before confirmation |
| S-BWZ2-37 | User skips without choosing | Next | Blocked — a preset is required in Phase 1 | The free-text entry point is Phase 4 |

### Edge Cases
1. **Buffer ("Dự phòng") is not a Category.** It is `unallocated_amount`. No Transaction can be assigned to it, and it never appears in the Category picker.
2. **Each preset holds ≤ 6 Categories** (P-05) — every extra Category is another way to fail.
3. **The 🏙/🎓 presets omit `children_education` and 🎓 omits `health`** deliberately; an omitted Category is not budgeted at all, not budgeted at zero.
4. **The free-text option is visible but inert in Phase 1** — either hide it or route it to the preset list with an explanatory line; a dead control is worse than an absent one. **Decision: hide it until Phase 4.**

### Definition of Done
- Four presets implemented, each summing to exactly 88%, asserted by test.
- Selection maps via `system_key`, never by name.
- The Phase 4 free-text entry point is not rendered.

### Idempotency
No write.

---

## US-07: Wizard Screen 3 — the proposal, stated as an estimate

**As a** User,
**I want** to see where each number came from and that it's an estimate,
**so that** I'm not surprised when it turns out to be wrong.

**Client:** `mobile/` only. **API:** `POST /ai/budget-proposals` (payload changed).

### Preconditions
- Screens 1–2 complete.

### Main Flow
1. Client posts `income`, `fixed_total`, `savings_target`, `currency`, `period`, `cycle_start_day`, `profile_preset`, and `intents[]` to `POST /ai/budget-proposals`.
2. System runs US-01's engine and returns per-Category `amount_min`/`amount_max`, `source`, `confidence`, `evidence`, plus `unallocated_amount` and any `OverCommitted`/`ScaledDown` flags.
3. Client renders a donut of **disposable only**, a `đ/ngày` headline, one row per Category with a confidence badge (`○○○ ước lượng` / `●●○ từ N tuần data` / `●●● bạn đã nói`), then buffer, then savings and fixed as already-deducted reference lines.
4. Client shows a mandatory notice: *"Đây là ước lượng — tôi chưa biết thói quen chi tiêu của bạn. Sau 1 tuần tôi sẽ xem số thật và chỉnh lại cùng bạn."*
5. User may tap a row to expand a slider/input. Editing sets `source = manual`, `locked = true`.
6. On edit, **only the buffer changes.** Other rows are never silently re-scaled.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-BWZ2-38 | A preset proposal | Screen renders | Every row shows a band, a badge, and evidence or nothing — never the filler string "AI đề xuất mức chi tiêu tiêu biểu…" | B7 |
| S-BWZ2-39 | User raises Ăn uống by 300k | Edit confirmed | Only that row and the buffer change | ⚠️ P-03 — silently moving someone else's number destroys trust |
| S-BWZ2-40 | Edits push the buffer below 5% of disposable | Edit confirmed | Warning shown; the edit is still allowed | User's money, User's call |
| S-BWZ2-41 | Edits would push total above disposable | Edit attempted | Blocked — the total can never exceed disposable | ⚠️ Financial consistency |
| S-BWZ2-42 | `persona = cold` | Screen renders | The "đây là ước lượng" notice is present and cannot be dismissed | P-01 pre-commitment |
| S-BWZ2-43 | Any state | Donut drawn | Savings and fixed are **not** in the donut — it shows disposable only | They are already deducted; including them double-counts |

### Edge Cases
1. **Band widths come from source confidence:** `stated`/`manual` → no band (`min == max`); `preset` → `×85%`…`×115%`. History-derived bands are Phase 3.
2. **`budget_limits.amount_limit = amount_max`.** `amount_min` is presentation and state classification only, never enforcement.
3. **Re-proposal after an edit is computed locally** — no second server call, matching v1's behaviour.
4. **Over-committed proposals surface the shortfall and a suggestion to cut `discretion` first** — the engine does not fix it silently.
5. **More than 7 Categories** → warning plus a concrete merge suggestion, not a block (E-03).

### Definition of Done
- Badges correct per source; no filler reasoning string remains anywhere in the codebase.
- Manual edit of one row provably leaves every other row's amount unchanged (test).
- The estimate notice renders for every `cold` User.
- Donut excludes savings and fixed.

### Idempotency
`POST /ai/budget-proposals` writes nothing — safe to retry.

---

## US-08: Confirm and create

**As a** User,
**I want** one confirmation to create the whole plan,
**so that** I don't repeat the same steps once per Category.

**Client:** `mobile/` only. **API:** `POST /budgets/bulk` (extended with a `plan` object).

### Preconditions
- A reviewed proposal exists client-side.

### Main Flow
1. User taps "Bắt đầu dùng".
2. Client sends the reviewed set plus the `plan` object.
3. System re-validates ownership of every Category ID, re-runs every constraint server-side (never trusting the client's arithmetic), creates any missing preset Categories, then — in **one** DB transaction — writes the plan, the plan items, and the bulk-replaced budgets and limits, superseding any previous active plan.
4. System returns the created count and the active plan.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-BWZ2-44 | 6 reviewed Categories, 1 not yet existing | Confirm | 1 Category created, 6 budgets written, plan v1 `origin = 'wizard'` | Happy path |
| S-BWZ2-45 | User had 3 budgets from before | Confirm | Old budgets replaced, not merged; old plan superseded | Same semantics as v1 US-05 |
| S-BWZ2-46 | A reviewed Category was deleted meanwhile | Confirm | `404 CATEGORY_NOT_FOUND`; **nothing** is written | Whole-transaction rollback |
| S-BWZ2-47 | Client sends amounts that violate the floor | Confirm | `400 INVALID_INPUT` | Server does not trust the client |
| S-BWZ2-48 | DB fails mid-write | Confirm | Full rollback — no plan without budgets, no budgets without a plan | ⚠️ Financial consistency |
| S-BWZ2-49 | Same Category twice in the payload | Confirm | `422 DUPLICATE_CATEGORY_IN_REQUEST` | Carried from v1 |

### Edge Cases
1. ⚠️ **Partial writes are the worst failure mode in this feature** — Phase 2 calibrates against the plan, so a plan that disagrees with the budgets produces confidently wrong advice. One transaction, no exceptions.
2. **Category creation happens inside the same transaction** as the budget write, so an abort leaves no orphan Categories.
3. **The existing `SELECT … FOR UPDATE` lock** on the User's budget rows is retained — two devices serialize rather than interleave.
4. **`period` is forced to `monthly`** server-side (A-03) regardless of what the client sends.

### Definition of Done
- One transaction covering Category creation + plan + items + budgets + limits, verified against a real Postgres instance.
- Every v1 error case still returns the same code.
- Test: an induced mid-write failure leaves zero rows in all five tables.

### Idempotency
See US-04 — version-bumping, not idempotent; serialized by row lock. Open Question #3.

---

## US-09: Budget context at the moment of spending

**As a** User who just recorded a coffee,
**I want** to see what that did to my budget right now,
**so that** the budget affects the next decision instead of being something I check monthly.

**Client:** `mobile/` (AI Chat). **API:** `POST /transactions` (response extended).

### Preconditions
- Caller has an active plan (US-04) or at least one budget for the Transaction's Category.

### Main Flow
1. User confirms a transaction from the AI Chat card; client calls `POST /transactions` as today.
2. System writes the transaction and, in the same service call, computes `budget_impact` for the affected Category: `amount_max`, `spent_this_cycle`, `state` (`under`/`in_band`/`over_edge`/`over`), and `remaining_today = (amount_max − spent) / daysLeftInCycle` floored to 1.000đ.
3. System also returns `daily_remaining_total` across disposable, present even when the Category has no budget.
4. Client renders two extra lines under the confirmation: the Category's bar plus "hôm nay còn X", and "💸 Hôm nay còn Y".

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-BWZ2-50 | Cafe budget 900k, spent 640k, 17 days left | User records 55k | Shows `640k / 900k`, "hôm nay còn 12.000đ", plus the daily total | Happy path |
| S-BWZ2-51 | Cafe spent 980k of 900k | User records another | "vượt 80.000đ · 17 ngày còn lại: 178.000đ/ngày" — **no red, no sad emoji, no exclamation mark** | P-07 |
| S-BWZ2-52 | Category has no budget | User records | Category line omitted; "Hôm nay còn Y" still shown | Always give the User one usable number |
| S-BWZ2-53 | No active plan and no budgets | User records | `budget_impact` is null; the card renders exactly as it does today | No regression |
| S-BWZ2-54 | Plan exists but `disposable IS NULL` (manual origin) | User records | Category line shown; the daily total line is hidden | Ties to S-BWZ2-24 |
| S-BWZ2-55 | Last day of the cycle (`daysLeft = 0`) | User records | Shows the remaining amount without dividing | ⚠️ Division by zero |

### Edge Cases
1. **Computed server-side in the same call** that already holds the wallet, category, and cycle context — a second round trip would make the line arrive after the User has stopped looking.
2. ⚠️ **`daysLeft = 0` must not divide.** Show the remaining total for the day instead.
3. **Red is reserved for system errors.** Over-budget uses amber; the copy states the fact and the next number, and never judges.
4. **`remaining_today` floors to the nearest 1.000đ** — "còn 12.347đ" is noise; "còn 12.000đ" is a decision.
5. **A Transaction in a non-plan currency** returns no `budget_impact` (A-04).
6. **This is not a notification.** Push for near/over-budget is Phase 2 and explicitly out of scope here.

### Definition of Done
- `POST /transactions` returns a nullable `budget_impact` plus `daily_remaining_total`; existing clients ignoring the new fields are unaffected.
- Both lines render in the AI Chat confirmation.
- No red colour and no sad emoji in any state (review + test on the state→style map).
- `daysLeft = 0` covered by test.

### Idempotency
Inherits `POST /transactions`'s existing `idempotency_key`. `budget_impact` is derived, never stored, so a replayed request recomputes rather than double-counting.

---

## UI States

Every surface this feature touches, in all four states. A state marked n/a is genuinely unreachable, not merely unhandled.

| Surface | Loading | Empty | Error | Success |
|---|---|---|---|---|
| Wizard launch (prefill) | Modal opens straight away showing Screen 1's skeleton; inputs disabled until prefill resolves — the modal never waits on a blank screen | No visible Categories (unreachable after US-02, still handled): continue preset-only, every Category created at submit | Network or 5xx → retry affordance **inside** the modal; the wizard stays open and no input is lost | Screen 1 interactive |
| Screen 1 | n/a — all local | Fields blank, `Còn được chi` renders "—" not "0đ", Next disabled | Validation message inline under the offending field; Next stays disabled until resolved | Next enabled |
| Screen 2 | n/a | n/a — the four presets are static | n/a | Advances on tap |
| Screen 3 (proposal) | Row skeletons, donut hidden **not drawn at zero**, buttons disabled | n/a — a proposal always has ≥ 1 row | 4xx → return to the screen that caused it with the message; 5xx → retry inside the modal with every reviewed edit preserved | Rows, bands, badges and donut render |
| Submit | Button shows progress; the modal is **not dismissible** while the request is in flight | n/a | Stay on Screen 3 with the message; nothing was written, retry is safe | Success screen, then the budget and plan queries are invalidated |
| Chat confirmation (US-09) | Budget lines render together with the transaction card, never as a later async pop-in | Category has no budget → that line is absent, the daily total still shows | `budget_impact` absent or failed → the card renders exactly as it does today | Two extra lines under the card |

**State rules:**
1. **Red is reserved for system errors** (P-07). A failed request may use it; being over budget may not.
2. **A zero and an unknown are different.** An unresolved figure renders "—"; `0đ` means the System actually computed zero.
3. **The wizard cannot be dismissed mid-submit.** The server guards against partial writes, but a User who dismisses during the request cannot tell whether it landed.
4. **Nothing on Screen 3 is re-fetched on retry** — the proposal is recomputed from the same inputs, so a retry never silently changes numbers the User already reviewed.

---

## Out of Scope (Phase 1)

| Not here | Where it lives |
|---|---|
| Convergence loop — day 7 / day 14 / end-of-cycle check-ins, zero-sum funding dialog | Phase 2 (`docs/new-tasks.md` §8) |
| Push notifications, `user_push_tokens`, `user_preferences`, Settings screen, `notification_mutes` | Phase 2 (§21) |
| `hot` persona one-screen confirm, "thực tế 3 tháng" column, income median/lowest prefill, history-derived bands | Phase 3 (§7) |
| Natural-language input mode, LLM extractor, regex cross-check, 100-sentence eval set | Phase 4 (§9) |
| **Timezone correctness** — all cycle arithmetic stays UTC (A-05); E-14 remains unsatisfied | Separate feature (D-09) |
| Web (`frontend/`) parity for the wizard | Follow-up (§18) |
| Multi-currency planning | Unchanged from v1 |
| Household/shared budgets | v2 is personal-only; `budget_plans.user_id` is shaped so a `household_id` can be added later without a breaking migration |
| Auto-creating a Financial Goal (F-08) from the savings line | §18 |
| Undo after submit (plan versioning makes it feasible; no UI in v2) | §18 |
| Narrowing `budget_limits.spent` to a mid-cycle budget's own `start_date` | Pre-existing gap, `docs/features.md` §4 |

---

## Open Questions

1. **Does Phase 1 ship to users on its own, or wait for Phase 2?** Phase 1 alone gives a better first budget with still no correction loop — which is the exact failure v2 exists to fix. *Assumption: Phase 1 ships internally / to the tester, and the first real user-facing release is Phase 1 + Phase 2 together.* Confirm before planning the release.
2. **`warm` persona in Phase 1** — A-02 gives every persona the cold flow. A `warm` User with 20 transactions gets preset numbers when partial history was available. *Assumption: accepted for Phase 1; `persona` is still computed and stored so Phase 3 can act on it.*
3. **Idempotency key for `POST /budgets/bulk`** — a double-tap currently produces two plan versions with identical content. Harmless but noisy. *Assumption: not added in Phase 1; revisit if version history becomes unreadable.*
4. **Preset percentages have no empirical basis** — they are informed estimates for the Vietnamese context, and they set the first-cycle error for every `cold` User. *Assumption: ship §5.3's table; once ~200 Users have completed a full cycle, recompute per profile from real data and update. This should become a recurring task, not a one-off.* (OQ-10)
5. **Does the buffer become spendable?** If not, a User who overspends has nowhere to record it. *Assumption: v2 keeps it non-spendable; overspend is recorded against the original Category and shows `over_edge`. Revisit after the first cycle.* (OQ-13)
6. **Migration ordering vs. the deploy path.** Migrations only run on first volume init, so 019/020 need manual application on the VPS. *Assumption: same manual step already documented for 015–018; a real migration runner is a separate infrastructure task.*
