# Feature Spec: Feature-12 AI Chat Assistant — Record Transactions from an Image (Release 1)

> Source: `specs/mobile-ux-batch-2026-10/research.md` (feasibility research, approved by the product owner, corrected 2026-10-04 — Option C: a vision-capable AI reads the image and returns Transaction proposals). SRS Feature-12 / FR-09 / BF-10 (AI Chat Assistance).
> Status: Specced 2026-10-04; product-owner decisions of 2026-10-04 folded in (currency, every proposal shown, limits, handwriting). SRS story: Feature-12 US-05 (added 2026-10-04).
> Amended 2026-10-11: a receipt proposal carries the receipt's Items and Adjustments ([Items of a Transaction](../transaction-line-items/spec.md)) instead of splitting line items into separate proposals — BR-03, AC-05, S-AIIMG-02 changed; BR-15, AC-41–AC-43, S-AIIMG-52–S-AIIMG-55, EC-27–EC-28 added.
> Related: [Feature-12 US-01 Create a Transaction via Chat](../ai-chat-assistant/spec.md) (proposal → confirm model, idempotency key, ownership re-validation, all reused) · [F-06 Transaction Management](../transaction-management/spec.md) (the confirm step) · [Transaction import](../transaction-export-import/spec.md) (the exact path for real spreadsheet files)
> Clients: **`mobile/` only.** `frontend/` (web) is frozen — see Out of Scope.

## Context

Today a User records a Transaction in the AI Chat by typing a sentence ("ăn trưa 50k"). Much of what a User wants to record already exists as a picture: a printed receipt or bill, a handwritten note of the day's spending, or a screenshot of a spreadsheet they keep. Re-typing it is slow and error-prone.

This feature lets the User attach one image in the AI Chat's recording conversation. The System reads it and replies with one Transaction proposal per expense or income it finds, each rendered as the same proposal card the text flow already uses. Nothing is saved until the User confirms each card — exactly like a typed message.

Three kinds of image are in scope, with different expected output:

| Image kind | Expected proposals |
|---|---|
| Printed receipt / bill | **One** proposal: the total payable, carrying the receipt's Items and Adjustments when it lists them. |
| Handwritten note | **One per written entry** (e.g. "cafe 45k, xăng 80k"). |
| Spreadsheet screenshot | **One per data row**; header, subtotal and total rows are never proposals. |

A real spreadsheet *file* is not an image — it goes through the existing Transaction import, which is exact. This feature covers only a *picture* of a sheet.

Two defects in today's typed-message flow block this feature and are fixed first, as stories that ship on their own (US-04, US-05):
- A proposal can be attached to a Wallet in another currency while its amount is read as VND, so "45k" typed against a USD Wallet would be booked as 45,000 USD.
- When one reply holds several proposals, the app shows only the first; the others are silently lost.

**Actors**
- **User** — any `active` user (`admin` or `member`); the feature is personal.
- **AI Service** — internal system actor, called only by the Backend, never by the client. Treated as untrusted input for authorization and for amounts.

**Resolved design decisions**
1. **Proposals only, never auto-saved.** Every proposal needs its own explicit Confirm; the confirm step is the existing Transaction create with its existing idempotency key and every existing validation rule unchanged.
2. **The image is transient.** It is used for one reading and then discarded. It is never stored by the System, never written to any log, never part of the chat history that syncs across the User's devices. Only the fields of a Transaction the User confirms are ever stored.
3. **One image per request** in this release.
4. **The User's own Wallets and Categories are the only things a proposal may reference** — re-validated by the Backend exactly as in the text flow.
5. **An accuracy check on real Vietnamese samples gates the build.** It is the first phase of the plan; if it fails for receipts or spreadsheet screenshots, the feature does not proceed as specced (see Preconditions).
6. **VND only.** Every amount the AI reads is VND, and a proposal may only be attached to a VND Wallet — for image and typed proposals alike (BR-13). Multi-currency reading is a later release.
7. **Limits confirmed by the product owner:** 10 image readings per hour per User, at most 20 proposals per image, caption at most 300 characters. The exact values are owned by the plan; this spec refers to them as "the image limit", "the maximum proposals" and "the caption maximum".
8. **Handwriting ships either way.** If the accuracy check shows handwritten notes below the pass bar, they are still accepted, but every proposal read from a handwritten note carries the low-confidence label (BR-09). No extra gate or PIN — every proposal already needs an explicit Confirm.
9. **Every proposal in a reply gets its own card**, for typed and image replies alike (BR-14).
10. **Cheapest option with the biggest impact** is the tie-breaker for any remaining design choice.

### Business Rules

| ID | Rule |
|---|---|
| BR-01 | ⚠️ A proposal is never saved without the User's explicit Confirm on that proposal (or on a "confirm all" the User triggers on the existing pending-review screen). |
| BR-02 | ⚠️ Money: every amount is an integer number of xu (VND minor unit, 1 đồng = 100 xu), never a fractional value at any step. The AI reads whole đồng; a value read with a fractional part is not rounded — that entry is skipped and counted as unreadable. Currency: VND only; no conversion at any step (BR-13). |
| BR-03 | ⚠️ A receipt yields **one** proposal for its **total payable**, never the cash handed over, the change returned, a subtotal, or a tax line as a separate proposal. Its line items and its tax, fee and discount lines are attached to that proposal as Items and Adjustments (BR-15), not proposed separately. |
| BR-04 | ⚠️ The System never invents an entry that is not visibly present in the image. Header, subtotal and total rows of a sheet are never proposals. |
| BR-05 | The System never invents a date. A printed or written date is used as the Transaction date (day/month order, Vietnamese convention). When none is visible, the current date is used and the proposal carries the low-confidence label. A date in the future also carries the label. |
| BR-06 | At most the maximum proposals per image. When the image holds more, the first entries in reading order are proposed and the reply says the rest were not read. |
| BR-07 | Each proposal resolves to one of the User's own Wallets (the one named in the caption, else the default Wallet, then adjusted by BR-13) and one of the User's own Categories of the matching type (expense/income). An entry whose Category cannot be resolved is skipped and counted, never guessed onto another User's data. |
| BR-08 | Each proposal carries its own pre-generated idempotency key; confirming the same proposal twice creates exactly one Transaction (existing guarantee). |
| BR-09 | A proposal the AI is unsure about (low confidence, missing date, future date) — and, when handwriting did not pass the accuracy check, every proposal read from a handwritten note — visibly carries a "low confidence" label on its card (shown to the User in Vietnamese as "Độ tin cậy thấp"). |
| BR-10 | Image reading has its own usage limit per User, separate from (and not consuming) the typed-message limit. |
| BR-11 | Image capture is available only while the device is online. |
| BR-12 | Images over the accepted size or of an unaccepted type are refused before any reading happens. |
| BR-13 | ⚠️ A proposal (typed or image) is only ever attached to a VND Wallet. If the Wallet named or chosen is not VND, the System uses the default Wallet when it is VND, else the User's earliest-created VND Wallet. If the User has no VND Wallet, the proposal is returned without a Wallet and cannot be saved until the User picks a VND Wallet for it (US-04). The amount is never converted. |
| BR-14 | Every proposal in one reply is shown as its own card, in the order returned, for typed and image replies alike. No proposal is dropped. |
| BR-15 | ⚠️ A receipt proposal carries the Items and Adjustments read from the receipt, following the Item rules of [Items of a Transaction](../transaction-line-items/spec.md). When they do not add up to the total payable (that spec's balance rule), the proposal keeps the total and the Items, carries the low-confidence label, and cannot be saved directly: Confirm opens the edit form, where the User fixes the gap or removes the Items, and "confirm all" on the pending-review screen skips it and counts it as not saved. When the receipt lists more lines than the item maximum, the proposal carries no Items and the lead-in says the Items were not attached. Handwritten notes and spreadsheet screenshots never produce Items. |

### Key Entities

| Entity | Role in this feature |
|---|---|
| Image capture | Transient. One picture plus an optional caption, sent once for reading. Never stored by the System. |
| Transaction proposal | The existing proposal (amount, type, Category, Wallet, date, note, confidence, idempotency key). One per entry read. The Wallet may be absent when the User has no VND Wallet (BR-13). A receipt proposal may carry Items and Adjustments (BR-15). |
| Transaction | Created only on Confirm, through the existing create flow. |
| Chat thread | The existing per-User thread. Gains an "image" user message (thumbnail kept on this device only) and one message per proposal. |
| Wallet | Read-only context; ownership re-validated; only VND Wallets may receive a proposal. |
| Category | Read-only context; ownership re-validated. |

---

## Preconditions (feature-level)

- US-04 and US-05 have shipped (or ship in the same release, before US-01 is enabled).
- The accuracy check (plan Phase 0) has passed for printed receipts and spreadsheet screenshots. Handwritten notes ship whatever their result (Resolved design decision 8).
- The User is authenticated and has at least one non-deleted Wallet (else the reply explains a Wallet is needed — EC-10).
- The device is online (BR-11). Detecting "offline" depends on the offline-support feature being specced in parallel (`specs/mobile-ux-batch-2026-10/research-offline.md`); until it ships, a failed request due to no network shows the no-connection error state instead (US-01 UI states).
- The AI Service has at least one working vision-capable provider configured.

---

## US-01: Capture or choose an image and receive Transaction proposals

**As a** User,
**I want** to take a photo of (or pick from my library) a receipt, a handwritten note, or a spreadsheet screenshot in the AI Chat,
**so that** the System proposes the matching Transactions without me typing them.

**API:** `POST /api/v1/transactions/image-proposals` (proposal step only — writes nothing).

### Preconditions
- AI Chat is in recording mode (not the analysis/consult mode).
- Feature-level preconditions hold.

### Main Flow
1. User taps the attach-image button next to the recording input.
2. System offers two choices: take a photo, or choose from the library.
3. User picks one; System asks for the corresponding device permission the first time.
4. User takes or picks a photo.
5. System shows a preview of the image with an optional caption field (e.g. "ví MB") and Send / Cancel.
6. User taps Send.
7. System reduces the image to a size that is still legible, posts the User's message in the thread (a small thumbnail plus the caption, if any), and shows the typing indicator.
8. Backend checks the image's size and type, loads the User's own Wallets and Categories, and sends the image, caption, Wallets, Categories and the current date to the AI Service.
9. AI Service reads the image according to BR-02 to BR-06, notes whether the image is a handwritten note, and returns the entries it found.
10. Backend validates each entry (BR-07), applies the VND Wallet rule (BR-13), applies the low-confidence label (BR-09), pre-generates an idempotency key for each surviving entry (BR-08), and discards the image.
11. Backend replies with a short lead-in (how many proposals, how many are low confidence, whether entries were skipped or not read) and the list of proposals.
12. System shows the lead-in, then one proposal card per entry, in reading order (BR-14).

### Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-01 | The attach-image button is shown only in recording mode. It is disabled while a reply is pending and while the device is offline. |
| AC-02 | The User can choose camera or library. Cancelling either returns to the chat with nothing sent. |
| AC-03 | A preview with an optional caption is always shown before anything is sent; Cancel discards the image. |
| AC-04 | After Send, the User's message shows a thumbnail of the image and the caption.<br>Tapping the thumbnail opens the image full-screen on this device. |
| AC-05 | A printed receipt produces one proposal for the total payable (BR-03).<br>Its line items and tax, fee and discount lines appear on that proposal as Items and Adjustments (BR-15), never as separate proposals. |
| AC-06 | A handwritten note produces one proposal per entry, with Vietnamese shorthand understood ("45k" = 45,000 đ, "1tr2" = 1,200,000 đ, "5m" = 5,000,000 đ).<br>When handwriting did not pass the accuracy check, every proposal from a handwritten note carries the low-confidence label. |
| AC-07 | A spreadsheet screenshot produces one proposal per data row; header, subtotal and total rows produce none (BR-04). |
| AC-08 | Every proposal amount is an integer number of xu of VND (BR-02), and every proposal's Wallet is a VND Wallet or absent (BR-13). |
| AC-09 | Dates follow BR-05; a proposal without a visible date, or with a future date, carries the low-confidence label. |
| AC-10 | When the image holds more entries than the maximum proposals, only the maximum is proposed and the lead-in says some entries were not read (BR-06). |
| AC-11 | Entries that could not be resolved are not shown as cards; the lead-in states how many were skipped. |
| AC-12 | An image with no recognizable expense or income yields no cards and a reply suggesting a clearer photo or typing instead. |
| AC-13 | Image reading has its own limit (BR-10); hitting it never blocks typed messages, and typed messages never use it up. |
| AC-14 | Nothing is saved as a Transaction by this step. |
| AC-41 | A receipt proposal card shows its Item count and can be expanded to list its Items and Adjustments. |
| AC-42 | ⚠️ A receipt proposal whose Items and Adjustments do not add up to its total carries the low-confidence label, and Confirm opens the edit form instead of saving (BR-15). |
| AC-43 | Confirming a receipt proposal saves the Transaction together with its Items and Adjustments, or nothing; a repeated confirm never duplicates them. |

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-AIIMG-01 | User has a default Wallet (VND) and an expense Category "Ăn uống" | User sends a photo of a printed café receipt, total 145,000 đ, dated 02/10/2026 | `200`; 1 proposal: expense, 14,500,000 xu, "Ăn uống", default Wallet, date 2 Oct 2026 | Happy path — receipt total |
| S-AIIMG-02 | Same | A supermarket receipt with 12 line items, VAT 8,000 đ, total 108,000 đ | `200`; **one** proposal of 10,800,000 xu carrying 12 Items and a tax Adjustment of 8,000 đ; no proposal per line item | BR-03, BR-15 |
| S-AIIMG-03 | ⚠️ Receipt shows total 145,000, cash given 200,000, change 55,000 | User sends it | 1 proposal of 145,000 đ — never 200,000 or 55,000 | BR-03 |
| S-AIIMG-04 | User has expense Categories for food and transport | User sends a handwritten note "cafe 45k, xăng 80k, 2/10" | `200`; 2 proposals: 4,500,000 xu and 8,000,000 xu, both dated 2 Oct of the current year; when handwriting did not pass the accuracy check, both carry the low-confidence label | AC-06, BR-09 |
| S-AIIMG-05 | Note says "tiền nhà 1tr2" | User sends it | 1 proposal of 120,000,000 xu | Shorthand "tr" |
| S-AIIMG-06 | Screenshot of a sheet: header row + 5 data rows + a "Tổng" row | User sends it | `200`; exactly 5 proposals; no proposal for the header or total row | ⚠️ BR-04 phantom rows |
| S-AIIMG-07 | Sheet screenshot with more rows than the maximum proposals | User sends it | Exactly the maximum number of proposals (first rows in reading order); lead-in says remaining rows were not read | BR-06 |
| S-AIIMG-08 | Receipt has no readable date | User sends it | Proposal dated today, with the low-confidence label | BR-05 |
| S-AIIMG-09 | Note's date reads as a future day (e.g. misread year) | User sends it | Proposal keeps that date, with the low-confidence label | BR-05 |
| S-AIIMG-10 | AI returns an entry whose Category belongs to another User, or whose type does not match | — | That entry is skipped and counted in the lead-in; its identifier never reaches the client | ⚠️ BR-07 security |
| S-AIIMG-11 | AI reads an amount with a fractional part (e.g. "12.5") | — | That entry is skipped and counted; no rounding | ⚠️ BR-02 |
| S-AIIMG-12 | Photo of a landscape / blank page | User sends it | `200`; 0 proposals; reply suggests a clearer photo or typing | AC-12 |
| S-AIIMG-13 | User has zero Wallets | User sends any image | `200`; 0 proposals; reply says a Wallet is needed first; the AI Service is not called | Mirrors text flow |
| S-AIIMG-14 | User has Wallets but none is default, and the caption names none | User sends a receipt | `200`; 0 proposals; reply asks which Wallet to use | Mirrors text flow |
| S-AIIMG-15 | Caption names the "MB Bank" Wallet (VND) | User sends a receipt | Proposal uses "MB Bank", not the default | Wallet from caption |
| S-AIIMG-16 | — | Image larger than the accepted size reaches the Backend | `413 IMAGE_TOO_LARGE`; nothing is read | Validation error (client) |
| S-AIIMG-17 | — | File that is not an accepted image type (e.g. a PDF renamed .jpg) | `415 UNSUPPORTED_IMAGE_TYPE` | Validation error — checked on the content, not the name |
| S-AIIMG-18 | — | Request with no image, or a caption over the caption maximum | `400 INVALID_INPUT` | Validation error |
| S-AIIMG-19 | No/invalid access token | Any request | `401 UNAUTHENTICATED` | — |
| S-AIIMG-20 | User has used up the image limit | User sends another image | `429 RATE_LIMITED`; typed messages still work | AC-13 |
| S-AIIMG-21 | User has used up the typed-message limit | User sends an image | Image is read normally | AC-13 |
| S-AIIMG-22 | Every AI provider is down or times out | User sends an image | `502 AI_SERVICE_UNAVAILABLE`; retryable | System error |
| S-AIIMG-23 | Device is offline | User opens recording mode | Attach-image button is disabled with an explanation | BR-11 |
| S-AIIMG-24 | User denies camera permission | User chooses "take a photo" | Message explaining how to allow it in settings; library choice still works | — |
| S-AIIMG-52 | ⚠️ Receipt lines read as 100,000 đ, no tax line, total 108,000 đ | User sends it | 1 proposal of 108,000 đ with the Items; low-confidence label; Confirm opens the edit form showing the 8,000 đ gap | BR-15, AC-42 |
| S-AIIMG-53 | Receipt with more lines than the item maximum | User sends it | 1 proposal for the total, no Items; lead-in says the Items were not attached | BR-15 |
| S-AIIMG-54 | Receipt with a discount line of 20,000 đ | User sends it | 1 proposal for the total; Items plus a discount Adjustment of 20,000 đ; they add up to the total | BR-15 |
| S-AIIMG-55 | ⚠️ Proposal from S-AIIMG-02 | User confirms it twice (double tap) | One Transaction with one set of 12 Items and 1 Adjustment; balance moves once | AC-43 |

### Edge Cases
- **EC-01** ⚠️ Mis-read amount (e.g. 45.000 read as 450.000): never saved automatically; the thumbnail stays next to the cards so the User can compare; uncertain readings carry the low-confidence label. The User corrects via the existing proposal edit before confirming.
- **EC-02** ⚠️ Phantom entry (the AI "sees" an entry that is not there): BR-04 forbids it; every proposal still needs its own Confirm; the User discards it with the existing discard action.
- **EC-03** ⚠️ Same receipt sent twice: produces a second, independent set of proposals with new idempotency keys. Confirming both creates duplicate Transactions. Not detected in this release — Open Questions #2.
- **EC-04** Thousands separators: "45.000" and "45,000" both mean 45,000 đ (Vietnamese convention uses "." as the thousands separator). A value that is genuinely ambiguous carries the low-confidence label.
- **EC-05** ⚠️ Receipt priced in a currency other than VND (e.g. "$12"): this release reads VND only. Such entries are not proposed and are counted as not read in the lead-in — never proposed as 12 đ.
- **EC-06** Income images (e.g. a bank-transfer screenshot showing money received) produce income proposals with an income Category.
- **EC-07** Image partially readable: readable entries are proposed; the rest are counted as skipped.
- **EC-08** Very large original photo: the client reduces it before sending; if it is still too large, the client shows the too-large error without sending.
- **EC-09** User leaves the chat screen while the reply is pending: the reply is still added to the thread when it arrives (same as a typed message).
- **EC-10** Zero Wallets: answered without calling the AI Service (S-AIIMG-13); still counts as one use of the image limit.
- **EC-11** An image was sent while online and the network drops mid-request: shown as the no-connection error; the User can retry from the thread while the image is still on the device.
- **EC-12** A spreadsheet screenshot with a "Type" column (thu/chi): that column decides expense vs income per row.
- **EC-13** Handwriting with a crossed-out entry: crossed-out entries are not proposed.
- **EC-14** The default Wallet is not VND: BR-13 applies — proposals go to the User's earliest-created VND Wallet, or are returned without a Wallet when there is none (US-04).
- **EC-15** A handwritten note mistaken by the AI for a printed receipt: its proposals carry the label only if they are uncertain for another reason. Accepted risk — every proposal still needs its own Confirm next to the thumbnail.
- **EC-27** The User removes every Item from a receipt proposal in the edit form: it is saved as a plain Transaction of the total.
- **EC-28** A receipt line read with a quantity that is not a whole number (e.g. 0.45 kg): it becomes one Item of quantity 1 whose name carries the weight, with the printed line amount.

### Client UI States (`mobile/`, recording mode)

| State | Trigger | Expected UI |
|---|---|---|
| Idle | Recording mode, online | Attach-image button enabled next to the input |
| Disabled | Offline, or a reply pending | Attach-image button disabled; offline shows a short explanation on tap |
| Choosing | Button tapped | Two choices: take a photo / choose from library |
| Preview | Image taken/picked | Full image, optional caption field, Send and Cancel |
| Loading | Sent | User message with thumbnail + caption; typing indicator |
| Success — proposals | `200` with proposals | Lead-in text, then one card per proposal; uncertain cards show the low-confidence label |
| Success — proposal without a Wallet | `200`, User has no VND Wallet | Card shows "no Wallet" and a message that a VND Wallet must be chosen (US-04) |
| Success — nothing found | `200` with no proposals | Reply text suggesting a clearer photo or typing; manual-entry offer |
| Error — too large / wrong type | `413` / `415` (or caught on device) | Inline message; nothing sent to the thread |
| Error — busy / unavailable | `429` / `502` | Reply bubble "system busy" with manual-entry offer and a retry for this image |
| Error — no connection | Network failure | Reply bubble "no connection" with retry |
| Error — permission denied | Permission refused | Message pointing to device settings |

All user-facing text is in Vietnamese.

### Definition of Done
- [ ] Attach-image button, choice sheet, preview with caption, thumbnail message and full-screen view work on a real device in Expo Go (SDK 54).
- [ ] The proposal endpoint returns proposals for receipt, handwritten-note and spreadsheet-screenshot images with amounts as integer xu of VND and every BR-02 to BR-07 and BR-13 rule enforced.
- [ ] S-AIIMG-01 to S-AIIMG-24 pass (automated where they touch Backend/AI Service; manual on device for UI states).
- [ ] The image limit is separate from the typed-message limit, both ways (S-AIIMG-20, S-AIIMG-21).
- [ ] No Transaction is created by the proposal step (verified by test).

---

## US-02: Review and confirm image-derived proposals

**As a** User,
**I want** to check each proposal read from my image against the picture and confirm, edit, or discard it,
**so that** only correct Transactions end up in my records.

**API:** existing `POST /api/v1/transactions` (confirm, with the proposal's idempotency key) and existing `PATCH /api/v1/transactions/:id` (edit after confirm). No new write endpoint.

### Preconditions
- US-01 returned one or more proposals.

### Main Flow
1. System shows one card per proposal (amount, Category, Wallet, date, note, budget impact — same card as typed proposals) plus the low-confidence label where applicable.
2. User compares a card with the thumbnail (tap to enlarge).
3. User confirms, edits, or discards each card independently — the same actions typed proposals already have.
4. On Confirm, System creates the Transaction through the existing create flow with that proposal's idempotency key; the card collapses to its saved state.
5. Unconfirmed image proposals also appear in the existing pending-review list, where the existing "confirm all" saves them one by one.

### Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-15 | Each proposal from one image is an independent card: confirming, editing or discarding one never changes another. |
| AC-16 | ⚠️ Confirming the same card twice (double-tap, retry after a timeout) creates exactly one Transaction and moves the Wallet balance once (BR-08). |
| AC-17 | Editing an unconfirmed card replaces its fields before saving and issues it a fresh idempotency key (existing behavior); editing a confirmed card updates the saved Transaction, never creates a second one. |
| AC-18 | A confirm that fails validation (e.g. insufficient balance) shows the error on that card only; other cards are unaffected. |
| AC-19 | Image proposals appear in the pending-review list and are saved by "confirm all" one at a time, in order. |
| AC-20 | Confirming an image proposal never records the caption as a "recent phrase" suggestion. |
| AC-21 | The low-confidence label is shown on image proposals that BR-09 marks, until the User edits or confirms the card. |

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-AIIMG-25 | 2 proposals from S-AIIMG-04 | User confirms the first | `201`; one Transaction; the second card stays pending | AC-15 |
| S-AIIMG-26 | ⚠️ Card already confirmed | Confirm is sent again with the same idempotency key | `200` with the original Transaction; balance unchanged | AC-16 |
| S-AIIMG-27 | Card shows 450,000 đ, receipt shows 45,000 đ | User edits the amount to 45,000 đ and confirms | Transaction saved with 4,500,000 xu; edit history shows both values | EC-01 |
| S-AIIMG-28 | A phantom proposal | User discards it | No Transaction; card shows the discarded state | EC-02 |
| S-AIIMG-29 | Wallet balance too low for the second of 3 cards | User uses "confirm all" in pending review | Cards 1 and 3 saved; card 2 stays pending with the balance error; summary says 2 saved, 1 not | AC-18, AC-19 |
| S-AIIMG-30 | Confirmed card | User edits its Category | The existing Transaction is updated; no second Transaction | AC-17 |

### Edge Cases
- **EC-16** A card confirmed on one device and shown on another (thread restored): it shows as saved — the saved state travels with the thread; the image thumbnail does not (US-03).
- **EC-17** The User deletes a confirmed image Transaction later: same tombstone behavior as typed proposals.
- **EC-18** The User's Category or Wallet used by a pending card is deleted before confirm: confirm fails with the existing not-found/validation error on that card.

### Definition of Done
- [ ] S-AIIMG-25 to S-AIIMG-30 pass on device.
- [ ] A double-confirm test proves one Transaction and one balance change (S-AIIMG-26).
- [ ] Every proposal of a multi-entry image is its own card in the thread and in pending review — none is dropped.

---

## US-03: Keep the image private and off the server

**As a** User,
**I want** my receipt photos (which can show my name, card digits or address) to stay on my phone,
**so that** using this feature does not expose personal data.

**API:** none new; affects the existing chat thread sync and logout.

### Main Flow
1. The image is sent once for reading (US-01) and discarded by the System right after.
2. The thread on this device keeps a local thumbnail for the User's own message.
3. When the thread syncs to the server, the image message travels as text only (the caption, or a short "photo" label) — never the picture or its on-device location.
4. On logout, System deletes every locally kept capture together with the local thread.

### Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-22 | The System never stores the image, and never writes the image, the caption or the read entries to any server log. Only confirmed Transaction fields are stored. |
| AC-23 | The synced thread never contains the image or a reference to where it is kept on the device. |
| AC-24 | On a restored thread (new device, reinstall), the image message shows a "photo" placeholder instead of the thumbnail; its proposals are intact. |
| AC-25 | If the local thumbnail is no longer available on this device, the same placeholder is shown — never a broken image. |
| AC-26 | Logout removes all locally kept captures. |
| AC-27 | The User's image message cannot be edited as text (editing would re-run a typed reading). It can still be removed like other messages. |
| AC-28 | The on-device debug console never shows the image contents. |

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-AIIMG-31 | User sent an image | The thread syncs | The synced copy of that message has the caption/label but no image and no device path | AC-23 |
| S-AIIMG-32 | User logs in on a second device | Thread restores | Image message shows the placeholder; cards keep their state | AC-24 |
| S-AIIMG-33 | User logs out | — | Local captures are deleted | AC-26 |
| S-AIIMG-34 | Server logs reviewed after S-AIIMG-01 | — | No image bytes, no caption, no amounts or notes from the image in any log line | AC-22 |
| S-AIIMG-35 | User long-presses or swipes their image message | — | No text-edit option | AC-27 |

### Edge Cases
- **EC-19** The device clears its cache: thumbnail falls back to the placeholder (AC-25).
- **EC-20** A failed reading (e.g. `502`) keeps the local image so the User can retry; it is cleaned up with the thread at logout like any other capture.

### Definition of Done
- [ ] S-AIIMG-31 to S-AIIMG-35 pass.
- [ ] A review of Backend and AI Service code paths confirms no logging of image, caption or extracted values.

---

## US-04: Attach AI proposals only to VND Wallets (pre-requisite fix — typed and image)

> Ships on its own, before US-01. Fixes the existing typed-message flow as well.

**As a** User,
**I want** every AI proposal to land in a Wallet whose currency matches the amount I meant (VND),
**so that** "45k" is never booked as 45,000 of another currency.

**API:** existing `POST /api/v1/ai/chat` (typed proposals) and `POST /api/v1/transactions/image-proposals` (US-01). Confirm via existing `POST /api/v1/transactions`. No new endpoint.

### Preconditions
- The User is authenticated and has at least one non-deleted Wallet.

### Main Flow
1. User sends a typed message (or an image) describing an expense or income.
2. System resolves the Wallet as today: the one the User named, else the default Wallet.
3. If that Wallet is not VND, System uses the default Wallet when it is VND, else the User's earliest-created VND Wallet.
4. If the User has no VND Wallet, System returns the proposal without a Wallet.
5. System shows the card. A card with a VND Wallet behaves as today. A card without a Wallet shows that a VND Wallet must be chosen; tapping Confirm opens the existing edit form instead of saving.
6. User picks a VND Wallet in the edit form (creating one first if none exists) and saves; the card can then be confirmed.

### Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-29 | ⚠️ The System never attaches a proposal (typed or image) to a non-VND Wallet, even when the User or the AI names that Wallet. |
| AC-30 | A non-VND choice falls back to the default Wallet when it is VND, else to the User's earliest-created VND Wallet. The card shows the Wallet actually used. |
| AC-31 | ⚠️ When the User has no VND Wallet, the proposal arrives without a Wallet.<br>Its card shows a clear message that a VND Wallet must be chosen.<br>Confirm on that card never saves; it opens the edit form. |
| AC-32 | ⚠️ A card whose Wallet is missing or is not a VND Wallet (including proposals kept in a thread from before this fix) cannot be saved directly — Confirm opens the edit form. |
| AC-33 | The edit form for an unconfirmed AI proposal offers only VND Wallets and cannot be saved until one is chosen; when the User has none, it says a VND Wallet must be created first. |
| AC-34 | "Confirm all" on the pending-review screen skips cards that cannot be saved directly and counts them as not saved in its summary. |
| AC-35 | The amount is never converted; it stays the VND amount read, in xu. |

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-AIIMG-36 | ⚠️ Default Wallet "Tiền mặt" (VND) and a "Ví USD" Wallet | User types "ăn trưa 50k ví USD" | `200`; proposal of 5,000,000 xu on "Tiền mặt", never on "Ví USD" | AC-29, AC-30 — the verified defect |
| S-AIIMG-37 | Default Wallet is USD; VND Wallets "MB" (older) and "Tiền mặt" (newer) | User types "cafe 45k" | `200`; proposal on "MB" | AC-30 earliest VND |
| S-AIIMG-38 | ⚠️ User has only USD Wallets | User types "cafe 45k" | `200`; proposal of 4,500,000 xu without a Wallet; card shows the VND-Wallet message | AC-31 |
| S-AIIMG-39 | Card from S-AIIMG-38 | User taps Confirm | No save request; the edit form opens with no Wallet chosen and Save disabled | AC-31, AC-33 |
| S-AIIMG-40 | Card from S-AIIMG-38; User then creates a VND Wallet | User edits the card, picks the new Wallet, saves, confirms | `201`; one Transaction of 4,500,000 xu on the VND Wallet | AC-33 |
| S-AIIMG-41 | Default Wallet is USD; one VND Wallet exists | User sends a receipt image (total 145,000 đ) | `200`; proposal on the VND Wallet | Image path, AC-29 |
| S-AIIMG-42 | Pending review holds 2 VND cards and 1 card without a Wallet | User taps "confirm all" | 2 saved; the third stays pending; summary says 2 saved, 1 not | AC-34 |
| S-AIIMG-43 | Unconfirmed card on a VND Wallet; User also has a USD Wallet | User opens the edit form | Only VND Wallets are offered | AC-33 |
| S-AIIMG-44 | Thread restored with an old unconfirmed proposal on a USD Wallet | User taps Confirm | No save request; the edit form opens | AC-32 |
| S-AIIMG-45 | All of the User's Wallets are VND | User types "cafe 45k" | Same result as before this fix | Regression |

### Edge Cases
- **EC-21** The only VND Wallet is deleted while a card still points to it: the existing not-found error on confirm (EC-18).
- **EC-22** ⚠️ Transactions already booked on a non-VND Wallet by the typed flow before this fix are not detected or corrected by this story — Open Questions #4.
- **EC-23** A confirmed card on a non-VND Wallet (from before the fix) is edited: the existing confirmed-edit rules apply (Wallet locked); the User deletes and re-records it if it is wrong.

### Definition of Done
- [ ] S-AIIMG-36 to S-AIIMG-45 pass; S-AIIMG-36 to S-AIIMG-38 and S-AIIMG-41 are automated Backend tests.
- [ ] Existing typed-chat Backend tests pass unchanged.
- [ ] Shippable and released without US-01.

---

## US-05: Show every proposal of a reply (pre-requisite fix — typed replies)

> Ships on its own, before US-01. US-01 relies on the same behavior for image replies.

**As a** User,
**I want** a separate card for each transaction my message describes,
**so that** none of them is silently lost.

**API:** existing `POST /api/v1/ai/chat` (unchanged).

### Preconditions
- AI Chat is in recording mode.

### Main Flow
1. User types a message describing several transactions (e.g. "cơm 30k và trà đá 10k").
2. System replies with one lead-in text, then one card per proposal, in the order returned.
3. User confirms, edits or discards each card independently.

### Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-36 | Every proposal in a reply is shown as its own card, in order, after a single lead-in text. |
| AC-37 | Each card is independent: confirm, edit, discard and swipe-delete act on that card only. |
| AC-38 | Every unconfirmed card appears in the pending-review list. |
| AC-39 | Editing the User's message supersedes every unconfirmed card of the reply it produced (not only the first).<br>Confirmed cards stay as they are, and the new reply is appended. |
| AC-40 | A reply with one proposal, or with none, looks and behaves exactly as today. |

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-AIIMG-46 | Default VND Wallet; food Category | User types "cơm 30k và trà đá 10k" | Lead-in + 2 cards: 3,000,000 xu and 1,000,000 xu | AC-36 — the verified defect |
| S-AIIMG-47 | 2 cards from S-AIIMG-46 | User confirms the first | `201`; one Transaction; the second card stays pending and is listed in pending review | AC-37, AC-38 |
| S-AIIMG-48 | 2 cards, the first confirmed | User edits the original message to "cơm 35k và trà đá 10k" | The second card is superseded; the first stays saved; a new reply is appended | AC-39 |
| S-AIIMG-49 | — | User types "cafe 45k" | One card, as today | AC-40 |
| S-AIIMG-50 | — | User types a question the AI cannot turn into a Transaction | Text reply only, as today | AC-40 |
| S-AIIMG-51 | Thread saved before this fix (one card per reply) | Thread restores | Old messages display unchanged | Regression |

### Edge Cases
- **EC-24** A confirmed card's Transaction is deleted elsewhere: same tombstone behavior per card as today.
- **EC-25** Confirming several cards of one message records that message as a recent phrase once, not once per card.
- **EC-26** A failed reply (`429` / `502`) is a single error bubble with no cards, as today.

### Definition of Done
- [ ] S-AIIMG-46 to S-AIIMG-51 pass on device.
- [ ] Shippable and released without US-01.

---

## Idempotency

- The proposal step is **not** idempotent: sending the same image twice is a new reading with new proposals (EC-03).
- The confirm step **is** idempotent per proposal via its pre-generated key (BR-08, S-AIIMG-26) — the existing mechanism, unchanged. Each card of a multi-proposal reply keeps its own key (US-05).

## Timestamps

- Dates read from the image are calendar dates and are stored the same way the typed-message flow stores a date-only proposal (UTC storage, shown in local time on the device). "Today" for a missing date uses the same rule as the typed-message flow; the known UTC day-boundary limitation (`CURRENT_STATE.md`) applies equally.

## Out of Scope

- **`frontend/` (Next.js web)** — frozen; no web UI for this feature or for the US-04/US-05 client changes.
- **Real spreadsheet files (.xlsx)** — use the existing Transaction import.
- More than one image per request; PDFs; video; sharing an image into the app from another app.
- Storing the image, or attaching it to the saved Transaction.
- Automatic saving of any proposal; a new batch-confirm endpoint (the existing pending-review "confirm all" is reused).
- Multi-currency reading and currency conversion — a later release.
- Correcting Transactions already booked on non-VND Wallets before US-04 (Open Questions #4).
- Detecting that the same receipt was already recorded (Open Questions #2).
- Using an image while offline, or queueing it for later.
- On-device text recognition.
- Showing the low-confidence label on typed-message proposals (Open Questions #3).

## Open Questions

1. ~~SRS entry~~ — **resolved 2026-10-04:** SRS §6 Feature-12 US-05 "Record Transactions from an Image" added.
2. **Duplicate receipts (EC-03)**: warn when an image looks like one already read? Needs a stored fingerprint, which conflicts with "nothing stored" unless it is a one-way hash. Deferred.
3. **Low-confidence label on typed proposals**: the label is image-only in this release. Extend it to typed proposals later?
4. **Existing wrong-currency Transactions (EC-22)**: should anyone check for Transactions already booked by the AI chat on non-VND Wallets before US-04 ships, and correct them?
5. **Only one AI provider is live today** (the fallback provider has no key in this environment). Accept that image reading is unavailable whenever that provider is down?
