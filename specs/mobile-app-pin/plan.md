# Implementation Plan: App PIN (mobile)

> Spec: [spec.md](./spec.md) · Extends specs/mobile-account-switch US-07/US-12 · Tasks `PIN-T`
> Stack: `mobile/` only. No backend, no migration.

## 1. Pre-flight: Spec Review Findings

| # | Type | Finding | Resolution |
|---|---|---|---|
| 1 | Gap | No crypto library in the app; adding `expo-crypto` is a native module, which an OTA update cannot ship. | Pure-TS SHA-256 / HMAC / PBKDF2 in `src/lib/crypto/` (checked against NIST/RFC test vectors). Salt from `crypto.getRandomValues` when present, else a mix of `Math.random` and time: the salt only needs uniqueness, secrecy comes from the Keystore-encrypted storage. |
| 2 | Gap | The owner checks are called from plain async functions (`passSwitchIdentityCheck`) and components; a PIN keypad is UI. | An imperative prompt store (`requestPin(options): Promise<result>`) and one `<PinPromptHost />` mounted in the root layout above everything, the lock overlay included. |
| 3 | Gap | Four places call `confirmOwner` directly (switch, lock overlay, two toggles). | One `verifyOwner(pinTitle, systemPrompt)`: PIN set → PIN prompt (biometric button inside); no PIN → `confirmOwner` as today. The switch and both toggles call it; the lock overlay shows the keypad inline (`AppLockPinScreen`). Lives in `identity-check.ts` next to `confirmOwner` (a separate `owner-check.ts` would import from it while it imports `verifyOwner`: a cycle). |
| 4 | Ambiguity | "Sign out every account" — which helper? | `signOutEveryAccount()`: `useAccountRegistryStore.remove(…, { endSession: true, dropLocalData: true })` for every saved account but the active one, then `removeActiveAccount()`; then delete the PIN and the counter. |
| 5 | Risk | The wrong-PIN count must survive a kill/restart (BR-06, EC-2). | Counter in secure storage, written before the result is shown. |
| 6 | Gap | `hasPin` must be reactive for the Security screen and toggles. | `usePinStore` (Zustand, `hasPin`, hydrated from secure storage at start, like the session). |

## 2. Architecture

```text
mobile/
├── app/_layout.tsx ✎                         mount <PinPromptHost/>, hydrate PIN store
├── app/(app)/security.tsx ✎                  PinSection
├── src/lib/crypto/sha256.ts ★                SHA-256, HMAC-SHA256, PBKDF2
├── src/lib/constants.ts ✎                    PIN constants + secure-store keys
└── src/features/security/
    ├── pin/pin-store.ts ★                    hasPin, set/verify/clear, wrong-count
    ├── pin/pin-prompt-store.ts ★             requestPin() promise API
    ├── pin/sign-out-device.ts ★              BR-06/BR-07 wipe
    ├── pin/pin-copy.ts ★                     strings
    ├── pin/pin-entry.ts ★                    submitPin(): check, wipe on the 5th wrong
    ├── identity-check.ts ✎                   verifyOwner(), phoneCheckLabel(); switch check via verifyOwner
    └── components/
        ├── PinPad.tsx ★                      dots + keypad
        ├── PinAltActions.tsx ★               phone-check button, "Quên mã PIN?" + confirm
        ├── PinPromptHost.tsx ★               modal: verify / create / change flows
        ├── PinSection.tsx ★                  Security screen group
        ├── AppLockPinScreen.tsx ★            lock screen with the keypad
        ├── AppLockOverlay.tsx ✎              PIN screen or phone check
        ├── AppLockToggleRow.tsx ✎, IdentityCheckToggleRow.tsx ✎
```

### Rules → enforcement

| Rule | Source | Enforcement |
|---|---|---|
| 6 digits, hashed (PBKDF2-SHA256, salt, 10k) in secure storage | BR-01/02 | `pin-store.setPin`, `verifyPin` |
| Setting asks the phone check; change/off ask the current PIN | BR-03 | `PinSection` |
| PIN accepted wherever the owner is asked | BR-04 | `verifyOwner` |
| App lock on without a screen lock when a PIN exists | BR-05 | `AppLockToggleRow` |
| ⚠️ 5 wrong in a row → wipe | BR-06 | `pin-store.recordWrong` → `signOutEveryAccount` |
| Forgot PIN → wipe after confirm | BR-07 | `PinPromptHost` confirm dialog |
| PIN off on a lockless phone → app lock off | BR-08 | `PinSection` |

## 3. Error / outcome flows

| Situation | Result |
|---|---|
| Right PIN / biometric passed | `passed`, count reset |
| Prompt closed / app backgrounded | `cancelled`, nothing changes |
| Wrong PIN, count < 5 | shake + "Sai mã PIN. Còn {{n}} lần thử." |
| 5th wrong / Quên mã PIN confirmed | wipe, login screen, toast |
| Secure storage unreadable | treated as no PIN |

## 4. Convention Notes

| Rule | How |
|---|---|
| Server state only in TanStack Query | No server state involved; device prefs in Zustand (precedent: security-prefs-store) |
| Secrets only via `lib/secure-storage.ts` | PIN hash and counter go through it |
| No magic numbers | `PIN_LENGTH`, `PIN_MAX_WRONG`, `PIN_PBKDF2_*`, `PIN_CHECK_TARGET_MS` in constants |
| ≤ 300 lines, JSX > 30 lines extracted | Keypad, host, section are separate files |
| UX copy | Spec §UI copy, glossary row "mã PIN" |

## 5. testID

| Element | testID |
|---|---|
| Keypad digit / delete | `btn-pin-digit-{d}` / `btn-pin-delete` |
| Prompt container / close / forgot / biometric | `modal-pin-prompt` / `btn-pin-close` / `btn-pin-forgot` / `btn-pin-biometric` |
| Security rows | `row-pin-set` / `row-pin-change` / `row-pin-off` |

## 6. Open Tasks

| ID | Task |
|---|---|
| PIN-T01 | `lib/crypto/sha256.ts` + vector check (node) |
| PIN-T02 | Constants, `pin-store`, `pin-prompt-store`, `sign-out-device` |
| PIN-T03 | `PinPad`, `PinPromptHost` (verify, create, change; forgot dialog; biometric button) |
| PIN-T04 | `verifyOwner`; switch check, lock overlay, two toggles use it |
| PIN-T05 | `PinSection` on the Security screen; root layout mounts host + hydrates |
| PIN-T06 | Verify: tsc, eslint, crypto vectors; on-device checklist for the owner |
