# Feature Spec: Account Switching on Mobile (F-02 extension)

> Source: product-owner request 2026-10-04 — "Switch account like Facebook. No 'remember me' — once an account has logged in on this device, the user can switch to it without logging out and without typing credentials. Saved accounts do expire. Up to 10 s per switch is acceptable." Decisions confirmed 2026-10-04 in the approved research note (180-day expiry since last use, 5 accounts per device, entry point above the logout button). Extended by the product owner's final decisions of 2026-10-04 (open questions closed; interrupted switches; "sign out everywhere"; identity check before switching; Security screen). Owner guidance: prefer the cheapest option with the biggest impact.
> Status: new — **backend + `mobile/`**. `frontend/` (web) is frozen and out of scope.
> Related: [research-account-switch](../mobile-ux-batch-2026-10/research-account-switch.md) (feasibility + decisions), [mobile-session-refresh](../mobile-session-refresh/spec.md) (the session this feature swaps), [security](../security/spec.md) (login/logout this extends).

## Context

Today a phone holds exactly one signed-in User. Moving to another User means logging out and typing the other email and password. A household where two or more people share a phone (or one person with an admin and a member account) pays that cost on every switch.

This feature lets the device **remember every User who has logged in on it** and switch between them with one tap, no password, no logout — the pattern Facebook and Google apps use. There is no "remember me" choice: being remembered is automatic.

**Resolved decisions (product owner, final):**

1. **Automatic** — every successful login on the device adds that User to the device's account list. No checkbox, no opt-in.
2. **Expiry: 180 days after last use, sliding.** An account not used on this device for 180 days needs a normal login again. Being used (active, or switched to) resets the clock.
3. **The normal session lifetime does not change.** The existing 7-day session renewal limit stays as it is; account switching uses its own, separate, narrow-purpose credential that can do nothing except start a session for its own User, and that the server can revoke.
4. **Cap: 5 accounts per device.**
5. **Entry point:** a "Chuyển tài khoản" row on Settings, directly above the "Đăng xuất" button, showing an overlapping avatar group — at most 3 avatars; from the 4th account on, a dark "+N" circle.
6. **One switch completes in at most 10 seconds** (normally 1–3 s).
7. **No data of one User is ever shown to, or saved as, another User** on the same device.
8. **Tap behaviour by number of other accounts:** exactly **one other** saved account → tapping the row switches to it directly, no dialog. **No other** account → the dialog opens with the active account (labelled "Đang dùng", not tappable) and the "+ Thêm tài khoản" action only.
9. **Admin accounts** are remembered and can be switched into without a password, like any other User (protected by the identity check, decision 12).
10. **"Last use" is accurate to about one day** — accepted. The per-network limit on switch attempts uses the technical default — accepted.
11. **Interrupted switch:** when a switch gets no answer in time, its saved sign-in may already have been used up on the server. This is accepted: the account then needs one password login, and the message says why. A switch with no answer never marks the account expired by itself; only a later refusal does.
12. **Identity check before switching:** before a switch into a saved account, the phone asks for its owner's fingerprint, face or screen-lock code. On by default; can be turned off per device on a new Security screen. A phone with no screen lock set up still switches, with a one-time warning. Not asked for background renewal.
13. **Sign out everywhere:** a User can sign their account out of every other device from the Security screen (the current device stays signed in); an Admin can do the same for another User from the household members screen. Access already granted on another device ends within the short access lifetime — accepted.
14. **Security screen:** the existing "Bảo mật" row on Settings opens it; it holds the identity-check switch and the "Đăng xuất mọi thiết bị" action.

Notes:
- Invite activation happens in the browser (the backend's own activation page), not in the mobile app — so on mobile "login" is the only way an account enters the list. A freshly activated User is remembered on their first mobile login.
- No money is read or written by this feature; money rules do not apply.

Actors:
- **User** — any active User (`admin` or `member`) on the mobile app.
- **Admin** — an active User with the admin role, acting on another User from the household members screen (US-09).
- **System** — the backend issuing, rotating and revoking switch credentials.

### Key Entities

| Entity | Lives on | Meaning |
|---|---|---|
| Saved Account | Device | One User remembered on this device: identity (id, email, display name, role), its switch credential, when it was last used, when its credential expires. At most 5 per device. Never contains a password. |
| Switch Credential | Device (secure storage) + server (revocation list) | A long-lived, single-purpose credential for one User. Its only power is "start a new session for this User". Single-use: every use returns a replacement. Expires 180 days after it was issued. |
| Active Session | Device | The existing signed-in session (unchanged by this feature, other than which User it belongs to). |
| Sign-out-everywhere Point | Server (per User) | The moment the User (or an Admin) last chose "sign out everywhere". Empty until first used. Session-renewal and switch credentials issued before it are refused. Stored in UTC. |
| Device Security Preference | Device | Whether the identity check before switching is on (default on), and whether the "no screen lock" warning has already been shown. Shared by all accounts on the device. |

### Business Rules

| ID | Rule |
|---|---|
| BR-01 | A Saved Account is created or refreshed on every successful login on the device — never through a separate opt-in. |
| BR-02 | A device holds at most 5 Saved Accounts. Adding a 6th removes the least recently used one that is not the active one. |
| BR-03 | A Saved Account expires 180 days after it was last used on this device. "Used" = it was the active account (at least once a day while it stays active) or it was switched to. |
| BR-04 | A switch credential is accepted only to start a session, never as a normal access credential, never to renew a session. |
| BR-05 | A switch credential is single-use: a successful switch invalidates the presented credential and returns a replacement. |
| BR-06 | A switch is refused when the credential is expired, already used, revoked, issued before its User's sign-out-everywhere point (BR-11), or its User is no longer active. |
| BR-07 | Switching never needs the target User's password and never logs the current User out on the server. |
| BR-08 | Per-User local data (chat conversation, saved budget plan, saved and recent phrases) is kept apart per User. Device-wide preferences (theme, appearance) are shared. |
| BR-09 | Logging out or removing a Saved Account revokes its switch credential on the server (best effort when offline). |
| BR-10 | Switch credentials and session tokens are never written to any log. |
| BR-11 | After "sign out everywhere", every session-renewal credential and switch credential of that User issued before that moment is refused, on every device. A new switch credential cannot be obtained with access granted before that moment either. Access already granted ends within its short lifetime. |
| BR-12 | The device that asks to sign its own User out everywhere receives a fresh session and a fresh switch credential in the same answer and stays signed in. |
| BR-13 | Only an Admin can sign another User out everywhere; an Admin signs themself out through the Security screen like any User. |
| BR-14 | When the identity check is on, every switch into a saved account (switch dialog, direct switch, "Tiếp tục với…") needs the check passed first. Cancelled or failed → no switch, nothing changes. |
| BR-15 | A phone with no fingerprint, face or screen lock set up switches without the check; the first time, a warning is shown (once per device). |
| BR-16 | A switch with no answer within the time limit leaves the saved account as it was (not expired). If a later switch to it is refused, the message explains that the earlier switch was interrupted and a password login is needed. |

---

## US-01: Remember Every Account That Logs In

**As a** User,
**I want** the app to remember my account as soon as I log in on this phone,
**so that** I (or someone sharing the phone) can come back to it later without typing my password.

**API:** `POST /auth/switch-token` (authenticated — issues a switch credential for the caller)

### Preconditions
- The User has just logged in successfully on the mobile app (or is already signed in and their credential needs renewing — see US-06).

### Main Flow
1. User logs in with email and password.
2. System starts the session (unchanged from today).
3. App asks System for a switch credential for this User.
4. System issues a switch credential valid for 180 days and returns it with its expiry time (UTC) and the User's display identity (email, full name, role).
5. App stores the credential in the device's secure storage and adds (or updates) the User in the device's account list, marking it last used now.
6. If the list now holds more than 5 accounts, App removes the least recently used inactive one and asks System to revoke its credential (best effort).

### Acceptance Criteria
- **AC-01** — After a successful login, the User appears in the account list without any extra step or prompt.
- **AC-02** — Logging in again as a User already in the list updates that entry (no duplicate)
  and the previous credential of that User is revoked.
- **AC-03** — A 6th account added to a device with 5 removes the least recently used inactive account
  and that account's credential is revoked.
- **AC-04** — If obtaining the switch credential fails, the login itself still succeeds; the User is simply not switchable yet and the App retries on the next app start.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-ASW-01 | Empty account list | User A logs in | Session starts; account list = [A] | AC-01 |
| S-ASW-02 | List = [A]; A's session ended (expired) | User A logs in again | List still holds one entry for A; A's old credential no longer works | AC-02 |
| S-ASW-03 | List holds 5 accounts, A is least recently used | A 6th User F logs in from the login screen | F added; A removed; A's credential revoked | AC-03, BR-02 |
| S-ASW-04 | Login succeeds but the credential request fails (offline, 5xx) | — | User is signed in normally; on next app start the App requests the credential again | AC-04 |
| S-ASW-05 | Request for a credential without a valid session | Client calls `POST /auth/switch-token` unauthenticated | `401 UNAUTHENTICATED` | Validation error (4xx) |

### Edge Cases
- **EC-01** — The credential request races a logout (User logs out before it returns): the returned credential is revoked immediately and not stored.
- **EC-02** — The device's secure storage write fails: the account is not listed (a listed account without a usable credential would be a dead row).
- **EC-03** — A 6th account appears only through the login screen while logged out (the "+ Thêm tài khoản" action is hidden at 5 — US-03); eviction never removes the account being logged into or the active one.

### Definition of Done
- Every successful login on mobile results in exactly one list entry for that User with a working switch credential.
- The 5-account cap holds in every path; evicted credentials are revoked.
- Unit tests cover issuing (authenticated only) and the re-login revoke.

### Idempotency
Issuing is **not** idempotent — each call returns a new credential. The App makes it safe by revoking the User's previous credential whenever it stores a new one (AC-02).

---

## US-02: Switch to Another Saved Account

**As a** User,
**I want** to switch to another account saved on this phone with one or two taps,
**so that** I can use it without logging out and without typing a password.

**API:** `POST /auth/switch` (unauthenticated — the switch credential is the credential; rate-limited)

### Preconditions
- The User is signed in and on Settings.
- At least one other Saved Account exists (otherwise the add-only dialog opens — see AC-07).

### Main Flow
1. Settings shows a "Chuyển tài khoản" row directly above "Đăng xuất". On its right, an overlapping group of up to 3 account avatars (initial letter, active account first); with 4 or more accounts, a dark "+N" circle follows, where N = number of accounts − 3.
2. User taps the row.
3. App opens the account dialog (step 4) — always, whatever the number of other accounts; with none it holds only the active account and "+ Thêm tài khoản" (AC-07). (Changed 2026-10-06: a single other account used to be switched to directly, which never showed the User which account they were going to.)
4. The dialog lists every Saved Account: avatar, display name, email, status ("Đang dùng" for the active one — not tappable; "Đã hết hạn — đăng nhập lại" for expired ones). Each inactive row offers "Gỡ khỏi thiết bị" (US-04). The bottom offers "+ Thêm tài khoản" (US-03).
5. User taps a valid account.
5a. If the identity check is on, the phone asks for it (US-07). Cancelled or failed → stop here; nothing changes.
6. App blocks the screen with a busy overlay, gives the current User's unsaved chat conversation up to 3 s to reach the server, then sends the target's switch credential to System.
7. System verifies the credential (genuine, purpose, not expired, not used/revoked) and that its User is still active; it starts a session for that User, invalidates the presented credential, and returns the new session together with a replacement switch credential and the User's display identity.
8. App stores the replacement credential, drops all on-screen data of the previous User, swaps in the new session, switches per-User local data to the new User, and lands on Home. The overlay closes.
9. The previous User stays in the list with their own credential, so switching back also needs no password.

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
  A switch that got no answer in time does not mark the target account expired (BR-16).
- **AC-12** — While a switch is in progress, the screen accepts no other input.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-ASW-06 | List = [A (active), B, C] | User taps "Chuyển tài khoản" | Dialog lists A ("Đang dùng"), B, C, plus "+ Thêm tài khoản" | AC-06 |
| S-ASW-07 | List = [A (active), B] | User taps the row | Dialog lists A ("Đang dùng") and B, plus "+ Thêm tài khoản"; nothing switches until B is picked | AC-06 |
| S-ASW-08 | List = [A (active)] | User taps the row | Dialog shows A ("Đang dùng", not tappable) and "+ Thêm tài khoản" only | AC-07 |
| S-ASW-09 | List = A, B, C, D, E | Settings renders | Row shows 3 avatars and a "+2" circle | AC-05 |
| S-ASW-10 | List = [A, B], 1–3 avatars | Settings renders | No "+N" circle | AC-05 |
| S-ASW-11 | A active, B valid | User picks B | `200`; B's Home loads within 10 s; B's credential replaced | Happy path, AC-08 |
| S-ASW-12 | Switched A → B | User switches back to A | Succeeds with no password | AC-10 |
| S-ASW-13 | A has an unsynced chat conversation | User switches to B | A's conversation reaches A's account (if possible within 3 s); B never sees it and it is never saved under B | AC-09, ⚠️ data isolation |
| S-ASW-14 | A has a saved budget plan | User switches A → B → A | A's plan is still there; B never saw it | AC-09, ⚠️ data loss if wrong |
| S-ASW-15 | B's credential was already used / revoked elsewhere, or B was signed out everywhere (US-08/US-09) | User picks B | `401`; B marked "Đã hết hạn — đăng nhập lại"; toast "Tài khoản này đã hết hạn. Vui lòng đăng nhập lại."; A stays active. If the previous switch to B got no answer (S-ASW-18), the toast instead reads "Lần chuyển tài khoản trước bị gián đoạn nên cần đăng nhập lại tài khoản này bằng mật khẩu." | AC-11, BR-16, validation error (4xx) |
| S-ASW-16 | B's User was deactivated by an admin | User picks B | Same as S-ASW-15 | BR-06 |
| S-ASW-17 | B's credential expired (> 180 days) | Dialog opens | B shown as expired; tapping it opens the login form with B's email prefilled | BR-03 |
| S-ASW-18 | Device offline / server unreachable, or the answer is lost after the server accepted the switch | User picks B | Within 10 s: toast "Cần kết nối mạng để chuyển tài khoản."; A stays active; B **not** marked expired, but remembered as "last switch interrupted" for the message in S-ASW-15 | AC-11, BR-16, system/network error |
| S-ASW-19 | Server returns 5xx | User picks B | Toast "Không thể chuyển tài khoản. Vui lòng thử lại."; A stays active; B unchanged | System error (5xx) |
| S-ASW-20 | Too many switch attempts from one network | Client calls `POST /auth/switch` repeatedly | `429 RATE_LIMITED`; toast with the server's message; A stays active | Validation/limit (4xx) |
| S-ASW-21 | Credential field missing or not a credential at all | Client calls `POST /auth/switch` | `400 INVALID_INPUT` | Validation error (4xx) |
| S-ASW-22 | A switch credential is presented as a normal access credential or to session renewal | Any protected request / renewal | `401 UNAUTHENTICATED` | BR-04 |
| S-ASW-23 | User double-taps account B | — | Exactly one switch runs | AC-12 |

### Edge Cases
- **EC-04** — Requests of the previous User still in flight when the switch lands must not put the previous User's data on screen for the new User — they are cancelled and their results discarded.
- **EC-05** — A background session renewal of the previous User that finishes after the switch must not bring the previous User back — it is discarded.
- **EC-06** — The App is killed mid-switch: on next start, whichever session was last fully stored is restored; if the replacement credential was not stored, the target shows as expired and needs one login (never a mixed state).
- **EC-07** — The busy overlay cannot be dismissed with the back button while switching (same as logout today).
- **EC-08** — The tapped account disappears from the list during the switch (e.g. evicted): the switch is abandoned with the generic error; the current User stays.

### Definition of Done
- Switch works A → B → A with no password on a real device, within 10 s, every outcome.
- Data-isolation checks S-ASW-13/14 pass on device.
- Server-side unit tests cover accept, already-used, revoked, expired, wrong-purpose, inactive User, issued before the sign-out-everywhere point, malformed.

### Idempotency
Not idempotent by design (BR-05): the same credential succeeds once; a replay fails with `401`. The App de-duplicates taps (S-ASW-23), so a legitimate double tap never burns the credential twice.

---

## US-03: Add Another Account

**As a** signed-in User,
**I want** to add another account from the switch dialog,
**so that** a second person can start using this phone without logging me out first.

**API:** existing `POST /auth/login`, then `POST /auth/switch-token` (US-01)

### Main Flow
1. User taps "+ Thêm tài khoản" in the dialog.
2. App opens an "Thêm tài khoản" screen with an empty email/password form. The current session keeps running untouched.
3. User enters the other User's credentials and submits.
4. On success, App stores the new User as a Saved Account (US-01) and makes it the active session (US-02 step 8).
5. On failure, the form shows the error; the current User is unaffected.
6. Back/close returns to Settings with the current User still active.

### Acceptance Criteria
- **AC-13** — The current session is unchanged until the new login succeeds.
- **AC-14** — "+ Thêm tài khoản" is hidden when 5 accounts are saved, replaced by the hint "Đã đạt tối đa 5 tài khoản trên thiết bị này".
- **AC-15** — Logging in to an account that is already saved behaves as a switch to it (no duplicate entry).
- **AC-16** — Logging in to the account that is already active closes the screen with the toast "Bạn đang dùng tài khoản này." and changes nothing.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-ASW-24 | A active, 1 account saved | User adds B with correct credentials | B active, list = [A, B] | Happy path |
| S-ASW-25 | A active | User enters a wrong password for B | Error shown in the form; A still active | `401 INVALID_CREDENTIALS`, validation error |
| S-ASW-26 | 5 accounts saved | User opens the dialog | No "+ Thêm tài khoản"; hint shown | AC-14 |
| S-ASW-27 | A active, B saved but expired | User logs in as B through the add screen | B active; one entry for B with a fresh credential | AC-15 |
| S-ASW-28 | A active | User logs in as A again | Toast "Bạn đang dùng tài khoản này."; nothing changes | AC-16 |
| S-ASW-29 | A active | User opens the add screen, then leaves without submitting | A still active, list unchanged | AC-13 |

### Edge Cases
- **EC-09** — Too many login attempts: the existing login limit applies; the error appears in the form.
- **EC-10** — The form starts empty, or prefilled with the email of the expired account being renewed (S-ASW-17); never with any other value.

### Definition of Done
- A second User can be added and becomes active without the first being logged out; S-ASW-24–29 pass on device.

### Idempotency
Login is not a write to financial data; a repeated submission after success is impossible (the screen closes).

---

## US-04: Remove an Account from the Device

**As a** User,
**I want** to remove a saved account from this phone,
**so that** nobody can enter it from here any more.

**API:** `POST /auth/switch-token/revoke` (unauthenticated, idempotent)

### Main Flow
1. In the dialog, User taps "Gỡ khỏi thiết bị" on an inactive account.
2. App asks for confirmation: "Gỡ {email} khỏi thiết bị này? Lần sau cần đăng nhập lại bằng mật khẩu." with "Gỡ" / "Hủy".
3. On confirm, App asks System to revoke that account's credential (best effort), deletes the account from the list and deletes that User's local per-User data (budget plan, phrases) from the device.

### Acceptance Criteria
- **AC-17** — Only inactive accounts can be removed; the active one has no remove action (it leaves via "Đăng xuất").
- **AC-18** — A removed account is gone from the list immediately, even when offline.
- **AC-19** — A removed account's credential no longer works on the server once the revoke request has reached it.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-ASW-30 | List = [A (active), B] | User removes B and confirms | List = [A]; B's credential revoked | Happy path |
| S-ASW-31 | Offline | User removes B | B removed locally; revoke is not retried | AC-18; the credential then expires on its own |
| S-ASW-32 | User cancels the confirmation | — | Nothing changes | |
| S-ASW-33 | Revoke called twice for the same credential | — | Both `200` | Idempotent |
| S-ASW-34 | Revoke called with a malformed value | — | `400 INVALID_INPUT` | Validation error |

### Edge Cases
- **EC-11** ⚠️ — Removing an account deletes that User's local-only data (unsynced saved budget plan) from this device. The confirmation copy states that the account will need a password next time; the plan loss is accepted (it never left the device and belongs to someone leaving it).
- **EC-12** — Revoking an already expired credential succeeds silently.

### Definition of Done
- Removal works online and offline; server-side revoke is idempotent and covered by unit tests.

### Idempotency
Revoke is idempotent (a second revoke of the same credential is a successful no-op).

---

## US-05: Log Out with Saved Accounts

**As a** User,
**I want** "Đăng xuất" to really sign me out of this phone and then let the next person pick their account,
**so that** logging out is safe and the phone stays quick to share.

**API:** existing `POST /auth/logout` + `POST /auth/switch-token/revoke`

### Main Flow
1. User taps "Đăng xuất" (behaviour today: overlay, last chat sync, local wipe).
2. App now also asks System to end the current session and revoke the current User's switch credential (best effort, inside the existing logout time cap), and removes the current User from the account list.
3. App shows the login screen. If valid Saved Accounts remain, it shows "Tiếp tục với…" rows (avatar, name, email) above the login form; tapping one switches into it (identity check per US-07, then US-02 steps 6–8, no password).
4. Expired accounts in that list show "Đã hết hạn — đăng nhập lại" and prefill the form with their email when tapped.

### Acceptance Criteria
- **AC-20** — After logout, the logged-out User is no longer in the list and their session and switch credential no longer work on the server (when online).
- **AC-21** — After logout with other saved accounts, the login screen offers "Tiếp tục với…" for each of them.
- **AC-22** — When a session ends on its own (renewal refused), the User stays in the list and can re-enter through "Tiếp tục với…" if their credential is still valid.
- **AC-23** — Logout still completes when offline (local sign-out happens; server calls are dropped).

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-ASW-35 | List = [A (active), B] | A logs out | Login screen shows "Tiếp tục với…" B; A gone; A's session and credential refused by server | AC-20, AC-21 |
| S-ASW-36 | List = [A (active)] | A logs out | Plain login screen | |
| S-ASW-37 | A's session renewal is refused (session expired) | — | Login screen shows "Tiếp tục với…" A (and others); tapping A re-enters without a password | AC-22 |
| S-ASW-38 | Offline | A logs out | Local logout completes within the existing cap; A removed from the list | AC-23 |
| S-ASW-39 | Logged out, "Tiếp tục với…" B tapped, B expired on server | — | B marked expired; form prefilled with B's email | |

### Edge Cases
- **EC-13** — A second tap on any "Tiếp tục với…" row while a switch from the login screen is already running is ignored (same tap guard as AC-12).
- **EC-14** — The chooser lists only accounts from this device's list; nothing about other Users is fetched from the server.

### Definition of Done
- Logout ends the session server-side for the first time on mobile; chooser appears and works.

### Idempotency
Logout and revoke are idempotent on the server (existing behaviour for logout).

---

## US-06: Saved Accounts Expire After 180 Days Unused

**As a** User,
**I want** an account that nobody has used on this phone for 180 days to need a password again,
**so that** an old, forgotten account on a shared phone cannot be entered forever.

**API:** `POST /auth/switch-token` (renewal for the active User), `POST /auth/switch` (rotation on switch)

### Main Flow
1. Each switch to an account replaces its credential with a new 180-day one (US-02 step 7).
2. While an account stays active, the App renews its credential at most once a day (on app start or when returning to the foreground), revoking the previous one.
3. Accounts whose credential's expiry has passed are shown as "Đã hết hạn — đăng nhập lại" everywhere; tapping them prefills the login form.

### Acceptance Criteria
- **AC-24** — An account used within the last 180 days (active or switched to) is never shown as expired.
- **AC-25** — An account not used for more than 180 days is refused by the server and shown as expired.
- **AC-26** — Expiry dates are kept in UTC and any date shown to the User is in the device's local time.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-ASW-40 | A has been the active account continuously for 200 days | User switches to B, then back to A | Switch back succeeds (A's credential was renewed while in use) | AC-24 |
| S-ASW-41 | B not used for 181 days | User opens the dialog | B shown expired; tap prefills the form | AC-25 |
| S-ASW-42 | Device clock is wrong (ahead) and shows B as expired while the server still accepts it | — | Expired display follows the device; a fresh login fixes it | Accepted limitation |
| S-ASW-43 | Device clock is behind; B is expired on the server but looks valid locally | User picks B | `401`; B marked expired | Server is the authority |

### Edge Cases
- **EC-15** — Daily renewal failing (offline) is silent and retried later; only a full 180 days without any successful renewal or switch expires the account.
  A renewal refused because the User was signed out everywhere (S-ASW-66) is not retried; the account stays listed until its session ends.

### Definition of Done
- Server issues credentials with a 180-day lifetime; App renews the active one daily; S-ASW-40/41 verified (40 by shortening the lifetime in a test build).

### Idempotency
Renewal is not idempotent (new credential each time); the App revokes the old one after storing the new one.

---

## US-07: Confirm It Is Me Before Switching (Security Screen)

**As a** User,
**I want** the phone to check my fingerprint, face or screen-lock code before it switches into a saved account,
**so that** someone holding my unlocked phone cannot walk into another saved account.

**API:** none — the check happens on the phone.

### Preconditions
- A switch into a saved, not-expired account was requested from the switch dialog, the direct switch (one other account), or "Tiếp tục với…" on the login screen.

### Main Flow
1. Settings → "Bảo mật" opens the "Bảo mật" screen. Its first section, "Xác minh khi chuyển tài khoản", has an on/off switch (on by default) with the hint "Yêu cầu vân tay, khuôn mặt hoặc mã khóa màn hình trước khi chuyển sang tài khoản đã lưu."
2. When a switch is requested and the check is on, App asks the phone to confirm its owner ("Xác minh để chuyển tài khoản", cancel label "Hủy") before anything else happens (no overlay yet). The phone offers fingerprint or face, and always its screen-lock code as an alternative.
3. Passed → the switch continues (US-02 step 6).
4. Cancelled → nothing happens; the dialog or chooser stays open.
5. Failed (the phone gives up) → toast "Không xác minh được. Chưa chuyển tài khoản."; nothing changes.
6. Phone with no fingerprint, face or screen lock set up → the switch continues without a check; the first time this happens on the device, App shows the warning "Máy chưa cài khóa màn hình nên ai cầm máy cũng có thể chuyển tài khoản. Hãy cài khóa màn hình trong cài đặt của máy."
7. Turning the switch off on the Security screen first asks for the check (when the phone has a lock); cancelled or failed → it stays on. Turning it on needs no check.

### Acceptance Criteria
- **AC-27** — With the check on, every switch into a saved account (dialog, direct switch, "Tiếp tục với…") asks for the check before the busy overlay appears or anything changes.
- **AC-28** — A cancelled or failed check leaves the current User (or the login screen) exactly as before
  and does not use up the saved account's sign-in.
- **AC-29** — On a phone with no lock set up, the switch proceeds; the warning appears once per device, never again.
- **AC-30** — With the check off, no check is asked.
- **AC-31** — The check is on by default; the setting belongs to the device (shared by all its accounts) and is kept across switch, logout and app restart.
- **AC-32** — Turning the check off requires passing it (when the phone has a lock); turning it on does not.
- **AC-33** — The check is never asked for a password login, adding an account, tapping an expired account, background renewal, or opening the app.
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
| S-ASW-53 | B shown expired | User taps B | No check; the login form opens with B's email | AC-33 |

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

**API:** `POST /auth/sessions/revoke-all` (authenticated)

### Preconditions
- The User is signed in on this device.

### Main Flow
1. The Security screen shows the action "Đăng xuất mọi thiết bị" with the hint "Mọi thiết bị khác phải đăng nhập lại bằng mật khẩu. Thiết bị này vẫn giữ đăng nhập."
2. User taps it; App asks: "Đăng xuất mọi thiết bị?" — "Tài khoản {email} sẽ bị đăng xuất khỏi mọi thiết bị khác, kể cả các máy đã lưu tài khoản để chuyển nhanh. Có thể mất vài phút để có hiệu lực hoàn toàn." with "Đăng xuất" / "Hủy".
3. On confirm, the action shows a busy state; System sets the User's sign-out-everywhere point to now.
4. System returns a fresh session and a fresh switch credential for this device; App swaps them in silently (same User, screen data stays) and shows the toast "Đã đăng xuất mọi thiết bị khác."
5. On every other device: the session ends at its next renewal (within the short access lifetime) and the User lands on the login screen; any saved entry for this User is refused at its next switch and shown as expired.

### Acceptance Criteria
- **AC-35** — After confirmation, every other device signed in as this User loses access no later than the end of its current short access lifetime, with no action on that device.
- **AC-36** — Every device that saved this User for switching can no longer switch into it; the entry shows as expired after the refused attempt.
- **AC-37** — This device stays signed in without a password, and its own saved entry for this User still switches.
- **AC-38** — Offline or server failure changes nothing and shows a Vietnamese message.
- **AC-39** — Saved accounts and sessions of other Users, on any device, are not affected.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-ASW-54 | A signed in on phones 1 and 2 | A signs out everywhere on phone 1 | Phone 1 keeps working with no password; toast "Đã đăng xuất mọi thiết bị khác." | Happy path, AC-37 |
| S-ASW-55 | Same, phone 2 active as A | Phone 2's session comes up for renewal | Renewal refused; phone 2 shows the login screen with A under "Tiếp tục với…"; tapping A → refused, marked expired, form prefilled | AC-35, AC-36 |
| S-ASW-56 | Phone 3 has A saved (inactive) | Someone picks A on phone 3 | `401`; A marked expired; expired toast | AC-36, BR-11 |
| S-ASW-57 | A session-renewal credential issued before the sign-out | Client presents it for renewal | `401 UNAUTHENTICATED` | BR-11, validation error (4xx) |
| S-ASW-58 | A switch credential issued before the sign-out | Client presents it to switch | `401 UNAUTHENTICATED` | BR-11 |
| S-ASW-59 | Phone 1 after the sign-out, B also saved | A → B → A | Both switches succeed with no password | AC-37 |
| S-ASW-60 | — | User taps "Hủy" in the confirmation | Nothing changes | |
| S-ASW-61 | Phone 1 offline | User confirms | Toast "Cần kết nối mạng để đăng xuất mọi thiết bị."; nothing changes | AC-38, network error |
| S-ASW-62 | Server returns 5xx | User confirms | Toast "Không thể đăng xuất mọi thiết bị. Vui lòng thử lại."; nothing changes | AC-38, system error (5xx) |
| S-ASW-63 | Phone 2 still holds short-lived access granted before the sign-out | Phone 2 asks to sign out everywhere | `401 UNAUTHENTICATED` (a lost phone cannot undo the owner's sign-out) | BR-11 |
| S-ASW-64 | — | User double-taps "Đăng xuất" in the confirmation | Exactly one request | |
| S-ASW-65 | Phone 2 also has B saved | A signs out everywhere | B on phone 2 still switches | AC-39 |
| S-ASW-66 | Phone 2 still holds short-lived access granted before the sign-out | Phone 2 renews A's switch credential (US-06) | `401`; the credential is not renewed | BR-11 |

### Edge Cases
- **EC-19** — A device offline at the moment of the sign-out is refused as soon as it next renews or switches.
- **EC-20** — Screens already showing data on another device keep it until that device's access ends (within the short access lifetime) — accepted.
- **EC-21** — Signing out everywhere again later works the same way; the newest moment wins.

### Definition of Done
- S-ASW-54–66 pass with two devices (or one device plus direct server calls).
- Server tests cover: renewal and switch credentials issued before the point refused, issued after accepted, the requesting device's fresh credentials accepted, stale access refused.

### Idempotency
Not idempotent: each confirmed request moves the point to now and returns fresh credentials for the requesting device. Repeating it is safe (the requesting device always stays signed in).

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
3. On confirm, System sets that User's sign-out-everywhere point to now; toast "Đã đăng xuất {email} khỏi mọi thiết bị."
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
| S-ASW-72 | M is also saved on X's own phone | X signs M out everywhere, then switches to M | `401`; M marked expired | AC-41 |
| S-ASW-73 | Members screen lists a pending User and X's own row | Screen renders | No "Đăng xuất mọi thiết bị" on either | AC-42 |

### Edge Cases
- **EC-22** — An Admin may sign out another Admin (there is no rank between Admins).
- **EC-23** — A User whose status is no longer active is already refused at renewal and switch; no extra action is needed.

### Definition of Done
- S-ASW-67–73 pass; server tests cover admin-only access, unknown target, self target.

### Idempotency
Repeating the action is safe; the newest moment wins.

---

## Out of Scope

- **Web (`frontend/`)** — frozen; no account switching, no use of the new endpoints there.
- **"Remember me" checkbox or opt-out** — explicitly rejected; every login is remembered.
- **App PIN** — a future app PIN will replace the "no screen lock" warning (US-07); not in this feature.
- **Locking the stored credentials themselves behind the fingerprint/face check** — the check guards the switch action only.
- **Identity check on background renewal, password login or app open.**
- **Changing passwords** — no change-password feature.
- **Ending already-granted short-lived access immediately** — it ends within its lifetime (US-08).
- **Changing the 7-day session renewal limit or the 15-minute access lifetime** — unchanged.
- **Syncing the account list across devices** — the list is per device only.
- **Profile pictures** — avatars use the initial letter; there is no profile image feature.
- **Offline switching** — a switch always needs the server.
- **Listing a User's devices, or signing out one device only** — "sign out everywhere" (US-08/US-09) is all-or-nothing.
- **Disabling a User from the app** — there is no such action today; a disabled User is already refused (BR-06).
- **Translating the existing English login screen copy** — only new copy added by this feature is in scope (tracked by the Vietnamese sweep).

## Open Questions

1. **Disabling a User** — the decision text assumed an existing admin "disable user" action; none exists in the app or server today (a User becomes disabled only by a direct database change). Sign out everywhere (US-09) covers the urgent case. Confirm that a disable action stays out of scope.
2. **Admin signing out another Admin** (EC-22) — allowed, as there is no rank between Admins. Confirm.
3. **Turning the identity check off requires passing it** (AC-32) — added so a person holding an unlocked phone cannot simply switch the check off first; costs one prompt. Confirm.
