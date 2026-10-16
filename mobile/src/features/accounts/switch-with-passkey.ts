import { getErrorCode, isNetworkError } from "@/lib/api-envelope";
import { useSecurityPrefsStore } from "@/stores/security-prefs-store";
import { useToastStore } from "@/stores/toast-store";
import { loginErrorMessage } from "@/features/auth/login-error";
import { LoginResult } from "@/features/auth/types";
import { completeLogin } from "@/features/accounts/complete-login";
import { PasskeyNativeError, passkeysAvailable } from "@/features/security/passkeys/native-passkey";
import { signInWithPasskey } from "@/features/security/passkeys/passkey-requests";

export type PasskeySwitchOutcome = "switched" | "cancelled" | "failed" | "no-passkey";

/**
 * Switches into a saved account by its passkey, when it has one: the phone
 * asks for the fingerprint/face, the SERVER checks it against that account's
 * own passkeys, and the answer is a fresh session for it. This replaces the
 * device-only check (identity-check.ts) — the check now belongs to the
 * account, not to whichever phone holds it.
 *
 * "no-passkey" hands back to the saved-account switch (device check + switch
 * token): the account has no passkey, passkeys cannot run in this build, or
 * its passkey lives on another phone. A passkey the server REJECTS is
 * "failed" and never falls back. With "Xác minh khi chuyển tài khoản" off,
 * nothing is asked here either.
 */
export async function trySwitchWithPasskey(userId: string): Promise<PasskeySwitchOutcome> {
  if (!passkeysAvailable() || !useSecurityPrefsStore.getState().identityCheckEnabled) return "no-passkey";

  let result: LoginResult;
  try {
    result = await signInWithPasskey(userId);
  } catch (error) {
    if (error instanceof PasskeyNativeError) {
      return error.kind === "cancelled" ? "cancelled" : "no-passkey";
    }
    const code = getErrorCode(error);
    if (code === "PASSKEY_NOT_FOUND" || code === "PASSKEYS_UNAVAILABLE" || isNetworkError(error)) return "no-passkey";
    useToastStore.getState().show(loginErrorMessage(error), "warning");
    return "failed";
  }

  await completeLogin(result, result.email ?? "");
  return "switched";
}
