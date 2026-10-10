import * as LocalAuthentication from "expo-local-authentication";

import { UserRole } from "@/lib/constants";
import { useSecurityPrefsStore } from "@/stores/security-prefs-store";
import { useToastStore } from "@/stores/toast-store";

export type IdentityCheckResult = "passed" | "cancelled" | "failed" | "unavailable";

// Spec US-07 copy.
const PROMPT_MESSAGE = "Xác minh để chuyển tài khoản";
const CANCEL_LABEL = "Hủy";
export const IDENTITY_CHECK_FAILED_MESSAGE = "Không xác minh được. Chưa chuyển tài khoản.";
const NO_LOCK_WARNING =
  "Máy chưa cài khóa màn hình nên ai cầm máy cũng có thể chuyển tài khoản. Hãy cài khóa màn hình trong cài đặt của máy.";
export const NO_LOCK_ADMIN_BLOCKED_MESSAGE =
  "Máy chưa có khóa màn hình nên chưa chuyển sang tài khoản admin. Cài khóa màn hình rồi thử lại.";

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
export async function confirmOwner(): Promise<IdentityCheckResult> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === LocalAuthentication.SecurityLevel.NONE) return "unavailable";

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: PROMPT_MESSAGE,
      cancelLabel: CANCEL_LABEL,
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
  useToastStore.getState().show(NO_LOCK_WARNING, "warning");
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
 * usually has no lock, can still switch.
 */
export async function passSwitchIdentityCheck(targetRole: UserRole): Promise<boolean> {
  if (!useSecurityPrefsStore.getState().identityCheckEnabled) return true;
  const result = await confirmOwner();
  if (result === "passed") return true;
  if (result === "unavailable") {
    if (targetRole === "admin" && !__DEV__) {
      useToastStore.getState().show(NO_LOCK_ADMIN_BLOCKED_MESSAGE, "warning");
      return false;
    }
    warnNoLockOnce();
    return true;
  }
  if (result === "failed") useToastStore.getState().show(IDENTITY_CHECK_FAILED_MESSAGE, "warning");
  return false;
}
