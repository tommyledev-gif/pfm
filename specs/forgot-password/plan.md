# Implementation Plan: F-02 Forgot Password

> Spec: [spec.md](./spec.md) · SRS: F-02 System Security · Tasks `FPW-T`
> Stacks: Go backend (migration 036), mobile. No AI Service, no web.

## 1. Pre-flight: Spec Review Findings

| # | Type | Finding | Resolution |
|---|---|---|---|
| 1 | Gap | BR-05's per-account cooldown must not race (two requests at once → two codes). | `CreateCode` runs in one transaction that first locks the user row (`SELECT … FOR UPDATE`), then checks the newest code and the hourly count. |
| 2 | Gap | BR-08 needs "code used" and "password stored" together; today `ChangePassword` is a single statement in `UserRepository`. | New `PasswordResetRepository.ResetPassword` runs both conditional updates in one transaction; either affects 0 rows → rollback, `false`. Sessions end and a new session starts after commit (same order as `ChangePassword`). |
| 3 | Ambiguity | Where is the HMAC key from? | `HMAC-SHA256(JWT_SECRET, "pfm/password-reset-code/v1")` derived once at startup; no new env var. Rotating `JWT_SECRET` simply invalidates live codes (15 min). |
| 4 | Gap | Generic answer vs. timing: a found account does a transaction + email, an unknown one returns at once; a DB error while storing the code would be a 500 only for real accounts. | Fixed for request: only the account lookup runs on the request path; storing and emailing the code run in a background goroutine (`issueCode`), failures logged by user id. Measured locally: 2 ms real vs 2-6 ms unknown. Confirm keeps a residual gap (1 query for unknown, 2-3 for known) bounded by 20 confirms/15 min per IP and 5 tries per code: accepted, documented. |
| 5 | Design | Response of confirm. | Same shape as `POST /auth/login` (`LoginResponse`), so the app reuses `completeLogin`. |
| 6 | Gap | `EmailSender` gains a method → every fake must implement it. | Add `SendPasswordResetCode` to `LogEmailSender`, `SMTPEmailSender` and the two test fakes. |

## 2. Architecture

```text
backend/
├── db/migrations/036_password_reset_codes.sql ★
├── db/queries/password_reset_codes.sql ★ (documentation of the hand-written SQL)
└── internal/
    ├── common/password_reset.go ★          constants, ErrResetCodeInvalid
    ├── model/password_reset.go ★           PasswordResetCode
    ├── dto/password_reset_dto.go ★
    ├── repository/sqlc/password_reset_codes.sql.go ★
    ├── repository/password_reset_repository.go ★
    ├── service/password_reset_service.go ★  RequestReset, ConfirmReset
    ├── service/reset_code.go ★              code generation + keyed hash
    ├── service/email_sender.go ✎, smtp_email_sender.go ✎, smtp_email_templates.go ✎
    ├── service/token_retention.go ✎         delete codes > 24 h
    ├── handler/password_reset_handler.go ★
    ├── middleware/rate_limit_access.go ✎    two IP limiters
    └── model/session.go ✎                  SessionRevokedPasswordReset
cmd/server/main.go ✎, routes.go ✎
mobile/
├── app/(auth)/forgot-password.tsx ★
└── src/features/auth/
    ├── api/use-password-reset-mutations.ts ★
    ├── components/ResetRequestStep.tsx ★, ResetConfirmStep.tsx ★
    ├── reset-error.ts ★
    ├── types.ts ✎
    └── components/LoginForm.tsx ✎ (link), app/(auth)/login.tsx ✎
```

### Domain object

| Entity | Table | Key fields | Notes |
|---|---|---|---|
| PasswordResetCode | `password_reset_codes` | id UUID v4, user_id, code_hash TEXT, attempts INT, created_at, expires_at, used_at NULL, revoked_at NULL | Hard-deleted after 24 h (not a financial record); no `deleted_at` |

### Business rules → enforcement

| Rule | Source | Enforcement |
|---|---|---|
| Generic answer for any identifier | BR-02 | `PasswordResetService.RequestReset` returns nil for every non-error branch |
| Code 6 digits, 15 min, single use | BR-03 | `generateResetCode` (`crypto/rand`), `CreateCode` revokes older, `ResetPassword` conditional `used_at IS NULL` |
| 5 tries | BR-04 | `SpendTry` (increment; revoke at 5) |
| 60 s / 5 per hour per account | BR-05 | `CreateCode` in a locked transaction |
| Per-IP caps | BR-05 | `PasswordResetRequestRateLimiter`, `PasswordResetConfirmRateLimiter` → 429 |
| Keyed hash, no secrets in logs | BR-06 | `resetCodeHasher`, logs with user id only |
| Password rules before spending a try | BR-07 | `ConfirmReset` checks `MinPasswordLength` / `PasswordTooLong` first |
| ⚠️ Atomic reset + sign-out everywhere | BR-08 | `ResetPassword` tx; then `SessionService.EndAll(password_reset)`; then `Start` for this device |

Authorization: both routes are public (the code is the credential); IP limiters at middleware; all rules in the service.

### Sequence (confirm)

```mermaid
sequenceDiagram
    participant App
    participant H as PasswordResetHandler
    participant S as PasswordResetService
    participant DB as Postgres
    App->>H: POST /auth/password-reset/confirm
    H->>S: ConfirmReset(identifier, code, password, device)
    S->>S: password rules (WEAK_PASSWORD → 400, no try spent)
    S->>DB: user by email/username (active)
    S->>DB: live code for user
    S->>S: hmac.Equal(hash(code), stored)
    S->>DB: BEGIN; UPDATE code SET used_at (live); UPDATE users SET hash, tokens_valid_after (active); COMMIT
    S->>DB: end all sessions (password_reset); start session (device)
    S-->>H: user + token pair
    H-->>App: 200 {access_token, refresh_token, email}
    alt wrong code
        S->>DB: UPDATE attempts+1 (revoke at 5)
        H-->>App: 400 RESET_CODE_INVALID
    end
```

Idempotency: request is naturally rate-limited and supersedes older codes; confirm is single-use by the conditional update (a replay gets 400).

## 3. Error Flows

| Scenario | HTTP | Code | Kind |
|---|---|---|---|
| Missing/oversized field, code not 6 digits | 400 | `INVALID_INPUT` | validation |
| Password < 8 or > 72 bytes | 400 | `WEAK_PASSWORD` | validation |
| Wrong/expired/used/exhausted code, unknown or inactive account | 400 | `RESET_CODE_INVALID` | validation |
| IP over the limit | 429 | `RATE_LIMITED` | client |
| Database failure | 500 | `INTERNAL_ERROR` | system (nothing changed: transaction) |

## 4. Convention Notes

| Rule | How |
|---|---|
| Handler shape only, service rules | DTO tags for presence/length/digits; everything else in the service |
| No secrets in logs | Code, password, email never logged; `MaskEmail` only in the placeholder sender |
| Transactions in one place | Repository-owned tx for the two-statement write (precedent: `SessionRepository.Create`) |
| Files ≤ 300 lines | Service split into request/confirm files if needed |
| UX copy | Strings from spec §UI copy; glossary rows added ("quên mật khẩu") |
| Timestamps | `TIMESTAMPTZ` UTC; expiry computed in SQL `NOW()` comparisons |

## 5. testID

| Element | testID |
|---|---|
| Login link | `btn-login-forgot-password` |
| Identifier field / send | `input-reset-identifier` / `btn-reset-send-code` |
| Code / new / confirm fields | `input-reset-code` / `input-reset-password` / `input-reset-password-confirm` |
| Submit / resend / back | `btn-reset-submit` / `btn-reset-resend` / `btn-reset-back` |

## 6. Open Tasks

| ID | Task |
|---|---|
| FPW-T01 | Migration 036 + query doc + hand-written sqlc |
| FPW-T02 | Model, constants, errors, DTOs |
| FPW-T03 | Repository (CreateCode tx, LiveCode, SpendTry, ResetPassword tx, DeleteOld) + integration test |
| FPW-T04 | Code generator + keyed hasher + tests |
| FPW-T05 | Service RequestReset/ConfirmReset + fakes + tests (S-FPW-01..18) |
| FPW-T06 | Email method + template + fakes |
| FPW-T07 | Handler, limiters, routes, main wiring, retention purge |
| FPW-T08 | Mobile: types, mutations, error mapper, two steps, screen, login link |
| FPW-T09 | Verify: vet, tests (+ Postgres), tsc, eslint |
