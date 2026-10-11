# Feature Spec: F-06 Transaction Management — Items of a Transaction (Release 1)

> Source: SRS Feature-06 US-06, US-07, US-08 (added 2026-10-11) · FR-02 · BF-05. Product-owner decisions of 2026-10-11 folded in (Resolved design decisions 1–4).
> Status: Specced 2026-10-11. Open Questions resolved by the product owner 2026-10-11: Items in the export (BR-15), a warning on concurrent edits (BR-16), line amount vs quantity × unit price stays unchecked (BR-05).
> Related: [F-06 Transaction Management](../transaction-management/spec.md) (create / update / delete rules, all unchanged unless stated) · [Feature-12 US-05 Record Transactions from an Image](../ai-chat-image-capture/spec.md) (a receipt proposal now carries its Items — amended in that spec, BR-15) · [Offline support](../mobile-offline-support/spec.md) (queued create) · [Transaction audit log](../transaction-audit-log/spec.md) (edit history)
> Clients: **`mobile/` only.** `frontend/` (web) is frozen — see Out of Scope.
> Feature code: `TXI`.

## Context

A Transaction today is one amount in one Category. A supermarket or market trip is one payment made of many products, and the User wants to keep what was bought — names, quantities, prices — without splitting the payment into dozens of Transactions that clutter the list and each move the Wallet balance separately.

This feature lets a Transaction carry an optional list of **Items** (what was bought or received) and **Adjustments** (tax, fee, discount and similar lines that explain why the Items do not add up to the amount paid). The Transaction stays one Transaction: one amount, one Category, one Wallet balance change. Items are detail, not money movement.

**Actors**
- **User** — any `active` user (`admin` or `member`); Items are personal, like the Transaction they belong to.

**Resolved design decisions**
1. **Items have no Category of their own.** Every Item belongs to its Transaction's Category. Reports, Budgets and analytics keep counting the Transaction amount under the Transaction Category, exactly as today.
2. **Quantity is a whole number.** There is no fractional quantity. A unit such as "kg" or "lít" is written by the User in the Item name when they want it (e.g. "Thịt heo 0.5kg", quantity 1).
3. **Items are editable after the Transaction is saved**, under the same conditions as the rest of a saved Transaction.
4. **The Transaction amount (the total actually paid or received) is the source of truth.** Items may add up to a different number only when the difference is explained, line by line, by Adjustments (e.g. a tax line, a discount line). An unexplained difference is never saved.
5. **No new way to move money.** Creating, editing or deleting Items never moves a Wallet balance by itself. Only a change of the Transaction amount does, through the existing Transaction rules.

### Business Rules

| ID | Rule |
|---|---|
| BR-01 | Items and Adjustments are optional. A Transaction with none behaves exactly as today. |
| BR-02 | Items and Adjustments are allowed on income and expense Transactions, never on a transfer. |
| BR-03 | Each Item has a name (required), a quantity (whole number ≥ 1, default 1), an optional unit price, and a line amount (required, > 0). |
| BR-04 | ⚠️ Money: unit price, line amount and Adjustment amount are integer amounts in xu (minor unit) of the Transaction's Wallet currency, never fractional at any step. No currency conversion. All arithmetic is on whole numbers, so no rounding ever happens. |
| BR-05 | The line amount is what was charged for that line, as printed or entered. When the User enters a unit price, the app pre-fills the line amount as quantity × unit price; the User may overwrite it (e.g. a line printed with its own markdown). The System never recomputes a saved line amount. |
| BR-06 | Each Adjustment has a kind — tax, fee, discount, or other — a direction (adds to or subtracts from the Items total) and an amount > 0. Tax and fee always add; discount always subtracts; "other" requires the User to choose the direction and to write a label. |
| BR-07 | ⚠️ **Balance rule.** When a Transaction has at least one Item, the Items total (sum of line amounts) plus the adding Adjustments minus the subtracting Adjustments must equal the Transaction amount exactly. A save that breaks this is rejected as a business-rule error and nothing is written. |
| BR-08 | An Adjustment without any Item is not allowed (there is nothing to adjust). |
| BR-09 | A Transaction holds at most the item maximum of Items and the adjustment maximum of Adjustments; an Item name and an Adjustment label are capped at the name maximum. Exact values are owned by the plan. |
| BR-10 | ⚠️ Items and Adjustments are saved in the same single write as the Transaction they belong to — together with the Wallet balance change when the amount changes. There is never a moment where a Transaction is saved without its Items, or its Items without the Transaction. |
| BR-11 | ⚠️ An edit replaces the whole Item and Adjustment list in one step. Lists are never merged item by item. |
| BR-12 | A removed Item or Adjustment is never permanently erased: it stays visible in the Transaction's edit history. A deleted Transaction keeps its Items with it (soft delete, existing behavior). |
| BR-13 | Items are read and written only by the User who owns the Transaction. |
| BR-14 | Reports, Budgets, the Home summary and AI analytics always use the Transaction amount and Category. Items never change any total. |
| BR-15 | The Transaction export includes every Item and Adjustment of the exported Transactions, on its own sheet, linked to its Transaction. The main sheet is unchanged, so an exported file can still be imported (Items are not imported). |
| BR-16 | ⚠️ An edit made from a copy of the Transaction that has since changed (for example on another device) is not saved silently. The User is warned that the Transaction changed and chooses to load the latest version (discarding their edit) or to save their edit over it. |
| BR-17 | A typed AI Chat message describing **one** purchase line by line (e.g. a shop or wallet name followed by a list) is proposed as **one** Transaction carrying those Items, its amount being their sum; unrelated expenses in one message stay separate proposals. The System computes the sum itself, never trusting the AI's arithmetic. Any unreadable line drops the whole list and the proposal stays a plain Transaction. Added 2026-10-11. |

### Key Entities

| Entity | Role in this feature |
|---|---|
| Transaction | Existing. Gains an optional, ordered list of Items and Adjustments. Its amount, Category, Wallet and type rules are unchanged. |
| Item | New. One line of what was bought or received: name, quantity, optional unit price, line amount. Belongs to exactly one Transaction; has no Category. |
| Adjustment | New. One line that explains the gap between the Items total and the Transaction amount: kind, direction, label, amount. Belongs to exactly one Transaction. |
| Wallet | Read-only context; its currency is the currency of every Item and Adjustment amount. |
| Transaction edit history | Existing. Records Item and Adjustment changes alongside other field changes. |

---

## Preconditions (feature-level)

- The User is authenticated.
- The Transaction rules of F-06 hold unchanged (Wallet ownership, Category type match, balance floor on create only).

---

## US-01: Add Items when recording a Transaction

**As a** User,
**I want** to list the Items (and any tax, fee or discount lines) of a purchase while recording it,
**so that** I keep what I bought without splitting one payment into many Transactions.

**API:** existing `POST /api/v1/transactions` (gains the optional Item and Adjustment lists).

### Preconditions
- The User is on the create Transaction form, with type income or expense.

### Main Flow
1. User opens the create Transaction form and picks income or expense, a Wallet and a Category as today.
2. User taps the add-items entry on the form.
3. System opens the Items editor, empty, showing the Wallet currency.
4. User adds an Item: name, quantity (default 1), optional unit price, line amount (pre-filled from quantity × unit price when a unit price is entered, BR-05).
5. User repeats step 4 for each Item and, if the receipt shows them, adds Adjustments (tax, fee, discount, other).
6. System shows, live: the Items total, each Adjustment, the computed total (BR-07), and whether it matches the Transaction amount.
7. While the User has not typed a Transaction amount, the amount follows the computed total. Once the User types an amount themselves, it stops following and the System shows the gap instead.
8. When there is a gap, System offers to add the difference as an "other" Adjustment (the User must still write its label), or to change the amount to the computed total.
9. User closes the Items editor; the form shows a short Items summary (count and computed total).
10. User saves the Transaction.
11. System validates the Items and Adjustments (BR-02 to BR-09), then saves the Transaction, its Items and Adjustments and the Wallet balance change in one write (BR-10), using the existing idempotency key.
12. System shows the saved Transaction as today; its list row shows that it has Items.

### Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-01 | The add-items entry is shown for income and expense, and hidden for transfer. |
| AC-02 | An Item cannot be added without a name and a line amount > 0.<br>Its quantity is a whole number ≥ 1 and defaults to 1. |
| AC-03 | Entering a unit price pre-fills the line amount as quantity × unit price.<br>The User can overwrite the pre-filled line amount. |
| AC-04 | An Adjustment of kind tax or fee always adds, discount always subtracts.<br>Kind "other" cannot be kept until the User picks a direction and writes a label. |
| AC-05 | The editor always shows the Items total, the computed total and whether it matches the Transaction amount, updated after every change. |
| AC-06 | While no amount was typed by the User, the Transaction amount equals the computed total.<br>After the User types an amount, the amount no longer changes by itself. |
| AC-07 | ⚠️ A Transaction whose computed total differs from its amount cannot be saved.<br>The form shows the gap and offers both fixes (add an "other" Adjustment, or use the computed total as the amount). |
| AC-08 | Items and Adjustments can be reordered and removed before saving. |
| AC-09 | The User cannot add more than the item maximum of Items or the adjustment maximum of Adjustments; the editor says the limit was reached. |
| AC-10 | ⚠️ Saving creates the Transaction with all its Items and Adjustments, or nothing at all.<br>Retrying the same save never creates a second Transaction or a second copy of the Items. |
| AC-11 | Removing every Item before saving also removes every Adjustment (BR-08), and the Transaction is saved as a plain Transaction. |
| AC-12 | Recording a Transaction with Items while offline queues it with its Items; when it syncs, it is saved with the same Items and Adjustments. |
| AC-13 | Switching the type to transfer after adding Items asks the User to confirm that the Items will be removed; cancelling keeps the previous type. |

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-TXI-01 | VND Wallet balance 1,000,000 đ; expense Category "Food" | User records an expense with Items "Sữa" 2 × 15,000 = 30,000 đ and "Bánh mì" 1 × 20,000 = 20,000 đ, no amount typed | `201`; Transaction amount 5,000,000 xu (50,000 đ) with 2 Items; balance 950,000 đ | Happy path — amount follows Items |
| S-TXI-02 | Same | Items total 100,000 đ; Adjustment tax adds 8,000 đ; User types amount 108,000 đ | `201`; 1 Transaction of 108,000 đ with 2 Items and 1 Adjustment; balance moves once by 108,000 đ | BR-07 with tax |
| S-TXI-03 | Same | Items total 120,000 đ; Adjustment discount subtracts 20,000 đ; amount 100,000 đ | `201` | BR-07 with discount |
| S-TXI-04 | ⚠️ Same | Items total 100,000 đ; no Adjustment; User types amount 108,000 đ and saves | Save blocked on the device with the 8,000 đ gap shown; if sent anyway, `422 ITEMS_TOTAL_MISMATCH`; nothing written; balance unchanged | BR-07 |
| S-TXI-05 | Gap of 8,000 đ shown | User picks "add the difference as an Adjustment", writes the label, saves | `201`; Adjustment "other", adds 8,000 đ, with the User's label | Main Flow step 8 |
| S-TXI-06 | — | User adds an Item without a name, or with line amount 0, or quantity 0, or quantity 1.5 | The Item cannot be kept; if sent, `400 INVALID_INPUT` | Validation error |
| S-TXI-07 | — | Request carries a fractional line amount, unit price or Adjustment amount | `400 INVALID_INPUT` | ⚠️ BR-04 |
| S-TXI-08 | — | Request carries Adjustments but no Item | `400 INVALID_INPUT` | BR-08 |
| S-TXI-09 | — | A transfer is sent with Items | `422 ITEMS_NOT_ALLOWED` | BR-02 |
| S-TXI-10 | — | Request carries more than the item maximum of Items | `400 INVALID_INPUT` | BR-09 |
| S-TXI-11 | — | Adjustment of kind "other" without a label or direction | `400 INVALID_INPUT` | BR-06 |
| S-TXI-12 | ⚠️ Save of S-TXI-02 times out on the device; the app retries with the same idempotency key | — | `200` with the original Transaction and its Items; one Transaction, one set of Items, one balance change | AC-10 |
| S-TXI-13 | Wallet balance 50,000 đ | User records an expense with Items adding up to 80,000 đ | `409 INSUFFICIENT_BALANCE`; nothing written | Existing floor, unchanged |
| S-TXI-14 | Device offline | User records S-TXI-02 | Queued with its Items; after sync `201` with identical Items and Adjustments | AC-12 |
| S-TXI-15 | Unit price 15,000 đ, quantity 3 | User enters them | Line amount pre-filled 45,000 đ; User changes it to 40,000 đ; saved as 40,000 đ | BR-05 |
| S-TXI-16 | No/invalid access token | Any request with Items | `401 UNAUTHENTICATED` | — |
| S-TXI-17 | Expense with 2 Items | User changes the type to transfer | Confirmation that the Items will be removed; on confirm the Items and Adjustments are cleared | AC-13 |

### Edge Cases
- **EC-01** ⚠️ Rounding on paper receipts (e.g. total rounded to the nearest 1,000 đ): the User records the difference as an "other" Adjustment with a label; the System never absorbs it silently.
- **EC-02** Two Items with the same name are allowed (e.g. the same product scanned twice); they stay separate lines.
- **EC-03** An Item with a line amount greater than the Transaction amount is allowed when a discount explains it (BR-07 is the only total check).
- **EC-04** A discount larger than the Items total would make the computed total ≤ 0: the save is rejected, since a Transaction amount is always > 0.
- **EC-05** The User changes the Wallet (to one in another currency) after entering Items: the amounts stay as entered and are read in the new Wallet's currency; the editor shows the new currency. No conversion.
- **EC-06** The User leaves the form with unsaved Items: the existing discard-changes behavior of the form applies to the Items too.
- **EC-07** A queued Transaction with Items is rejected on sync (e.g. insufficient balance): it stays in the queue with its Items, as any queued Transaction does today.

### Client UI States (`mobile/`)

| State | Trigger | Expected UI |
|---|---|---|
| No Items | Form opened | Add-items entry visible (income/expense only) |
| Editing — matched | Computed total equals the amount | Totals shown; match indicator |
| Editing — gap | Computed total differs from a typed amount | Gap shown in money; both fixes offered; save disabled |
| Limit reached | Item or Adjustment maximum hit | Add action disabled with a short explanation |
| Summary | Editor closed with Items | Form shows Item count and computed total |
| Saving | Save tapped | Existing saving state |
| Error | `400` / `409` / `422` / network | Existing form error area shows what failed; Items stay as entered |
| Queued | Saved offline | Existing queued state; Items kept |

### Definition of Done
- [ ] S-TXI-01 to S-TXI-17 pass (Backend tests for the API rules; on-device check for the form).
- [ ] A test proves a Transaction and its Items are written together or not at all (BR-10).
- [ ] A retry test proves one Transaction, one set of Items and one balance change (S-TXI-12).
- [ ] A queued Transaction with Items syncs with identical Items (S-TXI-14).

---

## US-02: View the Items of a Transaction

**As a** User,
**I want** to see the Items and Adjustments of a recorded Transaction,
**so that** I can check what a payment was for.

**API:** existing `GET /api/v1/transactions/:id` (returns the lists); existing `GET /api/v1/transactions` (each row says whether the Transaction has Items and how many).

### Preconditions
- The Transaction exists, is not deleted and is owned by the User.

### Main Flow
1. User sees, in the Transaction list, a marker with the Item count on Transactions that have Items.
2. User opens the Transaction.
3. System shows its Items in the saved order (name, quantity, unit price when present, line amount), then its Adjustments, then the Items total and the Transaction amount.

### Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-14 | A list row shows an Item-count marker only when the Transaction has Items. |
| AC-15 | The opened Transaction shows every Item in saved order, every Adjustment, the Items total and the amount. |
| AC-16 | A Transaction without Items looks exactly as today. |
| AC-17 | All amounts show in the Wallet currency with the shared money format. |
| AC-18 | Only the owner can see a Transaction's Items. |
| AC-28 | The exported file holds a second sheet listing every Item and Adjustment of the exported Transactions, each row identifying its Transaction (date, amount, note) and its kind, name or label, quantity, unit price and amount.<br>The first sheet keeps its current columns. |

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-TXI-18 | Transaction from S-TXI-02 | User views the list | Row shows a 2-Item marker | AC-14 |
| S-TXI-19 | Same | User opens it | 2 Items, 1 tax Adjustment, Items total 100,000 đ, amount 108,000 đ | AC-15 |
| S-TXI-20 | Another User's Transaction with Items | User requests it | `403 TRANSACTION_ACCESS_DENIED`; no Item is returned | ⚠️ BR-13 |
| S-TXI-21 | Transaction without Items | User opens it | Same screen as today | AC-16 |
| S-TXI-22 | Deleted Transaction with Items | User requests it | `404 TRANSACTION_NOT_FOUND` | Existing rule |
| S-TXI-33 | Transaction S-TXI-02 is in the export range | User exports | First sheet as today; second sheet has 2 Item rows and 1 tax row linked to that Transaction | AC-28 |
| S-TXI-34 | No exported Transaction has Items | User exports | Second sheet holds only its header row | AC-28 |

### Edge Cases
- **EC-08** A long list (up to the item maximum) scrolls within the Transaction view; the totals stay reachable.
- **EC-09** A Transaction viewed offline from the cache shows the Items that were cached with it; when they were never cached, it shows the Item count only.
- **EC-10** An Item name in a different language or with symbols is shown as entered.

### Client UI States (`mobile/`)

| State | Trigger | Expected UI |
|---|---|---|
| No Items | Transaction has none | Same as today; no marker, no Items section |
| With Items | Transaction has Items | Marker on the list row; Items section with lines and totals |
| Loading | Opening a Transaction not yet loaded | Existing loading state |
| Offline, not cached | Items never loaded on this device | Item count only, with a short note that the list needs a connection |
| Error | Load fails | Existing error state with retry |

### Definition of Done
- [ ] S-TXI-18 to S-TXI-22 pass.
- [ ] The cross-user test proves no Item leaks (S-TXI-20).

---

## US-03: Edit the Items of a saved Transaction

**As a** User,
**I want** to add, change or remove Items and Adjustments of a Transaction I already saved,
**so that** I can correct a misread line or finish a list I started later.

**API:** existing `PATCH /api/v1/transactions/:id` (gains the optional Item and Adjustment lists).

### Preconditions
- The Transaction exists, is not deleted, is owned by the User, and is income or expense.
- The device is online (existing rule for editing a saved Transaction).

### Main Flow
1. User opens the saved Transaction and taps the Items entry.
2. System opens the Items editor with the saved Items and Adjustments.
3. User adds, changes, reorders or removes lines; System shows the totals and the match status live (as in US-01).
4. If the computed total no longer matches, User either adds or edits an Adjustment, or changes the Transaction amount.
5. User saves.
6. System checks the balance rule (BR-07) against the amount after this edit, replaces the whole Item and Adjustment list (BR-11), applies the existing amount-change balance rule when the amount changed, and records the change in the edit history — all in one write.
7. System shows the updated Transaction.

### Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-19 | Items and Adjustments of a saved income or expense Transaction can be added, changed, reordered and removed. |
| AC-20 | ⚠️ An edit whose computed total does not match the amount after the edit is rejected; nothing changes, including the Wallet balance. |
| AC-21 | ⚠️ When the amount changes in the same edit, the Wallet balance moves once by the difference, by the existing update rule (no balance floor). |
| AC-22 | ⚠️ Changing only the amount of a Transaction that has Items is rejected unless the Items and Adjustments still match the new amount. |
| AC-23 | Removing every Item turns the Transaction into a plain Transaction and removes its Adjustments; amount and balance are unchanged. |
| AC-24 | The edit history shows that the Items changed, with the Item count and Items total before and after.<br>Removed lines remain visible in that history. |
| AC-25 | Saving the same edit twice leaves the same end state; it never duplicates Items. |
| AC-26 | Editing Items is unavailable while offline, with the existing offline explanation. |
| AC-27 | A Transaction still in the offline queue has its Items edited in the queue, like its other fields. |
| AC-29 | ⚠️ When the Transaction changed after the User opened it, saving shows a warning instead of saving.<br>"Load latest" discards the User's edit and shows the current version; "Save anyway" saves the User's edit over it, still under every other rule (BR-07). |

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-TXI-23 | Transaction S-TXI-02 (Items 100,000 đ + tax 8,000 đ = 108,000 đ) | User fixes an Item from 30,000 đ to 35,000 đ and changes the amount to 113,000 đ | `200`; Items replaced; balance moves by 5,000 đ once | AC-21 |
| S-TXI-24 | ⚠️ Same | User fixes the Item to 35,000 đ but leaves the amount at 108,000 đ | Save blocked with a 5,000 đ gap; if sent, `422 ITEMS_TOTAL_MISMATCH`; nothing changes | AC-20 |
| S-TXI-25 | ⚠️ Same | An amount-only edit to 120,000 đ is sent | `422 ITEMS_TOTAL_MISMATCH`; nothing changes | AC-22 |
| S-TXI-26 | Plain Transaction of 50,000 đ | User adds Items totaling 50,000 đ | `200`; Items attached; balance unchanged | AC-19 |
| S-TXI-27 | Transaction with Items | User removes every Item | `200`; plain Transaction; Adjustments removed; amount and balance unchanged | AC-23 |
| S-TXI-28 | Edit of S-TXI-23 | Same edit sent again | `200`; same Items; no further balance change | AC-25 |
| S-TXI-29 | Another User's Transaction | Edit with Items is sent | `403 TRANSACTION_ACCESS_DENIED` | ⚠️ BR-13 |
| S-TXI-30 | Transfer | Edit with Items is sent | `422 ITEMS_NOT_ALLOWED` | BR-02 |
| S-TXI-31 | Transaction S-TXI-23 after the edit | User opens the edit history | Entry shows Items changed: 2 Items 100,000 đ → 2 Items 105,000 đ; the old line is visible | AC-24 |
| S-TXI-32 | Device offline | User taps the Items entry on a saved Transaction | Existing offline explanation; no editor opened | AC-26 |
| S-TXI-35 | ⚠️ User opens a Transaction on phone A; it is edited and saved on phone B | User saves an Items edit on phone A | `409 TRANSACTION_CHANGED`; nothing changes; warning with "Load latest" and "Save anyway" | AC-29 |
| S-TXI-36 | Warning from S-TXI-35 | User picks "Load latest" | The current version is shown; phone A's edit is discarded | AC-29 |
| S-TXI-37 | Warning from S-TXI-35 | User picks "Save anyway" | `200`; phone A's edit is saved; history keeps both versions | AC-29 |

### Edge Cases
- **EC-11** ⚠️ Two devices edit the Items of the same Transaction: the second save is warned (BR-16, S-TXI-35). If the User saves anyway, their whole list replaces the other one; the history keeps both versions. No merge.
- **EC-12** The Category of a Transaction with Items is changed: the Items move with it (BR-01, Resolved design decision 1).
- **EC-13** The Transaction is deleted while the editor is open: saving fails with the existing not-found error.
- **EC-14** Editing other fields (note, date, Category) of a Transaction with Items never touches its Items.

### Client UI States (`mobile/`)

Same editor states as US-01 (matched, gap, limit reached, saving, error), plus:

| State | Trigger | Expected UI |
|---|---|---|
| Offline | Items entry tapped while offline | Existing offline explanation; editor not opened |
| Rejected | `422 ITEMS_TOTAL_MISMATCH` from the server | Editor stays open with the gap shown; nothing changed |
| Saved | `200` | Updated Items and amount shown; history gains an entry |

### Definition of Done
- [ ] S-TXI-23 to S-TXI-32 pass.
- [ ] Tests prove a rejected Item edit changes nothing, including the balance (S-TXI-24, S-TXI-25).
- [ ] The edit history shows Item changes (S-TXI-31).

---

## Idempotency

- **Create with Items** uses the existing idempotency key: a replay returns the original Transaction with its original Items and never writes a second set (S-TXI-12).
- **Edit** replaces the whole list, so repeating the same edit converges to the same state (S-TXI-28). There is no edit idempotency key (existing behavior).

## Timestamps

- Items carry no date of their own; they share the Transaction's date. Any time the System records for an Item or a change is stored in UTC and shown in local time, like the rest of the Transaction.

## Out of Scope

- **`frontend/` (Next.js web)** — frozen. Web shows Transactions without their Items. An edit that does not mention Items leaves them unchanged, so a web edit never removes them.
- A Category per Item, or splitting one payment across several Categories.
- Fractional quantities and structured units.
- Importing Items from a spreadsheet.
- Searching or filtering by Item name; per-Item price history or analytics.
- Items from a receipt image — covered by Feature-12 US-05 (amended, BR-15).
- Items on transfers.

## Open Questions

1. ~~Export~~ — resolved 2026-10-11: Items are exported on a second sheet (BR-15).
2. ~~Concurrent edits~~ — resolved 2026-10-11: warn and let the User choose (BR-16).
3. ~~Line amount vs quantity × unit price~~ — resolved 2026-10-11: accepted without explanation (BR-05).
