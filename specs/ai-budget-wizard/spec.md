# Feature Spec: F-13 AI Budget Setup Wizard (Release 1)

> Source: `SRS.md` FR-10 / Feature-13 / BF-11 (added 2026-08-22), `SDS.md` §2 Domain Model (Budget/ChatMessage notes) / §3.2 UI/UX Principles ("Multi-step guided flows") / §5.13 (US-13-01) / §6 API Design / §7 Threat Modeling / §9 Design Decisions (all added 2026-08-22), `docs/ai-chat-budget-recommendation.md` (original user-authored draft — this spec restructures that draft into the project's standard spec format; that draft remains the fuller worked example for UI copy/layout)
> Status: Draft — highest-priority next feature per `docs/features.md` (2026-08-22 run), user-directed
> Related: [F-05 Budget Management](../budget-management/spec.md) (this feature's `POST /budgets/bulk` reuses its validation/ownership rules and its `budgets`/`budget_limits` schema — does not replace anything in that spec), [F-04 Category Management](../category-management/spec.md) (Category selection, and the optional custom-category-creation sub-step), [Feature-12 AI Chat Assistant](../ai-chat-assistant/spec.md) (natural-language trigger reuses its chat plumbing and its "AI Service is untrusted input" authorization rule)

## Context

Budget Management (F-05) lets a User create one Budget at a time — pick a Category, type a currency limit, submit. Setting up a full spending plan across 5–10 Categories means repeating that one-at-a-time flow that many times, with no help deciding *how much* to put where relative to income.

This feature adds a guided, AI-assisted setup flow inside the AI Chat surface: the User states their income and, for each Category they want to budget for, a rough spending preference ("a little", "normal", "a lot", or "let the AI decide"). The System proposes a concrete amount per Category using a fixed, deterministic allocation formula — not open-ended AI generation — the User reviews and can adjust any amount, and a single confirmation creates every Budget at once, replacing whatever Budgets the User had before.

Actor: **User** — any authenticated `active` user (`role = admin` or `member`); this is a personal setup flow, not an admin capability.

**Explicit assumption (flagged per BA convention):** the proposed-allocation step is **rule-based, not an LLM call, and computed entirely in the Go Backend** — a fixed formula (preference → weight, Category → baseline share of income), with no call out to the AI Service at all for this step. This keeps proposals deterministic, free, instant, and immune to AI Service downtime. The AI Service is invoked for real LLM generation in exactly one, optional sub-step: suggesting a display name/icon for a Category the User described in free text but that doesn't exist yet (US-05, "custom Category"). See Open Questions #1 for the alternative (LLM-generated proposals) this spec deliberately does not take for MVP.

## Preconditions (feature-level)

- Caller holds a valid access JWT.
- Caller has at least one Wallet (its currency is the wizard's fixed currency — the wizard does not support multi-currency allocation in one run; see Out of Scope).
- At least one `expense`-type Category (system or the caller's own) exists to choose from (F-04, already implemented).
- The wizard is a client-only, ephemeral flow: nothing is written to the database at any step before the final confirmation (US-05). Dismissing the wizard at any point leaves the caller's existing Budgets and Categories completely unchanged.

### Key Entities Involved (conceptual — full schema/index design belongs in `plan.md`)

This feature introduces no new stored domain object. It reads and writes existing entities:

| Entity | How this feature uses it |
|---|---|
| Budget (F-05) | Written in bulk by the final confirmation — full replace of the caller's existing Budgets, not a merge |
| Category (F-04) | Read for selection; optionally created (one at a time, before the bulk Budget write) when the User describes a Category that doesn't exist yet |
| ChatMessage (Feature-12) | Carries a new card variant (`action_type: "budget_wizard"`) when the wizard is opened from a natural-language message, instead of a Transaction proposal |

⚠️ **Money rule**: every amount in this feature (income, proposed amount, final Budget limit) is integer cents in the caller's wallet currency — never a float, in transit or storage. **Timestamps**: any date this feature produces (e.g. a Budget's `start_date`) is a plain calendar date, no timezone component, matching F-05's existing convention.

---

## US-01: Start the Wizard from a Quick Action

**As a** User,
**I want** to open the Budget Setup wizard directly from a button on the AI Chat screen,
**so that** I can start setting up my Budgets without first typing a request.

**API:** `GET /ai/budget-wizard/prefill`

### Preconditions
- Caller is authenticated.

### Main Flow
1. User taps the "Set up Budget" quick-action chip, shown directly above the message input box on the AI Chat screen (`mobile/app/(app)/ai-chat.tsx` — not the Budgets tab).
2. Client calls `GET /ai/budget-wizard/prefill`.
3. System returns the caller's default Wallet currency, every Category visible to the caller, and the caller's existing (non-deleted) Budgets — no AI Service call is made, and no ChatMessage is recorded for this trigger.
4. Client opens the wizard at its first step, with any Category that already has an active Budget shown pre-selected and labeled with its current limit.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-BWZ-01 | Caller is authenticated, has 2 existing Budgets | Caller taps the quick action | Wizard opens; both budgeted Categories appear pre-selected with their current amount shown | Happy path |
| S-BWZ-02 | Caller is authenticated, has 0 existing Budgets | Caller taps the quick action | Wizard opens; no Category is pre-selected | Happy path — first-time setup |
| S-BWZ-03 | No/invalid JWT | Caller calls `GET /ai/budget-wizard/prefill` | `401 UNAUTHENTICATED` | |

### Edge Cases
1. **This trigger never touches `chat_messages`** — unlike US-02's trigger, opening the wizard this way leaves no record in the AI Chat thread, since no message was actually sent.
2. **Prefill is read-only** — it never creates, updates, or deletes anything; a failed prefill call simply fails to open the wizard, no partial state exists.
3. **An existing Budget with a `period` other than the wizard's own default (`monthly`) is still surfaced pre-selected with its own stored period and amount** — this endpoint reports exactly what F-05 already has, never re-labeling or converting it; if the User proceeds, US-05's bulk replace applies whatever period the wizard run itself settles on (see feature-level Precondition on ephemeral state).

### Definition of Done
- `GET /ai/budget-wizard/prefill` implemented, scoped strictly to the caller's own Categories and Budgets.
- Integration tests for S-BWZ-01, S-BWZ-02 pass. Unit test for S-BWZ-03 passes.

### Idempotency
N/A — read-only (`GET`), naturally idempotent.

---

## US-02: Start the Wizard from a Chat Message

**As a** User,
**I want** to ask the AI, in my own words, to help me plan my Budgets,
**so that** I can start the wizard the same way I already talk to the AI about my transactions.

**API:** `POST /ai/chat` (existing endpoint, extended — see below)

### Preconditions
- Caller is authenticated.

### Main Flow
1. User sends a natural-language message expressing intent to set up or plan a Budget (e.g. "giúp tôi set budget", "phân bổ ngân sách dùm tôi").
2. System (AI Service) recognizes this as a `budget_wizard` intent, distinct from `create_transaction`/`edit_transaction`/`query_spending`/`general_advice`.
3. System saves the user message and the assistant's reply to `chat_messages` as usual, and the response carries `action_type: "budget_wizard"`.
4. Client renders the assistant reply as a tappable card instead of a plain bubble.
5. User taps the card; client opens the wizard, lazily calling `GET /ai/budget-wizard/prefill` (US-01) at that point.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-BWZ-04 | Caller is on the AI Chat screen | Caller sends "giúp tôi set budget" | System replies with a `budget_wizard`-flagged message; client shows a tappable card; both messages are saved | Happy path |
| S-BWZ-05 | A `budget_wizard` card exists in the thread, not yet submitted | Caller taps the card | Wizard opens (prefill loads at this point, not before) | |
| S-BWZ-06 | Caller previously completed the wizard from a card in this thread | Caller views that same card again | Card shows a read-only "✅ Set up N budgets" state instead of being tappable | Prevents re-opening a wizard the caller already finished from this exact card; see Edge Cases #2 |

### Edge Cases
1. **This is purely an alternate entry point** — once the wizard opens, US-03 through US-05 behave identically regardless of which trigger opened it.
2. **The card's "already submitted" state is client-side only, not persisted** (see Open Questions #3 in the feature-level section) — a caller who force-quits and reopens the app sees the card as tappable again; tapping it simply opens a fresh wizard run (which, via US-01's prefill, correctly pre-selects whatever Budgets already exist by then).
3. **A `budget_wizard` reply never includes Transaction `actions[]`** — this intent is mutually exclusive with `create_transaction`/`edit_transaction` for the same message.

### Definition of Done
- AI Service recognizes a `budget_wizard` intent from Vietnamese natural-language input, distinct from every existing intent.
- `POST /ai/chat` response carries `action_type: "budget_wizard"`; `chat_messages` rows are saved exactly as for any other intent.
- Integration test for S-BWZ-04 passes.

### Idempotency
N/A for the chat message itself (mirrors Feature-12's existing non-idempotent chat send). Opening the wizard from the card has no write of its own — see US-01.

---

## US-03: Provide Income, Categories, and Spending Preferences

**As a** User,
**I want** to enter my income and choose which Categories to budget for, with a rough spending level for each,
**so that** the System has enough information to propose a sensible allocation.

**API:** none (client-only step; optionally `POST /ai/suggest-category-name` for the custom-Category sub-step below)

### Preconditions
- Wizard is open (via US-01 or US-02), prefill data has loaded.

### Main Flow
1. User picks a period (monthly/weekly/quarterly — default monthly, matching F-05's existing `period` field) and enters an income amount for that period, in the caller's default Wallet currency.
2. User selects one or more Categories to budget for, from a preset list of common `expense`-type categories plus the caller's own system/user `expense`-type Categories — `income`-type Categories (e.g. "Salary") are not offered by this picker (see Edge Cases #1, resolves Open Questions #5). Any Category with an existing active Budget is pre-selected, showing its current amount.
3. For each selected Category, User sets a spending preference: **Very little**, **Little**, **Normal**, **A lot**, **Priority**, or **Let the AI decide**.
4. *(Optional)* User types a free-text description for a Category that doesn't exist in the preset list or the caller's own Categories (e.g. "tiền đi chơi với người yêu"). For each such description, System calls `POST /ai/suggest-category-name`, and shows the suggested name/icon for the User to **confirm**, **edit**, or **discard** — nothing is created yet (see US-05 for when creation actually happens).

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-BWZ-07 | Wizard is open | User enters income = 0 and taps Next | System blocks with validation error "Income must be greater than 0" | Client-side validation error, not a system error |
| S-BWZ-08 | Wizard is open | User enters income = 9,999,999,999 xu (~10 billion VND) and taps Next | System blocks with a validation error — income must stay below the overflow guard | ⚠️ Guards against overflow in the later weight-multiplication step (US-04) |
| S-BWZ-09 | Wizard is open, income entered | User selects zero Categories and taps Next | System blocks with validation error "Please select at least one category" | |
| S-BWZ-10 | Wizard is open | User selects 20 Categories (at the cap) and tries to select a 21st | System disables further selection | Client-side enforcement of the same 20-item cap `POST /budgets/bulk` (US-05) enforces server-side |
| S-BWZ-11 | User types "tiền café sáng" as a custom Category description | System calls `POST /ai/suggest-category-name`, shows a suggestion | User taps "Discard" | The description is dropped from the wizard entirely — no Category is created for it, even at final submit |
| S-BWZ-12 | User types "tiền đi chơi với người yêu" | System suggests name "Hẹn hò / Người yêu", icon 💑, type expense | User taps "Confirm" | The confirmed suggestion is carried forward as a pending-creation item, resolved at submit (US-05) |

### Edge Cases
1. **The Category picker filters to `type = expense` only** (resolved 2026-08-24, was Open Questions #5) — a Category with `type = income` (e.g. "Salary") is never offered for selection in this wizard, matching the feature-level Precondition ("At least one `expense`-type Category ... exists to choose from"). This is narrower than F-05's own Budget-creation flow, which has no `type` restriction on `category_id` at the API layer — the restriction here is a client-side picker filter, not a new server-side validation rule.
2. **The custom-Category suggestion call never creates anything** — `POST /ai/suggest-category-name` is a pure suggestion endpoint; it does not touch `categories` and is not recorded in `chat_messages`, mirroring US-01's "prefill never writes" principle.
3. **Re-describing the same free-text Category twice in one wizard run** produces two independent suggestion calls and two independent pending-creation items — this spec does not de-duplicate by description text; a User who wants only one must discard the extra themselves.

### Definition of Done
- Client blocks progression past this step until income > 0 and at least one Category is selected, with the two validation messages above.
- `POST /ai/suggest-category-name` implemented (see US-05 for its full contract) and wired into this step.
- Unit tests for the income-overflow guard (S-BWZ-08) and empty-category-selection guard (S-BWZ-09) pass.

### Idempotency
N/A — every action in this step is client-side state, except `POST /ai/suggest-category-name`, which is a pure read-like suggestion call (not idempotent in the formal sense, but has no side effects to worry about being duplicated).

---

## US-04: Review the AI-Proposed Budget Allocation

**As a** User,
**I want** to see how the System proposes to split my income across my chosen Categories, and adjust any amount,
**so that** the final Budgets match my own judgment, not just the System's suggestion.

**API:** `POST /ai/budget-proposals` (URL kept under the existing `/ai` namespace for consistency with the wizard's other endpoints — the computation itself never leaves the Go Backend, no AI Service call is made for this endpoint; see Context)

### Preconditions
- Caller is authenticated.
- Request: `{ income: integer, currency: string, period: "monthly"|"weekly"|"quarterly", preferences: [{ category_id: uuid, category_name: string, spending_preference: "very_little"|"little"|"normal"|"a_lot"|"priority"|"ai_decides" }, ...] }`. `preferences` is non-empty (guaranteed by US-03's own validation, re-checked here).

### Main Flow
1. Client submits income, period, and the list of `(category_id, spending_preference)` pairs collected in US-03 (only for Categories that already exist — a still-pending custom Category has no `category_id` yet, so it is excluded from this call and its amount is decided client-side as a share of the "unallocated" remainder, or resolved after US-05 creates it, per Open Questions #2).
2. System re-validates that every `category_id` is visible to the caller (system-defined or owned by the caller) — `403` otherwise.
3. System (Go Backend, in-process — no AI Service call) computes a proposed amount per Category using a **fixed, rule-based formula** (revised 2026-08-24 — see below):
   - Each preference maps to a fixed, **absolute** target share of income, independent of what else is selected: `very_little=5%`, `little=10%`, `normal=15%`, `a_lot=22%`, `priority=30%`. Two Categories both set to "very little" each get 5% of income — not an even split of a shared pool.
   - `ai_decides` uses a fixed baseline share of income per Category-name pattern instead of a preference share (e.g. food ≈ 25%, transport ≈ 10%, housing/bills ≈ 15%, savings ≈ 20%, unmatched ≈ 5%).
   - If every Category's raw target (preference share or ai_decides baseline) summed together exceeds 90% of income, **all** of them are scaled down by the same proportional factor — never redistributed unevenly, and never only the `ai_decides` subset.
   - Every proposed amount is clamped to a minimum of 50,000 xu (scaling other amounts down if needed to make room) and to a maximum of 50% of income. This ceiling is a defensive cap only — no preference tier or baseline value reaches it on its own, so it is not expected to trigger under normal use (see Revision note).
   - The remainder (`income − sum of all proposed amounts`) is always at least 10% of income and is shown to the User as **"Chưa có ngân sách" (not yet budgeted)** — money without a spending rule assigned yet, not an error, a warning, or a leftover the System failed to place.

   **Revision note (2026-08-24):** the original formula gave each preference a *relative* weight (`very_little=0.4` ... `priority=2.0`) and had Categories split a shared 90%-of-income pool proportionally to their weight. That degenerated whenever every selected Category shared one preference — the weight value canceled out of the ratio, so e.g. two Categories both "very little" still split the full pool 45%/45%, making the preference choice look like it had no effect (reported as a "logic fatal flaw" against real usage). The per-Category ceiling's "lifted for a single Category" exception (old S-BWZ-14) existed only to let a lone selected Category absorb the whole pool under that relative design — with absolute shares it is no longer needed and has been dropped.
4. System returns the proposed amount, its percentage of income, and a one-line rule-based reasoning string per Category, plus the unallocated amount/percentage.
5. Client shows the proposal (a chart plus a per-Category list). User may tap any Category to adjust its amount via a slider or direct input — this recalculates the unallocated remainder **entirely client-side**; the AI Service is not called again for an adjustment.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-BWZ-13 | Caller selected "Food" (`a_lot`) and "Savings" (`ai_decides`), income 20,000,000 | Client calls `POST /ai/budget-proposals` | `200`; both Categories get a proposed amount, `unallocated` is shown and is ≥ 10% of income | Happy path — mixed weighted + `ai_decides` |
| S-BWZ-14 | Caller selected only 1 Category (`priority`), income 10,000,000 | Client calls `POST /ai/budget-proposals` | `200`; the single Category's proposed amount equals its own absolute target share (`priority` → 30% → 3,000,000) — unaffected by how many other Categories are (not) selected | Revised 2026-08-24 — replaces the old relative-weight design's single-category ceiling-lift behavior |
| S-BWZ-15 | Caller selected a `category_id` belonging to a different user | Client calls `POST /ai/budget-proposals` | `403 CATEGORY_ACCESS_DENIED` | Ownership re-validation — same rule as Feature-12's `POST /ai/chat` |
| S-BWZ-16 | — | Client submits `preferences: []` (empty array) | `400 INVALID_INPUT` | |
| S-BWZ-17 | — | Client submits `period: "yearly"` (not one of `monthly`/`weekly`/`quarterly`) | `400 INVALID_INPUT` | Same accepted-values rule as F-05's own `period` field |
| S-BWZ-18 | Caller adjusts the proposed "Food" amount from 4,000,000 up to 6,000,000 | Client recalculates | The `unallocated` figure decreases by 2,000,000; no network call is made | Client-side only, per Main Flow step 5 |
| S-BWZ-19 | All selected Categories use `ai_decides`, and their combined baselines exceed 90% of income | Client calls `POST /ai/budget-proposals` | `200`; every baseline is scaled down proportionally so the total still leaves ≥ 10% unallocated | ⚠️ Guardrail — never silently exceeds the 90% ceiling |

### Edge Cases
1. **The proposal is a suggestion only — nothing is created by this endpoint.** Categories and Budgets are only ever written by US-03's custom-Category confirm step and US-05's bulk create, both of which require a further explicit User action.
2. **Re-calling this endpoint with the same input always returns the same proposal** — a direct consequence of the fixed, rule-based formula computed entirely in-process (no LLM randomness, and no network hop to an external service that could fail transiently in the first place).
3. **A very small income with many selected Categories** can push the computed total above 90% of income even after the 50,000-xu-minimum clamp; in that case the System reduces amounts starting from the lowest-preference Category first, and the client surfaces a non-blocking notice that some Categories were scaled down more than requested.

### Definition of Done
- `POST /ai/budget-proposals` implemented with the ownership re-validation, absolute target-share mapping, baseline table, and all three guardrails (minimum per-Category floor, maximum per-Category ceiling, proportional overflow scaling across every Category, ≥10% unallocated floor) from Main Flow step 3.
- Unit tests for S-BWZ-14 (single-category target share, revised 2026-08-24), S-BWZ-19 (proportional overflow scaling), and a small-income-many-categories case (Edge Case #3) pass.
- Integration tests for S-BWZ-13, S-BWZ-15 through S-BWZ-17 pass.
- No test asserts on any LLM call or outbound network call being made by this endpoint — the entire computation runs inside the Go Backend process.

### Idempotency
Idempotent by construction (Edge Case #2) — not because of an explicit idempotency key, but because the computation is a pure function of its input.

---

## US-05: Confirm and Create Budgets in Bulk

**As a** User,
**I want** to confirm the reviewed allocation and have all of my Budgets created at once,
**so that** I don't have to repeat the same steps once per Category.

**API:** `POST /budgets/bulk`; internally preceded by `POST /categories` for any confirmed custom Category, and (for the natural-language trigger) reflected back onto the originating `budget_wizard` chat card

### Preconditions
- Caller is authenticated.
- Request: `{ budgets: [{ category_id: uuid, period: "monthly"|"weekly"|"quarterly", limits: [{ currency: string, amount_limit: integer }] }, ...] }`. **No `start_date` field** — the System sets each created Budget's `start_date` to the current server date (UTC) at creation time, matching Budget Management's own existing default-to-now behavior when `start_date` is omitted (`specs/budget-management/spec.md` US-01 Preconditions); the wizard never lets the client backdate or postdate a Budget, sidestepping any client-side timezone ambiguity. `budgets` is non-empty, at most 20 items. Every `category_id` must already exist — any custom Category confirmed in US-03 is created via `POST /categories` (F-04, unchanged) immediately before this call, sequentially, and aborted (nothing submitted) if any single creation fails.

### Main Flow
1. User taps "Confirm and Create Budgets" on the reviewed proposal (US-04).
2. Client creates any pending custom Categories first, one at a time; if any fails, the client stops and shows an error without calling `POST /budgets/bulk` at all — no Budget is created from a run with a failed Category creation.
3. Client calls `POST /budgets/bulk` with one entry per reviewed Category (including the just-created ones) and their final (possibly User-adjusted) amounts.
4. System, inside one DB transaction: locks the caller's existing (non-deleted) Budgets, re-validates every submitted `category_id` is visible to the caller, checks for duplicate `category_id` values within the request, soft-deletes every existing Budget of the caller's, then creates the submitted set.
5. System returns the count and list of newly created Budgets.
6. Client dismisses the wizard, shows a success message with the created count, and — if the wizard was opened from a `budget_wizard` chat card (US-02) — updates that card to its read-only "✅ Set up N budgets" state.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-BWZ-20 | Caller has no existing Budgets | Caller confirms 3 reviewed Categories | `201`; 3 Budgets created, `created_count: 3` | Happy path — first-time setup, nothing to replace. `201`, not `200`, matching `POST /budgets`' own status code (F-05) — this is still a resource-creation endpoint, just a batched one |
| S-BWZ-21 | Caller has 3 existing Budgets ("Food", "Transport", "Shopping") | Caller confirms a run covering only "Food" and "Transport" | `201`; "Shopping"'s Budget is soft-deleted, "Food"/"Transport" are recreated with the new amounts | ⚠️ Full replace, not a merge — matches F-05's own `PATCH` full-replace precedent, applied here at the whole-Budget-set level |
| S-BWZ-22 | Caller confirms a run including a `category_id` that was deleted after the proposal (US-04) was shown | Caller taps confirm | `404 CATEGORY_NOT_FOUND`; **no** Budget from this request is created (all-or-nothing) | |
| S-BWZ-23 | Request includes the same `category_id` twice | Caller taps confirm | `422 DUPLICATE_CATEGORY_IN_REQUEST`; nothing created | |
| S-BWZ-24 | Request includes a `category_id` belonging to a different user | Caller taps confirm | `403 CATEGORY_ACCESS_DENIED`; nothing created | |
| S-BWZ-25 | Request has 21 budget entries | Caller taps confirm | `422 TOO_MANY_BUDGETS`; nothing created | Server-side enforcement of the 20-item cap the client already enforces (US-03 S-BWZ-10) |
| S-BWZ-26 | A pending custom Category's `POST /categories` call fails (e.g. duplicate name) | Client attempts the sequential creation step | Client stops; shows an error; `POST /budgets/bulk` is never called | The Category that *did* succeed before the failure (if any, from a multi-Category run) is **not** rolled back — it already exists as a real Category, independent of this Budget-creation attempt; see Edge Cases #2 |
| S-BWZ-27 | Caller runs the wizard from two devices at the same time, both confirming | Both requests race | Exactly one consistent end state: whichever request's transaction commits first replaces the caller's Budgets; the second, later request sees no conflicting old Budgets left to interfere and its own INSERT succeeds against the now-updated state — the later commit's Budget set is what remains | ⚠️ Data-integrity — requires locking the caller's existing Budget rows before the soft-delete-then-insert sequence, so the two transactions serialize rather than interleave |
| S-BWZ-28 | Caller dismisses the wizard at Step 4 review, without confirming | — | No Budget or Category is created or changed | Matches feature-level Precondition — wizard is fully ephemeral until this exact confirm action |

### `POST /ai/suggest-category-name` (internal helper, invoked from US-03)

**Request:** `{ description: string }` — free text the User typed for a Category that doesn't exist yet.
**Response:** `{ suggested_name: string, type: "income"|"expense", icon: string }` — an LLM call (Groq primary/Anthropic fallback, `temperature=0`, schema-forced output), the one deliberate exception to this feature's "rule-based, not LLM" design (see Context).
**Errors:** `502 AI_SERVICE_UNAVAILABLE` on LLM failure — the client falls back to letting the User type the Category name manually rather than blocking the wizard entirely.

### Edge Cases
1. **The bulk replace is scoped to the caller's entire active Budget set, not just the Categories touched by this wizard run** (S-BWZ-21) — a Budget the caller created manually through F-05, outside any wizard run, is replaced (removed) exactly the same as one a prior wizard run created, if it's not part of the new confirmed set. This is a deliberate, sharp behavior: the wizard is framed as "set up my whole Budget plan," not "add these Budgets to whatever I already have."
2. **A successfully-created custom Category from a failed multi-Category batch is not rolled back** (S-BWZ-26) — Category creation and Budget creation are two separate API calls with two separate atomicity boundaries; a User left with an orphan Category (never budgeted) can delete it manually via F-04 or simply leave it unused.
3. **The bulk-replace race (S-BWZ-27) is closed by locking the caller's existing Budget rows before soft-deleting them**, inside the same transaction as the new inserts — the same class of guard F-05's `spec.md` already uses for its own create-vs-Category-delete race (S-BUD-14), applied here at the whole-Budget-set level instead of a single Budget.
4. **This spec does not introduce an idempotency key for `POST /budgets/bulk`** — a double-tap on "Confirm" simply runs the full replace-and-recreate sequence twice, converging to the same end state the second time (the same Budgets get soft-deleted and recreated with identical values) rather than creating duplicates. The client disables the confirm button after the first tap as the practical safeguard (see Open Questions #4).
5. **Replacing a Budget also removes its per-currency limit rows, not just the Budget row itself** — every existing Budget this endpoint replaces has its `budget_limits` entries deleted alongside it (not left as orphaned rows for a soft-deleted parent), a deliberate strengthening of F-05's own accepted "orphaned `budget_limits` rows are never surfaced but also never cleaned up" gap (`specs/budget-management/spec.md` Domain Objects note) — appropriate here specifically because this endpoint can soft-delete-and-recreate a User's whole Budget set repeatedly, which would otherwise accumulate orphaned rows far faster than F-05's own one-at-a-time delete ever does.
6. **`start_date` is never client-supplied** — every Budget this endpoint creates gets the Go Backend's own current server date (UTC) as its `start_date`, identical to what `POST /budgets` already does when a caller omits `start_date` (F-05) — not a new rule invented for this endpoint.

### Definition of Done
- `POST /budgets/bulk` implemented: category-visibility re-validation, duplicate-`category_id` rejection, 20-item cap, and an atomic (single-transaction) replace of the caller's entire active Budget set — existing Budgets locked, their `budget_limits` rows deleted, the Budgets themselves soft-deleted, new Budgets (and their limits) inserted, all-or-nothing.
- `POST /ai/suggest-category-name` implemented with schema-forced LLM output.
- Unit tests for S-BWZ-23, S-BWZ-25 pass. Integration tests for S-BWZ-20 through S-BWZ-22, S-BWZ-24, and the concurrency case S-BWZ-27 pass.
- No test asserts on float/decimal handling for any `amount_limit`.

### Idempotency
**Not idempotent as a formal mechanism** (Edge Cases #4) — re-submitting the same payload converges to the same end state (functionally safe to retry), but there is no explicit idempotency key; the client-side disable-after-first-tap is the practical safeguard against an accidental double-create, matching F-05's own precedent of no formal idempotency key on its Create/Update endpoints.

---

## Out of Scope (Feature F-13)

- **Multi-currency allocation in one wizard run** — the wizard uses a single currency (the caller's default Wallet currency) for the whole run; a caller wanting Budgets in multiple currencies still uses F-05's manual per-Budget `PATCH` to add another currency afterward.
- **Budget icon selection inside the wizard** — created Budgets have no `icon`/`icon_url` set; the User can set one afterward via F-05's existing icon-upload flow (SDS §12.1 Known Issues Log Item 3).
- **Financial Goal integration** — a "Savings" Category proposal does not create a Financial Goal (F-08); that remains a fully separate, manual feature.
- **Recurring/scheduled re-runs of the wizard** — the User re-opens it manually whenever they want to redo their Budget plan; no automatic periodic re-prompt.
- **`frontend/` (web) client** — this spec targets `mobile/` only, matching the feature draft's explicit client priority; web parity is a follow-up.
- **Undo after confirmation** — once `POST /budgets/bulk` succeeds, the only way back is to re-run the wizard (which replaces again) or edit/delete individual Budgets manually via F-05.
- **Server-side persistence of "this wizard card was already submitted"** — that state lives client-side only (US-02 Edge Cases #2); see Open Questions #3.

## Open Questions

1. **Rule-based vs. LLM-generated proposals**: this spec commits to a fixed, deterministic formula computed entirely in the **Go Backend** (US-04) for MVP — cheaper, faster, trivially unit-testable with no HTTP/LLM mocking, and immune to AI Service downtime, at the cost of less "personalized"-sounding reasoning text. Confirm this is acceptable long-term, or whether a future iteration should add a new, additive call to the AI Service to generate the reasoning text (not the amounts themselves) via LLM for a more natural tone.
2. **Handling a not-yet-created custom Category's share during US-04's proposal call**: since `POST /ai/budget-proposals` needs a real `category_id`, a pending custom Category (no ID yet) can't be included in that call. This spec assumes the client reserves that Category's share out of the "unallocated" remainder client-side and folds it into the final `POST /budgets/bulk` request once `POST /categories` returns its real ID (US-05 Main Flow step 2) — confirm this two-phase approach is acceptable, or whether the custom-Category creation should be moved earlier (before US-04) so every Category always has a real ID by the time proposals are requested.
3. **Wizard-card "already submitted" state persistence** (US-02 Edge Cases #2): this spec assumes client-side-only state (no new column on `chat_messages`) is acceptable — a User who reopens the app sees a previously-submitted card as tappable again, but re-running the wizard from it is harmless (US-01's prefill correctly reflects whatever Budgets exist by then). Confirm this is acceptable, or whether `chat_messages` needs a way to mark a specific message as "already actioned," which would be a schema change out of this spec's current scope.
4. **`POST /budgets/bulk` idempotency key**: this spec relies on client-side disable-after-tap rather than a server-side key (Edge Cases #4). Low risk since a duplicate call converges to the same state, but flagging for explicit product sign-off, same as F-05's own precedent left this open for its Create endpoint.
5. ~~Category type = income selected for budgeting~~ — **Resolved 2026-08-24:** the wizard's Category picker filters to `expense`-type Categories only (own + system); `income`-type Categories are not offered for budgeting in this flow (US-03 Main Flow step 2, Edge Cases #1). This matches the feature-level Precondition, which already assumed an `expense`-type Category exists to choose from.
6. ~~Proposal formula: relative weight vs. absolute target share~~ — **Resolved 2026-08-24:** the original relative-weight formula (US-04 Main Flow step 3) let Categories split a shared pool proportionally, which degenerated to an even split whenever every selected Category shared one preference — reported as confusing against real usage. Replaced with a fixed, absolute target share of income per preference tier, independent of what else is selected (see Main Flow step 3's Revision note and S-BWZ-14).
