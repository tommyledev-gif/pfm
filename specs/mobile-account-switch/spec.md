# Feature Spec: Account Switching on Mobile (F-02 extension)

> Source: product-owner request 2026-10-04 — "Switch account like Facebook. No 'remember me' — once an account has logged in on this device, the user can switch to it without logging out and without typing credentials. Saved accounts do expire. Up to 10 s per switch is acceptable." Decisions confirmed 2026-10-04 in the approved research note (180-day expiry since last use, 5 accounts per device, entry point above the logout button). Extended by the product owner's final decisions of 2026-10-04 (open questions closed; interrupted switches; "sign out everywhere"; identity check before switching; Security screen). Owner guidance: prefer the cheapest option with the biggest impact.
> **Revised 2026-10-19** from the product owner's "Device-bound session + biometric vault" proposal, applied where it fits and adapted where it does not: every saved account keeps its own device-bound session (no separate switch credential any more), lifetimes 60 days unused / 180 days signed in, a device list with "sign out this device", change password, and an opt-in app lock (US-10…US-12). What was not adopted, and why, is listed under "Not adopted" below.
> Status: US-01…US-09 shipped 2026-10 (switch-credential design); the 2026-10-19 revision (device-bound sessions, US-10…US-12) is being implemented — **backend + `mobile/`**. `frontend/` (web) is frozen and out of scope.
> Related: [research-account-switch](../mobile-ux-batch-2026-10/research-account-switch.md) (original feasibility + decisions, superseded where this file says "Changed 2026-10-19"), [mobile-session-refresh](../mobile-session-refresh/spec.md) (the session renewal that switching now reuses), [security](../security/spec.md) (login/logout this extends), [ops-runbook §5](../../docs/ops-runbook.md) (sessions in production).

## Context

Today a phone holds exactly one signed-in User. Moving to another User means logging out and typing the other email and password. A household where two or more people share a phone (or one person with an admin and a member account) pays that cost on every switch.

This feature lets the device **remember every User who has logged in on it** and switch between them with one tap, no password, no logout — the pattern Facebook and Google apps use. There is no "remember me" choice: being remembered is automatic.

Since 2026-10-19 each remembered account keeps **its own signed-in session on this device**. A password is typed once per account per device; after that, opening the app and switching between saved accounts costs at most one fingerprint, face or screen-lock check. A lost phone is handled from another device ("Thiết bị đang đăng nhập" → sign that device out), or by changing the password.

**Resolved decisions (product owner, final):**

1. **Automatic** — every successful login on the device adds that User to the device's account list. No checkbox, no opt-in.
2. **Expiry: 60 days unused, 180 days signed in.** An account not opened on this device for 60 days, or signed in on it 180 days ago, needs its password again on this device. Opening it (being the active account, or being switched to) resets the 60-day clock; nothing resets the 180-day one. (Changed 2026-10-19: was 180 days after last use, sliding, with no absolute limit.)
3. **No separate switch credential.** Each saved account holds the renewal credential of its own session on this device; switching into it is a normal session renewal of that account. The normal session lifetimes changed to match decision 2: 60 days unused (sliding) and 180 days absolute, instead of 7 and 30. The access lifetime stays 15 minutes. (Changed 2026-10-19: the session lifetime used to stay at 7 days and switching used its own 180-day single-use credential that could only start a session. That credential is retired; its endpoints keep working only for app builds older than this revision.)
4. **Cap: 5 accounts per device.**
5. **Entry point:** a "Chuyển tài khoản" row on Settings, directly above the "Đăng xuất" button, showing an overlapping avatar group — at most 3 avatars; from the 4th account on, a dark "+N" circle.
6. **One switch completes in at most 10 seconds** (normally 1–3 s).
7. **No data of one User is ever shown to, or saved as, another User** on the same device.
8. **Tap behaviour by number of other accounts:** exactly **one other** saved account → tapping the row switches to it directly, no dialog. **No other** account → the dialog opens with the active account (labelled "Đang dùng", not tappable) and the "+ Thêm tài khoản" action only. (Changed 2026-10-06: the dialog always opens — US-02 step 3.)
9. **Admin accounts** are remembered and can be switched into without a password, like any other User (protected by the identity check, decision 12).
10. **"Last use" is accurate to minutes**: the idle clock moves on every session renewal (about every 12 minutes while an account is in use). (Changed 2026-10-19: it was accurate to about one day, from a daily credential renewal.) The per-network limit on switch attempts applied to the retired switch endpoint; a switch is now a session renewal, which has no limit of its own (Open Question 8).
11. **Interrupted switch:** when a switch gets no answer in time, the server may already have renewed that account's session. Retrying within 5 minutes works; after that the old credential counts as reused, the session ends and the account needs one password login, and the message says why. A switch with no answer never marks the account ended by itself; only a later refusal does. (Changed 2026-10-19: the 5-minute retry window is new.)
12. **Identity check before switching:** before a switch into a saved account, the phone asks for its owner's fingerprint, face or screen-lock code. On by default; can be turned off per device on a new Security screen. A phone with no screen lock set up still switches, with a one-time warning. Not asked for background renewal.
13. **Sign out everywhere:** a User can sign their account out of every other device from the Security screen (the current device stays signed in); an Admin can do the same for another User from the household members screen. Other devices lose access at their next request. (Changed with sessions, migration 028: access already granted used to run out within the short access lifetime.)
14. **Security screen:** the existing "Bảo mật" row on Settings opens it. Order since 2026-10-19: Thiết bị đang đăng nhập · Đổi mật khẩu · Khóa ứng dụng · Xác minh khi chuyển tài khoản · Passkey · Đăng xuất mọi thiết bị · (operator only) Xóa tài khoản.
15. **Sessions are bound to a device** (2026-10-19). The app creates a random device id once and reports it, with the device's name, on every request. A User has at most one live session per device: signing in again on the same device ends that User's previous session there. Other Users' sessions on the same device are untouched.
16. **Device list + sign out one device** (2026-10-19, US-10): the Security screen lists the User's signed-in devices and can sign out any one of them except the current one.
17. **Change password** (2026-10-19, US-11): ends every session of the User on every device; the device that changed it stays signed in.
18. **App lock, opt-in** (2026-10-19, US-12): off by default; when on, the app asks for the phone's fingerprint, face or screen-lock code on a cold start and after 5 minutes in the background.

**Not adopted from the 2026-10-19 proposal (and why):**
- **Separate `devices` and `refresh_tokens` tables** — the `sessions` table (migration 028) already is the token family (rotation, reuse detection, per-session revoke). Device columns go on `sessions` instead; "a device" in the UI = one live session of the User.
- **Storing a hash of the renewal credential** — renewal credentials are signed tokens; the server keeps only their id, which is useless without the signature, so hashing adds nothing.
- **Renewal credential locked behind the fingerprint in the phone's key store** — not possible with the secure storage the app uses: it accepts biometrics only (no screen-lock code fallback), asks on every read and write, and its key is invalidated when a fingerprint is added. The active session renews about every 12 minutes, so every renewal would prompt. Credentials stay in secure storage (encrypted, not biometric-bound) and the fingerprint is a screen gate (switch check + optional app lock). The real fix for a copied credential is phase 2 (a device key pair, Out of Scope). Consequence: there is no "fingerprints changed, key invalidated" failure to handle.
- **Access credential kept in memory only** — it lives 15 minutes and is checked against its session on every request, so revocation is already instant; keeping it in secure storage lets an offline cold start open from saved data ([mobile-offline-support](../mobile-offline-support/spec.md)).
- **Password reset by email code** — no forgot-password feature exists yet (production-readiness P0). Lost-device remedies today: sign that device out (US-10), sign out everywhere (US-08), change password (US-11).
- **Admin resets a User's password** — no such feature; the Admin's tool is "sign out everywhere" for that User (US-09), which leaves an audit log line.

Notes:
- Invite activation happens in the browser (the backend's own activation page), not in the mobile app — so on mobile "login" is the only way an account enters the list. A freshly activated User is remembered on their first mobile login. The browser page sends no device id, so the session it starts shows as "Thiết bị không rõ tên".
- No money is read or written by this feature; money rules do not apply.

Actors:
- **User** — any active User (`admin` or `member`) on the mobile app.
- **Admin** — an active User with the admin role, acting on another User from the household members screen (US-09).
- **System** — the backend starting, renewing and ending device-bound sessions (and, for app builds older than 2026-10-19 only, issuing and redeeming switch credentials).

### Key Entities

| Entity | Lives on | Meaning |
|---|---|---|
| Saved Account | Device | One User remembered on this device: identity (id, email, display name, role), the renewal credential of that User's session on this device, when it was last used, and whether its session has ended ("Hết phiên"). At most 5 per device. Never contains a password. |
| Saved Session (device-bound session) | Server (one `sessions` row) + Device (secure storage, one slot per Saved Account) | A normal signed-in session of one User on one device. Its renewal credential is replaced on every renewal. Ends after 60 days without a renewal, 180 days after its sign-in, or when ended (logout, removal, device sign-out, password change, sign out everywhere, reuse of an old credential). Changed 2026-10-19: replaces the Switch Credential. |
| Device | Device (random id, kept in secure storage) + Server (recorded on each session) | The app installation, identified by a random id created once, plus the name the phone reports. Not an account. In the device list, "a device" = one live session of the User; a reinstall creates a new id. |
| Active Session | Device | The Saved Session of the account currently in use. |
| Switch Credential (deprecated) | Device (secure storage) + server (revocation list) | Until 2026-10-19: a long-lived, single-purpose credential per Saved Account that could only start a session for its User, single-use, 180 days. Kept only for app builds older than the revision; a current build converts any it still holds once (US-01) and never asks for a new one. |
| Sign-out-everywhere Point | Server (per User) | The moment the User (or an Admin) last chose "sign out everywhere", or the User last changed the password. Empty until first used. Every session of the User ends at that moment, and credentials issued before it are refused. Stored in UTC. |
| Device Security Preference | Device | Whether the identity check before switching is on (default on), whether the "no screen lock" warning has already been shown, and whether app lock is on (default off). Shared by all accounts on the device. |

### Business Rules

| ID | Rule |
|---|---|
| BR-01 | A Saved Account is created or refreshed on every successful login on the device — never through a separate opt-in. It keeps the session that login started. |
| BR-02 | A device holds at most 5 Saved Accounts. Adding a 6th removes the least recently used one that is not the active one and ends its session. |
| BR-03 | A Saved Session ends 60 days after its last renewal on this device (the account in use renews about every 12 minutes; a switch into it renews it), or 180 days after its sign-in, whichever comes first. The account then shows "Hết phiên" and needs its password (or a passkey) on this device. (Changed 2026-10-19: was 180 days after last use.) |
| BR-04 | Switching into a Saved Account renews that account's own session with its own renewal credential. Nothing but a password login (or a passkey) starts a new session. (Changed 2026-10-19: a separate switch credential used to start a new session.) |
| BR-05 | Every renewal replaces the renewal credential. The server accepts only the newest one, or the one it just replaced for 5 minutes (an answer lost in a tunnel can be retried). Presenting an older one ends the whole session (reuse detection). (Changed 2026-10-19: was "a switch credential is single-use".) |
| BR-06 | A switch is refused when that account's session has ended (60 days unused, 180 days signed in, logout, removal, device sign-out, password change, sign out everywhere, reuse) or its User is no longer active. |
| BR-07 | Switching never needs the target User's password and never ends the previous User's session: it stays in that account's slot as its Saved Session. |
| BR-08 | Per-User local data (chat conversation, saved budget plan, saved and recent phrases) is kept apart per User. Device-wide preferences (theme, appearance) are shared. |
| BR-09 | Logging out or removing a Saved Account ends its session on the server (best effort when offline) and deletes its credential from the device. (Changed 2026-10-19: revoked its switch credential.) |
| BR-10 | Renewal credentials, access credentials and (deprecated) switch credentials are never written to any log. |
| BR-11 | After "sign out everywhere", every session of that User ends on every device, and every credential of that User issued before that moment is refused. A device holding access granted before that moment cannot repeat or undo the action. |
| BR-12 | The device that asks to sign its own User out everywhere receives a fresh session for this device in the same answer and stays signed in. (An older app build also receives a fresh switch credential; a request carrying a device id never does.) |
| BR-13 | Only an Admin can sign another User out everywhere; an Admin signs themself out through the Security screen like any User. |
| BR-14 | When the identity check is on, every switch into a saved account (switch dialog, direct switch, "Tiếp tục với…") needs the check passed first. Cancelled or failed → no switch, nothing changes. |
| BR-15 | A phone with no fingerprint, face or screen lock set up switches without the check; the first time, a warning is shown (once per device). |
| BR-16 | A switch with no answer within the time limit leaves the Saved Account as it was (not ended). Retried within 5 minutes it succeeds (BR-05). If a later switch to it is refused, the message explains that the earlier switch was interrupted and a password login is needed. |
| BR-17 | A User has at most one live session per device: a new sign-in of that User on a device ends that User's previous session there. Other Users' sessions on the same device are not touched. A User has at most 5 live sessions in all (in effect 5 devices); starting a 6th ends the least recently used. (2026-10-19) |
| BR-18 | A renewal result is always stored in the slot of the account it belongs to, even when the device switched to another account while it was running. It never becomes the active session of another account and never overwrites another account's credential. (2026-10-19) |
| BR-19 | A refused renewal (401 or 400) of a Saved Account marks that account "Hết phiên" and deletes its stored credential; the entry stays listed; other Saved Accounts are untouched. When it is the active account, the session ends with "Phiên đăng nhập đã hết hạn." and the login screen lists the remaining accounts. (2026-10-19) |
| BR-20 | The device list shows only the caller's own live sessions. Signing out one device ends that session only; the current device cannot be signed out from the list (it uses "Đăng xuất"). (2026-10-19) |
| BR-21 | Changing the password ends every session of the User on every device; the device that changed it receives a fresh session in the same answer. A wrong current password is never answered as "session over". (2026-10-19) |
| BR-22 | When app lock is on, no screen of the signed-in area is visible on a cold start, or after 5 minutes in the background, until the phone's check passes. App lock is a screen gate only: it does not lock stored credentials and does not stop background renewal. (2026-10-19) |

---

## US-01: Remember Every Account That Logs In

**As a** User,
**I want** the app to remember my account as soon as I log in on this phone,
**so that** I (or someone sharing the phone) can come back to it later without typing my password.

**API:** existing `POST /auth/login` (and `POST /auth/passkeys/login/finish`), sent with the device headers `X-Device-Id` / `X-Device-Name`. (Changed 2026-10-19: no second request; was followed by `POST /auth/switch-token`.) One-time upgrade only: `POST /auth/switch`, `POST /auth/switch-token/revoke` (deprecated).

### Preconditions
- The User has just logged in successfully on the mobile app.

### Main Flow
1. User logs in with email and password (or a passkey).
2. System starts a session bound to this device — ending this User's previous session on this device, if any (BR-17) — and returns its access and renewal credentials.
3. App stores the renewal credential in this User's slot in secure storage and adds (or updates) the User in the device's account list, marking it last used now. The account is switchable from this moment.
4. If the list now holds more than 5 accounts, App removes the least recently used inactive one: ends its session on the server (best effort), deletes its slot and its local per-User data.

**Upgrade from an older build (once, on the first start after the 2026-10-19 update):** for each Saved Account that still holds a switch credential —
- the active account: App copies the active session's renewal credential into its slot and revokes its switch credential (best effort);
- each inactive account: App redeems its switch credential once (`POST /auth/switch`, sent with the device id), keeps the returned session's renewal credential in that account's slot and receives no new switch credential;
- a redemption the server refuses marks that account "Hết phiên"; one that gets no answer is tried again on the next start.

### Acceptance Criteria
- **AC-01** — After a successful login, the User appears in the account list without any extra step or prompt.
- **AC-02** — Logging in again as a User already in the list updates that entry (no duplicate)
  and that User's previous session on this device ends on the server.
- **AC-03** — A 6th account added to a device with 5 removes the least recently used inactive account
  and that account's session ends on the server.
- **AC-04** — An account is switchable as soon as its login succeeds; no second request is needed. Accounts saved by an older build are converted once on the first start after the update, without asking for any password. (Changed 2026-10-19: was "if obtaining the switch credential fails, the login still succeeds and the App retries on the next start".)

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-ASW-01 | Empty account list | User A logs in | Session starts; account list = [A] | AC-01 |
| S-ASW-02 | List = [A]; A shows "Hết phiên" | User A logs in again | List still holds one entry for A, with the new session; any older session of A on this device no longer works | AC-02, BR-17 |
| S-ASW-03 | List holds 5 accounts, A is least recently used | A 6th User F logs in from the login screen | F added; A removed; A's session ended on the server | AC-03, BR-02 |
| S-ASW-04 | App updated from a build that saved switch credentials; A active, B and C saved | First start after the update | A's slot holds A's current session credential and A's switch credential is revoked; B and C each get a device-bound session from one `POST /auth/switch` with `X-Device-Id` (the answer holds no new switch credential); no password asked | AC-04, upgrade. Changed 2026-10-19 (was: credential request fails after login) |
| S-ASW-05 | Same, but C's switch credential is refused (expired, used, revoked, or C was signed out everywhere) | First start after the update | C shown "Hết phiên"; A and B converted as in S-ASW-04 | AC-04, BR-19. Changed 2026-10-19 (was: `POST /auth/switch-token` unauthenticated → 401) |

### Edge Cases
- **EC-01** — The device still holds a live session of the User being logged in (e.g. the list entry was lost but the session was not): the new login replaces it on the server (BR-17); the old credential stops working. (Changed 2026-10-19: was a credential request racing a logout.)
- **EC-02** — The device's secure storage write fails: the account is not listed (a listed account without a usable credential would be a dead row).
- **EC-03** — A 6th account appears only through the login screen while logged out (the "+ Thêm tài khoản" action is hidden at 5 — US-03); eviction never removes the account being logged into or the active one.

### Definition of Done
- Every successful login on mobile results in exactly one list entry for that User, holding that login's device-bound session.
- The 5-account cap holds in every path; evicted accounts' sessions are ended.
- Server unit tests cover: a sign-in with a device id ends that User's previous live session on that device only (not other Users', not other devices'); the 5-session cap; a sign-in without a device id (web) records none.
- The upgrade path (S-ASW-04/05) is verified on a device that ran the previous build.

### Idempotency
Each login starts a new session, but a repeated login of the same User on the same device replaces the previous one (BR-17), so repeating never piles up sessions on one device.

---

## US-02: Switch to Another Saved Account

**As a** User,
**I want** to switch to another account saved on this phone with one or two taps,
**so that** I can use it without logging out and without typing a password.

**API:** existing `POST /auth/refresh` with the target account's saved renewal credential, sent with the device headers (unauthenticated — the credential is the credential). (Changed 2026-10-19: was `POST /auth/switch` with a switch credential, rate-limited per network.)

### Preconditions
- The User is signed in and on Settings.
- At least one other Saved Account exists (otherwise the add-only dialog opens — see AC-07).

### Main Flow
1. Settings shows a "Chuyển tài khoản" row directly above "Đăng xuất". On its right, an overlapping group of up to 3 account avatars (profile picture when the User has one, otherwise the initial letter; active account first); with 4 or more accounts, a dark "+N" circle follows, where N = number of accounts − 3.
2. User taps the row.
3. App opens the account dialog (step 4) — always, whatever the number of other accounts; with none it holds only the active account and "+ Thêm tài khoản" (AC-07). (Changed 2026-10-06: a single other account used to be switched to directly, which never showed the User which account they were going to.)
4. The dialog lists every Saved Account: avatar, display name, email, status ("Đang dùng" for the active one — not tappable; "Hết phiên" for accounts whose session has ended). Each inactive row offers "Gỡ khỏi thiết bị" (US-04). The bottom offers "+ Thêm tài khoản" (US-03).
5. User taps an account that has a session.
5a. If the identity check is on, the phone asks for it (US-07). Cancelled or failed → stop here; nothing changes.
    Never a passkey: the saved session is the credential, so switching asks only the phone's own check. (Changed 2026-10-19: switching used to try the account's passkey first, which put the Google Password Manager sheet in front of every switch; passkeys stay opt-in — "Đăng nhập bằng passkey" on the login screen.)
6. App blocks the screen with a busy overlay, gives the current User's unsaved chat conversation up to 3 s to reach the server, then sends the target's saved renewal credential to System.
7. System checks the session behind it (live, not past 60 days unused or 180 days signed in, newest credential or the one replaced within 5 minutes) and that its User is still active; it renews that session — the credential is replaced and the 60-day clock restarts — and returns a new access and renewal credential.
8. App stores the new renewal credential in the target's slot first, drops all on-screen data of the previous User, makes the target's session the active one, switches per-User local data to the new User, and lands on Home. The overlay closes.
9. The previous User's session is not ended: it stays in that User's slot, so switching back also needs no password.

### Acceptance Criteria
- **AC-05** — The "Chuyển tài khoản" row sits directly above "Đăng xuất" and shows at most 3 avatars plus, from the 4th account, a "+N" circle with the correct N.
- **AC-06** — With one or more other accounts, the tap opens the dialog and the User picks the account; the identity check (US-07) runs after the pick. Nothing switches on the row tap itself.
- **AC-07** — With no other account, the tap opens the dialog containing only the active account (labelled "Đang dùng", not tappable)
  and the "+ Thêm tài khoản" action.
- **AC-08** — A switch completes within 10 s in every outcome (success or failure), including on a slow or dead network.
- **AC-09** — After a switch, no data of the previous User is visible on any screen
  and nothing of the previous User (chat conversation, budget plan) is saved to the new User's account.
- **AC-10** — The previous User can be switched back to without a password.
- **AC-11** — A failed switch leaves the current User signed in exactly as before, with a Vietnamese error message.
  A switch that got no answer in time does not mark the target account "Hết phiên" (BR-16).
- **AC-12** — While a switch is in progress, the screen accepts no other input.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-ASW-06 | List = [A (active), B, C] | User taps "Chuyển tài khoản" | Dialog lists A ("Đang dùng"), B, C, plus "+ Thêm tài khoản" | AC-06 |
| S-ASW-07 | List = [A (active), B] | User taps the row | Dialog lists A ("Đang dùng") and B, plus "+ Thêm tài khoản"; nothing switches until B is picked | AC-06 |
| S-ASW-08 | List = [A (active)] | User taps the row | Dialog shows A ("Đang dùng", not tappable) and "+ Thêm tài khoản" only | AC-07 |
| S-ASW-09 | List = A, B, C, D, E | Settings renders | Row shows 3 avatars and a "+2" circle | AC-05 |
| S-ASW-10 | List = [A, B], 1–3 avatars | Settings renders | No "+N" circle | AC-05 |
| S-ASW-11 | A active, B saved with a live session | User picks B | `POST /auth/refresh` with B's credential → `200`; B's Home loads within 10 s; B's slot holds the new credential; A's session stays live in A's slot | Happy path, AC-08 |
| S-ASW-12 | Switched A → B | User switches back to A | Succeeds with no password | AC-10 |
| S-ASW-13 | A has an unsynced chat conversation | User switches to B | A's conversation reaches A's account (if possible within 3 s); B never sees it and it is never saved under B | AC-09, ⚠️ data isolation |
| S-ASW-14 | A has a saved budget plan | User switches A → B → A | A's plan is still there; B never saw it | AC-09, ⚠️ data loss if wrong |
| S-ASW-15 | B's session ended on the server (B's device signed out from another device, B changed password elsewhere, B was signed out everywhere — US-08/US-09 — or B unused for 60 days) | User picks B | `401`; B marked "Hết phiên" and its credential deleted; toast "Cần đăng nhập lại tài khoản này."; A stays active. If the previous switch to B got no answer (S-ASW-18), the toast instead reads "Lần chuyển trước bị gián đoạn. Cần đăng nhập lại tài khoản này." | AC-11, BR-16, BR-19, validation error (4xx) |
| S-ASW-16 | B's User was deactivated by an admin | User picks B | Same as S-ASW-15 | BR-06 |
| S-ASW-17 | B shows "Hết phiên" | Dialog opens | B shown "Hết phiên"; tapping it opens the login form with B's email prefilled | BR-03 |
| S-ASW-18 | Device offline / server unreachable, or the answer is lost after the server renewed B's session | User picks B | Within 10 s: toast "Cần kết nối mạng để chuyển tài khoản."; A stays active; B **not** marked "Hết phiên", but remembered as "last switch interrupted" for the message in S-ASW-15. Picking B again within 5 minutes succeeds | AC-11, BR-05, BR-16, system/network error |
| S-ASW-19 | Server returns 5xx | User picks B | Toast "Chưa chuyển được tài khoản. Thử lại sau."; A stays active; B unchanged | System error (5xx) |
| S-ASW-20 | A's background renewal is in flight | User switches to B before it answers | A's new credential is stored in A's slot, not B's; B stays active; switching back to A later succeeds | BR-18. Changed 2026-10-19 (was: 429 on repeated `POST /auth/switch`, which now applies to older builds only) |
| S-ASW-21 | B's stored credential is malformed | User picks B | `POST /auth/refresh` → `400 INVALID_INPUT`; B marked "Hết phiên"; A stays active | Validation error (4xx), BR-19 |
| S-ASW-22 | List = [A (active), B, C]; B's session ended on the server | User picks B, then picks C | B → `401`, "Hết phiên"; C switches normally; nothing about A or C changed by B's refusal | BR-19. Changed 2026-10-19 (was: a switch credential presented as an access credential → 401) |
| S-ASW-23 | User double-taps account B | — | Exactly one switch runs | AC-12 |

### Edge Cases
- **EC-04** — Requests of the previous User still in flight when the switch lands must not put the previous User's data on screen for the new User — they are cancelled and their results discarded.
- **EC-05** — A background session renewal of the previous User that finishes after the switch must not bring the previous User back — its result is stored in that User's slot only (BR-18).
- **EC-06** — The App is killed mid-switch: on next start, whichever session was last fully stored is restored. If the target's new credential was not stored, its slot still holds the previous one: a switch within 5 minutes works, a later one is refused as reuse and the account shows "Hết phiên" (never a mixed state).
- **EC-07** — The busy overlay cannot be dismissed with the back button while switching (same as logout today).
- **EC-08** — The tapped account disappears from the list during the switch (e.g. evicted): the switch is abandoned with the generic error; the current User stays.

### Definition of Done
- Switch works A → B → A with no password on a real device, within 10 s, every outcome.
- Data-isolation checks S-ASW-13/14 and the late-renewal check S-ASW-20 pass on device.
- Server-side unit tests cover renewal of a live session (credential replaced, idle clock restarted, never past the absolute limit), the replaced credential inside and outside the 5-minute window, ended sessions (logout, device sign-out, password change, sign out everywhere, idle and absolute expiry, reuse), inactive User, malformed credential.

### Idempotency
Not idempotent by design (BR-05): each renewal replaces the credential; the replaced one is accepted again only within 5 minutes (a lost answer), after that it ends the session. The App de-duplicates taps (S-ASW-23), so a legitimate double tap never renews twice.

---

## US-03: Add Another Account

**As a** signed-in User,
**I want** to add another account from the switch dialog,
**so that** a second person can start using this phone without logging me out first.

**API:** existing `POST /auth/login` with the device headers. (Changed 2026-10-19: no follow-up `POST /auth/switch-token`.)

### Main Flow
1. User taps "+ Thêm tài khoản" in the dialog.
2. App opens an "Thêm tài khoản" screen with an empty email/password form. The current session keeps running untouched.
3. User enters the other User's credentials and submits.
4. On success, App stores the new User's session in its slot as a Saved Account (US-01) and makes it the active session (US-02 step 8). The current User's session stays in its own slot.
5. On failure, the form shows the error; the current User is unaffected.
6. Back/close returns to Settings with the current User still active.

### Acceptance Criteria
- **AC-13** — The current session is unchanged until the new login succeeds.
- **AC-14** — "+ Thêm tài khoản" is hidden when 5 accounts are saved, replaced by the hint "Đã đạt tối đa 5 tài khoản trên thiết bị này".
- **AC-15** — Logging in to an account that is already saved behaves as a switch to it: one entry, holding the new session (the server ended its previous session on this device, BR-17).
- **AC-16** — Logging in to the account that is already active closes the screen with the toast "Bạn đang dùng tài khoản này.". The server has already replaced that account's session on this device (BR-17), so the App keeps the new session silently, with no data cleared. (Changed 2026-10-19: the App used to end the unused new session; with device-bound sessions that would leave the account with none.)

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-ASW-24 | A active, 1 account saved | User adds B with correct credentials | B active, list = [A, B]; A's session still live in A's slot | Happy path |
| S-ASW-25 | A active | User enters a wrong password for B | Error shown in the form; A still active | `401 INVALID_CREDENTIALS`, validation error |
| S-ASW-26 | 5 accounts saved | User opens the dialog | No "+ Thêm tài khoản"; hint shown | AC-14 |
| S-ASW-27 | A active, B saved but "Hết phiên" | User logs in as B through the add screen | B active; one entry for B with the new session | AC-15 |
| S-ASW-28 | A active | User logs in as A again | Toast "Bạn đang dùng tài khoản này."; A stays active on the new session; nothing else changes | AC-16 |
| S-ASW-29 | A active | User opens the add screen, then leaves without submitting | A still active, list unchanged | AC-13 |

### Edge Cases
- **EC-09** — Too many login attempts: the existing login limit applies; the error appears in the form.
- **EC-10** — The form starts empty, or prefilled with the email of the "Hết phiên" account being signed in again (S-ASW-17); never with any other value.

### Definition of Done
- A second User can be added and becomes active without the first being logged out; S-ASW-24–29 pass on device.

### Idempotency
Login is not a write to financial data; a repeated submission after success is impossible (the screen closes).

---

## US-04: Remove an Account from the Device

**As a** User,
**I want** to remove a saved account from this phone,
**so that** nobody can enter it from here any more.

**API:** existing `POST /auth/logout` with that account's renewal credential (unauthenticated, idempotent). (Changed 2026-10-19: was `POST /auth/switch-token/revoke`.)

### Main Flow
1. In the dialog (or on the login screen's saved-account row), User taps "Gỡ khỏi thiết bị" on an inactive account.
2. App asks for confirmation: title "Gỡ {name} khỏi thiết bị?", body "Tài khoản không bị xóa. Lần sau phải nhập lại email và mật khẩu.", buttons [Gỡ] [Giữ lại].
3. On confirm, App asks System to end that account's session (best effort), deletes its credential, the account from the list and that User's local per-User data (budget plan, phrases) from the device.

### Acceptance Criteria
- **AC-17** — Only inactive accounts can be removed; the active one has no remove action (it leaves via "Đăng xuất").
- **AC-18** — A removed account is gone from the list immediately, even when offline.
- **AC-19** — A removed account's session no longer works on the server once the request has reached it.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-ASW-30 | List = [A (active), B] | User removes B and confirms | List = [A]; B's session on this device ended | Happy path |
| S-ASW-31 | Offline | User removes B | B removed locally; the request is not retried | AC-18; the session then ends on its own after 60 days unused, or the User can sign this device out from another one (US-10) |
| S-ASW-32 | User taps "Giữ lại" in the confirmation | — | Nothing changes | |
| S-ASW-33 | Logout called twice with the same credential | — | Both `200` | Idempotent |
| S-ASW-34 | Logout called with a malformed value | — | `400 INVALID_INPUT` (ignored by the App) | Validation error |

### Edge Cases
- **EC-11** ⚠️ — Removing an account deletes that User's local-only data (unsynced saved budget plan) from this device. The confirmation copy states that the account will need a password next time; the plan loss is accepted (it never left the device and belongs to someone leaving it).
- **EC-12** — Ending a session that has already ended (e.g. "Hết phiên") succeeds silently.

### Definition of Done
- Removal works online and offline; server-side logout is idempotent and covered by unit tests.

### Idempotency
Logout is idempotent (ending the same session twice is a successful no-op).

---

## US-05: Log Out with Saved Accounts

**As a** User,
**I want** "Đăng xuất" to really sign me out of this phone and then let the next person pick their account,
**so that** logging out is safe and the phone stays quick to share.

**API:** existing `POST /auth/logout`. (Changed 2026-10-19: no `POST /auth/switch-token/revoke` any more.)

### Main Flow
1. User taps "Đăng xuất" (behaviour today: overlay, last chat sync, local wipe).
2. App also asks System to end the current session (best effort, inside the existing logout time cap), deletes its credential and removes the current User from the account list.
3. App shows the login screen. If Saved Accounts with a live session remain, it shows "Tiếp tục với…" rows (avatar, name, email) above the login form; tapping one switches into it (identity check per US-07, then US-02 steps 6–8, no password).
4. Accounts marked "Hết phiên" in that list prefill the form with their email when tapped.

### Acceptance Criteria
- **AC-20** — After logout, the logged-out User is no longer in the list and their session no longer works on the server (when online).
- **AC-21** — After logout with other saved accounts, the login screen offers "Tiếp tục với…" for each of them.
- **AC-22** — When the active session ends on its own (renewal refused), the User stays in the list marked "Hết phiên" and needs the password (or a passkey) to come back. (Changed 2026-10-19: the account used to re-enter without a password through its switch credential; the session itself now lasts 60 days unused, so a refusal means it really ended.)
- **AC-23** — Logout still completes when offline (local sign-out happens; server calls are dropped).

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-ASW-35 | List = [A (active), B] | A logs out | Login screen shows "Tiếp tục với…" B; A gone; A's session refused by server | AC-20, AC-21 |
| S-ASW-36 | List = [A (active)] | A logs out | Plain login screen | |
| S-ASW-37 | A's session renewal is refused (60 days unused, 180 days signed in, or ended from another device) | — | Toast "Phiên đăng nhập đã hết hạn."; login screen lists A as "Hết phiên" (and the others as usual); tapping A opens the form with A's email | AC-22, BR-19. Changed 2026-10-19 |
| S-ASW-38 | Offline | A logs out | Local logout completes within the existing cap; A removed from the list | AC-23 |
| S-ASW-39 | Logged out, "Tiếp tục với…" B tapped, B's session ended on the server | — | B marked "Hết phiên"; form prefilled with B's email | BR-19 |

### Edge Cases
- **EC-13** — A second tap on any "Tiếp tục với…" row while a switch from the login screen is already running is ignored (same tap guard as AC-12).
- **EC-14** — The chooser lists only accounts from this device's list; nothing about other Users is fetched from the server.

### Definition of Done
- Logout ends the session server-side on mobile; chooser appears and works.

### Idempotency
Logout is idempotent on the server (existing behaviour).

---

## US-06: Saved Accounts Need the Password Again After 60 Days Unused or 180 Days Signed In

> Changed 2026-10-19: was "Saved Accounts Expire After 180 Days Unused", enforced by a 180-day switch credential renewed daily by the App. The limits now live on the session itself and the server alone enforces them.

**As a** User,
**I want** an account that nobody has opened on this phone for 60 days, or that was signed in here 180 days ago, to need a password again,
**so that** an old, forgotten account on a shared phone cannot be entered forever.

**API:** existing `POST /auth/refresh` (every renewal and every switch moves the idle clock).

### Main Flow
1. While an account is in use, the App renews its session about every 12 minutes ([mobile-session-refresh](../mobile-session-refresh/spec.md)); each renewal sets the session's idle expiry to 60 days from then, never later than 180 days after its sign-in.
2. Each switch into an account renews its session the same way (US-02 step 7).
3. A session not renewed for 60 days, or signed in 180 days ago, is refused at its next renewal; the account is then shown "Hết phiên" everywhere (BR-19) and tapping it prefills the login form. The App keeps no expiry dates of its own.

### Acceptance Criteria
- **AC-24** — An account used on this device within the last 60 days, and signed in less than 180 days ago, switches without a password.
- **AC-25** — An account not used for more than 60 days, or signed in more than 180 days ago, is refused by the server and shown "Hết phiên".
- **AC-26** — Expiry times are kept in UTC by the server and any date shown to the User is in the device's local time.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-ASW-40 | A has been the active account continuously for 100 days (signed in less than 180 days ago) | User switches to B, then back to A | Switch back succeeds (A's session was renewed while in use) | AC-24 |
| S-ASW-41 | B not used on this device for 61 days | User picks B | `401`; B shown "Hết phiên"; tapping it prefills the form | AC-25 |
| S-ASW-42 | A signed in on this device 180 days ago and used every day | A's next renewal | Refused; toast "Phiên đăng nhập đã hết hạn."; A listed as "Hết phiên"; the password (or a passkey) brings it back | AC-25, absolute limit. Changed 2026-10-19 (was: device clock ahead showed B expired too early) |
| S-ASW-43 | Device clock is wrong (ahead or behind) | User picks B | Outcome decided by the server only; the device clock plays no part | Server is the authority. Changed 2026-10-19 |

### Edge Cases
- **EC-15** — A renewal that fails offline is silent and retried later ([mobile-session-refresh](../mobile-session-refresh/spec.md)); only 60 days without any successful renewal or switch ends the session. A renewal refused because the User was signed out everywhere, signed this device out, or changed the password is not retried; the account shows "Hết phiên". (Changed 2026-10-19: there is no daily credential renewal any more.)

### Definition of Done
- Server lifetimes: 60 days idle, sliding on every renewal (`RefreshTokenTTL`), 180 days absolute (`SessionAbsoluteTTL`); access 15 minutes unchanged.
- S-ASW-40/41/42 verified (by shortening the lifetimes in a test build).

### Idempotency
Renewal is not idempotent (each one replaces the credential); the App stores each result in the slot of the account it belongs to (BR-18).

---

## US-07: Confirm It Is Me Before Switching (Security Screen)

**As a** User,
**I want** the phone to check my fingerprint, face or screen-lock code before it switches into a saved account,
**so that** someone holding my unlocked phone cannot walk into another saved account.

**API:** none — the check happens on the phone.

### Preconditions
- A switch into a saved account with a live session was requested from the switch dialog, the direct switch (one other account), or "Tiếp tục với…" on the login screen.

### Main Flow
1. Settings → "Bảo mật" opens the "Bảo mật" screen. Its section "Xác minh khi chuyển tài khoản" (order in decision 14) has an on/off switch (on by default) with the hint "Yêu cầu vân tay, khuôn mặt hoặc mã khóa màn hình trước khi chuyển sang tài khoản đã lưu."
2. When a switch is requested and the check is on, App asks the phone to confirm its owner ("Xác minh để chuyển tài khoản", cancel label "Hủy") before anything else happens (no overlay yet). The phone offers fingerprint or face, and always its screen-lock code as an alternative.
3. Passed → the switch continues (US-02 step 6).
4. Cancelled → nothing happens; the dialog or chooser stays open.
5. Failed (the phone gives up) → toast "Không xác minh được. Chưa chuyển tài khoản."; nothing changes.
6. Phone with no fingerprint, face or screen lock set up → the switch continues without a check; the first time this happens on the device, App shows the warning "Máy chưa cài khóa màn hình nên ai cầm máy cũng có thể chuyển tài khoản. Hãy cài khóa màn hình trong cài đặt của máy."
7. Turning the switch off on the Security screen first asks for the check (when the phone has a lock); cancelled or failed → it stays on. Turning it on needs no check.

### Acceptance Criteria
- **AC-27** — With the check on, every switch into a saved account (dialog, direct switch, "Tiếp tục với…") asks for the check before the busy overlay appears or anything changes.
- **AC-28** — A cancelled or failed check leaves the current User (or the login screen) exactly as before
  and does not renew the saved account's session.
- **AC-29** — On a phone with no lock set up, the switch proceeds; the warning appears once per device, never again.
- **AC-30** — With the check off, no check is asked.
- **AC-31** — The check is on by default; the setting belongs to the device (shared by all its accounts) and is kept across switch, logout and app restart.
- **AC-32** — Turning the check off requires passing it (when the phone has a lock); turning it on does not.
- **AC-33** — The check is never asked for a password login, adding an account, tapping a "Hết phiên" account, background renewal, or opening the app. (Opening the app asks only when app lock is on — US-12, a separate setting.)
- **AC-34** — The "Bảo mật" row on Settings opens the Security screen; back returns to Settings; the bottom bar keeps Settings highlighted.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-ASW-44 | Check on; phone has a fingerprint; A active, B saved | User picks B and passes the check | Switch proceeds as S-ASW-11 | Happy path |
| S-ASW-45 | Check on | User picks B and cancels the check | No switch; dialog stays open; A active; B unchanged; no message | AC-28 |
| S-ASW-46 | Check on | The check fails until the phone gives up, and the screen-lock code is dismissed | Toast "Không xác minh được. Chưa chuyển tài khoản."; A active | AC-28 |
| S-ASW-47 | Phone with no lock set up; warning never shown | User picks B | Switch proceeds; warning shown | AC-29 |
| S-ASW-48 | Same phone, warning already shown | User picks C | Switch proceeds; no warning | AC-29 |
| S-ASW-49 | Check turned off | User picks B | Switch proceeds with no check | AC-30 |
| S-ASW-50 | iPhone running the test app (face recognition unavailable there) | User picks B | Phone asks for its screen-lock code; correct code → switch proceeds | AC-27 |
| S-ASW-51 | Logged out; login screen shows "Tiếp tục với…" B | User taps B | Check asked first; passed → B's Home | AC-27 |
| S-ASW-52 | Check on; phone has a lock | User turns the switch off and cancels the check | Switch stays on | AC-32 |
| S-ASW-53 | B shows "Hết phiên" | User taps B | No check; the login form opens with B's email | AC-33 |

### Edge Cases
- **EC-16** — The App goes to the background while the check is showing: treated as cancelled.
- **EC-17** — A second tap while the check is showing is ignored (same tap guard as AC-12).
- **EC-18** — The phone's lock is removed after the check was on: switches proceed without a check; the warning is not repeated if already shown.

### Definition of Done
- S-ASW-44–53 pass on an Android device with a fingerprint and on an iPhone in the test app.
- The Security screen opens from Settings and keeps its setting after an app restart.

### Idempotency
No server write; turning the switch on or off repeatedly is harmless.

---

## US-08: Sign Out Everywhere

**As a** User,
**I want** to sign my account out of every other phone at once,
**so that** a lost or shared phone can no longer use or switch into my account.

**API:** `POST /auth/sessions/revoke-all` (authenticated, sent with the device headers)

### Preconditions
- The User is signed in on this device.

### Main Flow
1. The Security screen shows the action "Đăng xuất mọi thiết bị" with the hint "Mọi thiết bị khác phải đăng nhập lại bằng mật khẩu. Thiết bị này vẫn giữ đăng nhập."
2. User taps it; App asks: "Đăng xuất mọi thiết bị?" — "Tài khoản {email} sẽ bị đăng xuất khỏi mọi thiết bị khác, kể cả các máy đã lưu tài khoản để chuyển nhanh." with "Đăng xuất" / "Hủy".
3. On confirm, the action shows a busy state; System sets the User's sign-out-everywhere point to now and ends every session of the User.
4. System returns a fresh session for this device; App swaps it into this account's slot silently (same User, screen data stays) and shows the toast "Đã đăng xuất mọi thiết bị khác." (An older app build also receives a fresh switch credential.)
5. On every other device: the next request is refused; where the User was active, the session ends and the login screen lists the User as "Hết phiên"; any saved entry for this User is refused at its next switch and shown "Hết phiên".

### Acceptance Criteria
- **AC-35** — After confirmation, every other device signed in as this User loses access at its next request, with no action on that device. (Changed with sessions, migration 028: was "no later than the end of its current short access lifetime".)
- **AC-36** — Every device that saved this User can no longer switch into it; the entry shows "Hết phiên" after the refused attempt.
- **AC-37** — This device stays signed in without a password, and its own saved entry for this User still switches.
- **AC-38** — Offline or server failure changes nothing and shows a Vietnamese message.
- **AC-39** — Saved accounts and sessions of other Users, on any device, are not affected.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-ASW-54 | A signed in on phones 1 and 2 | A signs out everywhere on phone 1 | Phone 1 keeps working with no password; toast "Đã đăng xuất mọi thiết bị khác." | Happy path, AC-37 |
| S-ASW-55 | Same, phone 2 active as A | Phone 2 makes its next request | `401`; "Phiên đăng nhập đã hết hạn."; login screen lists A as "Hết phiên"; tapping A prefills the form | AC-35, AC-36 |
| S-ASW-56 | Phone 3 has A saved (inactive) | Someone picks A on phone 3 | `401`; A marked "Hết phiên"; toast "Cần đăng nhập lại tài khoản này." | AC-36, BR-11 |
| S-ASW-57 | A renewal credential issued before the sign-out | Client presents it for renewal | `401 UNAUTHENTICATED` | BR-11, validation error (4xx) |
| S-ASW-58 | A switch credential issued before the sign-out (older app build) | Client presents it to `POST /auth/switch` | `401 UNAUTHENTICATED` | BR-11, legacy |
| S-ASW-59 | Phone 1 after the sign-out, B also saved | A → B → A | Both switches succeed with no password | AC-37 |
| S-ASW-60 | — | User taps "Hủy" in the confirmation | Nothing changes | |
| S-ASW-61 | Phone 1 offline | User confirms | Toast "Cần kết nối mạng để đăng xuất mọi thiết bị."; nothing changes | AC-38, network error |
| S-ASW-62 | Server returns 5xx | User confirms | Toast "Không thể đăng xuất mọi thiết bị. Vui lòng thử lại."; nothing changes | AC-38, system error (5xx) |
| S-ASW-63 | Phone 2 holds access granted before the sign-out | Phone 2 asks to sign out everywhere | `401 UNAUTHENTICATED` (a lost phone cannot undo the owner's sign-out) | BR-11 |
| S-ASW-64 | — | User double-taps "Đăng xuất" in the confirmation | Exactly one request | |
| S-ASW-65 | Phone 2 also has B saved | A signs out everywhere | B on phone 2 still switches | AC-39 |
| S-ASW-66 | Phone 2 runs an older build and holds access granted before the sign-out | Phone 2 asks for a new switch credential (`POST /auth/switch-token`) | `401`; nothing issued | BR-11, legacy. Changed 2026-10-19 (the daily switch-credential renewal is gone from current builds) |

### Edge Cases
- **EC-19** — A device offline at the moment of the sign-out is refused as soon as it next makes a request, renews or switches.
- **EC-20** — Screens already showing data on another device keep it until that device's next request. (Changed with migration 028: was "until that device's access ends".)
- **EC-21** — Signing out everywhere again later works the same way; the newest moment wins.

### Definition of Done
- S-ASW-54–66 pass with two devices (or one device plus direct server calls).
- Server tests cover: sessions and credentials issued before the point refused, issued after accepted, the requesting device's fresh session accepted, stale access refused, no switch credential returned when the request carries a device id.

### Idempotency
Not idempotent: each confirmed request moves the point to now and returns a fresh session for the requesting device. Repeating it is safe (the requesting device always stays signed in).

---

## US-09: Admin Signs a User Out Everywhere

**As an** Admin,
**I want** to sign another User of the household out of every device,
**so that** I can protect that User's account when their phone is lost or shared without them being able to act.

**API:** `POST /admin/users/{id}/sessions/revoke-all` (Admin only)

### Preconditions
- The Admin is on the household members screen (admin-only, existing).

### Main Flow
1. Each active User row other than the Admin's own offers "Đăng xuất mọi thiết bị".
2. Tap → confirmation "Đăng xuất {email} khỏi mọi thiết bị? Người này sẽ phải đăng nhập lại bằng mật khẩu." with "Đăng xuất" / "Hủy".
3. On confirm, System sets that User's sign-out-everywhere point to now and ends every session of that User; toast "Đã đăng xuất {email} khỏi mọi thiết bị."
4. That User loses access everywhere as in US-08 step 5 (no device is spared).

### Acceptance Criteria
- **AC-40** — Only Admins can do this; anyone else is refused by the server.
- **AC-41** — The target User loses access on every device as described in AC-35 and AC-36.
- **AC-42** — The action is not offered on the Admin's own row (they use the Security screen) nor on pending or disabled Users.
- **AC-43** — A failure shows a Vietnamese message and changes nothing.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-ASW-67 | Admin X, active member M signed in on a phone | X signs M out everywhere | Toast; M's phone loses access per S-ASW-55 | Happy path |
| S-ASW-68 | Member calls the admin action directly | — | `403 FORBIDDEN` | AC-40, validation error (4xx) |
| S-ASW-69 | Target User does not exist or was deleted | X confirms | `404 NOT_FOUND`; toast "Không tìm thấy người dùng."; list refreshes | AC-43 |
| S-ASW-70 | X targets themself through the admin action directly | — | `400 INVALID_INPUT` | AC-42 |
| S-ASW-71 | X offline | X confirms | Toast "Cần kết nối mạng để đăng xuất mọi thiết bị."; nothing changes | AC-43 |
| S-ASW-72 | M is also saved on X's own phone | X signs M out everywhere, then switches to M | `401`; M marked "Hết phiên" | AC-41 |
| S-ASW-73 | Members screen lists a pending User and X's own row | Screen renders | No "Đăng xuất mọi thiết bị" on either | AC-42 |

### Edge Cases
- **EC-22** — An Admin may sign out another Admin (there is no rank between Admins).
- **EC-23** — A User whose status is no longer active is already refused at every request, renewal and switch; no extra action is needed.

### Definition of Done
- S-ASW-67–73 pass; server tests cover admin-only access, unknown target, self target.

### Idempotency
Repeating the action is safe; the newest moment wins.

---

## US-10: See and Sign Out Signed-in Devices

> Added 2026-10-19.

**As a** User,
**I want** to see which devices are signed in to my account and sign one of them out,
**so that** a lost, sold or borrowed phone loses access without signing out all my other devices.

**API:** `GET /auth/sessions`, `DELETE /auth/sessions/{id}` (both authenticated)

### Preconditions
- The User is signed in on this device and on the Security screen.

### Main Flow
1. The Security screen's first section, "Thiết bị đang đăng nhập", lists the User's live sessions, most recently used first. Each row: the device name, or "Thiết bị không rõ tên" when none was reported; below it "Thiết bị này" on the current device, otherwise "Hoạt động {dd/mm/yyyy}" (last used, local date).
2. Every row except "Thiết bị này" has the action "Đăng xuất".
3. Tap → confirmation: title "Đăng xuất {device}?", body "{device} cần đăng nhập lại để vào tài khoản này.", buttons [Đăng xuất thiết bị] [Giữ lại].
4. On confirm, System ends that session; App refreshes the list and shows the toast "Đã đăng xuất {device}".
5. On that device: its next request is refused and its renewal too. Where the User was active there, the session ends ("Phiên đăng nhập đã hết hạn."); where the User was saved, the entry shows "Hết phiên". Coming back needs the password, or a passkey stored on that phone (signing out a device does not delete its passkey; that is done under "Passkey").

### Acceptance Criteria
- **AC-44** — The list shows only the caller's own live sessions (not ended, not past either expiry), most recently used first; the current device is marked "Thiết bị này" and has no sign-out action.
- **AC-45** — A session with no reported device name shows "Thiết bị không rõ tên" (sessions started from the web app or the browser activation page, and sessions from before the update that have not renewed since).
- **AC-46** — After confirming, the signed-out device loses access at its next request, its renewal is refused, and its entry for this User shows "Hết phiên"; this User's other devices and other Users' sessions are not affected.
- **AC-47** — The current device cannot be signed out from the list; the server refuses it (it leaves through "Đăng xuất" in Settings).
- **AC-48** — Offline, a failure, or a list that cannot load changes nothing and shows a Vietnamese message: offline "Cần kết nối mạng để đăng xuất thiết bị.", failure "Chưa đăng xuất được thiết bị. Thử lại sau.", list "Chưa tải được danh sách thiết bị." with [Thử lại].
- **AC-49** — "Hoạt động" dates are stored in UTC and shown as the device's local date.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-ASW-74 | A signed in on phone 1 (this one) and phone 2 | A opens "Bảo mật" on phone 1 | Rows: phone 1 "Thiết bị này", no action; phone 2 "Hoạt động {date}" with "Đăng xuất" | Happy path, AC-44 |
| S-ASW-75 | Same | A taps "Đăng xuất" on phone 2 and confirms "Đăng xuất thiết bị" | `200`; toast "Đã đăng xuất {phone 2}"; phone 2 gone from the list | AC-46 |
| S-ASW-76 | Phone 2 had A active | Phone 2 makes its next request | `401`; "Phiên đăng nhập đã hết hạn."; login screen lists A as "Hết phiên" | AC-46 |
| S-ASW-77 | Phone 3 has A saved (inactive); A signed phone 3 out | Someone picks A on phone 3 | `401`; A marked "Hết phiên"; toast "Cần đăng nhập lại tài khoản này." | AC-46, BR-19 |
| S-ASW-78 | Phone 2 also has B saved | A signs phone 2 out | B on phone 2 still switches; B's list unchanged | AC-46, user isolation |
| S-ASW-79 | A signed in once from the web app | List renders | That session shows "Thiết bị không rõ tên" | AC-45 |
| S-ASW-80 | — | Client calls `DELETE /auth/sessions/{id}` with the caller's current session | `400 INVALID_INPUT` | AC-47, validation error (4xx) |
| S-ASW-81 | — | Client calls `DELETE /auth/sessions/{id}` with another User's session, or an unknown id | `404 NOT_FOUND` | ⚠️ user isolation, validation error (4xx) |
| S-ASW-82 | Phone 2's session already ended (logged out, or signed out from another device) | A confirms from a list loaded before that | `200`, no-op; list refreshes | Idempotent |
| S-ASW-83 | — | Client calls `DELETE /auth/sessions/{id}` with an id that is not a UUID | `400 INVALID_INPUT` | Validation error (4xx) |
| S-ASW-84 | Phone 1 offline | A confirms | Toast "Cần kết nối mạng để đăng xuất thiết bị."; nothing changes | AC-48, network error |
| S-ASW-85 | Server returns 5xx | A confirms | Toast "Chưa đăng xuất được thiết bị. Thử lại sau."; nothing changes | AC-48, system error (5xx) |
| S-ASW-86 | The list request fails | A opens "Bảo mật" | "Chưa tải được danh sách thiết bị." with [Thử lại]; the rest of the screen works | AC-48 |
| S-ASW-87 | No valid access | Client calls `GET /auth/sessions` | `401 UNAUTHENTICATED` | Validation error (4xx) |
| S-ASW-88 | — | A taps "Giữ lại" in the confirmation | Nothing changes | |

### Edge Cases
- **EC-24** — A session started before the update has no device recorded: it shows "Thiết bị không rõ tên" until that device renews once with the new build, which records its id and name; a recorded device is never overwritten.
- **EC-25** — Two rows can carry the same name (two phones of the same model, or the same phone after reinstalling the app, which creates a new device id while the old session lives on until it expires or is signed out). The "Hoạt động" date tells them apart.
- **EC-26** — "Hoạt động" moves on each renewal (about every 12 minutes while the account is in use), so it is when that device last used this account.
- **EC-27** — Each account saved on a phone is its own session: User A's list shows a shared phone once, even when B and C are saved there too (their sessions belong to their own lists).
- **EC-28** — The device name is what the phone reports; the server trims it, drops control characters and cuts it at 64 characters. It is not a security signal.

### Definition of Done
- S-ASW-74–88 pass with two devices (or one device plus direct server calls).
- Server tests cover: list (own sessions only, live only, order, `is_current`), delete (current → 400, another User's or unknown → 404, already ended → 200), the ended session refused at its next request and at renewal, one audit log line (ids, role, IP — never email or credential).

### Idempotency
Signing out a session that has already ended is a successful no-op (`200`).

---

## US-11: Change Password

> Added 2026-10-19.

**As a** User,
**I want** to change my password from the app,
**so that** whoever knows my old password, and every device signed in with it, is locked out.

**API:** `PUT /users/me/password` (authenticated; at most 5 failed tries per User per 15 minutes)

### Preconditions
- The User is signed in on this device.

### Main Flow
1. The Security screen row "Đổi mật khẩu", hint "Thiết bị khác sẽ phải đăng nhập lại.", opens the "Đổi mật khẩu" screen.
2. Fields: "Mật khẩu hiện tại", "Mật khẩu mới" (hint "Ít nhất {n} ký tự."), "Nhập lại mật khẩu mới"; button "Đổi mật khẩu". {n} = `common.MinPasswordLength` (8 today).
3. App checks locally that the new password has at least {n} characters and that both new fields match; otherwise it shows the field message and sends nothing.
4. App sends the current and the new password.
5. System checks the current password, the length, and that the new one differs from the current one. Then, in this order: saves the new password and sets the User's sign-out-everywhere point to now (one write), ends every session of the User, and starts a fresh session for this device, which it returns.
6. App swaps the fresh session into this account's slot silently (same User, data stays), closes the screen and shows the toast "Đã đổi mật khẩu. Thiết bị khác cần đăng nhập lại."
7. Every other device: the next request or renewal is refused; that account shows "Hết phiên" there and needs the new password (or a passkey).

### Acceptance Criteria
- **AC-50** — The change needs the correct current password; the new one must have at least {n} characters and differ from the current one.
- **AC-51** — After the change, every other session of the User (other devices, and this User's entries saved on other phones) is refused at its next request or renewal; this device stays signed in without asking again.
- **AC-52** — A wrong current password, a too-short new one, or one equal to the current one is answered `400` with its own code, never `401` (the phone reads `401` as "session over"); the screen shows the matching message and nothing changes.
- **AC-53** — After 5 failed tries within 15 minutes, further tries are refused for the rest of that window with "Thử quá nhiều lần. Thử lại sau 15 phút."; the password is unchanged.
- **AC-54** — Offline: "Không có kết nối mạng. Thử lại sau."; any other failure: "Chưa đổi được mật khẩu. Thử lại sau."
- **AC-55** — The password values never appear in any log or debug console entry.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-ASW-89 | A signed in on phones 1 and 2; correct current password; valid new password | A changes the password on phone 1 | `200` with a fresh access and renewal credential; phone 1 stays signed in; toast "Đã đổi mật khẩu. Thiết bị khác cần đăng nhập lại." | Happy path |
| S-ASW-90 | After S-ASW-89 | Phone 2 makes its next request | `401`; "Phiên đăng nhập đã hết hạn."; A "Hết phiên"; the old password is refused at login, the new one accepted | AC-51 |
| S-ASW-91 | Phone 3 has A saved (inactive) | Someone picks A on phone 3 | `401`; A marked "Hết phiên"; toast "Cần đăng nhập lại tài khoản này." | AC-51 |
| S-ASW-92 | Wrong current password | User taps "Đổi mật khẩu" | `400 WRONG_CURRENT_PASSWORD`; "Mật khẩu hiện tại không đúng."; nothing changes | AC-52, validation error (4xx) |
| S-ASW-93 | New password shorter than {n} | User taps "Đổi mật khẩu" | "Mật khẩu mới cần ít nhất {n} ký tự."; no request (a direct call gets `400 WEAK_PASSWORD`) | AC-50, AC-52 |
| S-ASW-94 | New password equals the current one | User taps "Đổi mật khẩu" | `400 SAME_PASSWORD`; "Mật khẩu mới trùng mật khẩu hiện tại." | AC-50, AC-52 |
| S-ASW-95 | The two new fields differ | User taps "Đổi mật khẩu" | "Hai mật khẩu mới chưa khớp."; no request | Client check |
| S-ASW-96 | 5 failed tries in the last 15 minutes | User tries again | `429 RATE_LIMITED`; "Thử quá nhiều lần. Thử lại sau 15 phút." | AC-53 |
| S-ASW-97 | Phone offline | User taps "Đổi mật khẩu" | "Không có kết nối mạng. Thử lại sau." | AC-54, network error |
| S-ASW-98 | Server returns 5xx | User taps "Đổi mật khẩu" | "Chưa đổi được mật khẩu. Thử lại sau." | AC-54, system error (5xx) |
| S-ASW-99 | — | Client calls `PUT /users/me/password` with a field missing | `400 INVALID_INPUT` | Validation error (4xx) |
| S-ASW-100 | No valid access | Client calls `PUT /users/me/password` | `401 UNAUTHENTICATED` → existing session-ended handling | Validation error (4xx) |
| S-ASW-101 | B is also saved on phone 1 | A changes the password | B still switches on phone 1; B's sessions everywhere untouched | ⚠️ user isolation |
| S-ASW-102 | — | User double-taps "Đổi mật khẩu" | Exactly one request | |

### Edge Cases
- **EC-29** — The limit counts failed tries per User, across all devices, so a thief holding an unlocked phone cannot guess the current password more than 5 times per 15 minutes.
- **EC-30** — An answer lost after the server accepted the change: the new password is in force and this device's session has ended too (the sign-out-everywhere point refuses it), so the next request ends the session and the User signs in with the new password. Rare; accepted.
- **EC-31** — Passkeys are not affected: a passkey still signs in on the phone that holds it. To lock a passkey out, delete it under "Passkey".
- **EC-32** — A password change does not touch any other User's saved account on any device.

### Definition of Done
- S-ASW-89–102 pass with two devices.
- Server tests cover: wrong current → 400 `WRONG_CURRENT_PASSWORD`; short → 400 `WEAK_PASSWORD`; same → 400 `SAME_PASSWORD`; success → new hash and point in one write, every session ended (reason `password_changed`), fresh session for the caller accepted right after, old sessions and credentials refused; the per-User failed-try limit; one audit log line `password.change` (ids, IP — never the password, email or credential).

### Idempotency
Not idempotent: once the change succeeds, repeating it with the old current password fails with `WRONG_CURRENT_PASSWORD`. The App sends one request per tap and disables the button while it runs.

---

## US-12: App Lock

> Added 2026-10-19. Opt-in.

**As a** User,
**I want** the app to ask for my fingerprint, face or screen-lock code when it opens,
**so that** someone picking up my unlocked phone cannot read my finances.

**API:** none — the check happens on the phone.

### Preconditions
- The User is signed in (the login screen is never locked).

### Main Flow
1. The Security screen has the toggle "Khóa ứng dụng" (off by default), hint "Hỏi vân tay, khuôn mặt hoặc mã khóa màn hình khi mở ứng dụng."
2. Turning it on or off first asks for the phone's check; passed → changed, cancelled or failed → unchanged. On a phone with no screen lock it cannot be turned on: "Máy chưa cài khóa màn hình nên chưa bật được khóa ứng dụng."
3. When it is on, on a cold start and when the app returns after 5 minutes or more in the background, App covers the signed-in area with "Ứng dụng đang khóa" and [Mở khóa] before any of it is visible, and asks the phone ("Mở khóa ứng dụng").
4. Passed → the screen the User was on appears. Cancelled or failed → the lock stays; [Mở khóa] asks again.

### Acceptance Criteria
- **AC-56** — App lock is off by default; the setting belongs to the device (shared by all saved accounts) and is kept across switch, logout and app restart.
- **AC-57** — With app lock on, nothing of the signed-in area is visible on a cold start, or after 5 minutes or more in the background, until the check passes.
- **AC-58** — Returning within 5 minutes does not ask.
- **AC-59** — Turning app lock on or off needs the check; with no screen lock set up it cannot be turned on, and the message says why.
- **AC-60** — App lock does not replace the identity check before switching (US-07), which keeps its own setting; the login screen is never locked.
- **AC-61** — App lock gates the screen only: background renewal and saved data keep working behind it (BR-22).

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-ASW-103 | App lock off (default) | User opens the app | No check; Home appears | AC-56 |
| S-ASW-104 | Phone has a fingerprint | User turns "Khóa ứng dụng" on and passes the check | Toggle on | Happy path, AC-59 |
| S-ASW-105 | App lock on; app closed | User opens the app | "Ứng dụng đang khóa"; phone asks "Mở khóa ứng dụng"; passed → Home | AC-57 |
| S-ASW-106 | App lock on | App spends 6 minutes in the background, then returns | Locked; check asked; passed → the same screen as before | AC-57 |
| S-ASW-107 | App lock on | App spends 2 minutes in the background, then returns | No check | AC-58 |
| S-ASW-108 | App lock on, locked | User cancels the phone's prompt | Stays on "Ứng dụng đang khóa"; [Mở khóa] asks again | AC-57 |
| S-ASW-109 | Phone has no screen lock | User turns the toggle on | Stays off; "Máy chưa cài khóa màn hình nên chưa bật được khóa ứng dụng." | AC-59 |
| S-ASW-110 | App lock on | User turns it off and cancels the check | Stays on | AC-59 |
| S-ASW-111 | App lock on; nobody signed in | User opens the app | Login screen, no lock | AC-60 |
| S-ASW-112 | App lock on; A active | User switches to B | App lock stays on for B; the switch asks only the US-07 check | AC-56, AC-60 |

### Edge Cases
- **EC-33** — The 5 minutes count from the moment the app left the foreground. The phone restarting, or the system closing the app, makes the next open a cold start (asks).
- **EC-34** — The app goes to the background while the prompt is showing: treated as cancelled; the lock stays.
- **EC-35** — The phone's screen lock is removed while app lock is on — see Open Question 7.

### Definition of Done
- S-ASW-103–112 pass on an Android device with a fingerprint and on one with no screen lock.
- The setting survives an app restart, a switch and a logout.

### Idempotency
No server write; turning app lock on or off repeatedly is harmless.

---

## Out of Scope

- **Web (`frontend/`)** — frozen; no account switching, no device list, no change-password screen there. Web sends no device id, so its sessions show as "Thiết bị không rõ tên".
- **"Remember me" checkbox or opt-out** — explicitly rejected; every login is remembered.
- **App PIN** — a future app PIN will replace the "no screen lock" warning (US-07); not in this feature.
- **Locking the stored credentials themselves behind the fingerprint/face check** — not possible with the secure storage in use (see "Not adopted"); the check guards the switch (US-07) and, optionally, the screen (US-12).
- **Device key pair (phase 2)** — a key made in the phone's key store at sign-in, its public half registered on the session (`sessions.public_key` is reserved), every renewal signing a server challenge, so a copied renewal credential is useless off the phone.
- **Identity check on background renewal or password login.** Opening the app asks only when app lock is on (US-12).
- **Password reset by email ("forgot password")** — not built yet (production-readiness P0). Lost-device remedies today: US-10, US-08, US-11.
- **An Admin resetting another User's password** — no such feature; the Admin uses US-09.
- **Changing the 15-minute access lifetime** — unchanged. (Changed 2026-10-19: the session lifetimes did change, to 60 days unused / 180 days signed in.)
- **Syncing the account list across devices** — the list is per device only.
- **Offline switching** — a switch always needs the server.
- **Disabling a User from the app** — there is no such action today; a disabled User is already refused (BR-06).
- **Hiding the app's preview in the system app switcher** — app lock (US-12) covers the screen when the app is opened, not the system's thumbnail.
- **Translating the existing English login screen copy** — only new copy added by this feature is in scope (tracked by the Vietnamese sweep).

## Open Questions

1. **Disabling a User** — the decision text assumed an existing admin "disable user" action; none exists in the app or server today (a User becomes disabled only by a direct database change). Sign out everywhere (US-09) covers the urgent case. Confirm that a disable action stays out of scope.
2. **Admin signing out another Admin** (EC-22) — allowed, as there is no rank between Admins. Confirm.
3. **Turning the identity check off requires passing it** (AC-32) — added so a person holding an unlocked phone cannot simply switch the check off first; costs one prompt. Confirm.
4. **Forgot password** (2026-10-19) — a User who forgets the password and has no passkey cannot get back in: there is no reset by email and no admin reset. Needs its own spec (production-readiness P0).
5. **Phase-2 device key pair** (2026-10-19) — when to do it; `sessions.public_key` is reserved and unused. Until then a renewal credential copied off a phone works elsewhere until its next rotation is detected as reuse.
6. **Removing the deprecated switch-credential endpoints** (2026-10-19) — `POST /auth/switch-token`, `/auth/switch`, `/auth/switch-token/revoke` stay until no phone runs a build older than this revision (an OTA update reaches a phone on its second launch). Who confirms, and when.
7. **App lock with the phone's screen lock removed** (2026-10-19, EC-35) — open without a check (like US-07 EC-18), or keep the app locked until a screen lock is set again. Proposed: open without a check and turn app lock off, so the User is never locked out of their own data. Confirm.
8. **No limit on switching** (2026-10-19) — switching now goes through `POST /auth/refresh`, which has no rate limit (production-readiness P1); the per-network limit on `POST /auth/switch` protects only older builds. Since a renewal needs a valid credential, this is low risk. Confirm whether a limit on `/auth/refresh` is still wanted.
