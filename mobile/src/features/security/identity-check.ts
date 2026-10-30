import * as LocalAuthentication from "expo-local-authentication";

import { UserRole } from "@/lib/constants";
import { i18n, TranslationKey } from "@/lib/i18n";
import { useSecurityPrefsStore } from "@/stores/security-prefs-store";
import { useToastStore } from "@/stores/toast-store";
import { PIN_COPY } from "@/features/security/pin/pin-copy";
import { requestPin } from "@/features/security/pin/pin-prompt-store";
import { usePinStore } from "@/features/security/pin/pin-store";

export type IdentityCheckResult = "passed" | "cancelled" | "failed" | "unavailable";

// Spec US-07 copy. Keys: the prompts and toasts are read when they show.
const PROMPT_MESSAGE = "security.identityCheck.switchPrompt" satisfies TranslationKey;
// Turning a Security screen switch (identity check, app lock) on or off.
export const CHANGE_SETTING_PROMPT = "security.identityCheck.changeSettingPrompt" satisfies TranslationKey;
export const IDENTITY_CHECK_FAILED_MESSAGE = "security.identityCheck.failed" satisfies TranslationKey;
// The app PIN (specs/mobile-app-pin) is the answer for a phone with no lock.
const NO_LOCK_WARNING = "security.identityCheck.noLockWarning" satisfies TranslationKey;
export const NO_LOCK_ADMIN_BLOCKED_MESSAGE = "security.identityCheck.noLockAdminBlocked" satisfies TranslationKey;

const BIOMETRIC_LABEL = {
  fingerprint: "security.identityCheck.useFingerprint",
  face: "security.identityCheck.useFace",
  screenLock: "security.identityCheck.useScreenLock",
} as const satisfies Record<string, TranslationKey>;

/** Whether the phone has any lock (fingerprint, face or a screen-lock code). */
export async function phoneHasLock(): Promise<boolean> {
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** The button that opens the phone's own check, named for it; null = none. */
export async function phoneCheckLabel(): Promise<string | null> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === LocalAuthentication.SecurityLevel.NONE) return null;
    if (level === LocalAuthentication.SecurityLevel.SECRET) return i18n.t(BIOMETRIC_LABEL.screenLock);
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return i18n.t(BIOMETRIC_LABEL.fingerprint);
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return i18n.t(BIOMETRIC_LABEL.face);
    return i18n.t(BIOMETRIC_LABEL.screenLock);
  } catch {
    return null;
  }
}

/**
 * Asks whoever holds the phone to prove they own it (BR-04). With an app PIN
 * set: the PIN prompt, whose button also opens the phone's own check. Without
 * one: the phone's check, as before. Closing the prompt, or a wipe on the 5th
 * wrong PIN, is "cancelled": the caller stops without a message of its own.
 */
export async function verifyOwner(pinTitle: string, systemPrompt: string): Promise<IdentityCheckResult> {
  if (!usePinStore.getState().hasPin) return confirmOwner(systemPrompt);
  const result = await requestPin({ kind: "verify", title: pinTitle, biometricPrompt: systemPrompt });
  if (result === "passed") return "passed";
  if (result === "no-pin") return confirmOwner(systemPrompt);
  return "cancelled";
}

const CANCELLED_ERRORS: readonly LocalAuthentication.LocalAuthenticationError[] = [
  "user_cancel",
  "system_cancel",
  "app_cancel",
];
const UNAVAILABLE_ERRORS: readonly LocalAuthentication.LocalAuthenticationError[] = [
  "not_enrolled",
  "passcode_not_set",
  "not_available",
];

/**
 * Asks the phone to confirm its owner (fingerprint, face, or the screen-lock
 * code as a fallback — disableDeviceFallback: false is what lets an iPhone in
 * Expo Go, where Face ID is unavailable, pass with its passcode).
 * plan.md Finding #25 maps the outcomes; "app_cancel"/"system_cancel" also
 * cover the app going to the background mid-prompt (EC-16).
 *
 * A UI gate only — the stored credentials themselves are not locked
 * behind it (spec Out of Scope).
 */
export async function confirmOwner(promptMessage: string = i18n.t(PROMPT_MESSAGE)): Promise<IdentityCheckResult> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === LocalAuthentication.SecurityLevel.NONE) return "unavailable";

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: i18n.t("common.action.cancel"),
      disableDeviceFallback: false,
    });
    if (result.success) return "passed";
    if (CANCELLED_ERRORS.includes(result.error)) return "cancelled";
    if (UNAVAILABLE_ERRORS.includes(result.error)) return "unavailable";
    return "failed";
  } catch {
    return "failed";
  }
}

/** Shows the "no screen lock" warning the first time only (BR-15, AC-29). */
export function warnNoLockOnce(): void {
  const { noLockWarningShown, markNoLockWarningShown } = useSecurityPrefsStore.getState();
  if (noLockWarningShown) return;
  markNoLockWarningShown();
  useToastStore.getState().show(i18n.t(NO_LOCK_WARNING), "warning");
}

/**
 * The gate every saved-account switch passes through (BR-14): true = go on.
 * Off → no prompt (AC-30). Cancelled → silently stop; failed → toast and stop.
 *
 * No screen lock on the phone: nothing can confirm who is holding it. Going on
 * is acceptable for an ordinary account (one-time warning, BR-15), but never
 * for an admin account, whose switch would hand the holder invites and every
 * other member's session controls. That one stops here, with a toast saying
 * how to proceed. A debug build keeps the old behaviour so an emulator, which
 * usually has no lock, can still switch. With an app PIN the phone always has
 * something to check, so neither the warning nor the refusal comes up (BR-05).
 */
export async function passSwitchIdentityCheck(targetRole: UserRole): Promise<boolean> {
  if (!useSecurityPrefsStore.getState().identityCheckEnabled) return true;
  const result = await verifyOwner(i18n.t(PIN_COPY.forSwitch), i18n.t(PROMPT_MESSAGE));
  if (result === "passed") return true;
  if (result === "unavailable") {
    if (targetRole === "admin" && !__DEV__) {
      useToastStore.getState().show(i18n.t(NO_LOCK_ADMIN_BLOCKED_MESSAGE), "warning");
      return false;
    }
    warnNoLockOnce();
    return true;
  }
  if (result === "failed") useToastStore.getState().show(i18n.t(IDENTITY_CHECK_FAILED_MESSAGE), "warning");
  return false;
}
