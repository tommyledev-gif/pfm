# Feature Spec: Mobile UX Batch (October 2026)

> Source: user request (this session, 2026-10-03), items 1–14. Item 2 (reading Transactions from an image) is a feasibility study only — see [research.md](./research.md); it has no User Story here.
> Status: New — refines surfaces that already exist. One server-side defect fix (US-13); everything else is presentation or on-device behaviour.
> Scope: **`mobile/` only**, plus the one server read in US-13. `frontend/` (web) is frozen and out of scope.
> Related: [AI Chat Assistant](../ai-chat-assistant/spec.md) · [Query Spending via Chat](../ai-chat-query-spending/spec.md) · [Transaction Audit Log](../transaction-audit-log/spec.md) · [Transaction Management](../transaction-management/spec.md) · [Mobile Visual Refinements](../mobile-visual-refinements/spec.md)

---

## Context

Thirteen defects and refinements across the mobile app, grouped because they share one property: **none of them changes a stored figure, a Transaction, a Wallet balance or a business rule.** Each is either a presentation change, an on-device convenience, or (US-13) a read that wrongly refuses to show history the user is entitled to see.

Themes:

- **Navigation & layout polish** — US-01 Appearance screen, US-02 bottom-nav ball, US-03 floating strips, US-11 Wallet carousel, US-12 animated day collapse.
- **Chat message interactions** — US-04 hold-to-copy, US-05 keyboard yields to hold/swipe, US-06 carry a mis-routed message into recording, US-09 saved and recent phrases.
- **Home pending list** — US-07 compact list, US-08 earlier swipe reveal, US-10 correct currency.
- **History** — US-13 history of a removed Transaction.

**Resolved design decisions:**

1. **Every colour comes from the existing theme tokens, in both the dark and the light theme.** No new colour literal is introduced.
2. **Holding and swiping offer the same choices.** Wherever a message can be swiped to reveal actions, holding it offers those same actions plus Copy (and, where applicable, Save phrase). An item that cannot be swiped offers Copy only.
3. **Copying a Transaction proposal copies the record, not the sentence.** The assistant's wording around a proposal is not useful outside the app; the date, amount, Category, Wallet and creation time are.
4. **Saved phrases and recent-phrase suggestions live on the device, per signed-in User.** They are typing shortcuts, not financial data: never sent to the server, never shown to a different User on the same device.
5. **A suggestion fills the input; it never sends.** The User always presses Send themselves, so a suggestion can never create a proposal on its own.
6. **The swipe change (US-08) applies to every surface that shares the swipe gesture** — the Home pending list and both sides of a chat message — so the app has one swipe feel, not two.

Actors:
- **User** — any `active` user, on their own data.

---

## Preconditions (feature-level)

- User is authenticated and inside the authenticated area of the app.
- Every screen named below already exists and functions.

---

## US-01: Move the theme choice to its own Appearance screen

**As a** User,
**I want** the theme choice behind an "Appearance" row in Settings,
**so that** the Settings screen stays a short menu instead of carrying a full picker inline.

### Preconditions
- The theme picker exists and currently renders inline on Settings.

### Main Flow
1. User opens Settings.
2. System shows an "Appearance" row in the Settings menu, styled like the other menu rows, and no longer shows the theme picker inline.
3. User taps "Appearance".
4. System opens the Appearance screen: a back control, the title "Appearance", and the theme picker.
5. User picks a theme.
6. System applies it immediately, exactly as the inline picker does today, and remembers it.
7. User taps back.
8. System returns to Settings.

### Scenarios

| Scenario | Given | When | Then | Notes |
|---|---|---|---|---|
| S-MUX-01 | Settings is open | User looks at the screen | No theme picker inline; an "Appearance" row is in the menu | |
| S-MUX-02 | Settings is open | User taps "Appearance" | The Appearance screen opens with the theme picker, showing the current theme as selected | |
| S-MUX-03 | Appearance screen is open | User picks another theme | The whole app switches theme immediately; the choice survives an app restart | Same persistence as today |
| S-MUX-04 | Appearance screen is open | User looks at the bottom navigation | Settings is shown as the active tab | Same rule as other Settings sub-screens |
| S-MUX-05 | Appearance screen is open | User presses back (control or system back) | Returns to Settings | |

### Edge Cases
- **EC-01** — Theme switched while on the Appearance screen: the screen itself re-colours in place; it does not close or jump.
- **EC-02** — Both member and admin see the row (theme is not role-gated).
- **EC-03** — Rapidly tapping the row twice opens one Appearance screen, not two stacked.

### Definition of Done
- Settings shows no inline theme picker and has an "Appearance" row.
- The Appearance screen hosts the picker; selection applies immediately and persists.
- Bottom navigation keeps Settings active on the Appearance screen.

---

## US-02: Show only the ball and its socket in the bottom navigation

**As a** User,
**I want** the active-tab ball to sit in a clean socket with no extra halo ring around it,
**so that** the navigation reads as one ball in one hollow, not a ball inside a disc inside a hollow.

### Preconditions
- The bottom navigation shows a floating ball over the active tab, inside a socket drawn with concentric rings.

### Main Flow
1. User views any tab.
2. System shows the active tab's ball inside a hollow cut into the bar's top edge.
3. The hollow hugs the ball with a small, even gap all around; there is no intermediate ring, disc or halo between the ball and the hollow's edge.
4. User switches tab.
5. System moves the ball and its hollow together, with the existing movement, squash and float animations unchanged.

### Scenarios

| Scenario | Given | When | Then | Notes |
|---|---|---|---|---|
| S-MUX-06 | Light theme, any tab | User looks at the nav | Ball + hollow only; no grey ring/disc around the ball | Screenshot 1 is the defect |
| S-MUX-07 | Dark theme, any tab | User looks at the nav | Same: ball + hollow only | |
| S-MUX-08 | Ball on Home | User taps Insights | Ball and hollow travel together; the bar's top edge line stays broken exactly around the hollow throughout | |
| S-MUX-09 | Ball at rest | Idle | Ball keeps its gentle float; the hollow does not float with it | Existing behaviour |

### Edge Cases
- **EC-04** — The hollow's gap must stay visible while the ball is at the top of its float and at the bottom; the ball never touches or overlaps the hollow's edge.
- **EC-05** — On a Settings sub-screen the ball and hollow sit over Settings, as today.
- **EC-06** — The ball carries no drop shadow: on Android the shadow renders as a grey halo around the ball, which is the extra layer above the bar in screenshot 1. Decided during implementation (2026-10-03).

### Definition of Done
- In both themes, nothing is drawn between the ball and the hollow's edge except the bar's background colour gap.
- All existing nav animations behave as before.

---

## US-03: Let floating strips sit over the content instead of forming a band

**As a** User,
**I want** the suggestion chips above the chat input, and the Transactions filter row, to float over the content behind them,
**so that** scrolling never reveals a separate strip with its own edge.

### Preconditions
- In both chat modes, the row of quick chips sits above the input field as its own block; the conversation ends at that block's top edge, which shows as a visible band when the conversation is scrolled (screenshot 2).
- On Transactions, the horizontal filter row is cut off at the page margin instead of at the screen edge (screenshot 1, "Sắp xế…").

### Main Flow
1. User scrolls the conversation in either chat mode.
2. System lets messages pass beneath the quick-chip row and the input field; the chips and input float over them with no background band of their own.
3. When the User is at the newest message, the newest message sits fully visible above the chips — never hidden beneath them.
4. User scrolls the Transactions filter row sideways.
5. System scrolls the pills all the way to the screen edges; at rest the first pill lines up with the page margin.

### Scenarios

| Scenario | Given | When | Then | Notes |
|---|---|---|---|---|
| S-MUX-10 | Analysis mode, long conversation | User scrolls up | Messages slide under the starter chips and input; no band of a different colour appears behind the chips | |
| S-MUX-11 | Recording mode, keyboard closed | User scrolls | Same for the recording quick chip ("Lập ngân sách") | |
| S-MUX-12 | Any mode, at newest message | User looks | Newest message fully visible above the chips; typing indicator likewise | |
| S-MUX-13 | Keyboard open | User scrolls | Same floating behaviour; nothing hidden under the chips at the newest end | |
| S-MUX-14 | Jump-to-latest button visible | User looks | Button stays tappable and is not covered by the chips | |
| S-MUX-15 | Transactions screen | User drags the filter row left | Pills scroll to the screen's right edge, not to the margin; first pill aligned with the margin at rest | |

### Edge Cases
- **EC-07** — Chips that are tapped while a message is beneath them receive the tap; the message behind does not.
- **EC-08** — When the chip row changes height (e.g. recording chip hides while the keyboard is open) the conversation's reserved space follows, so the newest message is never covered.
- **EC-09** — An empty conversation's hint text stays fully visible, not under the chips.
- **EC-10** — The suggestion rows *inside* an assistant reply (the "try asking…" list) keep their own card background; only the strip above the input changes.
- **EC-10a** — The strip stays fully transparent; legibility of chips over passing messages is judged on device in both themes before sign-off.

### Definition of Done
- In both chat modes, no visible band appears behind the chips when scrolling, and the newest content is never obscured.
- The Transactions filter row scrolls edge-to-edge.

---

## US-04: Hold a message to copy it

**As a** User,
**I want** to hold any chat message briefly (about half a second) to get a Copy action,
**so that** I can reuse my own text, the assistant's answer, or a Transaction's details elsewhere.

### Preconditions
- Holding a proposal card already opens a small action menu (Edit / Delete) after about one second. Plain text bubbles have no hold action.
- The hold duration for this menu becomes the platform's standard long-press (about half a second), for every message — easier to discover than one second.

### Main Flow
1. User holds a message (theirs or the assistant's, in either chat mode) for about half a second.
2. System gives a short vibration and opens the action menu for that message.
3. The menu offers **Copy**, plus whatever that message's swipe offers (Edit / Delete), plus **Save phrase / Remove saved phrase** for the User's own messages in recording mode (US-09).
4. User taps Copy.
5. System copies to the clipboard and shows a brief "Copied" confirmation:
   - a plain message → its exact text;
   - a message carrying a Transaction proposal (live, confirmed or removed) → the record in this layout, one field per line:

     ```
     Date: DD/MM/YYYY
     Amount: <signed amount with currency>
     Category: <Category name>
     Wallet: <Wallet name>
     Created at: HH:MM
     ```
     (field labels shown to the User in Vietnamese: Ngày / Số tiền / Danh mục / Ví / Tạo lúc).

### Business rules
- **BR-01** — Date is the Transaction's own date, in the device's local time zone. "Created at" is when the proposal first appeared in the chat, local time, 24-hour.
- **BR-02** — Amount is the full, exact figure in the proposal's Wallet currency (never the shortened "1,2 tr" form), with "-" for an expense and "+" for income — the same sign the card shows. Amount is stored in integer minor units (xu); the copy is formatted from it without rounding.
- **BR-03** — If the proposal has been edited, the copy reflects its current values.
- **BR-04** — A copied line break is a real line break; no other separator is used.

### Scenarios

| Scenario | Given | When | Then | Notes |
|---|---|---|---|---|
| S-MUX-16 | User's plain message "bi cong phat 5m" | Hold → Copy | Clipboard = "bi cong phat 5m"; "Copied" shown | |
| S-MUX-17 | Assistant plain reply | Hold → Copy | Clipboard = the reply text | |
| S-MUX-18 | Unconfirmed expense proposal, 396,000,000 ₫, Category "Di chuyển", Wallet "Hhhh", dated 02/10/2026, created 17:41 | Hold → Copy | Clipboard = the five-line block with "-396.000.000 ₫" | |
| S-MUX-19 | Confirmed income proposal | Hold → Copy | Block with "+" amount | |
| S-MUX-20 | Removed proposal (tombstone) | Hold → Copy | Block of the values it had when removed | |
| S-MUX-21 | Analysis-mode answer with a chart | Hold → Copy | Clipboard = the answer's text only | Charts are not copied |
| S-MUX-22 | Proposal in a USD Wallet | Hold → Copy | Amount in USD format | |
| S-MUX-23 | Menu open | User taps outside | Menu closes, nothing copied | |
| S-MUX-24 | Short tap (released before the hold completes) | Release | No menu | |

### Edge Cases
- **EC-11** — A message with no text and no proposal (e.g. an inline "create manually" prompt only) offers no Copy; if it offers no other action, holding does nothing.
- **EC-12** — Category or Wallet no longer resolvable (deleted or not loaded): the line shows the same fallback name the card shows.
- **EC-13** — Older proposals created before this release with no known creation time omit the "Created at" line rather than inventing one.
- **EC-14** — Holding the amount on a proposal card still opens the existing exact-amount reveal, not this menu (existing behaviour kept): the innermost held element wins.
- **EC-15** — Copy failing on the device shows a brief error ("Could not copy"); nothing else changes.

### Definition of Done
- Every text-bearing message in both chat modes can be held to copy.
- Proposal copies follow the five-line layout and BR-01…BR-04.
- The hold menu also lists that message's swipe actions.

---

## US-05: Let the keyboard yield when a message is held or swiped

**As a** User,
**I want** the keyboard to close the moment I start holding or swiping a message,
**so that** the menu or swipe I started is not half-hidden behind the keyboard.

### Preconditions
- The input is focused and the keyboard is open.
- Tapping a message deliberately does not close the keyboard (kept).

### Main Flow
1. With the keyboard open, User holds a message.
2. When the hold completes (US-04), System closes the keyboard and opens the action menu.
3. Alternatively, User drags a message sideways.
4. As soon as the drag is recognised as a swipe, System closes the keyboard and the swipe continues under the finger without interruption, parking or snapping back exactly as it would with the keyboard closed.

### Scenarios

| Scenario | Given | When | Then | Notes |
|---|---|---|---|---|
| S-MUX-25 | Keyboard open | User holds a message | Keyboard closes; menu opens | |
| S-MUX-26 | Keyboard open | User swipes a message to reveal Edit | Keyboard closes; row parks open with Edit visible | |
| S-MUX-27 | Keyboard open | User taps a proposal's Confirm button | Keyboard stays open; Confirm works | Existing behaviour kept |
| S-MUX-28 | Keyboard open | User scrolls the conversation vertically | Keyboard behaviour unchanged from today | |
| S-MUX-29 | Keyboard open, analysis mode | User holds an answer | Keyboard closes; menu opens | |

### Edge Cases
- **EC-16** — The layout shifts as the keyboard closes; the swipe must stay attached to the same message the finger started on and must not jump or snap back because of the shift.
- **EC-17** — A hold released before it completes leaves the keyboard open.
- **EC-18** — The input keeps its draft text when the keyboard closes.

### Definition of Done
- With the keyboard open, a completed hold or a recognised swipe always closes the keyboard and still completes its own action.

---

## US-06: Carry a mis-routed message from analysis into recording

**As a** User,
**I want** "Switch to recording" to bring my message with it,
**so that** I do not have to retype a Transaction I already wrote in the wrong mode.

### Preconditions
- In analysis mode, a message that reads like a Transaction gets a reply with a "Chuyển sang Ghi giao dịch" button (screenshot 2).

### Main Flow
1. User taps "Switch to recording" under such a reply.
2. System switches to recording mode.
3. System fills the recording input with exactly the message that reply answered (remembered with the reply when it was produced), replacing any draft there.
4. System focuses the input so the User can edit or send it.
5. Nothing is sent until the User presses Send.

### Scenarios

| Scenario | Given | When | Then | Notes |
|---|---|---|---|---|
| S-MUX-30 | Analysis reply to "Chuyển 500k vcb tới hhh" | User taps Switch | Recording mode; input shows "Chuyển 500k vcb tới hhh"; keyboard open | |
| S-MUX-31 | Same, recording input had a draft "abc" | User taps Switch | Input now shows the carried message; "abc" is replaced | Assumption A-01 |
| S-MUX-32 | Two such replies in the thread | User taps the older one | Input shows the message that older reply answered | |
| S-MUX-33 | Switch tapped | User does nothing | No proposal is created; no message is sent | |

### Edge Cases
- **EC-19** — A reply produced before this release has no remembered message: System switches mode with the input untouched, as today. No guessing from neighbouring messages.
- **EC-20** — Tapping Switch while a recording reply is still pending: mode switches and the input is filled; sending still waits for the pending reply as it does today.
- **EC-21** — The carried text is the message exactly as the User typed it, not a corrected or trimmed version beyond leading/trailing spaces.

### Definition of Done
- Switching from such a reply always lands in recording with that message prefilled and focused, never auto-sent.

---

## US-07: Keep the Home pending list compact

**As a** User,
**I want** Home's "Awaiting confirmation" list to show only the newest few with a summary of the rest,
**so that** a backlog of proposals does not push the rest of Home off screen.

### Preconditions
- Home lists every unconfirmed proposal, one row each, oldest first.

### Main Flow
1. User opens Home with N proposals awaiting confirmation.
2. If N ≤ 3, System shows all N rows, newest first.
3. If N ≥ 4, System shows the 2 newest rows, then one summary row "+(N−2) more awaiting confirmation".
4. User taps the summary row.
5. System opens the full pending-review screen (same as "View all").
6. The section header's count badge always shows N.

### Scenarios

| Scenario | Given | When | Then | Notes |
|---|---|---|---|---|
| S-MUX-34 | 0 pending | Home opens | Section hidden | Existing |
| S-MUX-35 | 3 pending | Home opens | 3 rows, newest first, no summary row | A summary for 1 would save nothing |
| S-MUX-36 | 4 pending | Home opens | 2 rows + "+2 more…" | |
| S-MUX-37 | 12 pending | Home opens | 2 rows + "+10 more…"; badge 12 | |
| S-MUX-38 | 4 pending | User confirms one elsewhere | Section shows 3 rows, summary disappears | |
| S-MUX-39 | 4 pending | User taps summary | Pending-review screen opens | |

### Edge Cases
- **EC-22** — The summary row is not swipeable and has no Edit/Discard.
- **EC-23** — The summary row reads as a link (distinct from a proposal row), never as a fourth proposal.
- **EC-24** — Discarding one of the two visible rows promotes the next newest into view.

### Definition of Done
- At most 3 entries ever render in the section; with 4+ pending the third entry is the summary row leading to the full list.

---

## US-08: Reveal swipe actions sooner

**As a** User,
**I want** a swipe's Edit / Delete button to appear early in the drag and to stay open once I pass half way,
**so that** I do not have to drag almost the full distance before anything happens.

### Preconditions
- Today the button only starts fading in near the end of the travel, and the row only stays open if released at the very end.

### Main Flow
1. User starts dragging a swipeable row (Home pending row or chat message).
2. System starts showing the action button as soon as the drag begins, reaching full visibility by half of the travel.
3. Past half the travel, System gives the "armed" tick.
4. User releases past half the travel → System snaps the row fully open (parked) with the button tappable.
5. User releases before half the travel → System snaps the row closed.
6. Releasing never performs the action; tapping the parked button does (unchanged safety rule).

### Scenarios

| Scenario | Given | When | Then | Notes |
|---|---|---|---|---|
| S-MUX-40 | Home pending row | Drag left 30% of travel | Discard button already partly visible | |
| S-MUX-41 | Same | Release at 55% | Row snaps fully open; Discard tappable | |
| S-MUX-42 | Same | Release at 40% | Row snaps closed | |
| S-MUX-43 | Chat message | Drag to 60% and release | Parks open on that side | Same feel as Home |
| S-MUX-44 | Parked row | User taps Discard | Confirmation opens (unchanged) | ⚠️ release must never act |

### Edge Cases
- **EC-25** — A fast flick that ends before half the travel but with clear speed toward opening still snaps closed (no velocity shortcut) — predictability over speed.
- **EC-26** — Opening one row closes any other parked row (unchanged).
- **EC-27** — A vertical scroll that wanders sideways a little is still a scroll, not a swipe (unchanged threshold).

### Definition of Done
- On every swipeable row, the button is visible from early in the drag and a release past half parks the row; release alone never acts.

---

## US-09: Reuse saved and recent phrases while typing

**As a** User,
**I want** my saved phrases and the phrases that recently produced Transactions I confirmed offered above the input as I type,
**so that** recurring entries like "bi cong phat 5m" or "130k nhận lương" take one tap.

### Preconditions
- Recording mode is active.

### Main Flow
1. User focuses the recording input (keyboard opens).
2. System shows a suggestion area directly above the input.
3. With the input empty, the area lists the User's saved phrases first (most recently saved first), then recent phrases (newest first). A recent phrase is the exact recording message that produced a proposal the User then confirmed — from the chat, from the pending-review screen, or via confirm-all.
4. As the User types, System re-filters after a short pause in typing (about 300 ms): items containing the typed text, ignoring case and Vietnamese diacritics; items that *start* with it rank above items that merely contain it; saved phrases still rank above recent messages within each tier.
5. User taps a suggestion.
6. System replaces the whole input with exactly that phrase, keeps the input focused, and does not send.
7. To save a phrase, User holds one of their own recording-mode messages (US-04) and taps **Save phrase**; held again, it offers **Remove saved phrase**.
8. Each suggestion carries a pin control: filled for a saved phrase, outlined otherwise; tapping it saves or removes the phrase without leaving the input. (A hold menu was rejected here: opening it would take focus from the input, which hides the suggestion area and the menu with it.)

### Business rules
- **BR-05** — The suggestion area never takes more than 20% of the visible conversation area's height; longer lists scroll inside it.
- **BR-06** — It is shown only while the recording input is focused, and hidden when there is nothing to show.
- **BR-07** — A suggestion identical to the current input is not listed.
- **BR-08** — Recent phrases are deduplicated (ignoring case, diacritics and surrounding spaces); the newest wording wins and moves to the top. Only a bounded number of the most recent are kept; the oldest falls off (these are history, not something the User chose to keep).
- **BR-09** — Saved and recent phrases are kept on the device per signed-in User, survive app restarts and logout/login of the same User, and are never visible to another User on the device. They are not synced across devices.
- **BR-10** — The number of saved phrases is capped; saving beyond the cap is refused with a short message asking the User to remove one first. Nothing is ever dropped silently.
- **BR-11** — Analysis-mode questions are never offered here: they never produce a confirmed Transaction, so they never become recent phrases.

### Scenarios

| Scenario | Given | When | Then | Notes |
|---|---|---|---|---|
| S-MUX-45 | Saved: "130k nhận lương"; earlier, "bi cong phat 5m" produced a proposal the User confirmed | User focuses empty input | Area shows "130k nhận lương" (marked) then "bi cong phat 5m" | |
| S-MUX-46 | Same | User types "phat" | After the pause, only "bi cong phat 5m" is listed | |
| S-MUX-47 | Same | User types "nhan" | "130k nhận lương" matches despite missing diacritics | |
| S-MUX-48 | Input "xyz" | User taps "bi cong phat 5m" | Input becomes exactly "bi cong phat 5m"; nothing sent | Overwrites |
| S-MUX-49 | Own message in recording | Hold → Save phrase | Phrase saved; appears first next time | |
| S-MUX-50 | Saved phrase | Hold its message → Remove saved phrase | No longer marked/prioritised (may still appear as a recent phrase) | |
| S-MUX-50a | User sends "cafe 45k" but discards the proposal | Focus input later | "cafe 45k" is not a recent phrase | Only confirmed ones count |
| S-MUX-50b | User confirms the same phrase from the pending-review screen | Focus input later | Phrase listed as recent | Every confirm path records |
| S-MUX-51 | 30 matching items | Area shown | Height ≤ 20% of conversation area; inner scroll | |
| S-MUX-52 | No saved phrases, no recent phrases | Focus input | No area shown | Empty state |
| S-MUX-53 | Analysis mode | Focus input | No suggestion area | |
| S-MUX-54 | User A saved phrases; logs out; User B logs in | B focuses input | None of A's saved phrases shown | Isolation |
| S-MUX-55 | Saved-phrase cap reached | Hold → Save phrase | Refused with message; nothing removed | |
| S-MUX-56 | User typing quickly | Each keystroke | Typing never stutters; list updates once typing pauses | Performance |

### Edge Cases
- **EC-28** — Very long phrases are shown on one line, truncated; tapping still fills the full text.
- **EC-29** — Saving a phrase that is already saved is a no-op (no duplicate).
- **EC-30** — Removing the Transaction later does not remove its phrase from recent suggestions — the User did once confirm it.
- **EC-30a** — Proposals confirmed before this release seed nothing (no backfill); recent phrases build up from the first confirm after release.
- **EC-30b** — Editing a proposal's fields before confirming does not change its phrase; correcting the message itself (re-sending it) does, because a new proposal is produced from the corrected text.
- **EC-31** — The area must not cover the newest message or the input; it pushes nothing off screen beyond its 20% budget.
- **EC-32** — Keyboard closes (input blurred) → area hides immediately; draft is kept.

### Definition of Done
- Focused recording input shows saved-then-recent suggestions, filtered after a typing pause, capped at 20% height, filling (never sending) on tap.
- Recent phrases are recorded on every confirm path and only on confirm.
- Save / Remove saved phrase is available from the hold menu and persists per User on the device.

---

## US-10: Show pending amounts in their own currency

**As a** User,
**I want** each pending row on Home to show its amount in its own Wallet's currency,
**so that** a VND proposal never appears with a "$".

### Preconditions
- Today every pending row is formatted in one Home-wide currency, which can be USD when the report or a Wallet is in USD.

### Main Flow
1. User opens Home with pending proposals.
2. System formats each row's amount in the currency of that proposal's Wallet, matching what the chat card shows for the same proposal.

### Scenarios

| Scenario | Given | When | Then | Notes |
|---|---|---|---|---|
| S-MUX-57 | VND Wallet proposal, Home figures in USD | Home opens | Row shows "… ₫" | Defect case |
| S-MUX-58 | One VND and one USD proposal | Home opens | Each row in its own currency | |
| S-MUX-59 | Proposal's Wallet not yet loaded / deleted | Home opens | Row uses the app's default currency (VND), same fallback as the chat card | |

### Edge Cases
- **EC-33** — The row also shows a sign consistent with the chat card ("-" expense, "+" income).
- **EC-34** — Amount is in integer minor units (xu) and formatted without rounding to a float.
- **EC-35** — The summary row from US-07 shows no amount, so no currency mixing arises there.

### Definition of Done
- Every pending row's currency equals its Wallet's currency; no Home-wide currency is applied to proposals.

---

## US-11: Stop the Wallet carousel from cropping its cards

**As a** User,
**I want** each Wallet card's edges, shadow and highlight fully visible,
**so that** the carousel does not look clipped.

### Preconditions
- The carousel's box is exactly one card tall, so the cards' shadow and highlight are cut at the top and bottom.

### Main Flow
1. User opens Home or Wallets.
2. System shows the Wallet carousel with enough breathing room above and below that every card's border, drop shadow and highlight ring render in full.
3. The loading placeholder occupies exactly the same box, so nothing shifts when Wallets load.

### Scenarios

| Scenario | Given | When | Then | Notes |
|---|---|---|---|---|
| S-MUX-60 | Home, 3 Wallets | Carousel shown | No card edge or shadow is cut off top/bottom | |
| S-MUX-61 | Wallets screen, highlighted Wallet | Carousel shown | Highlight ring fully visible | |
| S-MUX-62 | Loading | Placeholder → cards | No vertical jump | |
| S-MUX-63 | Swiping between cards | Mid-swipe | Neighbour cards and shadows not clipped | |

### Edge Cases
- **EC-36** — No Wallets: the empty message keeps its current spacing.
- **EC-37** — Both themes: shadow visible and uncut in each.
- **EC-38** — The extra room must not make the section look detached — spacing to the next section is adjusted so overall rhythm stays the same.

### Definition of Done
- No clipping of any card decoration in either screen or theme; placeholder and loaded carousel share one size.

---

## US-12: Animate collapsing and expanding a day

**As a** User,
**I want** a day's Transactions to fold and unfold smoothly,
**so that** the list does not jump when I tap a day header.

### Preconditions
- Tapping a day header hides or shows its rows instantly.

### Main Flow
1. User taps an expanded day header.
2. System smoothly closes the day's rows, rotates the chevron to "collapsed", shows the hidden count, and slides later days up — all in one short motion.
3. User taps the collapsed header.
4. System reverses the motion.

### Scenarios

| Scenario | Given | When | Then | Notes |
|---|---|---|---|---|
| S-MUX-64 | Day with 3 rows expanded | Tap header | Rows fold away smoothly; chevron rotates smoothly; "(3)" appears | |
| S-MUX-65 | Collapsed day | Tap header | Rows unfold smoothly | |
| S-MUX-66 | Any day | Tap twice quickly | Ends in the state matching the tap count; no stuck half-state | |
| S-MUX-67 | Device "reduce motion" on | Tap header | Changes instantly | Accessibility |

### Edge Cases
- **EC-39** — Collapsing a day near the bottom while the list is scrolled: content above the tapped header does not jump.
- **EC-40** — Collapse state still resets the same way it does today (no new persistence).
- **EC-41** — Swiping or opening a row during the animation is allowed once the row is visible; no tap is lost.

### Definition of Done
- Collapse and expand animate smoothly (rows, chevron, following days) and respect reduce-motion.

---

## US-13: View the history of a removed Transaction

**As a** User,
**I want** "View history" to work on a Transaction I have removed,
**so that** I can see what it was and when I removed it.

### Preconditions
- A Transaction confirmed from chat was later removed (soft-deleted — the record still exists with its removal time; it is never hard-deleted).
- Today, opening its history from the chat card fails with "not found".

### Main Flow
1. User opens the history of a removed Transaction (from its chat card or tombstone).
2. System checks that the Transaction belongs to the User — including removed ones.
3. System returns its full history, newest first, including the removal entry.
4. The chat history sheet shows the entries as it does for a live Transaction.

### Business rules
- **BR-12** — Ownership is checked on the Transaction whether or not it has been removed. Another User's Transaction (removed or not) → access denied (403). A Transaction that never existed → not found (404). A malformed identifier → validation error (400).
- **BR-13** — This is a read; nothing is restored, written or changed. Viewing history never un-removes a Transaction.
- **BR-14** — Viewing the history of live Transactions behaves exactly as today.

### Scenarios

| Scenario | Given | When | Then | Notes |
|---|---|---|---|---|
| S-MUX-68 | User's own removed Transaction with create + delete entries | Open history | 200; both entries listed, delete first | Defect case |
| S-MUX-69 | User's own removed Transaction that was edited before removal | Open history | create, update and delete entries all listed | |
| S-MUX-70 | Another User's removed Transaction id | Request its history | 403 | ⚠️ never leak existence silently as empty |
| S-MUX-71 | Unknown id | Request history | 404 | |
| S-MUX-72 | Malformed id | Request history | 400 | |
| S-MUX-73 | Live Transaction | Open history | Unchanged behaviour | Regression |
| S-MUX-74 | Server error | Open history | Sheet shows its existing error state with Retry | 5xx |

### Edge Cases
- **EC-42** — The removed Transaction's Category or Wallet was also removed later: entries still show their historical names (existing rule).
- **EC-43** — The unfiltered history list (Settings → Transaction log) is unaffected.
- **EC-44** — A proposal removed before it was ever confirmed has no server history; the sheet keeps showing its on-device edit trail as today.

### Definition of Done
- History opens for the User's own removed Transactions with all entries; isolation (403/404/400) holds; nothing is mutated.

---

## Out of Scope

- Reading Transactions from a photo, handwritten note or spreadsheet screenshot — feasibility only, see [research.md](./research.md).
- Any `frontend/` (web) change.
- Syncing saved phrases across devices or to the server.
- Copying charts or images from analysis answers.
- A "confirm all pending" action.
- Remembering collapsed days across app restarts.

---

## Assumptions

- **A-01** — When "Switch to recording" (US-06) or a suggestion (US-09) fills the input, any existing draft is replaced, as requested ("fill (đè)").
- **A-02** — "Recent" pending rows (US-07) means newest by when the proposal appeared in the chat.
- **A-03** — US-03's "SuggestionRows" request refers to the starter-chip strip above the input (the band visible in screenshot 2), not the suggestion list inside an assistant reply (EC-10).
- **A-04** — US-02's "layer outside the ball" is the grey ring/disc between the ball and the hollow's edge; the hollow itself stays, tightened to the ball.

---

## Open Questions

- ~~OQ-01~~ — Resolved: input is focused automatically (US-06 step 4).
- ~~OQ-02~~ — Resolved: saved phrases capped at 20, recent phrases keep the latest 50 (values live in the plan).
- ~~OQ-03~~ — Resolved: earlier reveal applies to every swipe surface (decision #6).
- ~~US-04 hold duration~~ — Resolved 2026-10-03: platform standard (~0.5 s).
- ~~US-13 other User's Transaction~~ — Resolved 2026-10-03: keep 403.
- **OQ-04** — Item 2 (image → Transactions): proceed to a full spec after reviewing research.md? It needs a new User Story in SRS §6 (Feature-12) first.
