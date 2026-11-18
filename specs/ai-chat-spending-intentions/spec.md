# Feature Spec: Feature-12 AI Chat Assistant — US-06 Plan an Intended Purchase via Chat, US-07 Delete a Failed Reply

> Source: `SRS.md` FR-09 (spending intentions paragraph), Feature-12 **US-06** and **US-07**. Requested by the product owner on 2026-11-18: keep what the User plans to buy ("braces on instalments", "perfume", "shower gel"), understand the context, weigh it against Budgets and actual spending with rounded figures, and let the User edit and delete it. Deleting failed replies was requested in the same message.
> Status: Draft — spec, plan and test cases written together.
> Related: [Feature-12 US-03 Query Spending](../ai-chat-query-spending/spec.md) (the analysis conversation this lives in, and the savings-goal plan whose rounding it reuses), [F-05 Budget Management](../budget-management/spec.md) (every Budget figure here must agree with it), [F-07 Financial Reporting](../financial-reporting/spec.md) (every spending figure must agree with it)

## Context

A User who is about to commit to a purchase ("braces on a 12-month plan", "a new perfume next month") has to open the Budgets screen, open Insights, subtract in their head, and remember what else they already promised themselves. The analysis conversation already answers questions about past spending and savings goals; it has no memory of what the User *plans* to spend.

Two requests drive this spec:

1. **Intentions.** The User writes a plan in everyday words. The System understands what it is, roughly how much, over how many months and from when, matches a Category when it can, and shows how the plan sits against the User's own Budget and usual monthly surplus. The User keeps the plan, edits it, or deletes it.
2. **Failed replies.** A reply that only says a request failed ("could not process this message") stays in the conversation forever. The User wants to delete it.

Design rules, in the same spirit as the analysis conversation:

1. **Understanding is separate from numbers.** The language model only reads the User's sentence into a few fields. Every figure on the card — what is left in a Budget, the usual surplus, whether the plan fits — is computed from the User's own records, never written by the model.
2. **Nothing is kept without the User saying so.** The cards are proposals until the User taps Save, like a Transaction proposal. The System never keeps an intention on its own.
3. **Facts, not advice.** The card compares numbers with limits the User set (their Budget) and with their own recorded history. It never says whether to buy, never praises and never warns in words that judge.
4. **Plans are weighed together, never one at a time.** A User rarely has one plan: braces on instalments, a perfume and a shower gel are all coming. Each plan is weighed against the others of the same month and the same Category, and everything planned is shown month by month against the User's usual income and spending and against each Budget it touches.
5. **A missing price is not a failure.** "Buy shower gel" is a real plan; the card shows what is left each month and asks for the price.

Actor: **User** — any authenticated `active` user (`admin` or `member`). All data is the caller's own.

Client scope: **mobile only.** The web client's chat is unchanged.

**Explicit assumptions (flagged per BA convention):**

1. **A-01 — One currency per intention.** An intention is in one currency: the one the User names, otherwise the currency of the default Wallet. Amounts in different currencies are never added together.
2. **A-02 — Months are spending cycles.** "This month" and "next month" mean the User's current and next spending cycle, the same cycles the Budgets screen uses. A User who never chose a cycle start day has cycles equal to calendar months.
3. **A-03 — An intention is planned in whole months.** A one-time purchase belongs to one month. An instalment plan starts in one month and takes one equal payment each month for a number of months. Weeks and days are not modelled.
4. **A-04 — The monthly burden is what one month pays.** For a one-time purchase it is the price; for an instalment plan it is the monthly payment. When the User gives only a total and a number of months, the monthly payment is the total divided by the months, rounded up, so the payments always cover the total.
5. **A-05 — "Usual surplus" is recent history.** It is the average monthly income minus the average monthly spending over the last completed cycles that had activity, the same baseline the savings-goal plan uses. With no such cycle there is no surplus figure.
6. **A-06 — Fits means the burden is not above what is left.** A plan fits the surplus when its monthly burden does not exceed the usual surplus left after the other plans of that month. It fits the Budget when it does not exceed what the Category's Budget leaves for that month after the other plans in the same Category (A-09 says what the Budget is weighed against).
7. **A-07 — Rounding direction never overstates what the User can afford.** Averages round to the nearest step; the surplus and what is left after other intentions round down; any shortfall rounds up; a monthly payment worked out from a total rounds up. Figures the User typed, and Budget limits, spending and remainders read from records, are shown exactly as they are.
8. **A-08 — Weighing plans together.** One sentence may name several things, up to a fixed number; each becomes its own proposal. Every plan is weighed against all the others in the same month (kept ones and the other proposals of the same sentence) and, when it has a Category with a Budget, against the others in the same Category, because they share one Budget. A plan's burden counts in each month it pays: a one-time plan in its own month, an instalment plan in each month of its run.
9. **A-09 — Which spending a Budget is weighed against.** In the current cycle a Budget is weighed against the real spending so far, exactly as the Budgets screen shows it. A later month has no real spending yet, so the Budget is weighed against what its Category usually spends (the average of the recent completed cycles). With no such history only the limit is shown, with no verdict.

## Preconditions (feature-level)

- Caller holds a valid access token and is `active`.
- The analysis conversation exists on the mobile chat screen (shipped).
- The device is online. Reading a sentence and saving an intention need a connection.

### Key Entities Involved

| Entity | How this feature uses it |
|---|---|
| Spending intention *(new)* | What the User plans to spend: title, one-time or instalments, amounts, months, starting month, optional Category, optional note. Soft-deleted when the User deletes it. |
| Category (F-04) | Optional link of an intention; the Budget lookup and the Category name shown on the card. Only expense Categories can be linked. |
| Budget (F-05) | Read-only source of the limit, spending and what is left for the linked Category in the current cycle. |
| Transaction (F-06) | Read-only source of the usual income and spending. Soft-deleted Transactions are excluded. |
| Wallet (F-03) | Decides the default currency. |
| Spending cycle (F-13.1) | Resolves the current and later months. |
| Chat thread message (Feature-12) | Stores the intention card, its saved state, and whether a failed reply was deleted. |

⚠️ **Money rule:** every amount is integer cents (VND xu) with integer-only arithmetic, never a float, and is shown through the app's shared currency formatting. Clients never derive a new amount; every figure on a card is computed by the System. Rounding follows A-07.

⚠️ **Timestamps:** stored in UTC; month boundaries are computed in the app's timezone; the starting month is shown as a local month.

---

## US-01: Understand an intention from a chat message

**As a** User,
**I want** to write what I plan to buy in everyday words and see how it fits my Budget and my spending,
**so that** I know where I stand before committing.

**API:** free-text consult request (`POST /analytics/consult`, the existing endpoint; a new reply kind).

### Preconditions
- The User is in the analysis conversation and the free-text limit is not reached.

### Main Flow
1. User sends a message that describes something they intend to buy or pay in instalments.
2. System reads the message into one item per thing it names (up to a fixed number): for each a short title, one-time or instalments, the amounts, the number of months, the starting month, and a Category match with its confidence.
3. System checks the reading: amounts are positive, instalments have a month count, the starting month is not in the past.
4. System computes each item's figures, and the figures of all of them together with what is already kept, from the User's own records (BR-04…BR-07, BR-27…BR-30).
5. System shows one card with a proposal per item, each with Save, Edit and Discard, and a Save-all action when several can be saved.

### Business Rules
- **BR-01** — Only the User's sentence is read by the language model; no figure on the card comes from it except the amounts and months the User stated.
- **BR-02** — A message about spending that already happened, a question, a savings goal or a Transaction to record is never turned into an intention.
- **BR-03** — A Category match below medium confidence is dropped; the card then shows no Category and the Budget lines are absent. A match at medium or high confidence is shown by name.
- **BR-04** — The monthly burden follows A-04. A plan with no price has no burden and no fit verdict.
- **BR-05** — The card shows the usual surplus and what is left after the other kept intentions of the same month (A-05, A-07), or says there is not enough history.
- **BR-06** — When the plan has a Category with a Budget in the plan's currency, the card shows that Budget's limit, what is spent or usually spent, and what is left, with the current cycle read exactly as the Budgets screen shows it (BR-29).
- **BR-07** — The card states whether the monthly burden fits the surplus and whether it fits the Budget (A-06), and by how much it falls short when it does not. It never states advice.
- **BR-08** — Reading a sentence counts toward the same free-text limit as any other typed question.
- **BR-27** — Every item is weighed against all the other plans of its month: the intentions already kept and the other items of the same sentence. An item with no price still sees what the others take.
- **BR-28** — Items in the same Category are weighed against one Budget: what the others in that Category take is counted before the verdict.
- **BR-29** — The current cycle's Budget is read as the Budgets screen shows it; a later month's Budget is weighed against the Category's usual spending (A-09).
- **BR-30** — Below the proposals, when at least two plans exist, the card shows all of them together month by month: what is planned, whether it fits the usual surplus, and for each Budget touched what is planned in its Category against it. Only months that pay something are listed.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-INT-01 | A "Shopping" Budget of 2,000,000 with 500,000 spent this cycle; usual surplus 3,000,000 | User sends "tháng này mua nước hoa khoảng 2tr" | The card shows the title, 2,000,000, this month and "Shopping"<br>and the Budget line shows 1,500,000 left<br>and the card states the plan does not fit the Budget, short by 500,000<br>and it states the plan fits the surplus | BR-06, BR-07 |
| S-INT-02 | Same data; "Shopping" usually spends 1,200,000 a month | User sends "tháng sau mua nước hoa khoảng 2tr" | The card shows next month<br>and the Budget line is weighed against the usual 1,200,000, leaving 800,000<br>and states the plan does not fit the Budget, short by 1,200,000<br>and it states fit against the surplus | BR-06, BR-29, A-09 |
| S-INT-03 | Usual surplus 1,000,000; no other intentions | User sends "niềng răng trả góp 12 tháng mỗi tháng 1tr5" | The card shows 12 payments of 1,500,000<br>and states the monthly burden does not fit the surplus, short by 500,000 | A-04, BR-07 |
| S-INT-04 | None | User sends "niềng răng trả góp 12 tháng tổng 18tr" | The monthly payment is 1,500,000 | A-04, divides exactly |
| S-INT-05 | None | User sends "laptop trả góp 6 tháng tổng 10tr" | The monthly payment is 1,700,000, not 1,666,667 | A-04, rounded up onto a step so six payments cover the total |
| S-INT-06 | None | User sends "mua sữa tắm" | The card shows the title and no amount<br>and says the price is missing<br>and still shows the surplus and, when it applies, the Budget remainder | BR-04 |
| S-INT-07 | Another kept intention takes 800,000 in the same month; surplus 2,000,000 | User sends "mua giày 1tr5" | What is left after other intentions is 1,200,000<br>and the plan does not fit it, short by 300,000 | BR-05 |
| S-INT-08 | No completed cycle has activity | User sends "mua giày 1tr5" | The card says there is not enough history for a surplus<br>and shows no fit line against the surplus | A-05 |
| S-INT-09 | Category match is weak | User sends "mua cái này 500k" | The card shows no Category<br>and no Budget line | BR-03 |
| S-INT-10 | None | User sends "hôm qua mua giày 500k" | No intention card; the reply says the message looks like a Transaction to record and offers the recording mode | BR-02 |
| S-INT-11 | None | User sends "niềng răng trả góp" | The card shows the title as an instalment plan with no months<br>and asks for the missing months and amount in the edit form | EC-02 |
| S-INT-12 | Free-text limit reached | User sends an intention | The usual limit notice with the starter questions | BR-08 |
| S-INT-43 | Surplus 3,000,000 | User sends "niềng răng trả góp 12 tháng mỗi tháng 1tr5, mua nước hoa 1tr, mua sữa tắm" | Three proposals appear in one card, in the order said<br>and the perfume's figures count the instalment's 1,500,000 as planned that month<br>and the instalment's figures count the perfume's 1,000,000<br>and the shower gel, with no price, still shows what the others take<br>and nothing is kept | BR-27 |
| S-INT-44 | The same three proposals | The card is shown | A block under them lists each month that pays something: 2,500,000 planned this month, 1,500,000 in each of the following eleven<br>and each month states whether it fits the 3,000,000 surplus | BR-30 |
| S-INT-45 | Budget of 2,000,000 with 500,000 spent; two plans in "Shopping" of 1,000,000 and 800,000 | User sends both in one sentence | Each shows what the other takes in its Category<br>and the perfume (1,000,000) is short by 300,000 against the 1,500,000 left once the 800,000 is counted<br>and the portfolio line for the Budget counts 1,800,000 against it | BR-28 |
| S-INT-46 | Intentions of 1,500,000 already kept this month; surplus 3,000,000 | User sends a new plan of 2,000,000 | The new proposal counts the kept 1,500,000 and does not fit, short by 500,000<br>and the portfolio counts 3,500,000 this month | BR-27 |
| S-INT-47 | The sentence names more items than one message takes | User sends it | Only the first items become proposals<br>and the card says how many were read and that the rest should be sent separately | EC-04 |
| S-INT-48 | One item has no name or an absurd amount, the others are fine | User sends the sentence | The readable items become proposals<br>and the card says how many could not be read | EC-03, EC-04 |
| S-INT-49 | Three complete proposals | User taps Save all | All three are kept<br>and each shows as saved<br>and tapping again keeps no duplicate | BR-16 |
| S-INT-50 | Save all, the second save fails | User taps Save all | The first stays kept and shows as saved<br>and the failure is shown under the card<br>and tapping Save all again keeps only the ones not yet kept | BR-16, EC-08 |
| S-INT-13 | The reading service is down | User sends an intention | The usual "could not read it" reply; nothing is kept | |

### Edge Cases
1. **EC-01** — **A starting month in the past** ("tháng trước") — the card uses the current cycle and says so; it never plans into a closed cycle.
2. **EC-02** — **An instalment with no month count** — never invented; the card is shown incomplete and Save is disabled until the User completes it in the edit form.
3. **EC-03** — **An absurd amount** (above the supported maximum) — treated as not understood, with no card.
4. **EC-04** — **Several items in one sentence** — each becomes its own proposal, up to the number one message takes. Beyond that the first ones are proposed and the card says how many were read, so no part of the sentence is silently dropped. An item that cannot be read is skipped and counted, and the others are unaffected.
5. **EC-05** — **User with no Wallet** — the card still shows; amount lines work, the surplus and Budget lines are absent.
6. **EC-06** — **The Category was deleted** between the reading and the card — the card shows no Category.
7. **EC-07** — **Offline** — the message is not sent; the usual connection notice shows and the typed text stays in the box.

### UI states
- **Loading:** the typing indicator, as for any analysis question.
- **Success:** one card with a proposal per item (title, amount or "no price", month, Category, the figure lines, the fit lines, Save, Edit, Discard), Save all, and the all-together block.
- **Empty figures:** the lines that cannot be computed are left out, with one line saying why (no history, no price).
- **Error:** the usual reply with the starter questions.

### Definition of Done
- Every scenario above holds against a fixture dataset, and every figure equals what Reports and Budgets show for the same data.
- Rounding follows A-07 in every scenario with a worked-out figure.
- No amount on the card is produced by the language model.
- Messages that are not intentions never produce a card.

### Idempotency
Read-only. The same sentence over unchanged data gives the same figures.

---

## US-02: Keep an intention

**As a** User,
**I want** to keep an intention I just read,
**so that** it counts when I weigh my next purchase.

**API:** create a spending intention (`POST /spending-intentions`).

### Preconditions
- An intention card is on screen, or the User opened the new-intention form from the list.

### Main Flow
1. User taps Save (or completes the form and saves).
2. System validates the intention against the rules below.
3. System keeps it and returns it with figures computed now.
4. The card turns into a saved intention showing the live figures.

### Business Rules
- **BR-09** — A title is required, up to the supported length.
- **BR-10** — A one-time purchase has an optional price and no month count or monthly payment.
- **BR-11** — An instalment plan has a month count and a total, a monthly payment, or both; the missing one is worked out (A-04). When both are given, both are kept as stated.
- **BR-12** — Every amount is above zero and not above the supported maximum.
- **BR-13** — A linked Category must be visible to the User and be an expense Category.
- **BR-14** — The starting month is not before the current cycle's month and not further ahead than the supported horizon.
- **BR-15** — A User keeps at most a fixed number of intentions; one more is refused.
- **BR-16** — Saving the same card twice keeps one intention (⚠️ idempotent).
- **BR-17** — Independent field problems are reported together, not one at a time.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-INT-14 | A valid card | User taps Save | The intention is kept<br>and the card shows "saved" with live figures | |
| S-INT-15 | A card already saved | User taps Save again, or the request is repeated | Still one intention | BR-16 |
| S-INT-16 | A one-time card with no price | User taps Save | Kept without a price | BR-10 |
| S-INT-17 | An instalment card with total and months only | User taps Save | Kept with the monthly payment worked out | BR-11, A-04 |
| S-INT-18 | An instalment card with no month count | User taps Save | Refused with the field named | BR-11, EC-02 |
| S-INT-19 | A title longer than allowed, and an amount of zero | User taps Save | Both problems are shown together | BR-17 |
| S-INT-20 | A Category that is an income Category | User taps Save | Refused with the field named | BR-13 |
| S-INT-21 | A Category owned by another User | Save is requested | Refused as no access, never as an empty result | ⚠️ cross-user |
| S-INT-22 | A starting month in the past | Save is requested | Refused with the field named | BR-14 |
| S-INT-23 | The User already keeps the maximum | User taps Save | Refused with a message that says the limit and what to do | BR-15 |
| S-INT-24 | The device is offline | User taps Save | Nothing is kept; the connection notice shows and the card stays unsaved | EC-08 |
| S-INT-25 | Not signed in | Save is requested | Rejected as unauthenticated | |

### Edge Cases
1. **EC-08** — **The save fails after the tap** — the card stays unsaved with an error that says nothing was kept; tapping Save again is safe (BR-16).
2. **EC-09** — **The User discards a card** — it shows as discarded and nothing was ever kept.
3. **EC-10** — **A card restored from history** after the intention was deleted elsewhere — it shows as deleted.
4. **EC-11** — **Two devices save the same card at once** — one intention.
5. **EC-12** — **Amounts at the maximum** — accepted without overflow in any worked-out figure.

### UI states
- **Loading:** Save shows progress and is disabled.
- **Success:** "saved" state with Edit and Delete.
- **Error:** the error under the card, per field where possible.

### Definition of Done
- Every rule has a passing case; the cross-user case is refused with no data.
- Saving twice keeps one intention.
- No amount is stored or computed with a float.

### Idempotency
⚠️ Save carries one key per card; a repeated save returns the intention already kept. Edit and delete are safe to repeat.

---

## US-03: Review, edit and delete kept intentions

**As a** User,
**I want** a list of my intentions with live figures, and to edit or delete any of them,
**so that** my plans stay current.

**API:** list `GET /spending-intentions`, edit `PUT /spending-intentions/:id`, delete `DELETE /spending-intentions/:id`.

### Preconditions
- The User is in the analysis conversation.

### Main Flow
1. User opens the list of intentions from the analysis input.
2. System shows each intention with its amount, month and live fit lines, soonest first.
3. User opens one to edit it, or deletes it.
4. System validates and applies the change, and every figure recomputes.

### Business Rules
- **BR-18** — The list always shows live figures; a saved card in the conversation shows the same live figures while the intention exists.
- **BR-19** — An edit replaces the whole editable set under the same rules as saving (BR-09…BR-14, BR-17).
- **BR-20** — Deleting asks for confirmation naming the intention, and cannot be undone from the app.
- **BR-21** — A deleted intention stops counting in the figures of every other intention at once.
- **BR-22** — A User can only read, edit or delete their own intentions; another User's is refused as not found or no access, never as an empty result.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-INT-26 | Three intentions | User opens the list | The all-together block shows the months and their fit<br>and three rows follow, soonest month first, each with its live fit lines | BR-18, BR-30 |
| S-INT-27 | No intentions | User opens the list | An empty state with a button to add one | |
| S-INT-28 | One intention of 1,000,000 with 700,000 left | User edits the amount to 600,000 | The list and its card now show 600,000 and that it fits | BR-18 |
| S-INT-29 | Two intentions in one month | User deletes one | The other's "left after other intentions" figure rises at once | BR-21 |
| S-INT-30 | An intention | User taps Delete | A confirmation names the intention and offers Delete and Keep | BR-20 |
| S-INT-31 | The User confirms the delete | The delete completes | The row and its card show as deleted | |
| S-INT-32 | Another User's intention id | Edit or delete is requested | Refused; nothing changes | ⚠️ BR-22 |
| S-INT-33 | An intention already deleted | Delete is requested again | Reported as not found; the list is unchanged | |
| S-INT-34 | An edit with an invalid month count | User saves | Refused with the field named; the old values stay | BR-19 |
| S-INT-35 | The device is offline | User opens the list | The list says a connection is needed and shows no rows<br>and edit and delete are unavailable | Figures are never shown from an old read: they are private and change with every transaction |

### Edge Cases
1. **EC-13** — **An intention whose month has passed** — it stays listed and is assessed against the current cycle, so an overdue plan is never hidden.
2. **EC-14** — **The linked Category was deleted** — the row shows no Category and no Budget line; the plan itself is untouched.
3. **EC-15** — **The Budget for the Category was deleted** — the Budget lines disappear; nothing else changes.
4. **EC-16** — **Edit and delete race on two devices** — the later one is told the intention is gone.
5. **EC-17** — **Long titles and many rows** — rows truncate; the list scrolls.

### UI states
- **Loading:** a skeleton of rows.
- **Empty:** no intentions, with an add button.
- **Success:** rows with amount, month, fit lines.
- **Error:** a retry line; offline says a connection is needed.

### Definition of Done
- List, edit and delete all work and recompute every figure.
- A deleted intention is gone from the list, its card and other intentions' figures.
- Cross-user access is refused.

### Idempotency
Edit with the same values changes nothing. Deleting a deleted intention is reported, never an error screen.

---

## US-04: Delete a failed reply

**As a** User,
**I want** to delete the assistant's "could not process" replies,
**so that** failed attempts do not stay in my conversation.

**API:** none new — the deletion is part of the chat thread the app already syncs.

### Preconditions
- A reply that only reports a failure is in the recording or the analysis conversation.

### Main Flow
1. User holds the reply, or swipes it in the recording conversation.
2. User taps Delete.
3. The reply folds away and leaves the conversation.

### Business Rules
- **BR-23** — A failure reply is any reply that only says a request failed, was busy, hit a limit, had no connection or was not understood. A Transaction proposal, an answer, an intention card and the User's own message are never deletable by this.
- **BR-24** — Deleting needs no second confirmation: the held menu or revealed button is the confirmation.
- **BR-25** — A deleted reply stays deleted after a restart and after the conversation is restored on another device.
- **BR-26** — Deleting a reply never changes the User's message before it or any proposal.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-INT-36 | A "could not process this message" reply in recording | User holds it and taps Delete | It folds away and is gone | BR-23, BR-24 |
| S-INT-37 | The same reply | User swipes it and taps Delete | It folds away and is gone | |
| S-INT-38 | A "could not answer this question" reply in analysis | User holds it and taps Delete | It folds away and is gone | |
| S-INT-39 | A deleted reply | The app restarts, or the User signs in on another device | It does not come back | BR-25 |
| S-INT-40 | A Transaction proposal card | User holds it | Delete here means the proposal's own removal flow, unchanged | BR-23 |
| S-INT-41 | A failed reply with a Retry button | User deletes it | The reply and its Retry button go; the User's message stays | BR-26 |
| S-INT-42 | Reduce Motion is on | User deletes a reply | It leaves at once without folding | |

### Edge Cases
1. **EC-18** — **Deleting while an answer is still loading** — allowed; it does not interrupt the pending answer.
2. **EC-19** — **A failure reply from an older app version** that carries only text — still deletable when it offers a retry or a manual-entry action.
3. **EC-20** — **Searching the conversation** never lists a deleted reply.
4. **EC-21** — **A day with only a deleted reply** shows no empty day label.

### UI states
- **Success:** the row folds away; the rows around it close the gap.
- **Reduce Motion:** the row leaves at once.

### Definition of Done
- Both conversations can delete failure replies and nothing else.
- A deleted reply never returns after restart or restore.

### Idempotency
Deleting a deleted reply is a no-op.

---

## Out of Scope

1. **Web client (`frontend/`).**
2. **Advice** — whether to buy, how much to cut, when to buy; the card states figures only.
3. **Reminders and notifications** for an intention's month.
4. **Turning an intention into a Transaction or a Budget** when it is done — the User records the Transaction as usual.
5. **Marking an intention as done or paid** — the User deletes it.
6. **Interest, fees or inflation** on instalments — equal payments only.
7. **Projections beyond the plan's own months** and comparisons across several future months.
8. **More items from one message than the maximum**, and a limit that grows with the User's plan.
9. **Offline use** of reading or saving.
10. **Restoring a deleted intention.**

## Open Questions

1. **Instalment starting month** — default is the current cycle's month; confirm whether the first payment usually falls next month.
2. **Maximum kept intentions** — a fixed cap is proposed to bound the list; confirm the number.
3. **Surplus baseline length** — three completed cycles is reused from the savings-goal plan; confirm it suits short plans.
4. **Usual spending basis** — a later month's Budget is weighed against what its Category usually spends over the recent completed cycles (A-09). Confirm that is the right stand-in for spending that has not happened yet.
5. **Deleted failure replies** — kept hidden in the conversation record rather than removed, so the deletion survives restore; confirm hidden-but-stored is acceptable.
