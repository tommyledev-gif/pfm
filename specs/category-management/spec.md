# Feature Spec: F-04 Category Management (MVP)

> Source: `SRS.md` Feature-04, `SDS.md` §2.1.3 (Category domain object) / §5.4 (empty skeleton — no ACs defined there), `CLAUDE.md` MVP Features table
> Status: MVP — blocks F-05 Budget Management (`budgets.category_id`) and F-06 Transaction Management (`transactions.category_id`); both cannot be specced/built without a `categories` table existing
> Related: [F-01 User Management](../user-management/spec.md) (category owner, for user-defined categories), [F-03 Wallet Management](../wallet-management/spec.md) (sibling MVP domain feature, same auth/ownership pattern)

## Context

Phase 0 (User Management + System Security) and F-03 (Wallet Management) are implemented. Category Management is the next feature to spec, per the CLAUDE.md MVP Features table ordering (F-03 → F-04 → F-05 → F-06) and because both F-05 Budget and F-06 Transaction have a mandatory `category_id` foreign key that cannot exist without this spec landing first.

A Category classifies Transactions for budgeting and reporting purposes (e.g. Food, Salary, Rent). Per SDS §2.1.3, a Category is either:
- **System-defined** (`user_id IS NULL`) — shared, seeded reference data visible to every User (e.g. "Food", "Salary"), analogous to how `wallets` has no such shared row but `categories` explicitly does per the domain model.
- **User-defined** (`user_id` set) — private to the User who created it, not visible to any other User.

Every Category has a `type` (`income` | `expense`) that constrains which kind of Transaction it can classify — this mirrors the Wallet `type` enum pattern from F-03 and is what allows F-06 Transaction creation to validate "category type must match transaction type" and F-05 Budget to make "budget spending vs. limit" meaningful (a Budget only makes sense against an `expense` category — see Open Questions #4).

Actors:
- **User** — any `active` user (`role = admin` or `member`); User-defined categories are personal, not shared. There is no admin-facing category-management UI in MVP (see Open Questions #5) — system categories are seeded via migration only, not created through this API.

## Preconditions (feature-level)

- Caller holds a valid access JWT (`role` irrelevant — every active user manages their own categories identically; system categories are read-only to everyone).
- `categories` table exists per the schema below (**new migration required** — does not yet exist; current migrations are `001_init.sql` (users), `002_seed_admin.sql`, `003_revoked_tokens.sql`, `004_wallets.sql`).

### Key Entity (conceptual — full schema/index design belongs in `plan.md`)

This extends the `categories` entity already named in CLAUDE.md's Core DB Schema; this spec does not restate its column-level definition beyond what's needed for the business rules below.

| Field | Meaning |
|---|---|
| `id` | Unique identifier |
| `user_id` | Owner; `NULL` means system-defined (shared, visible to every User) |
| `name` | Display label (e.g. "Food", "Salary") |
| `icon` | Client-rendered glyph/key — free-form, no server-side meaning |
| `type` | `income` or `expense` — the kind of Transaction this Category can classify |
| `created_at` | Creation time |
| `deleted_at` | Soft-delete marker; `NULL` while active (no `updated_at` — this spec follows CLAUDE.md's Core DB Schema table, which does not list one for `categories`; see Open Questions #6) |

**Business invariant**: a Category's `type` is immutable once set at creation — see US-04 Edge Cases for rationale (mirrors the Wallet `currency`-lock pattern from F-03, but stricter: `type` can never change, not even before any Transaction exists against it, because a Category's very purpose is to bucket by type for reporting).

**Business invariant**: system categories (`user_id IS NULL`) can never be updated or deleted through this User-facing API — only a User's own (`user_id = caller`) categories are mutable by that User. This must be enforced at the service layer on every write endpoint.

---

## US-01: Create a Category [MVP]

**As a** User,
**I want** to create a Category with a name, icon, and type,
**so that** I can classify my Transactions in a way that fits my own spending habits, beyond the system defaults.

**API:** `POST /categories`

### Preconditions
- Caller is authenticated.
- Request body: `{ name: string, icon?: string, type: "income"|"expense" }`. `icon` is optional (client may render a default glyph when absent).

### Main Flow
1. User submits the category creation form (name, optional icon, type).
2. System validates shape: `name` non-empty and ≤ 50 chars, `type` is exactly `"income"` or `"expense"` (handler-level).
3. System checks for a case-insensitive duplicate: an existing category visible to this caller (system OR their own) with the same `name` **and** same `type` (service-level — see Edge Cases #2).
4. System creates the `categories` row with `user_id = caller`.
5. System returns `201` with the created category object.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-CAT-01 | Caller has no category named "Groceries" (system or own) | Caller creates `{ name: "Groceries", type: "expense" }` | `201`; category created with `user_id = caller` | Happy path |
| S-CAT-02 | — | Caller submits `{ name: "" , type: "expense" }` | `400 INVALID_INPUT` | Validation error (client mistake) |
| S-CAT-03 | — | Caller submits `{ name: "Food", type: "food" }` (not a valid enum) | `400 INVALID_INPUT` | Validation error |
| S-CAT-04 | A system category "Food" (`type = expense`) already exists | Caller creates `{ name: "food", type: "expense" }` (different case) | `409 CATEGORY_ALREADY_EXISTS` | ⚠️ Case-insensitive collision against a *system* category, not just the caller's own — see Edge Cases #2 |
| S-CAT-05 | Caller already has their own category "Side Hustle" (`type = income`) | Caller creates `{ name: "Side Hustle", type: "income" }` again | `409 CATEGORY_ALREADY_EXISTS` | Duplicate against caller's own prior category |
| S-CAT-06 | Caller already has "Rent" as `type = expense` | Caller creates `{ name: "Rent", type: "income" }` | `201`; created — different `type` is a different logical category | Same name, different type, is **not** a collision (Edge Cases #3) |
| S-CAT-07 | No/invalid JWT | Caller calls `POST /categories` | `401 UNAUTHENTICATED` | Authentication failure |

### Edge Cases
1. **No cap on user-defined categories per User** in MVP — a User could create dozens of near-duplicate categories; no de-duplication UI/suggestion beyond the exact-name-collision check in step 3. Flagged as a UX gap, not a data-integrity one — see Open Questions #1.
2. **Duplicate check spans system + own categories, not just own**: a User cannot create "food" if the system already seeded "Food" (case-insensitive, same `type`) — this prevents a confusing UI where two visually-identical categories both appear in the same picker. The uniqueness scope is **not** global across all Users' private categories (two different Users can each have their own "Side Hustle" — no cross-user collision).
3. **Same name, different type, is allowed and is not a duplicate** — "Rent" as an expense and "Rent" as income (e.g. a landlord User tracking rental income) are legitimately different Categories; the uniqueness key is `(name lowercased, type)`, not `name` alone.
4. **`icon` has no server-side allow-list in MVP** — any string is accepted and stored as-is; the App is responsible for rendering it sensibly (e.g. an emoji or a known icon-font key). No validation beyond a reasonable max length. See Open Questions #2.

### Definition of Done
- `POST /categories` implemented with handler-level shape validation and the service-level `(name, type)` case-insensitive duplicate check spanning system + own categories.
- The duplicate-check uniqueness is enforced at the data layer via a partial unique index (not application logic alone), consistent with the F-03 precedent for the one-default-wallet invariant, to protect against concurrent double-submit.
- Unit tests for S-CAT-02, S-CAT-03 pass. Integration tests for S-CAT-01, S-CAT-04, S-CAT-05, S-CAT-06 pass.

### Idempotency
Not idempotent — no idempotency key defined; each call creates a new category unless blocked by the duplicate check. The duplicate check acts as an incidental safety net against double-submit for the *exact same* `(name, type)` pair, but is a business rule, not a formal idempotency mechanism.

---

## US-02: View a List of Categories [MVP]

**As a** User,
**I want** to see all Categories available to me — both system defaults and my own,
**so that** I can pick one when recording a Transaction or setting a Budget.

**API:** `GET /categories`

### Preconditions
- Caller is authenticated.
- Optional query parameter: `type=income|expense` to filter.

### Main Flow
1. User opens a Category picker (e.g. while creating a Transaction).
2. App calls `GET /categories` (optionally with `?type=expense`).
3. System returns all non-deleted categories where `user_id IS NULL` (system) **or** `user_id = caller`, optionally filtered by `type`, ordered `user_id IS NULL DESC, name ASC` (system categories first, then the caller's own, alphabetically within each group).

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-CAT-08 | 5 system categories exist; caller has 2 of their own; another User has 3 of their own | Caller calls `GET /categories` | `200`; exactly 7 categories returned (5 system + caller's own 2) — the other User's 3 are never included | User isolation for private categories — ⚠️ cross-user leak would be critical |
| S-CAT-09 | System has 3 `expense` and 2 `income` categories; caller has 1 `expense` category of their own | Caller calls `GET /categories?type=expense` | `200`; 4 categories returned (3 system-expense + caller's 1 expense); no `income` categories present | Type filter applies uniformly to system and own |
| S-CAT-10 | Caller has 0 user-defined categories | Caller calls `GET /categories` | `200`; only system categories returned, never an empty list (assuming ≥1 system category is seeded) | Not a 404 |
| S-CAT-11 | No/invalid JWT | Caller calls `GET /categories` | `401 UNAUTHENTICATED` | |
| S-CAT-12 | Caller has 1 active + 1 soft-deleted user-defined category | Caller calls `GET /categories` | `200`; only the 1 active category returned | Soft-deleted rows excluded unconditionally |
| S-CAT-13 | Caller passes `?type=savings` (not a valid enum value) | Caller calls `GET /categories?type=savings` | `400 INVALID_INPUT` | Handler-level query-param validation |

### Response Shape
```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": null,
      "name": "Food",
      "icon": "🍔",
      "type": "expense",
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": "uuid",
      "user_id": "caller-uuid",
      "name": "Side Hustle",
      "icon": "💼",
      "type": "income",
      "created_at": "2026-07-15T09:00:00Z"
    }
  ]
}
```

### Edge Cases
1. **No pagination for MVP**: like Wallets, a personal User's own category count is expected to be small (single/low-double digits); system categories are a small fixed seed list. **Explicit assumption**; revisit if usage data shows otherwise.
2. **`user_id: null` is exposed in the response** so the client can visually distinguish "system default" from "my own" categories (e.g. show a lock icon on system ones, since they can't be edited/deleted — US-04/US-05).
3. **Query filter is an allow-listed enum, not a free-text pass-through** — `type` must be validated against `{income, expense}` before hitting the query, to avoid an invalid value silently returning an empty/wrong result set.

### Definition of Done
- `GET /categories` implemented, returning `user_id IS NULL OR user_id = caller`, with optional `type` filter.
- Unit test asserts a category belonging to a different `user_id` is never present in another caller's response.
- Integration tests for S-CAT-08, S-CAT-09, S-CAT-12, S-CAT-13 pass.

### Idempotency
N/A — read-only (`GET`), naturally idempotent.

---

## US-03: View a Category

**As a** User,
**I want** to view the details of a single Category,
**so that** I can confirm its type and metadata before using it elsewhere (e.g. editing it, or checking before setting a Budget).

**API:** `GET /categories/{id}`

### Preconditions
- Caller is authenticated.
- `{id}` is a UUID path parameter.

### Main Flow
1. User selects a Category from the list (or the App fetches it directly by ID).
2. App calls `GET /categories/{id}`.
3. System fetches the category, verifies it is non-deleted and either `user_id IS NULL` (system) or `user_id = caller`.
4. System returns `200` with the category object (same shape as the list item).

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-CAT-14 | Category is a system category | Caller calls `GET /categories/{id}` | `200`; category object returned | Happy path — system categories are visible to everyone |
| S-CAT-15 | Category exists, owned by caller | Caller calls `GET /categories/{id}` | `200`; category object returned | Happy path |
| S-CAT-16 | Category exists, owned by a *different* user (not system) | Caller calls `GET /categories/{id}` with that category's UUID | `403 CATEGORY_ACCESS_DENIED` | Ownership check — not `404`, since category IDs are unguessable UUIDv4s, matching the F-03 `WALLET_ACCESS_DENIED` precedent |
| S-CAT-17 | No category with that ID exists (or it is soft-deleted) | Caller calls `GET /categories/{id}` | `404 CATEGORY_NOT_FOUND` | Distinct from S-CAT-16 |
| S-CAT-18 | `{id}` path segment is not a valid UUID | Caller calls `GET /categories/abc` | `400 INVALID_INPUT` | Handler-level shape validation, before any DB lookup |

### Edge Cases
1. **System categories are a third visibility case beyond "own" vs. "someone else's"** — the ownership check must special-case `user_id IS NULL` as always-visible, not just compare `user_id = caller`.
2. **Soft-deleted category accessed by its own owner** is treated identically to not-found (`404`) — no "restore" flow in this spec (see Out of Scope).

### Definition of Done
- `GET /categories/{id}` implemented with a three-way visibility check: system (always visible), own (visible), other User's (403).
- Unit tests for S-CAT-16, S-CAT-17, S-CAT-18 pass. Integration tests for S-CAT-14, S-CAT-15 pass.

### Idempotency
N/A — read-only (`GET`), naturally idempotent.

---

## US-04: Update a Category

**As a** User,
**I want** to edit the name or icon of a Category I created,
**so that** I can correct a mistake or personalize it further.

**API:** `PATCH /categories/{id}`

### Preconditions
- Caller is authenticated and owns the category (`user_id = caller`).
- Request body: `{ name?: string, icon?: string }` — **`type` is never accepted by this endpoint** (see Edge Cases).

### Main Flow
1. User edits the category's name and/or icon from a Category Details screen.
2. System validates shape: at least one of `name`/`icon` present; same field-level rules as US-01 (handler-level).
3. System verifies the category is non-deleted and `user_id = caller` (system categories are rejected here — see Edge Cases #1).
4. System re-checks the `(name, type)` duplicate rule from US-01 if `name` is being changed (service-level).
5. System applies the partial update.
6. System returns `200` with the updated category object.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-CAT-19 | Category exists, owned by caller | Caller submits `{ "name": "Groceries" }` | `200`; `name` updated, `type`/`icon` unchanged | Happy path |
| S-CAT-20 | Category is a **system** category | Caller submits any valid update to it | `403 CATEGORY_ACCESS_DENIED` | ⚠️ Critical: system categories are read-only to every User, including whoever is calling — no User "owns" them, so this is a 403, not a 404 (the resource is visible, just not writable) |
| S-CAT-21 | Category exists, owned by caller | Caller submits `{ "type": "income" }` | `400 INVALID_INPUT` (unknown/disallowed field) | ⚠️ Critical: `type` must be structurally rejected, not silently ignored, mirroring the F-03 `balance`-field-rejection precedent (S-WAL-20) — see Open Questions #3 |
| S-CAT-22 | Caller has category "Food" (`expense`); caller also has "Snacks" (`expense`) | Caller renames "Snacks" to `{ "name": "Food" }` | `409 CATEGORY_ALREADY_EXISTS` | Re-triggers the US-01 duplicate rule on rename |
| S-CAT-23 | Category exists, owned by a *different* user | Caller submits any valid update | `403 CATEGORY_ACCESS_DENIED` | Ownership check |
| S-CAT-24 | No category with that ID (or soft-deleted) | Caller submits an update | `404 CATEGORY_NOT_FOUND` | |
| S-CAT-25 | Category exists, owned by caller | Caller submits `{}` (empty body) | `400 INVALID_INPUT` | Nothing to update — client mistake, not a no-op `200` |

### Edge Cases
1. **System-category immutability is absolute, with no exception path** — unlike F-03's conditional currency lock (which only activates after Transactions exist), a system category can *never* be edited by any User through this endpoint, from the moment it's seeded. There is no admin-override endpoint in this spec (see Out of Scope).
2. **`type` is structurally excluded from the update DTO**, not merely validated away — mirrors the F-03 `balance`-exclusion precedent, because changing a Category's type after Transactions/Budgets already reference it would silently corrupt historical income/expense classification with no correction path.
3. **Rename collision check reuses the exact US-01 duplicate rule** (case-insensitive, scoped to `(name, type)`, spanning system + own) — renaming into an existing name is blocked exactly like creating a fresh duplicate would be.

### Definition of Done
- `PATCH /categories/{id}` implemented; request DTO has no `type` field at the type level; system categories (`user_id IS NULL`) always return `403` on any write attempt.
- Unit tests for S-CAT-20 through S-CAT-25 pass. Integration test for S-CAT-19 passes.

### Idempotency
Idempotent in effect — re-submitting the same `{ name, icon }` payload repeatedly converges to the same end state, though there is no explicit idempotency key.

---

## US-05: Delete a Category

**As a** User,
**I want** to delete a Category I created and no longer use,
**so that** my Category list stays relevant and uncluttered.

**API:** `DELETE /categories/{id}`

### Preconditions
- Caller is authenticated and owns the category (`user_id = caller`).

### Main Flow
1. User taps "Delete" on one of their own categories.
2. System verifies the category is non-deleted and `user_id = caller` (system categories are rejected — same as US-04).
3. **Business rule**: System checks whether any non-deleted Budget currently references this category (service-level).
4. If a Budget references it, System rejects the delete. Otherwise, System soft-deletes the category (`deleted_at = NOW()`).
5. System returns `200` confirming deletion.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-CAT-26 | Category exists, owned by caller, no Budget references it | Caller calls `DELETE /categories/{id}` | `200`; category soft-deleted (`deleted_at` set); no longer appears in `GET /categories` | Happy path |
| S-CAT-27 | Category exists, owned by caller, and has ≥1 active Budget set against it | Caller calls `DELETE /categories/{id}` | `409 CATEGORY_IN_USE` | ⚠️ Prevents an active Budget from silently orphaning its category reference — see Edge Cases #1 and Open Questions #4 |
| S-CAT-28 | Category exists, owned by caller, and has ≥1 historical Transaction against it (no active Budget) | Caller calls `DELETE /categories/{id}` | `200`; category soft-deleted; existing Transactions keep their `category_id` reference unchanged | Deletion does **not** cascade to or block on historical Transactions — only active Budgets block it (Edge Cases #2) |
| S-CAT-29 | Category is a **system** category | Caller calls `DELETE /categories/{id}` | `403 CATEGORY_ACCESS_DENIED` | System categories can never be deleted by any User |
| S-CAT-30 | Category exists, owned by a *different* user | Caller calls `DELETE /categories/{id}` | `403 CATEGORY_ACCESS_DENIED` | Ownership check |
| S-CAT-31 | No category with that ID (or already soft-deleted) | Caller calls `DELETE /categories/{id}` | `404 CATEGORY_NOT_FOUND` | Deleting an already-deleted category is not idempotent-success — it's a 404 (see Idempotency) |
| S-CAT-32 | Category exists, owned by caller, no Budget references it yet; a request to create a Budget against this category arrives concurrently with the delete | Both requests race | Exactly one consistent end state: either the category is deleted and the Budget creation is rejected (category no longer available), or the Budget is created and the delete is rejected with `409 CATEGORY_IN_USE` — never a deleted category with a live Budget still pointing at it | ⚠️ Data-integrity critical, same class of race as F-03's S-WAL-10/S-WAL-29 — the authoritative guard against "Budget created against a just-deleted Category" belongs to F-05 Budget Management's own creation flow, not this spec; called out here so that boundary isn't missed when F-05 is specced |

### Edge Cases
1. **Active-Budget check blocks deletion, historical-Transaction reference does not** — this asymmetry exists because a Budget is a forward-looking commitment (tracking *ongoing* spend against a limit) that becomes meaningless if its Category vanishes, whereas a Transaction is a historical fact that should remain queryable/reportable regardless of the Category's current lifecycle state. The client is expected to guide the User to delete or reassign the blocking Budget(s) first.
2. **No cascade delete or reassignment prompt in MVP** — the API only reports the `409` conflict; it does not list which Budget(s) are blocking, nor offer to reassign Transactions to a different Category. Flagged as a UX gap for a later release — see Open Questions #4.
3. **Soft delete only — never a hard delete**, consistent with CLAUDE.md's "không hard delete financial records" rule, even though a bare Category row is not itself money — it is treated as financial-adjacent data because Transactions/Budgets reference it.
4. **Concurrent delete-vs-create-Budget race (S-CAT-32)** is flagged, not resolved, in this spec — closing that race requires a data-layer guard on the Budget *creation* side (F-05), since this spec's existence check alone cannot prevent a Budget insert that lands milliseconds after this check passes.

### Definition of Done
- `DELETE /categories/{id}` implemented with an active-Budget existence check returning `409 CATEGORY_IN_USE` before any soft-delete is attempted.
- System categories and other-User categories both return `403`, never `404`, for a delete attempt (resource is visible, just not writable/deletable by this caller).
- Unit tests for S-CAT-27, S-CAT-29, S-CAT-30, S-CAT-31 pass. Integration tests for S-CAT-26, S-CAT-28 pass.

### Idempotency
**Not idempotent** — calling `DELETE` twice on the same category returns `200` the first time and `404 CATEGORY_NOT_FOUND` the second time (the row is now excluded by the same `deleted_at IS NULL` filter every other endpoint uses). This is an explicit assumption, flagged since no other MVP spec has a delete endpoint to compare against directly.

---

## Out of Scope (Feature F-04)

- **Admin-facing category management** — system categories are seeded exclusively via DB migration in MVP; there is no `POST /admin/categories` or equivalent endpoint for an admin to add/edit system defaults through the API. Confirm before Release 1 — see Open Questions #5.
- **Reassigning Transactions/Budgets to a different Category on delete** — a blocked delete (S-CAT-27) requires the User to manually resolve the conflicting Budget first; there is no bulk-reassign tool.
- **Category hierarchies / subcategories** — every Category is flat; no parent/child nesting (e.g. "Food" → "Groceries" / "Dining Out") is modeled in MVP, matching SDS's flat domain object.
- **Restoring a soft-deleted Category** — no "undo delete" endpoint exists in this spec.
- **Icon validation/allow-list** — any string is accepted for `icon`; no server-side enum of supported icon keys or emoji validation.
- **Category usage analytics on this endpoint** (e.g. "used in 12 transactions") — such counts belong to F-07 Financial Reporting, not this feature's read endpoints.

## Open Questions

1. **Per-user category count limit**: no cap defined, matching the F-03 precedent for wallets. Low priority for a personal app, but worth an explicit "no limit for MVP" sign-off rather than silence.
2. **`icon` format/allow-list**: this spec assumes a free-text string (e.g. a raw emoji character or an icon-font key chosen by the client) with no server-side validation beyond a length cap. Confirm the Flutter/web client's actual icon-rendering mechanism before implementation, since it constrains what "valid" values even mean.
3. **Strict vs. lenient unknown-field handling on `PATCH`**: this spec assumes the API rejects an unrecognized `type` field in the `PATCH /categories/{id}` body with `400` (strict decoding), matching the F-03 `PATCH /wallets/{id}` precedent for its disallowed `balance` field. Confirm this convention is reused rather than re-decided per feature.
4. **Blocking-Budget visibility on delete conflict**: US-05's `409 CATEGORY_IN_USE` (S-CAT-27) does not specify whether the response `details` field should list the blocking Budget ID(s) so the client can deep-link the User to resolve them, or whether that's deferred to a later release. **Recommend including blocking Budget IDs in `details`** for a usable error UX, but flagging as an explicit assumption pending product sign-off.
5. **Admin category management**: confirm system categories are genuinely migration-only for the full product lifecycle, or whether an admin UI/API for managing the shared category list is expected in Release 1 — this SRS section is silent on it, unlike Feature-01's explicit admin-invite flow.
6. **`updated_at` on `categories`**: CLAUDE.md's Core DB Schema table lists `categories (id, user_id NULLABLE, name, icon, type, created_at, deleted_at)` with no `updated_at`, unlike every other MVP table (`wallets`, `budgets`, `transactions` all have it). This spec assumes that omission is intentional (a Category's own edit history isn't tracked), but flags it as worth double-checking against `plan.md`/migration design — an inconsistency this minor is easy to silently "fix" one way or the other without anyone noticing.
7. **Type/domain validity for Budget and Transaction linkage**: this spec's `(income|expense)` `type` enum is what F-05 (Budget) and F-06 (Transaction) will validate against when creating their own records (e.g. "a Transaction's `type` must match its Category's `type`"). This cross-feature validation rule is **not** implemented here — it belongs to F-05/F-06's own specs — but is called out so those specs don't have to re-derive it from scratch.
