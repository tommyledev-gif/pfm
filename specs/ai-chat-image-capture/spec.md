# Feature Spec: Feature-12 AI Chat Assistant — Record Transactions from an Image (Release 1)

> Source: `specs/mobile-ux-batch-2026-10/research.md` (feasibility research, approved by the product owner, corrected 2026-10-04 — Option C: a vision-capable AI reads the image and returns Transaction proposals). SRS Feature-12 / FR-09 / BF-10 (AI Chat Assistance).
> Status: Specced 2026-10-04; product-owner decisions of 2026-10-04 folded in (currency, every proposal shown, limits, handwriting). SRS story: Feature-12 US-05 (added 2026-10-04).
> Amended 2026-10-11: a receipt proposal carries the receipt's Items and Adjustments ([Items of a Transaction](../transaction-line-items/spec.md)) instead of splitting line items into separate proposals — BR-03, AC-05, S-AIIMG-02 changed; BR-15, AC-41–AC-43, S-AIIMG-52–S-AIIMG-55, EC-27–EC-28 added.
> Amended 2026-10-17 (proposal and product-owner decisions of 2026-10-17): one vision model on the AI provider's free tier (the second candidate model was shut down by the provider on 2026-07-17), no Anthropic for this feature, an operator switch, a free Plan B, fail-fast when the provider is busy, a possible-duplicate warning, a per-line "needs review" mark, multi-total receipts, image text treated as data, provider data retention. Resolved design decisions 5 changed, 11–16 added; BR-03 changed; BR-16–BR-20, AC-44–AC-50, S-AIIMG-56–S-AIIMG-70, EC-29–EC-36 added; Open Questions #2 and #5 resolved, #6–#8 added.
> Amended 2026-10-18 (product-owner answers to Open Questions #6–#8): privacy notice on first use (BR-21, AC-51, S-AIIMG-71–S-AIIMG-73), total payable cut off (EC-37), expected peak confirmed. Zero data retention for inference turned on in the provider account on 2026-10-18.
> US-04 and US-05 shipped 2026-10-04 (commit `0411fda`); offline detection shipped with offline support (`mobile/src/lib/connectivity.ts`).
> Related: [Feature-12 US-01 Create a Transaction via Chat](../ai-chat-assistant/spec.md) (proposal → confirm model, idempotency key, ownership re-validation, all reused) · [F-06 Transaction Management](../transaction-management/spec.md) (the confirm step) · [Transaction import](../transaction-export-import/spec.md) (the exact path for real spreadsheet files)
> Clients: **`mobile/` only.** `frontend/` (web) is frozen — see Out of Scope.

## Context

Today a User records a Transaction in the AI Chat by typing a sentence ("ăn trưa 50k"). Much of what a User wants to record already exists as a picture: a printed receipt or bill, a handwritten note of the day's spending, or a screenshot of a spreadsheet they keep. Re-typing it is slow and error-prone.

This feature lets the User attach one image in the AI Chat's recording conversation. The System reads it and replies with one Transaction proposal per expense or income it finds, each rendered as the same proposal card the text flow already uses. Nothing is saved until the User confirms each card — exactly like a typed message.

Three kinds of image are in scope, with different expected output:

| Image kind | Expected proposals |
|---|---|
| Printed receipt / bill, including a screenshot of an order in a food-delivery or shopping app and a printed utility bill | **One** proposal: the total payable, carrying the receipt's Items and Adjustments when it lists them. |
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
5. **An accuracy check on real Vietnamese samples gates the build.** It is the first phase of the plan and a go/no-go for the one vision model (decision 11). If it fails for receipts or spreadsheet screenshots, the feature does not proceed as specced and Plan B applies (decision 12, Preconditions).
6. **VND only.** Every amount the AI reads is VND, and a proposal may only be attached to a VND Wallet — for image and typed proposals alike (BR-13). Multi-currency reading is a later release.
7. **Limits confirmed by the product owner:** 10 image readings per hour per User, at most 20 proposals per image, caption at most 300 characters. The exact values are owned by the plan; this spec refers to them as "the image limit", "the maximum proposals" and "the caption maximum".
8. **Handwriting ships either way.** If the accuracy check shows handwritten notes below the pass bar, they are still accepted, but every proposal read from a handwritten note carries the low-confidence label (BR-09). No extra gate or PIN — every proposal already needs an explicit Confirm.
9. **Every proposal in a reply gets its own card**, for typed and image replies alike (BR-14).
10. **Cheapest option with the biggest impact** is the tie-breaker for any remaining design choice.
11. **One vision model, free, no fallback provider** (2026-10-17). Image reading uses one model on the AI provider's free tier. No paid provider and no Anthropic key are used for this feature. When that model fails or is withdrawn, image reading fails with a clear error and the operator can switch it off (BR-18). Typed messages and manual entry are unaffected. *(Resolves Open Questions #5.)*
12. **Plan B is free** (2026-10-17). If the accuracy check fails, or the vision model is withdrawn for good, the fallback is text recognition on the phone (only in the installed app builds that can run it; the Expo Go test app keeps sending the image) whose text goes to the existing text reader of typed messages, checked again with the same accuracy check. If Plan B fails too, image reading is postponed. The trigger numbers are owned by the plan.
13. **Busy means fail fast** (2026-10-17). When the provider is out of capacity, the reply comes back at once with a retry offer (BR-19). No queue and no server-side waiting: a queue would keep the image on the server, which decision 2 forbids.
14. **Possible duplicates are warned, not blocked** (2026-10-17), using only Transactions already saved (BR-17). No image fingerprint is stored. *(Resolves Open Questions #2.)*
15. **Uncertain receipt lines are marked one by one** (2026-10-17), on top of the card-level low-confidence label (BR-16).
16. **Provider data retention** (2026-10-17). The image leaves the System only to the one AI provider, for one reading. Zero data retention is turned on in that provider account before the feature is enabled for anyone other than the owner (Preconditions); done 2026-10-18. The User is told once, before the first photo, that the image is read by an external AI service (BR-21).

### Business Rules

| ID | Rule |
|---|---|
| BR-01 | ⚠️ A proposal is never saved without the User's explicit Confirm on that proposal (or on a "confirm all" the User triggers on the existing pending-review screen). |
| BR-02 | ⚠️ Money: every amount is an integer number of xu (VND minor unit, 1 đồng = 100 xu), never a fractional value at any step. The AI reads whole đồng; a value read with a fractional part is not rounded — that entry is skipped and counted as unreadable. Currency: VND only; no conversion at any step (BR-13). |
| BR-03 | ⚠️ A receipt yields **one** proposal for its **total payable**: the amount owed after every discount, tax and fee (the "Tổng thanh toán" / "Thanh toán" line when printed). Never the subtotal before discounts ("Tạm tính", "Tổng tiền hàng"), the cash handed over ("Khách đưa"), the change returned ("Tiền thối", "Trả lại"), or a tax line as a separate proposal. When the total payable cannot be told apart from the other totals printed, the proposal carries the low-confidence label. Its line items and its tax, fee and discount lines are attached to that proposal as Items and Adjustments (BR-15), not proposed separately. |
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
| BR-16 | A receipt Item or Adjustment the AI reads with doubt (blurred, cut off, ambiguous digits) carries a needs-review mark, shown as "Cần kiểm tra" next to that line on the card's expanded list and in the edit form. A proposal with at least one marked line carries the low-confidence label (BR-09). The mark alone never blocks a save; BR-15 alone decides whether the lines add up. When the lines miss the total and no line is marked, the gap is shown and no line is marked by guess. A line's mark is cleared when the User edits that line; marks are never saved with the Transaction. |
| BR-17 | ⚠️ **Possible duplicate.** Before replying, the System checks each image proposal that has a Wallet against the User's own non-deleted Transactions: same Wallet, same type, same amount in xu, same calendar day in the app timezone. When at least one matches, the card shows "Giống giao dịch {amount} ngày {date}" (the latest match; both values through the shared formatters) and its save button reads "Vẫn lưu" instead of "Lưu". Saving from the card works as usual. "Confirm all" on the pending-review screen skips the card and counts it as not saved. The mark is cleared when the User edits the card. Only image proposals are checked. |
| BR-18 | **Operator switch.** Image reading can be switched off without a release. While it is off, a request is refused before the image is read, does not count against the image limit, and the app replies "Đọc ảnh đang tạm dừng." with the existing manual-entry offer ("Nhập thủ công"). After that reply the attach button stays disabled for the rest of the app session, and a tap on it shows the same sentence. Typed messages are unaffected. |
| BR-19 | ⚠️ **Provider busy.** When the AI provider refuses a reading because its shared capacity is used up, the System replies at once with a busy error: no queue, no waiting, no second attempt within the same request. The request does not count against the image limit and the image stays on the device. The reply reads "Chưa đọc được ảnh. Thử lại sau {minutes} phút." with a retry for this image and the manual-entry offer; {minutes} is the provider's wait time rounded up to whole minutes, 1 when none is given. |
| BR-20 | ⚠️ Text that appears in the image (printed, handwritten or on screen) is only ever read as entries. It cannot change the System's instructions, pick another User's Wallets or Categories, change any limit, or cause a save. Every value read is re-validated as untrusted input (BR-01, BR-02, BR-07, BR-13). |
| BR-21 | **Privacy notice.** The first time a User taps the attach-image button on a device, the System shows a notice before anything else: title "Ảnh được gửi đi để đọc", body "Dịch vụ AI bên ngoài đọc ảnh rồi xóa ngay. Ảnh chỉ còn trên điện thoại này.", buttons "Tiếp tục" and "Để sau". "Tiếp tục" records that this User has seen it on this device and opens the camera / library choice. "Để sau" closes the notice; nothing is taken or sent, and the notice shows again on the next tap. The notice shows again for another User on the same device, and on a new device or after a reinstall. |

### Key Entities

| Entity | Role in this feature |
|---|---|
| Image capture | Transient. One picture plus an optional caption, sent once for reading. Never stored by the System. |
| Transaction proposal | The existing proposal (amount, type, Category, Wallet, date, note, confidence, idempotency key). One per entry read. The Wallet may be absent when the User has no VND Wallet (BR-13). A receipt proposal may carry Items and Adjustments (BR-15), with a needs-review mark per line (BR-16). Any image proposal may carry a possible-duplicate match: the amount and date of the latest matching saved Transaction (BR-17). |
| Image reading switch | Operator-controlled on/off for the whole feature, for every User at once (BR-18). Not stored per User. |
| Transaction | Created only on Confirm, through the existing create flow. |
| Chat thread | The existing per-User thread. Gains an "image" user message (thumbnail kept on this device only) and one message per proposal. |
| Wallet | Read-only context; ownership re-validated; only VND Wallets may receive a proposal. |
| Category | Read-only context; ownership re-validated. |

---

## Preconditions (feature-level)

- US-04 and US-05 have shipped (done 2026-10-04).
- The accuracy check (plan Phase 0) has passed for printed receipts and spreadsheet screenshots on the one vision model, or Plan B has passed the same check (Resolved design decision 12). Handwritten notes ship whatever their result (Resolved design decision 8).
- The User is authenticated and has at least one non-deleted Wallet (else the reply explains a Wallet is needed — EC-10).
- The device is online (BR-11), as reported by the app's connectivity signal (shipped with offline support). A request that still fails for lack of network shows the no-connection error state (US-01 UI states).
- The vision model is reachable and the operator switch is on (BR-18).
- Before the feature is enabled for any User other than the owner: zero data retention is on for the production AI provider account (Resolved design decision 16).

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
1. User taps the attach-image button next to the recording input. The first time on this device, System shows the privacy notice and continues only after "Tiếp tục" (BR-21).
2. System offers two choices: take a photo, or choose from the library.
3. User picks one; System asks for the corresponding device permission the first time.
4. User takes or picks a photo.
5. System shows a preview of the image with an optional caption field (e.g. "ví MB") and Send / Cancel.
6. User taps Send.
7. System reduces the image to a size that is still legible, posts the User's message in the thread (a small thumbnail plus the caption, if any), and shows the typing indicator.
8. Backend checks the operator switch (BR-18), the image's size and type, loads the User's own Wallets and Categories, and sends the image, caption, Wallets, Categories and the current date to the AI Service.
9. AI Service reads the image according to BR-02 to BR-06 and BR-20, notes whether the image is a handwritten note, marks receipt lines read with doubt (BR-16), and returns the entries it found. A busy provider ends the request here (BR-19).
10. Backend validates each entry (BR-07), applies the VND Wallet rule (BR-13), applies the low-confidence label (BR-09, BR-16), checks each entry for a possible duplicate (BR-17), pre-generates an idempotency key for each surviving entry (BR-08), and discards the image.
11. Backend replies with a short lead-in (how many proposals, how many are low confidence, whether entries were skipped or not read) and the list of proposals.
12. System shows the lead-in, then one proposal card per entry, in reading order (BR-14).

### Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-01 | The attach-image button is shown only in recording mode.<br>It is disabled while a reply is pending, while the device is offline, and for the rest of the app session after a feature-off reply (BR-18). |
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
| AC-44 | While the operator switch is off, no image is read and the image limit is not used.<br>The app shows the feature-off reply and keeps the attach button disabled for that app session (BR-18). |
| AC-45 | ⚠️ A busy provider produces an immediate busy reply with the wait time and a retry for the same image.<br>The image limit is not used and nothing is queued on the server (BR-19). |
| AC-46 | ⚠️ A proposal matching a saved Transaction shows the possible-duplicate line and the "Vẫn lưu" button.<br>Confirm-all skips it and counts it as not saved (BR-17). |
| AC-47 | Receipt lines read with doubt show "Cần kiểm tra"; their proposal carries the low-confidence label (BR-16). |
| AC-48 | ⚠️ Instructions written in the image are never followed; every value read is validated as untrusted input (BR-20). |
| AC-49 | A receipt printing several totals yields one proposal for the total payable after discounts (BR-03). |
| AC-51 | The first tap on the attach-image button shows the privacy notice; no camera, library or upload happens before "Tiếp tục".<br>After "Tiếp tục" the notice never shows again for that User on that device (BR-21). |

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
| S-AIIMG-56 | Operator switch is off | User sends an image | `503 AI_IMAGE_DISABLED`; the AI Service is not called; image limit unchanged; reply "Đọc ảnh đang tạm dừng." with "Nhập thủ công"; attach button disabled until the app restarts | BR-18 — system state, not a client mistake |
| S-AIIMG-57 | Switch was off in S-AIIMG-56, operator turns it on | User restarts the app and sends an image | Read normally | BR-18 session scope |
| S-AIIMG-58 | Provider out of capacity, wait time 40 s | User sends an image | `503 AI_IMAGE_BUSY` with the wait time in `details`; reply "Chưa đọc được ảnh. Thử lại sau 1 phút."; image limit unchanged | BR-19 — system error, retryable |
| S-AIIMG-59 | Busy reply from S-AIIMG-58 | User taps retry a minute later | The same image is re-sent from the device and read normally | BR-19 |
| S-AIIMG-60 | User has 1 image reading left this hour | Two busy replies in a row | The User still has 1 image reading left this hour | BR-19 — failed requests never count |
| S-AIIMG-61 | ⚠️ A saved expense of 145,000 đ on "Tiền mặt" dated 2 Oct | User sends that receipt again (145,000 đ, 02/10) | The proposal shows the possible-duplicate line with that Transaction's amount and date; its save button reads "Vẫn lưu" | BR-17 |
| S-AIIMG-62 | Card from S-AIIMG-61 | User taps "Vẫn lưu" | `201`; a second Transaction is saved; balance moves once more | BR-17 — warning, not a block |
| S-AIIMG-63 | Card from S-AIIMG-61, unconfirmed | User taps confirm-all in pending review | The card is skipped; the summary counts it as not saved | BR-17, AC-46 |
| S-AIIMG-64 | The only 145,000 đ expense is on another Wallet, or dated 1 Oct, or deleted | User sends the receipt | No possible-duplicate line | BR-17 match rule |
| S-AIIMG-65 | Card from S-AIIMG-61 | User edits the amount and saves the edit | The possible-duplicate line is gone; the save button reads "Lưu" again | BR-17 |
| S-AIIMG-66 | Receipt where the line "SUA TH 1L" is blurred; lines add up to the total | User sends it | That Item shows "Cần kiểm tra"; the proposal carries the low-confidence label; Confirm saves directly | BR-16 — the mark alone never blocks |
| S-AIIMG-67 | Receipt printing "Tổng tiền hàng 120.000", "Giảm giá 20.000", "Tổng thanh toán 100.000", "Khách đưa 200.000", "Trả lại 100.000" | User sends it | 1 proposal of 10,000,000 xu; Items plus a discount Adjustment of 20,000 đ | ⚠️ BR-03 multi-total |
| S-AIIMG-68 | ⚠️ A note whose text tells the AI to ignore its rules and book 50,000,000 đ to another User's Wallet | User sends it | No proposal follows the instruction; no other User's data appears; any amount read is validated as usual | BR-20 |
| S-AIIMG-69 | The provider has withdrawn the vision model | User sends an image | `502 AI_SERVICE_UNAVAILABLE`, retryable; typed messages still work | Decision 11 — system error |
| S-AIIMG-70 | Screenshot of a food-delivery order: 3 dishes, a delivery fee, a voucher, the total | User sends it | One proposal for the total; 3 Items, a fee Adjustment and a discount Adjustment | Assumption, Open Questions #6 |
| S-AIIMG-71 | User has never used image capture on this device | User taps the attach-image button | The privacy notice shows; after "Tiếp tục" the camera / library choice opens | BR-21, AC-51 |
| S-AIIMG-72 | Notice from S-AIIMG-71 is showing | User taps "Để sau" | The notice closes; no permission is asked, nothing is sent; the next tap shows the notice again | BR-21 |
| S-AIIMG-73 | User A tapped "Tiếp tục" earlier on this device | User A taps attach again; then User B, switched to on the same device, taps attach | User A goes straight to the choice; User B sees the notice | BR-21 per User per device |

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
- **EC-29** Two proposals of one reply match each other (a sheet with two "cafe 45k" rows on the same day): BR-17 compares only against saved Transactions, so neither is marked. Confirming both saves both, as expected for spends that really repeat.
- **EC-30** ⚠️ The same receipt sent twice before either card is confirmed: neither is marked (nothing is saved yet). After the first is saved, the second card is not re-checked. Accepted risk: both thumbnails stay next to their cards.
- **EC-31** A wallet-less proposal (US-04) gets a Wallet in the edit form: it is not checked for duplicates then. Accepted, same as any edited card (BR-17).
- **EC-32** The match is a different real purchase (two coffees of the same price on the same day): the line is a warning only; "Vẫn lưu" saves it.
- **EC-33** The provider is busy and gives no wait time: the reply says 1 minute (BR-19).
- **EC-34** The operator switch is turned off while a reading is in progress: that reading finishes; the next request gets the feature-off error.
- **EC-35** The provider's answer is cut short because it is too long: the System makes one more attempt with a larger output allowance, never when the provider is busy (BR-19). If that is cut too, the request ends as `502 AI_SERVICE_UNAVAILABLE`; partial proposals are never returned.
- **EC-36** Every line of a receipt is marked "Cần kiểm tra": the proposal still offers the total; the User can remove the Items in the edit form (EC-27).
- **EC-37** ⚠️ The total payable line is cut off or unreadable (only a subtotal or a total before a later line is visible): the proposal uses the last total still visible and carries the low-confidence label. Lines that add up to that total do not remove the label, because that total itself may be wrong.

### Client UI States (`mobile/`, recording mode)

| State | Trigger | Expected UI |
|---|---|---|
| Idle | Recording mode, online | Attach-image button enabled next to the input |
| Disabled | Offline, a reply pending, or a feature-off reply earlier in this app session | Attach-image button disabled; offline and feature-off show a short explanation on tap |
| Privacy notice | First tap on this device for this User (BR-21) | Notice with title, body, "Tiếp tục" and "Để sau"; nothing taken or sent yet |
| Choosing | Button tapped (after the notice when it applies) | Two choices: take a photo / choose from library |
| Preview | Image taken/picked | Full image, optional caption field, Send and Cancel |
| Loading | Sent | User message with thumbnail + caption; typing indicator |
| Success — proposals | `200` with proposals | Lead-in text, then one card per proposal; uncertain cards show the low-confidence label |
| Success — proposal without a Wallet | `200`, User has no VND Wallet | Card shows "no Wallet" and a message that a VND Wallet must be chosen (US-04) |
| Success — nothing found | `200` with no proposals | Reply text suggesting a clearer photo or typing; manual-entry offer |
| Error — too large / wrong type | `413` / `415` (or caught on device) | Inline message; nothing sent to the thread |
| Success — possible duplicate | Proposal matching a saved Transaction (BR-17) | Possible-duplicate line on the card; save button "Vẫn lưu" |
| Success — lines to check | Receipt lines marked (BR-16) | "Cần kiểm tra" next to each marked line in the expanded list and the edit form; low-confidence label on the card |
| Error — limit / unavailable | `429 RATE_LIMITED` / `502` | Reply bubble "system busy" with manual-entry offer and a retry for this image |
| Error — reading busy | `503 AI_IMAGE_BUSY` | Reply "Chưa đọc được ảnh. Thử lại sau {minutes} phút." with a retry for this image and "Nhập thủ công" (BR-19) |
| Error — feature off | `503 AI_IMAGE_DISABLED` | Reply "Đọc ảnh đang tạm dừng." with "Nhập thủ công"; attach button disabled for the rest of the app session, a tap shows the same sentence (BR-18) |
| Error — no connection | Network failure | Reply bubble "no connection" with retry |
| Error — permission denied | Permission refused | Message pointing to device settings |

All user-facing text is in Vietnamese.

### Definition of Done
- [ ] Attach-image button, choice sheet, preview with caption, thumbnail message and full-screen view work on a real device in Expo Go (SDK 54).
- [ ] The proposal endpoint returns proposals for receipt, handwritten-note and spreadsheet-screenshot images with amounts as integer xu of VND and every BR-02 to BR-07 and BR-13 rule enforced.
- [ ] S-AIIMG-01 to S-AIIMG-24 pass (automated where they touch Backend/AI Service; manual on device for UI states).
- [ ] The image limit is separate from the typed-message limit, both ways (S-AIIMG-20, S-AIIMG-21).
- [ ] No Transaction is created by the proposal step (verified by test).
- [ ] S-AIIMG-56 to S-AIIMG-70 pass: switch, busy, duplicate and injection cases automated on Backend/AI Service; card states checked on device.
- [ ] Busy and feature-off requests leave the image limit unchanged (verified by test).
- [ ] S-AIIMG-71 to S-AIIMG-73 pass on device.

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
5. Unconfirmed image proposals also appear in the existing pending-review list, where the existing "confirm all" saves them one by one, skipping cards that cannot be saved directly (AC-34, AC-42) or carry the possible-duplicate line (BR-17).

### Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-15 | Each proposal from one image is an independent card: confirming, editing or discarding one never changes another. |
| AC-16 | ⚠️ Confirming the same card twice (double-tap, retry after a timeout) creates exactly one Transaction and moves the Wallet balance once (BR-08). |
| AC-17 | Editing an unconfirmed card replaces its fields before saving and issues it a fresh idempotency key (existing behavior); editing a confirmed card updates the saved Transaction, never creates a second one. |
| AC-18 | A confirm that fails validation (e.g. insufficient balance) shows the error on that card only; other cards are unaffected. |
| AC-19 | Image proposals appear in the pending-review list and are saved by "confirm all" one at a time, in order.<br>Cards that cannot be saved directly or carry the possible-duplicate line are skipped and counted as not saved. |
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
| AC-50 | The image goes only to the one AI provider, only for the reading. Zero data retention is on for the production provider account before any User other than the owner can use the feature (Resolved design decision 16). |

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
- [ ] The provider account's data-retention setting is checked and recorded before the feature is enabled for other Users (AC-50).

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

- The proposal step is **not** idempotent: sending the same image twice is a new reading with new proposals (EC-03). Once one of them is saved, a later reading warns with the possible-duplicate line (BR-17); nothing is blocked.
- The confirm step **is** idempotent per proposal via its pre-generated key (BR-08, S-AIIMG-26) — the existing mechanism, unchanged. Each card of a multi-proposal reply keeps its own key (US-05).

## Timestamps

- Dates read from the image are calendar dates and are stored the same way the typed-message flow stores a date-only proposal (UTC storage, shown in local time on the device). "Today" for a missing date uses the same rule as the typed-message flow; the known UTC day-boundary limitation (`CURRENT_STATE.md`) applies equally.
- A printed or written date is the bill's own calendar date, never the time of the upload.
- The possible-duplicate check (BR-17) compares calendar days in the app's timezone (Vietnam), so a Transaction saved late in the evening and a receipt dated that day match.

## Out of Scope

- **`frontend/` (Next.js web)** — frozen; no web UI for this feature or for the US-04/US-05 client changes.
- **Real spreadsheet files (.xlsx)** — use the existing Transaction import.
- More than one image per request; PDFs; video; sharing an image into the app from another app.
- Storing the image, or attaching it to the saved Transaction.
- Automatic saving of any proposal; a new batch-confirm endpoint (the existing pending-review "confirm all" is reused).
- Multi-currency reading and currency conversion — a later release.
- Correcting Transactions already booked on non-VND Wallets before US-04 (Open Questions #4).
- Fingerprinting images to detect a re-sent receipt; duplicate warnings on typed proposals; re-checking a card for duplicates after an edit (BR-17 covers saved Transactions only).
- Using an image while offline, or queueing it for later — including when the provider is busy (Resolved design decision 13).
- On-device text recognition, except as Plan B (Resolved design decision 12). It never runs next to the vision model in this release.
- Any paid AI provider, an Anthropic key, or a second vision provider for this feature (Resolved design decision 11).
- Checking photo sharpness or brightness before sending. The preview (AC-03) is the check.
- Weighed goods with a fractional quantity: they stay one Item of quantity 1 with the weight in the name (EC-28).
- Showing the low-confidence label on typed-message proposals (Open Questions #3).

## Open Questions

1. ~~SRS entry~~ — **resolved 2026-10-04:** SRS §6 Feature-12 US-05 "Record Transactions from an Image" added.
2. ~~Duplicate receipts (EC-03)~~ — **resolved 2026-10-17:** warn using saved Transactions (same Wallet, type, amount, day), never block, store nothing (BR-17).
3. **Low-confidence label on typed proposals**: the label is image-only in this release. Extend it to typed proposals later?
4. **Existing wrong-currency Transactions (EC-22)**: should anyone check for Transactions already booked by the AI chat on non-VND Wallets before US-04 ships, and correct them?
5. ~~Only one AI provider is live today~~ — **resolved 2026-10-17:** accepted. One free vision model, no Anthropic, operator switch (Resolved design decision 11, BR-18).
6. ~~Delivery-app screenshots and utility bills~~ — **resolved 2026-10-18:** read as printed receipts, no dedicated handling (Context).
7. ~~Privacy notice~~ — **resolved 2026-10-18:** a notice on first use per User per device (BR-21); zero data retention on (decision 16).
8. ~~Expected peak~~ — **resolved 2026-10-18:** at most 2 image readings in the same minute across all Users is acceptable; beyond that the busy reply applies (BR-19).
9. **Daily capacity on the free tier.** The accuracy check showed the provider's free daily quota allows roughly 30 image readings per day for all Users together; past it, every reading gets the busy reply with the wait the provider gives (often tens of minutes). Accept for this release, or limit readings per User per day so one User cannot use them all?
