# Plan: F-03 Shared Wallets ("Ví chung") + Wallet card colours

> Spec: [spec.md](spec.md) · SRS: Feature-03 US-06, US-07 · Builds on: [wallet-management](../wallet-management/plan.md), [transaction-management](../transaction-management/plan.md)
> Stacks touched: Go backend, React Native mobile. Not touched: `frontend/` (frozen), ai-service.

## 1. Pre-flight: Spec Review Findings

| # | Finding | Resolution |
|---|---|---|
| F1 | Every transaction list query is `WHERE t.user_id = $1`; a shared wallet's entries by other members can never come back. | New boolean `wallet_scoped` on `ListTransactionsByUser`/`CountTransactionsByUser`: `(t.user_id = $1 OR ($13::bool AND $3::uuid IS NOT NULL))`. Service sets it only after a read-access check on that `wallet_id`; the SQL itself refuses it without a wallet filter (defence in depth). |
| F2 | `ListTransactionsByUserRow` is converted by type to `GetTransactionByIDRow` (`toJoinedTransactionModel`), so adding a recorder column to the list query breaks that conversion. | Recorder names come from one extra batched lookup (`ListUserDisplayNames(ids)`) after the page is read, only on wallet-scoped pages, only for ids ≠ caller. |
| F3 | `TransactionService.getOwnedWallet` is the one gate for create, transfer destination, wallet move and the list's wallet filter; Update/Delete check only `t.user_id` and never re-check the wallet. | Replace with `walletAccess` helpers (`requireWritable`, `requireReadable`). Update/Delete add a write check on `wallet_id` (+ `to_wallet_id`) so a removed member cannot move the owner's balance (S-SHW-34). |
| F4 | `ListWalletsByUser` feeds AI chat, consult, budget wizard, export and import. Widening it would let the AI file into someone else's wallet and export others' data. | Leave it owner-only. New `ListSharedWalletsForUser` used only by `GET /wallets?include_shared=true` and `GET /wallets/{id}`. |
| F5 | Web and phones not yet on the OTA call `GET /wallets` and sum balances for net worth. | Sharing is opt-in by query flag; without it the response is byte-for-byte the old list plus additive fields (`color`, `access`, `owner_name`, `member_count`). |
| F6 | The currency lock already checks `ExistsTransactionForWallet` by wallet id (any recorder). | No change; covered by BR-11. |
| F7 | Notifications have no wallet column; the client routes by `type`. | Reuse `related_user_id` (= the other person) and route `wallet_invite`/`wallet_member_joined` to the Wallets screen. No notifications migration. |
| F8 | Local sqlc CLI regenerates every file differently (memory: sqlc version mismatch). | All new/changed queries are hand-written into `internal/repository/sqlc/*.go` in the committed style; `sqlc generate` is never run. |
| F9 | Spec BR-07 "recorder only" means the owner cannot fix a member's wrong entry. | Accepted for this release (spec Open Question 1). |
| F10 | Card colours: stored as a palette **key**, not a hex, so the client owns both the face and its ink per theme and a palette tweak needs no migration. | `wallets.color TEXT NULL`, validated `oneof=` in the DTO; NULL = today's position-based accent. |

### Feasibility review (three passes)

**Pass 1, data and money.** Balance moves stay in the existing statements (`DecrementWalletBalanceIfSufficient`, `AdjustWalletBalance`) which key on wallet id only, inside the same DB tx as the insert, so an editor's entry moves the shared balance exactly like the owner's. Concurrent editors are already serialised by the conditional UPDATE (S-SHW-37). Membership rows are soft-removed (`removed_at`), never hard-deleted; transactions never reference memberships, so removing a member cannot orphan or delete financial data (BR-08). The live-membership uniqueness is a partial unique index, so double invites race safely (S-SHW-08). Verdict: feasible, no new money path.

**Pass 2, API and compatibility.** All new routes are additive under `/wallets`; `GET /wallets/invitations` is registered before `GET /wallets/:id` (literal-before-param rule). Existing responses only gain fields. The 403/404 split is kept: missing wallet 404, no access 403. The list-scope change is guarded twice (service + SQL). Personal views (reports, budgets, analytics, export, AI) call owner-only queries and are unchanged (BR-09). Fakes used by service tests need the new interface methods; covered in T9. Verdict: feasible; the one risk is the hand-written positional parameter (`$13`/`$9`) and is covered by a repository-level test against the SQL text and by the service tests.

**Pass 3, mobile and release.** No native module is added, so the change ships as an OTA update after the backend deploy (push to `develop` runs migrations 034/035 first). Every wallet consumer was checked: totals and net worth must filter to owned wallets; pickers must drop viewer wallets; everything else (currency maps, icon prefetch, carousel) is correct with shared wallets included. New fields are optional in `types.ts`, so the app also runs against the old backend (no shared wallets, no colour). Verdict: feasible; order of release is backend deploy, then OTA.

## 2. Architecture

### Backend layout
```text
backend/db/migrations/034_wallets_color.sql            # wallets.color
backend/db/migrations/035_wallet_members.sql           # wallet_members + indexes
backend/db/queries/wallets.sql                         # + color in UpdateWallet; ListSharedWalletsForUser, CountActiveMembersByWallet
backend/db/queries/wallet_members.sql                  # membership + invitation + display-name queries
backend/db/queries/transactions.sql                    # wallet_scoped flag on list/count
backend/db/queries/notifications.sql                   # CreateWalletNotification
backend/internal/repository/sqlc/{models.go,wallets.sql.go,transactions.sql.go}   # hand-edited
backend/internal/repository/sqlc/wallet_members.sql.go # hand-authored
backend/internal/repository/wallet_member_repository.go
backend/internal/model/wallet.go (+Color, Access, OwnerName, MemberCount), model/wallet_member.go
backend/internal/service/wallet_access.go              # role resolution shared by Wallet/Transaction services
backend/internal/service/wallet_member_service.go (+ _test)
backend/internal/service/transaction_service*.go       # gates swapped, recorder names
backend/internal/handler/wallet_member_handler.go, wallet_handler.go
backend/internal/dto/wallet_member_{request,response}.go, wallet_{request,response}.go, transaction_response.go
backend/internal/common/errors_wallet_members.go
backend/cmd/server/routes.go, main wiring
```

### Mobile layout
```text
mobile/src/lib/wallet-colors.ts                         # palette keys → face colour + ink (contrast-checked)
mobile/src/features/wallets/types.ts                    # color, access, owner_name, member_count; WalletMember, WalletInvitation
mobile/src/features/wallets/wallet-access.ts            # isOwned / canWrite helpers
mobile/src/features/wallets/api/use-wallets-query.ts    # include_shared + scope select
mobile/src/features/wallets/api/use-wallet-members-*.ts, use-wallet-invitations-*.ts
mobile/src/features/wallets/components/{WalletMembersSheet,WalletInviteForm,WalletMemberRow,WalletInvitationCards,WalletColorPicker}.tsx
mobile/src/features/wallets/components/{WalletCarousel,WalletStackCard,WalletListItem,WalletActiveActions,WalletFormModal,WalletRecentTransactions}.tsx
mobile/app/(app)/wallets.tsx, notifications.tsx
pickers: features/transactions/components/use-transaction-form.ts, features/ai-chat (EditTransactionModal, use-confirm-proposal, RecordingPane), wallet-totals.ts
```

### Domain objects

| Entity | Table | Key fields | Notes |
|---|---|---|---|
| Wallet | `wallets` | + `color TEXT NULL` | palette key; NULL = automatic |
| WalletMember | `wallet_members` | id UUID v4, wallet_id, user_id, role (`editor`/`viewer`), status (`pending`/`active`), invited_by, created_at, updated_at, accepted_at, removed_at | soft removal via `removed_at`; partial unique (wallet_id, user_id) WHERE removed_at IS NULL |
| Transaction | `transactions` | unchanged | `user_id` = recorder |

### Business rules → enforcement

| Rule | Source | Enforcement |
|---|---|---|
| Owner-only management + wallet edits | BR-01, S-SHW-03/43 | `WalletMemberService.requireOwner`, `WalletService.UpdateWallet/SetDefault` keep `getOwnedWallet` → 403 `WALLET_ACCESS_DENIED` |
| Max 10 live memberships | BR-02, S-SHW-07 | `WalletMemberService.Invite` counts in the tx → 409 `WALLET_MEMBER_LIMIT` |
| Invite active account, not self, not twice | BR-03, S-SHW-04/05/06/08 | service lookup (email lower / username) → 404 `WALLET_MEMBER_USER_NOT_FOUND`, 400, 409 `WALLET_MEMBER_EXISTS`; unique index catches the race (23505 → 409) |
| Read = owner or active member; write = owner or active editor | BR-05, S-SHW-31 | `walletAccess.resolve` → `requireReadable` / `requireWritable` |
| ⚠️ Balance moves with the insert | BR-06, S-SHW-30/37 | unchanged `createTransactionTx` statements, same DB tx |
| Recorder-only edit; must still write the wallet | BR-07, S-SHW-33/34 | `getOwnedTransaction` + `requireWritable(wallet_id, to_wallet_id)` in Update/Delete |
| ⚠️ Removal keeps transactions | BR-08 | membership soft-remove only; no transaction statement touched |
| Personal views unchanged | BR-09 | owner-only queries untouched |
| Net worth owned-only | BR-10 | mobile `wallet-totals.ts` filters `access === "owner"` |
| Wallet-scoped list | US-04, F1 | `ListTransactions` sets `WalletScoped` after `requireReadable` |

### Sequence: record into a shared wallet (happy path on top)
```mermaid
sequenceDiagram
  participant App
  participant H as TransactionHandler
  participant S as TransactionService
  participant DB
  App->>H: POST /transactions (X-Idempotency-Key)
  H->>S: CreateTransaction
  S->>DB: idempotency lookup (recorder, key)
  DB-->>S: none
  S->>DB: wallet + live membership of caller
  DB-->>S: editor
  S->>DB: BEGIN; insert tx; conditional balance UPDATE; COMMIT
  DB-->>S: ok
  S-->>H: transaction + balance
  H-->>App: 201
  Note over S,DB: viewer / removed member
  S-->>H: ErrWalletAccessDenied
  H-->>App: 403 WALLET_ACCESS_DENIED
  Note over S,DB: balance too low
  H-->>App: 409 INSUFFICIENT_BALANCE
```

### Sequence: invite → accept
```mermaid
sequenceDiagram
  participant O as Owner app
  participant B as Invitee app
  participant S as WalletMemberService
  participant DB
  O->>S: POST /wallets/{id}/members
  S->>DB: owner check, user lookup, count live
  S->>DB: BEGIN; insert pending member; insert wallet_invite notification; COMMIT
  S-->>O: 201 member(pending)
  B->>S: GET /wallets/invitations
  S-->>B: 200 [invitation]
  B->>S: POST /wallets/{id}/invitation/accept
  S->>DB: BEGIN; set active; notify owner; COMMIT
  S-->>B: 200 member(active)
  Note over O,S: duplicate invite → 409 WALLET_MEMBER_EXISTS
```

## 3. Error flows

| Scenario | HTTP | Code | Kind |
|---|---|---|---|
| Missing/invalid JWT | 401 | — | auth |
| Bad role / identifier shape / inviting self / owner leaving | 400 | `INVALID_INPUT` | validation |
| Not owner (manage), no access (read), viewer (write), removed member | 403 | `WALLET_ACCESS_DENIED` | authorization |
| Editing someone else's entry | 403 | `TRANSACTION_ACCESS_DENIED` | authorization |
| Wallet missing/deleted | 404 | `WALLET_NOT_FOUND` | validation |
| Identifier matches no active account | 404 | `WALLET_MEMBER_USER_NOT_FOUND` | validation |
| No live membership for that user | 404 | `WALLET_MEMBER_NOT_FOUND` | validation |
| No pending invitation | 404 | `WALLET_INVITATION_NOT_FOUND` | validation |
| Already a member / invited | 409 | `WALLET_MEMBER_EXISTS` | conflict |
| 10 live memberships | 409 | `WALLET_MEMBER_LIMIT` | conflict |
| Unknown colour key | 400 | `INVALID_INPUT` | validation |
| DB failure | 500 | `INTERNAL_ERROR` | system |

## 4. Convention notes

| Rule | Status | How |
|---|---|---|
| Handler = shape, service = rules | Required | DTO `validate` tags; all role/limit rules in services |
| Handler never imports repository | Required | new handler talks to `WalletMemberService` only |
| Money BIGINT xu, never float | Required | no new money field; balances untouched |
| Same-DB-tx balance rule | Required | unchanged create/update/delete statements |
| Soft delete | Required | memberships `removed_at`; queries filter `wallets.deleted_at IS NULL` |
| User isolation | Required | every query scoped by caller or by a wallet the service proved access to; `ListUserDisplayNames` only receives ids taken from rows the caller may read |
| Timestamps UTC | Required | TIMESTAMPTZ, client formats |
| Files ≤ 300 lines | Required | member service/handler/repo in their own files |
| Mobile server state in TanStack Query | Required | members/invitations are queries; invalidations on mutate |
| Copy | Required | `pfm-ux-copy`; glossary gains "Ví chung", "Chủ ví", "Ghi chép", "Chỉ xem", "Lời mời" |

## 5. testIDs (mobile)

| Element | testID |
|---|---|
| Share / members action | `btn-wallet-share` |
| Members sheet | `sheet-wallet-members` |
| Invite field / role tabs / submit | `input-wallet-invite`, `tabs-wallet-invite-role`, `btn-wallet-invite-send` |
| Member row | `row-wallet-member-{userId}` |
| Leave wallet | `btn-wallet-leave` |
| Invitation card accept / decline | `btn-wallet-invite-accept-{walletId}`, `btn-wallet-invite-decline-{walletId}` |
| Colour swatch | `swatch-wallet-color-{key}` |

## 6. Open tasks

| ID | Task | File |
|---|---|---|
| SHW-T01 | Migrations 034 (color) + 035 (wallet_members, indexes, transactions(wallet_id) partial index) | `backend/db/migrations/` |
| SHW-T02 | Queries + hand-written sqlc: wallets color/shared list/member counts; wallet_members; notifications insert; list/count `wallet_scoped` | `db/queries/*.sql`, `repository/sqlc/*.go` |
| SHW-T03 | Errors | `internal/common/errors_wallet_members.go` |
| SHW-T04 | Models | `internal/model/wallet.go`, `wallet_member.go` |
| SHW-T05 | `WalletMemberRepository` (+ tx for member+notification) and wallet repo additions | `internal/repository/` |
| SHW-T06 | `walletAccess` + `WalletMemberService` + tests | `internal/service/` |
| SHW-T07 | TransactionService gates + recorder names + tests | `internal/service/transaction_*` |
| SHW-T08 | WalletService list/get with shared + color | `internal/service/wallet_service.go` |
| SHW-T09 | Fakes updated | `internal/service/fake_*_test.go` |
| SHW-T10 | DTOs + handlers + routes + wiring | `internal/dto`, `internal/handler`, `cmd/server` |
| SHW-T11 | Mobile palette + colour picker + card ink | `src/lib/wallet-colors.ts`, wallets components |
| SHW-T12 | Mobile types, query scope, access helpers, totals, pickers | `features/wallets`, pickers |
| SHW-T13 | Mobile members sheet, invite form, invitation cards, recorder labels, notifications routing | `features/wallets/components`, `app/(app)` |
| SHW-T14 | Glossary entries | `.claude/skills/pfm-ux-copy/references/glossary.md` |
