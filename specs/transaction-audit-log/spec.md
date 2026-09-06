# Feature Spec: Transaction Audit Log (extends F-06 Transaction Management)

> Source: user request (this session) — "cần feature ghi log lại đầy đủ cho create update delete transaction... obviously check lại, ko bao giờ được delete transaction record, chỉ là soft delete thôi." Not a numbered SRS feature; extends F-06's existing Create/Update/Delete (`specs/transaction-management/spec.md`) with an append-only history of those same three operations.
> Status: New — no code exists yet for this.
> Related: [F-06 Transaction Management](../transaction-management/spec.md) (owns the Create/Update/Delete flows this spec hooks into; this spec never changes their business rules — balance floor, immutability of `wallet_id`/`type`, category type-match — it only adds a side-effect write alongside them)

## Context

F-06 already guarantees a Transaction is never hard-deleted (`deleted_at`, never a `DELETE FROM transactions` — CLAUDE.md's "không hard delete financial records" rule). What F-06 does *not* provide is a record of *history*: today, if a Transaction's amount or category is edited, or the Transaction is soft-deleted, the prior values are simply gone — overwritten in place (`UPDATE`) or left frozen at whatever they were the moment `deleted_at` was set. There is no way for a User to answer "what did this look like before I edited it?" or "when exactly did I delete this, and what was it?".

This spec adds a new, append-only `transaction_audit_logs` table and wires exactly one write into each of F-06's three mutating operations (`POST /transactions`, `PATCH /transactions/{id}`, `DELETE /transactions/{id}`) — never a new mutation path of its own, and never a background job (unlike F-10's notification-eval job, which reads Transactions but writes Notifications on its own schedule; here the log write must happen synchronously, in the same DB transaction as the mutation it's recording, or not at all).

**Resolved design decisions:**

1. **The audit-log write and the Transaction mutation are one atomic DB transaction — never a best-effort side write.** Mirrors F-06's own "wallet-balance update and Transaction insert are one atomic DB transaction" precedent (CLAUDE.md). A log entry that failed to write while its Transaction mutation succeeded (or vice versa) would defeat the entire purpose of an audit trail — silently incomplete history is worse than an outright failed request. If the audit insert fails, the whole operation rolls back and the client sees the same error class it would for any other mid-transaction failure (`500`, not a distinct error code — this is an internal-consistency failure, not a client mistake).
2. **`transaction_audit_logs` is itself append-only — no `deleted_at`, no `UPDATE`, no route that writes to it directly.** The only writer is the three existing F-06 service methods; the only reader is the new list endpoint below (US-02). This is a deliberately narrower guarantee than "soft delete" — there is no delete path for an audit-log row at all, soft or hard.
3. **`user_id` is denormalized onto `transaction_audit_logs` directly** (not resolved via a join to `transactions.user_id` at read time), mirroring `transactions.user_id`'s own denormalization from `wallets.user_id` (F-06 Domain Fields) — same reasoning: direct `WHERE user_id = $caller` filtering without a join, and the row remains attributable to its owner even in the (currently impossible, since Transactions are never hard-deleted) case the parent Transaction row were ever removed.
4. **`before`/`after` are JSONB snapshots of only the fields that operation actually touches** — not a full-row dump every time. `create`: `before = NULL`, `after` = the fields set at creation (`wallet_id`, `category_id`, `amount`, `type`, `note`, `occurred_at`). `update`: `before`/`after` contain only the field(s) present in that specific `PATCH` body (mirrors US-04's own partial-update semantics — an update that only touched `note` should not fabricate an unchanged `amount` into the log). `delete`: `before` = the full field set as it stood at deletion time (mirrors `create`'s shape, reversed), `after = NULL`. This keeps entries compact and makes "what changed" legible without reconstructing a full-row diff.
5. **A failed mutation (any 4xx from F-06's own validation/ownership/business-rule checks, e.g. `409 INSUFFICIENT_BALANCE`, `422 CATEGORY_TYPE_MISMATCH`, `403 TRANSACTION_ACCESS_DENIED`) never produces an audit-log entry.** Only a mutation that actually committed is logged — this is a direct consequence of decision #1 (same DB transaction: a rolled-back mutation rolls back its log write too), stated explicitly here because it's easy to misdesign as "log the attempt" instead of "log the effect."

Actors:
- **User** — any `active` user; sees only their own Transactions' audit history. No admin cross-user visibility, matching every other F-06/F-03/F-04/F-05 precedent (no admin-facing UI in MVP).

## Preconditions (feature-level)

- Caller holds a valid access JWT.
- `transaction_audit_logs` table exists (**new migration required**, next number after `011_chat_messages.sql`).
- At least one Transaction exists for entries to reference (`transaction_id` FK, but see Edge Cases #3 on why this FK is informational only, not enforced with `ON DELETE CASCADE`/`RESTRICT` semantics that matter — Transactions are never hard-deleted).

### Domain Fields

| Field | Meaning |
|---|---|
| `id` | Unique identifier |
| `transaction_id` | The Transaction this entry records a change to |
| `user_id` | Denormalized owner, same value as the parent Transaction's `user_id` at write time (Context #3) |
| `action` | `create` \| `update` \| `delete` |
| `before` | JSONB, nullable — see Context #4 |
| `after` | JSONB, nullable — see Context #4 |
| `created_at` | `TIMESTAMPTZ`, when this entry was written (== when the mutation committed) |

No `updated_at`, no `deleted_at` — append-only (Context #2).

⚠️ **Money rule**: any `amount` present inside `before`/`after` is the same integer-cents value F-06 itself stores — never converted to a display/major-unit value for storage (that conversion, if any, belongs at the client/read boundary, same as everywhere else in this codebase).

---

## US-01: Record an audit-log entry on Create/Update/Delete [required, no separate endpoint]

**As a** system,
**I want** every successful `POST /transactions`, `PATCH /transactions/{id}`, and `DELETE /transactions/{id}` to write exactly one `transaction_audit_logs` row in the same DB transaction as the mutation,
**so that** every change to a Transaction's history is captured without exception and without a separate write path a developer could forget to call.

**API:** No new endpoint — this is a side effect wired into F-06's existing three write endpoints.

### Main Flow
1. A User performs any of Create/Update/Delete against one of their own Transactions (F-06 US-01/US-04/US-05's own flows, unchanged).
2. Once F-06's own validation/ownership/business-rule checks pass and the Transaction row itself is about to be written (insert/update/soft-delete), the service also inserts one `transaction_audit_logs` row — same DB transaction, same commit/rollback boundary.
3. The Transaction mutation and the audit-log insert either both commit or both roll back.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-TAL-01 | Caller creates a new Transaction (F-06 S-TRX-01) | Create succeeds | One `transaction_audit_logs` row written: `action='create'`, `before=NULL`, `after={wallet_id, category_id, amount, type, note, occurred_at}` | Happy path |
| S-TAL-02 | Existing Transaction, `amount=200000` | Caller `PATCH`es `{ "amount": 300000 }` (F-06 S-TRX-36) | One row: `action='update'`, `before={"amount":200000}`, `after={"amount":300000}` | Only the changed field appears — no `category_id`/`note`/`occurred_at` keys in either object |
| S-TAL-03 | Existing Transaction, `amount=200000`, `category_id=<Food>` | Caller `PATCH`es `{ "amount": 250000, "category_id": "<Rent>" }` | One row: `before={"amount":200000,"category_id":"<Food>"}`, `after={"amount":250000,"category_id":"<Rent>"}` | Multiple changed fields in one entry, not two entries |
| S-TAL-04 | Existing Transaction, `type='expense'`, `amount=200000` | Caller `DELETE`s it (F-06 S-TRX-48) | One row: `action='delete'`, `before={wallet_id, category_id, amount:200000, type:'expense', note, occurred_at}`, `after=NULL` | Full snapshot at deletion time |
| S-TAL-05 | Caller's Wallet balance is 100,000 | Caller attempts to create an expense of 200,000 (F-06 S-TRX-09, `409 INSUFFICIENT_BALANCE`) | `409`; **no** `transaction_audit_logs` row written | ⚠️ Context #5 — a rejected mutation is never logged |
| S-TAL-06 | Existing Transaction owned by a different user | Caller attempts `PATCH`/`DELETE` on it (F-06 S-TRX-44/S-TRX-51, `403`) | `403`; **no** row written | Same as S-TAL-05 — the ownership check fails before any write is attempted |
| S-TAL-07 | Existing Transaction, `note="Lunch"` | Caller `PATCH`es `{ "note": "Lunch" }` (identical value, no actual change) | `200`; one row still written, `before={"note":"Lunch"}`, `after={"note":"Lunch"}` | ⚠️ Explicit assumption — logging is keyed on *which fields were present in the request*, not on whether the value actually differs; re-submitting the same value is indistinguishable from an intentional no-op confirmation and still gets an entry. See Open Questions #1. |

### Edge Cases
1. **The audit write happens inside the same DB transaction as the balance/row mutation** (Context #1) — implemented as one more statement inside F-06's existing transaction boundary, not a second `BeginTx`.
2. **`update`'s `before`/`after` only ever contain keys for fields present in that specific request body** (Context #4, S-TAL-02/S-TAL-03) — a service-level concern, computed from the same partial-update DTO F-06 US-04 already parses, not re-derived from a full-row diff.
3. **`transaction_id` is a plain FK with no cascade behavior that matters in practice**, because Transactions are never hard-deleted (F-06 Out of Scope) — there is no scenario where the referenced Transaction row disappears out from under an audit-log entry.
4. **Concurrent updates to the same Transaction each get their own entry, ordered by `created_at`** — no merging/coalescing of rapid successive edits into one entry, even if they happen within the same second (standard append-only log behavior, not a new invariant).

### Definition of Done
- Migration adds `transaction_audit_logs` with columns per Domain Fields above, `transaction_id`/`user_id` indexed for US-02's query pattern.
- `TransactionService.CreateTransaction`/`UpdateTransaction`/`DeleteTransaction` each insert exactly one audit-log row, inside their existing DB transaction, only on the success path.
- Unit tests (fake repo, mirroring F-06's own `fake_transaction_repo_test.go` convention): a rejected Create/Update/Delete (S-TAL-05, S-TAL-06 equivalents) asserts zero audit-log writes; a successful one asserts exactly one, with the expected `before`/`after` shape.

### Idempotency
N/A — this is a side effect of an already-defined operation, not an independently callable write.

---

## US-02: View my Transactions' audit history

**As a** User,
**I want** to see a list of what changed on my Transactions and when,
**so that** I can review my own edit/delete history (e.g. "did I actually delete this, or does it just look wrong").

**API:** `GET /transactions/audit-logs`

### Preconditions
- Caller is authenticated.

### Main Flow
1. User opens the audit log from Settings (`app/(app)/settings.tsx`'s new "Nhật ký giao dịch" row — see UI section below).
2. App calls `GET /transactions/audit-logs` with optional `transaction_id` (to scope to one Transaction's history — e.g. from a future "view history" entry point on a Transaction's own detail view, not built in this spec) and `cursor`/`limit`.
3. System fetches entries where `user_id = caller` (and `transaction_id = $filter` if provided), cursor-paginated, ordered `created_at DESC, id DESC`.
4. System returns `200` with the page of entries, each including denormalized `category_name`/`wallet_name` resolved the same "don't filter on the referenced row's own `deleted_at`" way F-06 US-02 already resolves `category_name` for its own list (Business invariant — a Category or Wallet referenced in old history may since be soft-deleted, and the log must still render legibly).

### Query Parameters

| Param | Type | Default | Notes |
|---|---|---|---|
| `transaction_id` | uuid | — | Must belong to caller if present, else `403 TRANSACTION_ACCESS_DENIED` |
| `cursor` | string | — | Opaque, encodes `{created_at, id}` of the last item |
| `limit` | int | 20 | Max 100, same convention as every other MVP list endpoint |

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-TAL-08 | Caller has 3 audit-log entries across 2 Transactions; another user has 5 | Caller calls `GET /transactions/audit-logs` | `200`; exactly the caller's 3 returned | User isolation |
| S-TAL-09 | Caller has 0 entries | Caller calls `GET /transactions/audit-logs` | `200`; `{ "data": [], "next_cursor": null }` | Not a `404` |
| S-TAL-10 | Caller has entries on 2 different Transactions | Caller calls `GET /transactions/audit-logs?transaction_id=<T1>` | `200`; only `<T1>`'s entries returned | Filter — happy path |
| S-TAL-11 | `transaction_id` belongs to a different user | Caller calls `GET /transactions/audit-logs?transaction_id=<other's>` | `403 TRANSACTION_ACCESS_DENIED` | Ownership check |
| S-TAL-12 | An entry's `after.category_id` references a Category since soft-deleted | Caller calls `GET /transactions/audit-logs` | `200`; that entry still resolves `category_name` (historical name), not blank/null | Mirrors F-06 S-TRX-30 |
| S-TAL-13 | No/invalid JWT | Caller calls `GET /transactions/audit-logs` | `401 UNAUTHENTICATED` | |
| S-TAL-14 | Caller has 25 audit-log entries | Caller calls `GET /transactions/audit-logs?limit=10` | `200`; 10 items, `next_cursor` set; following the cursor returns the next 10, then the last 5 | Pagination — happy path, mirrors F-06 S-TRX-29 |

### Response Shape
```json
{
  "data": [
    {
      "id": "uuid",
      "transaction_id": "uuid",
      "action": "update",
      "before": { "amount": 200000 },
      "after": { "amount": 300000 },
      "created_at": "2026-09-06T09:15:00Z"
    }
  ],
  "next_cursor": "eyJjcmVhdGVkX2F0IjouLn0="
}
```

### Edge Cases
1. **`before`/`after` field names that reference another entity (`category_id`, `wallet_id`) are stored as raw UUIDs inside the JSONB** — resolving those to a display name at read time is the handler/service's job (same denormalization-at-read pattern as `transactions.category_name`), not something baked into the stored JSON itself. This keeps old entries valid even if a display-name convention changes later.
2. **No date-range filter in this first version** — unlike F-06 US-02's `from`/`to`, this list is expected to be small per Transaction and infrequently browsed; cursor pagination alone is sufficient. See Open Questions #2.
3. **A Transaction with zero audit-log entries is impossible once this feature ships** (every Create produces one), but Transactions created *before* this feature shipped will legitimately have none — `GET /transactions/audit-logs?transaction_id=<pre-existing>` correctly returns an empty page, not an error.

### Definition of Done
- `GET /transactions/audit-logs` implemented, strictly scoped to `user_id = caller`, with optional `transaction_id` filter and cursor pagination.
- Integration tests for S-TAL-08 through S-TAL-13 pass.

### Idempotency
N/A — read-only (`GET`).

---

## UI (Mobile)

- **Entry point:** `mobile/app/(app)/settings.tsx` (renamed from `profile.tsx` this session) gets a new row, "Nhật ký giao dịch", alongside the existing "Developer" row — **recommended placement** (see Open Questions #3): the Transactions screen was just redesigned this session toward a denser, date-grouped layout, and an audit trail is a "check occasionally" view, not a primary action — same category as Developer settings, not a peer of Wallets/Categories/Household Members management.
- **Screen:** a day-grouped list (same `dayLabelVi`/SectionList pattern `transactions.tsx` already uses), each row showing the action (Tạo/Sửa/Xóa), a one-line summary of what changed (e.g. "Số tiền: 200.000 đ → 300.000 đ"), and a timestamp. No edit/undo affordance — this is a read-only history view.

## Out of Scope

- **Undo/revert from the audit log** — this spec is read-only history, not a time-travel/restore feature.
- **Logging reads (`GET /transactions`, `GET /transactions/{id}`)** — only the three mutating operations are logged; view access is not an auditable "change."
- **Admin cross-user audit visibility** — matches every other MVP feature's no-admin-UI precedent.
- **Logging Wallet-balance changes as their own entity** — the balance delta is implicit in the Transaction's own `before`/`after.amount`/`type`; there is no separate `wallet_audit_logs`.
- **Retention/pruning policy** — entries accumulate indefinitely in this spec, same as every other financial-record table (no cap, matching F-06's own "no limit on Transactions per User" precedent).

## Open Questions

1. **Should a no-op update (S-TAL-07 — same value re-submitted) be logged at all?** This spec resolves to "yes, log it" (simplest, most literal reading of "field was present in the request"), but a reasonable alternative is to diff old vs. new value first and skip the write when they're identical. Low priority — flag for product sign-off if audit-log noise becomes a real UX complaint.
2. **Should US-02 gain a `from`/`to` date-range filter later**, matching F-06 US-02's own? Deferred for now (Edge Case #2) since the expected volume per user is small; revisit if usage shows otherwise.
3. **Settings vs. Transactions screen placement** (the user's own open question): this spec recommends Settings, reasoning above. If product prefers a per-Transaction "view history" entry point instead (e.g. long-press a row in `transactions.tsx` → history), that's additive to this spec's `GET /transactions/audit-logs?transaction_id=` filter, not a redesign of it — confirm before mobile implementation.
