# Feature Spec: Transaction Export/Import (.xlsx) (extends F-06 Transaction Management, touches F-03 Wallet Management)

> Source: user request (this session) — export a date-ranged (optionally wallet-scoped) `.xlsx` of Transactions; import via a dry-run preview/commit flow mirroring the AI chat's own draft-confirmation principle (`specs/ai-chat-assistant/`). API shapes below (`GET /transactions/export`, `POST /transactions/import/preview`, `POST /transactions/import/commit`) and most edge cases were specified directly by the user; this document formalizes them, adds the scenarios/edge-case detail the project's spec format requires, and flags the decisions still needing explicit sign-off.
> Status: New — no code exists yet for this. **No `.xlsx` library exists in `backend/go.mod` today** — this spec requires adding one (e.g. `github.com/xuri/excelize/v2`), the first new Go dependency this feature area has needed.
> Related: [F-06 Transaction Management](../transaction-management/spec.md) (Import's commit step must reuse `TransactionService.CreateTransaction`'s exact balance-update logic path, not reimplement it — see Context #4), [F-03 Wallet Management](../wallet-management/spec.md) (wallet-name resolution on import; balance side effects), [Transaction Audit Log](../transaction-audit-log/spec.md) (if built, each imported row's Create should produce an audit-log entry exactly like any other Create — no bypass)

## Context

Users who already track spending elsewhere (a spreadsheet, another app) have no way to bring that history into PFM in bulk, and no way to get their PFM history *out* for backup or analysis. This spec adds three endpoints: a synchronous export, and a two-step import (preview → commit) that mirrors the AI chat feature's own "propose, then explicitly confirm" shape (`specs/ai-chat-assistant/` — a parsed action is never committed until the User confirms it) rather than writing rows the instant a file is uploaded.

**Resolved design decisions:**

1. **Amount columns in the `.xlsx` are major units (e.g. `80000` meaning 80,000 ₫), not integer cents.** Every other money value in this codebase (BIGINT cents, CLAUDE.md's own rule) is an internal/API representation; the moment money is shown to a human in a spreadsheet, it goes through the same `÷100` conversion `formatCurrency`/`toMajorUnits` already apply everywhere else in the UI (mobile `lib/currency.ts`). Exporting raw cents (`8000000` for a ₫80,000 lunch) would be the one place in the whole product that broke this convention. ⚠️ Flagged per BA money-rule: Export divides by 100 (`toMajorUnits`) writing the column; Import multiplies by 100 and rounds (`toCents`) reading it — these two conversions must be exact inverses of each other, or a round-trip export→import would silently drift by cents.
2. **The `Type` column is the display string `"Expense"`/`"Income"`, not the backend enum `"expense"`/`"income"`.** Matches the column sample in the request. Import must accept this case-insensitively (`"expense"`, `"Expense"`, `"EXPENSE"` all valid) and reject anything else as a row-level validation error (see Edge Cases).
3. **`Date` (the row's `occurred_at`) and `Created At` are distinct on both sides, exactly as F-06 already distinguishes them.** Export writes both (`Created At` is read-only historical metadata). Import reads and re-applies only `Date` → the new row's `occurred_at`; `Created At` (if present in an uploaded file, e.g. because the user is re-importing something they themselves exported) is **ignored** on import — a freshly-imported row's own `created_at` is always "now," since import *is* the row's actual creation event, no different from any other `POST /transactions`.
4. **Import's commit step never bypasses `TransactionService.CreateTransaction`.** Every valid row becomes one call into that exact same service method (balance-floor check for expenses, atomic wallet-balance mutation in the same DB transaction as the insert, category type-match check, the works) — not a bulk `INSERT` with a manually-computed batch balance delta. This is the single most important constraint in this spec (explicitly required by the user) because it's the only way Import can't accidentally diverge from Create's own business rules (e.g. accidentally skip the type-match check, or get the balance math wrong under concurrent imports).
5. **A deterministic, content-derived `idempotency_key` per row — never a random one — is what makes "duplicate → skip" (not error) actually work across repeated imports of the same file.** The uploaded `.xlsx` has no `idempotency_key` column (nothing in the request's column schema names one), so if Preview generated a *random* key per row, re-uploading the exact same file a second time would produce entirely different keys and duplicate every Transaction instead of skipping them — defeating the user's own stated edge case ("Duplicate với idempotency_key đã tồn tại → skip"). This spec resolves it as: `idempotency_key = UUIDv5(namespace, sha256(user_id ‖ wallet_id ‖ category_id ‖ amount ‖ type ‖ occurred_at ‖ note))`, computed once at Preview time and carried inside the signed `import_token` (Context #6) through to Commit. Re-importing the same file produces the same keys, and `transactions.idempotency_key`'s existing unique index (migration `010_transactions_idempotency_key.sql`) is what actually enforces the skip at the DB layer — Commit catches that specific conflict and reports it as `skipped`, not `errors`.
6. **`import_token` is a signed JWT with a distinct `purpose` claim, never usable as a Bearer access token.** Reuses the existing `golang-jwt v5` dependency and signing key, but its claims (`{ user_id, purpose: "transaction_import", rows: [...validated rows with their derived idempotency_key...], exp: now+5m }`) are structurally different from `AccessClaims` (`user_id`/`role` only, per `token_service.go`) — the auth middleware must keep validating exactly the access-token shape it already does, so an `import_token` presented as `Authorization: Bearer` fails the same way any other malformed JWT would. Commit independently re-validates `purpose == "transaction_import"` before trusting the token's contents, so a token minted for one purpose can never be replayed for another even if the signing key were ever shared across purposes (it isn't, but the explicit check costs nothing and removes the assumption).
7. **Category-not-found rows are rejected, never auto-created.** The user explicitly deferred this decision ("cần bạn chốt"). Resolved here as **reject** (error row, not imported) rather than silently creating a new Category from arbitrary spreadsheet text: an import file is an untrusted, error-prone bulk input, and letting it freely mint new entries in a User's Category taxonomy (which F-04 treats as a deliberately curated, small list — system-seeded plus whatever the User explicitly created via `POST /categories`) risks flooding it with typos and near-duplicates ("Food" vs "food " vs "Foods") that would then need manual cleanup. ⚠️ Flagged for explicit product sign-off anyway (Open Questions #1) since "auto-create" is a defensible alternative the user raised themselves.

Actors:
- **User** — exports/imports only their own Transactions/Wallets/Categories. No admin bulk-import-for-other-users capability.

## Preconditions (feature-level)

- Caller holds a valid access JWT.
- Export: at least one Wallet exists for the caller (an empty result is still valid — see Edge Cases).
- Import: at least one Wallet and one Category already exist for the caller — Import never creates Wallets, and (Context #7) never creates Categories either.

---

## US-01: Export Transactions to `.xlsx`

**As a** User,
**I want** to download my Transactions for a date range (optionally scoped to one Wallet) as a spreadsheet,
**so that** I can back them up or analyze them outside the app.

**API:** `GET /transactions/export?from={date}&to={date}&wallet_id={uuid, optional}`

### Preconditions
- Caller is authenticated.
- `from`/`to` are required, ISO 8601 dates (`YYYY-MM-DD`), `from ≤ to` — same validation shape as F-06 US-02's own `from`/`to` filters.

### Main Flow
1. User taps "Export" on the Transactions screen (optionally after applying the existing date-range/wallet filters — the export button reuses whatever range/wallet the user already has selected there, rather than being a separate unfiltered dump).
2. App calls `GET /transactions/export?from=...&to=...&wallet_id=...` (`wallet_id` omitted → all of the caller's Wallets).
3. System fetches the caller's non-deleted Transactions in range (same `user_id` scoping and `occurred_at` range semantics as F-06 US-02; if `wallet_id` given, must belong to the caller, else `403 WALLET_ACCESS_DENIED`), ordered `occurred_at ASC` (chronological, better for spreadsheet review than the app's own `DESC` list order).
4. System generates an `.xlsx` workbook, one row per Transaction, columns: `Date | Type | Amount | Currency | Category | Wallet | Note | Created At` (Context #1–#3 for exact column semantics).
5. System returns `200` with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and `Content-Disposition: attachment; filename="transactions_{from}_{to}.xlsx"`.

### Column Schema

| Column | Source | Format |
|---|---|---|
| `Date` | `occurred_at` | `YYYY-MM-DD` (date only — time-of-day is not exported, matching the sample) |
| `Type` | `type` | `"Expense"` \| `"Income"` (Context #2) |
| `Amount` | `amount` | Major units, i.e. `amount / 100` (Context #1) — always positive, sign is carried by `Type` |
| `Currency` | Transaction's Wallet's `currency` | ISO 4217 code, e.g. `"VND"` |
| `Category` | `category_name` | Resolved the same "don't filter on `deleted_at`" way F-06 US-02 already resolves it |
| `Wallet` | `wallet_name` | Same resolution |
| `Note` | `note` | Empty cell if `null` |
| `Created At` | `created_at` | `YYYY-MM-DD HH:mm:ss` UTC — read-only historical metadata (Context #3), not re-imported |

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-TXI-01 | Caller has 3 Transactions in range across 2 Wallets | Caller calls `GET /transactions/export?from=2026-01-01&to=2026-09-06` | `200`; `.xlsx` with 3 data rows | Happy path — all wallets |
| S-TXI-02 | Same as above | Caller calls with `&wallet_id=<W1>` | `200`; only W1's Transactions rows | Wallet-scoped export |
| S-TXI-03 | `wallet_id` belongs to a different user | Caller calls with that `wallet_id` | `403 WALLET_ACCESS_DENIED` | Ownership check |
| S-TXI-04 | Caller has 0 Transactions in range | Caller calls export | `200`; `.xlsx` with header row only, 0 data rows | Not a `404` — an empty result is still a valid (if boring) export |
| S-TXI-05 | — | Caller omits `from`/`to` | `400 INVALID_INPUT` | Required, unlike F-06 US-02's optional `from`/`to` — an unbounded export has no natural cap otherwise |
| S-TXI-06 | — | Caller calls with `from > to` | `400 INVALID_INPUT` | Same rule as F-06 US-02 |
| S-TXI-07 | Caller's Transactions span 2 different Wallets with different currencies (e.g. VND and USD) | Caller calls export with no `wallet_id` | `200`; both currencies appear correctly in their own rows' `Currency` column, no conversion/mixing attempted | ⚠️ Never sum or convert across currencies — this is a row-level export, not an aggregate, so the multi-currency concern that affects budget/report totals elsewhere in this codebase doesn't actually apply here, but is worth stating explicitly since it's the first "money across a whole date range" feature since Financial Reporting |
| S-TXI-08 | No/invalid JWT | Caller calls export | `401 UNAUTHENTICATED` | |

### Edge Cases
1. **Large exports are still a single synchronous response** — no background job/polling in this spec. Given the "50k transactions is more than enough for 20 users" sizing note the user themselves gave, a synchronous in-memory `.xlsx` build is assumed sufficient; revisit if real usage proves otherwise (Open Questions #3).
2. **A Transaction whose Category or Wallet was since soft-deleted still exports with its historical name** — same non-obvious rule F-06 US-02/US-03 already established for reads, restated here because export is a new read path that could easily re-introduce the "filters out soft-deleted" mistake if implemented independently.

### Definition of Done
- `GET /transactions/export` implemented, correct `Content-Type`/`Content-Disposition`, column order/format exactly as specified.
- Integration tests for S-TXI-01 through S-TXI-08 pass.
- A test explicitly asserts `Amount` in the generated file is major units, not raw cents (Context #1).

### Idempotency
N/A — read-only (`GET`), naturally idempotent; the same range always regenerates the same file (modulo any Transactions created/edited/deleted since the last call).

---

## US-02: Preview an import (dry-run, no writes)

**As a** User,
**I want** to upload an `.xlsx` file and see exactly what would be imported and what would fail, before anything is actually saved,
**so that** I can fix mistakes in my spreadsheet without risking bad data landing in my account.

**API:** `POST /transactions/import/preview` (multipart, `file=<.xlsx>`)

### Preconditions
- Caller is authenticated.
- File is present, `.xlsx` (by content-type/magic-bytes, not just filename extension — see Edge Cases #3), ≤ 5MB.

### Main Flow
1. User picks an `.xlsx` file (mobile: a file-picker sheet on the Transactions screen's new "Import" entry point).
2. App calls `POST /transactions/import/preview` with the file.
3. System rejects upfront (before parsing) if the file exceeds 5MB or isn't a `.xlsx`.
4. System parses each data row (header row + one row per Transaction), validating independently per row (a bad row never blocks other valid rows in the same file):
   - `Date` parses as `YYYY-MM-DD` → else row error.
   - `Type` is `"Expense"`/`"Income"` case-insensitively → else row error.
   - `Amount` parses as a number, is `> 0` → else row error (Context #1: negative or zero rejected, same money rule as F-06 US-01).
   - `Wallet` matches exactly one of the caller's own Wallets by name (case-insensitive) → else row error (not found, or ambiguous if 2+ of the caller's Wallets share that name — see Edge Cases #2).
   - `Category` matches exactly one of the caller's visible Categories (system + own) by name and matching `Type` → else row error (Context #7: never auto-created).
   - `Currency` (if present) must match the resolved Wallet's own currency, or the row is an error — a mismatched currency on an otherwise-valid row is not silently corrected.
5. System computes each valid row's deterministic `idempotency_key` (Context #5) and checks it against `transactions.idempotency_key` — if it already exists, the row is marked in a separate `duplicates` bucket (skip, not error — Context #5), not committed and not counted as a validation failure.
6. System mints a 5-minute `import_token` (Context #6) carrying exactly the rows that passed step 4 and are not duplicates from step 5.
7. System returns `200` with `{ valid: [...], duplicates: [...], errors: [{row, reason}], import_token }`.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-TXI-09 | A well-formed 10-row file, all rows resolve cleanly | Caller calls preview | `200`; `valid` has 10 entries, `errors` empty, `import_token` present | Happy path |
| S-TXI-10 | A row's `Wallet` column says `"Cash"` but the caller has no Wallet named that | Caller calls preview | `200`; that row appears in `errors` with `reason` naming the unmatched wallet, others in `valid` | Row-level isolation — one bad row doesn't fail the whole file |
| S-TXI-11 | Caller owns two Wallets both named `"Savings"` (Wallet names aren't unique — F-03 has no name-uniqueness constraint) | A row's `Wallet` column says `"Savings"` | `200`; that row is an `errors` entry, reason = ambiguous match | ⚠️ Genuine edge case — unlike Category (unique per user+type), nothing stops two Wallets sharing a name |
| S-TXI-12 | A row's `Category` column says `"Groceries"` but the caller has no such Category | Caller calls preview | `200`; row in `errors`, reason names the category | Context #7 — never auto-created |
| S-TXI-13 | A row's `Amount` is `-50000` | Caller calls preview | `200`; row in `errors`, reason states amount must be positive | |
| S-TXI-14 | A row's `Date` is `"13/45/2026"` (invalid) | Caller calls preview | `200`; row in `errors`, reason names the row number and the bad value | Report must name the row number explicitly, per user's own requirement |
| S-TXI-15 | Caller re-uploads the exact same file they successfully imported yesterday | Caller calls preview | `200`; every row appears in `duplicates`, `valid` is empty, `import_token`'s row list is empty | Context #5 — deterministic idempotency_key already exists in DB |
| S-TXI-16 | File is 8MB | Caller calls preview | `413` (or `400`, see Open Questions #4) rejected before parsing | Fast-fail, no partial parse attempted |
| S-TXI-17 | File is a renamed `.csv` (wrong content) with a `.xlsx` extension | Caller calls preview | `400 INVALID_INPUT` — unparseable as `.xlsx` | Content-based validation, not filename-based (Edge Cases #3) |
| S-TXI-18 | No/invalid JWT | Caller calls preview | `401 UNAUTHENTICATED` | |

### Edge Cases
1. **Validation is per-row and independent** — a file with 100 rows where 3 fail still returns 97 in `valid` (or `duplicates`) and 3 in `errors`; the client decides whether to proceed with the 97 (Commit only ever imports what's inside the `import_token`, which only ever contains `valid` rows).
2. **Ambiguous Wallet-name matches are errors, not "pick the first one"** (S-TXI-11) — silently guessing which of two same-named Wallets the user meant risks money landing in the wrong account, which this spec treats as unacceptable even though it's a rarer case than "not found."
3. **File-type validation must inspect actual content** (magic bytes / successfully parsing as a `.xlsx` zip+XML structure), not just trust the filename's extension or the client-supplied `Content-Type` header — both are trivially spoofable and this is an upload endpoint accepting arbitrary user files.
4. **`Currency` column mismatch is a row error, not a silent override** — if a User's spreadsheet says `"USD"` but the matched Wallet is actually VND, this spec treats that as a data-quality problem to surface, not something to auto-correct by ignoring the file's own column.

### Response Shape
```json
{
  "valid": [
    { "row": 2, "wallet_id": "uuid", "category_id": "uuid", "amount": 8000000, "type": "expense", "occurred_at": "2026-09-01", "note": "Lunch" }
  ],
  "duplicates": [ { "row": 5, "reason": "already imported" } ],
  "errors": [ { "row": 3, "reason": "wallet 'Cash' not found" } ],
  "import_token": "eyJhbGciOi..."
}
```

### Definition of Done
- `POST /transactions/import/preview` implemented; never writes to `transactions`/`wallets` — a dry-run in the literal sense (no DB write statements outside the idempotency-key existence check, which is read-only).
- Row-level validation covers every case in Context #7 and Edge Cases #1–#4 above.
- Integration tests for S-TXI-09 through S-TXI-18 pass.

### Idempotency
The endpoint itself is safe to call repeatedly (read-only against existing data, no side effects) — repeated calls with the same file return the same `valid`/`errors`/`duplicates` classification (modulo any Transactions/Wallets/Categories the caller changes between calls) and a fresh `import_token` each time.

---

## US-03: Commit a previewed import

**As a** User,
**I want** to confirm the import I just previewed and have exactly those rows actually saved,
**so that** nothing is written unless I explicitly approved what preview showed me.

**API:** `POST /transactions/import/commit` (body: `{ "import_token": "..." }`)

### Preconditions
- Caller is authenticated.
- `import_token` is present, structurally valid, unexpired, `purpose == "transaction_import"`, and its embedded `user_id` matches the caller (Context #6).

### Main Flow
1. User reviews the preview result in-app (mirroring `TransactionActionCard`'s own confirm affordance in AI chat) and taps "Confirm Import."
2. App calls `POST /transactions/import/commit` with the `import_token` from the preview response — no file is re-uploaded.
3. System validates the token (signature, expiry, purpose, caller match) — any failure here is a client error, not a partial commit.
4. For each row inside the token, System calls `TransactionService.CreateTransaction` exactly as `POST /transactions` would (Context #4) — including the balance-floor check for expenses, atomic wallet-balance mutation, category type-match check, and (if the Transaction Audit Log feature exists) its own audit-log write. Each row's derived `idempotency_key` (carried in the token) is passed through, so a row whose key was raced into existence by something else since Preview is caught by the same unique-index conflict and reported as `skipped`, not a hard failure of the whole commit.
5. System returns `200` with `{ imported: <count>, skipped: <count>, failed: <count> }` once every row in the token has been attempted — `skipped` is a row whose derived `idempotency_key` already existed (an intentional no-op, e.g. a repeat commit), `failed` is a row that failed for any other reason at commit time (e.g. a balance-floor rejection from a race since Preview, S-TXI-23) — resolved during planning (`plan.md` Finding #10) once `CreateTransaction`'s real return shape (`wasReplay bool` distinguishing "replayed" from every other outcome) made the two cases mechanically distinguishable, closing Open Questions #6 below.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-TXI-19 | A valid, unexpired `import_token` for 10 rows, none pre-existing | Caller calls commit | `200`; `{ imported: 10, skipped: 0, failed: 0 }`; 10 new Transactions exist, Wallet balances updated exactly as 10 individual `POST /transactions` calls would have | Happy path |
| S-TXI-20 | `import_token` is more than 5 minutes old | Caller calls commit | `401 UNAUTHENTICATED` (Open Questions #5); nothing imported | Forces a fresh preview rather than committing a stale view of the caller's Wallets/Categories |
| S-TXI-21 | `import_token` was minted for a different user (tampered/replayed) | Caller calls commit | `403`; nothing imported | Context #6 — `user_id` embedded in the token must match the caller |
| S-TXI-22 | Caller commits the same `import_token` twice (double-tap) | Second commit call | `200`; `{ imported: 0, skipped: 10, failed: 0 }` — every row's `idempotency_key` now already exists from the first commit | ⚠️ This is exactly what Context #5's deterministic-key design is for — a double-submit is a no-op, not a duplicate |
| S-TXI-23 | One row in the token would, if committed, exceed its Wallet's available balance (an expense whose Wallet balance dropped since Preview, e.g. from a separate transaction created in the meantime) | Caller calls commit | `200`; `{ imported: 9, skipped: 0, failed: 1 }` — that one row is `failed` (its own bucket, distinct from `skipped`), the other 9 still commit | Each row's `CreateTransaction` call is independent; one row's `409 INSUFFICIENT_BALANCE` doesn't abort the batch |
| S-TXI-24 | A row would drive its Wallet's balance negative (no `CHECK` constraint, migration `008` — by design) but doesn't fail the balance-floor check (e.g. it's an income row, or an expense within the current balance) | Caller calls commit | Row imports normally, resulting negative-or-positive balance stands, no special handling | Explicitly allowed per the user's own requirement — mirrors F-06's existing "Update/Delete may drive balance negative" precedent, extended here to Import |
| S-TXI-25 | No/invalid JWT | Caller calls commit | `401 UNAUTHENTICATED` | |

### Edge Cases
1. **Commit processes rows independently, not as one all-or-nothing DB transaction across the whole file** — each row gets its own `CreateTransaction` call (Context #4), so a single row's `409 INSUFFICIENT_BALANCE` (S-TXI-23) doesn't roll back the rows that already committed. This is a deliberate departure from "the whole import is one transaction," because the user's own spec explicitly wants `{imported, skipped}` counts back, implying partial success is an expected, reportable outcome, not a failure mode.
2. **The `import_token` is single-use in effect, not by explicit revocation** — nothing marks a token "already committed" server-side; a second commit call (S-TXI-22) simply re-attempts every row and finds them all already `skipped` via the replay signal `TransactionService.CreateTransaction` already reports for a reused `idempotency_key`. Simpler than maintaining token-consumption state, and produces the same observable behavior (a repeat commit imports nothing new).
3. **A commit call never re-validates Wallet/Category existence/ownership from scratch** beyond what `CreateTransaction` itself already checks on every call — if a Wallet or Category referenced by the token was deleted between Preview and Commit, that row simply fails `CreateTransaction`'s own existing `404`/`403` checks and is reported as an error for that row (not a token-level failure), same as S-TXI-23's balance case.

### Definition of Done
- `POST /transactions/import/commit` implemented; every row goes through `TransactionService.CreateTransaction` unmodified (Context #4) — a code-review-level check, since this is the single easiest place to accidentally regress toward a bypassing bulk-insert.
- Integration tests for S-TXI-19 through S-TXI-25 pass.
- A test explicitly asserts double-committing the same token (S-TXI-22) is a no-op, not a duplicate-row bug.

### Idempotency
**Idempotent in effect via the deterministic `idempotency_key` (Context #5)** — committing the same token (or re-previewing+committing the same file) any number of times converges to the same set of actually-created Transactions; repeat calls report growing `skipped` counts, never duplicate rows.

---

## UI (Mobile)

- **Export:** a button on the Transactions screen (near the existing filter row), scoped to whatever `from`/`to`/`wallet_id` filter is currently applied; downloads/shares the returned `.xlsx` via the platform share sheet (`expo-sharing`, not yet a dependency — new addition).
- **Import:** a second entry point on the same screen (or Settings, for symmetry with wherever Export lives — confirm placement alongside the Audit Log feature's own Settings-vs-Transactions question). Picks a file (`expo-document-picker`, new dependency), calls Preview, then renders the `valid`/`duplicates`/`errors` breakdown as a review screen — mirroring `TransactionActionCard`'s "here's what I parsed, confirm to save" pattern from AI chat — with a single "Confirm Import" button that calls Commit with the returned `import_token`.

## Out of Scope

- **Editing rows inside the preview UI before committing** — a row that errors must be fixed in the source spreadsheet and re-uploaded; there is no in-app row-editing/retry-single-row flow in this spec.
- **Importing into a new Wallet or Category created as part of the same operation** — both must already exist (Context #7 for Category; Wallet was never proposed to be auto-created either).
- **CSV or any format other than `.xlsx`** — matches the user's own request; no other format is in scope.
- **Scheduled/recurring import (e.g. syncing from an external source periodically)** — this is a manual, one-shot, User-initiated action only.
- **Export formats other than `.xlsx`** (PDF, CSV) — not requested.
- **A UI to browse/manage past import batches** (e.g. "you imported this file 3 days ago, 47 rows") — Commit's response is the only record of an import batch; if the Transaction Audit Log feature ships, each imported row's own audit entry is the closest thing to that history, but there's no batch-level grouping.

## Open Questions

1. **Category-not-found: reject (this spec's resolution) vs. auto-create.** Explicitly deferred by the user; resolved here as reject (Context #7) with reasoning given. **Needs explicit product sign-off before implementation** — this is the single most consequential open call in this spec.
2. **Should a mismatched `Currency` column (Edge Cases #4) be a hard error, or should the system just trust the resolved Wallet's own currency and ignore the file's column entirely?** This spec resolves to "hard error" (surfacing a possible data-entry mistake rather than silently discarding a column the user filled in), but "ignore the column, Wallet is authoritative" is a simpler, equally defensible alternative.
3. **Export size ceiling**: this spec assumes a synchronous single-response build is fine at the sizes implied ("50k transactions is more than enough for 20 users"). If usage ever approaches that, a synchronous multi-MB `.xlsx` generation could become a real latency/memory concern — no async/job-queue export is designed here; revisit if it becomes a problem.
4. **Exact HTTP status for "file too large"**: resolved during planning (`plan.md` Finding #9) as `400 INVALID_INPUT`, matching the existing `WalletHandler.UploadIcon` precedent, rather than introducing `413`.
5. **Exact error code for an expired `import_token`**: resolved during planning (`plan.md` Finding #9) as a plain `401 UNAUTHENTICATED`, reusing existing semantics rather than adding a dedicated `IMPORT_TOKEN_EXPIRED` code. Revisit if product wants a more specific mobile-client message later.
6. **Response shape for a row that fails at Commit time despite passing Preview** (S-TXI-23, e.g. a balance race): **resolved** — `plan.md` Finding #2/#10 found that `TransactionService.CreateTransaction`'s real existing return shape (`wasReplay bool`) already distinguishes "replayed" (→ `skipped`) from every other outcome (→ `failed`) for free, so this spec now defines three buckets (`imported`/`skipped`/`failed`, see US-03 step 5) instead of two.
