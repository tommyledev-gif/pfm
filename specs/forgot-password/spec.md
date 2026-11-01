# Feature Spec: F-02 Forgot Password (reset by email code)

> Source: owner request 2026-10-23 ("làm về feature forgot password"); listed as production-readiness P0 in `specs/mobile-account-switch/spec.md` (Open Question 4) and `SDS.md` §Lost device ("Password reset by email code — not built yet").
> Decisions confirmed by the owner 2026-10-23: a **6-digit code sent by email, entered in the app** (not a web link); after a reset the app signs straight in on that phone.
> Clients: `mobile/` only. `frontend/` (web) is frozen.
> Scenario prefix `S-FPW-NN`, task prefix `FPW`.

## Context

An active User who forgets the password and has no passkey on the phone cannot get back in today: there is no reset and no admin reset. This feature lets them prove they own the account's email and set a new password, from the login screen, without an admin.

Actor: **User** — anyone on the login screen. The server only acts for an `active` account; for everyone else it answers exactly as if it had acted, so the flow never tells a stranger whether an email or tên đăng nhập has an account.

## Business Rules

| # | Rule |
|---|---|
| BR-01 | A reset is asked for with an email **or** tên đăng nhập (the same field and rule as login: an "@" means email). |
| BR-02 | Only an `active`, not deleted account gets a code. `pending`, `requested`, `disabled`, deleted and unknown get none — and the API answers exactly the same (status, body) as when a code was sent. ⚠️ Enumeration. |
| BR-03 | The code is 6 decimal digits from `crypto/rand`, valid **15 minutes**, usable **once**. Asking again ends every earlier live code of that account. |
| BR-04 | A code allows **5** wrong tries; the 5th wrong try ends it. A right code after that is refused like a wrong one. |
| BR-05 | At most one new code per account per **60 s**, and **5** per account per hour. Over either, nothing is sent and the answer is the same success (BR-02). Per client IP: 5 requests / 15 min, 20 verifies + confirms together / 15 min → `429`. |
| BR-06 | The code is never stored or logged in clear: the database keeps `HMAC-SHA256(key, code)` with a key derived from `JWT_SECRET`, compared in constant time. Logs carry the user id, never the email, code or password. |
| BR-07 | The new password follows the activation/change rules: ≥ 8 characters, ≤ 72 bytes (`WEAK_PASSWORD`). A rejected password does **not** spend a try. |
| BR-08 | ⚠️ A successful reset, atomically: stores the new hash, moves `tokens_valid_after` (every earlier credential stops), marks the code used. Then every session of the account ends (`password_reset`) and the calling phone gets a fresh, device-bound session. |
| BR-09 | Passkeys are not touched. The seeded admin (`SEED_ADMIN_PASSWORD`) is re-synced by the next deploy — documented, not changed. |
| BR-10 | Codes older than 24 h are deleted by the token retention job. |

## US-01: Ask for a reset code

**As a** User who forgot the password, **I want** a code sent to my account's email **so that** I can prove the account is mine.

**API:** `POST /api/v1/auth/password-reset/request` `{ "identifier": "…" }` → `200` (always, see BR-02/BR-05), `400 INVALID_INPUT` (missing/too long), `429 RATE_LIMITED`.

### Main Flow
1. Login screen, password step → User taps "Quên mật khẩu?" (the identifier typed so far is carried over).
2. "Đặt lại mật khẩu" screen, step 1: field "Email hoặc tên đăng nhập", button [Gửi mã].
3. App sends the request. Server resolves the account; if eligible (BR-02, BR-05) it stores a new code hash, ends older codes, and emails the code (async; a mail failure is logged, never shown).
4. Server answers `200` in every non-error case. App moves to step 2 and starts a 60 s countdown on "Gửi lại mã".

### Scenarios
| ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-FPW-01 | Active account `a@x.com` | Request with `a@x.com` | 200; one email with a 6-digit code; one live code row | Happy path |
| S-FPW-02 | Active account with tên đăng nhập `lan` | Request with `LAN ` | 200; code to the account's email | Normalised like login |
| S-FPW-03 | No such account | Request | 200, same body; nothing stored or sent | BR-02 |
| S-FPW-04 | Account `pending` / `requested` / `disabled` | Request | 200, same body; nothing sent | BR-02 |
| S-FPW-05 | Code sent 20 s ago | Request again | 200; no new code, no email | BR-05 |
| S-FPW-06 | Code sent 2 min ago | Request again | 200; new code; the old one no longer works | BR-03 |
| S-FPW-07 | 6th request from one IP in 15 min | Request | 429 `RATE_LIMITED` | BR-05 |
| S-FPW-08 | Body without identifier | Request | 400 `INVALID_INPUT` | Validation |

### Edge Cases
1. Mail server down: the request still answers 200 (the code row exists); the User asks again after the cooldown. Logged with user id only.
2. Two requests at the same instant: the 60 s check and the insert run in one transaction under a row lock on the user, so at most one code is created.
3. Identifier with surrounding spaces or upper case: normalised like login (`NormalizeEmail` / `NormalizeUsername`).

### Definition of Done
- [ ] S-FPW-01..08 covered by service/handler tests (fake mailer, real Postgres for the repository).

## US-02: Set a new password with the code

**As a** User holding the code, **I want** to set a new password **so that** I can sign in again.

**API:**
- `POST /api/v1/auth/password-reset/verify` `{ "identifier", "code" }` → `200` (no data; the code stays live), `400 RESET_CODE_INVALID`, `400 INVALID_INPUT`, `429`. Same account/code checks as confirm; a wrong code spends a try (BR-04). Added 2026-11-01 for the separate code step.
- `POST /api/v1/auth/password-reset/confirm` `{ "identifier", "code", "new_password" }` + device headers → `200 { access_token, refresh_token, email }` (same shape as login), `400 RESET_CODE_INVALID`, `400 WEAK_PASSWORD`, `400 INVALID_INPUT`, `429`.

### Main Flow
1. Step 2 of the screen: "Mã đặt lại" (6 digits), button [Tiếp tục]; link "Gửi lại mã" (after the countdown). App checks 6 digits locally, then calls verify; `RESET_CODE_INVALID` stays on this step.
2. Step 3: "Mật khẩu mới", "Nhập lại mật khẩu mới", button [Đặt lại mật khẩu]. App checks locally: password ≥ 8, both passwords equal.
3. Server (confirm): password rules (BR-07) → account (BR-02, unknown = `RESET_CODE_INVALID`) → live code → compare (BR-06) → wrong: spend a try (BR-04) → `RESET_CODE_INVALID`; right: BR-08. A `RESET_CODE_INVALID` here (the code expired or was replaced since step 2) returns the App to step 2 with the error on the code field.
4. App signs in with the returned pair exactly like a password login (`completeLogin`), shows "Đã đặt lại mật khẩu", opens Home.
5. Back (on screen or the phone's) goes one step back, keeping the code typed; the resend countdown keeps running from the last send.

### Scenarios
| ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-FPW-10 | Live code 482915 | Confirm with it and a valid password | 200 + token pair; old password refused; new one works; other devices' sessions end | Happy path, BR-08 |
| S-FPW-11 | Live code | Confirm with a wrong code | 400 `RESET_CODE_INVALID`; tries 1/5 | BR-04 |
| S-FPW-12 | 4 wrong tries made | 5th wrong, then the right code | Both 400 `RESET_CODE_INVALID`; code ended | BR-04 |
| S-FPW-13 | Code created 16 min ago | Confirm with it | 400 `RESET_CODE_INVALID` | BR-03 |
| S-FPW-14 | Code already used | Confirm with it again | 400 `RESET_CODE_INVALID` | Single use |
| S-FPW-15 | Live code | Confirm with a 73-byte or 5-char password | 400 `WEAK_PASSWORD`; tries unchanged | BR-07 |
| S-FPW-16 | Unknown identifier | Confirm | 400 `RESET_CODE_INVALID` (same body as S-FPW-11) | BR-02 |
| S-FPW-17 | Same right code sent twice at once | Confirm ×2 concurrently | Exactly one 200; the other 400 | Atomic use |
| S-FPW-18 | Account signed in on 2 other phones | Reset on phone C | A and B get 401 on their next request; C is signed in | BR-08 |

### Edge Cases
1. ⚠️ The code is consumed and the password stored in **one transaction**: no state where the code is used but the password unchanged, or the reverse.
2. The account is disabled between request and confirm: the conditional update (`status = 'active'`) fails → `RESET_CODE_INVALID`.
3. The App restarts mid-flow: step 2 is lost; the User asks for a new code (the old one still works for its 15 min if they kept it — the screen accepts any live code).

### Definition of Done
- [ ] S-FPW-10..18 covered (service tests + repository integration test for atomic use).
- [ ] No code, password or email in any log line.

## UI copy (VI, mobile)

| Where | Text |
|---|---|
| Login, under the password field | Quên mật khẩu? |
| Screen title | Đặt lại mật khẩu |
| Step 1 sub | Mã đặt lại gửi tới email của tài khoản. |
| Step 1 field / button | Email hoặc tên đăng nhập / Gửi mã |
| Step 2 sub | Nếu {{identifier}} có tài khoản, mã 6 số đã gửi tới email của tài khoản đó. Mã dùng được trong 15 phút. |
| Step 2 field / button | Mã đặt lại / Tiếp tục |
| Step 3 sub | Thiết bị khác sẽ phải đăng nhập lại. |
| Step 3 fields / button | Mật khẩu mới / Nhập lại mật khẩu mới / Đặt lại mật khẩu |
| Code check failed (network, 5xx) | Chưa kiểm tra được mã. Thử lại. |
| Resend | Gửi lại mã · Gửi lại mã sau {{seconds}} giây |
| Field errors | Nhập email hoặc tên đăng nhập. · Nhập mã 6 số. · Mật khẩu cần ít nhất 8 ký tự. · Hai mật khẩu chưa khớp. |
| `RESET_CODE_INVALID` | Mã không đúng hoặc đã hết hạn. |
| Success toast | Đã đặt lại mật khẩu |
| Email subject / heading | Mã đặt lại mật khẩu Budgest / Đặt lại mật khẩu |
| Email body | Mã đặt lại: {{code}} · Mã dùng được trong 15 phút. · Không phải bạn yêu cầu thì bỏ qua email này. Mật khẩu chưa thay đổi. |

## Out of Scope
- Reset by SMS, admin-initiated reset, security questions.
- Web client.
- Locking the account after many reset attempts (per-code tries + per-account send caps + per-IP limits bound guessing to ≤ 25 tries/hour/account at 1-in-a-million each).

## Open Questions
1. Code life 15 min, 5 tries, 60 s cooldown, 5 codes/hour: explicit assumptions, common defaults.
2. Should a reset also delete the account's passkeys? Assumed **no** (a passkey proves possession of the phone, not the password).
