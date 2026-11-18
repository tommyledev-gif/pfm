# Test Cases: Feature-12 US-06 Spending Intentions, US-07 Delete a Failed Reply

**Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)

How to read the **Run** column:

- **Auto** — runs in CI-style commands, file and test named.
- **Smoke** — covered by the live end-to-end script run against a real Postgres (`e2e_intentions.py`, 28 checks, all passed on 2026-11-18; the script lives in the session scratchpad, not in the repo).
- **Manual** — a person on a device. `mobile/` has no unit-test harness (`docs/tech_stacks.md`), so every mobile UI case is manual. **None of the Manual cases has been run on a device yet.**

Commands: backend `GOTOOLCHAIN=go1.26.9 go test ./...` from `backend/` (`PFM_TEST_DATABASE_URL` set for the live repository tests); AI service `python -m pytest -q` from `ai-service/`; mobile `npx tsc --noEmit`, `npx eslint`, `node scripts/check-i18n.mjs` from `mobile/`.

## Test data

- **User A** — an active member with a default VND Wallet, a Category "Mua sắm" (expense) with a Budget of 2,000,000 (limit 200,000,000 xu), and an income Category "Lương".
- **User B** — another active member with a Category "Của B" (expense), used only for ownership cases.
- **History** — three completed cycles each with income 20,000,000 and spending 17,000,000 (surplus 3,000,000), unless a case says otherwise.
- **Now** — 14 October 2026, current cycle month `2026-10`, cycle start day 1.
- All test records are created fresh in the test; nothing edits shared seed data.

## Coverage Matrix

| Spec item | Cases |
|---|---|
| US-01 BR-01 model supplies only what the User said | TC-INT-01, TC-INT-27 |
| BR-02 non-intentions never become a card | TC-INT-28, TC-INT-29 |
| BR-03 weak Category dropped | TC-INT-05 |
| BR-04 monthly burden, A-04 payment from a total | TC-INT-06, TC-INT-07, TC-INT-08 |
| BR-05 surplus and what other intentions leave | TC-INT-03, TC-INT-04, TC-INT-09 |
| BR-06 Budget lines only for the current cycle | TC-INT-01, TC-INT-02 |
| BR-07 fit flags and shortfalls | TC-INT-01, TC-INT-03, TC-INT-04 |
| BR-08 counts toward the free-text limit | TC-INT-30 |
| EC-01…EC-07 | TC-INT-10, TC-INT-11, TC-INT-12, TC-INT-13, TC-INT-14, TC-INT-15 |
| US-02 BR-09…BR-14 field rules | TC-INT-16…TC-INT-24 |
| BR-15 cap | TC-INT-25 |
| BR-16 idempotent save | TC-INT-26, TC-INT-31, TC-INT-61 |
| BR-27 every plan weighed against the others | TC-INT-51, TC-INT-52, TC-INT-59 |
| BR-28 same Category shares one Budget | TC-INT-53, TC-INT-59 |
| BR-29 later month against usual spending | TC-INT-02, TC-INT-55 |
| BR-30 all plans together month by month | TC-INT-54, TC-INT-56, TC-INT-60, TC-INT-62 |
| EC-03, EC-04 unreadable and too many items | TC-INT-57, TC-INT-58, TC-INT-63 |
| EC-02 incomplete card, Save off | TC-INT-11, TC-INT-48 |
| BR-17 problems together | TC-INT-18 |
| US-03 BR-18…BR-22 list, edit, delete, ownership | TC-INT-32…TC-INT-40, TC-INT-49, TC-INT-50 |
| US-04 BR-23…BR-26 failed reply | TC-INT-41…TC-INT-47 |
| Auth (401) | TC-INT-40 |
| Rounding (A-07) | TC-INT-07, TC-INT-08, TC-INT-09 |
| Soft delete excluded from figures | TC-INT-36, TC-INT-33 |
| Concurrency on the same card | TC-INT-31 |

## US-01 Understand an intention (backend + AI service)

**TC-INT-01** · integration · service · *Propose a card with Budget and surplus figures* · P1 · **Auto** (`TestConsultIntention_ProposesWithFigures`, `TestIntentionAssess_BudgetAndSurplus`) · **Smoke**
- Pre: Budget 2,000,000 with 500,000 spent; surplus 3,000,000; reading "one-time, 2,000,000, this month, Category Mua sắm, confidence high".
- Steps: send the sentence through consult.
- Expected: reply kind `intention`; draft has no id and amount 200,000,000 xu; Budget remaining 150,000,000, `fits_budget` false, `short_budget` 50,000,000; surplus 300,000,000, `fits_surplus` true; nothing stored.

**TC-INT-02** · integration · service · *Later month weighs the Budget against usual spending* · P1 · **Auto** (`TestIntentionAssess_FutureMonthUsesUsualSpending`)
- Pre: as TC-INT-01, reading month `2026-11`.
- Expected: the Budget line has basis `usual` (Category usually spends 1,200,000), remaining 800,000, `fits_budget` false, short by 1,200,000; `assessed_month` `2026-11`; `fits_surplus` present. With no history: basis `limit`, no `left`, no verdict (`TestIntentionAssess_FutureMonthWithoutHistoryShowsTheLimitOnly`).

**TC-INT-03** · integration · service · *Instalment burden against the surplus* · P1 · **Auto** (`TestIntentionAssess_InstalmentBurden`)
- Pre: surplus 1,000,000; instalment 1,500,000 × 12.
- Expected: burden 1,500,000, total 18,000,000, `fits_surplus` false, `short_surplus` 500,000.

**TC-INT-04** · integration · service · *Other kept intentions come off the surplus* · P1 · **Auto** (`TestIntentionAssess_OtherIntentionsOfTheMonth`, `TestIntentionAssess_OtherPlannedByMonth`)
- Pre: surplus 2,000,000; another intention of 800,000 in the same month.
- Expected: `other_planned` 80,000,000 xu; `headroom` 120,000,000; a 1,500,000 plan is short by 30,000,000; an instalment counts in each month of its run only, a one-time plan in its own month only.

**TC-INT-05** · integration · service · *Weak Category match is dropped* · P2 · **Auto** (`TestConsultIntention_WeakCategoryIsDropped`)
- Pre: confidence 0.4.
- Expected: draft has no Category and `assessment.budget` is absent.

**TC-INT-06** · integration · service · *No price still proposes a card* · P2 · **Auto** (`TestConsultIntention_NoPriceStillProposes`, `TestIntention_Create_OneTimeWithoutPrice`)
- Expected: no amount, no `monthly_burden`, no fit flags; surplus still present.

**TC-INT-07** · unit · service · *Payment from a total divides exactly* · P1 · **Auto** (`TestIntention_Create_InstallmentPaymentRoundsUp/divides_exactly`) · **Smoke**
- Steps: total 18,000,000, 12 months.
- Expected: payment 1,500,000.

**TC-INT-08** · unit · service · *Payment from a total rounds up onto the step* · P1 · **Auto** (`…/1.666.667_rounds_up_to_1.700.000`, `…/small_step_under_1.000.000`)
- Steps: total 10,000,000, 6 months; total 300,000, 4 months.
- Expected: 1,700,000 (not 1,666,667) and 75,000; payments × months is never below the total.

**TC-INT-09** · unit · service · *Surplus rounds down on its step* · P1 · **Auto** (`TestIntentionAssess_SurplusRoundsDown`)
- Pre: income 12,345,678, spending 9,876,543.
- Expected: averages 12,300,000 and 9,900,000; surplus 2,400,000, an exact multiple of the 100,000 step.

**TC-INT-10** · integration · service · *Past month moves to the current cycle* · P2 · **Auto** (`TestConsultIntention_PastMonthMovesToCurrent`)
- Expected: `target_month` `2026-10`, `month_moved` true.

**TC-INT-11** · integration · service · *Instalment without a month count is shown incomplete* · P2 · **Auto** (`TestConsultIntention_InstalmentWithoutMonthsIsIncomplete`)
- Expected: card returned with no months and no payment; a reading of 100 months leaves the count empty.

**TC-INT-12** · integration · service · *Absurd amount is unusable* · P2 · **Auto** (`TestConsultIntention_UnreadableItemsAreSkipped`)
- Expected: reply kind `unsupported`, no card.

**TC-INT-13** · integration · service · *Rest of the sentence is flagged* · P3 · **Auto** (`TestConsultIntention_TooManyItemsAreTruncated`; AI service `test_naming_more_than_allowed_is_flagged`)
- Expected: `rest_not_read` true on the reply and on the mapped plan.

**TC-INT-14** · integration · service · *No wallet still gives a card* · P3 · **Auto** (`TestIntention_Create_Currency`, `TestIntentionAssess_NoHistory`)
- Expected: an intention is kept in VND with no Wallet; surplus and Budget lines are absent.

**TC-INT-15** · e2e · mobile · *Offline send keeps the typed text* · P2 · **Manual**
- Steps: airplane mode, type an intention sentence, send.
- Expected: the connection notice shows; the text stays in the box; no card.

**TC-INT-27** · unit · ai-service · *The model's output carries only what the User said* · P1 · **Auto** (`test_each_thing_named_becomes_its_own_plan_in_order`, `test_the_tool_schema_is_inlined_and_lists_the_items`)
- Expected: no derived figure; flat schema with the intention fields.

**TC-INT-28** · unit · ai-service · *A Category the model was never shown, or an income Category, is dropped* · P1 · **Auto** (`test_a_category_the_model_was_never_shown_is_dropped_with_its_confidence`, `test_an_income_category_is_not_a_plan_category`)

**TC-INT-29** · unit · ai-service · *No title is not a plan; a question or a record is not an intention* · P1 · **Auto** (`test_nothing_usable_is_not_a_plan`, `test_the_prompt_asks_for_one_entry_per_thing_and_keeps_questions_and_records_out`; backend `TestConsultIntention_Unusable`)
- Expected: kind `unsupported`, coverage `partial`. The prompt names the scenario and the record cases as not intentions.
- Note: how the live model classifies real sentences is **not** measured here; see Risks.

**TC-INT-30** · integration · handler · *Reading counts toward the free-text limit* · P2 · **Auto** (the route and its limiter are unchanged; limiter tests in `internal/middleware`)
- Expected: an intention sentence is limited exactly like any consult question; chips and `/query` are unaffected.

## US-02 Keep an intention (backend)

**TC-INT-16** · integration · service · *Title is required and capped* · P1 · **Auto** (`TestIntention_Create_CollectsEveryProblem`, `TestIntention_Create_Boundaries`) · **Smoke**
- Boundaries: empty and whitespace → `title` `required`; 80 characters accepted; 81 refused (`max`, enforced by the handler tag and the service).

**TC-INT-17** · integration · service · *One-time purchase carries no instalment fields* · P1 · **Auto** (`TestIntention_Create_OneTimeRejectsInstalmentFields`)
- Expected: `monthly_amount` and `installment_months` both `not_allowed`.

**TC-INT-18** · integration · service · *Independent problems are reported together* · P1 · **Auto** (`TestIntention_Create_CollectsEveryProblem`)
- Steps: empty title, instalment, no months, amount above the cap, malformed month.
- Expected: one 400 `INVALID_INPUT` listing `title`, `installment_months`, `total_amount`, `target_month`; nothing kept.

**TC-INT-19** · integration · service · *Instalment month count bounds* · P1 · **Auto** (`TestIntention_Create_Boundaries`; missing count in `TestIntention_Create_CollectsEveryProblem`)
- Boundaries: 1 → `range`; 2 and 60 accepted; 61 → `range`; missing → `required`.

**TC-INT-20** · integration · service · *Amount bounds* · P1 · **Auto** (`TestIntention_Create_Boundaries`; the table's own checks in `TestLiveSpendingIntentionChecks`)
- Boundaries: 0 refused (handler `min=1`); 1 xu accepted; cap accepted; cap + 1 → `range`. No float anywhere on the path.

**TC-INT-21** · integration · service · *Instalment keeps what was stated* · P1 · **Auto** (`TestIntention_Create_InstallmentKeepsWhatIsStated`)
- Expected: payment alone gives total = payment × months; both stated stay as stated.

**TC-INT-22** · integration · service · *Month window* · P1 · **Auto** (`TestIntention_Create_MonthWindow`, `TestIntention_Create_Boundaries`) · **Smoke**
- Boundaries: `2026-09` → `past`; `2026-10` accepted; `2029-10` (36 months ahead) accepted; `2029-11` → `too_far`; `2026/12` → `format`.

**TC-INT-23** · integration · service · *Category rules* · P1 · **Auto** (`TestIntention_Create_Category`) · **Smoke**
- Expected: income Category → 400; User B's Category → 403 `CATEGORY_ACCESS_DENIED`; unknown id → 404 `CATEGORY_NOT_FOUND`; nothing kept in any case.

**TC-INT-24** · integration · service · *Currency* · P2 · **Auto** (`TestIntention_Create_Currency`)
- Expected: an empty currency is the default Wallet's; a currency the User holds no Wallet in → 400 with `currency` `unknown`.

**TC-INT-25** · integration · service · *Cap* · P1 · **Auto** (`TestIntention_Create_Cap`)
- Steps: keep the maximum (50), save one more.
- Expected: 409 `SPENDING_INTENTION_LIMIT_REACHED`; a repeated save of an already-kept card still answers 200.

**TC-INT-26** · integration · service · *Saving the same card twice keeps one* · P1 · **Auto** (`TestIntention_Create_IsIdempotent`) · **Smoke**
- Expected: first 201, second 200 with the same id; one row.

**TC-INT-31** · integration · repository · *Two saves of one card race* · P1 · **Auto** (`TestLiveSpendingIntentionKey`; `TestIntention_Create_IsIdempotent` for the lookup path)
- Expected: the unique index refuses the second insert (`ErrIntentionKeyTaken`), the service answers with the row the first kept. A saved-then-deleted card answers 410 `SPENDING_INTENTION_DELETED` (`TestIntention_Create_SavedCardThatWasDeleted`, Smoke).

**TC-INT-48** · e2e · mobile · *Save is off for an incomplete card* · P2 · **Manual**
- Steps: send "niềng răng trả góp" (no months).
- Expected: the card shows the hint; Save is disabled; Edit opens the form with the instalment tab selected; after adding months and an amount, Save works.

## US-03 Review, edit, delete (backend + mobile)

**TC-INT-32** · integration · service · *List is soonest month first* · P2 · **Auto** (`TestIntention_List_SoonestMonthFirst`, `TestLiveSpendingIntentionLifecycle`) · **Smoke**

**TC-INT-33** · integration · service · *Edit replaces the set and recomputes* · P1 · **Auto** (`TestIntention_Update`) · **Smoke**
- Steps: 1,000,000 against 700,000 left → edit to 600,000.
- Expected: `fits_budget` goes false → true; `short_budget` disappears; a refused edit leaves the old values.

**TC-INT-34** · integration · service · *Edit validation* · P2 · **Auto** (`TestIntention_Update`)
- Expected: a one-month instalment is refused with the field named; nothing changes.

**TC-INT-35** · integration · repository · *Own rows only* · P1 · **Auto** (`TestIntention_UpdateAndDelete_OnlyOwn`, `TestLiveSpendingIntentionLifecycle`)
- Steps: User B reads, edits, deletes User A's intention.
- Expected: not found for all three (404 `SPENDING_INTENTION_NOT_FOUND`); A's row untouched; B's list is empty.

**TC-INT-36** · integration · service · *A deleted intention stops counting* · P1 · **Auto** (`TestIntentionAssess_DeleteStopsCounting`) · **Smoke**
- Expected: after delete, the other's `other_planned` is 0 and the list no longer shows it.

**TC-INT-37** · integration · service · *Delete twice* · P2 · **Auto** (`TestIntention_UpdateAndDelete_OnlyOwn`) · **Smoke**
- Expected: second delete 404 `SPENDING_INTENTION_NOT_FOUND`.

**TC-INT-38** · integration · service · *Overdue plan is assessed against this cycle* · P2 · **Auto** (`TestIntentionAssess_OverdueIsAssessedNow`)

**TC-INT-39** · e2e · mobile · *List sheet* · P1 · **Manual**
- Steps: open the chip above the analysis input; with none kept, then three kept.
- Expected: empty state with an add button; three rows with live figures, soonest first; tap a row opens the form; the bin asks for confirmation naming the item with Delete and Keep; after delete the row disappears and the others' figures change.

**TC-INT-49** · e2e · mobile · *Card follows the kept intention* · P1 · **Manual**
- Steps: save a card; edit its amount from the list; delete it from another place.
- Expected: the card shows "saved" with the new figures after the edit; "deleted" after the delete; a card restored on another device shows the same.

**TC-INT-50** · e2e · mobile · *Offline* · P2 · **Manual**
- Steps: airplane mode, open the list; then, with the list loaded, go offline and tap Delete or Save.
- Expected: with no loaded list the sheet says a connection is needed and shows no rows; with a loaded list, Save and Delete show the connection notice and change nothing.

**TC-INT-40** · integration · handler · *Authentication* · P1 · **Smoke**
- Steps: call each of the four routes with no token.
- Expected: 401. Invalid, expired and absent tokens are covered by the existing `JWTAuth` tests (`internal/middleware/jwt_auth_test.go`, `jwt_auth_integration_test.go`); the group is mounted behind it in `routes.go`.

## US-04 Delete a failed reply (mobile)

**TC-INT-41** · e2e · mobile · *Hold menu deletes a failure reply (recording)* · P1 · **Manual**
- Steps: cause "could not process" (airplane mode, send), hold the reply, tap Delete.
- Expected: the row folds away, the neighbours close the gap; the user's message and any proposal stay.

**TC-INT-42** · e2e · mobile · *Swipe deletes a failure reply (recording)* · P1 · **Manual**
- Steps: swipe the reply, tap the revealed Delete.
- Expected: same as TC-INT-41; no confirmation dialog.

**TC-INT-43** · e2e · mobile · *Hold menu deletes a failure reply (analysis)* · P1 · **Manual**
- Steps: cause "could not answer this question", hold, Delete.
- Expected: it folds away; answers and chips elsewhere are untouched.

**TC-INT-44** · e2e · mobile · *Deleted reply stays deleted* · P1 · **Manual**
- Steps: delete, kill and reopen the app; sign out and in; sign in on another device.
- Expected: it never returns.

**TC-INT-45** · e2e · mobile · *Nothing else is deletable by this* · P1 · **Manual**
- Steps: hold a Transaction proposal, an analysis answer, an intention card, and the user's own bubble.
- Expected: no failure-style delete on the answer, the card or the user's bubble; the proposal keeps its own removal flow.

**TC-INT-46** · e2e · mobile · *Retry button goes with the reply* · P2 · **Manual**
- Steps: delete a failed reply that shows Retry.
- Expected: the reply and its button go; the user's message stays and can still be copied.

**TC-INT-47** · e2e · mobile · *Reduce Motion* · P3 · **Manual**
- Expected: the reply leaves at once without folding. Search never lists a deleted reply; a day left with only that reply shows no day label.

## Several plans weighed together (US-01 BR-27…BR-30)

**TC-INT-51** · integration · service · *Three items of one sentence are weighed against each other* · P1 · **Auto** (`TestConsultIntention_SeveralItemsAreWeighedTogether`)
- Pre: surplus 3,000,000; reading: instalment 1,500,000 × 12, perfume 1,000,000, shower gel with no price.
- Expected: three proposals in order; the perfume's `other_planned` is 1,500,000, the instalment's 1,000,000, the shower gel's 2,500,000 with no burden; nothing stored; one portfolio of 3 plans over 12 months, this month 2,500,000 planned and fitting, later months 1,500,000.

**TC-INT-52** · integration · service · *Kept intentions count against new proposals* · P1 · **Auto** (`TestConsultIntention_KeptIntentionsCountAgainstNewOnes`)
- Pre: 1,500,000 kept this month; new proposal 2,000,000; surplus 3,000,000.
- Expected: `other_planned` 1,500,000, `fits_surplus` false, short by 500,000; portfolio counts 2 plans and 3,500,000 this month, not fitting.

**TC-INT-53** · integration · service · *Plans in one Category share one Budget* · P1 · **Auto** (`TestIntentionAssess_SameCategoryPlansShareOneBudget`) · **Smoke**
- Pre: Budget 2,000,000 with 500,000 spent; perfume 1,000,000 and shoes 800,000 in it.
- Expected: each sees the other in `budget.other_planned`; the perfume has 700,000 left and is short by 300,000, though alone it would fit.

**TC-INT-54** · integration · service · *Portfolio month by month* · P1 · **Auto** (`TestIntentionPortfolio_MonthByMonth`) · **Smoke**
- Pre: surplus 3,000,000; perfume 1,000,000 this month and shoes 800,000 next month (both in a Budgeted Category); instalment 2,500,000 × 3.
- Expected: three months; October 3,500,000 planned, short by 500,000; November 3,300,000, short by 300,000; December 2,500,000, fitting, headroom 500,000 rounded down onto its step; October's Budget read from this cycle (500,000 left after 1,000,000 planned), November's from usual spending (200,000 left); December lists no Budget.

**TC-INT-55** · integration · service · *Later month without history shows the limit only* · P2 · **Auto** (`TestIntentionAssess_FutureMonthWithoutHistoryShowsTheLimitOnly`)

**TC-INT-56** · integration · service · *Deleted plans leave the portfolio; none means no portfolio* · P2 · **Auto** (`TestIntentionPortfolio_DeletedLeavesAndEmptyHasNone`)

**TC-INT-57** · integration · service · *Unreadable items are skipped and counted* · P2 · **Auto** (`TestConsultIntention_UnreadableItemsAreSkipped`)
- Expected: an absurd amount and a blank title are skipped (`skipped` 2), the readable item is proposed; with nothing readable the reply is `unsupported` and has no card.

**TC-INT-58** · integration · service · *Too many items are truncated* · P2 · **Auto** (`TestConsultIntention_TooManyItemsAreTruncated`)
- Steps: seven items read.
- Expected: five proposals and `truncated` true.

**TC-INT-59** · e2e · api · *Several plans against a real database* · P1 · **Smoke**
- Steps: with a Budget and a spend this cycle, keep an instalment, shoes and a second perfume in one Category, then read the list.
- Expected: portfolio of 3 plans, this month 330,000,000 xu planned, the Budget line weighs the whole Category (180,000,000 planned, basis `this_cycle`), twelve months for the instalment, later months on basis `usual` or `limit`.

**TC-INT-60** · e2e · mobile · *One card, several proposals* · P1 · **Manual**
- Steps: in the analysis mode send "niềng răng trả góp 12 tháng mỗi tháng 1tr5, mua nước hoa 1tr, mua sữa tắm".
- Expected: one reply with three proposals, each with its own Save, Edit, Discard; the all-together block under them lists the months with planned amounts and fit; nothing kept until Save.

**TC-INT-61** · e2e · mobile · *Save all* · P1 · **Manual**
- Steps: tap Save all with three complete proposals; repeat the tap; then repeat after failing the second save (airplane mode between).
- Expected: all three show as saved; no duplicates; after a partial failure the kept ones stay saved, the error is under the card, and Save all again keeps only the rest. An incomplete proposal is not saved by Save all.

**TC-INT-62** · e2e · mobile · *The card and the list stay in step* · P1 · **Manual**
- Steps: save the proposals; edit one amount from the list; delete another from its card.
- Expected: the saved proposals show the live figures; once all are settled the card's all-together block follows the live list; the list shows the same block above its rows when two or more plans exist.

**TC-INT-63** · e2e · mobile · *Truncated and skipped notices* · P3 · **Manual**
- Expected: a sentence naming more than five shows how many were read and says to send the rest separately; an unreadable item shows how many could not be read.

## Financial data rules

- Money is `BIGINT` xu end to end: `TestIntentionAssess_*` assert integer xu; the table's own `CHECK` constraints are exercised by `TestLiveSpendingIntentionChecks`; no `float` appears in the Go, Python or request path. The mobile form turns a typed amount into cents with the existing `toCents` helper, as the Budget form does.
- Soft delete: `deleted_at` is set by delete, every read filters it, and the key lookup alone includes deleted rows (`TestLiveSpendingIntentionKey`).
- No wallet balance or Transaction is ever written by this feature, so the atomic balance rules do not apply.
- Cross-user access is refused in every read, edit and delete (TC-INT-23, TC-INT-35).

## Not covered, and why

| Gap | Reason |
|---|---|
| Real classification of Vietnamese sentences by the live model | Needs the provider; the golden set (`tests/golden/analytics_intents.jsonl`) has no intention rows yet. Add at least 30 rows (with and without accents, shorthand, instalments, questions that must stay `scenario`, records that must stay `transaction_like`) before relying on it. |
| Mobile screens | No component-test harness in `mobile/`; Manual cases above. |
| Handler-level 400 shape for the new routes | Covered by Smoke only; no Go handler test was added. |
| Rate-limit exhaustion for intention sentences | Same limiter as every consult question; no new case. |
