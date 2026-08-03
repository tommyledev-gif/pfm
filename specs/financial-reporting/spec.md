# Feature Spec: F-07 Financial Reporting (MVP: Summary Report)

> Source: `SRS.md` Feature-07 / FR-07 ("Reports may include summaries of income and expenses, spending by Category, Wallet balances, and overall financial trends over time"), `SDS.md` §7 (empty skeleton — no ACs defined there beyond the §4 traceability row `S-RPT-01 | Feature-07: Financial Reporting | US-07-01 View the Summary Report | Insight & feedback loop`), `CLAUDE.md` MVP Features table ("F-07 | Financial Reporting (summary) | MVP")
> Status: MVP — next feature per `CURRENT_STATE.md` roadmap. F-01 through F-06 (User/Auth/Wallet/Category/Budget/Transaction) are all implemented backend + web; this is the first read-only, aggregation-only feature, and every table it reads from (`transactions`, `wallets`, `categories`) already exists — **no new migration required**.
> Related: [F-06 Transaction Management](../transaction-management/spec.md) (sole data source; reuses its `occurred_at` date-range filter convention verbatim), [F-05 Budget Management](../budget-management/spec.md) (this spec's live-aggregation, no-currency-blending, and single-aggregate-query mandate are the same pattern Budget already established for `GET /budgets`), [F-03 Wallet Management](../wallet-management/spec.md) (currency is inherited from a Transaction's Wallet, exactly as in F-06), [F-04 Category Management](../category-management/spec.md) (category names/labels in the breakdown)

## Context

A Financial Report summarizes the User's own recorded income/expense activity (F-06 Transactions) over a date range — it is a **read-only view over existing data**, never a stored entity. There is no `reports` table; every number in this feature is computed live at request time, exactly mirroring Budget's `spent` computation (`specs/budget-management/spec.md` Edge Cases #1) rather than Wallet's stored-`balance` approach.

**Resolved design decisions:**

1. **One endpoint, not five.** SRS Feature-07 lists five User Stories (Summary, Income Report, Expense Report, Filter by Date, Filter by Wallet/Category), which on first read suggests five API operations. This spec resolves them into **one endpoint — `GET /reports/summary` — with query parameters** (`from`, `to`, `wallet_id`, `category_id`, `type`), because US-02 through US-05 are not distinct resources or write operations (unlike Transaction's five genuinely different CRUD operations) — they are filtered *views* of the same aggregation. A five-endpoint design would duplicate the exact same query logic five times for no behavioral difference. This is a deliberate divergence from every prior MVP spec's one-endpoint-per-User-Story pattern (F-03 through F-06), flagged explicitly because it is the single biggest structural decision in this spec (see Open Questions #3).
2. **Consequence of decision #1: all five SRS User Stories become MVP-complete together.** `CLAUDE.md`'s MVP table scopes F-07 down to "(summary)" only, while SRS tags only US-01 as `[MVP]`. Because US-02–US-05 are query-parameter variants of US-01's own endpoint, building US-01 means US-02–US-05 ship for free with zero additional endpoints — this spec treats the apparent CLAUDE.md/SRS scope tension as resolved, not a gap requiring separate follow-up work.
3. **Amounts are grouped and reported per Wallet currency, never blended.** A Transaction has no `currency` field of its own (F-06 Context #1) — it inherits its Wallet's currency. Exactly like Budget's per-currency `limits`/`spent` (`specs/budget-management/spec.md` decision #2), this spec's totals are a set of `(currency, total_income, total_expense, net)` entries, one per currency that has at least one matching Transaction in the window — never a single cross-currency sum.
4. **Default report window = the calendar month containing "now" (UTC), when `from`/`to` are omitted.** This mirrors Budget's period-window default (`specs/budget-management/spec.md` decision #3) for consistency across the two features a User is most likely to view side-by-side (dashboard-style "this month" snapshot). Explicit assumption — SRS/SDS specify no default anywhere (see Open Questions #1).
5. **Wallet balances are explicitly out of scope here**, despite FR-07's wording naming them. A Wallet's `balance` is a *stock* (a point-in-time snapshot), already served by `GET /wallets` (F-03) — this feature reports *flow* (income/expense activity over a window) only. Duplicating balance into this response would be redundant, not additive.
6. **"Overall financial trends over time" (FR-07) is out of scope for this spec.** A trend view (e.g. month-over-month comparison, charting) is a distinct, heavier feature that the SRS roadmap itself notes "improve[s] progressively over releases" and overlaps with F-11 Data Overview Dashboard (Release 1) — this spec covers only a single-window summary, not a time series.

Actors:
- **User** — any `active` user (`role = admin` or `member`); Reports are personal, computed only over the caller's own Wallets/Categories/Transactions. There is no admin-facing cross-user reporting in MVP (same precedent as F-03 through F-06).

## Preconditions (feature-level)

- Caller holds a valid access JWT (`role` irrelevant — every active user views their own report identically).
- No new migration required — this feature reads `transactions` (joined with `wallets` for currency and `categories` for names), all of which already exist (`001_init.sql` through `008_transactions.sql`).
- The caller may have zero Wallets/Categories/Transactions — an empty report is a valid `200`, not an error (see Edge Cases).

### Domain Concept: Report Window

| Concept | Meaning |
|---|---|
| `from` / `to` | The `occurred_at` range being summarized, **both bounds inclusive** (mirrors F-06's `GET /transactions` `from`/`to` convention, S-TRX-27). Defaults to the calendar month containing "now" (UTC) if either is omitted — **if one of `from`/`to` is provided without the other, the default fills in the missing bound**, not the whole pair (see Edge Cases #4). |
| `totals` | Per-currency `{ total_income, total_expense, net }`, one entry per currency with ≥1 matching Transaction in the window — a currency with zero activity in the window is omitted entirely, never zero-filled (mirrors Budget's "untracked currency" precedent, `specs/budget-management/spec.md` Edge Cases #4, applied in reverse: here it's "no data" rather than "no limit entry"). |
| `by_category` | Per `(category, type, currency)` breakdown: `{ category_id, category_name, type, currency, amount }`, one row per combination with ≥1 matching Transaction — omitted combinations are simply absent, not zero-filled. Ordered `amount DESC` (largest first) within the response. |

**Business invariant**: every amount in this feature (`total_income`, `total_expense`, `net`, `by_category[].amount`) is a BIGINT integer cents sum over non-deleted Transactions only — never a float, and never converted or blended across currencies.

**Business invariant**: a Transaction is included in the report if and only if it is non-deleted, `user_id = caller`, and its `occurred_at` falls within `[from, to]` inclusive — the exact same inclusion rule F-06 uses for its own list filter, reused verbatim rather than redefined.

⚠️ **Money rule**: no currency conversion is ever performed — a caller with both VND and USD Wallets sees two independent currency entries in `totals`, exactly as Budget never blends `limits` across currencies.

---

## US-01: View the Summary Report [MVP]

**As a** User,
**I want** to see my total income, total expense, and net for a period, broken down by currency and by Category,
**so that** I can understand my overall financial situation at a glance (SRS FR-07).

**API:** `GET /reports/summary`

### Preconditions
- Caller is authenticated.
- Query parameters (all optional): `from`, `to` (ISO 8601 date or datetime), `wallet_id` (uuid), `category_id` (uuid), `type` (`income`|`expense`).

### Main Flow
1. User opens the Reports screen (no filters applied yet).
2. App calls `GET /reports/summary` with no query parameters.
3. System resolves the report window: `from` = first day of the current calendar month (UTC, 00:00:00) if not provided, `to` = "now" (UTC) if not provided.
4. System validates any provided `wallet_id` belongs to (or is visible to) the caller, any provided `category_id` is visible to the caller, `from ≤ to`, and `type` (if present) is exactly `"income"` or `"expense"` — same validation semantics as F-06's `GET /transactions` (handler/service-level).
5. System aggregates the caller's non-deleted Transactions matching all provided filters and the resolved window, grouped by the Transaction's Wallet currency, into `totals: [{ currency, total_income, total_expense, net }]` (one aggregate query — see Edge Cases #7).
6. System aggregates the same filtered set grouped by `(category_id, type, currency)` into `by_category: [{ category_id, category_name, type, currency, amount }]`, ordered `amount DESC`.
7. System returns `200` with `{ range: { from, to }, totals, by_category }`.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-RPT-01 | Caller has, this calendar month: 5,000,000 VND income, 3,200,000 VND expense, all in VND Wallets | Caller calls `GET /reports/summary` (no filters) | `200`; `totals: [{ currency: "VND", total_income: 5000000, total_expense: 3200000, net: 1800000 }]` | Happy path — default window, single currency |
| S-RPT-02 | Caller has zero Transactions ever | Caller calls `GET /reports/summary` | `200`; `totals: []`, `by_category: []` | Not a `404` — an empty report is valid |
| S-RPT-03 | Caller has only expense Transactions this month, no income | Caller calls `GET /reports/summary` | `200`; the currency's `total_income: 0`, `total_expense` reflects the sum, `net` negative | The currency entry itself is still included (has *some* activity); only `total_income` is zero |
| S-RPT-04 | Caller has a VND Wallet with 2,000,000 income this month and a USD Wallet with 15,000 expense this month | Caller calls `GET /reports/summary` | `200`; `totals` has two entries — `{ VND: income 2000000, expense 0 }` and `{ USD: income 0, expense 15000 }` — never a blended total | ⚠️ Money rule — no cross-currency sum |
| S-RPT-05 | Caller has a USD Wallet with zero Transactions this month, but has VND activity | Caller calls `GET /reports/summary` | `200`; `totals` contains only the `VND` entry — no `USD` entry with all-zero values | Zero-activity currencies are omitted, not zero-filled |
| S-RPT-06 | Caller has expense Transactions this month under "Food" (1,200,000) and "Rent" (2,000,000), both VND | Caller calls `GET /reports/summary` | `200`; `by_category` contains `{ Rent, expense, VND, 2000000 }` before `{ Food, expense, VND, 1200000 }` | Ordered `amount DESC` |
| S-RPT-07 | Caller has an income Transaction this month under "Salary" (5,000,000 VND) | Caller calls `GET /reports/summary` | `200`; `by_category` includes `{ Salary, income, VND, 5000000 }` alongside any expense rows | Breakdown covers both `income` and `expense` categories, not expense-only |
| S-RPT-08 | Caller has a Transaction that was soft-deleted after creation | Caller calls `GET /reports/summary` | `200`; that Transaction's amount is excluded from both `totals` and `by_category` | Soft-deleted rows excluded unconditionally, same as F-06's own list |
| S-RPT-09 | Caller has a Transaction dated the 1st of *last* calendar month | Caller calls `GET /reports/summary` (no filters — default window = this month) | `200`; that Transaction is excluded from all aggregates | Default window boundary — mirrors Budget's "only the current period's Transactions count" (S-BUD-19) |
| S-RPT-10 | Caller's "Food" category was soft-deleted after a Transaction was recorded against it | Caller calls `GET /reports/summary` | `200`; `by_category` still shows `{ category_name: "Food", ... }` for that historical amount, not `null`/omitted | Mirrors F-06's Business invariant (S-TRX-30) — the join must not filter on the Category's `deleted_at` |
| S-RPT-11 | No/invalid JWT | Caller calls `GET /reports/summary` | `401 UNAUTHENTICATED` | Authentication failure |
| S-RPT-12 | Caller A has income/expense Transactions; Caller B (different user) has their own, different amounts | Caller A calls `GET /reports/summary` | `200`; totals/by_category reflect only Caller A's Transactions | User isolation — ⚠️ cross-user leak would be critical |

### Response Shape
```json
{
  "range": { "from": "2026-08-01T00:00:00Z", "to": "2026-08-03T23:59:59Z" },
  "totals": [
    { "currency": "VND", "total_income": 5000000, "total_expense": 3200000, "net": 1800000 },
    { "currency": "USD", "total_income": 0, "total_expense": 15000, "net": -15000 }
  ],
  "by_category": [
    { "category_id": "uuid", "category_name": "Salary", "type": "income", "currency": "VND", "amount": 5000000 },
    { "category_id": "uuid", "category_name": "Rent", "type": "expense", "currency": "VND", "amount": 2000000 },
    { "category_id": "uuid", "category_name": "Food", "type": "expense", "currency": "VND", "amount": 1200000 }
  ]
}
```

### Edge Cases
1. **This feature has no stored entity — every field is computed live**, exactly mirroring Budget's `spent` (`specs/budget-management/spec.md` Edge Cases #1). There is nothing to soft-delete or paginate on the report itself; only the underlying Transactions/Wallets/Categories it reads have their own lifecycle.
2. **Default window = calendar month containing "now" (UTC)**, applied independently per missing bound: if only `from` is given, `to` defaults to "now"; if only `to` is given, `from` defaults to the first of the current calendar month — never "both default together only if both are absent" (see US-04 Edge Cases for the case where both are explicit).
3. **Currency grouping comes from the Transaction's Wallet, not a field on the Transaction itself** — identical join pattern to F-06 (which itself has no `currency` column). `plan.md` must join through `wallets.currency`, not assume a denormalized column exists.
4. **Zero-activity currencies and zero-activity category/type/currency combinations are omitted, never zero-filled** — this keeps the response proportional to actual activity and mirrors Budget's "untracked currency is simply absent" precedent (applied here to the report's own aggregates, not Budget's `limits`).
5. **A Category soft-deleted after a Transaction was recorded against it still appears in `by_category` with its historical name** — the join resolving `category_name` must not filter on the Category's own `deleted_at`, exactly mirroring F-06's Business invariant for `GET /transactions`.
6. **No pagination on `by_category`** — bounded naturally by the caller's own Category count (F-04 has no per-user cap, but in practice this stays small; mirrors Budget's no-pagination-for-MVP precedent).
7. **Must be implemented as (at most) two aggregate queries — one `GROUP BY currency` for `totals`, one `GROUP BY category_id, type, currency` for `by_category` — never an N+1 per-Transaction or per-Category loop**, mirroring Budget's explicit "single aggregate query" mandate (`specs/budget-management/spec.md` Edge Cases #1).

### Definition of Done
- `GET /reports/summary` implemented, strictly scoped to `user_id = caller`, computing `totals` and `by_category` via aggregate queries (not N+1) over non-deleted Transactions joined to Wallets (currency) and Categories (name).
- Default window resolves independently per missing `from`/`to` bound to the calendar month containing "now" (UTC).
- Unit test asserts a Transaction belonging to a different `user_id` is never present in another caller's response.
- Integration tests for S-RPT-01 through S-RPT-12 pass.
- No test asserts on `float`/decimal handling for any amount; no test asserts a blended cross-currency total exists anywhere in the response.

### Idempotency
N/A — read-only (`GET`), naturally idempotent.

---

## US-02: View Income Report

**As a** User,
**I want** to see only my income totals and income-by-category breakdown for a period,
**so that** I can review where my money came from without expense noise.

**API:** `GET /reports/summary?type=income` (same endpoint as US-01 — see US-01 for the full flow, response shape, and shared edge cases; this section covers only what `type=income` changes).

### Main Flow
Identical to US-01, with one additional filter step: System restricts both `totals` and `by_category` to `income` Transactions only — `totals` entries report `total_expense: 0` for every currency (since expense is filtered out entirely, not merely zero-summed), and `by_category` contains only `type: "income"` rows.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-RPT-13 | Caller has both income and expense Transactions this month | Caller calls `GET /reports/summary?type=income` | `200`; `totals[].total_expense = 0` for every currency; `by_category` contains only `income`-type rows | Happy path — income-only view |
| S-RPT-14 | Caller has only expense Transactions this month, no income at all | Caller calls `GET /reports/summary?type=income` | `200`; `totals: []`, `by_category: []` | No income activity → empty report, not an error |
| S-RPT-15 | — | Caller calls `GET /reports/summary?type=transfer` (not a valid enum value) | `400 INVALID_INPUT` | Same validation as F-06's own `type` filter (mirrors S-TRX rules) |

### Edge Cases
1. **`type=income` excludes expense Transactions from the aggregate query entirely** — it is a `WHERE` filter, not a post-processing step that zeroes out expense fields after computing them.

### Definition of Done
- `?type=income` filter implemented on `GET /reports/summary`. Integration tests for S-RPT-13, S-RPT-14 pass. Unit test for S-RPT-15 passes.

### Idempotency
N/A — read-only (`GET`), naturally idempotent.

---

## US-03: View Expense Report

**As a** User,
**I want** to see only my expense totals and expense-by-category breakdown for a period,
**so that** I can review where my money went without income noise.

**API:** `GET /reports/summary?type=expense` (same endpoint as US-01/US-02 — symmetric to US-02 with `income`/`expense` swapped).

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-RPT-16 | Caller has both income and expense Transactions this month | Caller calls `GET /reports/summary?type=expense` | `200`; `totals[].total_income = 0` for every currency; `by_category` contains only `expense`-type rows | Happy path — expense-only view, mirrors S-RPT-13 |
| S-RPT-17 | Caller has only income Transactions this month, no expense at all | Caller calls `GET /reports/summary?type=expense` | `200`; `totals: []`, `by_category: []` | Mirrors S-RPT-14 |

### Definition of Done
- `?type=expense` filter implemented on `GET /reports/summary`. Integration tests for S-RPT-16, S-RPT-17 pass.

### Idempotency
N/A — read-only (`GET`), naturally idempotent.

---

## US-04: Filter Reports by Date

**As a** User,
**I want** to view a Summary/Income/Expense Report for an explicit date range rather than only the current month,
**so that** I can review a past month, a custom period, or year-to-date activity.

**API:** `GET /reports/summary?from=...&to=...` (same endpoint — see US-01 for shared behavior; this section covers explicit `from`/`to` handling).

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-RPT-18 | Caller has Transactions in both July and August 2026 | Caller calls `GET /reports/summary?from=2026-07-01&to=2026-07-31` | `200`; only July's Transactions are aggregated, regardless of the current calendar month | Happy path — explicit past-month range |
| S-RPT-19 | — | Caller calls `GET /reports/summary?from=2026-08-31&to=2026-08-01` (reversed range) | `400 INVALID_INPUT` | `from` must not be after `to` — same rule as F-06's `GET /transactions` (S-TRX-28) |
| S-RPT-20 | — | Caller calls `GET /reports/summary?from=not-a-date` | `400 INVALID_INPUT` | Handler-level shape validation, before any DB query |
| S-RPT-21 | Caller has Transactions spanning 2025-01-01 through 2026-08-03 | Caller calls `GET /reports/summary?from=2025-01-01&to=2026-08-03` (a multi-year range) | `200`; every matching Transaction across the full range is aggregated in a single response — no pagination | No cap on date-range width, mirroring F-06's own list-filter precedent (S-TRX Edge Cases #2) |
| S-RPT-22 | — | Caller calls `GET /reports/summary?from=2026-08-01` (only `from`, no `to`) | `200`; `to` defaults to "now" (UTC) | Independent per-bound default (US-01 Edge Cases #2), not "both or neither" |

### Edge Cases
1. **No maximum date-range width is enforced** — a multi-year range is valid and aggregated in the same two queries as a one-day range (S-RPT-21); this is a read-only aggregate, not a per-row export, so width doesn't change the response shape.
2. **`from`/`to` accept both bare dates (`YYYY-MM-DD`) and full ISO 8601 datetimes**, exactly like F-06's `GET /transactions` filter — a bare date is treated as midnight UTC for `from` and end-of-day UTC for `to` (same convention, not redefined here).

### Definition of Done
- Explicit `from`/`to` query params implemented, validated `from ≤ to`, no range-width cap. Integration tests for S-RPT-18, S-RPT-21, S-RPT-22 pass. Unit tests for S-RPT-19, S-RPT-20 pass.

### Idempotency
N/A — read-only (`GET`), naturally idempotent.

---

## US-05: Filter Reports by Wallet or Category

**As a** User,
**I want** to scope a Report to a specific Wallet or Category,
**so that** I can review activity for just one account or spending line without the rest of my data.

**API:** `GET /reports/summary?wallet_id=...` and/or `?category_id=...` (same endpoint — filters combine with `from`/`to`/`type` via AND, exactly like F-06's `GET /transactions`).

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-RPT-23 | Caller has Transactions across 2 Wallets this month | Caller calls `GET /reports/summary?wallet_id=<W1>` | `200`; only W1's Transactions are aggregated | Happy path — same filter semantics as F-06 (S-TRX-24) |
| S-RPT-24 | `wallet_id` query param references a Wallet owned by a *different* user | Caller calls `GET /reports/summary?wallet_id=<other's>` | `403 WALLET_ACCESS_DENIED` | Same ownership check as F-06's own filter (S-TRX-25) |
| S-RPT-25 | `wallet_id` does not exist | Caller calls `GET /reports/summary?wallet_id=<random-uuid>` | `404 WALLET_NOT_FOUND` | Same existence semantics as F-03/F-06 |
| S-RPT-26 | `category_id` query param references a private Category owned by a *different* user | Caller calls `GET /reports/summary?category_id=<other's>` | `403 CATEGORY_ACCESS_DENIED` | Same ownership check as F-06's own filter |
| S-RPT-27 | `category_id` does not exist | Caller calls `GET /reports/summary?category_id=<random-uuid>` | `404 CATEGORY_NOT_FOUND` | Same existence semantics as F-04/F-06 |
| S-RPT-28 | Caller has Transactions across 2 Wallets and 2 Categories | Caller calls `GET /reports/summary?wallet_id=<W1>&category_id=<Food>` | `200`; only Transactions matching **both** W1 and Food are aggregated | Filters combine with AND, not OR |

### Edge Cases
1. **`wallet_id` and `category_id` combine with AND when both are present**, and both combine with `from`/`to`/`type` — no OR-mode exists (mirrors F-06's own multi-filter `GET /transactions` semantics exactly).
2. **`category_id` filtering includes Transactions whose Category is now soft-deleted**, exactly like the unfiltered case (S-RPT-10) — the filter only re-checks the Category's visibility *at the time the filter's own ownership check runs*, not that it's still non-deleted.

### Definition of Done
- `wallet_id`/`category_id` filters implemented with the same ownership/existence semantics as F-06's `GET /transactions`, combining via AND with each other and with `from`/`to`/`type`. Integration tests for S-RPT-23, S-RPT-28 pass. Unit tests for S-RPT-24 through S-RPT-27 pass.

### Idempotency
N/A — read-only (`GET`), naturally idempotent.

---

## Out of Scope (Feature F-07)

- **Wallet balance snapshots in the report response** — resolved out of scope (Context decision #5); already served by `GET /wallets` (F-03), not duplicated here.
- **Trends/time-series over multiple periods** (e.g. month-over-month charts) — resolved out of scope (Context decision #6); FR-07's own wording flags this as improving "progressively over releases," and it overlaps with F-11 Data Overview Dashboard (Release 1).
- **Report export (PDF/CSV/Excel)** — not mentioned anywhere in SRS/SDS; no export format is designed here.
- **Scheduled or emailed reports** — on-demand only (`GET`); no background job, no notification integration (that would be F-10's domain, and only for Budget-threshold events per that spec, not periodic reports).
- **Cross-user/admin reporting** — no such endpoint exists in this spec, matching every other MVP feature's precedent.
- **Currency conversion or a blended cross-currency total** — never performed anywhere in this project (mirrors Budget's explicit no-conversion rule); a User with multiple currencies always sees independent per-currency entries.
- **Five separate API endpoints** — resolved as one endpoint with query parameters (Context decision #1); see Open Questions #3 for the tradeoff this accepts.
- **A minimum/maximum bound on `by_category` row count** — no cap enforced, matching the no-cap precedent from F-03/F-04/F-05/F-06.

## Open Questions

1. **Default report window**: this spec assumes "calendar month containing now (UTC)" when `from`/`to` are omitted, mirroring Budget's period default — no SRS/SDS source states this explicitly. **Recommend the current assumption** (consistency with Budget's already-shipped behavior), but flag for explicit product sign-off since it directly shapes US-01's no-filter happy path.
2. **`by_category` row cap**: no pagination/limit defined, on the assumption that a User's own Category count stays small (F-04 has no per-user cap either). Low priority — revisit only if Category counts are observed to grow large in practice.
3. **Single-endpoint design (Context decision #1)**: this spec collapses SRS's five User Stories into one endpoint with query parameters, diverging from every prior MVP spec's one-endpoint-per-User-Story pattern. **Recommend this design** — it avoids five near-identical aggregation implementations — but flagging explicitly since a reviewer expecting five distinct endpoints (mirroring F-06's five CRUD operations) should understand this is a deliberate, reasoned deviation, not an oversight.
4. **FR-07's "Wallet balances" and "overall financial trends over time"**: both explicitly deferred (Context decisions #5, #6). Confirm these are genuinely Release-1/F-11 concerns and not expected to land alongside this MVP slice, since FR-07's own requirement text names both directly.
5. **`from`/`to` inclusive-inclusive boundary**: assumed for symmetry with F-06's own `GET /transactions` filter (S-TRX-27) — no independent SRS/SDS statement confirms this for Reporting specifically. Low priority; flagging so `plan.md`/tests don't silently pick an exclusive bound instead.
