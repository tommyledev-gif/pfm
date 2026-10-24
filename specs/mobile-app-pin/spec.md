# Feature Spec: App PIN (mobile)

> Source: owner request 2026-10-23 ("làm tính năng PIN cho app"); foreseen in `specs/mobile-account-switch/spec.md` Out of Scope ("a future app PIN will replace the 'no screen lock' warning (US-07)").
> Decisions confirmed by the owner 2026-10-23: the PIN **unlocks the app and confirms account switches** (fingerprint/face still work when the phone has them); **5 wrong PINs in a row sign out every account on the phone** and delete the PIN.
> Client: `mobile/` only. No API, no migration: the PIN never leaves the phone.
> Scenario prefix `S-PIN-NN`, task prefix `PIN`.

## Context

Today the app lock (US-12) and the check before switching accounts (US-07) rely on the phone's own lock (fingerprint, face, screen-lock code). A phone without a screen lock cannot turn the app lock on, and switching on it only shows a warning (or is refused for an admin account). An app PIN gives every phone the same protection, and gives phones that have biometrics a second way in.

Actor: **User** — whoever holds the phone. The PIN belongs to the **phone**, like the other security settings: every account saved on it shares it.

## Business Rules

| # | Rule |
|---|---|
| BR-01 | A PIN is exactly 6 digits. Optional, off by default. |
| BR-02 | Stored only on the phone, in secure storage (Keystore/Keychain), as PBKDF2-HMAC-SHA256 (random salt; iterations tuned per phone when the PIN is set: a 1,000-iteration probe scaled to ~250 ms, kept within 2,000-10,000, and stored with the hash) — never the digits themselves, never logged, never sent. |
| BR-03 | Setting a PIN asks for the phone's owner check first when the phone has a lock; otherwise it is set directly. Changing or turning it off asks for the current PIN. |
| BR-04 | Where the app asks the owner (app lock, switch check, changing a security setting), a set PIN is accepted; fingerprint/face/screen-lock code stay accepted when the phone has them. |
| BR-05 | With a PIN, the app lock can be turned on even on a phone without a screen lock, and switching on such a phone asks for the PIN instead of only warning (the admin-account refusal no longer applies). |
| BR-06 | ⚠️ Wrong PINs are counted across the whole phone and across app restarts. The 5th in a row signs out every account saved on the phone (their sessions end on the server where the phone still holds a token), deletes the PIN and shows the login screen with "Nhập sai mã PIN 5 lần. Đã đăng xuất mọi tài khoản trên máy." A right PIN, or fingerprint/face, resets the count. |
| BR-07 | "Quên mã PIN?" on the PIN prompt does the same as BR-06 after a confirm dialog, so a forgotten PIN never leaves the User stuck. |
| BR-08 | Turning the PIN off on a phone without a screen lock also turns the app lock off (nothing could open it); the toast says so. |
| BR-09 | Like the app lock, the PIN gates the screen: tokens are not encrypted with it, background renewal keeps working. |

## US-01: Set, change, turn off the PIN (Security screen)

### Main Flow
1. Settings → Bảo mật → group "Mã PIN" (between "Khóa ứng dụng" and "Xác minh khi chuyển tài khoản"). Footer: "Dùng 6 số để mở khóa ứng dụng và xác minh khi chuyển tài khoản. Sai 5 lần liên tiếp thì mọi tài khoản trên máy bị đăng xuất."
2. No PIN: row [Đặt mã PIN] → owner check (BR-03) → "Nhập mã PIN gồm 6 số" → "Nhập lại mã PIN" → match → toast "Đã đặt mã PIN". Mismatch → "Hai mã PIN chưa khớp. Nhập lại." back to the first entry.
3. PIN set: rows [Đổi mã PIN] (current → new → again → "Đã đổi mã PIN") and [Tắt mã PIN] (current → "Đã tắt mã PIN").

### Scenarios
| ID | Given | When | Then |
|---|---|---|---|
| S-PIN-01 | No PIN, phone has a fingerprint | Đặt mã PIN, pass the check, 123456 twice | PIN set; toast "Đã đặt mã PIN" |
| S-PIN-02 | No PIN, phone without a lock | Đặt mã PIN | No check; PIN entry straight away |
| S-PIN-03 | Setting | Second entry differs | "Hai mã PIN chưa khớp. Nhập lại."; nothing stored |
| S-PIN-04 | PIN set | Đổi mã PIN with the right current PIN | New PIN works, old one fails |
| S-PIN-05 | PIN set | Đổi/Tắt with a wrong current PIN | Counts toward BR-06; nothing changes |
| S-PIN-06 | PIN set, app lock on, phone without a lock | Tắt mã PIN | PIN off, app lock off; toast "Đã tắt mã PIN và khóa ứng dụng." |
| S-PIN-07 | Setting cancelled midway (back) | — | Nothing stored |

## US-02: Unlock the app with the PIN

### Main Flow
1. App lock on and a PIN set: the lock screen shows the User's avatar/name, "Nhập mã PIN", six dots and a keypad; [Dùng vân tay] / [Dùng khuôn mặt] / [Dùng khóa màn hình] when the phone has one (the system prompt opens once on its own, as today); "Quên mã PIN?".
2. Right PIN → the screen the User was on. Wrong → dots shake, "Sai mã PIN. Còn {{n}} lần thử." (n = 5 − wrong so far).
3. App lock toggle: on a phone without a screen lock but with a PIN, it can be turned on (BR-05); toggling asks the PIN (or the phone's check).

### Scenarios
| ID | Given | When | Then |
|---|---|---|---|
| S-PIN-10 | App lock on, PIN set | Cold start, type the right PIN | Home |
| S-PIN-11 | Same | Wrong PIN | Shake; "Sai mã PIN. Còn 4 lần thử." |
| S-PIN-12 | 4 wrong already (even before a restart) | 5th wrong | Every saved account signed out, PIN deleted, login screen with the BR-06 message |
| S-PIN-13 | PIN set, phone with fingerprint | Use the fingerprint | Unlocked; wrong count reset |
| S-PIN-14 | Phone without a lock, PIN set | Turn app lock on | Asks the PIN; on → works on next start |
| S-PIN-15 | Phone without a lock, no PIN | Turn app lock on | Unchanged message "Máy chưa cài khóa màn hình…" plus "Đặt mã PIN để bật khóa ứng dụng." |
| S-PIN-16 | Lock screen | Quên mã PIN? → [Đăng xuất mọi tài khoản] | BR-07 |

## US-03: Confirm an account switch with the PIN

### Main Flow
1. "Xác minh khi chuyển tài khoản" on and a PIN set: switching asks "Nhập mã PIN để chuyển tài khoản" (biometric button as in US-02). Right → the switch goes on; cancel → nothing changes; wrong → BR-06 counting.
2. No PIN: unchanged (US-07: phone check, warning, admin refusal).

### Scenarios
| ID | Given | When | Then |
|---|---|---|---|
| S-PIN-20 | PIN set, check on | Switch to B, right PIN | Switched |
| S-PIN-21 | Same | Close the PIN prompt | Not switched, no message |
| S-PIN-22 | Phone without a lock, PIN set, B is admin | Switch to B with the right PIN | Switched (BR-05) |

## Edge Cases
1. ⚠️ BR-06 signs out accounts whose token is sealed behind the phone's biometrics (logged-out "locked" accounts): their sealed token is deleted; the server session runs out on its own (60 days) or is ended from "Thiết bị đang đăng nhập". No money data is touched; unsynced offline writes stay in the outbox of their owner (existing rule).
2. The app is killed after a wrong PIN: the count was written before the result showed, so a restart does not reset it.
3. The PIN prompt is up when the app goes to the background: treated as cancelled (lock stays; switch not done).
4. Secure storage unreadable (corrupt): treated as "no PIN"; the app lock falls back to the phone's check.

## UI copy (VI)
| Where | Text |
|---|---|
| Group header / rows | Mã PIN · Đặt mã PIN · Đổi mã PIN · Tắt mã PIN |
| Group footer | Dùng 6 số để mở khóa ứng dụng và xác minh khi chuyển tài khoản. Sai 5 lần liên tiếp thì mọi tài khoản trên máy bị đăng xuất. |
| Prompt titles | Nhập mã PIN · Nhập mã PIN gồm 6 số · Nhập lại mã PIN · Nhập mã PIN hiện tại · Nhập mã PIN để chuyển tài khoản |
| Errors | Hai mã PIN chưa khớp. Nhập lại. · Sai mã PIN. Còn {{n}} lần thử. |
| Biometric buttons | Dùng vân tay · Dùng khuôn mặt · Dùng khóa màn hình |
| Forgot | Quên mã PIN? — dialog "Quên mã PIN?" / "Mọi tài khoản trên máy sẽ bị đăng xuất và mã PIN bị xóa. Đăng nhập lại bằng mật khẩu để dùng tiếp." / [Đăng xuất mọi tài khoản] [Giữ lại] |
| Toasts | Đã đặt mã PIN · Đã đổi mã PIN · Đã tắt mã PIN · Đã tắt mã PIN và khóa ứng dụng. · Nhập sai mã PIN 5 lần. Đã đăng xuất mọi tài khoản trên máy. |
| App lock, no lock & no PIN | Máy chưa cài khóa màn hình nên chưa bật được khóa ứng dụng. Đặt mã PIN để bật. |
| a11y | Phím {{digit}} · Xóa một số · Đã nhập {{count}} trên 6 số |

## Out of Scope
- Syncing the PIN between phones, or a server-side PIN.
- Encrypting stored tokens with the PIN.
- Changing the 5-minute app lock delay.

## Open Questions
1. ~~10,000 PBKDF2 iterations in plain JS: lowered if > 300 ms.~~ Resolved 2026-10-24: measured 10 ms with a JIT and 566 ms in V8's interpreter-only mode (the closest stand-in for Hermes), so the count is tuned per phone instead (BR-02). The PIN's strength comes from the 5-try limit and the Keystore, not the iteration count: 10^6 PINs fall to any offline attack whatever the count.
