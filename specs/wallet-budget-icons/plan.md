# Implementation Plan: Wallet & Budget Icon/Photo Support

> Spec: [spec.md](./spec.md) | SRS: FR-01 (Wallet), FR-04 (Budget) | SDS: §2.1.2 Wallet, §2.1.4 Budget, §3.2 UI/UX Principles, §12.1 Known Issues Log Item 3

---

## Pre-flight: Spec Review Findings

| # | Gap / Ambiguity in `spec.md` | Resolution / Open Task |
|---|---|---|
| 1 | **⚠️ "Remove photo" (S-WBI-12, S-WBI-21) is not actually implementable with the pattern spec.md's Context section points to as precedent.** Category's already-shipped `UpdateCategory` SQL query uses `icon_url = COALESCE(sqlc.narg('icon_url'), icon_url)` (`backend/db/queries/categories.sql`) — a `nil` Go pointer is indistinguishable from "field omitted" vs. "field explicitly `null`" under `encoding/json`'s default unmarshaling into `*string`, **and** `COALESCE(NULL, icon_url)` always preserves the old value regardless. Category's shipped `PATCH /categories/{id}` therefore **can never clear an uploaded photo once set** — a real, pre-existing, unremediated bug this spec's format happened to reveal, not something specific to Wallet/Budget. | **Resolved for Wallet/Budget (T4/T5):** use a `dto.OptionalString` wrapper (`UnmarshalJSON` custom type distinguishing "absent" from "explicit null" from "a value") for `icon_url` on `UpdateWalletRequest`/`UpdateBudgetRequest`, and change the new SQL queries to a presence-flag `CASE` pattern instead of `COALESCE` (see T1/T2 SQL below). **Flagged, not fixed, for Category** (T13, explicitly optional) — retrofitting `UpdateCategoryRequest`/`categories.sql` is the same shape of fix but touches already-shipped, already-tested code; recommend a follow-up PR rather than silently bundling it here. Product/tech sign-off needed on whether to include T13 in this PR or defer. |
| 2 | Spec's Open Question #1 (shared `POST /icons` endpoint vs. three siblings) — spec's own Context section already makes the explicit assumption (siblings). | **Resolved as designed:** `POST /wallets/icon` and `POST /budgets/icon`, structurally identical to `POST /categories/icon`. No architectural decision left open. |
| 3 | Spec's Open Question #3 (does the client fall back to the Category's icon when a Budget has none of its own?) | **Resolved by existing code, not a new decision:** `BudgetCard.tsx` already renders `<Avatar icon={category?.icon} iconUrl={category?.icon_url} />` — the Category-icon fallback is the *current* behavior (Budget has no icon of its own yet, so it's the only source today). T11 below just changes the precedence to `budget.icon_url ?? category?.icon_url` (photo), then `budget.icon ?? category?.icon` (emoji), matching Category's own icon_url-over-icon precedence rule, layered one level deeper. |
| 4 | Spec doesn't say where the Budget icon-picker UI lives — `NewBudgetModal.tsx` is a shared component (`mobile/src/components/shared/`), not under `mobile/src/features/budgets/components/` per `plan.md`'s own generic package-layout reference. | **Follow existing file, don't create a new one.** `NewBudgetModal.tsx` already exists and is the real Budget create/edit form (confirmed by reading it) — this plan's mobile tasks edit it in place, ignoring the generic `[feature]/components/` template path for this one file. |
| 5 | Spec doesn't specify the R2 storage key-prefix mechanism at the code level — `service.R2IconUploader.UploadIcon` currently hardcodes `"category-icons/"` inline. | **Resolved:** extend the `IconUploader` interface to take an explicit `keyPrefix` parameter (T3) rather than adding two near-duplicate uploader structs. `CategoryHandler.UploadIcon`'s call site is updated to pass `"category-icons"` explicitly, preserving its exact current behavior/output. |

### Regression Scope

This plan touches one shared interface (`IconUploader.UploadIcon` gains a `keyPrefix` parameter, T3) and one shared file (`CategoryHandler.UploadIcon`'s call site, updated to pass `"category-icons"` — output unchanged, so `POST /categories/icon` behavior is identical before/after). Everything else is additive: new nullable columns, new optional request/response fields, two new routes. No existing Wallet/Budget/Category request or response field is renamed or removed, and no existing validation/ownership rule is altered. `WalletService.UpdateWallet`'s currency-lock check and `BudgetService`'s `limits` full-replace semantics are untouched — icon fields are applied independently of both. T13 (retrofitting Category's `icon_url` clear-bug) is the only task with any risk to already-shipped behavior, which is exactly why it's marked optional/needs-sign-off rather than bundled by default.

---

## Architecture

### Package/File Layout

```text
backend/
├── db/
│   ├── migrations/
│   │   ├── 013_wallets_icon.sql            # ALTER TABLE wallets ADD icon, icon_url
│   │   └── 014_budgets_icon.sql            # ALTER TABLE budgets ADD icon, icon_url
│   └── queries/
│       ├── wallets.sql                     # extend UpdateWallet/CreateWallet
│       └── budgets.sql                     # extend UpdateBudget/CreateBudget
├── docker-compose.yml                       # two new docker-entrypoint-initdb.d/ mount lines
└── internal/
    ├── handler/
    │   ├── wallet_handler.go               # + UploadIcon
    │   └── budget_handler.go               # + UploadIcon
    ├── service/
    │   ├── icon_uploader.go                # UploadIcon signature gains keyPrefix
    │   ├── wallet_service.go               # thread icon/icon_url through Create/Update
    │   ├── budget_service.go               # thread icon/icon_url through Create/Update
    │   └── interfaces.go                   # no interface shape change (icon fields ride inside existing Params structs)
    ├── repository/
    │   ├── wallet_repository.go            # CreateWalletParams/UpdateWalletParams gain Icon/IconURL
    │   └── budget_repository.go            # CreateBudgetParams/UpdateBudgetParams gain Icon/IconURL
    ├── model/
    │   ├── wallet.go                       # + Icon, IconURL *string
    │   └── budget.go                       # + Icon, IconURL *string
    └── dto/
        ├── wallet_request.go               # + Icon *string, IconURL OptionalString (new type, see T4)
        ├── wallet_response.go              # + Icon, IconURL
        ├── budget_request.go                # + Icon *string, IconURL OptionalString
        ├── budget_response.go              # + Icon, IconURL
        └── optional_string.go               # NEW — shared OptionalString type (T4)

mobile/src/
├── features/
│   ├── wallets/
│   │   ├── api/
│   │   │   └── use-upload-wallet-icon-mutation.ts       # NEW, mirrors use-upload-category-icon-mutation.ts
│   │   ├── components/
│   │   │   └── WalletFormModal.tsx                      # + icon picker, mirrors CategoryFormModal.tsx
│   │   └── types.ts                                     # + icon, icon_url
│   └── budgets/
│       ├── api/
│       │   └── use-upload-budget-icon-mutation.ts       # NEW
│       └── types.ts                                     # + icon, icon_url
└── components/shared/
    ├── NewBudgetModal.tsx                                # + icon picker (existing file, not features/budgets/)
    ├── WalletCard.tsx                                     # + Avatar (Home screen wallet card — currently has none)
    └── BudgetCard.tsx                                     # Avatar precedence: budget icon → category icon (Finding #3)

mobile/src/features/wallets/components/WalletListItem.tsx  # + Avatar (Profile → Wallets list — currently has none)
```

### Domain Objects

| Entity | Table | Key Fields (new) | Notes |
|--------|-------|------------|-------|
| `Wallet` | `wallets` | `icon TEXT NULL`, `icon_url TEXT NULL` | No soft-delete change; money/balance columns untouched by this feature |
| `Budget` | `budgets` | `icon TEXT NULL`, `icon_url TEXT NULL` | Added to the `budgets` table itself, not `budget_limits` (icon is per-Budget, not per-currency) |

### Business Rules

| Rule | Source AC | Enforcement |
|------|--------|-------------|
| `icon` max 32 chars, `icon_url` max 500 chars, both optional, on Wallet Create/Update | S-WBI-08–S-WBI-13 | `dto.CreateWalletRequest`/`UpdateWalletRequest` validator tags (handler-level, mirrors `CreateCategoryRequest`) |
| `icon`/`icon_url` are independent of Wallet's existing `currency` lock — never gated by `HasTransactionForWallet` | Edge Case US-02 #3 | `WalletService.UpdateWallet` — icon fields applied unconditionally, currency-lock check untouched |
| Upload: ≤2MB, PNG/JPEG/SVG only, for both Wallet and Budget | S-WBI-02/03, S-WBI-16/17 | `WalletHandler.UploadIcon`/`BudgetHandler.UploadIcon` — reuse `common.CategoryIconMaxUploadBytes`/`CategoryIconAllowedContentTypes` as-is (rename deferred, see T3 note) |
| `icon`/`icon_url` max 32/500 chars, independent of Budget's `limits` full-replace semantics | S-WBI-19–S-WBI-24 | `dto.CreateBudgetRequest`/`UpdateBudgetRequest` — new fields sit beside `Limits`, `BudgetService.UpdateBudget` never touches them unless `HasUpdates()`-equivalent presence check says so (T5) |
| Ownership (403) / not-found (404) unchanged for both entities | S-WBI-14, S-WBI-23 | Existing `getOwnedWallet`/`getOwnedBudget` — icon fields ride through the exact same call, no new check needed |
| ⚠️ Explicit `icon_url: null` clears the photo; an omitted key leaves it untouched | S-WBI-12, S-WBI-21 | `dto.OptionalString` (T4) + `CASE WHEN icon_url_provided THEN icon_url ELSE icon_url END`-shaped SQL (T1/T2) — **not** `COALESCE` (Pre-flight Finding #1) |
| Upload object key is prefixed per entity (`wallet-icons/`, `budget-icons/`, `category-icons/`) | Edge Case US-01 #1 (spec.md) | `service.IconUploader.UploadIcon(ctx, keyPrefix, filename, contentType, data)` — interface signature change (T3) |

### Sequence Diagram — Upload + Attach (Wallet; Budget is identical with `/budgets/icon`)

```text
Client                          WalletHandler                WalletService         R2IconUploader
  |--- POST /wallets/icon ------->|                              |                        |
  |    (multipart: file)          |-- validate size/type -------->|                        |
  |                                |                              |                        |
  |                                |------------------------------|--UploadIcon("wallet-icons/…")-->|
  |                                |                              |<-------- URL or err -----------|
  |<-- 200 {icon_url} -------------|                              |                        |
  |    (or 400/502/503 — see Error Flows)                         |                        |
  |                                                                                          |
  |--- POST /wallets ------------->|                              |                        |
  |    {name, type, icon,          |-- validate shape ----------->|                        |
  |     icon_url: "<from above>"}  |                              |-- CreateWallet(tx) --->[wallets row]
  |<-- 201 Wallet{…, icon_url} ----|<-----------------------------|                        |
```

No idempotency-key step in this diagram — neither the upload endpoint nor Wallet/Budget Create/Update introduce or require one (spec.md: "not idempotent," consistent with every other MVP write except `POST /transactions`).

---

## Error Flows

| Scenario | HTTP | Error Code |
|----------|------|------------|
| Unauthenticated on any of the 4 new/extended endpoints | 401 | `UNAUTHENTICATED` |
| Upload: missing `file` field | 400 | `INVALID_INPUT` |
| Upload: file > 2MB | 400 | `INVALID_INPUT` |
| Upload: content-type not PNG/JPEG/SVG | 400 | `INVALID_INPUT` |
| Upload: object storage unconfigured | 503 | `ICON_UPLOAD_UNAVAILABLE` |
| Upload: object storage call failed | 502 | `ICON_UPLOAD_FAILED` |
| Create/Update: `icon` > 32 chars or `icon_url` > 500 chars | 400 | `INVALID_INPUT` |
| Update: caller doesn't own the Wallet/Budget | 403 | `WALLET_ACCESS_DENIED` / `BUDGET_ACCESS_DENIED` (existing codes, unchanged) |
| Update: Wallet/Budget doesn't exist | 404 | `WALLET_NOT_FOUND` / `BUDGET_NOT_FOUND` (existing codes, unchanged) |
| Unexpected error (DB, R2 network) | 500 | — (falls through `response.Error`'s generic branch — see `SDS.md` §6.1 for the known, separately-tracked bug where this branch also swallows Fiber routing errors; out of scope for this plan) |

No new error codes are introduced — every failure mode reuses an existing `common.AppError` constant.

---

## Constitution / Convention Notes

| Rule | Status | Note |
|------|--------|------|
| Service layer owns business rules | Required | Icon presence/clear logic lives in `WalletService`/`BudgetService`, not the handler |
| Transactional atomicity | N/A | Icon fields ride inside the *existing* Create (already transactional for Wallet's default-swap; Budget's category-lock) and Update (single-row `UPDATE ... RETURNING *`, no transaction) paths — no new transaction boundary introduced |
| JWT auth enforced at middleware | Required | `POST /wallets/icon`/`POST /budgets/icon` registered inside the existing `wallets`/`budgets` route groups (`middleware.JWTAuth`), no new middleware |
| Idempotency on write | N/A | Neither upload nor Create/Update-with-icon-fields carries an idempotency key — consistent with every existing Wallet/Budget/Category write except `POST /transactions` |
| Money stored as BIGINT cents | N/A | This feature touches no money fields |
| Soft delete respected | N/A | `icon`/`icon_url` are plain nullable columns on already-soft-deletable tables; no new delete path |
| No file > 300 lines | Required | Watch `wallet_service.go`/`budget_service.go` — both are already substantial; if `UploadIcon` handler logic pushes `wallet_handler.go`/`budget_handler.go` over, extract a shared `iconUploadHandler(uploader, keyPrefix)` helper (T3) |
| Mobile: server state via TanStack Query | Required | New `use-upload-wallet-icon-mutation.ts`/`use-upload-budget-icon-mutation.ts` follow the exact `use-upload-category-icon-mutation.ts` shape |
| Mobile: no offline/local-DB layer | N/A | Unaffected |
| ⚠️ Data consistency: `icon_url` trust boundary | Required | `icon_url` is stored as-is with no server-side URL validation (matches Category's existing, documented trust model — spec.md Business Invariant) — **not** a new risk this feature introduces |

---

## Element/Key IDs (QA automation)

**Mobile (`testID`):**

| Element | testID | Status | File |
|---------|--------|--------|------|
| Upload/Change photo button (Wallet form) | `testID="btn-upload-wallet-icon"` | **Missing** | `mobile/src/features/wallets/components/WalletFormModal.tsx` |
| Icon preview avatar (Wallet form) | `testID="avatar-wallet-icon-preview"` | **Missing** | `mobile/src/features/wallets/components/WalletFormModal.tsx` |
| Upload/Change photo button (Budget form) | `testID="btn-upload-budget-icon"` | **Missing** | `mobile/src/components/shared/NewBudgetModal.tsx` |
| Icon preview avatar (Budget form) | `testID="avatar-budget-icon-preview"` | **Missing** | `mobile/src/components/shared/NewBudgetModal.tsx` |
| Wallet list row avatar | `testID="avatar-wallet-{id}"` | **Missing** | `mobile/src/features/wallets/components/WalletListItem.tsx` |
| Budget card avatar | `testID="avatar-budget-{id}"` | **Missing** | `mobile/src/components/shared/BudgetCard.tsx` |

No `data-testid` (web) row — `frontend/` is not in scope for this plan (spec.md's Context/UI Design targets are mobile-only per `docs/features.md` [FEAT-ICON], matching the original 4-item report's mobile-only framing). **Confirm before implementation** if web parity is also wanted — currently assumed out of scope, not silently decided (see T14).

---

## Open Tasks

| ID | Task | File |
|----|------|------|
| T1 | Migration: `wallets` gains `icon TEXT`, `icon_url TEXT` (both nullable, no default) | `backend/db/migrations/013_wallets_icon.sql` |
| T2 | Migration: `budgets` gains `icon TEXT`, `icon_url TEXT` (both nullable, no default) | `backend/db/migrations/014_budgets_icon.sql` |
| — | Add matching `docker-entrypoint-initdb.d/` mount lines for both new migrations | `docker-compose.yml` |
| T3 | Extend `IconUploader.UploadIcon` to accept a `keyPrefix string` param; update `R2IconUploader`/`UnconfiguredIconUploader` and `CategoryHandler.UploadIcon`'s call site (pass `"category-icons"`, preserving current output exactly) | `backend/internal/service/icon_uploader.go`, `backend/internal/handler/category_handler.go` |
| T4 | Add `dto.OptionalString` (custom `UnmarshalJSON`, `Set bool` + `Value *string`) for the "explicit clear vs. omitted" distinction (Pre-flight Finding #1) | `backend/internal/dto/optional_string.go` (new file) |
| T5 | `WalletHandler.UploadIcon` (mirrors `CategoryHandler.UploadIcon`, prefix `"wallet-icons"`); register `wallets.Post("/icon", walletHandler.UploadIcon)` before `/:id` routes | `backend/internal/handler/wallet_handler.go`, `backend/cmd/server/routes.go` |
| T6 | `BudgetHandler.UploadIcon` (prefix `"budget-icons"`); register `budgets.Post("/icon", budgetHandler.UploadIcon)` before `/:id` routes | `backend/internal/handler/budget_handler.go`, `backend/cmd/server/routes.go` |
| T7 | Extend `CreateWalletRequest`/`UpdateWalletRequest` (`Icon *string`, `IconURL dto.OptionalString`), `WalletResponse` (`Icon`, `IconURL`) | `backend/internal/dto/wallet_request.go`, `wallet_response.go` |
| T8 | Extend `CreateBudgetRequest`/`UpdateBudgetRequest`, `BudgetResponse` — same shape as T7 | `backend/internal/dto/budget_request.go`, `budget_response.go` |
| T9 | Thread `Icon`/`IconURL` through `WalletService.CreateWallet`/`UpdateWallet`, `repository.CreateWalletParams`/`UpdateWalletParams`, `model.Wallet`, and the `UpdateWallet` sqlc query (presence-flag `CASE`, not `COALESCE` — Pre-flight Finding #1) | `backend/internal/service/wallet_service.go`, `backend/internal/repository/wallet_repository.go`, `backend/internal/model/wallet.go`, `backend/db/queries/wallets.sql` |
| T10 | Same as T9 for Budget | `backend/internal/service/budget_service.go`, `backend/internal/repository/budget_repository.go`, `backend/internal/model/budget.go`, `backend/db/queries/budgets.sql` |
| T11 | Mobile: `use-upload-wallet-icon-mutation.ts` (mirrors `use-upload-category-icon-mutation.ts`); add icon picker to `WalletFormModal.tsx` (mirrors `CategoryFormModal.tsx`'s `Avatar` + `pickIcon` pattern); add `Avatar` to `WalletListItem.tsx` and `WalletCard.tsx` (both currently render no icon at all); extend `Wallet`/`CreateWalletRequest` types | `mobile/src/features/wallets/{api/use-upload-wallet-icon-mutation.ts (new), components/WalletFormModal.tsx, components/WalletListItem.tsx, types.ts}`, `mobile/src/components/shared/WalletCard.tsx` |
| T12 | Mobile: `use-upload-budget-icon-mutation.ts`; add icon picker to `NewBudgetModal.tsx` (existing shared component, not a new `features/budgets/components/` file — Pre-flight Finding #4); update `BudgetCard.tsx`'s `Avatar` precedence to `budget.icon_url ?? category?.icon_url`, then `budget.icon ?? category?.icon` (Pre-flight Finding #3); extend `Budget`/`CreateBudgetRequest` types | `mobile/src/features/budgets/{api/use-upload-budget-icon-mutation.ts (new), types.ts}`, `mobile/src/components/shared/{NewBudgetModal.tsx, BudgetCard.tsx}` |
| T13 | **Optional, needs sign-off (Pre-flight Finding #1):** retrofit `UpdateCategoryRequest.IconURL`/`categories.sql`'s `UpdateCategory` query to the same `OptionalString`/presence-flag pattern as T4/T9/T10, closing Category's identical pre-existing "can never clear icon_url" gap | `backend/internal/dto/category_request.go`, `backend/db/queries/categories.sql`, `backend/internal/service/category_service.go` |
| T14 | **Needs product confirmation before starting:** is web (`frontend/`) parity in scope for this feature, or mobile-only as currently assumed (Element/Key IDs section)? If yes, add the equivalent `frontend/src/features/{wallets,budgets}` component/hook work — not scoped here | — |
| T15 | Unit tests: `wallet_service_test.go`/`fake_wallet_repo_test.go` and `budget_service_test.go`/`fake_budget_repo_test.go` extended for S-WBI-08–14 and S-WBI-19–24; new upload-handler tests for S-WBI-01–07, S-WBI-15–18 | `backend/internal/service/{wallet_service_test.go, budget_service_test.go}`, `backend/internal/handler/` (new `*_test.go` if the project has handler-level tests — confirm convention, none seen for `CategoryHandler.UploadIcon` itself as reference) |
