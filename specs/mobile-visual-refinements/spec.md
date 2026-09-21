# Feature Spec: Mobile Visual & Interaction Refinements

> Source: user request (this session), items 1, 2, 3, 5, 6, 7, 10, 11.
> Status: New — refines surfaces that already exist and work. No new endpoint, no new table, no new query, no change to any business rule.
> Scope: **`mobile/` only.** Every item below names a mobile screen or component; `frontend/` (web) has none of them.
> Related: [Budget Management](../budget-management/spec.md) (owns the budget states these chips filter by) · [AI Budget Wizard v2](../ai-budget-wizard-v2/spec.md) (owns the wizard flow US-04 and US-05 change) · [Financial Reporting](../financial-reporting/spec.md) (owns the figures the Insights screen shows) · [Wallet Management](../wallet-management/spec.md) (owns the wallets the carousel displays)

---

## Context

Eight defects and refinements across the mobile app, grouped here because they share one property: **each one is a presentation or local-interaction change, and none of them may alter a figure, a stored value or a server call.** Splitting them into eight specs would cost more to read than the changes cost to make; merging them into a feature spec that also changes behaviour would make it impossible to tell which risk belongs to which change.

They fall into four themes:

- **Status colour that means something** (US-01, US-02) — filter chips and proposal rows currently paint status and identity in colours that either say nothing or say the wrong thing.
- **Text that can actually be read** (US-03, US-06) — a label rendered white-on-near-white, and English strings on screens that are otherwise entirely Vietnamese.
- **Decisions the user can reverse** (US-04, US-05) — the budget wizard lets the user remove only half the rows it shows, and loses their whole plan if they step back to change an answer.
- **Wallets worth looking at** (US-07) — a flat horizontal strip replaced with a stacked card carousel.

US-08 is not a change at all: it records the investigation of a reported defect that turns out to be correct behaviour, plus the genuine inconsistency found behind it.

**Resolved design decisions:**

1. **Every colour comes from the existing design tokens.** No new hex value is introduced anywhere in this feature, and no component inlines a colour literal — the token file is the single place colour is defined, and that rule is what keeps the app one app.
2. **Status colour is assigned once and reused, never re-picked per surface.** A budget that is over its limit is already painted one colour by its row, its meter and its caption; the filter chip above them must be that same colour or the screen contradicts itself. Any change here changes the shared derivation, not one component's stylesheet.
3. **Category identity colour must be collision-free within a single view.** Two rows side by side in the same list painted the same colour read as "these are the same thing". The app already has a helper that assigns distinct colours across a known set; the wizard's proposal list must use it rather than hashing each row's identifier independently — which is why a newly added row can currently land on the same colour as an existing one.
4. **A saved wizard plan keeps which categories the user chose, never their amounts.** An amount is a share of what is left after income, fixed costs and savings — all three of which the user is going back to change. Restoring a figure computed from stale inputs would present an arithmetic lie as a saved preference. The categories are the preference; the amounts are derived, and are re-derived at the moment they are shown.
5. **Nothing in this feature writes to the server.** Every change is presentation, local component state, or the wizard's existing draft state — which is already local and already written only at the wizard's final confirmation.

Actors:
- **User** — any `active` user, on their own data.

---

## Preconditions (feature-level)

- User is authenticated and inside the authenticated route group.
- Every screen named below already exists and functions.

⚠️ **Money rule**: no figure's value, unit or rounding changes anywhere in this feature. Amounts remain integer cents end to end and are formatted for display only.

---

## US-01: Give the budget filter chips their status colours

**As a** User,
**I want** the "approaching limit" and "over limit" filters to carry the colours those states already use,
**so that** I can find the budgets that need attention without reading three labels.

**Client:** mobile — Insights → Budgets tab

### Preconditions
- The Budgets tab is open with at least one budget.

### Main Flow
1. User opens the Budgets tab.
2. System renders three filter chips: all budgets, approaching limit, over limit.
3. The approaching-limit chip carries the warning colour already used for that state; the over-limit chip carries the over-limit colour already used for that state; the all-budgets chip stays neutral.
4. Colour is carried whether or not the chip is the selected one; selection is shown by weight and fill, not by swapping the colour to something else.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-MVR-01 | Budgets exist in several states | User views the chip row | Approaching-limit chip and its count badge use the warning colour; over-limit chip and its badge use the over-limit colour; all-budgets chip stays neutral | Happy path |
| S-MVR-02 | Same | User compares a chip to the rows it filters to | Chip colour matches the bar and caption colour of those rows exactly | ⚠️ Context #2 — one state, one colour |
| S-MVR-03 | Any chip | User selects it | It reads as selected while keeping its own status colour | Selection must not overwrite meaning |
| S-MVR-04 | Zero budgets are approaching their limit | User views the chip row | The chip is still shown, with a zero count, visibly de-emphasised | A chip that vanishes makes the row's width jump |
| S-MVR-05 | No budgets at all | User views the tab | Chips show zero counts and the existing empty message is shown | Empty state |
| S-MVR-06 | Budgets are still loading | — | The existing skeleton is shown; no chip row flashes with wrong counts | Loading state |
| S-MVR-07 | A date filter is applied | User views the chip row | Counts reflect the filtered window, and colours are unchanged | Colour is about state, not about range |

### Edge Cases
1. **A chip's colour and its count badge's colour never disagree** — they describe the same set.
2. **Selected and unselected must stay distinguishable for all three chips at once**, including when two of them carry saturated colours.
3. **Colour is never the only signal.** Each chip keeps its text label and its count, so the row is readable without colour vision.

### Definition of Done
- The approaching-limit and over-limit chips carry the same colours their matching rows already use; the all-budgets chip is neutral.
- Selection state is legible on every chip without replacing its status colour.
- Zero-count, empty and loading states are unchanged in behaviour and correct in appearance.

---

## US-02: Give every wizard proposal row a distinct identity colour

**As a** User,
**I want** a category I add to the plan to be a different colour from the ones already there,
**so that** I can tell my own row apart from the suggested ones in the bar and the list.

**Client:** mobile — AI Budget Wizard, result step

### Preconditions
- The wizard has produced a proposal and the result step is showing.

### Main Flow
1. System assigns each row in the proposal a colour from the shared palette, allocated across the whole visible set so no two rows collide.
2. The stacked bar above the list uses those same assignments, so a segment and its row are the same colour.
3. When the user adds a category, it is assigned a colour distinct from every row already present, from the same palette.
4. When a row is removed, its colour is released; the remaining rows keep theirs.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-MVR-08 | A proposal with several suggested rows | User views the result step | Every row has a distinct colour, and each bar segment matches its row | ⚠️ Context #3 — collision-free within the view |
| S-MVR-09 | Same | User adds a new category | The new row gets a colour used by none of the existing rows | The reported defect |
| S-MVR-10 | Same | User adds a category that exists but was not in the proposal | It gets a distinct colour like any other row | Added rows are not a special colour class |
| S-MVR-11 | A row is added then removed | — | The remaining rows' colours do not shift | Re-shuffling every colour on each edit makes the list unreadable |
| S-MVR-12 | More rows than the palette holds | User views the list | Colours are reused only after the palette is exhausted, and never for two adjacent rows | Graceful degradation |
| S-MVR-13 | The unallocated buffer | User views the bar | It stays rendered as a distinct non-category fill, never as a palette colour | ⚠️ Unchanged — the buffer is not a spending line |
| S-MVR-14 | The catch-all "other" row | User views the list | It gets a palette colour like any row, and stays ordered last | Ordering unchanged |

### Edge Cases
1. **A row's colour must be stable across re-renders of the same plan** — a colour that changes while the user is reading is worse than a duplicate.
2. **Colour is decorative here, not informational** — every row keeps its name and amount, so nothing is lost without it.
3. **The colour assignment is derived from the visible list only**, so it never depends on a placeholder identifier that exists purely because the category has not been created yet.

### Definition of Done
- No two rows in one proposal share a colour while the palette has unused entries.
- Bar segments and their rows always match.
- Adding and removing rows does not reshuffle the colours of untouched rows.

---

## US-03: Make the liquid-fill label readable at every fill level

**As a** User,
**I want** the figure inside the fill circle to stay readable as the fill rises past it,
**so that** the number I open the home screen to check is not the one I cannot read.

**Client:** mobile — Home snapshot

### Preconditions
- The home snapshot is showing.

### Main Flow
1. System renders the fill circle with its label and figure at the top.
2. Whatever the fill level and whatever colour the fill uses, the label and figure remain legible — against the dark unfilled area, against the light fill, and across the boundary where the wave crosses the text.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-MVR-15 | Fill is low, so the text sits entirely on the dark area | User reads the figure | Legible | Works today |
| S-MVR-16 | Fill is high, so the text sits entirely inside the fill | User reads the figure | Legible | ⚠️ The reported defect — currently light text on a light fill |
| S-MVR-17 | Fill is at a level where the wave crosses the text | User reads the figure | Legible across the whole line, including the crossing | ⚠️ The hardest case, and the one that rules out simply inverting the text colour by threshold |
| S-MVR-18 | The circle is drawn in a different fill colour | User reads the figure | Legible at every fill level in that colour too | The circle takes its colour from its caller; the fix must not assume one |
| S-MVR-19 | The wave is animating | User reads the figure | The figure does not flicker or shift as the wave moves under it | ⚠️ A per-frame contrast decision would strobe |
| S-MVR-20 | A very long figure | User reads it | It shrinks to fit on one line, as today, and stays legible | Existing behaviour preserved |
| S-MVR-21 | No budget is set, so the figure is a placeholder | User views the circle | Placeholder is legible under the same rules | Empty state |

### Edge Cases
1. **The fix must not obscure the fill.** The circle's point is showing a level; a treatment heavy enough to hide it trades one defect for another.
2. **Contrast must hold without depending on the fill's specific colour**, because the caller chooses it.
3. **Nothing about the figure's value, unit or formatting changes** — this is legibility only.

### Definition of Done
- The label and figure are legible at minimum fill, at maximum fill, and at every level in between, including where the wave crosses them.
- Legibility does not depend on which colour the fill is drawn in.
- No flicker while the wave animates, and the fill level remains visible.

---

## US-04: Remove any row from the wizard's proposal

**As a** User,
**I want** to remove a suggested category as well as one I added,
**so that** a plan that does not fit my life is something I can correct instead of work around.

**Client:** mobile — AI Budget Wizard, result step

### Preconditions
- The wizard has produced a proposal and the result step is showing.

### Main Flow
1. System offers a remove affordance on every proposal row, suggested or user-added alike.
2. User removes a row.
3. System drops the row from the list and from the bar, and returns its amount to the unallocated buffer — the same transfer a user-added row's removal already performs.
4. Every figure derived from the plan updates together: the bar, the buffer and the per-day allowance.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-MVR-22 | A proposal with suggested rows only | User removes one | It leaves the list and the bar; its amount returns to the buffer; the bar and buffer figures update together | ⚠️ Today this is impossible — the affordance exists only on user-added rows |
| S-MVR-23 | A proposal where the user added a row | User removes it | Unchanged from today's behaviour | Both kinds of row behave identically now |
| S-MVR-24 | The catch-all row | User removes it | Removable like any other row | It is the row most often not wanted |
| S-MVR-25 | The last remaining row | User removes it | The list is empty, the buffer holds the entire disposable amount, and an explanatory empty state invites adding a category | Empty state — must not be a blank panel |
| S-MVR-26 | Every row removed | User submits the plan | ⚠️ Submitting an empty plan is blocked, with a message saying at least one category is needed | ⚠️ **Financial-consistency marker** — confirming the wizard replaces the account's entire budget set, so an empty plan would silently wipe every existing budget |
| S-MVR-27 | A row whose amount the user had edited by hand | User removes it | Its full edited amount returns to the buffer, not the originally suggested one | The buffer must balance against what was actually allocated |
| S-MVR-28 | A row for a category that does not exist yet | User removes it | The row goes and the pending category goes with it; nothing is created on submit | ⚠️ A stray category must never be created for a row the user removed |
| S-MVR-29 | A removed row's category | User adds it back | It is available to add again, and gets a colour distinct from the current rows (US-02) | Removal is not permanent within the session |

### Edge Cases
1. **Removal takes effect locally only.** The wizard writes nothing before its final confirmation, so removing a row leaves the account untouched if the user backs out.
2. **The buffer can never go negative from a removal** — a removal only ever returns money to it.
3. **The remove affordance must not be reachable by the same tap that opens the row's amount editor.** Tapping a row to edit it is the common action; removing it is the rare one.

### Definition of Done
- Every row carries a remove affordance and removal returns its amount to the buffer.
- The bar, buffer and per-day allowance update together on every removal.
- An empty plan is blocked at submission with an explanatory message, never submitted.
- Removing a not-yet-created category leaves nothing behind.

---

## US-05: Keep the chosen categories when stepping back in the wizard

**As a** User,
**I want** to change an earlier answer without losing the categories I picked,
**so that** correcting my income does not cost me the plan I just built.

**Client:** mobile — AI Budget Wizard

### Preconditions
- The user is on the result step with a proposal on screen.

### Main Flow
1. User chooses to go back to an earlier step.
2. System asks whether to keep the current set of categories.
3. If the user keeps them, the system remembers **which categories are in the plan** — including ones the user added, and excluding ones the user removed — and nothing else about their amounts.
4. User changes their earlier answers and returns to the result step.
5. System requests a fresh proposal for the new answers, then reconciles it with the kept set: kept categories are present, removed ones stay absent, user-added ones are re-added.
6. Every amount is whatever the fresh proposal computes for the new inputs. No figure is carried over.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-MVR-30 | Result step with a proposal | User goes back | A dialog asks whether to keep the current categories, stating that amounts will be recalculated | ⚠️ Without the dialog the user cannot tell whether stepping back is safe |
| S-MVR-31 | Dialog shown | User keeps them, changes income, returns to the result step | The same categories are present; every amount reflects the new income | ⚠️ Context #4 — categories persist, amounts never do |
| S-MVR-32 | Dialog shown | User declines to keep them | The step-back proceeds and the next proposal is whatever the new answers produce, with no carry-over | Declining is a real option, not a disguised cancel |
| S-MVR-33 | Dialog shown | User cancels the dialog | Nothing happens; the user stays on the result step with the plan intact | Three outcomes, all distinct |
| S-MVR-34 | The user had removed a suggested row (US-04), then keeps and goes back | User returns to the result step | That category is still absent | ⚠️ A removal is a choice and must survive the round trip |
| S-MVR-35 | The user had added a category, then keeps and goes back | User returns to the result step | That category is present again, with a freshly computed amount | Including one that does not exist yet |
| S-MVR-36 | The user keeps, goes back, and picks a **different** spending profile | User returns to the result step | The new profile's own rows are shown; kept user-added categories are still re-added; kept/removed decisions about the previous profile's rows do not suppress rows the new profile introduces | ⚠️ A different profile is a different question — suppressing its rows with answers to the old one would silently overrule the choice just made |
| S-MVR-37 | The user keeps, goes back, and changes income such that nothing is left to spend | User returns to the result step | The existing over-committed warning is shown; categories are still present with whatever the allocator produced | Existing warning behaviour, unchanged |
| S-MVR-38 | The user keeps and goes back, and the fresh proposal fails | — | The existing error state with retry is shown; the kept set is not lost and is applied once a retry succeeds | Error state |
| S-MVR-39 | The user keeps and goes back, and the fresh proposal is still loading | — | The existing loading state is shown | Loading state |
| S-MVR-40 | Any point before the final confirmation | User closes the wizard entirely | Nothing is written; budgets and categories are exactly as they were | ⚠️ Unchanged and non-negotiable |

### Edge Cases
1. **No amount is ever restored, in any path.** Amounts are shares of a disposable figure the user is in the middle of changing; carrying one forward would show a number that does not follow from its own inputs.
2. **This is not the same as the saved-plan feature.** Saving a plan is an explicit, persistent choice the user makes for a future run; this is in-session continuity within one run, and neither writes to the other.
3. **Stepping back from the success screen remains impossible** — the plan has been written by then.
4. **Keeping categories must not resurrect a category the user removed**, which is the failure that would make the dialog worse than no dialog.

### Definition of Done
- Stepping back from the result step always asks first, with three distinct outcomes: keep, do not keep, cancel.
- Keeping preserves the category set including additions and removals, and preserves no amount.
- A changed profile still shows its own rows.
- Loading, error and over-committed states are unchanged.
- Nothing is written before the final confirmation.

---

## US-06: Finish the Vietnamese translation on Settings and Insights

**As a** User,
**I want** every label on these screens in Vietnamese,
**so that** the app does not switch language halfway through.

**Client:** mobile — Settings, Insights (screen title, tab labels, and the Spending tab's figures)

### Preconditions
- The user is on either screen.

### Main Flow
1. Every user-visible string on the Settings screen is Vietnamese — the navigation rows, the three summary card labels, and the sign-out action.
2. Every user-visible string on the Insights screen is Vietnamese — the screen title and both tab labels.
3. The abbreviated magnitude suffixes used on compact figures read as Vietnamese abbreviations rather than English ones, everywhere those figures appear.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-MVR-41 | User opens Settings | User reads the navigation rows | All Vietnamese; the row that is already Vietnamese is unchanged | |
| S-MVR-42 | User opens Settings | User reads the three summary cards and the sign-out action | All Vietnamese | |
| S-MVR-43 | User opens Settings with no display name available | User reads the identity block | The fallback name is Vietnamese | Empty/fallback state |
| S-MVR-44 | User opens Insights | User reads the title and both tab labels | All Vietnamese | ⚠️ These are the English strings visible above the Spending tab |
| S-MVR-45 | An Insights figure is large enough to be abbreviated | User reads it | The magnitude suffix is a Vietnamese abbreviation | Appears in the summary cards and at the centre of the chart |
| S-MVR-46 | The same abbreviation style is used elsewhere in the app | User reads those figures | They use the same Vietnamese suffixes | ⚠️ One abbreviation style app-wide, or the figures look like different units |
| S-MVR-47 | Any translated label | User reads it in the layout it sits in | It fits without truncation or wrapping into a second line where the layout allows only one | ⚠️ Vietnamese labels run longer than English ones |
| S-MVR-48 | A row hidden for a non-admin user | User is a member | It stays hidden, translated or not | Visibility rules unchanged |
| S-MVR-49 | A row that leads nowhere yet | User taps it | It stays inert, as today | Behaviour unchanged |

### Edge Cases
1. **Currency symbols and codes are not translated** — they are data, not copy.
2. **Nothing an identifier or a test hook depends on changes.** Only user-visible copy moves.
3. **The three summary card labels must stay short enough to fit three cards across a phone** after translation.

### Definition of Done
- No English user-visible string remains on Settings or Insights, including tab labels and the screen title.
- Compact magnitude suffixes are Vietnamese, and identical everywhere they appear.
- Every translated label fits its layout at the narrowest supported width.
- No navigation, visibility or behaviour changes.

---

## US-07: Present wallets as a stacked card carousel

**As a** User,
**I want** my wallets shown as a stack of cards I can flick through,
**so that** my main account is the thing I see, not one of five equal tiles.

**Client:** mobile — Home, wallets section

### Preconditions
- The home screen is showing and the user has at least one wallet.

### Main Flow
1. System renders the wallets as a horizontally overlapping stack rather than a flat row of separate cards.
2. The front card is fully visible and visually prominent, carrying the wallet's name and balance at full size.
3. Cards behind it are progressively offset to one side, partially covered, and progressively de-emphasised, so the stack reads as having depth.
4. User flicks horizontally to bring the next wallet to the front; the stack reorders with motion and settles on one card.
5. The front card's identity is unambiguous — the user can always tell which wallet's balance they are reading.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-MVR-50 | Several wallets | User views the home screen | One card is fully visible and prominent; the rest are layered behind it, offset and de-emphasised | Happy path |
| S-MVR-51 | Same | User flicks horizontally | The next wallet animates to the front and the stack settles on exactly one card | Never resting between two |
| S-MVR-52 | Exactly one wallet | User views the section | The single card renders correctly with no empty stack behind it and no flick affordance implying more | ⚠️ Minimum case |
| S-MVR-53 | Two wallets | User views the section | Depth is legible with only one card behind the front | Small-count case |
| S-MVR-54 | Many wallets | User views the section | The stack stays within its height, the offsets stay bounded, and every wallet is still reachable by flicking | ⚠️ Offsets must not accumulate off screen |
| S-MVR-55 | No wallets | User views the section | The existing add-wallet action is present with an explanatory empty state — no empty stack | Empty state |
| S-MVR-56 | Wallets are loading | — | A placeholder in the stack's own shape, not the old flat row's | Loading state |
| S-MVR-57 | A wallet with a long name or a large balance | User views it at the front | Both fit the card — name truncated if needed, balance shown in full or shrunk to fit, never clipped | ⚠️ A clipped balance is a wrong balance |
| S-MVR-58 | A wallet in a different currency from the others | User brings it to the front | Its own currency is shown; no total is implied across the stack | ⚠️ Currencies are never summed |
| S-MVR-59 | The stack | User scrolls the home screen vertically | The vertical scroll works normally and is not captured by the horizontal gesture | ⚠️ The section sits inside a vertically scrolling screen |
| S-MVR-60 | The section header | User taps the add-wallet action | It navigates as today | Behaviour unchanged |
| S-MVR-61 | The wallet count shown in the header | Wallets load | It matches the number of cards in the stack | Header and stack must agree |

### Edge Cases
1. **Every wallet must remain reachable.** A depth effect that buries the last card is a data-visibility bug, not a style choice.
2. **The balance on the front card is never abbreviated in a way that loses precision** beyond the app's existing shared formatting rules.
3. **The section's height stays fixed regardless of wallet count**, so the content below it does not shift as wallets load.
4. **Which wallet is at the front is presentation state only** — it is not remembered across navigation and it does not change any default-wallet setting.
5. **Motion must be skippable.** A fast flick through several wallets must not queue up animations the user then waits through.

### Definition of Done
- Wallets render as an overlapping stack with a prominent front card and progressively de-emphasised cards behind it.
- Horizontal flicking reorders the stack and settles on exactly one card; every wallet is reachable.
- One-wallet, two-wallet, many-wallet, empty and loading states all render correctly.
- Vertical scrolling of the home screen is unaffected.
- No balance is clipped and no cross-currency total is implied.

---

## US-08: Investigation — the income tab's period total reads zero

**As a** developer,
**I want** the reported "income tab shows zero" defect resolved one way or the other,
**so that** it is not re-reported or fixed by changing a figure that is correct.

**Client:** mobile — Transactions screen

### Finding

**The zero is correct. The figure is not the defect; the pairing is.**

The header's period summary describes **the current calendar month** whenever the user has applied no date filter — which is why it is labelled with the current month. The list beneath it is **not** restricted to that month; with no date filter it returns the user's transactions regardless of when they occurred. In the reported case the user's income transactions are dated in an earlier month, so the current month's income total is genuinely zero while the list below correctly shows earlier income rows.

Both numbers are right. Read together they are contradictory, and the screen offers nothing to explain why.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-MVR-62 | No date filter; the user's only income transactions are dated in a previous month | User selects the income tab | The period total shows zero for the current month while the list shows the earlier rows | ⚠️ The reported case — correct figures, contradictory reading |
| S-MVR-63 | Same | User reads the period summary | It is explicit that the figure covers the labelled period only, and that the list below is not limited to it | ⚠️ The minimal fix — a wording change, not a figure change |
| S-MVR-64 | A date filter is applied | User selects the income tab | The total covers the filtered range and the list covers the same range; the qualifier is not shown | With a filter the two already agree |
| S-MVR-65 | Income transactions exist in the current month | User selects the income tab | The total is non-zero and matches those transactions | Regression guard |
| S-MVR-66 | Any tab | User reads the tab's own trailing figure | It covers the same period as the header total, as today | Header and tab figures must not diverge |

### Edge Cases
1. **No figure changes.** Only the wording that says what the figure covers.
2. **The qualifier appears only when the list can reach outside the summarised period** — with an explicit date filter it would be noise.
3. **The alternative fix — defaulting the list to the current month — is deliberately not adopted.** The list's job is "everything, newest first"; silently hiding older transactions to make a header agree would trade a confusing screen for a lying one. See Open Questions #2.

### Definition of Done
- The period summary states which period it covers and that the list is not limited to it, when that can differ.
- No figure, filter default or query changes.
- With a date filter applied, the screen behaves exactly as it does today.

---

## Out of Scope

- **Any backend change.** No endpoint, query, table or business rule is touched by any item here.
- **Any change to a computed figure**, its unit, or its rounding — every number on screen keeps the value it has today.
- **Web (`frontend/`).** None of these screens or components exist there.
- **A general theming or dark/light mode system.** The app has one theme and these changes work within it.
- **A translation framework.** US-06 replaces strings in place; introducing a locale system is a separate decision.
- **Wizard changes beyond US-02, US-04 and US-05** — the flow, the steps, the allocator and the submission behaviour are unchanged.
- **Changing what the wallet cards show.** US-07 changes the presentation of the wallets section only; the fields on a card are as they are.
- **Swipe-gesture behaviour on the home screen and in chat** — owned by [Transaction Delete Guardrails](../transaction-delete-guardrails/spec.md).
- **Restoring saved wizard plans** — that feature exists and is untouched by US-05.

---

## Open Questions

1. **Should the liquid-fill label's readability be solved by a backdrop behind the text, or by rendering the text in two contrasting colours split at the fill line?** Both satisfy US-03. **Assumed: whichever holds contrast without depending on the fill's colour and without flickering as the wave animates (S-MVR-18, S-MVR-19)** — the acceptance criteria are stated as outcomes so the implementation can pick, but a per-frame contrast decision is ruled out.
2. **Should the Transactions list default to the summarised period instead of being unbounded?** That would make the header and list agree by construction and remove the need for US-08's qualifier — but it would hide older transactions by default on a screen whose purpose is to show them. **Assumed: no — the wording changes, the list does not.**
3. **How many wallets should the stack show before the ones behind stop being individually distinguishable?** **Assumed: the offsets are bounded so the stack never grows past its own width, and reachability by flicking is the guarantee rather than simultaneous visibility (S-MVR-54).** A specific visible-card cap has not been given.
4. **Should the "keep categories" dialog in US-05 remember the user's answer for the rest of the session?** **Assumed: no — it asks every time**, since the answer depends on what they are about to change. If stepping back proves frequent, a "don't ask again" is a later refinement.
5. **Which Vietnamese abbreviations should replace the magnitude suffixes on compact figures?** **Assumed: the conventional Vietnamese short forms, applied identically everywhere compact figures appear (S-MVR-46).** The exact characters are a copy decision, not a behavioural one.
