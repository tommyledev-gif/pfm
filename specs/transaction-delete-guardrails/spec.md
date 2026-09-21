# Feature Spec: Transaction Delete Guardrails & Persistent History (extends F-06, Feature-12, Transaction Audit Log)

> Source: user request (this session), items 4, 8, 9 and the route-rename half of item 4.
> Status: New — no code exists for the park-and-confirm gesture, the chat/home tombstone states, or the per-transaction history sheet. The server side it leans on (`DELETE /transactions/{id}` soft delete, `GET /transactions/audit-logs`) already exists and is **not changed by this spec**.
> Scope: **`mobile/` only.** `frontend/` (web) has no swipe gestures and no AI-chat thread of its own to tombstone; nothing in this spec applies to it.
> Related: [F-06 Transaction Management](../transaction-management/spec.md) (owns the delete endpoint and the soft-delete rule) · [Transaction Audit Log](../transaction-audit-log/spec.md) (owns the audit table and its list endpoint) · [AI Chat Assistant](../ai-chat-assistant/spec.md) (owns the chat thread and the transaction proposal card)

---

## Context

Two surfaces in the mobile app currently let a swipe gesture **commit an irreversible action the instant the finger lifts**, with no confirmation:

- **AI Chat** — an assistant bubble carrying a transaction proposal can be swiped toward its vacated edge to open the editor. There is no delete affordance at all, so a transaction the assistant created and the user confirmed can only be removed by leaving chat and finding it in the Transactions list.
- **Home → "Chờ xác nhận"** — a pending proposal row can be dragged either way; releasing at the drag cap fires immediately. Dragging one way opens the editor; dragging the other **deletes the message outright, from a local store, with no dialog and no record anywhere**.

Both problems share one root cause: the gesture treats "reached the cap" as "decided". A drag is a coarse gesture — a thumb travelling ~20% of the screen width while scrolling a list is easy to produce by accident — and the result is that a destructive action is one accidental flick away.

A second, larger problem sits behind the Home case. Discarding a pending proposal today **removes the message from the chat thread entirely**. The thread is the user's record of what they told the assistant and what it proposed back; silently deleting entries from it means a user who asks "wait, what happened to that coffee transaction I logged?" has nothing to look at. The same is true in reverse for a *confirmed* proposal: deleting the real Transaction would leave a chat card that still claims the transaction exists.

This spec therefore does three things, which only make sense together:

1. **Makes the destructive gesture a two-stage decision** — swipe parks the row open and reveals a full-size button; the button opens a confirmation; only the confirmation deletes.
2. **Never destroys a chat message.** A deleted or discarded proposal stays in the thread as a *tombstone* — visibly marked as removed, tappable, and carrying its own history.
3. **Guarantees the audit log is the single durable record** of every Transaction that was actually created and later deleted, and makes it reachable from the tombstone itself.

**Resolved design decisions:**

1. **The soft-delete itself is unchanged and is entirely the backend's existing behaviour.** This spec adds no new endpoint, no new table, no new audit action. `DELETE /transactions/{id}` already sets `deleted_at` and already writes one `action='delete'` audit entry inside the same DB transaction (Transaction Audit Log US-01, S-TAL-04). ⚠️ Nothing on mobile may ever hard-delete a financial record, and no client-side "remove from list" is ever a substitute for calling the endpoint.
2. **A chat message is never removed from the thread.** Discarding or deleting flips it to a tombstone state; it keeps its id, its position, and its edit history. This replaces the current behaviour, which deletes the entry from the thread store outright. ⚠️ **Data-loss marker** — the entry being deleted today is the only client-side record of an unconfirmed proposal, and once gone it cannot be recovered from the server either (an unconfirmed proposal was never written there).
3. **A tombstone distinguishes "deleted" from "discarded", because they are not the same event.**
   - **Deleted** — a real Transaction existed and was soft-deleted. The server holds the truth; the audit log has an entry.
   - **Discarded** — the proposal was never confirmed, so no Transaction ever existed and there is nothing for the server to record. ⚠️ **Explicit gap:** a discarded proposal produces **no audit-log entry**, because the audit log records changes to Transactions and no Transaction was ever created. The tombstone in the thread is the only record of it, and it says so in its own wording rather than pretending otherwise. See Open Questions #1.
4. **The per-transaction history sheet reads the server, not the local thread.** A deleted transaction's history comes from `GET /transactions/audit-logs?transaction_id={id}` — the endpoint already supports exactly this filter (Transaction Audit Log US-02, S-TAL-10). The chat message's own local `editHistory` records only edits made *through the chat card*; a transaction edited from the Transactions screen has changes the thread never saw. Reading the server is the only way the sheet is complete.
5. **The park-and-confirm pattern applies to the destructive action only.** A non-destructive action that merely navigates or opens an editor still fires on release, because a confirmation dialog for it would ask the user to approve something with no consequence to weigh. The *parking* half applies to both directions; the *dialog* half applies only where something is destroyed. See Open Questions #2.
6. **The audit-log route is renamed to the plural form the rest of the app uses.** Every other list route and its backing resource are plural (`wallets`, `categories`, `transactions`, `users`, `notifications`), as is the endpoint this screen calls (`/transactions/audit-logs`); this one screen is the lone singular. See Open Questions #3.

Actors:
- **User** — any `active` user, acting on their own transactions only. No admin path, no cross-user visibility — same as every other F-06 surface.

---

## Preconditions (feature-level)

- User is authenticated and inside the authenticated route group.
- The AI Chat thread is available (restored from local storage or re-synced from the server).
- `DELETE /transactions/{id}` and `GET /transactions/audit-logs` exist and behave as their own specs define. **No backend change is in scope here.**

### Domain Concepts

| Concept | Meaning |
|---|---|
| **Proposal** | An assistant message carrying a transaction the user has not yet acted on |
| **Confirmed proposal** | A proposal the user accepted, which caused a real Transaction to be created; the message holds that Transaction's identifier |
| **Tombstone** | A message that stood for a proposal which has since been deleted or discarded — still present in the thread, visibly marked, and no longer offering Confirm or Edit |
| **Armed** | A swipe that has reached its travel cap, so releasing it will act |
| **Parked** | A row held open at its travel cap after release, showing a full-size action button instead of acting |

⚠️ **Money rule**: every amount shown on a tombstone, in the confirmation dialog, or in the history sheet is the same integer-cents value the API returns, formatted for display only. No rounding, no conversion, no float at any point.

⚠️ **Time rule**: every timestamp rendered by this feature (deletion time, history entry time) is stored UTC and displayed in the device's local timezone — same as every other date in the app.

---

## US-01: Reveal a delete action on a transaction proposal in AI Chat

**As a** User,
**I want** to swipe a transaction card in the chat toward its opposite edge to reveal a delete button,
**so that** I can remove a transaction I logged by mistake without leaving the conversation I logged it in.

**API:** None for the gesture itself. Confirming calls `DELETE /transactions/{id}` (US-03).

### Preconditions
- The message is an assistant message carrying a transaction proposal.
- The proposal is not already a tombstone.

### Main Flow
1. User drags a transaction card toward the edge opposite the one it sits on.
2. System slides the card with the finger, capped at a fixed fraction of the screen width, and fades a trash indicator in as the drag approaches that cap — the same progressive reveal the existing edit gesture uses on the other side.
3. User releases at the cap.
4. System **parks** the card open and replaces the indicator with a full-size, clearly labelled delete button. Nothing is deleted.
5. User taps the delete button.
6. System opens a confirmation dialog naming what will be removed (US-03).

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-TDG-01 | An assistant transaction card in the thread | User drags it toward the opposite edge, short of the cap, and releases | Card springs back to rest; no button revealed; nothing deleted | Below-cap release always cancels |
| S-TDG-02 | Same card | User drags to the cap and releases | Card stays parked open; full-size delete button visible; **no dialog yet, nothing deleted** | ⚠️ The core change — release is not a decision |
| S-TDG-03 | Card parked open | User taps the revealed delete button | Confirmation dialog opens (US-03) | |
| S-TDG-04 | Card parked open | User taps anywhere else, scrolls the thread, or drags the card back | Card springs closed; button dismissed; nothing deleted | Parking is escapable without a decision |
| S-TDG-05 | Same card | User drags toward the edge the card already sits on | Nothing happens — the gesture is not claimed | Direction is fixed per message, unchanged from today |
| S-TDG-06 | An assistant message with **no** transaction (plain prose, a clarifying question, a budget-setup card) | User drags it either way | No delete affordance; the existing edit lock still applies | Nothing to delete |
| S-TDG-07 | A user's own message | User drags it toward its opposite edge | Existing edit gesture only; no delete affordance | Deleting a user's own words is out of scope |
| S-TDG-08 | A tombstone message | User drags it either way | No delete and no edit affordance | Already removed |
| S-TDG-09 | Card parked open, and a new assistant reply arrives | — | Parked card closes; no action is taken | New content must never land under a parked destructive button |

### Edge Cases
1. **Only one row may be parked at a time in the thread** — parking a second closes the first, so there is never more than one armed destructive button on screen.
2. **A parked card that scrolls out of view closes.** Returning to it must require the gesture again rather than finding a delete button already waiting.
3. **The edit gesture keeps its existing behaviour on the other edge** — reaching the cap and releasing opens the editor directly. Editing destroys nothing, so a parked intermediate step would add a tap with nothing to decide (Context #5).
4. **A swipe must still never be confused with a list scroll.** The gesture only claims the touch once horizontal travel clearly exceeds vertical travel — unchanged from the current behaviour.

### Definition of Done
- Dragging an assistant transaction card toward its opposite edge reveals a trash indicator that fades in progressively and stops at a fixed travel cap. The delete side's cap is wider than the edit side's, because the parked state has to show a full-size button rather than a small indicator — the two gestures do not have to travel the same distance.
- Releasing at the cap parks the card and shows a delete button; it does **not** delete, and does **not** open a dialog.
- Tapping the revealed button opens the confirmation dialog; every other interaction closes the parked state without acting.
- Plain assistant prose, user messages and tombstones expose no delete affordance.

### Idempotency
N/A — the gesture writes nothing.

---

## US-02: Confirm before a swipe acts on the Home pending-confirmations list

**As a** User,
**I want** a swipe on a pending item to reveal a button rather than act the moment I let go,
**so that** an accidental flick while scrolling my home screen cannot throw away something I meant to keep.

**API:** None for the gesture. Confirming a discard is local (US-04); confirming a delete calls `DELETE /transactions/{id}` (US-03).

### Preconditions
- At least one pending proposal is listed on Home.

### Main Flow
1. User drags a pending row either way.
2. System slides the row with the finger and fades the matching indicator in — edit on one edge, delete on the other, exactly as today.
3. User releases at the cap.
4. System parks the row open and shows the matching full-size button. **Neither action fires.**
5. User taps the button: delete opens a confirmation dialog; edit navigates straight to that message in the chat, with nothing to confirm.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-TDG-10 | A pending row | User drags toward the delete edge to the cap and releases | Row parks open showing a delete button; **nothing is discarded** | ⚠️ Replaces today's fire-on-release, which discarded the item outright |
| S-TDG-11 | Row parked with the delete button shown | User taps it | Confirmation dialog opens (US-03) | |
| S-TDG-12 | A pending row | User drags toward the edit edge to the cap and releases | Row parks open showing an edit button; no navigation yet | Parking applies to both directions (Context #5) |
| S-TDG-13 | Row parked with the edit button shown | User taps it | Chat opens at that message with its editor already open; no dialog | Nothing is destroyed, so nothing is confirmed |
| S-TDG-14 | Any row parked | User taps elsewhere, scrolls, pulls to refresh, or drags the row back | Row closes; no action taken | |
| S-TDG-15 | A row parked, and the pending list changes underneath it (an item is confirmed elsewhere, or a new proposal arrives) | — | All parked rows close | The button must never be left pointing at a row that has moved |
| S-TDG-16 | Two pending rows | User parks one, then swipes the other to its cap | The first closes; only the second stays parked | One armed destructive control at a time |
| S-TDG-17 | Any pending row | User taps the row body (not a revealed button) | Chat opens at that message, read-only — unchanged from today | Tapping was never destructive |

### Edge Cases
1. **"Bỏ qua" (dismiss-all) is not a delete and gains no confirmation.** It hides the banner for the session only and changes no stored data — the existing behaviour is correct and stays as it is.
2. **A row whose underlying proposal is confirmed by another surface while parked closes immediately** — the delete it was offering no longer describes the same thing.
3. **Pull-to-refresh closes every parked row** before refetching, so a refreshed list never renders under a stale armed control.

### Definition of Done
- No swipe release on Home performs a delete, a discard, or a navigation.
- Both directions park; the delete button leads to a confirmation, the edit button leads straight to the editor.
- Parked rows close on scroll, refresh, list change, outside tap, or a second row being parked.

### Idempotency
N/A — the gesture writes nothing.

---

## US-03: Confirm and soft-delete a transaction that was actually created

**As a** User,
**I want** a dialog that tells me exactly what is about to be removed, and removes it only when I say yes,
**so that** I never lose a financial record to a gesture.

**API:** `DELETE /transactions/{id}` (existing, F-06 US-05 — unchanged)

### Preconditions
- The proposal being acted on is **confirmed**: a real Transaction exists and the message holds its identifier.

### Main Flow
1. User taps the revealed delete button (US-01 or US-02).
2. System opens a confirmation dialog stating the transaction's amount, category and date, and saying plainly that it will be removed from the transaction list but kept in the history log.
3. User confirms.
4. System calls the delete endpoint while showing a busy state on the confirm control.
5. On success the system:
   - removes the transaction from every list and recomputes every figure derived from it — wallet balances, budget progress, report totals, the home snapshot;
   - flips the originating chat message to a **deleted tombstone**, keeping it in the thread;
   - leaves the audit log to the backend, which has already recorded the deletion.
6. System closes the dialog and the parked row.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-TDG-18 | A confirmed proposal for an expense | User taps delete and confirms | Transaction is soft-deleted; it disappears from the transaction list; the wallet balance, the affected budget's progress and the period totals all update | Happy path — no hard delete anywhere |
| S-TDG-19 | Same | Deletion succeeds | The chat message remains in the thread as a deleted tombstone, in its original position | ⚠️ Context #2 — never removed |
| S-TDG-20 | Same | Deletion succeeds | Exactly one delete entry appears in the history log, carrying the transaction's values as they stood and the time it was removed | Written by the backend; the client asserts it is readable, not that it writes it |
| S-TDG-21 | Confirmation dialog open | User cancels, taps the backdrop, or presses the hardware back button | Dialog closes; nothing is deleted; the row closes | Three equivalent ways out |
| S-TDG-22 | Confirmation dialog open, request in flight | User taps confirm again, or taps the backdrop | The second confirm is ignored; no second delete request is sent | Double-fire guard |
| S-TDG-23 | The device is offline | User confirms | **Validation-class failure surfaced to the user** — an error message saying the deletion did not happen; the transaction stays; the message stays a live card, **not** a tombstone | ⚠️ The tombstone must never appear on a delete that did not commit |
| S-TDG-24 | The transaction was already deleted from another surface (Transactions screen) and the thread is stale | User confirms | Treated as success: the message becomes a tombstone and lists are refreshed | Deleting something already gone is the outcome the user asked for |
| S-TDG-25 | The transaction belongs to another user, or its identifier is unknown to the server | User confirms | Error message; nothing changes locally | Server-side ownership remains the authorization boundary |
| S-TDG-26 | A server-side failure (5xx) | User confirms | Generic failure message; transaction and message both unchanged | ⚠️ System error, distinct from S-TDG-23's network case only in wording |
| S-TDG-27 | A confirmed proposal for an **income** transaction whose deletion would take the wallet below zero | User confirms | Deletion succeeds and the balance is allowed to go negative | Matches F-06's existing delete rule — the balance floor is a create-time rule only |

### Edge Cases
1. **The confirmation dialog names the transaction.** A dialog that says only "are you sure?" cannot be answered by a user who has two similar proposals in view; the amount, category and date are what make the question answerable.
2. **The dialog's copy states that the record is kept in the history log.** Users hesitate over deletes precisely because they fear losing the record; saying where it goes is what makes the action safe to take.
3. **Every derived figure refreshes together.** A wallet balance that updates while the budget bar above it does not is worse than neither updating — the user cannot tell which one is wrong.
4. **A failed delete leaves the message fully interactive**, including its Confirm/Edit controls. A card that is neither a live proposal nor a tombstone is unrecoverable state.
5. **A transaction that was edited after confirmation is deleted by its current identifier**, not by the values the chat card happens to be showing.

### Definition of Done
- Confirming deletes through the existing endpoint; cancelling in any of the three ways deletes nothing.
- Success flips the message to a deleted tombstone **and** refreshes transactions, wallets, budgets and reports together.
- Every failure class leaves both the transaction and the message exactly as they were, and says so.
- A deletion is visible in the history log with its time.

### Idempotency
Deleting an already-deleted transaction is a no-op that reports success (S-TDG-24). ⚠️ The in-flight guard (S-TDG-22) is a separate requirement: the client must not issue a second request for the same confirmation.

---

## US-04: Discard an unconfirmed proposal without destroying the thread

**As a** User,
**I want** to throw away a proposal I never accepted and still see that I threw it away,
**so that** my conversation stays a truthful record of what I asked for.

**API:** None — nothing was ever written to the server.

### Preconditions
- The proposal is **not** confirmed; no Transaction exists for it.

### Main Flow
1. User taps the revealed delete button on an unconfirmed proposal (US-01 or US-02).
2. System opens a confirmation dialog whose wording says this proposal was never saved and will simply be dropped.
3. User confirms.
4. System flips the message to a **discarded tombstone** — kept in the thread, its Confirm and Edit controls gone.
5. System removes it from Home's pending list, because it is no longer awaiting anything.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-TDG-28 | An unconfirmed proposal | User confirms the discard | Message becomes a discarded tombstone in place; it leaves the pending list; **no delete request is sent** | There is nothing on the server to delete |
| S-TDG-29 | Same | After discarding | **No history-log entry exists for it** | ⚠️ Context #3 — the audit log records Transactions, and none was created |
| S-TDG-30 | Same | User reads the tombstone | Its wording says the proposal was never saved — distinct from a deleted transaction's wording | The two states must not be confusable |
| S-TDG-31 | A discarded tombstone | User taps it | A history sheet opens showing only what the thread itself knows: the proposal as it was created and each edit made to it in chat | US-05, local-only branch |
| S-TDG-32 | A discarded tombstone | App is closed and reopened, or the thread is re-synced | The tombstone is still there, still discarded | ⚠️ Discard state must survive a restart, or the thread silently heals and the record is lost |
| S-TDG-33 | A proposal that was superseded by the user editing the message above it | User discards it | Becomes a discarded tombstone; the superseded marking is unaffected | Two independent reasons a card stops being actionable |

### Edge Cases
1. **A discard is not reversible in this feature.** The tombstone records that it happened; it does not offer to bring the proposal back. Re-creating the transaction means telling the assistant again or entering it by hand.
2. **The thread's stored form must carry the tombstone state**, not just its in-memory form — otherwise S-TDG-32 fails and the user's record quietly repairs itself.
3. **Discarding never touches wallets, budgets or reports**, because nothing was ever counted toward them.

### Definition of Done
- Discarding keeps the message in the thread, marked as discarded, and removes it from the pending list.
- The discarded state survives a restart and a thread re-sync.
- No request is sent, and no history-log entry is produced or implied.
- Deleted and discarded tombstones are worded differently and are not confusable.

### Idempotency
N/A — local state change with no write.

---

## US-05: Open a removed transaction's history from the chat thread

**As a** User,
**I want** to tap a removed card and see what that transaction was and everything that happened to it,
**so that** a removed entry still answers the question I would have asked the live one.

**API:** `GET /transactions/audit-logs?transaction_id={id}` (existing, Transaction Audit Log US-02 — unchanged)

### Preconditions
- The message is a tombstone.

### Main Flow
1. User taps a tombstone in the chat thread.
2. System opens a bottom sheet titled for that transaction.
3. For a **deleted** tombstone the system requests that transaction's history entries and renders them newest first — what it was created as, each change with its before and after values, and the removal with its time.
4. For a **discarded** tombstone the system renders only the local record: the proposal as first produced, plus each edit made to it in chat.
5. User dismisses the sheet.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-TDG-34 | A deleted tombstone whose transaction was created, edited twice, then deleted | User taps it | Sheet lists four entries newest first: the removal with its time, both edits with their before/after values, and the creation | Full server-side trail |
| S-TDG-35 | A deleted tombstone whose transaction was edited from the Transactions screen, never through chat | User taps it | That edit appears in the sheet | ⚠️ Context #4 — why this reads the server and not the message's own edit history |
| S-TDG-36 | A deleted tombstone | Sheet is opening, request in flight | A loading state is shown — never an empty list and never a blank sheet | Loading state |
| S-TDG-37 | A deleted tombstone | The history request fails | An error message inside the sheet with a way to retry; the sheet stays open | Error state |
| S-TDG-38 | A deleted tombstone whose category or wallet has since been renamed or removed | User taps it | Entries still render legible names, not bare identifiers, and the sheet still opens | Matches the history log screen's existing rule |
| S-TDG-39 | A discarded tombstone | User taps it | Sheet shows only the local proposal trail, and says plainly that this proposal was never saved | Empty-ish state, explained rather than blank |
| S-TDG-40 | A discarded tombstone that was never edited | User taps it | Sheet shows a single entry: the proposal as produced | Minimum case, still not an empty sheet |
| S-TDG-41 | Any tombstone | User dismisses via the backdrop or the hardware back button | Sheet closes; thread position and scroll are unchanged | |

### Edge Cases
1. **A long history scrolls inside the sheet** and never pushes its dismiss affordance off screen.
2. **The sheet is read-only.** No restore, no undo, no re-create — consistent with the history log screen's own read-only rule.
3. **Every amount in the sheet is shown exactly as recorded**, including amounts that were later changed; the sheet is a record, not a recalculation.

### Definition of Done
- Tapping a deleted tombstone opens a sheet fed by that transaction's history entries, newest first, with the removal time visible.
- Tapping a discarded tombstone opens a sheet fed by the local proposal trail, labelled as never saved.
- Loading, error and minimum-content states are all explicitly handled; no state renders as a blank sheet.
- The sheet is read-only.

### Idempotency
N/A — read only.

---

## US-06: Read every removal on the history log screen

**As a** User,
**I want** the history log to state when each transaction was removed,
**so that** I can answer "did I delete this, and when" without opening the chat.

**API:** `GET /transactions/audit-logs` (existing — unchanged)

### Preconditions
- User opens the history log from Settings.

### Main Flow
1. User opens the history log.
2. System lists entries grouped by day, newest day first.
3. Each removal entry is visibly marked as a removal, states the time it happened, and summarises what was removed — amount, category and wallet.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-TDG-42 | A transaction was deleted through the chat tombstone flow (US-03) | User opens the history log | A removal entry appears under the day it happened, marked as a removal, with its time and what was removed | The chat path and the Transactions-screen path produce identical entries |
| S-TDG-43 | A proposal was discarded (US-04) | User opens the history log | **No entry for it** | ⚠️ Context #3 — stated here so its absence is not read as a bug |
| S-TDG-44 | The user has no history at all | User opens the history log | An explanatory empty state, not a blank screen or an error | Empty state |
| S-TDG-45 | The history is still loading | — | A loading state | Loading state |
| S-TDG-46 | The history has more entries than one page | User scrolls to the end | The next page loads and appends, with its own loading indicator | Paging behaviour unchanged |
| S-TDG-47 | The history request fails | — | An error state with a way to retry | Error state |
| S-TDG-48 | Any entry | User attempts to act on it | Nothing is actionable — no restore, no undo, no delete | Read-only, unchanged |

### Edge Cases
1. **A removal entry whose category or wallet has since been removed still renders names**, not identifiers.
2. **Times are shown in the device's local timezone** while stored in UTC.
3. **Ordering is strictly newest first**, including several removals within the same minute.

### Definition of Done
- Removals are visually distinct from creations and edits, and state their time.
- Empty, loading, error and paging states are all handled.
- The screen remains read-only.

### Idempotency
N/A — read only.

---

## US-07: Rename the history log route to the app's plural convention

**As a** developer,
**I want** the history log's route, screen and feature folder named the way every comparable list in this app is named,
**so that** a reader can predict the path from the resource without checking.

**API:** None — naming only.

### Main Flow
1. The route file, its exported screen, and the feature folder move from the singular form to the plural form.
2. The Settings entry that links to it is updated to the new path.
3. No visible label changes: the row and the screen title stay exactly as the user reads them today.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-TDG-49 | User is on Settings | User taps the history log row | The history log opens | Behaviour identical; only the path changed |
| S-TDG-50 | The rename is complete | A search for the old singular path is run over the app | No references remain anywhere | ⚠️ A missed reference is a dead link the user finds, not the developer |
| S-TDG-51 | The rename is complete | User reads Settings and the screen header | The visible Vietnamese labels are unchanged | Renaming is internal |

### Edge Cases
1. **Every navigation target for this screen must move together** — the route file, the link from Settings, and any deep link. A rename that leaves one behind is worse than no rename.
2. **The feature folder and its screen export move with the route**, so the three names agree.
3. **No visible copy changes**, so this carries no translation work.

### Definition of Done
- The route, the screen export and the feature folder all use the plural form.
- Navigating from Settings works; no reference to the old path remains.
- No user-visible text changed.

### Idempotency
N/A.

---

## Out of Scope

- **Any backend change.** No new endpoint, no new table, no new audit action, no change to how the delete endpoint or the audit list endpoint behaves.
- **Restore / undo / undelete.** The history log is a record, not a time machine — the audit-log spec's own boundary, and this feature does not cross it.
- **Deleting a user's own chat message**, or any assistant message that carries no transaction.
- **A swipe-to-delete gesture on the Transactions screen, the Insights lists, or anywhere other than the two surfaces named here.** Those already delete through their edit forms.
- **Bulk delete** of any kind.
- **Web (`frontend/`).** No swipe gestures and no chat thread to tombstone.
- **Syncing tombstone state across devices beyond what thread sync already does.**
- **Recording discarded proposals server-side** — see Open Questions #1.
- **The visual polish items in [Mobile Visual Refinements](../mobile-visual-refinements/spec.md)**, including the swipe indicator's own colours.

---

## Open Questions

1. **Should a discarded (never-confirmed) proposal be recorded anywhere durable?** The audit log records Transactions, and a discarded proposal never became one, so today it leaves no trace beyond the local tombstone — which is lost if the device's stored thread is cleared. Recording it would mean either a new server-side concept ("proposals") or widening the audit log beyond Transactions. **Assumed for this spec: no durable record; the local tombstone is it, and the tombstone's own wording says the proposal was never saved.** ⚠️ This is the one gap in item 9's "must always capture" requirement, and it is a structural one, not an oversight.
2. **Should the non-destructive edit action also require a confirmation dialog after parking?** The request asked that neither direction act immediately on release. **Assumed: both directions park, but only the destructive one opens a dialog** — a dialog confirming a navigation that destroys nothing adds a tap with nothing to weigh. If a dialog is wanted on both, S-TDG-13 changes and nothing else does.
3. **Is the plural form the intended "conventional naming"?** The request asked for a rename without naming a target. **Assumed: the plural form, matching every other list route in the app and the resource path the screen already calls.** An alternative reading is a user-facing rename toward "transaction history" wording, which would also change visible copy and is deliberately not assumed here.
4. **How long may a row stay parked before closing on its own?** **Assumed: no timeout** — it closes on scroll, outside tap, list change or refresh, all of which happen quickly in practice. A timed auto-close would need a duration nobody has specified.
