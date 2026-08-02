# Feature Spec: F-05 Budget Management (MVP)

> Source: `SRS.md` Feature-05 / FR-04, `SDS.md` §2.1.4 (Budget domain object) / §5.5 (empty skeleton — no ACs defined there), `CLAUDE.md` MVP Features table
> Status: MVP — next feature per CLAUDE.md MVP ordering (F-03 → F-04 → F-05 → F-06); blocks nothing structurally (F-06 Transaction only needs Wallet + Category), but SRS BF-01 (main business flow) sequences Budget creation *before* the first Transaction is recorded, and F-10 Notification Handling's "budget limit reached" trigger (BF-01 step 11) depends on this feature existing first
> Related: [F-03 Wallet Management](../wallet-management/spec.md) (sibling MVP domain feature, same auth/ownership pattern), [F-04 Category Management](../category-management/spec.md) (`budgets.category_id` FK; that spec's S-CAT-27/S-CAT-32 explicitly defer the create-side half of the delete/create race to this spec)

## Context

Phase 0 (User Management + System Security), F-03 (Wallet Management), and F-04 (Category Management) are implemented. Budget Management is the next feature to spec, per the CLAUDE.md MVP Features table ordering and because F-04's own spec (US-05 Edge Cases #4, S-CAT-32) explicitly flagged that the authoritative guard against "a Budget created against a just-deleted Category" belongs here.

A Budget is a spending limit a User sets for a Category within a recurring period (e.g. monthly) — per SRS FR-04, the System tracks actual spending against that limit and indicates whether the User is within or exceeding it.

**Resolved design decisions** (superseding SRS/SDS wording where they conflicted — see the note at the end of this section on the SRS/SDS updates this spec required):

1. **Category-only scope, aggregated across all Wallets.** A Budget limits spend on a Category regardless of which of the caller's Wallets the money came from — it is **not** scoped to a single Wallet, despite SRS BF-01 step 5's original wording ("Budget B1 for Category C2 associated with Wallet W1"). This matches standard budgeting-app UX (a spending plan per category, not per account) and is the better product model, not merely the path of least schema change.
2. **Per-currency limits, not a single amount.** Because a Category's Transactions can come from Wallets of different currencies (F-03 allows `{VND, USD}` per Wallet) and Budgets are no longer Wallet-scoped, a single blended `amount_limit` would silently mix currencies. Instead, a Budget holds a **non-empty set of `(currency, amount_limit)` pairs** — at most one entry per currency — and tracks spend/remaining/status **independently per currency**. A Transaction in a currency the Budget has no entry for is simply not tracked by that Budget (see Edge Cases).
3. **Period window = calendar month.** The tracked window for `period = "monthly"` is the calendar month containing "now" (1st through last day, UTC), regardless of the Budget's `start_date`. `start_date` is stored for informational/audit purposes only and never shifts the boundary.
4. **Budget-crossing Notifications are asynchronous.** When a Transaction pushes a Budget from `"within"` to `"exceeded"`, the Notification (F-10) is created by a background/scheduled process, **not** synchronously inside `POST /transactions` (F-06). This decouples the Transaction write path from Budget/Notification evaluation. The exact schedule/cadence belongs to F-10's own spec (see Open Questions).

Unlike Wallet's `balance` (a stored column updated atomically with each Transaction) or Category's mostly-static metadata, a Budget's defining characteristic is that its "actual spend" is **always computed live** from `transactions` at read time — a Budget row itself never stores a running total. This is a deliberate departure from the Wallet precedent and is called out explicitly in the Edge Cases below, since it's the single most consequential design decision in this spec.

> **Documentation follow-up required**: `SRS.md` BF-01 step 5 currently reads "defines a Budget B1 for Category C2 associated with Wallet W1" and `SDS.md` §2 Budget domain object lists a single `amount_limit (BIGINT)` with an open question about Wallet scope. Both are updated alongside this spec to reflect decisions #1 and #2 above (see the diffs accompanying this spec).

Actors:
- **User** — any `active` user (`role = admin` or `member`); Budgets are personal, not shared. There is no admin-facing budget-management UI in MVP.

## Preconditions (feature-level)

- Caller holds a valid access JWT (`role` irrelevant — every active user manages their own budgets identically).
- `budgets` table (plus its per-currency limits) exists per the schema below (**new migration required** — does not yet exist; current migrations are `001_init.sql` (users) through `006_seed_categories.sql`).
- At least one `expense`-type Category (system or the caller's own) exists to reference (F-04, already implemented).

### Domain Fields (conceptual — full schema/index design belongs in `plan.md`)

This extends the `budgets` entity already named in CLAUDE.md's Core DB Schema; this spec does not restate its column-level definition beyond what's needed for the business rules below, and does not mandate a specific physical shape (a child table of `(budget_id, currency, amount_limit)` rows vs. a JSONB column are both compatible with the rules below — `plan.md` decides).

| Field | Meaning |
|---|---|
| `id` | Unique identifier |
| `user_id` | Owner — Budgets are never shared or system-defined, unlike Category |
| `category_id` | The Category this Budget limits spending on; **must** reference an `expense`-type Category (see Business invariants) |
| `limits` | A **non-empty** set of `(currency, amount_limit)` pairs. At most one entry per `currency`. Each `currency` must be one of the Wallet currency allow-list values (`{VND, USD}`, F-03). Each `amount_limit` is a BIGINT integer cents, > 0 |
| `period` | Recurrence unit. **MVP: `"monthly"` is the only accepted value** (see Open Questions #1) |
| `start_date` | `DATE` (no time component) — informational marker of when the Budget was configured; does **not** shift the period-boundary alignment (resolved: calendar month, see Context) |
| `created_at` / `updated_at` | Audit timestamps |
| `deleted_at` | Soft-delete marker; `NULL` while active |

**Business invariant**: `category_id` must reference a Category whose `type = "expense"`. Budgeting an `income` category has no meaningful "spending limit" semantic — a User wanting to track income/savings targets is the domain of F-08 Financial Goal (Release 1), not this feature.

**Business invariant**: at most one active (non-deleted) Budget can exist per `(user_id, category_id)` at any time — this holds even with multi-currency `limits`, since one Budget entity now covers every currency the User budgets for that Category. Two simultaneous Budgets for the same Category would make "the" spend-vs-limit status ambiguous. This must be enforced at the data layer (partial unique index), not only in application code, mirroring the F-03 one-default-wallet and F-04 name/type-duplicate precedents.

**Business invariant**: `category_id` is immutable after creation — changing which Category a Budget tracks would silently misrepresent any spend/limit history already shown to the User for that Budget ID. This mirrors F-04's Category `type`-immutability rationale.

**Business invariant**: `limits` must contain at least one currency entry at all times (both at creation and after any update) — a Budget with zero currency entries is meaningless; a User who wants to stop tracking a Category entirely should delete the Budget (US-05), not empty its `limits`.

⚠️ **Money rule**: every `amount_limit` value inside `limits` is integer cents — never a float or decimal, in transit or storage. Each currency entry is independently scoped to its own currency; there is no cross-currency conversion or single blended total anywhere in this feature.

---

## US-01: Create a Budget for a Category [MVP]

**As a** User,
**I want** to set one or more currency-scoped spending limits for a Category,
**so that** the System can tell me whether I'm within or exceeding my plan for that Category, in each currency I spend it in.

**API:** `POST /budgets`

### Preconditions
- Caller is authenticated.
- Request body: `{ category_id: uuid, limits: { [currency]: integer, ... }, period?: "monthly", start_date?: "YYYY-MM-DD" }`. `limits` must have at least one key. `period` defaults to `"monthly"` (the only MVP value). `start_date` defaults to today (server date, UTC) if omitted.

### Main Flow
1. User submits the budget creation form (Category picker restricted to `expense`-type categories, one or more currency + amount pairs, optional start date).
2. System validates shape: `category_id` is a UUID; `limits` is a non-empty object where every key is a currency in the Wallet allow-list `{VND, USD}` and every value is a positive non-zero integer; `period` (if present) is exactly `"monthly"`; `start_date` (if present) is a valid ISO date (handler-level).
3. System verifies the Category exists, is visible to the caller (system-defined or `user_id = caller`), is non-deleted, and has `type = "expense"` (service-level).
4. System checks for an existing active Budget for this `(caller, category_id)` pair (service-level, guarded by the partial unique index).
5. System creates the `budgets` row together with one entry per `limits` currency.
6. System returns `201` with the created Budget, including a computed breakdown per currency: `spent = 0`, `remaining = amount_limit`, `status = "within"`, and an overall `status = "within"`.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-BUD-01 | Caller has an `expense` category "Food" with no existing Budget | Caller creates `{ category_id: <Food>, limits: { "VND": 2000000 } }` | `201`; Budget created with one `VND` limit entry, `period = "monthly"`, `start_date` = today | Happy path — single currency |
| S-BUD-02 | Caller has an `expense` category "Travel" with no existing Budget | Caller creates `{ category_id: <Travel>, limits: { "VND": 5000000, "USD": 100000 } }` | `201`; Budget created with two independent currency entries | Happy path — multi-currency |
| S-BUD-03 | Caller has an `income` category "Salary" | Caller creates `{ category_id: <Salary>, limits: { "VND": 2000000 } }` | `422 INVALID_CATEGORY_TYPE` | ⚠️ Business rule — Budgets only apply to `expense` categories |
| S-BUD-04 | — | Caller submits `{ "limits": {} }` (empty object) | `400 INVALID_INPUT` | At least one currency entry is required — see Business invariants |
| S-BUD-05 | — | Caller submits `{ "limits": { "VND": 0 } }` | `400 INVALID_INPUT` | Validation error — an entry must be > 0 |
| S-BUD-06 | — | Caller submits `{ "limits": { "VND": -50000 } }` | `400 INVALID_INPUT` | ⚠️ Money rule — never negative |
| S-BUD-07 | — | Caller submits `{ "limits": { "VND": 10.5 } }` (decimal) | `400 INVALID_INPUT` | ⚠️ Money rule — integer cents only |
| S-BUD-08 | — | Caller submits `{ "limits": { "EUR": 100000 } }` (not in the allow-list) | `400 INVALID_INPUT` | Currency must be one of `{VND, USD}`, matching F-03's Wallet currency allow-list |
| S-BUD-09 | `category_id` does not exist (or is soft-deleted) | Caller creates a Budget against it | `404 CATEGORY_NOT_FOUND` | Same existence semantics as F-04 |
| S-BUD-10 | `category_id` belongs to a *different* user (private category) | Caller creates a Budget against it | `403 CATEGORY_ACCESS_DENIED` | Ownership check — reuses F-04's visibility rule |
| S-BUD-11 | Caller already has an active Budget for category "Food" | Caller creates another Budget for "Food" (any currency combination) | `409 BUDGET_ALREADY_EXISTS` | Duplicate-active-Budget rule — the User must `PATCH` the existing one instead, even to add a new currency |
| S-BUD-12 | No/invalid JWT | Caller calls `POST /budgets` | `401 UNAUTHENTICATED` | Authentication failure |
| S-BUD-13 | Caller has no Budget for "Food" yet; two create-requests for the same category arrive concurrently | Both requests race | Exactly one `201`, the other `409 BUDGET_ALREADY_EXISTS` (enforced by the data-layer partial unique index) | ⚠️ Data-integrity critical — same class of guard as F-03 S-WAL-10 |
| S-BUD-14 | Caller has no Budget for "Food" yet; a `POST /budgets` for "Food" races with a `DELETE /categories/{food_id}` on the same category | Both requests race | Exactly one consistent end state: either the Budget is created and the Category delete is rejected with `409 CATEGORY_IN_USE` (F-04 S-CAT-27), or the Category is deleted first and the Budget create fails with `404 CATEGORY_NOT_FOUND` — never a Budget left referencing a since-deleted Category | ⚠️ Closes the race explicitly deferred by F-04 spec's S-CAT-32; requires a row lock (`SELECT ... FOR UPDATE`) on the Category row inside both transactions — see Edge Cases #4 |

### Edge Cases
1. **`category_id` must resolve to an `expense`-type Category** — enforced at creation time only in this spec; since `category_id` is immutable (see Business invariants), there is no later point where this check needs to run again for an existing Budget.
2. **One active Budget per Category, covering every currency at once** — a User cannot have two separate Budgets for the same Category even to track different currencies; a second currency for an already-budgeted Category is added via `PATCH` (US-04), not a new `POST`.
3. **`period` is stored as a real column for forward-compatibility**, even though MVP accepts only `"monthly"` — any other value is a `400`, not silently coerced.
4. **The create-vs-delete race with Category (S-BUD-14) is the authoritative closure of F-04's deferred S-CAT-32** — this spec's creation flow owns the transactional guard on its own side (row lock + existence + type + non-deleted check, all inside the same transaction as the insert). **This only fully closes the race if `DELETE /categories/{id}` (F-04) also locks the Category row before its active-Budget check** — F-04's spec does not currently state that it does. Flagged as a cross-spec dependency in Open Questions #3, not assumed resolved here.

### Definition of Done
- `POST /budgets` implemented with handler-level shape validation (including per-currency entries inside `limits`) and service-level category-type, ownership, and duplicate-active-Budget checks.
- The one-active-Budget-per-`(user_id, category_id)` invariant is enforced at the data layer via a partial unique index.
- The Category-existence/type/non-deleted check inside `POST /budgets` uses a row lock in the same DB transaction as the insert, to close the race with `DELETE /categories/{id}`.
- Unit tests for S-BUD-03 through S-BUD-08 pass. Integration tests for S-BUD-01, S-BUD-02, S-BUD-09 through S-BUD-11, and the concurrency cases S-BUD-13/S-BUD-14 pass.
- No test asserts on `float`/decimal handling for any `limits` entry.

### Idempotency
Not idempotent — no idempotency key defined; each call creates a new Budget unless blocked by the duplicate-active-Budget check for the *same* category, which acts as an incidental safety net (mirrors F-04's Category-creation precedent), not a formal idempotency mechanism.

---

## US-02: View a List of Budgets [MVP]

**As a** User,
**I want** to see all my Budgets along with how much I've spent against each, broken down by currency,
**so that** I can tell at a glance which Categories I'm within or over budget on.

**API:** `GET /budgets`

### Preconditions
- Caller is authenticated.

### Main Flow
1. User opens the Budgets screen.
2. App calls `GET /budgets`.
3. System fetches all of the caller's non-deleted Budgets, each with its currency entries.
4. For each Budget's currency entry, System computes `spent` = `SUM(transactions.amount)` where `transactions.user_id = caller`, `transactions.category_id = budget.category_id`, `transactions.type = 'expense'`, `transactions.deleted_at IS NULL`, the Transaction's Wallet `currency` matches this entry's currency, and `transactions.occurred_at` falls within the current period window (the calendar month containing "now" — see Edge Cases #3). Transactions in a currency the Budget has no `limits` entry for are excluded from every Budget's spend calculation (see Edge Cases #4).
5. System derives, per currency entry, `remaining = amount_limit - spent` (may be negative) and `status = "exceeded"` if `spent > amount_limit`, else `"within"`. System derives the Budget's overall `status = "exceeded"` if **any** currency entry is exceeded, else `"within"`.
6. System returns `200` with the list, ordered `created_at ASC`.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-BUD-15 | Caller has 2 Budgets; another User has 1 Budget | Caller calls `GET /budgets` | `200`; exactly the caller's 2 returned | User isolation — ⚠️ cross-user leak would be critical |
| S-BUD-16 | Caller has 0 Budgets | Caller calls `GET /budgets` | `200`; `{ "data": [] }` | Not a `404` |
| S-BUD-17 | No/invalid JWT | Caller calls `GET /budgets` | `401 UNAUTHENTICATED` | |
| S-BUD-18 | Caller has 1 active + 1 soft-deleted Budget | Caller calls `GET /budgets` | `200`; only the 1 active Budget returned | Soft-deleted rows excluded unconditionally |
| S-BUD-19 | Caller's "Food" Budget has a `VND` limit of 1,000,000; 600,000 in expense Transactions (VND wallets) *this* calendar month and 900,000 *last* calendar month | Caller calls `GET /budgets` | `200`; `VND` entry: `spent = 600,000`, `status = "within"`; overall `status = "within"` | Only the current period's Transactions count |
| S-BUD-20 | Caller's "Food" Budget has a `VND` limit of 1,000,000; 1,200,000 in expense Transactions this month | Caller calls `GET /budgets` | `200`; `VND` entry: `spent = 1,200,000`, `remaining = -200,000`, `status = "exceeded"`; overall `status = "exceeded"` | Exceeding a limit is informational only — never blocks anything in this spec |
| S-BUD-21 | Caller's "Travel" Budget has `limits = { VND: 5,000,000, USD: 100,000 }`; `VND` spend this month is 2,000,000 (within), `USD` spend is 150,000 (exceeded) | Caller calls `GET /budgets` | `200`; `VND` entry `status = "within"`, `USD` entry `status = "exceeded"`, overall `status = "exceeded"` | Overall status is `"exceeded"` if *any* currency entry is — per-currency detail is preserved in the breakdown |
| S-BUD-22 | Caller's "Food" Budget has `limits = { VND: 1,000,000 }` only; caller also has 50,000 in `USD`-wallet expense Transactions under "Food" this month | Caller calls `GET /budgets` | `200`; the `USD` spend is **not** reflected anywhere on this Budget (no `USD` entry exists to attribute it to) | A currency with real spend but no `limits` entry is simply untracked by this Budget — not an error, not silently summed into `VND` |

### Response Shape
```json
{
  "data": [
    {
      "id": "uuid",
      "category_id": "uuid",
      "category_name": "Travel",
      "period": "monthly",
      "start_date": "2026-08-01",
      "limits": [
        { "currency": "VND", "amount_limit": 5000000, "spent": 2000000, "remaining": 3000000, "status": "within" },
        { "currency": "USD", "amount_limit": 100000, "spent": 150000, "remaining": -50000, "status": "exceeded" }
      ],
      "status": "exceeded",
      "created_at": "2026-08-01T09:00:00Z",
      "updated_at": "2026-08-01T09:00:00Z"
    }
  ]
}
```

### Edge Cases
1. **`spent` is always computed live at read time, never stored or cached on the Budget or its currency entries** — the single most consequential design decision in this spec, deliberately opposite to Wallet's stored-`balance` approach, because a Budget's spend is a derived aggregate over a *sliding, recurring* window (this month), not a value with a single atomic write path like a Transaction insert. `plan.md` must design this as one aggregate query per request (e.g. a single `GROUP BY category_id, currency` query across all the caller's Budgets), not an N+1 per-Budget-per-currency query.
2. **No pagination for MVP** — mirrors the Wallet/Category precedent; a personal User's Budget count is expected to be small (bounded by their expense-category count).
3. **Period window = the calendar month containing "now" (UTC) at request time**, regardless of `start_date`'s day-of-month — resolved design decision (see Context), not left open.
4. **A currency with real spend but no corresponding `limits` entry is excluded entirely, not aggregated into another currency's total** (S-BUD-22) — this is a direct consequence of decision #2 in Context; a User who wants that currency tracked must `PATCH` the Budget to add an entry for it.
5. **`category_name` is denormalized into the response** for direct display, avoiding a second round-trip to `GET /categories` — read-only convenience, not stored redundantly in the `budgets` table itself.

### Definition of Done
- `GET /budgets` implemented, scoped strictly to `user_id = caller`, with per-currency `spent`/`remaining`/`status` computed via a single aggregate query (not per-row, per-currency N+1).
- Unit test asserts a Budget belonging to a different `user_id` is never present in another caller's response.
- Integration tests for S-BUD-15, S-BUD-16, S-BUD-18 through S-BUD-22 pass.

### Idempotency
N/A — read-only (`GET`), naturally idempotent.

---

## US-03: View a Budget [MVP]

**As a** User,
**I want** to view the details and current per-currency status of a single Budget,
**so that** I can check exactly how much room I have left in each currency before recording another expense in that Category.

**API:** `GET /budgets/{id}`

### Preconditions
- Caller is authenticated.
- `{id}` is a UUID path parameter.

### Main Flow
1. User selects a Budget from the list.
2. App calls `GET /budgets/{id}`.
3. System fetches the Budget, verifies it is non-deleted and `user_id = caller`.
4. System computes each currency entry's `spent`/`remaining`/`status` and the overall `status` exactly as in US-02, steps 4–5.
5. System returns `200` with the Budget object (same shape as the list item).

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-BUD-23 | Budget exists, owned by caller | Caller calls `GET /budgets/{id}` | `200`; Budget object with computed per-currency status returned | Happy path |
| S-BUD-24 | Budget exists, owned by a *different* user | Caller calls `GET /budgets/{id}` with that Budget's UUID | `403 BUDGET_ACCESS_DENIED` | Ownership check — not `404`, mirroring the F-03/F-04 unguessable-UUID precedent |
| S-BUD-25 | No Budget with that ID exists (or it is soft-deleted) | Caller calls `GET /budgets/{id}` | `404 BUDGET_NOT_FOUND` | Distinct from S-BUD-24 |
| S-BUD-26 | `{id}` path segment is not a valid UUID | Caller calls `GET /budgets/abc` | `400 INVALID_INPUT` | Handler-level shape validation, before any DB lookup |

### Edge Cases
1. **Same ownership/existence disclosure pattern as Wallet and Category** (`403` for someone else's, `404` for genuinely absent) — no new precedent introduced here.
2. **Soft-deleted Budget accessed by its own owner** is treated identically to not-found (`404`) — no "restore" flow in this spec.

### Definition of Done
- `GET /budgets/{id}` implemented with ownership check returning `403` for cross-user access and `404` for absent/deleted Budgets.
- Unit tests for S-BUD-24 through S-BUD-26 pass. Integration test for S-BUD-23 passes.

### Idempotency
N/A — read-only (`GET`), naturally idempotent.

---

## US-04: Update a Budget

**As a** User,
**I want** to change the currency-scoped spending limits on an existing Budget — add, remove, or adjust any currency's limit,
**so that** I can adjust my plan without losing the Category's Budget history.

**API:** `PATCH /budgets/{id}`

### Preconditions
- Caller is authenticated and owns the Budget (`user_id = caller`).
- Request body: `{ limits: { [currency]: integer, ... } }` — **`category_id`, `period`, and `start_date` are never accepted by this endpoint** (see Edge Cases). `limits` must be non-empty.

### Main Flow
1. User edits the Budget's limits from a Budget Details screen (adds a currency, removes one, or changes an amount).
2. System validates shape: `limits` present, non-empty, every key a currency in `{VND, USD}`, every value a positive non-zero integer (handler-level) — same validation as US-01 step 2.
3. System verifies ownership (`user_id = caller`, `deleted_at IS NULL`).
4. System **replaces the Budget's entire set of currency entries** with exactly what was submitted — this is a full replacement, not a per-key merge (see Edge Cases #1).
5. System applies the update, `updated_at = NOW()`.
6. System returns `200` with the updated Budget object, including freshly recomputed per-currency `spent`/`remaining`/`status` and overall `status` against the *new* `limits`.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-BUD-27 | Budget exists, owned by caller, `limits = { VND: 1,000,000 }` | Caller submits `{ "limits": { "VND": 1500000 } }` | `200`; `VND` entry updated to 1,500,000; `category_id`/`period`/`start_date` unchanged | Happy path — adjust an existing currency |
| S-BUD-28 | Budget exists, owned by caller, `limits = { VND: 1,000,000 }` | Caller submits `{ "limits": { "VND": 1000000, "USD": 50000 } }` | `200`; Budget now tracks both `VND` and `USD` | Happy path — add a new currency |
| S-BUD-29 | Budget exists, owned by caller, `limits = { VND: 1,000,000, USD: 50000 }` | Caller submits `{ "limits": { "VND": 1000000 } }` | `200`; the `USD` entry is removed entirely — that currency is no longer tracked by this Budget, regardless of any `USD` spend this period | ⚠️ Full-replace semantics, not a merge — see Edge Cases #1 |
| S-BUD-30 | Budget exists, owned by caller | Caller submits `{ "limits": {} }` (empty object) | `400 INVALID_INPUT` | A Budget can never end up with zero currency entries — delete the Budget instead (US-05) |
| S-BUD-31 | Budget exists, owned by caller | Caller submits `{ "category_id": "<other-uuid>" }` | `400 INVALID_INPUT` (unknown/disallowed field) | ⚠️ `category_id` must be structurally rejected, mirroring the F-03 `balance`-field and F-04 `type`-field precedents |
| S-BUD-32 | Budget exists, owned by caller | Caller submits `{ "limits": { "VND": 0 } }` | `400 INVALID_INPUT` | Same per-entry validation as create |
| S-BUD-33 | Budget exists, owned by caller, `VND` `spent` this month is already 1,200,000 | Caller submits `{ "limits": { "VND": 1000000 } }` (below current spend) | `200`; update succeeds, `VND` entry `status` flips to `"exceeded"` immediately | Lowering a limit below current spend is allowed — informational only, never blocked |
| S-BUD-34 | Budget exists, owned by a *different* user | Caller submits any valid update | `403 BUDGET_ACCESS_DENIED` | Ownership check |
| S-BUD-35 | No Budget with that ID (or soft-deleted) | Caller submits an update | `404 BUDGET_NOT_FOUND` | |
| S-BUD-36 | Budget exists, owned by caller | Caller submits `{}` (empty body — no `limits` key at all) | `400 INVALID_INPUT` | Nothing to update — client mistake, not a no-op `200` |

### Edge Cases
1. **`limits` is a full replacement, not a per-currency merge** (S-BUD-29) — submitting `{ "limits": { "VND": X } }` on a Budget that currently tracks both `VND` and `USD` **removes** the `USD` entry. This is a deliberate simplicity choice over merge semantics, which would need a separate convention for "delete this one currency" (e.g. a null value) — full-replace avoids that ambiguity at the cost of requiring the client to resend every currency it wants to keep.
2. **`category_id`, `period`, and `start_date` are structurally excluded from the update DTO**, not merely validated away — mirrors the F-03/F-04 field-exclusion precedent. Changing what a Budget tracks or how its period is defined after the fact would misrepresent any spend-vs-limit history already surfaced to the User for that Budget ID; a User who wants a different Category/period must delete this Budget and create a new one.
3. **Lowering any currency's limit below that currency's current-period `spent` is allowed and does not error** (S-BUD-33) — a Budget is a plan the User can tighten retroactively-in-effect at any time; MVP has no "confirm you're about to be over budget" warning step (client-side UX concern, not an API validation).
4. **Removing a currency that already has spend recorded against it this period (S-BUD-29) is allowed unconditionally** — the removed currency's historical Transactions are untouched; the Budget simply stops reporting a status for that currency going forward. See Open Questions #4 for whether this should instead be blocked or warned about.

### Definition of Done
- `PATCH /budgets/{id}` implemented; request DTO has no `category_id`/`period`/`start_date` fields at the type level; `limits` is validated as a non-empty, per-currency map with full-replace semantics.
- Unit tests for S-BUD-30 through S-BUD-32, S-BUD-34 through S-BUD-36 pass. Integration tests for S-BUD-27 through S-BUD-29, S-BUD-33 pass.

### Idempotency
Idempotent in effect — re-submitting the same `{ limits }` payload repeatedly converges to the same end state, though there is no explicit idempotency key.

---

## US-05: Delete a Budget

**As a** User,
**I want** to remove a Budget I no longer need,
**so that** my Budgets list stays relevant to what I'm actually tracking.

**API:** `DELETE /budgets/{id}`

### Preconditions
- Caller is authenticated and owns the Budget (`user_id = caller`).

### Main Flow
1. User taps "Delete" on one of their own Budgets.
2. System verifies the Budget is non-deleted and `user_id = caller`.
3. System soft-deletes the Budget (`deleted_at = NOW()`), removing all of its currency entries from view together with it — **no dependency check is required** (nothing in the MVP schema references `budgets.id`; unlike Category, no other table has a foreign key to it).
4. System returns `200` confirming deletion.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-BUD-37 | Budget exists, owned by caller | Caller calls `DELETE /budgets/{id}` | `200`; Budget (and all its currency entries) soft-deleted; no longer appears in `GET /budgets` | Happy path — unconditional once ownership passes |
| S-BUD-38 | Budget exists, owned by a *different* user | Caller calls `DELETE /budgets/{id}` | `403 BUDGET_ACCESS_DENIED` | Ownership check |
| S-BUD-39 | No Budget with that ID (or already soft-deleted) | Caller calls `DELETE /budgets/{id}` | `404 BUDGET_NOT_FOUND` | Deleting an already-deleted Budget is not idempotent-success — it's a `404` |

### Edge Cases
1. **No blocking dependency check needed** — unlike F-04's Category delete (which must check for active Budgets referencing it), nothing in the current MVP schema has a foreign key to `budgets.id`, so deletion here is unconditional once the ownership/existence check passes.
2. **Soft delete only — never a hard delete**, consistent with CLAUDE.md's "không hard delete financial records" rule, even though a Budget itself is a plan, not a money movement — it is treated as financial-adjacent data for audit consistency with Wallet/Category/Transaction.
3. **Deleting a Budget does not touch the Transactions in its Category** — historical Transactions remain fully intact and reportable; only the Budget's own tracking/limits disappear.

### Definition of Done
- `DELETE /budgets/{id}` implemented as an unconditional soft-delete once ownership/existence checks pass.
- Unit tests for S-BUD-38, S-BUD-39 pass. Integration test for S-BUD-37 passes.

### Idempotency
**Not idempotent** — calling `DELETE` twice on the same Budget returns `200` the first time and `404 BUDGET_NOT_FOUND` the second time, mirroring the F-04 Category-delete precedent.

---

## Out of Scope (Feature F-05)

- **Budget periods other than `"monthly"`** (e.g. weekly, yearly) — the `period` column exists for forward-compatibility but only `"monthly"` is accepted/implemented in MVP. See Open Questions #1.
- **Wallet-scoped Budgets** — resolved (see Context, decision #1): a Budget tracks spend across *all* of the caller's Wallets for a given Category, not one specific Wallet. `SRS.md`/`SDS.md` are updated to match.
- **Automatic Notification/alert when a Budget threshold is crossed** — resolved as an asynchronous/background responsibility (see Context, decision #4), owned by F-10, not triggered synchronously by this spec or by F-06 Transaction creation. The scheduling/cadence detail belongs to F-10's own spec (see Open Questions #5).
- **Partial/percentage-based Budget alerts** (e.g. "notify at 80% of limit") — Release 1+ concern.
- **Budget history / month-over-month comparison** (e.g. "you exceeded this Budget 2 months in a row") — belongs to F-07 Financial Reporting.
- **Multiple simultaneous Budgets per Category** (e.g. one monthly + one yearly) — blocked by the one-active-Budget-per-Category invariant in MVP; see Open Questions #1.
- **Restricting a Budget's currencies to Wallets the caller actually owns** — a caller can set a `USD` limit even with zero `USD` Wallets; see Open Questions #6.
- **Admin visibility into other Users' Budgets** — no such endpoint exists in this spec, matching every other MVP feature.
- **A limit on the number of Budgets per User, or on the number of currencies per Budget** — no cap enforced beyond the 2-currency ceiling implied by the `{VND, USD}` allow-list itself (mirrors F-03/F-04 precedent for no per-user caps).

## Open Questions

1. **Future multi-period support**: if Release 1+ needs a User to hold, say, both a monthly and a yearly Budget for the same Category concurrently, the current one-active-Budget-per-`(user_id, category_id)` unique index would need to become `(user_id, category_id, period)` instead. Flagging now so the MVP schema choice isn't a silent migration blocker later.
2. **`amount_limit` ceiling (per currency entry)**: no maximum value is defined, matching the no-cap precedent from F-03 (wallet count) and F-04 (category count). Low priority, but worth an explicit "no limit for MVP" sign-off rather than silence.
3. **Cross-spec dependency for the create-vs-delete race (S-BUD-14)**: this spec's `POST /budgets` guards its own side of the race with a row lock on the Category row, but full closure requires `DELETE /categories/{id}` (F-04) to acquire that same lock before its active-Budget check runs. F-04's spec (US-05 Edge Cases #4) explicitly deferred this to whichever spec implements Budget creation — this spec accepts that responsibility, but the F-04 delete flow itself may need a corresponding update (or confirmation it already locks) before this scenario is truly closed end-to-end. **Blocking for `plan.md`** — verify or amend the F-04 delete implementation as part of this feature's technical design, not silently assume it already locks.
4. **Removing a currency with live spend via `PATCH` (S-BUD-29)**: this spec allows it unconditionally (Edge Cases #4 of US-04). An alternative, stricter design would block the removal (or require a confirmation step) if that currency's current-period `spent > 0`, to avoid a User accidentally losing visibility into an over-budget currency. Recommend the unconditional-allow behavior already specified, for consistency with the "lowering a limit below spend is allowed" precedent, but flagging for explicit product sign-off since it's a new interaction this redesign introduces.
5. **F-10's own trigger cadence**: this spec only commits to "Budget-crossing Notifications are not synchronous with Transaction creation" (Context, decision #4). The actual schedule (e.g. every N minutes vs. a nightly batch) and its acceptable latency are undefined here and belong entirely to F-10's own spec.
6. **Currency restricted to the caller's actual Wallets**: this spec allows a Budget to declare a limit in a currency the caller has no Wallet in at all (e.g. a `USD` limit with zero `USD` Wallets). No validation guards against this in MVP — flagged as a low-priority UX gap, not a data-integrity one.
