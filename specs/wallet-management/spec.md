# Feature Spec: F-03 Wallet Management (MVP)

> Source: `SRS.md` Feature-03, `SDS.md` §5.3 / §2.1.2, `CLAUDE.md` MVP Features table
> Status: MVP — first financial-domain feature; blocks F-06 Transaction Management (every Transaction requires a Wallet)
> Related: [F-01 User Management](../user-management/spec.md) (wallet owner), [F-02 System Security](../security/spec.md) (auth required on every endpoint here)

## Context

Phase 0 (User Management + System Security) is implemented. Wallet Management is the next most vital feature to spec because it is the **foundational domain object** for the rest of the MVP: Transaction Management (F-06) cannot exist without a Wallet to record against, Budget Management (F-05) reports are computed relative to Wallet/Category activity, and Financial Reporting (F-07) and the Dashboard (Release 1) both read Wallet balances. Per SRS BF-01 (main business flow), creating a Wallet is literally step 3 — the first thing a User does after login.

A Wallet represents a source or destination of money (cash, bank account, e-wallet). Per CLAUDE.md, a Wallet's `balance` is a derived-but-stored `BIGINT` (integer cents/xu) that must only ever change atomically together with a Transaction insert (same DB transaction) — this spec's Update operation explicitly does **not** allow direct balance mutation, to protect that invariant.

Actors:
- **User** — any `active` user (`role = admin` or `member`); wallets are personal, not shared. There is no admin override of another user's wallets in this spec.

## Preconditions (feature-level)

- Caller holds a valid access JWT (`role` irrelevant — every active user manages their own wallets identically).
- `wallets` table exists per the schema below (**new migration required** — does not yet exist in `001_init.sql`).

### Domain Fields (conceptual — full schema/index design belongs in `plan.md`)

A Wallet belongs to exactly one User and has: a `name`, a `type` (`cash` | `bank` | `e_wallet` | `other`), a `balance` (integer cents), a `currency`, an `is_default` flag, and the standard audit/soft-delete timestamps. This extends the `wallets` table already named in CLAUDE.md's Core DB Schema — this spec does not restate its column-level definition.

**Business invariant**: at most one Wallet can be `is_default = true` per User at any time. This must be enforced at the data layer, not only in application/service code, so that two concurrent requests can never leave the system in a two-default (or zero-default) state — see the concurrency Edge Cases in US-01 and US-05.

⚠️ **Money rule**: `balance` and any amount fields are integer cents — never a float or decimal, in transit or storage. `currency` is an ISO 4217 code; MVP allow-list is `{VND, USD}` (**explicit assumption** — see Open Questions #1). No cross-currency conversion is performed anywhere in this spec.

---

## US-01: Create a Wallet [MVP]

**As a** User,
**I want** to create a Wallet with a name, type, currency, and optional opening balance,
**so that** I have a place to record Transactions against.

**API:** `POST /wallets`

### Preconditions
- Caller is authenticated.
- Request body: `{ name: string, type: "cash"|"bank"|"e_wallet"|"other", currency?: string, initial_balance?: integer, is_default?: boolean }`. `currency` defaults to `"VND"`. `initial_balance` defaults to `0`.

### Main Flow
1. User submits the wallet creation form (name, type, currency, optional opening balance, optional "make default" toggle).
2. System validates shape: `name` non-empty and ≤ 100 chars, `type` is a valid enum value, `currency` is in the MVP allow-list, `initial_balance` (if present) is a non-negative integer (handler-level).
3. System counts the User's existing non-deleted wallets.
4. **Business rule**: if this is the User's first wallet, `is_default` is forced to `true` regardless of what was requested (service-level).
5. **Business rule**: if `is_default = true` is requested (or forced) and another wallet is currently the User's default, System unsets the previous default and sets the new one, both in the same DB transaction (service-level, guarded by the partial unique index).
6. System creates the `wallets` row with `balance = initial_balance`.
7. System returns `201` with the created wallet object.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-WAL-01 | User has zero existing wallets | User creates a wallet without setting `is_default` | `201`; `is_default = true` on the new wallet regardless of request | Happy path — first wallet always becomes default |
| S-WAL-02 | User already has 1 default wallet | User creates a second wallet without `is_default` | `201`; new wallet `is_default = false`; existing default untouched | Happy path |
| S-WAL-03 | User already has 1 default wallet W1 | User creates wallet W2 with `is_default = true` | `201`; W2 `is_default = true`; W1 flips to `is_default = false` — both updates atomic | Business rule, service-level |
| S-WAL-04 | — | User submits with `name = ""` | `400 INVALID_INPUT` | Validation error (client mistake) |
| S-WAL-05 | — | User submits with `type = "crypto"` (not in enum) | `400 INVALID_INPUT` | Validation error |
| S-WAL-06 | — | User submits with `currency = "EUR"` (not in MVP allow-list) | `400 INVALID_INPUT` | Validation error — see Open Questions #1 |
| S-WAL-07 | — | User submits with `initial_balance = -50000` | `400 INVALID_INPUT` | ⚠️ Money rule — balance can never start negative |
| S-WAL-08 | — | User submits with `initial_balance = 10.5` (a decimal, not an integer) | `400 INVALID_INPUT` | ⚠️ Money rule — integer cents only, JSON number must be a whole number |
| S-WAL-09 | No/invalid JWT | Caller calls `POST /wallets` | `401 UNAUTHORIZED` | Authentication failure |
| S-WAL-10 | User has zero wallets; two create-requests arrive concurrently, neither setting `is_default` | Both requests race to be "the first wallet" | Exactly one row ends up `is_default = true` (enforced by the data-layer uniqueness invariant); the other wallet is still created successfully with `is_default = false` | ⚠️ Data-integrity critical — see Edge Cases |

### Edge Cases
1. **First-wallet default is forced, not optional**: the client cannot create a User's first wallet with `is_default = false` — the service overrides it. This guarantees every active User always has exactly one default wallet once they have ≥1 wallet, simplifying the "which wallet does a Transaction default to" UX question in F-06.
2. **Default uniqueness is a data-layer constraint, not just application logic**: the "at most one default per user" invariant is the source of truth at the storage layer. The service-level "unset old, set new" step is an optimization for the common case, but the storage-layer constraint is what prevents two defaults from ever coexisting under concurrent requests (S-WAL-10).
3. **Opening balance is not a Transaction**: `initial_balance` sets the `balance` field directly at creation time; it does **not** create a corresponding Transaction record. This means summing all Transactions for a wallet will **not** equal its current balance if a non-zero opening balance was set — flagged for F-07 Reporting design. See Open Questions #3.
4. **Currency is fixed at creation for MVP purposes** (see US-04 Edge Cases for the immutability rule after first Transaction).

### Definition of Done
- `POST /wallets` implemented with handler-level shape validation and service-level default-wallet business rules.
- The "one default wallet per user" invariant is enforced at the data layer (not application code alone).
- Unit tests for S-WAL-04 through S-WAL-09 pass. Integration tests for S-WAL-01, S-WAL-02, S-WAL-03, and the concurrency case S-WAL-10 pass.
- No test asserts on `float`/decimal balance handling — all money values are integers end-to-end.

### Idempotency
Not idempotent — no idempotency key is defined; each call creates a new wallet. Duplicate submissions (e.g. double-tap "Save" in the app) will create two wallets. **Flagged as a UX gap, not a data-integrity one** — see Open Questions #5.

---

## US-02: View a List of Wallets [MVP]

**As a** User,
**I want** to see all of my Wallets with their current balances,
**so that** I know where my money is.

**API:** `GET /wallets`

### Preconditions
- Caller is authenticated.

### Main Flow
1. User opens the Wallets screen.
2. App calls `GET /wallets`.
3. System returns all of the caller's non-deleted wallets, ordered `is_default DESC, created_at ASC` (default wallet always shown first).

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-WAL-11 | Caller has 3 wallets, one of which is another user's (not theirs) | Caller calls `GET /wallets` | `200`; only the caller's own 3 wallets returned | User isolation — ⚠️ cross-user leak would be critical |
| S-WAL-12 | Caller has 0 wallets (has never created one) | Caller calls `GET /wallets` | `200`; `{ "data": [] }` | Not a 404 — empty list is valid, e.g. immediately post-activation |
| S-WAL-13 | No/invalid JWT | Caller calls `GET /wallets` | `401 UNAUTHORIZED` | |
| S-WAL-14 | Caller has 2 active wallets and 1 soft-deleted wallet | Caller calls `GET /wallets` | `200`; only the 2 active wallets returned | Soft-deleted rows excluded unconditionally (no MVP endpoint exposes wallet deletion yet — see Out of Scope, but the exclusion rule must hold regardless) |

### Response Shape
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Main Wallet",
      "type": "cash",
      "balance": 100000000,
      "currency": "VND",
      "is_default": true,
      "created_at": "2026-07-29T09:00:00Z",
      "updated_at": "2026-07-29T09:00:00Z"
    }
  ]
}
```

### Edge Cases
1. **No pagination for MVP**: unlike `GET /admin/users`, this endpoint is not cursor-paginated — a personal user is expected to have a small number of wallets (single digits). **Explicit assumption**; revisit if usage data shows otherwise.
2. **User isolation is mandatory on every row**: query must include `WHERE user_id = $caller_id` — there is no filter parameter that could accidentally widen this (unlike admin's cross-user list in F-01).
3. **Balance is always the live column value** — this endpoint does not recompute balance from Transactions on read; it trusts the stored, atomically-maintained `balance` column (per CLAUDE.md's same-DB-transaction rule).

### Definition of Done
- `GET /wallets` implemented, scoped strictly to `user_id = caller`.
- Unit test asserts a wallet belonging to a different `user_id` is never present in another caller's response, even if IDs are enumerated directly against the DB fixture.
- Integration tests for S-WAL-11, S-WAL-12, S-WAL-14 pass.

### Idempotency
N/A — read-only (`GET`), naturally idempotent.

---

## US-03: View a Wallet [MVP]

**As a** User,
**I want** to view the details of a single Wallet,
**so that** I can see its full balance and metadata before recording a Transaction against it.

**API:** `GET /wallets/{id}`

### Preconditions
- Caller is authenticated.
- `{id}` is a UUID path parameter.

### Main Flow
1. User selects a Wallet from the list.
2. App calls `GET /wallets/{id}`.
3. System fetches the wallet, verifies it is non-deleted and `user_id = caller`.
4. System returns `200` with the wallet object (same shape as the list item).

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-WAL-15 | Wallet exists, owned by caller | Caller calls `GET /wallets/{id}` | `200`; wallet object returned | Happy path |
| S-WAL-16 | Wallet exists, owned by a *different* user | Caller calls `GET /wallets/{id}` with that wallet's UUID | `403 WALLET_ACCESS_DENIED` | Ownership check — not `404`, since wallet IDs are unguessable UUIDv4s (no meaningful enumeration risk); matches the `WALLET_ACCESS_DENIED` error code already named in SDS §6.3 for Transaction creation |
| S-WAL-17 | No wallet with that ID exists (or it is soft-deleted) | Caller calls `GET /wallets/{id}` | `404 WALLET_NOT_FOUND` | Distinct from S-WAL-16 |
| S-WAL-18 | `{id}` path segment is not a valid UUID (e.g. `"abc"`) | Caller calls `GET /wallets/abc` | `400 INVALID_INPUT` | Handler-level shape validation, before any DB lookup |

### Edge Cases
1. **Ownership check precedes existence disclosure semantics deliberately differ from F-01/F-02**: here, "belongs to someone else" (`403`) and "doesn't exist" (`404`) are **intentionally distinguished** (unlike the login/activation enumeration-protection pattern), because wallet IDs are high-entropy UUIDs with no username/email-style guessability concern.
2. **Soft-deleted wallet accessed by its own owner** is treated identically to not-found (`404`) — there is no "restore" flow in this spec (see Out of Scope).

### Definition of Done
- `GET /wallets/{id}` implemented with ownership check returning `403` (not `404`) for cross-user access, and `404` for genuinely absent/deleted wallets.
- Unit tests for S-WAL-16, S-WAL-17, S-WAL-18 pass. Integration test for S-WAL-15 passes.

### Idempotency
N/A — read-only (`GET`), naturally idempotent.

---

## US-04: Update a Wallet

**As a** User,
**I want** to edit a Wallet's name or type,
**so that** I can correct a mistake or reflect how I actually use it.

**API:** `PATCH /wallets/{id}`

### Preconditions
- Caller is authenticated and owns the wallet.
- Request body: `{ name?: string, type?: "cash"|"bank"|"e_wallet"|"other" }` — **`balance` and `currency` are never accepted by this endpoint** (see Edge Cases).

### Main Flow
1. User edits the wallet's name and/or type from the Wallet Details screen.
2. System validates shape: at least one of `name`/`type` present; same field-level rules as US-01 (handler-level).
3. System verifies ownership (`user_id = caller`, `deleted_at IS NULL`).
4. System applies the partial update, `updated_at = NOW()`.
5. System returns `200` with the updated wallet object.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-WAL-19 | Wallet exists, owned by caller | Caller submits `{ "name": "Savings" }` | `200`; `name` updated, all other fields unchanged | Happy path |
| S-WAL-20 | Wallet exists, owned by caller | Caller submits `{ "balance": 999999999 }` | `400 INVALID_INPUT` (unknown/disallowed field) | ⚠️ Critical: balance must only ever change via a Transaction insert in the same DB transaction (CLAUDE.md) — this endpoint must reject, not silently ignore, a `balance` field, so a client bug never *appears* to have worked. **Explicit assumption**: strict decoding (reject unknown fields) rather than silent-ignore — see Open Questions #4 |
| S-WAL-21 | Wallet exists, owned by caller, and has ≥1 Transaction recorded against it | Caller submits `{ "currency": "USD" }` | `409 CURRENCY_LOCKED` | ⚠️ Data consistency: changing currency after Transactions exist would silently misrepresent historical amounts (no FX conversion in this system) — see Open Questions #2 |
| S-WAL-22 | Wallet exists, owned by a *different* user | Caller submits any valid update | `403 WALLET_ACCESS_DENIED` | Ownership check |
| S-WAL-23 | No wallet with that ID (or soft-deleted) | Caller submits an update | `404 WALLET_NOT_FOUND` | |
| S-WAL-24 | Wallet exists, owned by caller | Caller submits `{}` (empty body) | `400 INVALID_INPUT` | Nothing to update — treated as a client mistake, not a no-op `200` |

### Edge Cases
1. **`balance` is structurally excluded from the update DTO**, not merely validated away — the request/response DTOs for this endpoint must not share a struct with any field that maps directly to the `balance` column, to prevent an accidental future regression from ever exposing it.
2. **`currency` immutability is conditional, not absolute**: a wallet with zero Transactions can freely change currency (e.g. a User picked the wrong currency when first creating it); the lock only activates once real financial history exists against it.
3. **`is_default` is intentionally excluded from this endpoint** — default-wallet swapping is a distinct atomic operation with its own uniqueness guarantees (see US-05), not a plain field update, to keep this endpoint's transaction scope simple.

### Definition of Done
- `PATCH /wallets/{id}` implemented; request DTO has no `balance` field at the type level; `currency` change is blocked with `409 CURRENCY_LOCKED` once `EXISTS (SELECT 1 FROM transactions WHERE wallet_id = $1)`.
- Unit tests for S-WAL-20 through S-WAL-24 pass. Integration test for S-WAL-19 passes.

### Idempotency
Idempotent in effect — re-submitting the same `{ name, type }` payload repeatedly always converges to the same end state (standard `PATCH` semantics), though there is no explicit idempotency key.

---

## US-05: Set a Wallet as Default

**As a** User,
**I want** to designate a different Wallet as my default,
**so that** new Transactions pre-select the wallet I actually use most.

**API:** `POST /wallets/{id}/set-default`

### Preconditions
- Caller is authenticated and owns the wallet.

### Main Flow
1. User taps "Set as default" on a non-default wallet.
2. System verifies ownership and that the wallet is non-deleted.
3. System atomically unsets the caller's current default wallet (if any) and sets this wallet's `is_default = true`, in a single DB transaction guarded by the one-default-per-user invariant.
4. System returns `200` with the updated wallet object.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-WAL-25 | Wallet W2 exists, owned by caller, `is_default = false`; W1 is currently default | Caller calls `POST /wallets/W2/set-default` | `200`; W2 `is_default = true`; W1 `is_default = false` | Happy path |
| S-WAL-26 | Wallet is already the caller's default | Caller calls `set-default` on it again | `200`; no-op, state unchanged | Idempotent — see Idempotency below |
| S-WAL-27 | Wallet owned by a *different* user | Caller calls `set-default` on that wallet's ID | `403 WALLET_ACCESS_DENIED` | Ownership check |
| S-WAL-28 | No wallet with that ID (or soft-deleted) | Caller calls `set-default` | `404 WALLET_NOT_FOUND` | |
| S-WAL-29 | Caller has wallets W1 (default) and W2; two `set-default` calls for W2 arrive concurrently | Both requests race | Both ultimately return `200`; exactly one consistent end state (W2 default, W1 not) — no window where both or neither are default | ⚠️ Data-integrity critical, same guard as S-WAL-10 |

### Edge Cases
1. **A User with a single wallet can still call this endpoint** on their only (already-default) wallet — treated as the idempotent no-op case (S-WAL-26), not an error.
2. **This is a dedicated action endpoint, not a `PATCH` body field**, specifically so the "unset old + set new" pair is always executed as one atomic unit — a generic `PATCH { is_default: true }` would tempt a partial-failure path (set new default without clearing the old one).
3. **A wallet with zero other wallets to demote** (User's only wallet) never violates the one-default invariant, since there is nothing to unset.

### Definition of Done
- `POST /wallets/{id}/set-default` implemented as an atomic swap within a single DB transaction.
- Concurrency test (S-WAL-29) passes against the one-default-per-user invariant.
- Unit tests for S-WAL-26 through S-WAL-28 pass. Integration test for S-WAL-25 passes.

### Idempotency
Explicitly idempotent: calling `set-default` on a wallet that is already the default always returns `200` with unchanged state — repeated identical calls never cause an error or drift.

---

## Out of Scope (Feature F-03)

- **Deleting or archiving a Wallet** — SRS Feature-03 defines no delete User Story (unlike Category/Budget/Transaction, which each have one); a Wallet with recorded Transaction history cannot be safely soft-deleted without a defined behavior for its historical Transactions and Reports. Explicitly deferred — see Open Questions #6.
- **Wallet-to-wallet transfer** (e.g. moving cash into a bank wallet) — not in SRS Feature-03; would require paired-transaction semantics not covered by this spec.
- **Multi-currency conversion / live FX rates** — every Wallet's `balance` and Transactions are in that Wallet's own `currency`; no aggregate cross-currency total is computed anywhere.
- **Shared/joint Wallets** — every Wallet has exactly one `user_id` owner; no multi-user wallet access.
- **Manual balance correction/adjustment endpoint** — the only ways `balance` can change are (a) `initial_balance` at creation (US-01) and (b) Transaction inserts (F-06, not in this spec); there is no "fix my balance" admin or user tool.
- **A limit on the number of Wallets per User** — no cap is enforced in this spec (see Open Questions #7).

## Open Questions

1. **Currency allow-list**: this spec assumes `{VND, USD}` for MVP (VND appears throughout SRS/CLAUDE.md examples). Confirm the full supported list before implementation — affects the `CHECK` constraint / enum validation in both `POST /wallets` and `PATCH /wallets/{id}`.
2. **Currency-lock trigger condition**: US-04 assumes the lock activates the moment ≥1 Transaction exists against the wallet. Should a wallet with only *soft-deleted* Transactions still be considered "locked"? (Affects the `EXISTS` query's `deleted_at` filter.)
3. **Opening balance vs. Transaction ledger integrity**: `initial_balance` (US-01) sets `balance` directly without a corresponding Transaction row. This means `SUM(transactions.amount) != wallets.balance` whenever a non-zero opening balance was used. F-07 (Financial Reporting) needs to either (a) treat `initial_balance` as an implicit pseudo-transaction for report completeness, or (b) explicitly document that reports reconcile against `balance`, not derive it. **Blocking for F-07 spec — must be resolved before that spec is written.**
4. **Strict vs. lenient unknown-field handling**: US-04 assumes the API rejects an unrecognized `balance` field in the `PATCH` body with `400` (strict decoding) rather than silently ignoring it. Confirm this matches the request-validation convention used elsewhere in the backend before implementation.
5. **Double-submit on Create**: US-01 has no idempotency key, so a double-tap "Save" in the Flutter app could create two identical wallets. Is client-side debounce sufficient for MVP, or does this endpoint need an `Idempotency-Key` header like some payment APIs use? Recommend client-side debounce only, given the low blast radius (an extra empty wallet, not a financial-consistency issue) — flagging for explicit product sign-off.
6. **Wallet deletion**: SRS's omission of a delete User Story for Wallet Management (unlike Category/Budget/Transaction) — confirm this is intentional before Release 1 planning, since real users will eventually want to remove an unused wallet.
7. **Per-user Wallet count limit**: no cap defined. Low priority for a personal app, but worth an explicit "no limit for MVP" sign-off rather than silence.
