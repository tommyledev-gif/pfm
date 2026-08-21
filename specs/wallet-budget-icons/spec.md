# Feature Spec: Wallet & Budget Icon/Photo Support (Enhancement to F-03 Wallet Management & F-05 Budget Management)

> Source: `SRS.md` FR-01 (Wallet, updated 2026-08-21) / FR-04 (Budget, updated 2026-08-21), `SDS.md` §2.1.2 Wallet / §2.1.4 Budget domain objects (both updated 2026-08-21) / §3.2 UI/UX Principles ("Consistent icon/photo picking") / §12.1 Known Issues Log Item 3, `docs/features.md` §3 [FEAT-ICON]
> Status: Backlog — highest-priority unspecced item per `docs/features.md` (2026-08-21 run); user-confirmed priority is enhancement-before-new-feature, full-stack scope
> Related: [F-04 Category Management](../category-management/spec.md) (the reference implementation this spec extends to two more entities — same upload endpoint shape, same storage backend, same `icon`/`icon_url` precedence rule), [F-03 Wallet Management](../wallet-management/spec.md) (existing Create/Update/List/Get Wallet flows this spec adds fields to, does not replace), [F-05 Budget Management](../budget-management/spec.md) (same, for Budget)

## Context

Category Management (F-04) already lets a User attach a visual identity to a Category two ways: a free-text `icon` (emoji/short label) and an uploaded `icon_url` (photo via `POST /categories/icon`, stored in Cloudflare R2 via `service.R2IconUploader`), with the photo taking display precedence when both are set. Wallets and Budgets have no equivalent — a User cannot visually distinguish "Cash Wallet" from "Bank Wallet" beyond their name, and cannot make a Budget list scannable at a glance the way the Category picker already is.

This spec extends that exact pattern to Wallet (F-03) and Budget (F-05):
- **Wallet** gains its own `icon`/`icon_url`, independent of any Category (a Wallet has no Category relationship at all).
- **Budget** gains its own `icon`/`icon_url`, independent of its linked Category's icon — a User may want a Budget card to look different from its Category's default icon (e.g. a red "over-budget warning" icon vs. the Category's neutral food emoji). See Open Questions #3 for the client-side fallback question this raises.

Actors:
- **User** — any `active` user (`role = admin` or `member`); Wallets and Budgets are already strictly per-User (no "system-defined" concept exists for either, unlike Category), so no new visibility rule is introduced — every rule below layers on top of each feature's existing ownership checks unchanged.

**Explicit assumption (flagged per BA convention):** rather than generalizing `POST /categories/icon` into one shared `POST /icons?entity=wallet|budget|category` endpoint, this spec adds two new sibling endpoints — `POST /wallets/icon` and `POST /budgets/icon` — that exactly mirror `POST /categories/icon`'s contract (same multipart shape, same 2MB size cap, same PNG/JPEG/SVG allow-list, same underlying `IconUploader` service, different R2 key prefix). Rationale: zero risk to the already-shipped, already-live Category upload flow (`CategoryFormModal.tsx` calls `/categories/icon` by literal path today), versus a route redesign that would need to migrate an existing mobile client. See Open Questions #1 if a future consolidation is wanted.

## Preconditions (feature-level)

- Caller holds a valid access JWT (role irrelevant — every active user manages only their own Wallets/Budgets identically, matching both features' existing "no `RequireRole` gate" convention).
- The target Wallet/Budget row already passes that feature's existing ownership check (`user_id = caller`) before any icon field is read or written — this spec does not change either feature's authorization model.
- `wallets` and `budgets` tables gain two new nullable columns each: `icon TEXT`, `icon_url TEXT` (**new migration required** — exact numbering/index design belongs in `plan.md`, current highest migration is `012_categories_icon_url.sql`).

### Key Entity Changes (conceptual — full column/index design belongs in `plan.md`)

| Entity | New Field | Meaning |
|---|---|---|
| Wallet | `icon` | Free-text emoji/short label, client-rendered, no server-side meaning — same convention as `categories.icon` |
| Wallet | `icon_url` | URL returned by `POST /wallets/icon` (a prior upload); takes display precedence over `icon` when both are set |
| Budget | `icon` | Free-text emoji/short label — independent of the Budget's linked Category's own `icon` |
| Budget | `icon_url` | URL returned by `POST /budgets/icon`; takes display precedence over `icon` when both are set |

**Business invariant (mirrors F-04):** `icon_url` is never a client-supplied arbitrary URL — the handler cannot structurally distinguish "a URL this User got from our own upload endpoint" from "any string," so it is trusted and stored as-is, same trust level as `icon`. No server-side fetch/validation of the URL's reachability.

---

## US-01: Upload a Wallet Icon Photo

**As a** User,
**I want** to upload a photo for one of my Wallets,
**so that** I can recognize it at a glance in the Wallet list, the same way I already can for Categories.

**API:** `POST /wallets/icon` (multipart, field `"file"` — identical contract to `POST /categories/icon`)

### Preconditions
- Caller is authenticated.
- Request is `multipart/form-data` with a single `file` field.

### Main Flow
1. User taps "Upload photo" while creating or editing a Wallet.
2. System validates the file: present, ≤ 2MB, `Content-Type` is one of PNG/JPEG/SVG (identical limits to F-04's `POST /categories/icon` — handler-level).
3. System uploads the file to the configured object store under a wallet-specific key prefix (e.g. `wallet-icons/`, distinct from `category-icons/` so the two can be audited/cleaned up independently).
4. System returns `200` with `{ "icon_url": "<public URL>" }`.
5. Client holds the returned `icon_url` client-side and sends it on the next `POST /wallets` or `PATCH /wallets/{id}` call (upload-then-attach, same two-step flow as Category — the upload itself never touches the `wallets` table).

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-WBI-01 | Caller is authenticated | Caller uploads a 500KB PNG | `200`; `{ icon_url }` returned | Happy path |
| S-WBI-02 | Caller is authenticated | Caller uploads a 3MB file | `400 INVALID_INPUT` | Exceeds the 2MB cap — same limit as Category |
| S-WBI-03 | Caller is authenticated | Caller uploads a `.gif` file | `400 INVALID_INPUT` | Not in the PNG/JPEG/SVG allow-list |
| S-WBI-04 | Caller is authenticated; object storage is unconfigured (no R2 credentials) | Caller uploads a valid PNG | `503 ICON_UPLOAD_UNAVAILABLE` | Same fallback behavior as F-04's `UnconfiguredIconUploader` |
| S-WBI-05 | Caller is authenticated; object storage is configured but the upload call fails (network/provider error) | Caller uploads a valid PNG | `502 ICON_UPLOAD_FAILED` | Same as F-04 |
| S-WBI-06 | No/invalid JWT | Caller calls `POST /wallets/icon` | `401 UNAUTHENTICATED` | |
| S-WBI-07 | Caller is authenticated | Caller sends the request with no `file` field | `400 INVALID_INPUT` | Missing required multipart field |

### Edge Cases
1. **Upload is decoupled from any specific Wallet ID** — identical to Category, this lets a User pick a photo *before* the Wallet exists yet (the create form). The uploaded object is never linked to a `wallets` row until a subsequent Create/Update call includes the returned `icon_url`.
2. **An uploaded photo that is never attached to any Wallet is not cleaned up by this spec** — same known gap as F-04 (no orphaned-upload garbage collection); flagged, not solved, here (see Out of Scope).
3. **Re-uploading (a User picks a new photo before saving) simply returns a new, different `icon_url`** — the old uploaded object is not deleted; the client just discards the stale URL in favor of the new one. No "replace in place" semantics at the storage layer.

### Definition of Done
- `POST /wallets/icon` implemented with the identical 2MB/PNG-JPEG-SVG validation as `POST /categories/icon`, reusing the same `IconUploader` interface with a wallet-specific key prefix.
- Unit tests for S-WBI-02, S-WBI-03, S-WBI-07 pass. Integration tests for S-WBI-01, S-WBI-04, S-WBI-05 pass.

### Idempotency
Not idempotent — each call uploads a new object and returns a new URL, identical to F-04's `POST /categories/icon`.

---

## US-02: Attach an Icon to a Wallet on Create or Update

**As a** User,
**I want** to set an emoji and/or an uploaded photo when creating or editing a Wallet,
**so that** the icon actually shows up wherever that Wallet is displayed.

**API:** `POST /wallets` (extended), `PATCH /wallets/{id}` (extended) — both endpoints and every other field/rule from `wallet-management/spec.md` are unchanged; only the two new optional fields below are added.

### Preconditions
- Same as the existing `wallet-management/spec.md` US-01 (Create) / US-04 (Update) preconditions, unchanged.
- Request body gains two new optional fields: `icon?: string` (max 32 chars, mirrors `categories.icon`'s limit), `icon_url?: string` (max 500 chars, mirrors `categories.icon_url`'s limit).

### Main Flow
1. User fills the Wallet form, optionally typing an emoji into an `icon` field and/or tapping "Upload photo" (US-01) to obtain an `icon_url`.
2. System validates shape: `icon` ≤ 32 chars if present, `icon_url` ≤ 500 chars if present (handler-level, identical limits to Category).
3. System applies the existing Create/Update flow unchanged, persisting `icon`/`icon_url` alongside the Wallet's other fields.
4. System returns the Wallet object with `icon`/`icon_url` included (new response fields, see below).

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-WBI-08 | Caller is authenticated | Caller creates `{ name: "Cash", type: "cash", icon: "💵" }` | `201`; Wallet created with `icon: "💵"`, `icon_url: null` | Happy path, emoji only |
| S-WBI-09 | Caller is authenticated | Caller creates `{ name: "Cash", type: "cash" }` (no icon fields at all) | `201`; Wallet created with `icon: null`, `icon_url: null` | Both fields remain fully optional — no behavior change for existing clients that don't send them |
| S-WBI-10 | Caller has previously called `POST /wallets/icon` and holds an `icon_url` | Caller creates `{ name: "Bank", type: "bank", icon_url: "<uploaded URL>" }` | `201`; Wallet created with `icon_url` set | Happy path, photo only |
| S-WBI-11 | Wallet exists with `icon: "💵"`, `icon_url: null`, owned by caller | Caller updates `{ icon_url: "<uploaded URL>" }` | `200`; both `icon: "💵"` (unchanged) and `icon_url` (newly set) persist — client display logic (not this API) decides `icon_url` wins | Matches Category's precedence rule exactly — the API stores both, display precedence is a client concern already established by F-04 |
| S-WBI-12 | Wallet exists, owned by caller, has `icon_url` set | Caller updates `{ icon_url: null }` (explicit null — "remove photo") | `200`; `icon_url` cleared, `icon` (if any) remains as the fallback | Explicit remove-photo path — confirm JSON-null-vs-omitted handling in `plan.md` (Open Questions #2) |
| S-WBI-13 | Caller is authenticated | Caller creates a Wallet with `icon` = a 40-character string | `400 INVALID_INPUT` | Exceeds the 32-char cap |
| S-WBI-14 | Wallet exists, owned by a *different* user | Caller submits an icon-only update | `403 WALLET_ACCESS_DENIED` | Unchanged from existing wallet-management ownership rule — icon fields don't bypass it |

### Response Shape (fields added to the existing `WalletResponse`)
```json
{
  "id": "uuid",
  "name": "Cash",
  "type": "cash",
  "balance": 1000000,
  "currency": "VND",
  "is_default": false,
  "icon": "💵",
  "icon_url": null,
  "created_at": "2026-08-21T00:00:00Z",
  "updated_at": "2026-08-21T00:00:00Z"
}
```

### Edge Cases
1. **Both fields are fully backward-compatible additions** — every existing Create/Update request without `icon`/`icon_url` behaves identically to today; this is a pure additive change to `wallet-management`'s existing contract, not a breaking one.
2. **No server-side coupling between Wallet `type` and a default `icon`** — e.g. `type: "cash"` does not auto-populate an emoji. Any "sensible default per type" behavior is a client-side concern (see SDS §3.2), not modeled here.
3. **`icon`/`icon_url` are excluded from `wallet-management/spec.md`'s existing `balance`/`currency` lock rules** — they carry no financial-consistency risk, so they remain freely editable at any time, unlike `currency` (which that spec gates behind a `409 CURRENCY_LOCKED` check once Transactions exist). No such lock applies here.

### Definition of Done
- `CreateWalletRequest`/`UpdateWalletRequest` extended with optional `icon`/`icon_url` (same length limits as Category); `WalletResponse` extended with both fields.
- Unit tests for S-WBI-13 pass. Integration tests for S-WBI-08 through S-WBI-12, S-WBI-14 pass.
- No existing `wallet-management` test (pre-dating this spec) breaks — confirms backward compatibility.

### Idempotency
Same as the existing Create/Update endpoints — Create is not idempotent (each call makes a new Wallet); Update converges to the same end state on repeated identical calls, no new idempotency key introduced by this spec.

---

## US-03: Upload a Budget Icon Photo

**As a** User,
**I want** to upload a photo for one of my Budgets,
**so that** I can tell my Budgets apart at a glance in the Budget list, independent of their Category's own icon.

**API:** `POST /budgets/icon` (multipart, field `"file"` — identical contract to `POST /categories/icon` and the new `POST /wallets/icon`)

### Preconditions
- Caller is authenticated.
- Request is `multipart/form-data` with a single `file` field.

### Main Flow
Identical to US-01, substituting a `budget-icons/` key prefix for the uploaded object.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-WBI-15 | Caller is authenticated | Caller uploads a 1MB JPEG | `200`; `{ icon_url }` returned | Happy path |
| S-WBI-16 | Caller is authenticated | Caller uploads a 2.5MB file | `400 INVALID_INPUT` | Exceeds the 2MB cap |
| S-WBI-17 | Caller is authenticated | Caller uploads a `.webp` file | `400 INVALID_INPUT` | Not in the PNG/JPEG/SVG allow-list |
| S-WBI-18 | No/invalid JWT | Caller calls `POST /budgets/icon` | `401 UNAUTHENTICATED` | |

### Edge Cases
Same three as US-01 (decoupled from any specific Budget ID, no orphaned-upload cleanup, re-upload returns a new URL rather than replacing in place) — not repeated verbatim; see US-01 Edge Cases #1–3.

### Definition of Done
- `POST /budgets/icon` implemented with the identical validation as `POST /wallets/icon`/`POST /categories/icon`, reusing the same `IconUploader` interface with a budget-specific key prefix.
- Unit tests for S-WBI-16, S-WBI-17 pass. Integration tests for S-WBI-15, S-WBI-18 pass.

### Idempotency
Not idempotent — same as US-01.

---

## US-04: Attach an Icon to a Budget on Create or Update

**As a** User,
**I want** to set an emoji and/or an uploaded photo when creating or editing a Budget,
**so that** my Budget cards are visually distinct even when several Budgets share the same Category.

**API:** `POST /budgets` (extended), `PATCH /budgets/{id}` (extended) — every other field/rule from `budget-management/spec.md` (the `limits` map, `period`, `start_date`, ownership, active-status checks) is unchanged; only the two new optional fields below are added.

### Preconditions
- Same as `budget-management/spec.md`'s existing Create/Update preconditions, unchanged.
- Request body gains `icon?: string` (max 32 chars), `icon_url?: string` (max 500 chars) — same limits as Wallet/Category.

### Main Flow
1. User fills the Budget form, optionally setting `icon` and/or `icon_url` (via US-03) alongside the existing `category_id`/`limits`/`period`/`start_date` fields.
2. System validates shape identically to US-02 (handler-level, same length caps).
3. System applies the existing Create/Update flow unchanged, persisting `icon`/`icon_url`.
4. System returns the Budget object with `icon`/`icon_url` included in the existing `BudgetResponse` shape.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-WBI-19 | Caller is authenticated, owns Category "Food" (expense) | Caller creates `{ category_id: "<Food>", limits: { "VND": 2000000 }, icon: "🍔" }` | `201`; Budget created with `icon: "🍔"` | Happy path — note this may differ from the Category "Food"'s own `icon`, and that's allowed (independence is the point) |
| S-WBI-20 | Caller is authenticated | Caller creates a Budget with no `icon`/`icon_url` | `201`; both `null` | Fully optional, backward-compatible |
| S-WBI-21 | Budget exists, owned by caller, has `icon_url` set | Caller updates `{ icon_url: null }` | `200`; `icon_url` cleared | Explicit remove-photo path, same as S-WBI-12 |
| S-WBI-22 | Caller is authenticated | Caller creates a Budget with `icon_url` = a 600-character string | `400 INVALID_INPUT` | Exceeds the 500-char cap |
| S-WBI-23 | Budget exists, owned by a *different* user | Caller submits an icon-only update | `403 BUDGET_ACCESS_DENIED` | Unchanged ownership rule |
| S-WBI-24 | Budget exists, owned by caller | Caller updates `{ limits: { "VND": 3000000 } }` (no icon fields touched) | `200`; `icon`/`icon_url` remain exactly as they were before this update | Icon fields are independent of `limits`' existing full-replacement semantics (`budget-management/spec.md`'s Update Edge Case #1) — this update does not clear them as a side effect |

### Response Shape (fields added to the existing `BudgetResponse`)
```json
{
  "id": "uuid",
  "category_id": "uuid",
  "category_name": "Food",
  "period": "monthly",
  "start_date": "2026-08-01",
  "icon": "🍔",
  "icon_url": null,
  "limits": [ { "currency": "VND", "amount_limit": 2000000, "spent": 0, "remaining": 2000000, "status": "on_track" } ],
  "status": "on_track",
  "created_at": "2026-08-21T00:00:00Z",
  "updated_at": "2026-08-21T00:00:00Z"
}
```

### Edge Cases
1. **A Budget's icon is fully independent of its Category's icon at the data layer** — no fallback/inheritance is computed server-side; if `icon`/`icon_url` are both `null`, the response simply returns `null` for both and the client decides what to render (see Open Questions #3 — this spec assumes the client falls back to the linked Category's icon, but that is a UI decision, not an API contract this spec enforces).
2. **`icon`/`icon_url` are unaffected by `limits`' full-replacement Update semantics** — `budget-management/spec.md` specifies that submitting `limits` on `PATCH /budgets/{id}` fully replaces the currency map; this spec's new fields are independent keys in the same request body and are only touched when explicitly present, exactly like `HasUpdates()`'s existing per-field-presence pattern.
3. **Both fields are fully backward-compatible additions**, identical rationale to Wallet's Edge Case #1.

### Definition of Done
- `CreateBudgetRequest`/`UpdateBudgetRequest` extended with optional `icon`/`icon_url`; `BudgetResponse` extended with both fields.
- Unit tests for S-WBI-22 pass. Integration tests for S-WBI-19 through S-WBI-21, S-WBI-23, S-WBI-24 pass.
- No existing `budget-management` test breaks.

### Idempotency
Same as the existing Create/Update endpoints, unchanged by this spec.

---

## Out of Scope

- **Generalizing the three icon-upload endpoints into one shared endpoint** — see the Context section's explicit assumption; `POST /categories/icon`, `POST /wallets/icon`, `POST /budgets/icon` remain three separate, identically-shaped routes.
- **Orphaned-upload cleanup** — an uploaded photo that's never attached to any Wallet/Budget/Category is never garbage-collected by any spec, this one included.
- **Default/suggested icons per Wallet `type` or per Category** — any "smart default" behavior (e.g. auto-suggesting a bank emoji for `type: "bank"`) is a client-side concern, not modeled here.
- **Retroactively backfilling `icon`/`icon_url` on existing Wallets/Budgets** — both columns are added as nullable with no default backfill; existing rows simply show no icon until a User sets one.
- **Server-side image resizing/compression/thumbnailing** — the uploaded file is stored as-is (same as Category); no processing pipeline is introduced.
- **Budget-icon inheritance/fallback logic on the server** — see Edge Case US-04 #1; if this needs to be an API-level guarantee rather than a client convention, that's a follow-up spec change, not assumed here.

## Open Questions

1. **Shared vs. duplicated upload endpoints**: this spec assumes three separate near-identical endpoints (Context section) to avoid touching the already-shipped `POST /categories/icon`. Confirm this is acceptable long-term, or whether a follow-up refactor to one shared `POST /icons` endpoint (with a request field indicating entity type) is wanted once all three exist — refactoring three working, tested endpoints into one is lower-risk once done later than getting the abstraction right on the very first entity.
2. **Explicit `null` vs. omitted-field semantics for "remove the photo"** (S-WBI-12/S-WBI-21): this spec assumes `PATCH .../{id}` with `"icon_url": null` explicitly present in the JSON body clears it, while omitting the key entirely leaves it untouched — mirroring how `UpdateBudgetRequest.HasUpdates()` already distinguishes "key absent" from "key present" for `limits`. Confirm the same JSON-decoding approach (a `*string` field, `nil` pointer = omitted, pointer-to-empty-or-explicit-null handled via a wrapper type) is workable in `plan.md`, since Go's `encoding/json` does not, by default, distinguish an omitted field from an explicit `null` for a plain `*string` — both decode to `nil`. This is a real implementation gap to resolve in `plan.md`, not a rubber-stamp.
3. **Does the mobile/web client fall back to the linked Category's icon when a Budget has none of its own?** This spec's API returns `null`/`null` with no computed fallback (Edge Case US-04 #1) — confirm whether that's the intended final UX or whether a fallback should be computed client-side (recommended, since it requires no API change) vs. server-side (would require joining Category data into every Budget response, which already happens for `category_name` — low additional cost if wanted).
4. **Per-entity R2 key prefix naming** (`wallet-icons/`, `budget-icons/`) is this spec's suggestion, not a hard requirement — confirm exact naming in `plan.md`, consistent with the existing `category-icons/` prefix (`service.R2IconUploader.UploadIcon`).
