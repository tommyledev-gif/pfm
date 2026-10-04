# Feature Spec: Mobile Offline Support (extends F-02 Security, F-06 Transaction, NFR-06 Reliability)

> Source: product-owner-approved research [research-offline.md](../mobile-ux-batch-2026-10/research-offline.md) — recommended design **Option C** (keep last-known data on the device for reading + an explicit, per-User queue for creating Transactions only), phases 0 (remaining items), 1, 2 and the small backend fix.
> Status: Updated 2026-10-04 with the product owner's final decisions. Three items are **already fixed in the working tree (uncommitted, 2026-10-04)** and are *not* re-specified as new work: (a) a failed session renewal ends the session only when the server refuses the credential — offline / timeout / server failure keeps the session and retries after a short delay; (b) the local data cache is cleared only when a *different* User signs in, not on every routine session renewal; (c) the new-Transaction form defaults to the User's local today, not the UTC date (it used to default to yesterday early in the morning). US-01 covers only what remains on top of (a) and (b); (c) is relied on by US-04.
> Scope: **`mobile/` + one backend fix (create replay and import preview).** `frontend/` (web) is frozen and out of scope.
> Depends on / coordinates with: `mobile-account-switch` (specced in parallel, [research](../mobile-ux-batch-2026-10/research-account-switch.md)) — several Users may live on one device; every piece of local data this spec introduces is **owned by one User** from day one. That spec also adds "sign out of all devices" (remote revocation); on this device it surfaces as a refused session renewal and is handled exactly like any other refused credential (US-01 S-OFF-05, US-07 S-OFF-59).
> Related: [mobile-session-refresh](../mobile-session-refresh/spec.md) (session renewal this extends) · [transaction-management](../transaction-management/spec.md) (create rules, balance floor) · [ai-chat-assistant](../ai-chat-assistant/spec.md) (origin of the create idempotency key)
> Feature code: `OFF` · Traces to: SRS NFR-06 Reliability ("data should remain consistent and accurate even when the application is … temporarily unavailable"), FR-02 Transaction Management, Feature-02 System Security. SRS §6 **Feature-14 Offline Use** (US-01..US-05, added 2026-10-04).

---

## Context

A personal finance app is used where the network is worst: at a till, in a basement car park, on a bus. Today the mobile app has **no offline behaviour at all**: it does not know when the device is offline, every screen falls into a spinner or an error, nothing is kept between app launches, and a Transaction the User tries to save without a connection is simply lost with a generic error. Until 2026-10-04 it also signed the User out whenever a session renewal happened to run without a network.

The must-haves, in priority order:

| # | Capability |
|---|---|
| O1 | Stay signed in while the network is gone |
| O2 | Read the last-known Wallets, balances, Categories, Budgets, report summary and recent Transactions |
| O3 | Record an income / expense / transfer offline; it is sent later, is never lost and is never booked twice |
| O4 | Always know the state: offline indicator, how many Transactions are waiting, which ones failed and why |

**Resolved design decisions:**

1. **Reads come from a per-User copy of recently fetched data kept on the device**; nothing is computed locally that the server owns (balances, report totals, budget usage). The device copy is a cache, never a second source of truth.
2. **Only creating a Transaction works offline.** Editing or deleting a Transaction, any Wallet / Category / Budget change, AI Chat, AI proposal approval, import/export and admin actions stay online-only and are visibly unavailable offline. Reason: create is already idempotent end-to-end; edit/delete have no conflict protection.
3. **A Transaction recorded offline goes into a visible, User-controllable queue**, not a hidden background retry. The User can see, retry, edit and discard what is waiting, and a rejection by the server is kept and shown — never silently dropped.
4. **Each queued Transaction carries one idempotency key from the moment it is recorded until it is accepted.** Every send of it — first try, automatic retry, manual retry, retry after an edit — uses that same key, so the server books it at most once. ⚠️
5. **The server stays the authority on balances.** The app does not show a projected balance that includes queued Transactions; it shows the last-known balance plus a hint that N queued Transactions are not counted yet.
6. **Everything kept on the device belongs to exactly one User** and is never shown to, or sent with the credentials of, another User on the same device. ⚠️
7. **Backend:** the same idempotency key always resolves to the same original Transaction, even after that Transaction was deleted. A create replayed with such a key is answered as "already created", not as a server failure, and the Transaction import preview tells the User, with its own reason, that a row was imported before and has since been deleted (US-08). No new endpoint, no migration.
8. **Confirmed limits and policies (product owner, 2026-10-04):** saved data is kept for at most one week; the queue holds at most 200 Transactions per User; a Failed Transaction does not block later ones; a queue left behind by a User who never signs in again is **never deleted automatically** — it is removed only when that same User signs in and discards it, or when it syncs. ⚠️

Actors:
- **User** — any `active` user, `admin` or `member`, on the mobile app, acting on their own data only.
- **System** — the mobile app's background behaviour (renewal, sync) and the backend.

### Domain Concepts

| Concept | Meaning |
|---|---|
| **Offline** | The device reports no usable network connection. |
| **Server unreachable** | The device reports a connection, but a request gets no answer (timeout, no route, server down). Treated like offline for recording a Transaction; shown with its own message. |
| **Saved data** | The copy of recently fetched data kept on the device for one User, shown while offline. |
| **Queued Transaction** | A Transaction the User recorded that the server has not yet accepted. States: **Waiting** (not sent yet, or the last try got no answer), **Sending**, **Failed** (the server answered and refused it). |
| **Sync** | Sending Queued Transactions to the server, oldest first. |

⚠️ **Money rule:** a Queued Transaction's amount is the exact integer-cents (xu, `BIGINT` on the server) value the User entered, in the Wallet's own currency (VND or USD). It is stored, displayed and sent unchanged — no rounding, no conversion, no float. The app performs no balance arithmetic on queued amounts.
⚠️ **Time rule:** the Transaction date is the date the User picked in the form at recording time — never the sync time. The moment a Transaction was queued is stored in UTC and displayed in the device's local time zone, as is every "last updated" time this feature shows.
⚠️ **Soft delete rule:** nothing in this feature deletes a server record. Discarding a Queued Transaction removes a local, never-accepted entry only.

---

## Preconditions (feature-level)

- The User has signed in on this device at least once (offline sign-in is impossible — there is nothing to verify credentials against).
- The existing create endpoint `POST /api/v1/transactions` accepts an optional idempotency key and answers a repeated key with the original Transaction (200) instead of a new one (201) — existing behaviour.
- The three working-tree fixes (a)–(c) described in the header are in place.

---

## US-01: Stay signed in while offline

**As a** User,
**I want** to stay signed in when my phone loses its connection,
**so that** opening the app without a network never sends me back to the sign-in screen.

**API:** `POST /api/v1/auth/refresh` (existing, unchanged).

### Preconditions
- A session exists on the device.

### Main Flow
1. System needs to renew the session (scheduled renewal, app start with a due renewal, or a request answered "unauthenticated").
2. The renewal gets no answer (offline, timeout) or a server failure.
3. System keeps the session and the data on screen, and schedules another attempt (already implemented).
4. **New:** when the device comes back online, or the app returns to the foreground, and a renewal is due or the last one failed, System renews immediately instead of waiting for the scheduled attempt.
5. **New:** while the device is offline, the scheduled retry does not keep firing requests that cannot succeed; it waits for step 4.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-OFF-01 | Session renewal is due; device offline | User opens the app | App opens signed in, showing saved data; no "session expired" message | Already fixed — regression check |
| S-OFF-02 | Session signed in; renewal fails offline | Device reconnects | One renewal runs within seconds of reconnecting; screens refresh | New |
| S-OFF-03 | App in background longer than the session's short lifetime | User brings the app to the foreground while online | Renewal runs at once; no request is first refused for an expired session | New |
| S-OFF-04 | Device offline for a long time | Renewal retry time comes | No renewal request is attempted while offline | New — avoids pointless retries |
| S-OFF-05 | Server answers the renewal with "credential refused" (expired after 7 days, revoked, User disabled, or the User chose "sign out of all devices" elsewhere) | Device is online | Session ends, User sees the existing "session expired" message and the sign-in screen | Unchanged behaviour; ⚠️ Queued Transactions are kept (US-07 S-OFF-59) |
| S-OFF-06 | Reconnect and foreground happen at the same moment, plus a refused request | — | Exactly one renewal request is made | Reuses the existing single-in-flight rule |

### Edge Cases
- **EC-OFF-01** A renewal response lost on a flaky network leaves the device with a credential the server has already replaced; the next renewal is refused and the User must sign in again. Known, low-frequency; not fixed here (Out of Scope #6). Queued Transactions survive it.
- **EC-OFF-02** The device reports "connected" but the server is unreachable: the renewal fails like offline (session kept), and the reconnect trigger does not fire again until connectivity actually changes; the scheduled retry covers it.
- **EC-OFF-03** Sign-out while a renewal retry is pending cancels the retry (existing rule, must keep holding).

### Definition of Done
- AC-OFF-01: Opening the app offline with a due renewal keeps the User signed in (S-OFF-01).
- AC-OFF-02: Reconnecting, or returning to the foreground, triggers one immediate renewal when one is due or the last one failed (S-OFF-02, S-OFF-03, S-OFF-06).
- AC-OFF-03: No renewal request is sent while the device reports offline (S-OFF-04).
- AC-OFF-04: A refused credential, including one revoked by "sign out of all devices", still ends the session exactly as today
  and never removes the User's Queued Transactions (S-OFF-05).

### Idempotency
N/A for the User — the renewal is not idempotent by design (each successful renewal replaces the credential); the single-in-flight rule prevents parallel renewals.

---

## US-02: Know when the app is offline

**As a** User,
**I want** the app to tell me clearly that I am offline and what I can still do,
**so that** I can tell "no network" apart from "something is broken" and I am not left waiting for spinners.

**API:** None.

### Main Flow
1. Device loses its connection.
2. System shows a slim offline banner on every signed-in screen, with the time the saved data was last updated and, when any exist, the number of Queued Transactions.
3. System stops automatic data loading (no endless spinners, no error screens caused only by being offline).
4. Actions that need the server (Domain decision #2) are shown as unavailable, with a short "needs a connection" reason when tapped.
5. Device reconnects. System hides the banner and refreshes the visible data.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-OFF-07 | Signed in, online | Device goes offline | Offline banner appears on the current screen within a few seconds | |
| S-OFF-08 | Offline, banner shown | Device reconnects | Banner disappears; visible screens refresh without a pull | |
| S-OFF-09 | Offline | User pulls to refresh | Refresh ends at once with an "offline" message; nothing else changes | Not an endless spinner |
| S-OFF-10 | Online but server unreachable | Any request fails with no answer | User sees a "cannot reach the server" message, distinct from a server-side error message | Distinct network error message |
| S-OFF-11 | Offline | User taps Edit/Delete on a Transaction, any Wallet/Category/Budget save or delete, AI Chat send, approve an AI proposal, import/export, invite a User | Action does not run; User sees "needs a connection" | Online-only list (decision #2) |
| S-OFF-12 | Offline | User opens the new-Transaction form | Form is fully usable (US-04) | The one write that works offline |
| S-OFF-13 | Offline, 3 Queued Transactions | Banner is visible | Banner states 3 Transactions are waiting to sync | |
| S-OFF-14 | Signed out (sign-in screen), offline | User taps Sign in | Sign-in fails with the "no connection" message, not "wrong email or password" | |

### Edge Cases
- **EC-OFF-04** Connectivity flapping (on/off within seconds) must not make the banner flicker distractingly or start overlapping refresh storms; refreshes after reconnect follow the normal single-fetch-per-data rule.
- **EC-OFF-05** An online-only action already in progress when the device goes offline fails with the "no connection" message; no partial local change is made.
- **EC-OFF-06** A screen whose data was never saved on this device (e.g. a report period never opened) shows an "offline — no saved data for this view" state, not a skeleton forever and not an error.

### Definition of Done
- AC-OFF-05: The offline banner shows/hides with connectivity on every signed-in screen, including the saved-data time and the waiting count (S-OFF-07, S-OFF-08, S-OFF-13).
- AC-OFF-06: Pull-to-refresh offline ends immediately with an offline message (S-OFF-09).
- AC-OFF-07: A request that gets no answer shows a network-specific message everywhere the app shows request errors, including sign-in (S-OFF-10, S-OFF-14).
- AC-OFF-08: Every action in S-OFF-11 is unavailable offline with a "needs a connection" reason, and any online-only action that slips through fails fast with the network message, never hangs (S-OFF-11, EC-OFF-05).
- AC-OFF-09: A view with no saved data shows the offline empty state (EC-OFF-06).

### Idempotency
N/A — no writes.

---

## US-03: Read my last-known data offline

**As a** User,
**I want** to see my Wallets, balances, Categories, Budgets, report summary and recent Transactions when I open the app without a network,
**so that** I can still check how much money I have left.

**API:** None new. Reads are the existing list/summary endpoints; their latest successful answers are kept on the device.

### Preconditions
- The User has opened the relevant screens online at least once since signing in on this device.

### Main Flow
1. While online, System keeps a copy of the latest successful answers for: Wallets (with balances), Categories, Budgets, report summaries, and the first page of recent Transactions lists. Only these.
2. User opens the app (cold start) offline.
3. System shows the saved data immediately, marked by the offline banner with its last-updated time.
4. Device reconnects; System replaces the saved data with fresh data.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-OFF-15 | User used the app online, then closed it | User opens it offline | Home shows Wallets, balances, Budgets and recent Transactions from saved data; banner shows the last-updated time | Core O2 |
| S-OFF-16 | Saved data exists | User opens Transactions offline | The recent list (first page) is shown; scrolling to older pages shows the offline "no saved data" end state | Only the first page is kept |
| S-OFF-17 | User A signed in, data saved | A signs out; B signs in on the same device | B never sees A's saved data, not even for a moment | ⚠️ User isolation |
| S-OFF-18 | User A signs out | — | A's saved data is removed from the device | |
| S-OFF-19 | Saved data older than the maximum keep age | User opens the app offline | That data is not shown; the offline empty state is shown instead | Keep age confirmed (decision #8) |
| S-OFF-20 | App updated to a new version | User opens it | Saved data from the old version is discarded and reloaded online | Avoids reading an outdated data shape |
| S-OFF-21 | Online | User opens AI Chat / audit history / user admin / notifications | These are never kept as saved data | Sensitive or volatile — not on the allow-list |

### Edge Cases
- **EC-OFF-07** Saved data is stored unencrypted in the app's private storage, the same exposure the AI Chat thread has today. Accepted for v1 and stated here explicitly; it is removed on sign-out (Out of Scope #7).
- **EC-OFF-08** If writing saved data fails (storage full), the app keeps working online; offline it simply has less saved data. No error is shown.
- **EC-OFF-09** When `mobile-account-switch` ships, switching from A to B must keep A's saved data (owned by A) for when A returns, and must not let a write in progress for A land under B.
- **EC-OFF-10** Saved data is a display convenience: a balance shown from saved data can be out of date. The banner's last-updated time is the User's cue; no figure is ever presented as live while offline.

### Definition of Done
- AC-OFF-10: A cold start offline shows the allow-listed data from the last online session, with the last-updated time (S-OFF-15, S-OFF-16).
- AC-OFF-11: Saved data is owned by one User, never displayed to another, and removed on that User's sign-out (S-OFF-17, S-OFF-18).
- AC-OFF-12: Data past the keep age, or from another app version, is not shown (S-OFF-19, S-OFF-20).
- AC-OFF-13: Nothing outside the allow-list is kept (S-OFF-21).

### Idempotency
N/A — reads only.

---

## US-04: Record a Transaction while offline

**As a** User,
**I want** to save a new income, expense or transfer when I have no connection,
**so that** I can record spending the moment it happens and trust it will reach my account later.

**API:** None at recording time. Sent later via `POST /api/v1/transactions` (US-05).

### Preconditions
- Saved data contains at least one Wallet (and, for income/expense, a Category of the matching type).

### Main Flow
1. User opens the new-Transaction form, fills it in exactly as online (type, Wallet, Category or destination Wallet, amount, date, note) and taps Save.
2. System validates the form exactly as online.
3. If the device is offline, **or** the save request gets no answer, System adds the Transaction to the User's queue as **Waiting**, with the idempotency key the form already generated, the picked date and the time it was queued.
4. System closes the form and confirms: "Saved on the device — will sync when online".
5. The Queued Transaction appears at the top of the Transactions list with a "waiting to sync" marker (US-06).

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-OFF-22 | Offline, saved Wallets and Categories | User saves a valid expense | Form closes; confirmation shown; one Waiting item in the queue; list shows it | Core O3 |
| S-OFF-23 | Online, but the save request times out | — | Same Transaction is queued with the **same** idempotency key; confirmation shown | ⚠️ The request may have reached the server; the shared key makes a later send safe |
| S-OFF-24 | Offline | User saves a transfer between two saved Wallets of the same currency | Queued like any other Transaction | Transfers allowed |
| S-OFF-25 | Online | Server answers the save with a refusal (e.g. insufficient balance) | **Not** queued; the error is shown in the form as today | Only "no answer" queues; a refusal is the User's to fix now |
| S-OFF-26 | Offline, form submitted | User taps Save twice quickly | Exactly one Queued Transaction | Same key; double tap guarded |
| S-OFF-27 | Offline, no saved Wallets (first sign-in, never online since) | User opens the form | Form shows "connect to load your Wallets" and cannot be saved | Nothing to choose from |
| S-OFF-28 | Offline | User tries to create a new Category from inside the form | Not available offline ("needs a connection"); existing Categories stay selectable | Category create is online-only |
| S-OFF-29 | User picks a date of 3 days ago offline; sync happens tomorrow | Sync succeeds | Server Transaction carries the picked date, not the sync date | ⚠️ Time rule |
| S-OFF-30 | Queue already holds the maximum number of items | User saves another offline | Not queued; User is told to connect and sync first | Bounded storage; limit confirmed (decision #8) |

### Edge Cases
- **EC-OFF-11** ⚠️ The app is killed right after Save: the Queued Transaction is already stored durably before the confirmation is shown, so it survives the restart.
- **EC-OFF-12** The amount entered offline can exceed the saved Wallet balance. The app does not block it (the saved balance may be outdated); the server decides at sync time (S-OFF-36).
- **EC-OFF-13** A wrong device clock affects only the "queued at" time shown to the User; the Transaction date is the one picked in the form, which defaults to the User's local today.
- **EC-OFF-14** An AI-proposed Transaction cannot be queued in v1 — approving a proposal is online-only (Open Questions #2).

### Definition of Done
- AC-OFF-14: Saving offline, or with a request that gets no answer, queues the Transaction durably and confirms it (S-OFF-22, S-OFF-23, S-OFF-24, EC-OFF-11).
- AC-OFF-15: A Transaction is queued with the idempotency key generated for that form opening, and a double tap queues it once (S-OFF-23, S-OFF-26).
- AC-OFF-16: A server refusal while online is shown in the form and is never queued (S-OFF-25).
- AC-OFF-17: The queued Transaction keeps the picked date (S-OFF-29).
- AC-OFF-18: Form states for "no saved Wallets", "Category create unavailable" and "queue full" are shown as described (S-OFF-27, S-OFF-28, S-OFF-30).

### Idempotency
⚠️ Required. One key per form opening, persisted with the Queued Transaction, reused for every send. The server answers a repeated key with the already-created Transaction.

---

## US-05: Sync queued Transactions automatically

**As a** User,
**I want** my queued Transactions to be sent by themselves when I am back online,
**so that** my Wallets and reports catch up without me doing anything.

**API:** `POST /api/v1/transactions` (existing). Success `201` (created) or `200` (already created — replay). Refusals: `400 INVALID_INPUT`, `404 WALLET_NOT_FOUND` / `CATEGORY_NOT_FOUND`, `409 INSUFFICIENT_BALANCE`, `422 CATEGORY_TYPE_MISMATCH`, `TRANSFER_CURRENCY_MISMATCH` (validation errors, 4xx). System errors: `5xx`.

### Preconditions
- The signed-in User has Waiting items in their own queue.

### Main Flow
1. Sync starts when: the device reconnects, the app returns to the foreground, the app starts signed in, a Transaction is queued while online-but-unreachable and the next request succeeds, or the User taps Retry.
2. System sends the User's Waiting items one at a time, oldest first, each with its own idempotency key, marking each **Sending** while in flight.
3. On `201` or `200`: System removes the item from the queue and refreshes Transactions, Wallets, report summary and Budgets; for an expense it runs the existing budget-limit warning.
4. On no answer: System marks the item Waiting again and stops this sync run; the next trigger resumes it.
5. On a validation refusal (4xx): System marks the item **Failed** with the server's reason and continues with the next item.
6. On a system error (5xx): System keeps the item Waiting and stops this run; after repeated system errors on the same item it is marked Failed with a generic reason so it cannot be stuck invisibly.
7. When the run ends with items accepted, System confirms "N Transactions synced"; when items failed, "N Transactions could not be synced — review them".

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-OFF-31 | 2 Waiting items | Device reconnects | Both sent oldest first; both removed; lists, balances and budgets refresh; "2 synced" confirmation | Happy path |
| S-OFF-32 | 1 Waiting item that actually reached the server before (response lost) | Sync sends it | Server answers 200 with the original Transaction; item removed; **no second Transaction exists** | ⚠️ Idempotency |
| S-OFF-33 | 3 Waiting items | Connection drops after the first succeeds | First removed; second back to Waiting; third untouched; next reconnect resumes with the second | |
| S-OFF-34 | App killed while an item was Sending | App restarts online | Item treated as Waiting and re-sent with the same key; server books it at most once | ⚠️ |
| S-OFF-35 | Waiting expense in a Category with a Budget nearly used up | Sync accepts it | Budget-limit warning shown as for an online save | Late but not lost |
| S-OFF-36 | Waiting expense larger than the Wallet's real balance | Sync sends it | `409 INSUFFICIENT_BALANCE`; item Failed with "insufficient balance"; next item still sent | ⚠️ Never dropped |
| S-OFF-37 | Waiting item whose Wallet or Category was deleted on another device | Sync sends it | `404`; item Failed with the reason | |
| S-OFF-38 | Item gets a server error on every try | Repeated syncs | After the retry limit it becomes Failed ("server error"); it is never removed automatically | |
| S-OFF-39 | Session credential refused during sync | — | Sync stops; session ends (US-01 S-OFF-05); the queue is kept for this User | |
| S-OFF-40 | Item was accepted, then the User deleted that Transaction on another device, then this device re-sends it (lost response) | Sync sends it | Server answers 200 "already created" (US-08); item removed; deleted Transaction stays deleted | ⚠️ No resurrection, no error |
| S-OFF-41 | Two triggers at once (reconnect + foreground) | — | Only one sync run; each item sent once per run | |
| S-OFF-42 | User A's queue has items; User B is signed in | B goes online | ⚠️ Nothing of A's is sent; A's items stay on the device untouched | User isolation |
| S-OFF-43 | Sync in progress for User A | Session changes to another User mid-run | The run stops before the next send; no item of A is ever sent with B's credentials | ⚠️ Coordination with account switching |

### Edge Cases
- **EC-OFF-15** ⚠️ A Failed item is never removed automatically — only the User can discard it (US-06).
- **EC-OFF-16** Order matters for balances: an income queued before an expense is sent first. A Failed earlier item does not block later ones (confirmed, decision #8); a later expense that needed it fails on its own and can be retried.
- **EC-OFF-17** An item edited by the User while Waiting is sent with its updated content and the same key. If the server answers "already created" with content that differs from the edit (the original send had reached the server), the item is removed and the User is told the earlier version was kept and can be edited in the list.
- **EC-OFF-18** A replay answer does not include a new balance; balances are always refreshed from the server after a run.
- **EC-OFF-19** Rate or volume: one request at a time, no parallel sends, so a long queue cannot flood the server.

### Definition of Done
- AC-OFF-19: Sync starts on every trigger in step 1, runs once at a time, sends oldest first, one at a time, with each item's own key (S-OFF-31, S-OFF-41).
- AC-OFF-20: Accepted items (created, or answered as already created) are removed and dependent data refreshes, including the budget warning (S-OFF-31, S-OFF-32, S-OFF-35, S-OFF-40).
- AC-OFF-21: No-answer and system errors keep items Waiting and stop the run; repeated system errors end in Failed (S-OFF-33, S-OFF-34, S-OFF-38).
- AC-OFF-22: Validation refusals mark the item Failed with the server's reason and the run continues (S-OFF-36, S-OFF-37).
- AC-OFF-23: A User's queue is sent only with that same User's session; a session change stops the run (S-OFF-39, S-OFF-42, S-OFF-43).
- AC-OFF-24: Run outcome confirmations are shown as in step 7.

### Idempotency
⚠️ Required and inherited: each item's key is fixed for its whole life; the server's "already created" answer is treated as success. A Transaction is booked at most once no matter how many times it is sent.

---

## US-06: See and manage queued Transactions

**As a** User,
**I want** to see which Transactions are still waiting or have failed, and fix or discard them,
**so that** I always know which records have not reached my account yet.

**API:** None directly (retry uses US-05).

### Main Flow
1. User opens Transactions. If the User has Queued Transactions, a "Waiting to sync" section is shown above the server list, newest first, regardless of the active filters, each row marked Waiting, Sending or Failed (with its reason).
2. Wallet cards and Wallet rows with queued items show "N Transactions not counted yet" under the balance.
3. User taps a Queued Transaction. System offers: **Retry** (Failed items, online only), **Edit**, **Discard**.
4. Edit opens the form pre-filled with the queued content; saving replaces the queued content and keeps the item's key; a Failed item becomes Waiting.
5. Discard asks for confirmation, then removes the item from the queue.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-OFF-44 | 2 Waiting, 1 Failed | User opens Transactions | Section shows 3 rows with their state; the Failed one shows its reason | |
| S-OFF-45 | Wallet "Cash" has 2 queued items | User views Home / Wallets | Balance shown is the last-known server balance plus the hint "2 not counted yet" | No projected balance (decision #5) |
| S-OFF-46 | Failed item (insufficient balance) | User edits the amount down and saves | Item becomes Waiting with the new amount and the same key; sync sends it | |
| S-OFF-47 | Failed item, online | User taps Retry | Item sent immediately (US-05) | |
| S-OFF-48 | Any queued item | User taps Discard and confirms | Item removed; it never reaches the server | ⚠️ Deliberate User choice only |
| S-OFF-49 | Any queued item | User taps Discard and cancels | Nothing changes | |
| S-OFF-50 | Item currently Sending | User taps it | Edit and Discard unavailable until the send finishes | Avoids editing mid-flight |
| S-OFF-51 | Waiting item that was already sent once without an answer | User taps Discard | Confirmation warns that it may already have reached the account and to check the list after the next sync | ⚠️ Discarding cannot undo a send that may have landed |
| S-OFF-52 | Queue empty | User opens Transactions | No section is shown | Empty state = absence |
| S-OFF-53 | Queued items exist, list is still loading | User opens Transactions offline | Section shows at once (local); server list shows saved data or its offline state | |

### Edge Cases
- **EC-OFF-20** A Queued Transaction is never shown twice: once accepted it leaves the section before or as it appears in the server list.
- **EC-OFF-21** The section is local data only; a queued item is never counted in report totals, Budget usage or balances on screen.
- **EC-OFF-22** Editing a queued item cannot change it into an online-only operation; it stays a create.
- **EC-OFF-23** The Wallet or Category of a queued item may have disappeared from saved data (deleted elsewhere and refreshed); the row still shows the names captured at queue time.

### Definition of Done
- AC-OFF-25: The "Waiting to sync" section lists every queued item of the signed-in User with state and failure reason, and is absent when empty (S-OFF-44, S-OFF-52, S-OFF-53).
- AC-OFF-26: Wallets with queued items show the not-counted hint; no figure includes queued amounts (S-OFF-45, EC-OFF-21).
- AC-OFF-27: Edit keeps the key and re-queues a Failed item; Retry sends immediately (S-OFF-46, S-OFF-47).
- AC-OFF-28: Discard always requires confirmation, warns when a send may already have landed, and is unavailable while Sending (S-OFF-48 – S-OFF-51).

### Idempotency
⚠️ Edit keeps the key (safe: a refused send created nothing; a send that did land is answered as "already created"). Discard is local only.

---

## US-07: Sign out with unsynced Transactions

**As a** User,
**I want** to be warned before signing out while some Transactions are not synced,
**so that** I do not lose records by accident.

**API:** None new.

### Main Flow
1. User taps Sign out while their queue is not empty.
2. System shows a dialog: "N Transactions are not synced yet" with **Sync now** (online only), **Keep and sign out** (kept on this device, sent the next time this User signs in here), **Discard and sign out** (destructive, needs a second confirmation), **Cancel**.
3. Sync now runs US-05 and, once the queue is empty, signs out; if anything is left (failed or no answer), the dialog is shown again with the new count.
4. Sign out removes the User's saved data (US-03) but never another User's.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-OFF-54 | Queue empty | User signs out | Signs out as today, no dialog | |
| S-OFF-55 | 2 Waiting, online | User picks Sync now | Both synced, then signed out | |
| S-OFF-56 | 2 Waiting | User picks Keep and sign out; later signs in again as the same User | Items are still there and sync | ⚠️ Not lost |
| S-OFF-57 | User A kept 2 items and signed out | User B signs in on the device | B sees no queue section, no banner count, nothing of A is sent | ⚠️ |
| S-OFF-58 | 2 Waiting | User picks Discard and sign out and confirms | Items removed; signed out | Deliberate |
| S-OFF-59 | Session ended by a refused credential (not a tap) — expired, revoked, User disabled, or "sign out of all devices" chosen on another device | — | No dialog possible; queue kept as in "Keep" and syncs when the same User signs in again | ⚠️ Never auto-discarded |

### Edge Cases
- **EC-OFF-24** Sign out offline: Sync now is unavailable; Keep is the default highlighted choice.
- **EC-OFF-25** ⚠️ A kept queue of a User who never signs in again stays on the device indefinitely: it is never deleted automatically, never shown to or discardable by another User, and is removed only when that same User signs in and discards it, or when it syncs (decision #8). Uninstalling the app removes it with all other app data.

### Definition of Done
- AC-OFF-29: The dialog appears only with a non-empty queue and offers the four choices with the stated behaviour (S-OFF-54, S-OFF-55, S-OFF-58, EC-OFF-24).
- AC-OFF-30: Kept items survive sign-out, including a forced one, and sync after the same User signs in again;
  another User never sees, sends or discards them;
  nothing deletes them automatically (S-OFF-56, S-OFF-57, S-OFF-59, EC-OFF-25).

### Idempotency
Inherited from US-05.

---

## US-08: Same key, same result — even after the Transaction was deleted (backend + import preview)

**As the** System,
**I want** a create sent again with an idempotency key whose Transaction has since been deleted to be answered as "already created", and the import preview to say so explicitly,
**so that** a late sync never fails with a server error, a deleted Transaction is never brought back, and a User re-importing a file understands why some rows will not be imported.

**API:** `POST /api/v1/transactions` (behaviour change for this one case only) · `POST /api/v1/transactions/import/preview` (reason text for this one case only; response shape unchanged).

### Main Flow
1. A create arrives with an idempotency key already used by this User.
2. System finds the Transaction created with that key, **whether or not it has since been deleted**.
3. System answers `200` "already created" with that Transaction and writes nothing (no new row, no balance change, no audit entry).
4. **Import preview:** every import row carries a key derived from its content, so re-importing the same row always produces the same key. When the User previews a file, System checks each row's key the same way (deleted or not):
   - key unused → the row is listed as importable (unchanged);
   - key used by a Transaction that still exists → the row is listed as skipped with the existing "already imported" reason (unchanged);
   - key used by a Transaction that has since been deleted → the row is listed as skipped with a **distinct reason**: imported before, and since deleted.
5. The mobile import preview shows each skipped row with its reason, so the User sees the distinct reason without any other change.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-OFF-60 | Transaction T created with key K, then deleted | Same User sends a create with key K | `200`, T returned, nothing written | Today: unhandled duplicate → server error |
| S-OFF-61 | Key K never used | Create with K | `201` as today | Unchanged |
| S-OFF-62 | Key K used by another User | Create with K | Treated as a fresh key for this User (`201`) | Keys are per User — unchanged |
| S-OFF-63 | A row was imported, then the resulting Transaction was deleted | User previews a file containing the same row | Row is listed as skipped with the "imported before, since deleted" reason; it is not listed as importable | Today it passes preview as new and then fails at import time with a generic error |
| S-OFF-64 | A row was imported and the resulting Transaction still exists | User previews the same file | Row is listed as skipped with the existing "already imported" reason | Unchanged; the two reasons are never mixed up |
| S-OFF-65 | File mixes a new row, an already-imported row and an imported-then-deleted row | User previews it | One importable row and two skipped rows, each skipped row with its own reason; the skipped count is 2 | |
| S-OFF-66 | Preview listed a row as importable; before the User confirms, the same content is imported and deleted elsewhere | User confirms the import | That row is counted as skipped, not as failed, and nothing is written for it | Rare race; same-key rule |

### Edge Cases
- **EC-OFF-26** ⚠️ The deleted Transaction stays deleted; neither a replayed create nor an import ever restores it or its balance effect. To record it again the User creates it manually (a re-import of the identical row can never re-create it — this was already true before this change; the preview now says so up front).
- **EC-OFF-27** Two concurrent creates with the same fresh key still resolve to one Transaction (existing database guard, unchanged).
- **EC-OFF-28** A row that differs in any imported field (amount, date, Wallet, Category, type, note) from the deleted one is a different row and is importable as normal.

### Definition of Done
- AC-OFF-31: A create replayed with the key of a deleted Transaction is answered as "already created" and writes nothing (S-OFF-60 – S-OFF-62).
- AC-OFF-32: The import preview lists an imported-then-deleted row as skipped with its own distinct reason,
  keeps the existing reason for rows whose Transaction still exists,
  and the mobile preview shows both reasons (S-OFF-63 – S-OFF-65).
- AC-OFF-33: A row that becomes a deleted duplicate between preview and confirm is counted as skipped, never as failed (S-OFF-66).
- AC-OFF-34: S-OFF-60 – S-OFF-66 pass as backend unit tests; no migration added; the import preview response stays compatible with existing clients.

### Idempotency
⚠️ This story *is* the idempotency fix: the same key always resolves to the same original Transaction, deleted or not.

---

## Business Rules

| ID | Rule | Stories |
|---|---|---|
| BR-OFF-01 | A network failure or server failure never ends the session; only a refused credential does | US-01 |
| BR-OFF-02 | Only creating a Transaction works offline; every other write is online-only | US-02, US-04 |
| BR-OFF-03 | ⚠️ Saved data and queued Transactions belong to one User; never shown to or sent for another | US-03, US-05, US-07 |
| BR-OFF-04 | ⚠️ A queued Transaction keeps one idempotency key for its whole life | US-04, US-05, US-06 |
| BR-OFF-05 | ⚠️ Only an explicit User Discard removes a not-accepted Transaction | US-05, US-06, US-07 |
| BR-OFF-06 | The server is the only source of balances, totals and Budget usage; queued amounts are never added on device | US-03, US-06 |
| BR-OFF-07 | Only a "no answer" queues a save; a server refusal while online is shown in the form | US-04 |
| BR-OFF-08 | Sync is single-run, oldest first, one request at a time; a Failed item does not block later ones | US-05 |
| BR-OFF-09 | ⚠️ A queue is never deleted automatically — not on forced sign-out, not after any period of inactivity | US-01, US-07 |
| BR-OFF-10 | ⚠️ The same idempotency key always resolves to the same original Transaction, even after it was deleted; a deleted Transaction is never restored | US-05, US-08 |
| BR-OFF-11 | An import row whose earlier import was deleted is skipped with its own distinct reason | US-08 |

---

## Out of Scope

1. **Web (`frontend/`)** — frozen; nothing here applies to it.
2. **Offline edit/delete of Transactions** and any offline Wallet / Category / Budget change — no conflict protection exists on the server.
3. **AI Chat and AI proposal approval offline** (Open Questions #2), image capture, import/export offline (the import preview change in US-08 is an online behaviour), admin actions.
4. **A projected balance** that includes queued Transactions.
5. **Delta sync / multi-device merge** of saved data — saved data is refreshed wholesale after reconnecting.
6. **Server-side grace window for a lost renewal response** (research B3).
7. **Encrypting saved data at rest** — v1 accepts the same exposure as the AI Chat thread (EC-OFF-07).
8. **Returning a new balance on a replayed create** — balances are refreshed after sync instead.
9. **Account switching and "sign out of all devices"** — specced in `mobile-account-switch`; this spec only guarantees per-User ownership and that a remote sign-out keeps the queue.
10. **Signing in offline.**
11. **Restoring a deleted Transaction** by replay or re-import (EC-OFF-26).
12. **Automatic expiry of a dormant queue** — rejected by the product owner (decision #8).

---

## Open Questions

1. ~~SRS traceability~~ — **resolved 2026-10-04:** SRS §6 Feature-14 "Offline Use" (US-01..US-05) added; NFR-06 points to it.
2. **AI proposal approval offline:** an approved proposal already has its own key and could be queued like a manual entry. v1 keeps it online-only. Confirm.
