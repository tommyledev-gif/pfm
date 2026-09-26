# Feature Spec: Feature-12 AI Chat Assistant — US-03 Query Spending via Chat

> Source: `SRS.md` FR-09, BF-10 (step 2 "direct answer (spending query)"), Feature-12 **US-03 Query Spending via Chat [MVP]**. Design brief: `docs/new-tasks.md` Part II, question group **Q** (§II.3.1, §II.4, §II.7, §II.8, §II.13). The brief's working name "F-14" is **not** a feature id — this is Feature-12.
> Status: Draft — spec + plan may proceed; **implementation is blocked** until F-13.1 US-03 (spending cycle window) ships. See Dependencies.
> Related: [Feature-12 US-01 Create via Chat](../ai-chat-assistant/spec.md) (same chat surface), [F-07 Financial Reporting](../financial-reporting/spec.md) (every figure here must agree with it), [F-05 Budget Management](../budget-management/spec.md) (remaining-budget answers must agree with it), [F-13.1 AI Budget Wizard v2](../ai-budget-wizard-v2/spec.md) (owns the spending cycle definition and the three-tier Category class)

## Context

A User who wants to know "how much have I spent this month" or "where did my money go" today has to leave the chat, open Insights, and set filters. SRS Feature-12 US-03 asks for the same answer by simply asking in the chat.

The hard requirement is not understanding the question — it is **never showing a wrong number the User will believe**. A plausible-looking total that silently ignored half the question ("how much on food this month" answered with total spending) is worse than no answer, because the User acts on it. Every design choice below follows from that:

1. **Figures never come from the language model.** The System first turns the question into a structured request, then computes the figures from the User's own records. The model only interprets; it never calculates or writes numbers.
2. **The User chooses the chat mode.** The chat surface already has a mode picker (record a Transaction / set up a Budget / ask for analysis). Questions are only interpreted as spending questions while analysis mode is selected, so a Transaction the User meant to record can never be silently answered as a question, and vice versa.
3. **Most questions need no interpretation at all.** Suggestion chips and follow-up chips carry a complete, pre-built request, so they are answered directly, instantly, and do not count toward any usage limit. Free text is the fallback, not the main path.
4. **Periods follow the User's spending cycle**, not the calendar month, so "this month" in chat means the same days as the Budgets screen.

Actor: **User** — any authenticated `active` user (`admin` or `member`). All data is the caller's own.

Client scope: **mobile only.** The web client's chat keeps its current behavior (Out of Scope #1).

**Explicit assumptions (flagged per BA convention):**

1. **A-01 — Primary currency.** Each answer covers exactly one currency: the currency of the User's default Wallet, unless the question names a Wallet, in which case that Wallet's currency. Amounts in different currencies are never added together.
2. **A-02 — "Month" means spending cycle.** Words like "this month" / "last month" resolve to the current / previous spending cycle as defined by F-13.1 US-03. A User who never chose a cycle start day has cycles equal to calendar months.
3. **A-03 — Average per day** divides by the number of days in the period **that have at least one expense**, and the answer states that day count, so the figure is never presented as a per-calendar-day average.
4. **A-04 — Single-turn interpretation.** Each free-text question is interpreted on its own; earlier messages are never used to fill in missing parts (US-04 replaces that need with follow-up chips).

## Preconditions (feature-level)

- Caller holds a valid access token and is `active`.
- F-13.1 US-03 is shipped: the System can resolve "current cycle", "previous cycle" and "last N cycles" for a User, with day boundaries in the app's timezone.
- The chat mode picker exists on the mobile chat screen (shipped; analysis mode currently shown disabled).

### Key Entities Involved

| Entity | How this feature uses it |
|---|---|
| Transaction (F-06) | Read-only source of every figure. Soft-deleted Transactions are always excluded. |
| Wallet (F-03) | Determines currency; can be a breakdown dimension or a filter. |
| Category (F-04) | Breakdown dimension or filter; free-text Category mentions are matched to the User's own Categories. |
| Budget (F-05) | Read-only source for remaining-budget answers. |
| Spending cycle (F-13.1) | Resolves every named period. |
| Chat thread message (Feature-12) | Stores each question and its answer so the conversation can be restored. |
| Question log *(new)* | One record per free-text question: how it was interpreted, by which path, and how long it took. Never shown to Users. |

⚠️ **Money rule:** every amount is computed from integer cents (VND xu) with integer-only arithmetic, and transmitted as an exact integer value, the same way every other amount in the app is transmitted; clients never divide, average or otherwise derive new amounts from it — every figure shown is computed by the System. Display follows the existing currency formatting of the app. Averages round half-up to the nearest whole xu. Percentages are shown rounded to the nearest whole percent.

⚠️ **Timestamps:** stored in UTC; every period boundary is computed in the app's timezone; displayed dates are local.

### Dependencies

| Dependency | Why it blocks |
|---|---|
| F-13.1 US-03 spending cycle window | Without it, "this month" is a UTC calendar month and remaining-budget answers would disagree with the Budgets screen. Blocks implementation, not this spec or its plan. |
| Verification of the AI provider's token accounting (`docs/new-tasks.md` §II.1.3) | Determines whether free-text interpretation is cheap enough to offer at the planned limit. Blocks US-03 implementation only; US-01, US-02, US-04, US-06 work without free text. |

---

## US-01: Analysis mode and starter suggestions

**As a** User,
**I want** to switch the chat into analysis mode and see ready-made questions,
**so that** I can check my spending in one tap without knowing what to type.

**API:** none new — client-side mode, reuses the answer request from US-02.

### Preconditions
- User is on the chat screen.

### Main Flow
1. User opens the mode picker and selects analysis mode.
2. System marks the analysis mode as active in the header and changes the input placeholder to a question prompt.
3. System shows a row of starter suggestion chips above the input, each a complete question (e.g. total spending this cycle, where the money went, remaining budget, income this cycle).
4. User taps a chip.
5. System posts the chip's question as a User message and answers it per US-02.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-AIQ-01 | Analysis mode is available | User opens the mode picker | Analysis mode is selectable (no longer disabled) | |
| S-AIQ-02 | User selects analysis mode | Mode changes | The header shows analysis mode<br>and the placeholder asks for a question<br>and starter chips appear | |
| S-AIQ-03 | Analysis mode active | User taps a starter chip | The chip text appears as a User message<br>and an answer follows (US-02) | No free-text interpretation happens |
| S-AIQ-04 | Analysis mode active | User switches to record-Transaction mode | Starter chips disappear<br>and the next message is treated as a Transaction description | Mode never leaks between messages |
| S-AIQ-05 | User reopens the app later | Chat screen opens | Mode is back to the default (record a Transaction) | Existing non-persisted mode behavior |

### Edge Cases
1. **EC-01** — **Starter chips while a previous answer is still loading** — chips are disabled until the pending answer resolves, so two answers never interleave.
2. **EC-02** — **User has no Wallet** — chips still show; every answer is the empty state of US-02 with a hint to create a Wallet.
3. **EC-03** — **Offline** — tapping a chip shows the same connection error state as other chat messages, with retry.

### Definition of Done
- Analysis mode is selectable and visually distinct in the header.
- Starter chips appear only in analysis mode and each produces a correct US-02 answer.
- Switching modes changes how the very next message is handled, verified for all three modes.

### Idempotency
Read-only. Tapping a chip twice produces two identical answers; no financial data changes.

---

## US-02: Answer a spending question with the User's own figures

**As a** User,
**I want** an answer built from my own recorded Transactions, with a short summary and a matching chart,
**so that** I can trust it as much as the Reports screen.

**API:** read-only analytics answer request (`POST /analytics/query`).

### Preconditions
- A complete, structured question exists (from a chip, a follow-up chip, or US-03).

### Main Flow
1. System validates the request shape; an invalid request is a validation error (4xx).
2. System checks that every Wallet and Category referenced belongs to the User.
3. System resolves the period (cycle-based, A-02) and the currency (A-01).
4. System computes the figures from the User's non-deleted Transactions (or Budgets, for remaining budget).
5. System returns: a one-sentence summary built from a fixed template, a chart of the type matching the question, the period covered, the currency, the number of Transactions counted, any notices, and follow-up chips (US-04).
6. Client renders the answer as an assistant message.

### Supported questions

Question IDs follow the design brief; Q7 (keyword search) is Out of Scope #4.


| # | Question kind | Example (as a User might ask) | Visual |
|---|---|---|---|
| Q1 | Total spending in a period | "How much did I spend this month" | Single figure |
| Q2 | Spending breakdown by Category | "Where did my money go" | Proportion breakdown |
| Q3 | Spending per cycle over several cycles | "How was my spending over the last 6 months" | Bars |
| Q4 | One Category, two periods compared | "Food this month vs last month" | Paired bars + change |
| Q5 | Largest Transactions | "My 5 biggest expenses this month" | Ranked list |
| Q6 | Transactions above an amount | "Expenses over 1 million this week" | Ranked list |
| Q8 | Spending breakdown by Wallet | "Which wallet did I spend most from" | Bars |
| Q9 | Remaining budget | "How much budget do I have left" | Progress per Budget |
| Q10 | Total income in a period | "Income this month" | Single figure |
| Q11 | Average spending per day | "How much do I spend per day" | Single figure + daily line |
| Q12 | One Category's trend over cycles | "Food over the last 6 months" | Line |
| Q13 | Spending by weekday | "Which day do I spend the most" | Weekday view |
| Q14 | Single largest expense | "Biggest expense this month" | Single card |

Supported periods: current cycle, previous cycle, last 3 cycles, last 6 cycles, last 30 days, this week, and an explicit date range.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-AIQ-06 | User spent a known total this cycle | Asks Q1 | The summary states exactly that total<br>and it equals Insights' total for the same days | ⚠️ Must match Reports exactly |
| S-AIQ-07 | Food spending in current and previous cycle | Asks Q4 for Food | Both totals are shown<br>and the change as a whole percent | SRS US-03 scenario 2 |
| S-AIQ-08 | Previous period has zero spending | Asks Q4 | Both totals are shown<br>and the change reads "no spending in the previous period" instead of a percentage | Never divide by zero |
| S-AIQ-09 | User has Budgets | Asks Q9 | Each Budget's remaining amount equals the Budgets screen's figure at the same moment | ⚠️ Must match Budgets exactly |
| S-AIQ-10 | Cycle start day is 5 | A Transaction dated the 3rd | It counts toward the previous cycle | Cycle rule |
| S-AIQ-11 | Cycle start day is 1 | A Transaction at 00:30 local time on the 1st | It counts toward the new cycle | Timezone rule |
| S-AIQ-12 | User has VND and USD Wallets | Asks Q1 | Only the default Wallet's currency is totalled<br>and a notice names the other currency present | A-01 |
| S-AIQ-13 | 26 of 30 days have expenses | Asks Q11 | Average = total ÷ 26<br>and the summary says "across 26 days with spending" | A-03 |
| S-AIQ-14 | No Transactions in the period | Asks any question | Empty-state message naming the period<br>and no chart | Empty state |
| S-AIQ-15 | Request references another User's Category or Wallet | Request is sent | Rejected as access denied (4xx)<br>and nothing is computed | Never a silent empty result |
| S-AIQ-16 | Request has an unknown question kind or period | Request is sent | Rejected as invalid input (4xx) | Validation error |
| S-AIQ-17 | Stored data temporarily unreachable | Any question | System error (5xx)<br>and the chat shows an error bubble with retry | System error |
| S-AIQ-18 | A Transaction was soft-deleted | Asks Q1 | The deleted Transaction is not counted | Soft delete |

### Edge Cases
1. **EC-04** — **Periods not yet complete** (current cycle, this week) are labelled as "so far", never projected forward.
2. **EC-05** — **Q5/Q6 list length** is bounded; when more Transactions match than are shown, the answer says how many matched in total.
3. **EC-06** — **Q9 with no Budgets** → empty state with a hint to set up a Budget; not an error.
4. **EC-07** — **Q3/Q12 when the User has fewer cycles of history than asked** → only the available cycles are shown, and the summary says how many.
5. **EC-08** — **Q13 in a period shorter than one week** → still answered, with a notice that the period is too short to show a pattern.
6. **EC-09** — **Income questions (Q10) never include expense Transactions and vice versa**; transfers between Wallets are not a Transaction type today and so never appear.
7. **EC-10** — **Category breakdown with many small Categories** → the smallest are grouped as "Other" in the visual, but the total is unchanged.

### UI states
- **Loading:** the existing typing indicator shows while the answer is computed.
- **Success:** summary sentence, chart, period label (with dates), currency, Transaction count, notices, follow-up chips.
- **Empty:** message naming the period; no chart; follow-up chips still offered.
- **Error:** error bubble with retry; a validation error explains the question could not be answered.

### Definition of Done
- Every question kind in the table returns correct figures against a fixture dataset.
- Q1 and Q4 answers equal the Reports figures for the same window; Q9 equals the Budgets screen — automated comparison tests.
- Cycle and timezone scenarios (S-AIQ-10, S-AIQ-11) pass.
- Cross-user references return access denied; no scenario returns another User's data.
- No AI interpretation happens anywhere in this story — figures come only from recorded data.

### Idempotency
Read-only. The same question over unchanged data always returns the same figures.

---

## US-03: Ask a spending question in free text

**As a** User,
**I want** to type my question in everyday Vietnamese, including without accents or with common shorthand,
**so that** I am not limited to the suggestion chips.

**API:** free-text consult request (`POST /analytics/consult` — see `plan.md` F3 for why not under `/ai`).

### Preconditions
- Analysis mode is active.
- The User has not reached the free-text usage limit (US-05).

### Main Flow
1. User types a question and sends it.
2. System cleans the text (spacing, case, accents, common shorthand, amount shorthand such as "50k" or "1tr5", informal period words such as "dạo này").
3. System interprets the text into one structured question from US-02's catalog, choosing only among the User's own Categories and Wallets.
4. System rates its confidence in each Category match.
5. If the interpretation covers the whole question, System answers it per US-02.
6. For Category matches: high confidence → answer directly; medium confidence → answer and show a banner naming the Categories used, with a "Change" action; low confidence → do not answer, ask the User to pick the Category from a list.
7. System records the question in the question log (US-06).

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-AIQ-19 | Analysis mode | User types "tháng này tiêu bao nhiêu" | Answered as Q1 for the current cycle | |
| S-AIQ-20 | Analysis mode | User types "thang nay tieu bao nhieu cho an uong" (no accents) | Answered as Q1 filtered to the Food Category | Accentless input |
| S-AIQ-21 | Analysis mode | User types "thang nay tiu bn" | Answered as Q1 | Shorthand |
| S-AIQ-22 | Analysis mode | User types "chi trên 50k tuần này" | Answered as Q6 with a 50,000đ threshold | "k" after a digit = thousand |
| S-AIQ-23 | Analysis mode | User types "k biết tháng này tiêu bao nhiêu" | "k" is read as "not", not as an amount<br>and answered as Q1 | Shorthand ambiguity |
| S-AIQ-24 | Question names a Category the System is only moderately sure about | Answered | A banner names the Categories used<br>and offers "Change" | |
| S-AIQ-25 | "Change" tapped | User picks other Categories | The answer is recomputed with the chosen Categories<br>and no usage limit is consumed | Behaves like a follow-up chip |
| S-AIQ-26 | Category match has low confidence | Question sent | No figures are shown<br>and the System asks "Which Category do you mean?" with the User's Categories as choices | Never guess |
| S-AIQ-27 | Question is "tháng này tiêu bao nhiêu cho ăn uống" | Interpreted | The answer is **never** the unfiltered total | ⚠️ Partial-understanding guard |
| S-AIQ-28 | Question is out of scope, e.g. "what should I invest in", "any unusual spending", "which subscriptions am I paying", "compared with other people", "how much will I have left at the end of the month" | Question sent | A short message says this cannot be answered yet<br>and two alternative chips are offered<br>and no figures are shown | Not supported in this release |
| S-AIQ-29 | Question depends on earlier context, e.g. "còn tháng trước?" | Question sent | A message asks for the full question<br>and offers follow-up chips from the previous answer if there is one | A-04 |
| S-AIQ-30 | Question is an evaluation or what-if ("tháng này tiêu nhiều không", "cắt cafe 50% thì sao") | Question sent | A message says evaluations and what-if scenarios are coming later<br>and offers the closest supported question as a chip | Covered by later US-04 / US-05 of Feature-12 |
| S-AIQ-31 | Question is a Transaction description ("cafe 50k") while in analysis mode | Question sent | Treated as a question that cannot be answered<br>and a chip offers switching to record-Transaction mode | No Transaction is ever created from analysis mode |
| S-AIQ-32 | Empty or over-length text | User sends | Rejected as invalid input (4xx) before interpretation | Validation error |

### Edge Cases
1. **EC-11** — ⚠️ **Any part of the question not covered by the interpretation** (an unmatched Category, an extra condition) means the System must not answer from the covered part alone — it either asks for clarification or says it cannot answer.
2. **EC-12** — **Interpretation names a Category or Wallet the User does not own** → rejected as access denied (4xx), never silently dropped from the filter.
3. **EC-13** — **Periods the System cannot resolve** (e.g. relative to a lunar holiday: "từ Tết tới giờ") → treated as out of scope with a chip for the nearest supported period.
4. **EC-14** — **User with many Categories** → matching considers the User's most-used Categories over recent cycles plus all Categories named explicitly; a Category outside that set can still be picked from the low-confidence list.
5. **EC-15** — **Personal pronouns and filler words** ("tôi", "mình", "t") are ignored; every question is about the logged-in User.
6. **EC-16** — **Very slow interpretation** → times out and follows the US-05 degradation path instead of hanging.

### UI states
- **Loading:** typing indicator.
- **Success:** US-02 answer, optionally with the Category banner.
- **Clarification:** Category picker message.
- **Unsupported:** short explanation + alternative chips.
- **Error:** error bubble with retry.

### Definition of Done
- A labelled set of at least 100 Vietnamese questions (with accents, without accents, shorthand, misspellings, vague periods, evaluation-vs-query boundary, unsupported) is committed, and interpretation is measured against it by comparing the structured question, never the wording of the answer.
- S-AIQ-27 passes: no partial-understanding answer across the whole set.
- Out-of-scope, context-dependent and evaluation/what-if questions never show figures.
- Recording Transactions via chat has no regression (the existing chat test set still passes).

### Idempotency
No financial data is written. A repeated question is answered again and logged again.

---

## US-04: Follow-up chips instead of conversation memory

**As a** User,
**I want** each answer to offer the natural next questions as one-tap chips,
**so that** I can dig deeper ("compare with last month", "show Food in detail") without typing a follow-up the System cannot understand.

**API:** reuses US-02's answer request.

### Preconditions
- An answer from US-02 is on screen.

### Main Flow
1. System attaches up to a few follow-up chips to every answer, each a complete question derived from the current one with one thing changed (period, Category, comparison, breakdown dimension).
2. User taps a follow-up chip.
3. System answers it per US-02.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-AIQ-33 | A Q2 answer for this cycle | User taps "Compare with last cycle" | A comparison answer for both cycles appears | |
| S-AIQ-34 | A Q2 answer | User taps a Category segment or its chip | A Q12 trend answer for that Category appears | Drill-down |
| S-AIQ-35 | User taps any follow-up chip | Answered | The free-text usage count is unchanged | Chips never count toward the limit |
| S-AIQ-36 | A follow-up chip refers to a Category that was deleted since the answer | User taps it | The answer is computed without error, or explains that the Category no longer exists | Soft delete |

### Edge Cases
1. **EC-17** — **Old answers restored from history** keep working chips; if a referenced Wallet or Category no longer exists, the chip still answers with a clear notice rather than failing silently.
2. **EC-18** — **Chips never repeat the current question.**
3. **EC-19** — **An empty-state answer** still offers follow-ups (e.g. a longer period).

### Definition of Done
- Every question kind offers at least one follow-up chip, and every chip produces a valid US-02 answer.
- Follow-up chips never trigger free-text interpretation and never consume the free-text limit.

### Idempotency
Read-only.

---

## US-05: Fair usage limit that never blocks recording Transactions

**As a** User,
**I want** asking questions to never stop me from recording a Transaction,
**so that** heavy use of analysis does not break the main thing I use the chat for.

**API:** free-text consult request (US-03) carries its own limit; recording via chat keeps its existing limit.

### Preconditions
- None.

### Main Flow
1. System counts only free-text questions (US-03) toward an hourly per-User limit that is separate from the existing limit on recording Transactions via chat.
2. When the limit is reached, System answers the free-text message with a notice that free-text questions are paused for now, and offers the starter chips — which keep working.
3. When the interpretation service is unavailable or too slow, System answers with a notice that free-text questions are temporarily unavailable, offers the starter chips, and does not retry repeatedly.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-AIQ-37 | User has asked free-text questions up to the limit | User switches to record-Transaction mode and describes an expense | The Transaction proposal is returned normally | ⚠️ Recording must never be blocked by analysis use |
| S-AIQ-38 | Free-text limit reached | User sends another free-text question | Limit notice (4xx, rate limited)<br>and starter chips are offered | |
| S-AIQ-39 | Free-text limit reached | User taps a chip | Answered normally | Chips are not limited |
| S-AIQ-40 | Interpretation service is down | User sends a free-text question | "Free-text questions are temporarily unavailable" notice<br>and starter chips<br>and no repeated retries | System error path (5xx upstream), degraded not broken |
| S-AIQ-41 | Interpretation service times out | User sends a free-text question | Same as S-AIQ-40, within a bounded wait | |

### Edge Cases
1. **EC-20** — **The notice never shows a countdown** tied to the AI provider — provider limits are shared across all Users, so a countdown would be wrong for most of them.
2. **EC-21** — **Limit counts per User**, never shared between Users.
3. **EC-22** — **Rejected-for-validation messages** (S-AIQ-32) do not count toward the limit.

### Definition of Done
- Automated test: exhausting the free-text limit leaves recording via chat fully functional.
- Chips and follow-ups work with the limit exhausted and with the interpretation service down.

### Idempotency
Not applicable — no writes beyond the question log.

---

## US-06: Answers stay in the chat history

**As a** User,
**I want** past answers and their charts to still be there when I come back or change phones,
**so that** the chat reads as one continuous conversation.

**API:** reuses the existing chat-thread sync.

### Preconditions
- An answer has been shown.

### Main Flow
1. System stores each answer (summary, chart data, period, currency, notices, follow-up chips) as part of the chat thread, the same way Transaction proposals are stored today.
2. When the thread is restored, the client redraws each answer from the stored data.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-AIQ-42 | User received answers | User logs out and back in on a new device | The answers reappear with their charts | |
| S-AIQ-43 | A stored answer uses a chart kind this app version does not know | Thread is restored | The answer is shown as a plain list of its figures | Never a blank or crash |
| S-AIQ-44 | A stored answer | Shown later | It is labelled with the period it covered, so an old figure is never mistaken for a current one | |

### Edge Cases
1. **EC-23** — **Stored answers are never recomputed** on restore — they reflect the data at the time they were asked, labelled by period.
2. **EC-24** — **Answer content never includes Transaction notes** — only amounts, dates, Category and Wallet names.
3. **EC-25** — **A User clearing the chat thread** removes the stored answers with it (existing thread behavior).

### Definition of Done
- Answers survive a reinstall/new-device restore.
- An unknown chart kind renders as a list, verified with a crafted stored message.

### Idempotency
Stored per chat message identifier; re-syncing the same message does not duplicate it (existing thread-sync behavior).

---

## US-07: Question log with limited retention

**As the** System,
**I want** each free-text question and how it was handled to be recorded for a limited time,
**so that** interpretation quality, chip usage and cost can be measured from real use instead of guesses.

**API:** none — written internally during US-03.

### Preconditions
- A free-text question was received.

### Main Flow
1. System records: the User, the cleaned text, the original text, the structured question produced, how it was produced, the confidence, the time taken, and the AI usage counts.
2. System clears the original text after a limited retention period; the cleaned text is kept longer, then deleted.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-AIQ-45 | A free-text question | Answered | One log record exists for it | |
| S-AIQ-46 | A log record older than the original-text retention period | Retention job runs | Its original text is cleared<br>and the rest of the record remains | Privacy |
| S-AIQ-47 | Any User | Uses the app | No screen or endpoint exposes the question log | Owner-only access, outside the app |
| S-AIQ-48 | A question is logged | Application logs are written | The question text does not appear in application logs | Sensitive data rule |

### Edge Cases
1. **EC-26** — **Logging failure never fails the answer** — the User still gets the answer; the failure is recorded as an error.
2. **EC-27** — **Chip and follow-up answers are not logged here** (they involve no interpretation); their usage is measured separately if needed.
3. **EC-28** — **A deactivated User's log records** follow the same retention; they are never exposed.

### Definition of Done
- Log record written for every free-text question; retention clearing verified by test.
- Question text absent from application logs.

### Idempotency
Append-only; one record per received free-text question.

---

## Out of Scope

1. **Web client (`frontend/`)** — analysis mode is mobile-only in this release.
2. **Evaluation questions** ("am I spending too much") — Feature-12 US-04, separate spec.
3. **What-if scenarios** ("if I cut coffee by 50%", "when can I afford a laptop") — new Feature-12 US-05, to be added to the SRS before its spec.
4. **Keyword search on Transaction notes** ("how much on Grab") — notes are free text with no merchant field, so totals would be silently incomplete.
5. **Conversation memory** — follow-ups via chips only (A-04).
6. **Projections, anomaly detection, subscription detection, peer comparison, investment advice.**
7. **Lunar-calendar periods.**
8. **Applying the new text cleaning to recording Transactions via chat** — that flow is left unchanged to avoid regressions.
9. **Choosing Category cut classes** — owned by the What-if spec.

## Open Questions

1. **Free-text hourly limit** — the brief proposes 20 per hour per User; this is a placeholder to be tuned from the question log after about two weeks of real use.
2. **Retention periods** — the brief proposes 30 days for original text and 12 months for cleaned text. Confirm.
3. **Starter chip set** — which 3–4 questions appear first. Proposal: Q1, Q2, Q9, Q10.
4. **Currency switch** — should a User with several currencies get a chip to re-ask in another currency (A-01)? Proposal: yes, as a follow-up chip.
5. **Consult-mode availability before cycle window ships** — confirm the mode stays disabled until F-13.1 US-03 is live, rather than shipping calendar-month answers first.
