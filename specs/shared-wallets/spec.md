# Feature Spec: F-03 Shared Wallets ("Ví chung")

> Source: owner request 2026-10-21 ("nhiều tài khoản cùng quản lý một sổ thu chi"), `SRS.md` Feature-03, `specs/wallet-management/spec.md`
> Status: Release 1. Extends F-03 Wallet Management; touches F-06 Transaction Management (access rules), F-10 Notification Handling (invitation notices)
> Clients: `mobile/` only. `frontend/` (web) is frozen and is not changed; it keeps calling `GET /wallets` without the new flag, so it never sees a shared wallet.

## Context

### What the repo said, and why it was wrong

The app calls the admin's account list "Thành viên gia đình" (Household Members), which reads as "a family keeps its money together here". The data model does the opposite: `specs/wallet-management/spec.md` says "wallets are personal, not shared", and every wallet, transaction, budget and report query is isolated by `user_id`. Two people in one household therefore cannot keep one shared book of income and spending: each records into their own wallets and nobody sees the household total.

### Decision: share the Wallet, do not add a "Book"

A **cashbook** (one balance plus the list of entries that move it) is exactly what a Wallet already is in this app. The best-practice options were:

| Option | Seen in | Cost here | Verdict |
|---|---|---|---|
| **A. Shared wallet**: a wallet gets members with roles; everyone with access sees its balance and entries; editors add entries | Spendee "shared wallets", Money Lover "shared wallet", CashBook "book members" | One membership table; access checks at the existing wallet gate; one wallet-scoped list mode | **Chosen** |
| B. Shared "Book/Space" that owns its own wallets, categories, budgets | YNAB shared plans, CashBook "businesses" | A `book_id` on every entity, every query re-scoped, a space switcher in every screen | Rejected: rebuilds the whole data model for the same outcome |
| C. Copy entries between personal wallets | — | — | Rejected: two balances that drift |

The glossary rule "one concept = one word; a wallet is always *ví*" also points to A: the UI calls it **ví chung** (shared wallet), never "sổ" or "nguồn tiền".

### Actors
- **Owner** (Chủ ví): the account that created the wallet (`wallets.user_id`). Exactly one per wallet. Never a row in the membership table.
- **Editor** (Ghi chép): may view the wallet and record income, expenses and transfers into or out of it.
- **Viewer** (Chỉ xem): may view the wallet's balance and entries; may not record.
- **Invitee**: an account that has a pending invitation and no access yet: an active account, or one invited by email that has not been activated (BR-03a).

### Domain Fields (conceptual; schema in `plan.md`)
A **Wallet Membership** links one Wallet to one User with a `role` (`editor` | `viewer`), a `status` (`pending` | `active`), who invited them, and timestamps for invited / accepted / removed. A removed or declined membership is kept (soft, `removed_at`) for history; at most one live (not removed) membership per (wallet, user).

## Business Rules

| # | Rule |
|---|---|
| BR-01 | Only the owner invites, changes roles, removes members, and edits the wallet itself (name, type, currency, icon, card colour, default flag). |
| BR-02 | A wallet has at most **10** live memberships (pending + active). **Explicit assumption**: a household, not a company. |
| BR-03 | An invitation targets an existing **active** account, found by email (case-insensitive) or tên đăng nhập. The owner cannot invite themself. A user with a live membership cannot be invited again (409). |
| BR-03a | **Invite by email (2026-10-29, product decision; replaces the old Out of Scope line).** An email with no account behind it is invited all the same: in the invitation's transaction the server creates a **pending** account (role member, `invited_by` = the owner, the same 72h activation token as an admin invite) and emails the activation link, naming the owner and the wallet. An account invited before but never activated is invited the same way; its link is re-sent while valid, renewed once expired. After activating and signing in, the invitation waits in Ví chung like any other. A tên đăng nhập with no account, and disabled or still-requested accounts, stay `404`. Invitations are rate-limited per owner like an admin's invites. |
| BR-04 | An invitation grants nothing until accepted. It does not expire; the owner can cancel it (= remove the pending member). **Explicit assumption.** |
| BR-05 | Read access (balance, entries, member list) = owner or **active** member of any role. Write access (record into the wallet) = owner or active **editor**. |
| BR-06 | ⚠️ One wallet, one balance. A transaction recorded by any editor changes the wallet balance in the same DB transaction as the insert, exactly like the owner's (existing CLAUDE.md rule). |
| BR-07 | The person who recorded a transaction is the only one who can edit or delete it, and only while they still have write access to every wallet it touches. The owner cannot edit another member's entry. **Explicit assumption** (see Open Question 1). |
| BR-08 | ⚠️ Removing a member, or a member leaving, never deletes or moves their transactions: they stay in the wallet and keep its balance correct. The person only loses access. |
| BR-09 | Personal views keep meaning "what I recorded": the Transactions tab, reports, insights, budgets, budget alerts, AI consult and export stay scoped to `transactions.user_id = caller`, unchanged. A shared wallet's own list is the place to see everyone's entries. |
| BR-10 | Net worth (tài sản ròng) counts only wallets the caller owns, so a household's shared wallet is not counted twice. |
| BR-11 | The currency lock (409 `CURRENCY_LOCKED`) counts every transaction in the wallet, whoever recorded it (already the case). |
| BR-12 | A transfer may use any two wallets the caller can write to (e.g. from a personal wallet into the shared one). |
| BR-13 | Wallet-scoped entry lists show who recorded each entry (display name); members see each other's display name and tên đăng nhập, never password, sessions or other wallets. **Privacy note**: a transfer into a shared wallet shows the source wallet's name to the other members. |

---

## US-01: Invite someone to a wallet

**As an** Owner, **I want** to invite another account to one of my wallets with a role **so that** we can keep one book together.

**API:** `POST /wallets/{id}/members` body `{ identifier: string, role: "editor" | "viewer" }`

### Main Flow
1. Owner opens the wallet's sharing sheet and types an email or tên đăng nhập, picks a role.
2. System validates shape: `identifier` 3–254 chars, `role` in enum (handler).
3. System checks the caller owns the wallet (service; 404 if missing/deleted, 403 if not owner).
4. System resolves the identifier to an active account; rejects self, existing live member, and the limit (service).
5. System inserts a `pending` membership and a `wallet_invite` notification for the invitee, in one DB transaction.
6. System returns `201` with the member object (`status: "pending"`).

### Scenarios
| ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-SHW-01 | Owner, wallet W, account B active | invite B as editor | `201`, B pending; B gets a `wallet_invite` notification | Happy path |
| S-SHW-02 | — | `role = "admin"` | `400 INVALID_INPUT` | Validation |
| S-SHW-03 | Caller is a member, not owner | invites | `403 WALLET_ACCESS_DENIED` | BR-01 |
| S-SHW-04 | identifier is a tên đăng nhập with no account, or a disabled / requested account | invites | `404 WALLET_MEMBER_USER_NOT_FOUND` | An email with no account, or a pending one, is BR-03a |
| S-SHW-04a | identifier is an email with no account | invites | `201`, member `pending` with `account_pending: true`; pending account created; activation email sent | BR-03a |
| S-SHW-05 | identifier is the owner | invites | `400 INVALID_INPUT` | BR-03 |
| S-SHW-06 | B already pending or active | invites B | `409 WALLET_MEMBER_EXISTS` | Natural idempotency via the live-membership unique index |
| S-SHW-07 | W has 10 live memberships | invites | `409 WALLET_MEMBER_LIMIT` | BR-02 |
| S-SHW-08 | Two identical invites race | both | exactly one `201`, the other `409` | ⚠️ enforced by the partial unique index, not app code |

### Idempotency
Retried invite after a timeout returns 409 `WALLET_MEMBER_EXISTS`; the client treats it as "already invited" and refreshes the member list.

### Definition of Done
Endpoint + unit tests for S-SHW-02..07; the race (S-SHW-08) is guaranteed by a unique index in the migration.

---

## US-02: Accept or decline an invitation

**As an** Invitee, **I want** to see invitations and accept or decline them **so that** nobody puts me in a book without my consent.

**API:** `GET /wallets/invitations` · `POST /wallets/{id}/invitation/accept` · `POST /wallets/{id}/invitation/decline`

### Main Flow
1. Invitee opens Wallets (or taps the notification); System lists their pending invitations with wallet name, currency, owner's display name and role.
2. Accept: System sets the membership `active` (+ `accepted_at`) and notifies the owner (`wallet_member_joined`). The wallet appears in the invitee's wallet list.
3. Decline: System sets `removed_at`; the owner can invite again later.

### Scenarios
| ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-SHW-10 | B pending on W | B accepts | `200`, active; W in B's `GET /wallets?include_shared=true` | |
| S-SHW-11 | B already active | B accepts again | `200`, unchanged | Idempotent |
| S-SHW-12 | No live pending invite for B on W | B accepts/declines | `404 WALLET_INVITATION_NOT_FOUND` | Covers cancelled invites |
| S-SHW-13 | B pending | B declines | `204`; W never visible to B | |
| S-SHW-14 | W soft-deleted after the invite | B lists invitations | not listed | |

### Definition of Done
Three endpoints; `GET` returns `{ data: [] }` (not null) when empty; tests for S-SHW-10..13.

---

## US-03: See shared wallets in my wallet list

**API:** `GET /wallets?include_shared=true` (flag absent = old behaviour: owned wallets only, for web and old app builds).

### Response additions (every item)
`access: "owner" | "editor" | "viewer"`, `owner_name: string | null` (null on owned wallets), `member_count: integer` (active members, owner excluded). Owned wallets first in the existing order, then shared ones by `accepted_at`.

### Scenarios
| ID | Given | When | Then |
|---|---|---|---|
| S-SHW-20 | B active editor on A's W | B lists with flag | W present, `access = "editor"`, `owner_name = A's name` |
| S-SHW-21 | B pending on W | B lists | W absent |
| S-SHW-22 | Any caller | lists without flag | owned wallets only (backward compatible) |
| S-SHW-23 | B removed from W | B lists / `GET /wallets/{W}` | absent / `403 WALLET_ACCESS_DENIED` |

`GET /wallets/{id}` returns the wallet to the owner and to active members (same added fields).

---

## US-04: Record into, and read, a shared wallet

**APIs:** existing `POST/PATCH/DELETE /transactions`, `GET /transactions?wallet_id=`.

### Rules applied
- Create: the wallet (and the transfer's destination) must pass write access (BR-05); viewers get `403 WALLET_ACCESS_DENIED`.
- Update/Delete: recorder only (BR-07) and the recorder must still have write access to the wallet(s) involved; otherwise `403`.
- `GET /transactions?wallet_id=W` for a caller with read access returns **every** member's entries in W (newest first, same cursor/filters/total), each with `recorded_by: { id, name }` when the recorder is not the caller. Without `wallet_id` the list stays the caller's own entries (BR-09).

### Scenarios
| ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-SHW-30 | B editor on W (balance 1.000.000đ) | B records an expense 200.000đ in W | `201`; W balance 800.000đ for A and B | ⚠️ BR-06, same DB tx |
| S-SHW-31 | C viewer on W | C records into W | `403 WALLET_ACCESS_DENIED` | |
| S-SHW-32 | A owns W | A lists `wallet_id=W` | A's and B's entries; B's carry `recorded_by` | |
| S-SHW-33 | A owns W | A edits B's entry | `403 TRANSACTION_ACCESS_DENIED` | BR-07 |
| S-SHW-34 | B was removed from W | B deletes an entry B recorded in W | `403 WALLET_ACCESS_DENIED`; balance unchanged | ⚠️ protects the owner's balance |
| S-SHW-35 | B editor on W | B transfers 500.000đ from B's own wallet into W | `201`; both balances move in one DB tx | BR-12 |
| S-SHW-36 | B editor on W | B opens the Transactions tab | only B's own entries (incl. the ones in W) | BR-09 |
| S-SHW-37 | Two editors record into W at the same time | both | both succeed; final balance = start − both amounts | ⚠️ existing conditional `UPDATE … balance >= amount` guard |

### Edge cases
1. Expense larger than the shared balance: `409 INSUFFICIENT_BALANCE`, same as personal wallets.
2. An entry recorded by a member whose account was later deleted keeps its recorder name (looked up without the deleted filter).
3. Idempotency keys stay per recorder (existing `X-Idempotency-Key` handling).

---

## US-05: Manage members

**APIs:** `GET /wallets/{id}/members` (owner or active member) · `PATCH /wallets/{id}/members/{user_id}` `{ role }` (owner) · `DELETE /wallets/{id}/members/{user_id}` (owner removes or cancels; a member with `user_id = self` leaves).

| ID | Given | When | Then |
|---|---|---|---|
| S-SHW-40 | A owner, B editor | A changes B to viewer | `200`; B can no longer record (S-SHW-31) |
| S-SHW-41 | B editor | B leaves | `204`; W disappears from B's list; B's entries stay in W (BR-08) |
| S-SHW-42 | A owner | A tries to leave own wallet | `400 INVALID_INPUT` (owner cannot leave) |
| S-SHW-43 | B member | B removes C | `403 WALLET_ACCESS_DENIED` |
| S-SHW-44 | — | target user has no live membership | `404 WALLET_MEMBER_NOT_FOUND` |

Member list shape: owner first (`role: "owner"`), then members by invite time: `{ user_id, name, username, role, status, invited_at, accepted_at }`. The `name` is the display name (full name, else tên đăng nhập, else the email's local part).

---

## US-06: Mobile experience

1. **Wallets screen**: pending invitations sit on top as cards ("{Chủ ví} mời bạn vào ví {Ví}", role, [Tham gia] [Từ chối]). The notification `wallet_invite` opens this screen.
2. **Cards** (Home + Wallets): shared wallets appear in the carousel with a small "Ví chung" mark; owned wallets with members show the member count. Card colour follows the owner's choice.
3. **Actions under the centred card**: owner gets "Chia sẻ" (members sheet with invite form); a member gets "Thành viên" (read-only list + "Rời ví"); members never get "Sửa" / "Đặt mặc định".
4. **Recent entries** of a shared wallet show who recorded each one and a "Xem thêm" to page further.
5. **Pickers** (manual form, AI proposal editor, transfer destination): owned + editor wallets; never viewer wallets.
6. **Net worth** (Settings, Home): owned wallets only.
7. All membership actions are online-only (`useRequireOnline`).

### UI states
| Surface | Loading | Empty | Error | Success |
|---|---|---|---|---|
| Invitation cards | nothing shown (no skeleton: they are an extra, not the screen's content) | nothing shown | nothing shown; the wallet list still works | accepted: the card leaves, the wallet appears in the carousel; declined: the card leaves |
| Members sheet | row skeletons | owner row, then "Chưa có ai khác trong ví." (+ invite form for the owner) | one line saying the list did not load + retry | invite: the new row appears as "Chờ chấp nhận"; remove/leave: the row leaves |
| Invite form | button busy, inputs locked | — | the server's message under the field (not found, already a member, limit) | field clears |
| Shared wallet entries | existing row skeletons | existing "Ví này chưa có giao dịch nào." | existing error line | rows with who recorded them |

---

## Edge Cases (cross-story)

1. ⚠️ **Removal race**: a member is removed a few ms after their create request passed the access check; the entry is saved. Accepted: the balance stays consistent (it moved inside the same DB tx as the insert), and the owner sees who recorded it.
2. **Owner's account deleted**: the wallet stays (soft delete never cascades); members keep access. Ownership transfer is out of scope.
3. **Wallet soft-deleted** (no endpoint today): every membership query filters `wallets.deleted_at IS NULL`.
4. **Old app builds** (before the OTA): they call `GET /wallets` without the flag and keep working with owned wallets only.
5. **Offline**: the cached wallet list keeps shared wallets; recording into one offline goes through the existing outbox and is checked when it syncs (a 403 on sync uses the outbox's existing error path).
6. **A member's custom category** on an entry: other members see the category name from the joined row; the icon falls back to the default glyph.

## Out of Scope
- Ownership transfer, multiple owners, an "admin" member role.
- Shared budgets, shared categories, household-wide reports ("tổng chi cả nhà").
- Push notifications (in-app only), web client support.

## Open Questions
1. Should the owner be able to edit/delete members' entries (CashBook allows owners to)? Shipped as "recorder only" (BR-07): fewer surprises, smaller blast radius. Revisit after household use.
2. Should a shared wallet count toward members' net worth as "phần của bạn"? Shipped as owner-only (BR-10).
3. Should leaving require the owner's confirmation? Shipped as "no": leaving only removes the leaver's own access.
