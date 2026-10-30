import { i18n, TranslationKey } from "@/lib/i18n";
import { PasskeyFailure } from "@/features/security/passkeys/native-passkey";

// What the phone's own failures mean to the User, per ceremony. Cancelled is
// not here: closing the sheet needs no message.
const SHARED: Partial<Record<PasskeyFailure, TranslationKey>> = {
  "no-provider": "security.passkeys.noProvider",
  timeout: "security.passkeys.timeout",
};

const ADD: Partial<Record<PasskeyFailure, TranslationKey>> = {
  ...SHARED,
  exists: "security.passkeys.exists",
  failed: "security.passkeys.addFailed",
};

const SIGN_IN: Partial<Record<PasskeyFailure, TranslationKey>> = {
  ...SHARED,
  "no-credential": "security.passkeys.noCredential",
  failed: "security.passkeys.signInFailed",
};

/** The message for a failed add (Bảo mật) or sign-in, in the current language; null when nothing should be said. */
export function passkeyFailureMessage(kind: PasskeyFailure, ceremony: "add" | "sign-in"): string | null {
  if (kind === "cancelled") return null;
  const messages = ceremony === "add" ? ADD : SIGN_IN;
  const key = messages[kind] ?? messages.failed;
  return key ? i18n.t(key) : null;
}
