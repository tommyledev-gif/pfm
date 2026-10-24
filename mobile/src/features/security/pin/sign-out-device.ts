import { userIdFromAccessToken } from "@/lib/jwt";
import { useSessionStore } from "@/stores/session-store";
import { useToastStore } from "@/stores/toast-store";
import { useAccountRegistryStore } from "@/features/accounts/account-registry-store";
import { removeActiveAccount } from "@/features/accounts/remove-account";
import { PIN_COPY } from "@/features/security/pin/pin-copy";
import { usePinStore } from "@/features/security/pin/pin-store";

export type WipeReason = "wrong-pin" | "forgot-pin";

let wiping: Promise<void> | null = null;

/**
 * BR-06 / BR-07: every account saved on the phone is signed out and the PIN
 * deleted. Saved accounts end their sessions where the phone still holds a
 * token (a locked account's sealed token is just deleted, EC-1); the account
 * in use goes last, which shows the login screen. The PIN goes even when a
 * sign-out fails, so the phone is never left with a PIN nobody knows.
 */
export function signOutEveryAccount(reason: WipeReason): Promise<void> {
  wiping ??= wipe(reason).finally(() => {
    wiping = null;
  });
  return wiping;
}

async function wipe(reason: WipeReason): Promise<void> {
  try {
    const activeUserId = userIdFromAccessToken(useSessionStore.getState().accessToken);
    const registry = useAccountRegistryStore.getState();
    for (const account of [...registry.accounts]) {
      if (account.userId === activeUserId) continue;
      await registry.remove(account.userId, { endSession: true, dropLocalData: true }).catch(() => {});
    }
    if (useSessionStore.getState().accessToken !== null) await removeActiveAccount().catch(() => {});
  } finally {
    await usePinStore.getState().clearPin();
    useToastStore.getState().show(reason === "wrong-pin" ? PIN_COPY.wipedWrong : PIN_COPY.wipedForgot, "warning");
  }
}
