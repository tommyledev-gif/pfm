# Feature Spec: F-06 Transaction Management (MVP)

> Source: `SRS.md` Feature-06 / FR-02 (US-01 already has full Gherkin in SRS — formalized and extended below), `SDS.md` §5.6 (US-06-01 Create a Transaction for a Wallet), `CLAUDE.md` MVP Features table
> Status: MVP — next feature per CLAUDE.md MVP ordering (F-03 → F-04 → F-05 → **F-06**); this is the core financial-activity feature the rest of the MVP depends on: F-05 Budget's `spent` is computed live from this table (already resolved in `specs/budget-management/spec.md`), F-07 Financial Reporting and F-10 Notification Handling cannot be specced meaningfully without Transactions existing, and F-03's own `PATCH /wallets/{id}` currency-lock check (`409 CURRENCY_LOCKED`) is an explicitly deferred implementation task — `backend/internal/service/wallet_service.go` comment: *"Currency-lock ... is intentionally unimplemented — the transactions table doesn't exist yet (F-06 unbuilt ... tracked as **WAL-T14**)"* — this spec closes that dependency.
> Related: [F-03 Wallet Management](../wallet-management/spec.md) (`transactions.wallet_id` FK; balance mutation invariant), [F-04 Category Management](../category-management/spec.md) (`transactions.category_id` FK; type-matching rule deferred here per that spec's Open Question #7), [F-05 Budget Management](../budget-management/spec.md) (reads this table live for `spent`, no write-path coupling)

## Context

Phase 0 (User Management + System Security), F-03 (Wallet Management), F-04 (Category Management), and F-05 (Budget Management) are implemented. Transaction Management is the next feature to spec, per the CLAUDE.md MVP Features table ordering and because it is the one domain object every other MVP feature either depends on or reads from: a Wallet's `balance` only moves via a Transaction insert (CLAUDE.md: "Wallet balance update và transaction insert luôn trong cùng 1 DB transaction"), and a Budget's `spent` is computed live from this table at read time (resolved design decision in `specs/budget-management/spec.md`).

A Transaction is a single income or expense event, per SRS FR-02. It always belongs to exactly one Wallet and one Category, and to the User who owns that Wallet (SDS §2 Domain Model).

**Resolved design decisions** (made explicit here because naive reuse of a single rule across all five operations would produce incorrect or surprising behavior):

1. **Transaction currency is inherited from its Wallet — there is no separate `currency` field on a Transaction.** A Transaction can only be recorded against a Wallet the caller owns, and that Wallet has exactly one currency (F-03); mirrors how Budget's per-currency `spent` aggregation already assumes "the Transaction's Wallet currency" (`specs/budget-management/spec.md` US-02 step 4) without Transaction carrying its own currency field.
2. **`amount` is always a positive magnitude; `type` determines the sign of the wallet-balance effect.** An `expense` Transaction decreases wallet balance by `amount`; an `income` Transaction increases it by `amount`. There is no negative `amount` — SRS's own scenario ("Reject transaction when amount is invalid... must be greater than 0") is authoritative.
3. **The insufficient-balance floor (SRS's explicit "MVP rule": an expense that would take a Wallet's balance below zero is rejected) applies only to `POST /transactions` (US-01) — never to `PATCH /transactions/{id}` (US-04) or `DELETE /transactions/{id}` (US-05).** Update and delete are *corrections to history*, and blocking a correction with the very floor it might be trying to fix would leave a User unable to fix a data-entry mistake. A wallet balance recomputed as a side effect of editing/removing a historical Transaction is allowed to land at zero or below — this mirrors how real ledgers treat a corrected/removed historical entry as retroactively revealing an already-true overspend, rather than a new prospective overspend. This is a deliberate, non-obvious departure from "reuse the same guard everywhere" — flagged for explicit product sign-off in Open Questions #1, since an alternative (warn-but-allow, or block with an override) is equally defensible.
4. **Enforcing the balance floor at the data layer, not just in the service.** Mirroring the project's established pattern (F-03's one-default-wallet unique index, F-05's one-active-budget unique index) of putting concurrency-sensitive invariants in the DB rather than trusting a check-then-write race in application code, `POST /transactions`'s wallet-balance decrement is implemented as a single atomic conditional `UPDATE ... SET balance = balance - $amount WHERE ... AND balance >= $amount RETURNING *` — zero rows affected (after ownership/existence are already confirmed) is the authoritative signal for `INSUFFICIENT_BALANCE`, closing the race between two concurrent expense requests against the same Wallet (see US-01 Edge Cases #2 and S-TRX-18).
5. **`wallet_id` and `type` are immutable after creation.** Changing which Wallet a Transaction belongs to, or flipping it between income/expense, would require reversing its effect on one Wallet and applying a differently-signed effect on another (or the same) Wallet — genuinely more complex than a single balance-delta reconciliation and not required by any SRS/SDS scenario. A User who recorded a Transaction against the wrong Wallet or with the wrong type must delete it and create a new one (US-04 Edge Cases #1). This mirrors F-05's `category_id`-immutable and F-04's `type`-immutable precedents.

Actors:
- **User** — any `active` user (`role = admin` or `member`); Transactions are personal, not shared. There is no admin-facing transaction-management UI in MVP.

## Preconditions (feature-level)

- Caller holds a valid access JWT (`role` irrelevant — every active user manages their own Transactions identically).
- `transactions` table exists per the schema below (**new migration required** — does not yet exist; current migrations are `001_init.sql` through `007_budgets.sql`).
- At least one Wallet (F-03) and one Category (F-04) the caller can see already exist, per each operation's own checks.

### Domain Fields (conceptual — full schema/index design belongs in `plan.md`)

This extends the `transactions` entity already named in CLAUDE.md's Core DB Schema; this spec does not restate its column-level definition beyond what's needed for the business rules below.

| Field | Meaning |
|---|---|
| `id` | Unique identifier |
| `user_id` | Owner — denormalized from `wallet_id`'s owner for direct query filtering (CLAUDE.md user-isolation rule: every query must have `AND user_id = $n`), not an independent source of truth |
| `wallet_id` | The Wallet this Transaction moves money in/out of; **immutable after creation** (see Context #5) |
| `category_id` | The Category this Transaction is classified under; **mutable** (US-04), but any new value must still match `type` (see Business invariants) |
| `amount` | BIGINT integer cents, **always positive** (> 0) — see Context #2 |
| `type` | `income` \| `expense`; **immutable after creation** (see Context #5) |
| `note` | Optional free-text, ≤ 500 chars (**explicit assumption** — no length limit is specified anywhere in SRS/SDS/CLAUDE.md; mirrors the spirit of F-03's 100-char wallet-name cap, sized up for a longer free-text field; see Open Questions #4) |
| `occurred_at` | `TIMESTAMPTZ` — when the financial event happened (client-supplied, defaults to "now" if omitted); distinct from `created_at` (when the row was inserted) — see Edge Cases (US-02 #1) for why this distinction matters for list ordering |
| `created_at` / `updated_at` | Audit timestamps |
| `deleted_at` | Soft-delete marker; `NULL` while active |

**Business invariant**: `wallet_id` must reference a Wallet owned by the caller (`wallets.user_id = caller`), non-deleted, at creation time. Immutable thereafter (Context #5).

**Business invariant**: `category_id` must reference a Category visible to the caller (system-defined, i.e. `user_id IS NULL`, or `user_id = caller`), non-deleted, at creation time **and** at every update that changes it (US-04).

**Business invariant**: `category_id`'s `type` must exactly match the Transaction's own `type` — an `expense` Transaction can only be classified under an `expense` Category, an `income` Transaction only under an `income` Category. This is the cross-feature rule F-04's spec (Open Questions #7) explicitly deferred to whichever spec implements Transaction creation; this spec accepts that responsibility. Re-checked on any `category_id` change in US-04, since `type` itself never changes but the *category* being pointed to can.

**Business invariant**: a Category soft-deleted *after* a Transaction was created against it remains referenced by that historical Transaction unchanged (mirrors F-04 S-CAT-28 — deletion never cascades to or blocks on historical Transactions). Consequently, **read responses (US-02/US-03) must resolve `category_name` via a join that does not filter out soft-deleted Categories** — unlike Budget's `category_name` denormalization (`specs/budget-management/spec.md` US-02 Edge Cases #5), which can assume an always-active Category because F-04's `409 CATEGORY_IN_USE` guard prevents deleting a Category with an active Budget. A Transaction has no equivalent guard, so its Category can legitimately be soft-deleted while still needing to display a name.

⚠️ **Money rule**: `amount` is integer cents — never a float or decimal, in transit or storage. No cross-currency conversion is performed anywhere in this feature; a Transaction's amount is always in its Wallet's currency.

---

## US-01: Create a Transaction for a Wallet [MVP]

**As a** User,
**I want** to record an income or expense Transaction against one of my Wallets,
**so that** I can track my income and expenses and keep the Wallet's balance accurate.

**API:** `POST /transactions`

### Preconditions
- Caller is authenticated.
- Request body: `{ wallet_id: uuid, category_id: uuid, amount: integer, type: "income"|"expense", occurred_at?: string (ISO 8601), note?: string }`. `occurred_at` defaults to "now" (server UTC) if omitted.

### Main Flow
1. User submits the transaction creation form for a specific Wallet (type, amount, category picker, date, optional note).
2. System validates shape: `wallet_id`, `category_id`, `amount`, and `type` are all present; `wallet_id`/`category_id` are UUIDs; `amount` is a positive non-zero integer; `type` is exactly `"income"` or `"expense"`; `occurred_at` (if present) is a valid ISO 8601 timestamp; `note` (if present) is ≤ 500 chars (handler-level).
3. System verifies the Wallet exists, is non-deleted, and `user_id = caller` (service-level).
4. System verifies the Category exists, is visible to the caller (system-defined or `user_id = caller`), and is non-deleted (service-level).
5. System verifies `category.type == request.type` (service-level).
6. **If `type = "expense"`**: System atomically decrements the Wallet's `balance` by `amount`, conditioned on `balance >= amount`, in the same DB transaction as the Transaction insert (service-level; see Context #4). **If `type = "income"`**: System atomically increments the Wallet's `balance` by `amount` in the same DB transaction — no floor check applies.
7. System creates the `transactions` row (`user_id` denormalized from the Wallet's owner).
8. System returns `201` with the created Transaction and the Wallet's new `balance`.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-TRX-01 | Caller's Wallet "Main Wallet" (VND) has balance 1,000,000; caller has an `expense` category "Food" | Caller creates `{ wallet_id: <Main>, category_id: <Food>, amount: 200000, type: "expense", occurred_at: "2025-12-23" }` | `201`; Transaction created; Wallet balance decreases to 800,000 | Happy path — expense (mirrors SRS Feature-06 US-01) |
| S-TRX-02 | Caller's Wallet "Main Wallet" has balance 1,000,000; caller has an `income` category "Salary" | Caller creates `{ wallet_id: <Main>, category_id: <Salary>, amount: 500000, type: "income" }` | `201`; Transaction created; Wallet balance increases to 1,500,000 | Happy path — income |
| S-TRX-03 | — | Caller submits without `wallet_id` | `400 INVALID_INPUT` | Validation error — required field missing, before any existence lookup |
| S-TRX-04 | — | Caller submits without `category_id` | `400 INVALID_INPUT` | Validation error — required field missing, before any existence lookup |
| S-TRX-05 | — | Caller submits without `amount` | `400 INVALID_INPUT` | Validation error |
| S-TRX-06 | — | Caller submits `{ amount: -10000, ... }` | `400 INVALID_INPUT` | ⚠️ Money rule — amount is always positive |
| S-TRX-07 | — | Caller submits `{ amount: 0, ... }` | `400 INVALID_INPUT` | Zero is not a valid transaction |
| S-TRX-08 | — | Caller submits `{ amount: 10.5, ... }` (decimal) | `400 INVALID_INPUT` | ⚠️ Money rule — integer cents only |
| S-TRX-09 | Caller's Wallet has balance 1,000,000 | Caller submits `{ amount: 2000000, type: "expense", ... }` | `409 INSUFFICIENT_BALANCE`; Wallet balance remains 1,000,000; no Transaction created | ⚠️ SRS-mandated MVP rule — mirrors SRS Feature-06 US-01's exact scenario |
| S-TRX-10 | `wallet_id` does not exist (or is soft-deleted) | Caller creates a Transaction against it | `404 WALLET_NOT_FOUND` | Same existence semantics as F-03 |
| S-TRX-11 | `wallet_id` belongs to a *different* user | Caller creates a Transaction against it | `403 WALLET_ACCESS_DENIED` | Ownership check, reuses F-03's rule |
| S-TRX-12 | `category_id` does not exist (or is soft-deleted) | Caller creates a Transaction against it | `404 CATEGORY_NOT_FOUND` | Same existence semantics as F-04/F-05 |
| S-TRX-13 | `category_id` belongs to a *different* user (private category) | Caller creates a Transaction against it | `403 CATEGORY_ACCESS_DENIED` | Ownership check, reuses F-04's rule |
| S-TRX-14 | Caller has an `income` category "Salary" | Caller submits `{ category_id: <Salary>, type: "expense", ... }` | `422 CATEGORY_TYPE_MISMATCH` | ⚠️ Business rule — a Transaction's `type` must match its Category's `type` |
| S-TRX-15 | — | Caller submits `{ type: "transfer" }` (not a valid enum value) | `400 INVALID_INPUT` | Validation error |
| S-TRX-16 | No/invalid JWT | Caller calls `POST /transactions` | `401 UNAUTHENTICATED` | Authentication failure |
| S-TRX-17 | — | Caller omits `occurred_at` | `201`; `occurred_at` defaults to the server's current UTC timestamp | Happy path variant |
| S-TRX-18 | Caller's Wallet has balance exactly 500,000; two `expense` requests for 500,000 each against the same Wallet arrive concurrently | Both requests race | Exactly one `201` (balance settles at 0), the other `409 INSUFFICIENT_BALANCE` | ⚠️ Data-integrity critical — same class of guard as F-03 S-WAL-10 / F-05 S-BUD-13, enforced by the atomic conditional `UPDATE` (Context #4) |
| S-TRX-19 | — | Caller submits a `note` of 600 characters | `400 INVALID_INPUT` | Validation error — see Open Questions #4 on the exact limit |

### Edge Cases
1. **The insufficient-balance floor applies only here, never to Update/Delete** (Context #3) — the single most consequential and non-obvious design decision in this spec; do not generalize the guard to US-04/US-05 without re-reading that rationale.
2. **The wallet-balance mutation and the Transaction insert are one atomic DB transaction** (CLAUDE.md rule) — a failure after the balance update but before the insert (or vice versa) must roll back both; there is no window where a Wallet's balance reflects a Transaction that doesn't exist, or vice versa.
3. **Zero rows affected by the conditional balance-decrement `UPDATE` is the authoritative signal for `INSUFFICIENT_BALANCE`**, *given that Wallet existence/ownership were already confirmed in steps 3–4* — this closes the race in S-TRX-18 without a separate `SELECT ... FOR UPDATE` lock, following the same "atomic conditional UPDATE as the source of truth" pattern already used by F-03's default-wallet swap and F-05's active-Budget uniqueness.
4. **`amount` is validated as a positive integer regardless of `type`** — the sign of the wallet-balance effect comes entirely from `type`, never from the sign of `amount` itself (Context #2); there is no such thing as a "negative expense" to represent a refund in this spec (see Out of Scope).

### Definition of Done
- `POST /transactions` implemented with handler-level shape validation and service-level Wallet/Category ownership, existence, and type-match checks.
- The wallet-balance decrement for `expense` Transactions is a single atomic conditional `UPDATE` (`balance >= amount`) in the same DB transaction as the Transaction insert; `income` Transactions increment unconditionally in the same transaction.
- Unit tests for S-TRX-03 through S-TRX-08, S-TRX-14, S-TRX-15, S-TRX-19 pass. Integration tests for S-TRX-01, S-TRX-02, S-TRX-09 through S-TRX-13, S-TRX-17, and the concurrency case S-TRX-18 pass.
- No test asserts on `float`/decimal handling for `amount`.

### Idempotency
**Not idempotent — no idempotency key defined.** Flagged with elevated urgency compared to F-03/F-05's equivalent gaps (Open Questions there), because a duplicate submission here doesn't just create an extra reference row — it doubly mutates a Wallet's real money balance (e.g. a double-tap "Save" on an expense debits the Wallet twice). See Open Questions #2 for whether this justifies an `Idempotency-Key` header before Release 1, ahead of the other MVP features.

---

## US-02: View a List of Transactions [MVP]

**As a** User,
**I want** to see my Transactions, optionally filtered by Wallet, Category, type, or date range,
**so that** I can review my financial activity (SRS BF-05: "views the list of Transactions associated with a Wallet").

**API:** `GET /transactions`

### Preconditions
- Caller is authenticated.

### Main Flow
1. User opens a Wallet's Transaction history (or a general Transactions view).
2. App calls `GET /transactions` with optional query params: `wallet_id`, `category_id`, `type`, `from` (occurred_at ≥), `to` (occurred_at ≤), `cursor`, `limit`.
3. System validates any provided `wallet_id`/`category_id` belongs to (or is visible to) the caller; validates `from ≤ to` if both present (handler/service-level).
4. System fetches the caller's non-deleted Transactions matching the filters, cursor-paginated, ordered `occurred_at DESC, id DESC`.
5. System returns `200` with the page of Transactions (each including denormalized `wallet_name` and `category_name`) and a `next_cursor`.

### Query Parameters

| Param | Type | Default | Notes |
|---|---|---|---|
| `wallet_id` | uuid | — | Must belong to caller if present, else `403 WALLET_ACCESS_DENIED` |
| `category_id` | uuid | — | Must be visible to caller if present, else `403 CATEGORY_ACCESS_DENIED` |
| `type` | `income`\|`expense` | — | `400 INVALID_INPUT` if any other value |
| `from` / `to` | ISO 8601 date/datetime | — | Filters on `occurred_at`; `400 INVALID_INPUT` if `from > to` |
| `cursor` | string | — | Opaque, from `pagination.next_cursor` of the previous response — encodes `{occurred_at, id}` of the last item (see Edge Cases #1), not `{created_at, id}` |
| `limit` | int | 20 | Max 100 — same convention as F-01's `GET /admin/users` |

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-TRX-20 | Caller has 5 Transactions; another User has 3 | Caller calls `GET /transactions` | `200`; exactly the caller's 5 returned | User isolation — ⚠️ cross-user leak would be critical |
| S-TRX-21 | Caller has 0 Transactions | Caller calls `GET /transactions` | `200`; `{ "data": [], "next_cursor": null }` | Not a `404` |
| S-TRX-22 | No/invalid JWT | Caller calls `GET /transactions` | `401 UNAUTHENTICATED` | |
| S-TRX-23 | Caller has 1 active + 1 soft-deleted Transaction | Caller calls `GET /transactions` | `200`; only the 1 active Transaction returned | Soft-deleted rows excluded unconditionally |
| S-TRX-24 | Caller has Transactions across 2 Wallets | Caller calls `GET /transactions?wallet_id=<W1>` | `200`; only W1's Transactions returned | Filter — happy path |
| S-TRX-25 | `wallet_id` query param references a Wallet owned by a *different* user | Caller calls `GET /transactions?wallet_id=<other's>` | `403 WALLET_ACCESS_DENIED` | Same ownership semantics as directly fetching that Wallet |
| S-TRX-26 | Caller has both `income` and `expense` Transactions | Caller calls `GET /transactions?type=expense` | `200`; only `expense` Transactions returned | Filter — happy path |
| S-TRX-27 | Caller has Transactions on 2025-12-01 and 2025-12-23 | Caller calls `GET /transactions?from=2025-12-20&to=2025-12-31` | `200`; only the 2025-12-23 Transaction returned | Date-range filter on `occurred_at` |
| S-TRX-28 | — | Caller calls `GET /transactions?from=2025-12-31&to=2025-12-01` (reversed range) | `400 INVALID_INPUT` | `from` must not be after `to` |
| S-TRX-29 | Caller has 25 Transactions | Caller calls `GET /transactions?limit=10` | `200`; 10 items, `next_cursor` set; following the cursor returns the next 10, then the last 5 | Pagination — happy path |
| S-TRX-30 | A Transaction's Category was soft-deleted after the Transaction was created | Caller calls `GET /transactions` | `200`; that Transaction still appears with its (now-historical) `category_name` resolved, not `null` or omitted | ⚠️ See Business invariants — the join must not filter on the Category's `deleted_at` |

### Response Shape
```json
{
  "data": [
    {
      "id": "uuid",
      "wallet_id": "uuid",
      "wallet_name": "Main Wallet",
      "category_id": "uuid",
      "category_name": "Food",
      "amount": 200000,
      "type": "expense",
      "note": "Lunch",
      "occurred_at": "2025-12-23T12:00:00Z",
      "created_at": "2025-12-23T12:01:00Z",
      "updated_at": "2025-12-23T12:01:00Z"
    }
  ],
  "next_cursor": "eyJvY2N1cnJlZF9hdCI6Li4ufQ=="
}
```

### Edge Cases
1. **Cursor/ordering key is `occurred_at`, not `created_at`** — deliberately different from every prior MVP list endpoint (F-01's admin user list, which orders/paginates on `created_at`). A Transaction's natural sort is "when the money moved," not "when the row was inserted" — a backdated Transaction entered today for last week must appear in last-week's position, not jump to the top. Query: `WHERE occurred_at < $cursor_ts OR (occurred_at = $cursor_ts AND id < $cursor_id) ORDER BY occurred_at DESC, id DESC LIMIT $limit`.
2. **No cap on date-range width** — a caller can request `from`/`to` spanning years; still subject to the same `limit`/cursor pagination as an unfiltered request. No separate "report" aggregation happens here (that's F-07).
3. **Filtering by `category_id` includes Transactions whose Category is now soft-deleted**, exactly like the unfiltered case (S-TRX-30) — the filter itself doesn't re-check the Category's current `deleted_at`, only that it was a valid, visible Category *at the time the filter's ownership check ran* against the query param.

### Definition of Done
- `GET /transactions` implemented, strictly scoped to `user_id = caller`, with `wallet_id`/`category_id`/`type`/`from`/`to` filters and `occurred_at`-keyed cursor pagination.
- Unit test asserts a Transaction belonging to a different `user_id` is never present in another caller's response.
- Integration tests for S-TRX-20, S-TRX-21, S-TRX-23 through S-TRX-30 pass.

### Idempotency
N/A — read-only (`GET`), naturally idempotent.

---

## US-03: View a Transaction [MVP]

**As a** User,
**I want** to view the full details of a single Transaction,
**so that** I can confirm exactly what was recorded before editing or deleting it.

**API:** `GET /transactions/{id}`

### Preconditions
- Caller is authenticated.
- `{id}` is a UUID path parameter.

### Main Flow
1. User selects a Transaction from a list.
2. App calls `GET /transactions/{id}`.
3. System fetches the Transaction, verifies it is non-deleted and `user_id = caller`.
4. System returns `200` with the Transaction object (same shape as the list item).

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-TRX-31 | Transaction exists, owned by caller | Caller calls `GET /transactions/{id}` | `200`; Transaction object returned | Happy path |
| S-TRX-32 | Transaction exists, owned by a *different* user | Caller calls `GET /transactions/{id}` with that Transaction's UUID | `403 TRANSACTION_ACCESS_DENIED` | Ownership check — not `404`, mirroring the F-03/F-04/F-05 unguessable-UUID precedent |
| S-TRX-33 | No Transaction with that ID exists (or it is soft-deleted) | Caller calls `GET /transactions/{id}` | `404 TRANSACTION_NOT_FOUND` | Distinct from S-TRX-32 |
| S-TRX-34 | `{id}` path segment is not a valid UUID | Caller calls `GET /transactions/abc` | `400 INVALID_INPUT` | Handler-level shape validation, before any DB lookup |

### Edge Cases
1. **Same ownership/existence disclosure pattern as Wallet/Category/Budget** (`403` for someone else's, `404` for genuinely absent) — no new precedent introduced here.
2. **Soft-deleted Transaction accessed by its own owner** is treated identically to not-found (`404`) — no "restore" flow in this spec.

### Definition of Done
- `GET /transactions/{id}` implemented with ownership check returning `403` for cross-user access and `404` for absent/deleted Transactions.
- Unit tests for S-TRX-32 through S-TRX-34 pass. Integration test for S-TRX-31 passes.

### Idempotency
N/A — read-only (`GET`), naturally idempotent.

---

## US-04: Update a Transaction

**As a** User,
**I want** to correct a Transaction's amount, Category, date, or note,
**so that** I can fix a data-entry mistake without deleting and recreating it.

**API:** `PATCH /transactions/{id}`

### Preconditions
- Caller is authenticated and owns the Transaction (`user_id = caller`).
- Request body: `{ amount?: integer, category_id?: uuid, occurred_at?: string, note?: string }` — **`wallet_id` and `type` are never accepted by this endpoint** (see Context #5 and Edge Cases #1). At least one field must be present.

### Main Flow
1. User edits a Transaction's amount, Category, date, and/or note from a Transaction Details screen.
2. System validates shape: at least one of `amount`/`category_id`/`occurred_at`/`note` present; same field-level rules as US-01 (handler-level).
3. System verifies ownership (`user_id = caller`, `deleted_at IS NULL`).
4. **If `category_id` is being changed**: System verifies the new Category exists, is visible to the caller, is non-deleted, and its `type` matches the Transaction's own (immutable) `type` — same checks as US-01 steps 4–5.
5. **If `amount` is being changed**: System computes `delta = new_signed_effect - old_signed_effect` (where a signed effect is `+amount` for `income`, `-amount` for `expense` — `type` never changes, only magnitude) and atomically applies `balance = balance + delta` to the Transaction's Wallet, in the same DB transaction as the Transaction row update. **No floor check applies** (Context #3) — the resulting balance may be zero or negative.
6. System applies the update, `updated_at = NOW()`.
7. System returns `200` with the updated Transaction object and (if `amount` changed) the Wallet's new `balance`.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-TRX-35 | Transaction exists, owned by caller, `type = "expense"`, `amount = 200000` | Caller submits `{ "note": "Lunch with team" }` | `200`; `note` updated, Wallet balance unchanged | Happy path — no balance impact |
| S-TRX-36 | Transaction exists, owned by caller, `type = "expense"`, `amount = 200000`; Wallet balance is 800,000 | Caller submits `{ "amount": 300000 }` | `200`; Wallet balance decreases by an additional 100,000 to 700,000 | Happy path — increasing an expense pulls more money out |
| S-TRX-37 | Transaction exists, owned by caller, `type = "expense"`, `amount = 200000`; Wallet balance is 800,000 | Caller submits `{ "amount": 50000 }` | `200`; Wallet balance increases by 150,000 to 950,000 | Happy path — decreasing an expense releases money back |
| S-TRX-38 | Transaction exists, owned by caller, `type = "income"`, `amount = 500000`, recorded when Wallet balance was 1,000,000; caller has since spent that income down to a current balance of 100,000 | Caller submits `{ "amount": 100000 }` (reducing the income) | `200`; Wallet balance becomes -300,000 | ⚠️ Balance is allowed to go negative on Update — see Context #3; not blocked |
| S-TRX-39 | Transaction exists, owned by caller, `category_id` = "Food" (`expense`) | Caller submits `{ "category_id": <Rent, also expense> }` | `200`; `category_id` updated | Happy path — reclassifying, same type |
| S-TRX-40 | Transaction exists, owned by caller, `type = "expense"` | Caller submits `{ "category_id": <Salary, income> }` | `422 CATEGORY_TYPE_MISMATCH` | ⚠️ New category must still match the Transaction's immutable `type` |
| S-TRX-41 | Transaction exists, owned by caller | Caller submits `{ "wallet_id": "<other-uuid>" }` | `400 INVALID_INPUT` (unknown/disallowed field) | ⚠️ `wallet_id` must be structurally rejected — mirrors the F-03 `balance`-field exclusion precedent |
| S-TRX-42 | Transaction exists, owned by caller | Caller submits `{ "type": "income" }` | `400 INVALID_INPUT` (unknown/disallowed field) | Same structural exclusion as `wallet_id` |
| S-TRX-43 | Transaction exists, owned by caller | Caller submits `{ "amount": -5000 }` | `400 INVALID_INPUT` | Same money-rule validation as US-01 |
| S-TRX-44 | Transaction exists, owned by a *different* user | Caller submits any valid update | `403 TRANSACTION_ACCESS_DENIED` | Ownership check |
| S-TRX-45 | No Transaction with that ID (or soft-deleted) | Caller submits an update | `404 TRANSACTION_NOT_FOUND` | |
| S-TRX-46 | Transaction exists, owned by caller | Caller submits `{}` (empty body) | `400 INVALID_INPUT` | Nothing to update — client mistake, not a no-op `200` |
| S-TRX-47 | Transaction exists, owned by caller | Caller submits `{ "occurred_at": "2025-11-01" }` | `200`; `occurred_at` updated, no Wallet balance impact; next `GET /budgets` read reflects the Transaction's spend in its *new* period, not its old one | Happy path — cross-feature consistency with Budget's live-computation design (no cascading update needed) |

### Edge Cases
1. **`wallet_id` and `type` are structurally excluded from the update DTO**, not merely validated away — mirrors the F-03/F-04/F-05 field-exclusion precedent. Moving a Transaction to a different Wallet, or flipping its income/expense sign, is out of scope for this endpoint (Context #5); the User must delete and recreate instead.
2. **The insufficient-balance floor does NOT apply here** (Context #3, S-TRX-38) — this is the single most important edge case in this User Story; a reviewer should not "fix" this by adding the floor check without first re-reading Context #3's rationale.
3. **Changing `amount` recomputes the Wallet balance via a signed delta, not a re-derivation from scratch** — `balance = balance + (new_signed_effect - old_signed_effect)`, applied atomically in the same DB transaction as the row update, mirroring CLAUDE.md's same-transaction rule for Create.
4. **Changing `category_id` re-validates existence/visibility/non-deleted exactly like Create, plus the type-match rule against the Transaction's own immutable `type`** (S-TRX-40) — the Category being pointed to can change, but what `type` it must match never does.
5. **Changing `occurred_at` has zero Wallet-balance impact but changes which Budget period (if any) the Transaction's spend is attributed to on the *next* read** (S-TRX-47) — this falls out naturally from Budget's live-computation design (`specs/budget-management/spec.md` Edge Cases #1) and requires no explicit cross-feature update logic here.

### Definition of Done
- `PATCH /transactions/{id}` implemented; request DTO has no `wallet_id`/`type` fields at the type level; `amount` changes reconcile the Wallet balance via an atomic signed-delta `UPDATE` in the same DB transaction as the row update, with **no** balance-floor check.
- `category_id` changes re-run the existence/visibility/type-match checks from US-01.
- Unit tests for S-TRX-40 through S-TRX-43, S-TRX-46 pass. Integration tests for S-TRX-35 through S-TRX-39, S-TRX-47 pass. Integration tests for S-TRX-44, S-TRX-45 pass.
- A test explicitly asserts that reducing an `income` Transaction's `amount` below what has since been spent (S-TRX-38) succeeds and leaves the Wallet balance negative, not rejected.

### Idempotency
Idempotent in effect — re-submitting the same update payload repeatedly converges to the same end state (the Wallet balance delta becomes 0 on the second identical call), though there is no explicit idempotency key.

---

## US-05: Delete a Transaction

**As a** User,
**I want** to remove a Transaction I recorded by mistake,
**so that** my Wallet balance and history accurately reflect what actually happened.

**API:** `DELETE /transactions/{id}`

### Preconditions
- Caller is authenticated and owns the Transaction (`user_id = caller`).

### Main Flow
1. User taps "Delete" on one of their own Transactions.
2. System verifies the Transaction is non-deleted and `user_id = caller`.
3. System atomically reverses the Transaction's effect on its Wallet's `balance` (an `expense` deletion adds `amount` back; an `income` deletion subtracts `amount`) and soft-deletes the Transaction (`deleted_at = NOW()`), in the same DB transaction. **No floor check applies** (Context #3) — the resulting balance may be zero or negative.
4. System returns `200` confirming deletion, including the Wallet's new `balance`.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-TRX-48 | Transaction exists, owned by caller, `type = "expense"`, `amount = 200000`; Wallet balance is 800,000 | Caller calls `DELETE /transactions/{id}` | `200`; Transaction soft-deleted; Wallet balance restored to 1,000,000 | Happy path — deleting an expense gives the money back |
| S-TRX-49 | Transaction exists, owned by caller, `type = "income"`, `amount = 500000`; Wallet balance is 1,500,000 | Caller calls `DELETE /transactions/{id}` | `200`; Transaction soft-deleted; Wallet balance decreases to 1,000,000 | Happy path — deleting an income takes the money back out |
| S-TRX-50 | Transaction exists, owned by caller, `type = "income"`, `amount = 500000`, recorded when Wallet balance was 1,000,000; caller has since spent that income down to a current balance of 100,000 | Caller calls `DELETE /transactions/{id}` | `200`; Wallet balance becomes -400,000 | ⚠️ Balance allowed to go negative on Delete — same rationale as S-TRX-38 |
| S-TRX-51 | Transaction exists, owned by a *different* user | Caller calls `DELETE /transactions/{id}` | `403 TRANSACTION_ACCESS_DENIED` | Ownership check |
| S-TRX-52 | No Transaction with that ID (or already soft-deleted) | Caller calls `DELETE /transactions/{id}` | `404 TRANSACTION_NOT_FOUND` | Deleting an already-deleted Transaction is not idempotent-success — it's a `404` |

### Edge Cases
1. **The Wallet-balance reversal and the soft-delete are one atomic DB transaction**, exactly mirroring Create's atomicity requirement (Edge Cases #2 of US-01) — a failure after one but before the other must roll back both.
2. **No dependency/blocking check needed before delete** — unlike F-04's Category delete (blocked by an active Budget referencing it), nothing references `transactions.id` as a foreign key; deletion is unconditional once ownership/existence passes.
3. **Deleting a Transaction whose Category has since been soft-deleted still works identically** — the reversal only touches the Wallet, not the Category; the historical `category_id` reference is simply carried into the soft-deleted Transaction row unchanged.
4. **Soft delete only — never a hard delete**, consistent with CLAUDE.md's "không hard delete financial records" rule — a Transaction is the record CLAUDE.md's rule most directly protects.

### Definition of Done
- `DELETE /transactions/{id}` implemented as an atomic (balance-reversal + soft-delete) operation once ownership/existence checks pass, with **no** balance-floor check.
- Unit tests for S-TRX-51, S-TRX-52 pass. Integration tests for S-TRX-48 through S-TRX-50 pass.
- A test explicitly asserts that deleting an `income` Transaction whose funds have since been spent (S-TRX-50) succeeds and leaves the Wallet balance negative, not rejected.

### Idempotency
**Not idempotent** — calling `DELETE` twice on the same Transaction returns `200` the first time and `404 TRANSACTION_NOT_FOUND` the second time, mirroring the F-04/F-05 delete precedent.

---

## Out of Scope (Feature F-06)

- **Wallet-to-wallet transfers** — SRS FR-02 defines only income/expense Transactions; a "transfer" would need paired-transaction semantics (debit one Wallet, credit another, atomically) not covered here. See Open Questions #5.
- **Refunds as negative-amount Transactions** — `amount` is always positive (Context #2); a refund is recorded as a new `income` Transaction (or by editing/deleting the original), not a signed adjustment.
- **Recurring/scheduled Transactions** — explicitly deferred in `SDS.md` §11 Future Enhancements ("Recurring transactions").
- **Changing a Transaction's Wallet or type after creation** — resolved as out of scope (Context #5); delete and recreate instead.
- **Attachments/receipts on a Transaction** — no such field in SRS/SDS; not part of this spec.
- **Bulk create/update/delete** — every operation in this spec is single-Transaction; no batch endpoint.
- **An idempotency-key mechanism for Create** — flagged as an urgent gap (US-01 Idempotency), but not designed/implemented in this spec; see Open Questions #2.
- **Blocking or warning when Update/Delete would drive a Wallet negative** — resolved as "always allowed, never blocked" (Context #3); a softer "warn but allow" UX is Release-1+ territory, not this spec (see Open Questions #1).
- **Admin visibility into other Users' Transactions** — no such endpoint exists in this spec, matching every other MVP feature.
- **A limit on the number of Transactions per User or per Wallet** — no cap enforced, matching the no-cap precedent from F-03/F-04/F-05.

## Open Questions

1. **Should Update/Delete warn (not just silently allow) when the result is a negative Wallet balance?** This spec resolves to "always allow, never block" for both (Context #3, S-TRX-38/S-TRX-50), by direct analogy with corrected historical ledger entries. An alternative — a non-blocking warning surfaced to the client (e.g. a `warnings` array in the `200` response) — is a reasonable enhancement but not required for MVP. **Recommend the current unconditional-allow resolution**, flagging for explicit product sign-off since it's the spec's most debatable call.
2. **Idempotency-Key for `POST /transactions`**: given a duplicate submission here doubly mutates real money (unlike F-03/F-05's lower-stakes duplicate-row equivalents), should this endpoint require an `Idempotency-Key` header ahead of the other MVP write endpoints, rather than relying on client-side debounce alone? Recommend addressing before Release 1 sign-off, not deferred indefinitely like the Wallet/Budget precedent.
3. **`WAL-T14` follow-through**: this spec's existence unblocks F-03's deferred `409 CURRENCY_LOCKED` check (`EXISTS (SELECT 1 FROM transactions WHERE wallet_id = $1 AND deleted_at IS NULL)`) in `PATCH /wallets/{id}`. This spec does not itself modify `wallet_service.go` — flagging so `plan.md` schedules `WAL-T14` alongside this feature's own implementation, not as a separately forgotten task.
4. **`note` max length**: this spec assumes 500 characters (explicit assumption, Domain Fields) — no source document specifies a limit. Confirm before implementation; low priority.
5. **Wallet-to-wallet transfers**: SRS FR-02 doesn't define this, and it's explicitly out of scope here — confirm whether Release 1 needs it (would likely be its own small feature: a paired-Transaction primitive) or whether Users are expected to model a transfer as an expense + income pair manually.
6. **Future-dated `occurred_at`**: this spec places no restriction on `occurred_at` being in the future (e.g. logging a planned expense ahead of time) — neither blocked nor specially flagged. Confirm this is acceptable for MVP; if not, would need an explicit `occurred_at <= NOW()` validation rule.
