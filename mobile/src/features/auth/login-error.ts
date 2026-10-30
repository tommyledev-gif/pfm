import { ErrorCodeKeys, errorText, getErrorCode } from "@/lib/api-envelope";
import { i18n } from "@/lib/i18n";

// LoginRateLimiter / LoginAccountRateLimiter: a 15-minute window. The server
// does not send it in `details`, so it is said from here.
const RATE_LIMIT_MINUTES = 15;

// The server's messages are English fragments meant for logs ("invalid email
// or password"), so login failures are worded here, by error code.
const LOGIN_ERROR_KEYS: ErrorCodeKeys = {
  // Never says which of the two was wrong.
  INVALID_CREDENTIALS: "auth.loginError.INVALID_CREDENTIALS",
  ACCOUNT_NOT_ACTIVATED: "auth.loginError.ACCOUNT_NOT_ACTIVATED",
  ACCOUNT_AWAITING_APPROVAL: "auth.loginError.ACCOUNT_AWAITING_APPROVAL",
  ACCOUNT_DISABLED: "auth.loginError.ACCOUNT_DISABLED",
  // Passkey sign-in (PasskeySignInButton).
  PASSKEY_FAILED: "auth.loginError.PASSKEY_FAILED",
  PASSKEYS_UNAVAILABLE: "auth.loginError.PASSKEYS_UNAVAILABLE",
};

/** What a failed sign-in says — password or passkey, same account-status answers. */
export function loginErrorMessage(error: unknown): string {
  if (getErrorCode(error) === "RATE_LIMITED") {
    return i18n.t("auth.loginError.RATE_LIMITED", { minutes: RATE_LIMIT_MINUTES });
  }
  return errorText(error, "auth.loginError.failed", LOGIN_ERROR_KEYS);
}
