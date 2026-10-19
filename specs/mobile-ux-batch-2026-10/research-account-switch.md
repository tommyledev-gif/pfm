# Feasibility: Facebook-style Account Switching (mobile)

> Request 2026-10-04: "Switch account like Facebook. No 'remember me' — once an account has logged in on this device, the user can switch to it without logging out and without typing credentials. Saved accounts do expire. Up to 10 s per switch is acceptable."
> Status: **Research / design — decisions confirmed 2026-10-04 (§1.1).** Next: `/cook-ba` → `/cook-plan`.
> **Superseded in part 2026-10-19:** the switch token designed here (§3.1, 180 days, single-use) was retired for current app builds. Each saved account now keeps its own device-bound session, switching is `POST /auth/refresh` with that account's refresh token, and sessions last 60 days unused / 180 days at most. Kept as the record of the original research; the current design is in [mobile-account-switch spec](../mobile-account-switch/spec.md) and [plan](../mobile-account-switch/plan.md) ("Revision 2026-10-19").

---

## 1. Requirements

| # | Requirement |
|---|---|
| R1 | Every successful login/activation on the device is **automatically** added to the account list — no "remember me" checkbox, no opt-in |
| R2 | Switching to a listed account needs **no logout and no email/password** |
| R3 | A saved account **expires 180 days after its last use**; an expired one needs a normal login again |
| R4 | One switch completes in **≤ 10 s** (target ~1–3 s) |
| R5 | No data of account A is ever visible to, or uploaded as, account B |
| R6 | **Max 5 accounts per device** |
| R7 | Settings: a "Chuyển tài khoản" block **directly above the Đăng xuất button**, showing an overlapping avatar group — **max 3 avatars, the 4th onwards collapsed into a "+N" circle** |

### 1.1 Decisions (confirmed by product owner, 2026-10-04)

1. Unused-account expiry: **180 days** since last use.
2. Cap: **5 accounts / device**.
3. Entry point: the avatar-group block above Đăng xuất. Tapping it:
   - **more than one other account** → a dialog to pick the account, then switch;
   - ⚠️ *Assumption A-01:* **exactly one other account** → switch straight to it (no dialog needed — nothing to choose); 
   - ⚠️ *Assumption A-02:* **no other account** → the dialog opens with only "+ Thêm tài khoản".

---

## 2. Current state (verified in code)

| Area | Today | Where |
|---|---|---|
| Session storage | One session, 4 fixed SecureStore keys (`pfm_access_token`, `pfm_refresh_token`, `pfm_user_email`, `pfm_tokens_issued_at`) | `mobile/src/lib/constants.ts:6-16`, `session-store.ts:61-78` |
| Logout | `clear()` wipes all 4 keys + `queryClient.clear()` | `session-store.ts`, `settings.tsx:100-114` |
| Server-side logout | **Mobile never calls `POST /auth/logout`** — the refresh token stays valid on the server until its 7-day expiry | no hit for `/auth/logout` in `mobile/src`; endpoint exists `routes.go:34`, `auth_service.go:202` |
| Refresh | `POST /auth/refresh` rotates: new pair issued, old JTI revoked; checks user still `active` | `auth_service.go:150-196` |
| Token TTLs | access 15 min, refresh **7 days, sliding** | `common/constants.go:36-37`, `token_service.go` `GenerateTokenPair` |
| Token kinds | access, refresh, and a purpose-tagged `ImportTokenClaims` (a token kind JWTAuth never accepts) | `token_service.go:15-50` |
| Revocation | `revoked_tokens(token_jti UNIQUE, user_id, expires_at)` — generic by JTI | `003_revoked_tokens.sql` |
| User identity on device | `user_id` + `role` decoded from the access token; email stored separately | `mobile/src/lib/jwt.ts:51-77` |
| Per-user local data reset | `installSessionScopedReset` reacts only to `accessToken` going **null → token** or **token → null** | `mobile/src/stores/session-scoped-reset.ts:41-56` |
| Saved / recent phrases | already keyed `byUser` | `saved-phrases-store.ts`, `recent-phrases-store.ts` |
| Saved budget plan | **single slot**, "dropped only when someone else logs in" | `session-scoped-reset.ts:31-35`, `budget-wizard/saved-plan.ts` |
| Chat thread | one local thread, wiped on logout/login, restored from server | `chat-store.ts` |
| Avatars | `Avatar` with initial fallback; no user avatar images exist | `mobile/src/components/ui/Avatar` |

### Why 180 days needs a backend change

The only credential that can mint a session without a password is the **refresh token, which lives 7 days**. A device-only design therefore caps unused accounts at 7 days. Raising the refresh TTL to 180 days for everyone would weaken every session (CLAUDE.md Auth Flow fixes it at 7 d). → A **separate, narrow-purpose "switch token"** is needed (§3.1).

### Pitfalls found

| # | Pitfall | Consequence if ignored |
|---|---|---|
| P1 | A direct switch sets `accessToken` **A → B** (never null) → `installSessionScopedReset` returns early | A's chat thread stays under B **and chat-store's sync uploads it to B's account** ⚠️; budget plan not re-claimed |
| P2 | Saved budget plan is a single slot | Every switch A→B→A deletes A's unsaved plan |
| P3 | In-flight requests of A can resolve after the switch | A's data repopulates the global-keyed query cache under B |
| P4 | Switch and refresh tokens rotate (old JTI revoked) | The **new** token must be persisted after every use, or the next switch back fails |
| P5 | No server-side revocation on logout | A logged-out account's tokens stay valid server-side |
| P6 | `(auth)` routes are guarded off while a session exists (`Stack.Protected`, `app/_layout.tsx`) | "Add account" can't reuse the login screen as-is while logged in |

---

## 3. Design

### 3.1 Backend — switch token (new, small)

A fourth token kind, same pattern as `ImportTokenClaims`: purpose-tagged JWT, **never accepted by JWTAuth or `/auth/refresh`**.

| Claim | Value |
|---|---|
| `sub` | user id |
| `jti` | random UUID (revocation key in `revoked_tokens`) |
| `purpose` | `account_switch` |
| `exp` | now + **180 days** (`common.AccountSwitchTokenTTL`) |

| Endpoint | Auth | Behaviour |
|---|---|---|
| `POST /auth/switch-token` | JWTAuth (active session) | Issues `{ switch_token, expires_at }` for the caller. Mobile calls it right after login / activation |
| `POST /auth/switch` | none (the token is the credential); rate-limited | Body `{ switch_token }` → verify signature, purpose, expiry, not revoked, user `active` → returns `{ access_token, refresh_token, switch_token, switch_token_expires_at }` and **revokes the presented JTI** (rotation = sliding 180 days, R3) |
| `POST /auth/switch-token/revoke` | none; idempotent like logout | Body `{ switch_token }` → revoke its JTI. Used on Đăng xuất and on "Gỡ khỏi thiết bị" |

- Errors: invalid/expired/revoked/disabled user → `401 UNAUTHENTICATED` (client marks the account expired); malformed → `400`.
- No new table: `revoked_tokens` already keys by JTI. No migration.
- Never logged (token values), same as refresh tokens.

### 3.2 Device — account registry

- SecureStore, one key per secret + one small index:
  - `pfm_account_st_<userId>` → switch token
  - `pfm_accounts` → `[{ userId, email, role, switchExpiresAt, lastUsedAt }]` (no secrets; each value stays far under SecureStore's ~2 KB iOS guidance)
- Active session keeps the existing 4 keys — axios interceptor, refresh scheduler and route guard unchanged.
- R1: after login/activate succeeds, the client calls `POST /auth/switch-token` and upserts the account. No checkbox.
- R6: a 6th account evicts the least recently used one (revoke its switch token first, best effort).
- R3: `switchExpiresAt` = `exp` of the stored switch token; it slides on each switch. Rows show "Đang dùng" · "Đã hết hạn — đăng nhập lại".

### 3.3 Switch flow (R2, R4, R5)

```
tap account B
 ├─ B expired locally? → login screen in "add account" mode, email prefilled, stop
 ├─ offline? → toast "Cần kết nối mạng để chuyển tài khoản", stop
 ├─ overlay on (same pattern as logout, settings.tsx:188-194)
 ├─ flush A's chat sync                      (cap 3 s, best effort)
 ├─ POST /auth/switch with B's switch token  (timeout 6 s)
 │    ├─ 401 → mark B expired, toast, stay on A
 │    └─ network/5xx → toast, stay on A (nothing changed)
 ├─ store B's rotated switch token            (P4)
 ├─ queryClient.cancelQueries() → clear()     (P3)
 ├─ setTokens(B pair)
 ├─ explicit per-user reset: chat cleared → restored from server; budget plan by B's userId   (P1, P2)
 └─ router.replace to home, overlay off
```

A's own switch token stays in the registry, so switching back works with no password. Worst case 3 + 6 = 9 s; normally 1–2 s (R4).

### 3.4 Logout and remove

| Action | Behaviour |
|---|---|
| **Đăng xuất** | `POST /auth/logout` (refresh token) + `POST /auth/switch-token/revoke` (best effort, P5) → remove the current account from the registry → if other valid accounts exist, show the account chooser on the login screen; else the plain login screen |
| **Gỡ khỏi thiết bị** (per row in the dialog) | Revoke its switch token (best effort) → delete its registry entry + its per-user local data |
| Active session's refresh fails with 401 | Same as today (session ends), but the account stays in the registry; it can still be re-entered via its switch token if that is valid |

### 3.5 UI

- **Settings, directly above Đăng xuất (R7):** a row "Chuyển tài khoản" with an overlapping avatar group on the right — up to **3** avatars (initials via `Avatar`, the active account first), each with a ring in the screen background colour to separate the overlap; from the 4th account on, a dark circle "+N" (N = accounts − 3). Tap → §1.1 rule.
- **Account dialog:** rows (avatar, name, email, status; active one marked, not tappable), "Gỡ khỏi thiết bị" per inactive row, "+ Thêm tài khoản" at the bottom (hidden at 5 accounts, with a hint).
- **"+ Thêm tài khoản":** login screen inside `(app)` (e.g. `app/(app)/add-account.tsx`, reusing the login form) — the current session is untouched until the new login succeeds, then the switch flow continues from "setTokens" (P6).
- **Login screen when logged out:** if the registry has valid accounts, show "Tiếp tục với…" rows above the form.

### 3.6 Per-user local data

| Store | Change |
|---|---|
| Query cache | cleared on every switch (user changes). Rotation no longer clears it (fixed 2026-10-04, research-offline.md B2) |
| Chat thread | cleared + restored from server on switch (explicit call) |
| Saved budget plan | **single slot → `byUser`** |
| Phrases | already `byUser` |
| Offline outbox (future) | `byUser` from day one |
| Theme / UI prefs | device-wide |

---

## 4. Security

| Risk | Note | Mitigation |
|---|---|---|
| Anyone holding the unlocked phone can enter every saved account, **including an admin** | Explicit requirement (no password on switch), same trade-off as Facebook | 180-day expiry; 5-account cap; per-account removal; revocation on logout. Optional later: biometric gate (`expo-local-authentication`) under "Bảo mật" |
| A 180-day bearer credential | Longer-lived than the 7-day refresh token | Narrow purpose (only `/auth/switch` accepts it), rotation on every use, JTI revocation, user-status check, rate limit, SecureStore (Keychain/Keystore) |
| Stolen switch token replayed | Rotation means a replay after the legit use fails; a replay *before* it wins once | Rotation + revoke on logout/remove; admin disabling the user kills all of them |
| Cross-account data leak | P1, P3 | Explicit reset on switch; cancel queries before clearing |

---

## 5. Effort

| Layer | Work | Size |
|---|---|---|
| Backend | switch-token claims + 3 endpoints + limiter + tests (no migration) | S–M |
| mobile — session | registry, switch/remove/logout flows, explicit per-user reset, server-side logout calls | M |
| mobile — UI | avatar-group row, account dialog, add-account screen, chooser on login | M |
| mobile — data | budget plan → `byUser` | S |
| QA | A→B→A, expired / revoked / disabled B, offline switch, in-flight requests, 6th-account eviction, logout with 2+ accounts | ~0.5 day |

No new dependency.

---

## 6. Verdict

**Feasible.** 180-day expiry needs one narrow backend addition (a purpose-tagged, rotating switch token revocable through the existing `revoked_tokens` table, no migration); everything else is mobile. One switch is a single request, well inside 10 s. The real risk is local-data isolation (P1/P2), which the spec must test explicitly.

Next: `/cook-ba` → `/cook-plan` for `specs/mobile-account-switch/`.
