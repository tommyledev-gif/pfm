# Feature Spec: Feature-12 AI Chat Assistant — Create Transaction via Chat (Release 1)

> Source: `SRS.md` Feature-12 / FR-09 (US-01 "Create a Transaction via Chat [MVP-labeled in SRS, Release 1 in the release table]"), BF-10; `SDS.md` §2 Domain Model (ChatMessage), §5.12 (US-12-01), §6 API Design (`POST /ai/chat`, `PUT /transactions/{id}`), §7 Security Design; `CLAUDE.md` AI Service tech stack (Python FastAPI, Groq SDK primary / Anthropic SDK fallback); `docs/features.md` §6 AI Service Roadmap
> Status: Release 1 — first slice of Feature-12. **Scope for this spec is intentionally narrower than all of Feature-12**: it covers only SRS US-01 (Create a Transaction via Chat). US-02 (Edit via Chat), US-03 (Query Spending via Chat), and US-04 (General Advice) are **not specced here** — see Out of Scope. This narrowing was an explicit instruction for this BA pass, not a scope reduction discovered during analysis.
> Timing note: MVP (F-01→F-07, F-10) is now fully implemented — confirmed directly against the codebase (`backend/db/migrations/009_notifications.sql`, `notification_handler.go`/`notification_service.go`, `frontend/src/features/notifications` all exist), even though `CURRENT_STATE.md`/`docs/features.md` are still dated 2026-08-13 and don't yet reflect it (to be corrected by `/renew-docs` and `/renew-features` alongside this spec). This satisfies `docs/features.md` §6's own stated condition to revisit the AI Service "after F-10 ships."
> Related: [F-06 Transaction Management](../transaction-management/spec.md) (this feature's confirmed writes reuse `POST /transactions` unchanged in every existing rule, plus one small additive field that directly resolves that spec's own Open Questions #2 idempotency gap — see Resolved design decision #5), [F-04 Category Management](../category-management/spec.md) (category context/matching), [F-03 Wallet Management](../wallet-management/spec.md) (default-wallet resolution)

## Context

A User currently records a Transaction only by filling a form: pick Wallet, pick Category, enter amount, set date (SRS Feature-06 US-01). This is repetitive for something a User does multiple times a day. SRS Feature-12 / FR-09 introduces a chat-based alternative: the User describes an expense or income in a natural-language (Vietnamese) message, an AI Service extracts one or more structured Transaction proposals, and the User explicitly confirms before anything is written — the AI never bypasses Transaction Management's existing validation and ownership rules (FR-02).

The AI Service (`ai-service/`, Python FastAPI, per `CLAUDE.md`) **does not exist yet** — this is a greenfield dependency, not a partially-built one. Building its minimal scaffold (health check + a single extraction endpoint, reachable from the Go Backend over the internal Docker network) is part of this feature's own implementation work, not a separate prerequisite feature to spec first (Resolved design decision #7).

**Resolved design decisions** (made explicit here because several of the original product proposal's assumptions did not match this project's actual conventions and had to be corrected):

1. **Client is `frontend/` (web), not a Flutter mobile chat UI.** `CLAUDE.md` explicitly states `mobile/` is paused until explicitly requested; this feature's UI is built in `frontend/src/features/ai-chat/`, matching every other post-MVP feature's web-first delivery.
2. **This spec formalizes only the `create_transaction` and `ambiguous` intents.** `edit_transaction`, `query_spending`, and `general_advice` (SRS US-02/03/04) are out of scope for this spec — see Out of Scope.
3. **An AI-drafted payload receives zero additional trust at confirm time.** It is validated by the *exact same* `POST /transactions` rules as a manually-typed form submission — every scenario in `transaction-management/spec.md` (S-TRX-01 through S-TRX-19: shape validation, Wallet/Category ownership, `category.type` match, insufficient-balance floor) applies completely unchanged. This feature only helps *draft* the request; it never gets to skip a check a human user would have to pass.
4. **Every Wallet/Category ID the AI Service returns is re-validated for ownership by the Go Backend before it is ever shown to the client.** The AI Service is untrusted input with respect to authorization, even though it runs on the internal Docker network (already decided in `SDS.md` §7) — a returned ID that does not belong to the caller is treated as a failed match (downgrades the whole action to `ambiguous`), never silently passed through.
5. **`POST /transactions` gains one small, additive, backward-compatible field: an optional `idempotency_key` (UUID).** A duplicate submission of this endpoint doubly mutates a Wallet's real balance (unlike a duplicate Wallet/Budget row) — `transaction-management/spec.md` Open Questions #2 already flagged this as an urgent, unresolved gap. This spec resolves it: `idempotency_key`, when present, is enforced unique per `(user_id, idempotency_key)` via a partial unique index; a second request with a previously-used key returns the original Transaction (`200`, not `201`) instead of creating a duplicate. This is generalized to **all** callers of `POST /transactions`, not just AI Chat (see Open Questions #4).
6. **No multi-turn conversation context.** Every `POST /ai/chat` call is evaluated independently of any prior call — `conversation_id` exists only to group `chat_messages` rows for audit/display, and is never fed back into the AI Service's prompt as history. Matches the original proposal's own "MVP chỉ single-turn" note, now made load-bearing rather than a footnote.
7. **The AI Service's Phase 0 (FastAPI scaffold, health check) and Phase 1 (extraction endpoint) — per `docs/features.md` §6's roadmap — are built as part of implementing this spec**, since no prior feature created `ai-service/` yet.
8. **Confidence threshold for auto-proposing vs. asking for clarification is 0.6** (carried over from SRS Feature-12 US-01's acceptance criteria, itself sourced from the original product proposal, not an SRS-native number elsewhere in this project) — flagged for explicit product sign-off in Open Questions #3.
9. **No new `categories.description` column.** The original proposal wanted a `description` field for disambiguation; SRS's own acceptance scenario ("ăn uống du lịch Đà Lạt 500k" → category "Ăn uống du lịch") is satisfiable by name-based matching alone, since the two category *names* already differ. Adding a schema column purely for a nice-to-have is deferred (Open Questions #5).

Actors:
- **User** — any `active` user (`role = admin` or `member`); chat is personal, not shared.
- **AI Service** — internal system actor (Python FastAPI, Groq primary / Anthropic fallback), called only by the Go Backend, never directly by the client.

## Preconditions (feature-level)

- Caller holds a valid access JWT.
- Caller has at least one non-deleted Wallet (Precondition shared with `transaction-management/spec.md` US-01) — if none exists, this feature cannot propose any Transaction (Edge Case #7).
- `ai-service/` exists with a reachable internal endpoint (e.g. `POST http://ai-service:8000/extract`) accepting `{ message, wallets[], categories[], now }` and returning `{ intent, transactions[] }` — the exact internal contract, prompt design, and Groq/Anthropic routing are `plan.md`/implementation concerns, not re-specified here beyond this shape.
- New migration required: an additive `idempotency_key` column + partial unique index on the existing `transactions` table (no new table for this), and a new `chat_messages` table (Domain Fields below) — both are net-new relative to the current schema (`001_init.sql` through `009_notifications.sql`).

### Domain Fields (conceptual — full schema/index design belongs in `plan.md`)

**`transactions` (additive change only — every existing column from `008_transactions.sql` is unchanged):**

| Field | Meaning |
|---|---|
| `idempotency_key` | Nullable `UUID`. When present on `POST /transactions`, enforced unique per `(user_id, idempotency_key)` via a partial unique index (`WHERE idempotency_key IS NOT NULL`) — a repeat request with the same key returns the original row instead of creating a new one (Resolved design decision #5). |

**`chat_messages` (new table, per `SDS.md` §2 Domain Model ChatMessage):**

| Field | Meaning |
|---|---|
| `id` | Unique identifier |
| `user_id` | Owner — chat is personal, never shared or admin-visible |
| `conversation_id` | `UUID`, client-generated if provided, else server-generated. Groups messages for audit/display only (Resolved design decision #6) — never used to reconstruct prompt history |
| `role` | `user` \| `assistant` |
| `content` | The raw message text (user) or the rendered reply text (assistant) |
| `intent` | Nullable text — `create_transaction` \| `ambiguous` for this spec's scope; `NULL` on `role = user` rows |
| `transaction_ids` | Nullable `UUID[]` — populated only once the User confirms one or more proposed actions and the corresponding `POST /transactions` calls succeed; `NULL`/empty until then |
| `created_at` | Audit timestamp |

**Business invariant**: `chat_messages.user_id` is always the caller's own ID — never another User's, never a system-wide broadcast (mirrors every prior personal-data feature's isolation rule).

**Business invariant**: an `idempotency_key`, once used successfully by a given `user_id`, always resolves to the same Transaction on any subsequent `POST /transactions` call reusing it — regardless of what request body accompanies the repeat call (the stored Transaction is returned as-is; a changed body under a reused key is not treated as an update — see Edge Cases #2).

⚠️ **Money rule**: unchanged from `transaction-management/spec.md` — `amount` is integer cents, never a float, always positive; the AI Service is responsible for parsing Vietnamese shorthand ("30k" → 30000, "1tr" → 1000000) into that integer *before* it ever reaches the Go Backend, but the Go Backend re-validates the integer exactly as it already does for a manual submission (Resolved design decision #3).

---

## US-01: Create a Transaction via Chat [Release 1]

**As a** User,
**I want** to describe an expense or income in a natural-language chat message,
**so that** the System proposes the Transaction(s) for me, and creates them once I confirm — without filling a form.

**API:** `POST /api/v1/ai/chat` (proposal step) → existing `POST /api/v1/transactions/` (confirm step, extended per Resolved design decision #5)

### Preconditions
- Caller is authenticated.
- Request body: `{ message: string, conversation_id?: uuid }`. `conversation_id` is generated server-side if omitted.

### Main Flow
1. User opens the AI Chat screen (`frontend/src/features/ai-chat/`) and sends a message, e.g. `"ăn trưa 50k"`.
2. Controller receives the message, validates shape (`message` non-empty, ≤ 1000 chars — explicit assumption, see Open Questions #6), persists a `chat_messages` row (`role = "user"`).
3. Service loads the caller's own non-deleted Wallets (`id, name, is_default, currency`) and Categories (`id, name, type`) as context — never another User's.
4. Service calls the AI Service's internal extraction endpoint with `{ message, wallets, categories, now: <server UTC time> }`.
5. AI Service returns `{ intent, transactions: [{ amount_vnd, tx_type, category_id, wallet_id?, note?, occurred_at, confidence }] }` (see Domain Fields, and SDS §6 for the full internal contract this cut implements).
6. **For each returned transaction with `confidence ≥ 0.6`**: Service re-validates that `category_id` (and `wallet_id`, if present) actually belong to the caller (Resolved design decision #4). A failed ownership check, or a missing/invalid ID the AI could not resolve, downgrades that single item to "needs clarification" rather than failing the whole request.
7. If `wallet_id` is absent for an item, Service resolves it to the caller's default Wallet (`is_default = true`); if the caller has no default Wallet, that item also downgrades to "needs clarification" (Edge Case #7).
8. Service pre-generates one `idempotency_key` (UUID) per item that survived steps 6–7.
9. **Intent resolution**: if at least one item survived, `intent = "create_transaction"` and those items appear in `actions[]` — even if other items from the same message were dropped (dropped items are described in the reply `message` text as needing clarification, they do not block the surviving items). If zero items survived, `intent = "ambiguous"` and `actions` is empty.
10. Service persists a `chat_messages` row (`role = "assistant"`, `intent`, rendered reply text) and returns `200` with `{ message, intent, actions[], conversation_id }` to the client. **Nothing is written to `transactions` at this point.**
11. Client renders a confirmation card per proposed action (or the clarifying question, if `intent = "ambiguous"`).
12. User taps "Confirm" on one or more cards. For each confirmed action, the client calls the existing `POST /transactions` with the proposed payload **plus** `idempotency_key` from step 8.
13. `POST /transactions` runs its full, unchanged validation and creation flow (`transaction-management/spec.md` US-01 steps 2–8), additionally checking `idempotency_key` uniqueness first (Resolved design decision #5) before any other check.
14. **Best-effort only, not required for correctness**: the originating `chat_messages` assistant row's `transaction_ids` may be updated to reference the newly created Transaction's `id`, for audit/display purposes. Exact mechanism (client-driven follow-up vs. Backend-side linkage) is left to `plan.md` — see Open Questions #8; a User's money and Transaction history are already fully correct after step 13 regardless of whether this linkage happens.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-AI-01 | Caller has a default Wallet "Cash Wallet" (VND) and an `expense` Category "Food" | Caller sends `"ăn trưa 50k"` | `200`; `intent = "create_transaction"`; 1 action: `amount: 50000, type: "expense", category_id: <Food>, wallet_id: <Cash Wallet>, occurred_at: today, confidence ≥ 0.6` | Happy path — single item, default wallet |
| S-AI-02 | Caller has an `income` Category "Salary" | Caller sends `"nhận lương 15 triệu"` | `200`; 1 action: `amount: 15000000, type: "income", category_id: <Salary>` | Happy path — income, "triệu" shorthand |
| S-AI-03 | Caller has `expense` Category "Food" | Caller sends `"hôm qua cơm tấm 30k và 2 trà đá 5k"` | `200`; 2 actions, both `category_id: <Food>`, `occurred_at`: yesterday's date; amounts `30000` and `10000` (2 × 5,000) | Happy path — multi-item, each with its own `idempotency_key` |
| S-AI-04 | Caller has Wallets "Cash" (default) and "MB Bank" | Caller sends `"đổ xăng 200k ví MB"` | `200`; 1 action with `wallet_id: <MB Bank>`, not the default | Happy path — explicit wallet mention overrides default |
| S-AI-05 | Caller's message names no Wallet; caller has a default Wallet set | Caller sends `"ăn trưa 50k"` | Proposed action uses the default Wallet | Covered by Main Flow step 7 |
| S-AI-06 | Caller has no Wallet marked `is_default = true` (edge configuration) | Caller sends a message with no Wallet mention | `200`; `intent = "ambiguous"`; 0 actions; reply asks the caller to specify a Wallet | ⚠️ Cannot silently guess a Wallet — see Edge Case #7 |
| S-AI-07 | — | Caller sends `"50k"` (no type or category signal) | `200`; `intent = "ambiguous"`; 0 actions; reply asks "Chi hay thu? Danh mục gì?" | Matches SRS acceptance scenario verbatim |
| S-AI-08 | AI Service returns a `transactions[]` item with `confidence = 0.4` | — | That item is dropped from `actions[]`; folded into the `ambiguous`/clarifying reply instead of being offered for confirmation | ⚠️ Threshold enforcement — never surface a sub-threshold proposal as confirmable |
| S-AI-09 | AI Service returns `category_id` that does not belong to the caller (hallucination or stale context) | — | Service treats that item as unresolved (same handling as S-AI-08); the ID is never surfaced to the client | ⚠️ Security-critical — Resolved design decision #4 |
| S-AI-10 | AI Service is unreachable or times out | Caller sends any message | `502 AI_SERVICE_UNAVAILABLE`; the `chat_messages` user-row is still persisted, no assistant row is created for this failed call | System error, not a validation error — retryable |
| S-AI-11 | — | Caller sends an empty message `""` | `400 INVALID_INPUT` | Validation error, handler-level |
| S-AI-12 | Caller has proposed action from S-AI-01 with `idempotency_key = K` | Client calls `POST /transactions` with that payload + `idempotency_key: K` | `201`; Transaction created, Wallet balance decremented — identical to a manual create | Confirm step — happy path |
| S-AI-13 | Same as S-AI-12, already confirmed once | Client calls `POST /transactions` again with the **same** `idempotency_key: K` (e.g. accidental double-tap) | `200` (not `201`); the original Transaction is returned; Wallet balance is **not** decremented a second time | ⚠️ Data-integrity critical — this is the entire reason for Resolved design decision #5 |
| S-AI-14 | Proposed action's Wallet balance has since dropped below the proposed `amount` (e.g. another Transaction was created in between propose and confirm) | Client confirms | `409 INSUFFICIENT_BALANCE` — the exact same response `transaction-management/spec.md` S-TRX-09 defines | No special-casing for AI-originated requests |
| S-AI-15 | No/invalid JWT | Caller calls `POST /ai/chat` | `401 UNAUTHENTICATED` | Authentication failure |
| S-AI-16 | Caller has sent 30 chat messages in the last hour (assumed limit — see Open Questions #1) | Caller sends a 31st message | `429 RATE_LIMITED` | ⚠️ Explicit `docs/features.md` §6 constraint: watch Groq/Anthropic API budget. Rate limit applies only to `POST /ai/chat` (the LLM-calling endpoint) — the confirm step (`POST /transactions`) carries no additional limit beyond whatever it already has today |
| S-AI-17 | Caller has zero non-deleted Wallets | Caller sends any transaction-shaped message | `200`; `intent = "ambiguous"`; 0 actions; reply explains a Wallet is needed first | Mirrors `transaction-management/spec.md`'s own "at least one Wallet must exist" precondition — not a system error |
| S-AI-18 | — | Caller sends `{ message: "ăn trưa 50k", conversation_id: "not-a-uuid" }` | `400 INVALID_INPUT` | Handler-level shape validation, before any AI Service call — mirrors S-AI-11 |

### Edge Cases
1. **The AI Service is untrusted input for authorization** (Resolved design decision #4) — every returned Wallet/Category ID is re-validated for ownership before ever reaching the client; a failed check silently downgrades that one item, it never surfaces the foreign ID or a generic 500.
2. **Idempotency key is generated once, server-side, per proposed action** (not by the client, not by the AI Service) — guarantees a double-tap confirm converges to exactly one Transaction via the new partial unique index on `transactions(user_id, idempotency_key)`. A reused key with a *different* body is not treated as an update attempt; the stored Transaction from the first successful call is simply returned as-is (S-AI-13's guarantee holds regardless of body drift).
3. **Multi-item messages are not all-or-nothing at confirm time.** Each action has its own `idempotency_key`; the client calls `POST /transactions` once per confirmed action. A partial failure (e.g. the second item hits `INSUFFICIENT_BALANCE`) does not roll back the first item's already-created Transaction — mirrors `transaction-management/spec.md`'s explicit "no batch endpoint" Out-of-Scope note; this feature does not introduce one either.
4. **Confidence threshold (0.6) is a hard gate, not a UI hint** — an item below threshold never appears in `actions[]` for confirmation; it is folded into the clarifying `message` text instead (S-AI-08).
5. **No conversation history is fed to the AI Service** — every `POST /ai/chat` call is independently evaluated; a follow-up message like "à quên, 55k chứ không phải 50k" is treated as a brand-new, unrelated message in this spec's scope (Resolved design decision #6) — not stitched to the prior proposal. Multi-turn correction is Out of Scope (see below).
6. **`POST /transactions`'s existing rules are completely unchanged for AI-originated confirms** — the insufficient-balance floor, `category.type` match, ownership checks, and every scenario in `transaction-management/spec.md` US-01 apply identically (S-AI-14); this feature adds exactly one new optional field (`idempotency_key`) and nothing else to that endpoint's contract.
7. **A caller with zero Wallets, or with Wallets but none marked default and the message names none, cannot have any action proposed** — resolved as `ambiguous` (S-AI-06, S-AI-17), never a guessed Wallet and never a system error.

### Client UI States (`frontend/src/features/ai-chat/`)

| State | Trigger | Expected UI |
|---|---|---|
| Empty | Caller opens AI Chat with no prior messages this session | An initial assistant greeting/prompt is shown; no confirmation cards |
| Loading | Caller has sent a message; `POST /ai/chat` is in flight | The user's message appears immediately (optimistic); a loading indicator shows in place of the assistant's reply until the response (or error) arrives |
| Success — proposal | `200` with `intent = "create_transaction"` and 1+ `actions[]` | One confirmation card per action, each independently confirmable (S-AI-03: multi-item messages render multiple cards, not one merged card) |
| Success — needs clarification | `200` with `intent = "ambiguous"` (zero actions, or some items dropped per Main Flow step 9) | The assistant's clarifying question is shown as plain text; no confirmation card for the dropped/ambiguous portion |
| Confirmed | Caller taps "Confirm" on a card and `POST /transactions` returns `201` or `200` (idempotent replay) | That card updates in place to a confirmed/success state (e.g. checkmark); it does not disappear silently |
| Error — AI Service down | `502 AI_SERVICE_UNAVAILABLE` (S-AI-10) | An inline error message with a retry affordance; the user's original message remains visible and re-sendable |
| Error — rate limited | `429 RATE_LIMITED` (S-AI-16) | An inline message indicating too many requests; no silent drop |
| Error — confirm-time validation failure | e.g. `409 INSUFFICIENT_BALANCE` (S-AI-14) | The specific confirmation card shows its own error state (mirrors `transaction-management`'s existing create-form error display) — other, unrelated cards from the same proposal are unaffected |

### Definition of Done
- `ai-service/` exists with a FastAPI health check and one internal extraction endpoint, reachable from the Go Backend over the internal Docker network, using the existing Groq-primary/Anthropic-fallback client per `CLAUDE.md`.
- `POST /api/v1/ai/chat` implemented: loads the caller's own Wallets/Categories as context, calls the AI Service, re-validates ownership of every returned ID, applies the 0.6 confidence gate, resolves the default Wallet when unmentioned, persists `chat_messages` rows, and never writes to `transactions` directly.
- `POST /api/v1/transactions/` accepts an optional `idempotency_key` field; a repeat request with a previously-used key (for that `user_id`) returns the original Transaction (`200`) instead of creating a duplicate — enforced by a partial unique index, not only in-process logic.
- New migrations: additive `idempotency_key` column + partial unique index on `transactions`; new `chat_messages` table.
- Unit tests for S-AI-08, S-AI-09, S-AI-11, S-AI-17 pass. Integration tests for S-AI-01 through S-AI-05, S-AI-10, S-AI-12 through S-AI-16 pass. A concurrency/double-submit test for S-AI-13 passes.
- No test asserts that a sub-0.6-confidence item is ever present in a `200` response's `actions[]`.

### Idempotency
`POST /ai/chat` itself is not idempotent (each call may consult a live LLM and persist new `chat_messages` rows on every call — resending the same message is a new proposal, not a replay). The **confirm step** (`POST /transactions` with `idempotency_key`) is idempotent by construction (Resolved design decision #5, S-AI-13) — this is the first MVP/Release-1 write endpoint in the project to carry an explicit idempotency key, closing `transaction-management/spec.md`'s Open Questions #2.

---

## Out of Scope (this spec)

- **SRS US-02 (Edit a Transaction via Chat), US-03 (Query Spending via Chat), US-04 (General Advice)** — not specced here; each needs its own BA pass. `PUT /transactions/{id}` (named in `SDS.md` §6 for the edit flow) is not implemented by this spec.
- **Multi-turn conversation / follow-up corrections** ("à quên, 55k chứ không phải 50k") — every call is stateless (Resolved design decision #6, Edge Case #5).
- **Voice input (STT) or receipt OCR** — no basis in SRS Feature-12 for this cut.
- **`categories.description` field / description-based disambiguation** — deferred (Resolved design decision #9, Open Questions #5); this cut matches by Category name only.
- **A batch/atomic multi-transaction confirm endpoint** — multi-item messages confirm via repeated single `POST /transactions` calls (Edge Case #3), consistent with `transaction-management/spec.md`'s existing "no batch endpoint" boundary.
- **Client-supplied `active_wallet_id` context hint** (present in the original product proposal) — dropped for this cut; Wallet resolution is either an explicit mention in the message or the caller's default Wallet (Open Questions #7).
- **Exact AI Service prompt design, Groq/Anthropic model routing/selection, and fallback trigger conditions** — internal implementation detail for `plan.md`/dev, not a business rule this spec fixes (Open Questions #2).
- **Any specific rate-limit number** — the *requirement* for a rate limit is in scope (S-AI-16), the exact threshold is not (Open Questions #1).
- **Admin visibility into any User's chat history** — `chat_messages` is exactly as personal as `transactions`; no admin endpoint is introduced.

## Open Questions

1. **Rate limit threshold for `POST /ai/chat`**: this spec requires *some* limit exists (S-AI-16, given `docs/features.md` §6's explicit Groq/Anthropic budget concern) but assumes 30 requests/hour/user as a placeholder, with no SRS/SDS-stated number. Recommend confirming an actual threshold before implementation, mirroring how `/auth/login`'s rate limit was presumably set — check that precedent for a consistent pattern.
2. **AI Service provider routing details** (Groq primary, Anthropic fallback): the exact fallback trigger (timeout duration? specific Groq error codes? rate-limit response?) is left to `plan.md`/implementation — this spec only requires that a Groq outage degrades to a retryable `502`, never a crash or silent data loss.
3. **Confidence threshold = 0.6**: carried over from the SRS acceptance criteria, itself inherited from the original product proposal rather than derived from this project's own prior conventions. Recommend explicit product sign-off before implementation, since it directly controls how often a User is asked to clarify vs. how often a wrong-category proposal might slip through.
4. **Should `idempotency_key` on `POST /transactions` be documented/exposed as a general-purpose field for any client, or treated as an internal-only mechanism the AI Chat flow happens to use?** This spec recommends the general-purpose framing (already written into `transaction-management/spec.md`'s own Open Questions #2 as the eventual fix) — no reason to restrict it to chat-originated requests only.
5. **`categories.description` for disambiguation**: deferred for this cut (Resolved design decision #9). Revisit if real usage shows name-only matching insufficient for categories with similar names but different intended meaning.
6. **Max message length**: this spec assumes 1000 characters (explicit assumption, Main Flow step 2) — no source document specifies a limit. Confirm before implementation; low priority.
7. **Dropping `active_wallet_id` context hint**: the original product proposal included an optional "currently active wallet" hint from the client. This spec drops it for simplicity (message-mention-or-default only). Confirm this is acceptable, or whether the web UI's "currently selected wallet" context should be threaded through after all.
8. **Linking a confirmed Transaction back to its originating `chat_messages` row** (Main Flow step 14) is explicitly best-effort, not required for correctness — exact mechanism (client calls a small follow-up endpoint vs. the confirm call itself accepting an optional back-reference) is left to `plan.md`. Confirm whether this audit trail is valuable enough to build in this pass or can slip to a later enhancement.
